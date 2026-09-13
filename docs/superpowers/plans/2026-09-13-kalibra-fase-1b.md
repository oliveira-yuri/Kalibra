# Kalibra Fase 1B — Edital e fila de aprovações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o edital de texto solto em estrutura estudável — conceitos globais, itens de programa por cargo e deduplicação real — e construir a fila de aprovação que governa tudo que a IA vai propor nas fases seguintes.

**Architecture:** `lib/core` ganha a espinha do domínio: `concept` global por usuário, `syllabus_item` escopado ao workspace, e a ligação N:N com cargos onde a deduplicação mora. A extração continua simulada (a IA chega na Fase 4), mas atrás de um contrato de saída fixo, para que a Fase 4 troque o produtor sem tocar em nenhum consumidor. A fila de aprovação nasce agora porque edital, diagnóstico e plano todos produzem itens para ela.

**Tech Stack:** TypeScript 5.9, Vitest 3, React 19.1.0, Vite 7, Wouter, Tailwind 4, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-12-kalibra-design.md`

## Global Constraints

- **Seções do spec que governam esta fase:** §4.1 (concept e syllabus), §4.4 (documentos e extração), §4.10 (fila de aprovação), §5 (preservação do frontend), §6 (`/aprovacoes`), e os pedidos de design PD-06, PD-07 e PD-08.
- **Nenhuma tela chama `fetch` ou `localStorage` direto.** Só hooks de `src/domain/`.
- **`lib/core` é puro:** sem leitura de relógio, sem I/O, toda função recebe suas entradas explicitamente. `environment: 'node'` no vitest do pacote é restrição de design.
- **Nenhuma cor, raio, fonte, sombra ou espaçamento fora dos tokens `k-*`** em `artifacts/kalibra/src/index.css`, que não pode ser modificado.
- **Os dois temas funcionam.** O padrão é dark; o claro é suportado por inteiro.
- React e react-dom em **exatamente `19.1.0`**; Zod **3.x**; `minimumReleaseAge: 1440` intocado.
- **Nenhum segredo em commit, chat ou arquivo versionado.**
- **Mensagens de commit em português**, `tipo: descrição`, terminando o corpo com:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- **Portão de cada task:** `pnpm run typecheck`, `pnpm run test` e `pnpm run build`, da raiz.
- **Snapshots mudam quando a task pede, e só então.** Ler o diff antes de aceitar, descrevê-lo no relatório, e só depois `-u`. Nunca `-u` antes de ler.
- **O relógio de teste é congelado por construtor local** (`new Date(2026, 8, 13, 12, 0)`), nunca por instante UTC — a Fase 1A fechou essa dependência de fuso e ela não deve voltar.

### Estado herdado da Fase 1A

- `lib/core` tem 58 testes: `workspace/status`, `workspace/availability`, `workspace/slug`, `workspace/exam-dates`, `fsrs/schedule`.
- `src/domain/` tem `useWorkspaces`, `useNotes`, `useStudyState`, `useTheme`, com adaptadores locais. `config.ts` é uma asserção que lança para qualquer valor diferente de `'local'`.
- `WorkspaceDraft` tem `status`, `cargos` (obrigatório, nunca vazio), `availability`, `hasEdital`, além dos campos antigos `sourceMode`, `importStatus`, `progress`, `nextAction`, `active`.
- `migrateWorkspace` é total, idempotente e testada contra lixo.
- A suíte tem 122 testes e roda igual em qualquer fuso.

### Dois débitos herdados que esta fase precisa quitar

**D1 — A máquina de estados modela um fluxo que o app não segue.** `NovoWorkspace` cria o workspace já em `aguardando_revisao_edital`, sem passar por `aguardando_upload` nem `extraindo_edital`, e `TRANSITIONS` não tem aresta que admita isso. Enquanto `canTransition` não é aplicada, ninguém percebe. Esta fase constrói o fluxo real de edital, então é aqui que a máquina e a realidade se reconciliam — **e é aqui que `canTransition` passa a ser aplicada de verdade** (Task 4).

**D2 — `hasEdital` e `status` são duas representações do mesmo fato e já podem discordar.** Esta fase elege `status` como canônico e remove `hasEdital` do formato persistido, derivando-o quando alguma tela precisar (Task 5).

---

## Escopo desta fase

A extração do edital **continua simulada**. A IA chega na Fase 4. O que esta fase constrói é tudo o que existe em volta dela: o contrato de saída, a normalização determinística, a deduplicação, a tela de revisão, o versionamento e a aprovação. Quando a Fase 4 trocar o produtor simulado por um job de IA, nenhum consumidor muda.

Fora de escopo, deliberadamente:

- **Geração de questões, diagnóstico e plano quinzenal**, e os tipos de aprovação que dependem deles. A fila nasce com os dois tipos que esta fase realmente produz; um tipo declarado e nunca emitido é código morto fingindo cobertura.
- **A entidade `source_document` do spec §4.4.** Ela guarda `storage_key`, `mime`, `hash` e o texto extraído de um arquivo real — coisas que só existem quando houver storage de verdade, na Fase 2. Enquanto a persistência é `localStorage`, o texto colado continua no campo `sourceText` do workspace, que já existe. A Fase 2 cria a entidade e migra; nada nesta fase precisa mudar para isso acontecer, porque a extração já consome uma string e não um arquivo.
- **O agrupamento da sidebar em cinco seções** (spec §5.3). É decisão aprovada, mas faz sentido quando existirem as telas dos outros grupos. Esta fase acrescenta `Aprovações` à lista plana atual.

---

## Estrutura de arquivos

**Criados em `lib/core`:**

| Arquivo | Responsabilidade |
|---|---|
| `src/syllabus/concept.ts` | conceito global, normalização de nome, casamento por alias |
| `src/syllabus/syllabus.ts` | item de programa, ligação com cargos, consolidação |
| `src/syllabus/dedup.ts` | deduplicação entre cargos e cálculo de comum vs específico |
| `src/syllabus/extraction.ts` | contrato de saída da extração e normalização determinística |
| `src/syllabus/diff.ts` | comparação entre versões de edital (PD-08) |
| `src/approval/approval.ts` | item de aprovação, estados e transições |

**Criados no frontend:**

| Arquivo | Responsabilidade |
|---|---|
| `src/domain/useSyllabus.ts` | hook de programa de estudo |
| `src/domain/useApprovals.ts` | hook da fila de aprovação |
| `src/domain/useExtraction.ts` | hook do processo de extração |
| `src/domain/adapters/local/syllabus.ts` | persistência do programa |
| `src/domain/adapters/local/approvals.ts` | persistência da fila |
| `src/domain/adapters/local/extraction.ts` | produtor simulado da extração |
| `src/pages/Aprovacoes.tsx` | fila única de aprovação |
| `src/components/ApprovalCard.tsx` | item da fila, colapsável, com diff |
| `src/components/ApprovalDiff.tsx` | antes/depois em duas colunas |
| `src/components/SyllabusTree.tsx` | árvore de matérias e tópicos editável |
| `src/components/SourceExcerpt.tsx` | trecho do edital que justifica um item |
| `src/components/CargoFilter.tsx` | filtro por cargo, reutilizado em duas telas |

**Modificados:**

| Arquivo | Mudança |
|---|---|
| `lib/core/src/workspace/status.ts` | reconciliar transições com o fluxo real; exportar estado inicial |
| `lib/core/src/index.ts` | exportar os módulos novos |
| `src/domain/adapters/local/workspaces.ts` | remover `hasEdital` do formato; migração |
| `src/components/EditalUploadProgress.tsx` | dirigido pelo adaptador, com os quatro erros do PD-07 |
| `src/pages/EditalRevisar.tsx` | pesos, quantidade de questões, trechos-fonte, incertezas, dedup, diff |
| `src/pages/Edital.tsx` | lista vinda do programa, filtro por cargo |
| `src/pages/NovoWorkspace.tsx` | usar o fluxo de estados real |
| `src/config/nav.ts` | acrescentar Aprovações |
| `src/routes/WorkspaceApp.tsx` | rota `/aprovacoes` |

---

### Task 1: Conceito global e casamento por alias

A espinha do spec §4.1. Um `concept` existe uma vez por usuário, independente de quantos editais o mencionem — é isso que permite reutilizar nota e estado de revisão entre workspaces.

**Files:**
- Create: `lib/core/src/syllabus/concept.ts`, `lib/core/src/syllabus/concept.test.ts`
- Modify: `lib/core/src/index.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `export type ConceptStatus = 'confirmed' | 'provisional'`
  - `export type ConceptKind = 'disciplina' | 'topico' | 'subtopico'`
  - `export type Concept = { id: string; canonicalName: string; slug: string; parentId: string | null; kind: ConceptKind; aliases: string[]; status: ConceptStatus }`
  - `export function normalizeConceptName(name: string): string`
  - `export type ConceptMatch = { concept: Concept; score: number }`
  - `export function matchConcept(name: string, concepts: readonly Concept[]): ConceptMatch | null`
  - `export const CONCEPT_MATCH_THRESHOLD = 0.82`
  - `export function shouldLinkDirectly(match: ConceptMatch | null): boolean`

> **A regra de negócio central desta task**, vinda da restrição R4 do spec: um item só liga direto a um conceito existente quando o score passa do limiar **e** o conceito já é `confirmed`. Qualquer outro caso vira proposta para a fila de aprovação. Isso impede que extração automática polua a biblioteca global do usuário.

- [ ] **Step 1: Escrever os testes que falham**

`lib/core/src/syllabus/concept.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  normalizeConceptName, matchConcept, shouldLinkDirectly,
  CONCEPT_MATCH_THRESHOLD, type Concept,
} from './concept';

const conceito = (over: Partial<Concept> = {}): Concept => ({
  id: 'k1',
  canonicalName: 'Porcentagem e juros simples',
  slug: 'porcentagem-e-juros-simples',
  parentId: null,
  kind: 'topico',
  aliases: [],
  status: 'confirmed',
  ...over,
});

describe('normalização de nome', () => {
  it('remove acentos e caixa', () => {
    expect(normalizeConceptName('Educação Física')).toBe('educacao fisica');
  });

  it('colapsa espaços e apara as pontas', () => {
    expect(normalizeConceptName('  Razão   e    proporção  ')).toBe('razao e proporcao');
  });

  it('remove numeração de item de edital', () => {
    expect(normalizeConceptName('1.2.3 Crase')).toBe('crase');
    expect(normalizeConceptName('4 - Concordância verbal')).toBe('concordancia verbal');
    expect(normalizeConceptName('II – Ortografia')).toBe('ortografia');
  });

  it('remove pontuação final', () => {
    expect(normalizeConceptName('Interpretação de textos.')).toBe('interpretacao de textos');
    expect(normalizeConceptName('Crase;')).toBe('crase');
  });

  it('devolve string vazia quando não sobra nada', () => {
    expect(normalizeConceptName('1.2.')).toBe('');
    expect(normalizeConceptName('   ')).toBe('');
  });
});

describe('casamento de conceito', () => {
  it('casa exatamente pelo nome canônico', () => {
    const match = matchConcept('Porcentagem e juros simples', [conceito()]);
    expect(match?.concept.id).toBe('k1');
    expect(match?.score).toBe(1);
  });

  it('casa ignorando acento, caixa e numeração', () => {
    const match = matchConcept('3.1 PORCENTAGEM E JUROS SIMPLES', [conceito()]);
    expect(match?.concept.id).toBe('k1');
    expect(match?.score).toBe(1);
  });

  it('casa por alias', () => {
    const match = matchConcept('Emprego do acento indicativo de crase', [
      conceito({ id: 'k2', canonicalName: 'Crase', slug: 'crase', aliases: ['Emprego do acento indicativo de crase'] }),
    ]);
    expect(match?.concept.id).toBe('k2');
    expect(match?.score).toBe(1);
  });

  it('casa parcialmente quando o nome é próximo', () => {
    const match = matchConcept('Porcentagem e juros simple', [conceito()]);
    expect(match).not.toBeNull();
    expect(match!.score).toBeGreaterThan(CONCEPT_MATCH_THRESHOLD);
    expect(match!.score).toBeLessThan(1);
  });

  it('não casa conceitos diferentes', () => {
    expect(matchConcept('Legislação municipal', [conceito()])).toBeNull();
  });

  it('devolve o melhor candidato quando há vários', () => {
    const match = matchConcept('Crase', [
      conceito({ id: 'k1', canonicalName: 'Crase e regência', slug: 'crase-e-regencia' }),
      conceito({ id: 'k2', canonicalName: 'Crase', slug: 'crase' }),
    ]);
    expect(match?.concept.id).toBe('k2');
  });

  it('devolve null para nome vazio', () => {
    expect(matchConcept('', [conceito()])).toBeNull();
    expect(matchConcept('1.2.', [conceito()])).toBeNull();
  });

  it('devolve null quando não há conceitos', () => {
    expect(matchConcept('Crase', [])).toBeNull();
  });
});

describe('decisão de ligar direto', () => {
  it('liga quando passa do limiar e o conceito é confirmado', () => {
    expect(shouldLinkDirectly({ concept: conceito(), score: 0.95 })).toBe(true);
  });

  it('não liga quando o score fica abaixo do limiar', () => {
    expect(shouldLinkDirectly({ concept: conceito(), score: 0.5 })).toBe(false);
  });

  it('não liga a conceito provisório, mesmo com casamento perfeito', () => {
    expect(shouldLinkDirectly({ concept: conceito({ status: 'provisional' }), score: 1 })).toBe(false);
  });

  it('não liga quando não houve casamento', () => {
    expect(shouldLinkDirectly(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
cd "C:/Users/User/Documents/Kalibra"
pnpm --filter @workspace/core run test
```

Esperado: FALHA com `Failed to resolve import "./concept"`.

- [ ] **Step 3: Implementar**

`lib/core/src/syllabus/concept.ts`:

```ts
export type ConceptStatus = 'confirmed' | 'provisional';
export type ConceptKind = 'disciplina' | 'topico' | 'subtopico';

export type Concept = {
  id: string;
  canonicalName: string;
  slug: string;
  parentId: string | null;
  kind: ConceptKind;
  aliases: string[];
  status: ConceptStatus;
};

export type ConceptMatch = {
  concept: Concept;
  score: number;
};

/** Abaixo disto, a ligação vira proposta em vez de fato. */
export const CONCEPT_MATCH_THRESHOLD = 0.82;

// Numeração de item de edital: "1.2.3", "4 -", "II –", "a)" etc.
const LEADING_NUMBERING = /^\s*(?:[0-9]+(?:\.[0-9]+)*|[ivxlcdm]+|[a-z])\s*[.)\-–—]*\s+/i;
const TRAILING_PUNCTUATION = /[.,;:]+\s*$/;

export function normalizeConceptName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(LEADING_NUMBERING, '')
    .replace(TRAILING_PUNCTUATION, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Similaridade por distância de edição normalizada. Escolhida em vez de algo
 * mais sofisticado porque é determinística, explicável e não precisa de corpus:
 * dois nomes de tópico de edital que diferem por uma letra são o mesmo tópico.
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = Array.from({ length: cols }, (_, index) => index);

  for (let i = 1; i < rows; i += 1) {
    const current = [i];
    for (let j = 1; j < cols; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, substitution);
    }
    previous = current;
  }

  const distance = previous[cols - 1];
  return 1 - distance / Math.max(a.length, b.length);
}

export function matchConcept(name: string, concepts: readonly Concept[]): ConceptMatch | null {
  const normalized = normalizeConceptName(name);
  if (!normalized) return null;

  let best: ConceptMatch | null = null;

  for (const concept of concepts) {
    const candidates = [concept.canonicalName, ...concept.aliases];
    for (const candidate of candidates) {
      const score = similarity(normalized, normalizeConceptName(candidate));
      if (score >= CONCEPT_MATCH_THRESHOLD && (best === null || score > best.score)) {
        best = { concept, score };
      }
    }
  }

  return best;
}

/**
 * Restrição R4 do spec: liga direto apenas quando o casamento passa do limiar
 * E o conceito encontrado já é `confirmed`. Conceito provisório nunca serve de
 * ponte — senão a extração automática polui a biblioteca global do usuário.
 */
export function shouldLinkDirectly(match: ConceptMatch | null): boolean {
  if (match === null) return false;
  if (match.concept.status !== 'confirmed') return false;
  return match.score >= CONCEPT_MATCH_THRESHOLD;
}
```

- [ ] **Step 4: Exportar do índice**

Acrescentar a `lib/core/src/index.ts`:

```ts
export * from './syllabus/concept';
```

- [ ] **Step 5: Rodar até passar**

```bash
pnpm --filter @workspace/core run test
pnpm run typecheck
```

Se o teste de casamento parcial (`'Porcentagem e juros simple'`) falhar por ficar abaixo do limiar, **não baixe o limiar para fazer o teste passar** — confira primeiro se a normalização está sendo aplicada aos dois lados da comparação.

- [ ] **Step 6: Commit**

```bash
git add lib/core/src
git commit -m "feat: modelar conceito global e casamento por alias em lib/core"
```

---

### Task 2: Item de programa e ligação com cargos

Onde a deduplicação mora. Um `syllabus_item` com duas linhas de cargo é conteúdo comum; com uma, é específico. A lista consolidada é a própria tabela, sem `DISTINCT`.

**Files:**
- Create: `lib/core/src/syllabus/syllabus.ts`, `lib/core/src/syllabus/syllabus.test.ts`
- Modify: `lib/core/src/index.ts`

**Interfaces:**
- Consumes: `Concept` de `./concept`
- Produces:
  - `export type SyllabusItem = { id: string; workspaceId: string; conceptId: string; parentItemId: string | null; sourceLabel: string; sourceExcerpt: string | null; page: number | null; confidence: number; uncertain: boolean }`
  - `export type SyllabusItemCargo = { syllabusItemId: string; cargoId: string; weight: number | null; questionCount: number | null }`
  - `export type Syllabus = { items: SyllabusItem[]; links: SyllabusItemCargo[] }`
  - `export function cargosFor(syllabus: Syllabus, itemId: string): string[]`
  - `export function isCommon(syllabus: Syllabus, itemId: string): boolean`
  - `export function itemsForCargo(syllabus: Syllabus, cargoId: string): SyllabusItem[]`
  - `export function totalQuestionsFor(syllabus: Syllabus, cargoId: string): number`
  - `export function consolidatedQuestionCount(syllabus: Syllabus, itemId: string): number`
  - `export function emptySyllabus(): Syllabus`

- [ ] **Step 1: Escrever os testes que falham**

`lib/core/src/syllabus/syllabus.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  cargosFor, isCommon, itemsForCargo, totalQuestionsFor,
  consolidatedQuestionCount, emptySyllabus, type Syllabus,
} from './syllabus';

const item = (id: string, conceptId: string) => ({
  id, workspaceId: 'w1', conceptId, parentItemId: null,
  sourceLabel: id, sourceExcerpt: null, page: null, confidence: 1, uncertain: false,
});

// Matemática e Português são comuns aos dois cargos; Legislação é do c1 e
// Tecnologia é do c2 — o exemplo do §5 do brief.
const SYLLABUS: Syllabus = {
  items: [item('i1', 'mat'), item('i2', 'por'), item('i3', 'leg'), item('i4', 'tec')],
  links: [
    { syllabusItemId: 'i1', cargoId: 'c1', weight: 25, questionCount: 10 },
    { syllabusItemId: 'i1', cargoId: 'c2', weight: 30, questionCount: 10 },
    { syllabusItemId: 'i2', cargoId: 'c1', weight: 25, questionCount: 10 },
    { syllabusItemId: 'i2', cargoId: 'c2', weight: 30, questionCount: 10 },
    { syllabusItemId: 'i3', cargoId: 'c1', weight: 50, questionCount: 20 },
    { syllabusItemId: 'i4', cargoId: 'c2', weight: 40, questionCount: 20 },
  ],
};

describe('cargos de um item', () => {
  it('lista os cargos ligados', () => {
    expect(cargosFor(SYLLABUS, 'i1')).toEqual(['c1', 'c2']);
    expect(cargosFor(SYLLABUS, 'i3')).toEqual(['c1']);
  });

  it('devolve vazio para item sem ligação', () => {
    expect(cargosFor(SYLLABUS, 'inexistente')).toEqual([]);
  });
});

describe('comum versus específico', () => {
  it('é comum quando está em mais de um cargo', () => {
    expect(isCommon(SYLLABUS, 'i1')).toBe(true);
    expect(isCommon(SYLLABUS, 'i2')).toBe(true);
  });

  it('é específico quando está em um cargo só', () => {
    expect(isCommon(SYLLABUS, 'i3')).toBe(false);
    expect(isCommon(SYLLABUS, 'i4')).toBe(false);
  });
});

describe('itens por cargo', () => {
  it('filtra pelo cargo', () => {
    expect(itemsForCargo(SYLLABUS, 'c1').map((i) => i.id)).toEqual(['i1', 'i2', 'i3']);
    expect(itemsForCargo(SYLLABUS, 'c2').map((i) => i.id)).toEqual(['i1', 'i2', 'i4']);
  });

  it('devolve vazio para cargo desconhecido', () => {
    expect(itemsForCargo(SYLLABUS, 'c9')).toEqual([]);
  });
});

describe('contagem de questões', () => {
  it('soma as questões de um cargo', () => {
    expect(totalQuestionsFor(SYLLABUS, 'c1')).toBe(40);
    expect(totalQuestionsFor(SYLLABUS, 'c2')).toBe(40);
  });

  it('conta o conteúdo comum uma vez só, não uma por cargo', () => {
    // É a regra do diagnóstico consolidado: 10 mat + 10 por + 20 leg + 20 tec.
    expect(consolidatedQuestionCount(SYLLABUS, 'i1')).toBe(10);
    expect(consolidatedQuestionCount(SYLLABUS, 'i3')).toBe(20);
    const total = SYLLABUS.items.reduce((sum, i) => sum + consolidatedQuestionCount(SYLLABUS, i.id), 0);
    expect(total).toBe(60);
  });

  it('usa o maior valor quando os cargos discordam', () => {
    const divergente: Syllabus = {
      items: [item('i1', 'mat')],
      links: [
        { syllabusItemId: 'i1', cargoId: 'c1', weight: 25, questionCount: 10 },
        { syllabusItemId: 'i1', cargoId: 'c2', weight: 30, questionCount: 15 },
      ],
    };
    expect(consolidatedQuestionCount(divergente, 'i1')).toBe(15);
  });

  it('trata questionCount nulo como zero', () => {
    const semContagem: Syllabus = {
      items: [item('i1', 'mat')],
      links: [{ syllabusItemId: 'i1', cargoId: 'c1', weight: null, questionCount: null }],
    };
    expect(consolidatedQuestionCount(semContagem, 'i1')).toBe(0);
    expect(totalQuestionsFor(semContagem, 'c1')).toBe(0);
  });
});

describe('programa vazio', () => {
  it('não tem itens nem ligações', () => {
    const vazio = emptySyllabus();
    expect(vazio.items).toEqual([]);
    expect(vazio.links).toEqual([]);
    expect(totalQuestionsFor(vazio, 'c1')).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
pnpm --filter @workspace/core run test
```

Esperado: FALHA com `Failed to resolve import "./syllabus"`.

- [ ] **Step 3: Implementar**

`lib/core/src/syllabus/syllabus.ts`:

```ts
export type SyllabusItem = {
  id: string;
  workspaceId: string;
  conceptId: string;
  parentItemId: string | null;
  /** Nome literal como veio no edital, preservado para rastreabilidade. */
  sourceLabel: string;
  sourceExcerpt: string | null;
  page: number | null;
  confidence: number;
  uncertain: boolean;
};

/**
 * A ligação N:N entre item e cargo. A deduplicação é a cardinalidade desta
 * tabela: duas linhas para o mesmo item significam conteúdo comum aos dois
 * cargos. Peso e quantidade de questões ficam aqui, não no item, porque o mesmo
 * conteúdo pode valer 25% num cargo e 30% no outro.
 */
export type SyllabusItemCargo = {
  syllabusItemId: string;
  cargoId: string;
  weight: number | null;
  questionCount: number | null;
};

export type Syllabus = {
  items: SyllabusItem[];
  links: SyllabusItemCargo[];
};

export function emptySyllabus(): Syllabus {
  return { items: [], links: [] };
}

export function cargosFor(syllabus: Syllabus, itemId: string): string[] {
  return syllabus.links
    .filter((link) => link.syllabusItemId === itemId)
    .map((link) => link.cargoId);
}

export function isCommon(syllabus: Syllabus, itemId: string): boolean {
  return cargosFor(syllabus, itemId).length > 1;
}

export function itemsForCargo(syllabus: Syllabus, cargoId: string): SyllabusItem[] {
  const ids = new Set(
    syllabus.links.filter((link) => link.cargoId === cargoId).map((link) => link.syllabusItemId),
  );
  return syllabus.items.filter((item) => ids.has(item.id));
}

export function totalQuestionsFor(syllabus: Syllabus, cargoId: string): number {
  return syllabus.links
    .filter((link) => link.cargoId === cargoId)
    .reduce((sum, link) => sum + (link.questionCount ?? 0), 0);
}

/**
 * Quantas questões o conteúdo vale no diagnóstico consolidado. Um conteúdo
 * comum a dois cargos entra UMA vez, não uma por cargo. Quando os cargos
 * discordam da quantidade, vale a maior — cobrir menos do que um dos cargos
 * exige seria subpreparar o aluno para aquele cargo.
 */
export function consolidatedQuestionCount(syllabus: Syllabus, itemId: string): number {
  const counts = syllabus.links
    .filter((link) => link.syllabusItemId === itemId)
    .map((link) => link.questionCount ?? 0);
  return counts.length === 0 ? 0 : Math.max(...counts);
}
```

- [ ] **Step 4: Exportar do índice**

Acrescentar a `lib/core/src/index.ts`:

```ts
export * from './syllabus/syllabus';
```

- [ ] **Step 5: Rodar até passar**

```bash
pnpm --filter @workspace/core run test
pnpm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add lib/core/src
git commit -m "feat: modelar programa de estudo e ligacao com cargos em lib/core"
```

---

### Task 3: Deduplicação entre cargos

Converte uma extração por cargo — onde o mesmo conteúdo aparece repetido — na estrutura consolidada com ligações N:N.

**Files:**
- Create: `lib/core/src/syllabus/dedup.ts`, `lib/core/src/syllabus/dedup.test.ts`
- Modify: `lib/core/src/index.ts`

**Interfaces:**
- Consumes: `Concept`, `matchConcept`, `shouldLinkDirectly`, `normalizeConceptName` de `./concept`; `Syllabus`, `SyllabusItem`, `SyllabusItemCargo` de `./syllabus`
- Produces:
  - `export type RawSyllabusEntry = { cargoId: string; label: string; parentLabel: string | null; weight: number | null; questionCount: number | null; sourceExcerpt: string | null; page: number | null; confidence: number }`
  - `export type ProposedConceptLink = { itemId: string; conceptId: string; score: number; reason: 'provisional_concept' | 'low_score' }`
  - `export type DedupResult = { syllabus: Syllabus; merged: Array<{ itemId: string; labels: string[] }>; newConcepts: Concept[]; proposedLinks: ProposedConceptLink[] }`
  - `export function dedupeEntries(workspaceId: string, entries: readonly RawSyllabusEntry[], concepts: readonly Concept[], makeId: (seed: string) => string): DedupResult`
  - `export function splitItem(syllabus: Syllabus, itemId: string, cargoId: string, makeId: (seed: string) => string): Syllabus`

> `makeId` é injetado porque `lib/core` não pode gerar identificadores a partir do relógio nem de aleatoriedade. O chamador decide; os testes passam uma função determinística.
>
> `splitItem` é o desfazer: quando a deduplicação uniu errado, o usuário separa um cargo de volta num item próprio. O spec exige que isso seja possível sem reconstruir a extração.

> **`dedupeEntries` recebe os conceitos existentes e aplica a regra R4 do spec.** Para cada item:
> - casou acima do limiar **e** o conceito é `confirmed` → liga direto, e é assim que uma nota escrita noutro workspace reaparece aqui;
> - casou mas o conceito é `provisional`, ou o score ficou abaixo do limiar → **não liga**. Cria um conceito `provisional` novo e registra a ligação pretendida em `proposedLinks`, que a Task 14 transforma em item `concept_merge` na fila;
> - não casou com nada → cria conceito `provisional` novo, sem proposta.
>
> Conceito `provisional` **nunca participa da reutilização global** — é a restrição R3, e é o que impede extração automática de poluir a biblioteca do usuário. Ele só vira `confirmed` por decisão humana na fila.

- [ ] **Step 1: Escrever os testes que falham**

`lib/core/src/syllabus/dedup.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { dedupeEntries, splitItem, type RawSyllabusEntry } from './dedup';
import { cargosFor, isCommon } from './syllabus';

let counter = 0;
const makeId = (seed: string) => `${seed}-${(counter += 1)}`;
const resetIds = () => { counter = 0; };

const entrada = (over: Partial<RawSyllabusEntry> & { cargoId: string; label: string }): RawSyllabusEntry => ({
  parentLabel: null, weight: null, questionCount: null,
  sourceExcerpt: null, page: null, confidence: 1, ...over,
});

describe('deduplicação entre cargos', () => {
  it('une conteúdo idêntico em um item com dois cargos', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: 'Matemática básica', questionCount: 10 }),
      entrada({ cargoId: 'c2', label: 'Matemática básica', questionCount: 10 }),
    ], [], makeId);

    expect(syllabus.items).toHaveLength(1);
    expect(syllabus.links).toHaveLength(2);
    expect(isCommon(syllabus, syllabus.items[0].id)).toBe(true);
  });

  it('une apesar de diferença de acento, caixa e numeração', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: '1.1 Matemática Básica' }),
      entrada({ cargoId: 'c2', label: 'MATEMATICA BASICA' }),
    ], [], makeId);

    expect(syllabus.items).toHaveLength(1);
    expect(cargosFor(syllabus, syllabus.items[0].id)).toEqual(['c1', 'c2']);
  });

  it('mantém conteúdo específico separado', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: 'Legislação' }),
      entrada({ cargoId: 'c2', label: 'Tecnologia' }),
    ], [], makeId);

    expect(syllabus.items).toHaveLength(2);
    expect(syllabus.items.every((item) => !isCommon(syllabus, item.id))).toBe(true);
  });

  it('preserva peso e quantidade por cargo', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: 'Matemática', weight: 25, questionCount: 10 }),
      entrada({ cargoId: 'c2', label: 'Matemática', weight: 30, questionCount: 12 }),
    ], [], makeId);

    const c1 = syllabus.links.find((l) => l.cargoId === 'c1');
    const c2 = syllabus.links.find((l) => l.cargoId === 'c2');
    expect(c1?.weight).toBe(25);
    expect(c1?.questionCount).toBe(10);
    expect(c2?.weight).toBe(30);
    expect(c2?.questionCount).toBe(12);
  });

  it('preserva o rótulo literal do primeiro cargo e registra os unidos', () => {
    resetIds();
    const { syllabus, merged } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: '1.1 Matemática Básica' }),
      entrada({ cargoId: 'c2', label: 'MATEMATICA BASICA' }),
    ], [], makeId);

    expect(syllabus.items[0].sourceLabel).toBe('1.1 Matemática Básica');
    expect(merged).toHaveLength(1);
    expect(merged[0].labels).toEqual(['1.1 Matemática Básica', 'MATEMATICA BASICA']);
  });

  it('não une duas entradas do mesmo cargo', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: 'Matemática' }),
      entrada({ cargoId: 'c1', label: 'Matemática' }),
    ], [], makeId);

    expect(syllabus.links.filter((l) => l.cargoId === 'c1')).toHaveLength(1);
  });

  it('marca como incerto quando a confiança é baixa', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: 'Algo ambíguo', confidence: 0.4 }),
    ], [], makeId);

    expect(syllabus.items[0].uncertain).toBe(true);
  });

  it('constrói a hierarquia a partir de parentLabel', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: 'Matemática' }),
      entrada({ cargoId: 'c1', label: 'Porcentagem', parentLabel: 'Matemática' }),
    ], [], makeId);

    const pai = syllabus.items.find((i) => i.sourceLabel === 'Matemática');
    const filho = syllabus.items.find((i) => i.sourceLabel === 'Porcentagem');
    expect(filho?.parentItemId).toBe(pai?.id);
    expect(pai?.parentItemId).toBeNull();
  });

  it('devolve programa vazio para entrada vazia', () => {
    resetIds();
    const { syllabus, merged } = dedupeEntries('w1', [], [], [], makeId);
    expect(syllabus.items).toEqual([]);
    expect(merged).toEqual([]);
  });

  it('ignora entradas cujo rótulo normaliza para nada', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: '1.2.' }),
      entrada({ cargoId: 'c1', label: 'Crase' }),
    ], [], [], makeId);
    expect(syllabus.items).toHaveLength(1);
    expect(syllabus.items[0].sourceLabel).toBe('Crase');
  });
});

describe('ligação com conceitos existentes', () => {
  const confirmado: Concept = {
    id: 'global-crase', canonicalName: 'Crase', slug: 'crase',
    parentId: null, kind: 'topico', aliases: [], status: 'confirmed',
  };

  it('liga direto a conceito confirmado que casa', () => {
    resetIds();
    const { syllabus, newConcepts, proposedLinks } = dedupeEntries(
      'w1', [entrada({ cargoId: 'c1', label: 'Crase' })], [confirmado], makeId,
    );
    expect(syllabus.items[0].conceptId).toBe('global-crase');
    expect(newConcepts).toEqual([]);
    expect(proposedLinks).toEqual([]);
  });

  it('liga direto apesar de acento, caixa e numeração', () => {
    resetIds();
    const { syllabus } = dedupeEntries(
      'w1', [entrada({ cargoId: 'c1', label: '2.1 CRASE' })], [confirmado], makeId,
    );
    expect(syllabus.items[0].conceptId).toBe('global-crase');
  });

  it('NÃO liga a conceito provisório, e propõe a ligação', () => {
    resetIds();
    const provisorio = { ...confirmado, status: 'provisional' as const };
    const { syllabus, newConcepts, proposedLinks } = dedupeEntries(
      'w1', [entrada({ cargoId: 'c1', label: 'Crase' })], [provisorio], makeId,
    );
    expect(syllabus.items[0].conceptId).not.toBe('global-crase');
    expect(newConcepts).toHaveLength(1);
    expect(newConcepts[0].status).toBe('provisional');
    expect(proposedLinks).toEqual([
      { itemId: syllabus.items[0].id, conceptId: 'global-crase', score: 1, reason: 'provisional_concept' },
    ]);
  });

  it('cria conceito provisório quando não casa com nada', () => {
    resetIds();
    const { syllabus, newConcepts, proposedLinks } = dedupeEntries(
      'w1', [entrada({ cargoId: 'c1', label: 'Tecnologia da informação' })], [confirmado], makeId,
    );
    expect(newConcepts).toHaveLength(1);
    expect(newConcepts[0].status).toBe('provisional');
    expect(newConcepts[0].canonicalName).toBe('Tecnologia da informação');
    expect(syllabus.items[0].conceptId).toBe(newConcepts[0].id);
    expect(proposedLinks).toEqual([]);
  });

  it('itens unidos entre cargos compartilham um conceito só', () => {
    resetIds();
    const { syllabus, newConcepts } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: 'Matemática' }),
      entrada({ cargoId: 'c2', label: 'Matematica' }),
    ], [], [], makeId);
    expect(syllabus.items).toHaveLength(1);
    expect(newConcepts).toHaveLength(1);
  });
});

describe('separar um item unido errado', () => {
  it('extrai um cargo para um item próprio', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: 'Informática', questionCount: 10 }),
      entrada({ cargoId: 'c2', label: 'Informatica', questionCount: 20 }),
    ], [], makeId);
    expect(syllabus.items).toHaveLength(1);

    const separado = splitItem(syllabus, syllabus.items[0].id, 'c2', makeId);

    expect(separado.items).toHaveLength(2);
    expect(cargosFor(separado, separado.items[0].id)).toEqual(['c1']);
    expect(cargosFor(separado, separado.items[1].id)).toEqual(['c2']);
  });

  it('preserva peso e quantidade do cargo separado', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: 'Informática', weight: 20, questionCount: 10 }),
      entrada({ cargoId: 'c2', label: 'Informatica', weight: 40, questionCount: 20 }),
    ], [], makeId);

    const separado = splitItem(syllabus, syllabus.items[0].id, 'c2', makeId);
    const novo = separado.links.find((l) => l.cargoId === 'c2');
    expect(novo?.weight).toBe(40);
    expect(novo?.questionCount).toBe(20);
  });

  it('não faz nada se o cargo não está no item', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [entrada({ cargoId: 'c1', label: 'Crase' })], [], makeId);
    expect(splitItem(syllabus, syllabus.items[0].id, 'c9', makeId)).toEqual(syllabus);
  });

  it('não faz nada se o item tem um cargo só', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [entrada({ cargoId: 'c1', label: 'Crase' })], [], makeId);
    expect(splitItem(syllabus, syllabus.items[0].id, 'c1', makeId)).toEqual(syllabus);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
pnpm --filter @workspace/core run test
```

Esperado: FALHA com `Failed to resolve import "./dedup"`.

- [ ] **Step 3: Implementar**

`lib/core/src/syllabus/dedup.ts`:

```ts
import { matchConcept, normalizeConceptName, shouldLinkDirectly, type Concept } from './concept';
import { type Syllabus, type SyllabusItem, type SyllabusItemCargo } from './syllabus';

export type RawSyllabusEntry = {
  cargoId: string;
  label: string;
  parentLabel: string | null;
  weight: number | null;
  questionCount: number | null;
  sourceExcerpt: string | null;
  page: number | null;
  confidence: number;
};

/** Uma ligação que a extração quis fazer mas não tinha autoridade para fazer. */
export type ProposedConceptLink = {
  itemId: string;
  conceptId: string;
  score: number;
  reason: 'provisional_concept' | 'low_score';
};

export type DedupResult = {
  syllabus: Syllabus;
  /** O que foi unido, para a tela poder explicar ao usuário. */
  merged: Array<{ itemId: string; labels: string[] }>;
  /** Conceitos provisórios criados, que só viram confirmados por decisão humana. */
  newConcepts: Concept[];
  /** Ligações propostas à fila de aprovação, nunca aplicadas aqui. */
  proposedLinks: ProposedConceptLink[];
};

/** Abaixo disto o item entra marcado como incerto e pede olho humano. */
const UNCERTAIN_BELOW = 0.6;

export function dedupeEntries(
  workspaceId: string,
  entries: readonly RawSyllabusEntry[],
  concepts: readonly Concept[],
  makeId: (seed: string) => string,
): DedupResult {
  const byNormalized = new Map<string, { item: SyllabusItem; labels: string[] }>();
  const links: SyllabusItemCargo[] = [];
  const newConcepts: Concept[] = [];
  const proposedLinks: ProposedConceptLink[] = [];

  for (const entry of entries) {
    const normalized = normalizeConceptName(entry.label);
    if (!normalized) continue;

    let bucket = byNormalized.get(normalized);

    if (!bucket) {
      const id = makeId(normalized);

      // Restrições R3 e R4 do spec: só um conceito já confirmado serve de ponte
      // entre workspaces. Qualquer outro caso cria um provisório e propõe a
      // ligação, em vez de aplicá-la.
      const match = matchConcept(entry.label, concepts);
      let conceptId: string;

      if (shouldLinkDirectly(match)) {
        conceptId = match!.concept.id;
      } else {
        const provisional: Concept = {
          id: makeId(`concept-${normalized}`),
          canonicalName: entry.label,
          slug: normalized.replace(/\s+/g, '-'),
          parentId: null,
          kind: 'topico',
          aliases: [],
          status: 'provisional',
        };
        newConcepts.push(provisional);
        conceptId = provisional.id;

        if (match) {
          proposedLinks.push({
            itemId: id,
            conceptId: match.concept.id,
            score: match.score,
            reason: match.concept.status === 'provisional' ? 'provisional_concept' : 'low_score',
          });
        }
      }

      bucket = {
        item: {
          id,
          workspaceId,
          conceptId,
          parentItemId: null,
          sourceLabel: entry.label,
          sourceExcerpt: entry.sourceExcerpt,
          page: entry.page,
          confidence: entry.confidence,
          uncertain: entry.confidence < UNCERTAIN_BELOW,
        },
        labels: [],
      };
      byNormalized.set(normalized, bucket);
    }

    if (!bucket.labels.includes(entry.label)) {
      bucket.labels.push(entry.label);
    }

    // Um cargo não pode aparecer duas vezes no mesmo item.
    const already = links.some(
      (link) => link.syllabusItemId === bucket!.item.id && link.cargoId === entry.cargoId,
    );
    if (!already) {
      links.push({
        syllabusItemId: bucket.item.id,
        cargoId: entry.cargoId,
        weight: entry.weight,
        questionCount: entry.questionCount,
      });
    }
  }

  // Hierarquia num segundo passe, quando todos os itens já existem.
  for (const entry of entries) {
    const normalized = normalizeConceptName(entry.label);
    if (!normalized || !entry.parentLabel) continue;

    const child = byNormalized.get(normalized);
    const parent = byNormalized.get(normalizeConceptName(entry.parentLabel));
    if (child && parent && child.item.id !== parent.item.id) {
      child.item.parentItemId = parent.item.id;
    }
  }

  const buckets = [...byNormalized.values()];

  return {
    syllabus: { items: buckets.map((bucket) => bucket.item), links },
    merged: buckets
      .filter((bucket) => bucket.labels.length > 1)
      .map((bucket) => ({ itemId: bucket.item.id, labels: bucket.labels })),
    newConcepts,
    proposedLinks,
  };
}

/**
 * Desfaz uma união: tira `cargoId` do item e lhe dá um item próprio, com o
 * mesmo conceito e o mesmo peso. Usado quando a deduplicação uniu conteúdos que
 * o usuário considera distintos.
 */
export function splitItem(
  syllabus: Syllabus,
  itemId: string,
  cargoId: string,
  makeId: (seed: string) => string,
): Syllabus {
  const item = syllabus.items.find((candidate) => candidate.id === itemId);
  if (!item) return syllabus;

  const linksOfItem = syllabus.links.filter((link) => link.syllabusItemId === itemId);
  const moving = linksOfItem.find((link) => link.cargoId === cargoId);
  if (!moving || linksOfItem.length < 2) return syllabus;

  const newItem: SyllabusItem = { ...item, id: makeId(`${item.id}-${cargoId}`) };

  return {
    items: [...syllabus.items, newItem],
    links: syllabus.links.map((link) =>
      link.syllabusItemId === itemId && link.cargoId === cargoId
        ? { ...link, syllabusItemId: newItem.id }
        : link,
    ),
  };
}
```

- [ ] **Step 4: Exportar do índice**

Acrescentar a `lib/core/src/index.ts`:

```ts
export * from './syllabus/dedup';
```

- [ ] **Step 5: Rodar até passar**

```bash
pnpm --filter @workspace/core run test
pnpm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add lib/core/src
git commit -m "feat: deduplicar conteudo entre cargos em lib/core"
```

---

### Task 4: Reconciliar a máquina de estados com o fluxo real

Quita o débito D1. Hoje `NovoWorkspace` cria o workspace direto em `aguardando_revisao_edital` e `TRANSITIONS` não admite essa aresta. Esta task decide qual dos dois está errado e aplica `canTransition` de verdade.

**Files:**
- Modify: `lib/core/src/workspace/status.ts`, `lib/core/src/workspace/status.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `export function initialStatus(hasEdital: boolean): WorkspaceStatus`
  - `export function assertTransition(from: WorkspaceStatus, to: WorkspaceStatus): void` — lança `Error` com mensagem em português quando a transição é inválida
  - `canTransition` e `WORKSPACE_STATUSES` permanecem com a mesma assinatura

> **A decisão:** a máquina está certa e o app está errado. Criar um workspace com edital deve entrar em `aguardando_upload` e caminhar por `extraindo_edital` até `aguardando_revisao_edital`, porque é isso que de fato acontece — há um arquivo a processar. Pular direto escondia o processamento e foi o que permitiu a tela de progresso ser um `setTimeout` decorativo.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar a `lib/core/src/workspace/status.test.ts`:

```ts
import { initialStatus, assertTransition } from './status';

describe('estado inicial', () => {
  it('workspace com edital começa aguardando upload', () => {
    expect(initialStatus(true)).toBe('aguardando_upload');
  });

  it('workspace sem edital começa sem edital', () => {
    expect(initialStatus(false)).toBe('sem_edital');
  });

  it('o caminho real da criação com edital é válido de ponta a ponta', () => {
    const caminho = [
      initialStatus(true),
      'extraindo_edital',
      'aguardando_revisao_edital',
      'diagnostico_pendente',
    ] as const;
    for (let i = 0; i < caminho.length - 1; i += 1) {
      expect(canTransition(caminho[i], caminho[i + 1])).toBe(true);
    }
  });

  it('o caminho real da criação sem edital é válido', () => {
    expect(canTransition(initialStatus(false), 'aguardando_upload')).toBe(true);
  });
});

describe('transição obrigatória', () => {
  it('não lança para transição válida', () => {
    expect(() => assertTransition('aguardando_upload', 'extraindo_edital')).not.toThrow();
  });

  it('lança com mensagem em português para transição inválida', () => {
    expect(() => assertTransition('sem_edital', 'estudando')).toThrow(
      'Transição inválida de "sem edital" para "estudando".',
    );
  });

  it('lança ao tentar pular o diagnóstico obrigatório', () => {
    expect(() => assertTransition('aguardando_revisao_edital', 'estudando')).toThrow();
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
pnpm --filter @workspace/core run test
```

Esperado: FALHA — `initialStatus` e `assertTransition` não existem.

- [ ] **Step 3: Implementar**

Acrescentar a `lib/core/src/workspace/status.ts`:

```ts
/**
 * Estado em que um workspace nasce. Com edital há um arquivo a processar, então
 * ele entra na fila de upload e caminha por `extraindo_edital` até a revisão —
 * pular direto para a revisão esconderia o processamento e foi o que permitiu a
 * tela de progresso existir como decoração.
 */
export function initialStatus(hasEdital: boolean): WorkspaceStatus {
  return hasEdital ? 'aguardando_upload' : 'sem_edital';
}

export function assertTransition(from: WorkspaceStatus, to: WorkspaceStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Transição inválida de "${WORKSPACE_STATUS_LABELS[from]}" para "${WORKSPACE_STATUS_LABELS[to]}".`,
    );
  }
}
```

- [ ] **Step 4: Rodar até passar**

```bash
pnpm --filter @workspace/core run test
pnpm run typecheck
```

Se o teste do caminho completo falhar, é `TRANSITIONS` que precisa da aresta — **não** ajuste o teste para acomodar a tabela.

- [ ] **Step 5: Commit**

```bash
git add lib/core/src/workspace
git commit -m "feat: reconciliar maquina de estados com o fluxo real de edital"
```

---

### Task 5: Remover `hasEdital` do formato persistido

Quita o débito D2. `hasEdital` e `status` afirmam o mesmo fato e podem discordar; `status` é o canônico.

**Files:**
- Modify: `artifacts/kalibra/src/domain/adapters/local/workspaces.ts`, `artifacts/kalibra/src/domain/adapters/local/workspaces.test.ts`, `artifacts/kalibra/src/pages/NovoWorkspace.tsx`
- Modify: `lib/core/src/workspace/status.ts`

**Interfaces:**
- Consumes: `WorkspaceStatus`, `initialStatus` de `@workspace/core`
- Produces:
  - `export function hasEdital(status: WorkspaceStatus): boolean` em `lib/core` — derivada, não armazenada
  - `WorkspaceDraft` sem o campo `hasEdital`
  - `migrateWorkspace` descarta `hasEdital` de registros antigos sem perder informação

- [ ] **Step 1: Escrever os testes que falham**

Em `lib/core/src/workspace/status.test.ts`:

```ts
import { hasEdital } from './status';

describe('derivar se há edital', () => {
  it('não há edital apenas em sem_edital e aguardando_upload', () => {
    expect(hasEdital('sem_edital')).toBe(false);
    expect(hasEdital('aguardando_upload')).toBe(false);
  });

  it('há edital a partir da extração', () => {
    expect(hasEdital('extraindo_edital')).toBe(true);
    expect(hasEdital('aguardando_revisao_edital')).toBe(true);
    expect(hasEdital('diagnostico_pendente')).toBe(true);
    expect(hasEdital('estudando')).toBe(true);
  });
});
```

Em `workspaces.test.ts`:

```ts
it('descarta hasEdital de registros antigos', () => {
  const migrado = migrateWorkspace({ ...ANTIGO, hasEdital: true });
  expect(migrado).not.toHaveProperty('hasEdital');
});

it('registro antigo com hasEdital false e sem edital vira sem_edital', () => {
  const migrado = migrateWorkspace({
    ...ANTIGO, hasEdital: false, importStatus: 'pending',
    sourceText: undefined, sourceFileName: undefined,
  });
  expect(migrado?.status).toBe('sem_edital');
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
pnpm run test
```

- [ ] **Step 3: Implementar em `lib/core`**

```ts
const WITHOUT_EDITAL: readonly WorkspaceStatus[] = ['sem_edital', 'aguardando_upload'];

/**
 * Derivada de `status`, nunca armazenada: manter os dois em disco permitia que
 * discordassem, e discordavam.
 */
export function hasEdital(status: WorkspaceStatus): boolean {
  return !WITHOUT_EDITAL.includes(status);
}
```

- [ ] **Step 4: Remover o campo do adaptador**

Em `workspaces.ts`: remover `hasEdital` da interface `WorkspaceDraft` e do objeto que `migrateWorkspace` constrói. Na migração, quando o registro antigo trazia `hasEdital: false` e o status derivado implicaria edital, corrigir o status para `sem_edital` — a informação do campo antigo não se perde, ela é absorvida pelo status.

- [ ] **Step 5: Ajustar quem lia o campo**

```bash
cd "C:/Users/User/Documents/Kalibra"
grep -rn "hasEdital" artifacts/kalibra/src/
```

Cada leitura passa a usar `hasEdital(workspace.status)` importado de `@workspace/core`. Esperado ao fim: nenhuma referência a `workspace.hasEdital`.

- [ ] **Step 6: Rodar até passar**

```bash
pnpm run typecheck
pnpm run test
pnpm run build
```

- [ ] **Step 7: Commit**

```bash
git add lib/core/src artifacts/kalibra/src
git commit -m "refactor: derivar hasEdital do status em vez de armazenar"
```

---

### Task 6: Contrato da extração e produtor simulado

A extração continua simulada, mas atrás de um contrato fixo. É este contrato que a Fase 4 vai implementar com IA sem que nenhum consumidor mude.

**Files:**
- Create: `lib/core/src/syllabus/extraction.ts`, `lib/core/src/syllabus/extraction.test.ts`
- Create: `artifacts/kalibra/src/domain/adapters/local/extraction.ts`
- Create: `artifacts/kalibra/src/domain/useExtraction.ts`
- Modify: `lib/core/src/index.ts`

**Interfaces:**
- Consumes: `RawSyllabusEntry` de `./dedup`
- Produces:
  - `export type ExtractionErrorKind = 'scanned' | 'corrupted' | 'short' | 'structure'`
  - `export type ExtractionStage = 'enviando' | 'extraindo' | 'identificando' | 'pronto' | 'erro'`
  - `export type ExtractionProgress = { stage: ExtractionStage; wordCount: number | null; errorKind: ExtractionErrorKind | null }`
  - `export type ExtractionOutput = { entries: RawSyllabusEntry[]; detectedCargos: string[]; examFormat: string | null; examDurationMinutes: number | null; uncertainties: string[] }`
  - `export function validateExtractionOutput(output: unknown): ExtractionOutput | null`
  - `export const EXTRACTION_ERROR_MESSAGES: Record<ExtractionErrorKind, { message: string; action: string }>`
  - No frontend: `export function useExtraction(workspaceSlug: string): { progress: ExtractionProgress; start(input: ExtractionInput): void; cancel(): void; output: ExtractionOutput | null }`

> As quatro mensagens de erro vêm do PD-07 e são texto de produto, não improviso:
> - `scanned`: "Este PDF é uma imagem, não texto. Não é possível extrair o conteúdo automaticamente." / ação "Colar o texto manualmente"
> - `corrupted`: "Não foi possível abrir o arquivo." / ação "Enviar outro arquivo"
> - `short`: "O conteúdo enviado tem poucas palavras. Verifique se é o edital completo." / ação "Enviar mesmo assim"
> - `structure`: "O conteúdo foi extraído, mas não conseguimos identificar a estrutura." / ação "Montar manualmente"

- [ ] **Step 1: Escrever os testes de `lib/core` que falham**

`lib/core/src/syllabus/extraction.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateExtractionOutput, EXTRACTION_ERROR_MESSAGES } from './extraction';

const VALIDO = {
  entries: [{
    cargoId: 'c1', label: 'Crase', parentLabel: null, weight: 25,
    questionCount: 10, sourceExcerpt: null, page: null, confidence: 0.9,
  }],
  detectedCargos: ['Analista'],
  examFormat: 'múltipla escolha, 4 alternativas',
  examDurationMinutes: 210,
  uncertainties: [],
};

describe('validação da saída da extração', () => {
  it('aceita uma saída completa', () => {
    expect(validateExtractionOutput(VALIDO)).not.toBeNull();
  });

  it('rejeita entrada que não é objeto', () => {
    expect(validateExtractionOutput(null)).toBeNull();
    expect(validateExtractionOutput('texto')).toBeNull();
    expect(validateExtractionOutput([])).toBeNull();
  });

  it('rejeita quando entries não é array', () => {
    expect(validateExtractionOutput({ ...VALIDO, entries: 'x' })).toBeNull();
  });

  it('descarta entradas malformadas sem derrubar a extração inteira', () => {
    const saida = validateExtractionOutput({
      ...VALIDO,
      entries: [null, VALIDO.entries[0], { label: 42 }],
    });
    expect(saida?.entries).toHaveLength(1);
  });

  it('aceita campos opcionais ausentes', () => {
    const saida = validateExtractionOutput({ entries: [] });
    expect(saida?.detectedCargos).toEqual([]);
    expect(saida?.examFormat).toBeNull();
    expect(saida?.uncertainties).toEqual([]);
  });

  it('normaliza confiança fora da faixa', () => {
    const saida = validateExtractionOutput({
      entries: [{ ...VALIDO.entries[0], confidence: 5 }],
    });
    expect(saida?.entries[0].confidence).toBe(1);
  });
});

describe('mensagens de erro', () => {
  it('tem mensagem e ação para os quatro tipos', () => {
    for (const kind of ['scanned', 'corrupted', 'short', 'structure'] as const) {
      expect(EXTRACTION_ERROR_MESSAGES[kind].message.length).toBeGreaterThan(0);
      expect(EXTRACTION_ERROR_MESSAGES[kind].action.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Rodar para ver falhar, depois implementar `lib/core`**

Implementar `extraction.ts` com os tipos e a validação acima. `validateExtractionOutput` segue a mesma disciplina de `migrateWorkspace`: **total** (nunca lança), descarta o que não reconhece em vez de propagar lixo, e devolve `null` só quando a entrada inteira é irreconhecível.

- [ ] **Step 3: Criar o produtor simulado**

`artifacts/kalibra/src/domain/adapters/local/extraction.ts` implementa `useExtraction`. Ele percorre os quatro estágios com atrasos curtos, como o `EditalUploadProgress` já faz hoje, mas:

- o resultado é uma `ExtractionOutput` derivada **deterministicamente** do texto colado — quebrar em linhas, tratar linhas em CAIXA ALTA ou com numeração de primeiro nível como disciplina e as demais como tópicos daquela disciplina, atribuir à lista de cargos do workspace;
- quando `sourceMode === 'file'`, produzir uma estrutura fixa de demonstração, já que não há texto real;
- **os quatro tipos de erro são alcançáveis**, para que a UI possa ser exercitada: texto com menos de 50 palavras produz `short`; texto que não gera nenhuma entrada produz `structure`. Os outros dois ficam disponíveis na API mas só a Fase 4 os dispara de verdade.

> Este arquivo é o único desta fase que a Fase 4 vai substituir. Mantenha-o pequeno e sem regra de negócio: normalização e deduplicação já vivem em `lib/core` e devem ser chamadas de lá, não reimplementadas aqui.

- [ ] **Step 4: Criar o hook de domínio**

`artifacts/kalibra/src/domain/useExtraction.ts`, seguindo o padrão dos outros: reexporta o adaptador local e lança se `domainConfig` apontar para `'api'`. Acrescentar `extraction: 'local'` a `domainConfig`.

- [ ] **Step 5: Verificar**

```bash
pnpm run typecheck
pnpm run test
pnpm run build
```

- [ ] **Step 6: Commit**

```bash
git add lib/core/src artifacts/kalibra/src/domain
git commit -m "feat: contrato da extracao de edital e produtor simulado"
```

---

### Task 7: Persistência do programa de estudo

**Files:**
- Create: `artifacts/kalibra/src/domain/adapters/local/syllabus.ts`, `.../syllabus.test.ts`
- Create: `artifacts/kalibra/src/domain/useSyllabus.ts`
- Modify: `artifacts/kalibra/src/domain/config.ts`

**Interfaces:**
- Consumes: `Syllabus`, `emptySyllabus`, `dedupeEntries`, `splitItem` de `@workspace/core`
- Produces:
  - `export function useSyllabus(workspaceSlug: string, userId?: string): { syllabus: Syllabus; concepts: Concept[]; save(syllabus: Syllabus): void; renameItem(itemId: string, label: string): void; removeItem(itemId: string): void; addItem(parentItemId: string | null, label: string, cargoIds: string[]): void; splitFromCargo(itemId: string, cargoId: string): void }`
  - Chave de storage: `kalibra_syllabus:<userId>:<slug>`
  - `export function migrateSyllabus(raw: unknown): Syllabus | null` — total, idempotente, na mesma disciplina de `migrateWorkspace`

- [ ] **Step 1: Escrever os testes que falham**

Cobrir: programa vazio quando não há nada salvo; round-trip de salvar e ler; `migrateSyllabus` contra `null`, `42`, `'texto'`, `[]`, `{items: 'x'}`, `{items: [null], links: []}`; idempotência; e que um item com ligação órfã (cargo que não existe mais) não derruba a leitura.

- [ ] **Step 2: Rodar para ver falhar, depois implementar**

O adaptador segue exatamente o padrão de `workspaces.ts`, incluindo o `try/catch` por registro dentro do `map` — a lição da Fase 1A, onde um registro corrompido apagava todos os workspaces, vale igual aqui.

- [ ] **Step 3: Verificar e commitar**

```bash
pnpm run typecheck && pnpm run test && pnpm run build
git add artifacts/kalibra/src/domain
git commit -m "feat: persistir programa de estudo por workspace"
```

---

### Task 8: Fila de aprovação — modelo e persistência

**Files:**
- Create: `lib/core/src/approval/approval.ts`, `.../approval.test.ts`
- Create: `artifacts/kalibra/src/domain/adapters/local/approvals.ts`, `.../approvals.test.ts`
- Create: `artifacts/kalibra/src/domain/useApprovals.ts`
- Modify: `lib/core/src/index.ts`, `artifacts/kalibra/src/domain/config.ts`

**Interfaces:**
- Produces em `lib/core`:
  - `export type ApprovalType = 'edital_structure' | 'concept_merge'`
  - `export type ApprovalStatus = 'pendente' | 'revisando' | 'aprovado' | 'rejeitado'`
  - `export type ApprovalItem = { id: string; workspaceId: string | null; type: ApprovalType; status: ApprovalStatus; title: string; rationale: string; sourceRef: string | null; confidence: number | null; payloadBefore: unknown; payloadAfter: unknown; createdAt: string; decidedAt: string | null; reason: string | null }`
  - `export function canDecide(status: ApprovalStatus): boolean`
  - `export function pendingCount(items: readonly ApprovalItem[]): number`
  - `export function groupByType(items: readonly ApprovalItem[]): Record<ApprovalType, ApprovalItem[]>`
- Produces no frontend:
  - `export function useApprovals(userId?: string): { items: ApprovalItem[]; pending: number; approve(id: string): void; reject(id: string, reason?: string): void; enqueue(item: Omit<ApprovalItem, 'id' | 'status' | 'createdAt' | 'decidedAt' | 'reason'>, now: Date): string }`

> **A fila nasce com dois tipos só** — os que esta fase realmente produz. O spec lista dez; os outros oito chegam com as fases que os geram. Um tipo declarado e nunca emitido é código morto que finge cobertura.
>
> `enqueue` recebe `now` de fora porque o adaptador local precisa carimbar data e `lib/core` não lê relógio.

- [ ] **Step 1: Escrever os testes que falham**

Cobrir: `canDecide` true só para `pendente` e `revisando`; contagem de pendentes; agrupamento por tipo com tipos vazios presentes; aprovar move para `aprovado` e carimba `decidedAt`; rejeitar guarda o motivo; decidir item já decidido não muda nada; e a mesma bateria de migração total contra lixo.

- [ ] **Step 2: Implementar, verificar, commitar**

```bash
pnpm run typecheck && pnpm run test && pnpm run build
git add lib/core/src artifacts/kalibra/src/domain
git commit -m "feat: modelar e persistir fila de aprovacao"
```

---

### Task 9: Tela de aprovações

**Files:**
- Create: `artifacts/kalibra/src/pages/Aprovacoes.tsx`, `src/components/ApprovalCard.tsx`, `src/components/ApprovalDiff.tsx`
- Modify: `src/config/nav.ts`, `src/routes/WorkspaceApp.tsx`

**Interfaces:**
- Consumes: `useApprovals`; `ApprovalItem`, `groupByType` de `@workspace/core`
- Produces: rota `/aprovacoes`; `ApprovalCard`; `ApprovalDiff`

**Padrões visuais — todos já existem, nenhum é novo:**

| Elemento | Reuso |
|---|---|
| Cabeçalho da página | `k-eyebrow` + `h2 text-[27px] font-semibold tracking-[-.05em]` + `p text-[12px] k-muted` |
| Contador de pendentes | `k-chip k-chip-active` |
| Filtros por tipo | linha de `k-chip`, o ativo com `k-chip-active` |
| Cartão de item | `k-card p-5`, com `flex flex-col justify-between gap-4 md:flex-row` |
| Ícone do tipo | quadrado `h-8 w-8 rounded-sm` com fundo `#eef5d8` / `dark:#202b20`, como em `Recomendacoes` |
| Diff antes/depois | dois `k-card-soft p-3` lado a lado em `grid gap-3 md:grid-cols-2` |
| Destaque removido | `bg-[#fff0ee] text-[#c94f45]`, os mesmos de `k-option-wrong` |
| Destaque adicionado | `bg-[#edf8ef] text-[#23824d]`, os mesmos de `k-option-correct` |
| Aprovar / Rejeitar | `k-button k-button-primary` e `k-button k-button-quiet k-coral` |
| Colapsar item | botão com `▾`/`▸` em `k-mono`, como o menu de `EditalRevisar` |
| Vazio | ícone + título 13px + sub 11px, como em `Erros` |

- [ ] **Step 1: Criar `ApprovalDiff`**

Duas colunas com os valores antes e depois, usando os pares de cor acima. Quando `payloadBefore` é `null` — item novo, não alteração — mostrar só a coluna "proposta", sem uma coluna vazia ao lado.

- [ ] **Step 2: Criar `ApprovalCard`**

Colapsável pelo título. Mostra tipo, confiança em `k-mono`, justificativa, fonte, o diff e os botões. Item já decidido mostra o estado e esconde os botões.

- [ ] **Step 3: Criar a página**

Cabeçalho, contador, filtros por tipo, lista com `k-stagger`, "recolher todos", e o estado vazio. No rodapé, a nota do spec: questões geradas para o diagnóstico inicial não passam pela fila, e continuam rastreáveis.

- [ ] **Step 4: Acrescentar à navegação**

`src/config/nav.ts` ganha `{ href: '/aprovacoes', label: 'Aprovações', icon: CheckCircle2 }`. A sidebar agrupada em cinco seções é decisão aprovada do spec §5.3, mas **agrupar a sidebar não é escopo desta task** — acrescente o item na lista plana atual, na posição correspondente a "inteligência", e deixe o agrupamento para a fase que criar as outras telas daquele grupo.

A rota entra em `WorkspaceApp.tsx` junto das demais.

- [ ] **Step 5: Verificar**

Snapshot muda: rota nova mais o item de navegação em todas as telas do workspace. Ler o diff, confirmar que a única mudança nas telas existentes é o item de nav, descrever, então `-u`, então confirmar 0 escritos.

- [ ] **Step 6: Commit**

```bash
git add artifacts/kalibra/src
git commit -m "feat: criar tela de aprovacoes com diff antes e depois"
```

---

### Task 10: Progresso de extração dirigido pelo adaptador

`EditalUploadProgress` hoje simula com `setTimeout` interno. Passa a refletir o estado real do adaptador, sem mudar de forma.

**Files:**
- Modify: `artifacts/kalibra/src/components/EditalUploadProgress.tsx`, `src/pages/NovoWorkspace.tsx`, `src/pages/Edital.tsx`

**Interfaces:**
- Consumes: `useExtraction`; `ExtractionProgress`, `EXTRACTION_ERROR_MESSAGES` de `@workspace/core`
- Produces: `EditalUploadProgress` recebendo `progress` por prop em vez de simular

- [ ] **Step 1: Inverter o controle**

O componente deixa de ter `useState`/`useEffect` de simulação e passa a receber `progress: ExtractionProgress`. **As quatro etapas nomeadas e todas as classes permanecem idênticas** — é uma mudança de fonte de dados, não de aparência.

- [ ] **Step 2: Implementar os quatro estados de erro**

Hoje só `scanned` está desenhado e os outros três estão como comentário. Cada um ganha a mensagem e a ação do PD-07, no bloco coral que o componente já tem. A ação é um `onAction` que a tela dona decide.

- [ ] **Step 3: Ligar nas duas telas**

`NovoWorkspace` e `Edital` passam a dirigir a extração pelo hook, e o status do workspace caminha `aguardando_upload` → `extraindo_edital` → `aguardando_revisao_edital` usando `assertTransition`.

- [ ] **Step 4: Verificar e commitar**

```bash
pnpm run typecheck && pnpm run test && pnpm run build
git add artifacts/kalibra/src
git commit -m "feat: refletir extracao real no progresso do edital"
```

---

### Task 11: Revisão do edital com pesos, fontes e incertezas

O coração do PD-06. A tela existe e é boa; ganha o que o spec exige.

**Files:**
- Create: `artifacts/kalibra/src/components/SyllabusTree.tsx`, `src/components/SourceExcerpt.tsx`, `src/components/CargoFilter.tsx`
- Modify: `artifacts/kalibra/src/pages/EditalRevisar.tsx`

**Interfaces:**
- Consumes: `useSyllabus`, `useExtraction`; `Syllabus`, `isCommon`, `cargosFor` de `@workspace/core`; `Cargo` de `@/domain/useWorkspaces`
- Produces:
  - `export function SyllabusTree(props: { syllabus: Syllabus; cargoId: string | null; onRename(itemId: string, label: string): void; onRemove(itemId: string): void; onAdd(parentItemId: string | null): void; onSplit(itemId: string, cargoId: string): void }): JSX.Element`
  - `export function SourceExcerpt(props: { excerpt: string | null; page: number | null }): JSX.Element | null`
  - `export function CargoFilter(props: { cargos: Cargo[]; selected: string | null; onSelect(cargoId: string | null): void }): JSX.Element` — nasce aqui porque esta task já precisa dele; a Task 13 e a Task 15 apenas consomem

> `CargoFilter` é uma linha de `k-chip`, com o cargo ativo em `k-chip-active` e uma opção "todos os cargos" à esquerda — o mesmo padrão que a tela `Erros` usa para filtro.

**Padrões visuais:** a árvore mantém exatamente o layout atual de `EditalRevisar` (matéria em `font-semibold text-[14px]`, tópicos indentados com borda à esquerda, menu de três pontos por tópico). O que entra é conteúdo dentro dessa mesma estrutura.

- [ ] **Step 1: Peso e quantidade editáveis inline**

Cada matéria e tópico ganha dois campos numéricos pequenos (`k-input` com largura fixa, no padrão já usado em `AvailabilityFields`), um para peso e outro para quantidade de questões. Quando o workspace tem mais de um cargo, os campos são por cargo — use o `CargoFilter` da Task 13 para escolher qual está sendo editado.

- [ ] **Step 2: Trecho-fonte**

`SourceExcerpt` mostra, num `k-card-soft` com `k-mono text-[11px]`, o trecho do edital que originou o item, com a página quando houver. Colapsado por padrão, aberto por um botão discreto `k-button-quiet` — a tela não pode virar um paredão de texto.

- [ ] **Step 3: Incertezas**

Item com `uncertain: true` recebe o tratamento coral que `Erros` já usa para severidade alta: `k-chip` com `border-[#db8f83] text-[#c94f45] dark:border-[#ff907d] dark:text-[#ff907d]`. O bloco "Não encontrado no edital" que já existe passa a listar `output.uncertainties`, e **continua proibido de ser preenchido com valor inventado** — é regra do PD-06.

- [ ] **Step 4: Verificar e commitar**

```bash
pnpm run typecheck && pnpm run test && pnpm run build
git add artifacts/kalibra/src
git commit -m "feat: mostrar pesos, trechos-fonte e incertezas na revisao do edital"
```

---

### Task 12: Deduplicação visível e reversível

**Files:**
- Modify: `artifacts/kalibra/src/pages/EditalRevisar.tsx`, `src/components/SyllabusTree.tsx`

**Interfaces:**
- Consumes: `isCommon`, `cargosFor`, `splitItem` de `@workspace/core`
- Produces: nenhuma nova

- [ ] **Step 1: Marcar o que é comum**

Item ligado a mais de um cargo ganha um `k-chip` neutro dizendo a quantos cargos pertence. Um bloco `k-card-soft` no topo da tela explica, em uma frase, que conteúdos repetidos entre cargos foram unidos e aparecem uma vez só — o spec exige que o usuário entenda isso, não que descubra sozinho.

- [ ] **Step 2: Permitir separar**

O menu de três pontos de cada item ganha "Separar de \<cargo\>" quando o item é comum, chamando `splitFromCargo`. Essa é a resposta do spec para "a IA deduplicou errado".

- [ ] **Step 3: Verificar e commitar**

```bash
pnpm run typecheck && pnpm run test && pnpm run build
git add artifacts/kalibra/src
git commit -m "feat: tornar a deduplicacao visivel e reversivel na revisao"
```

---

### Task 13: Comparação entre versões de edital

O PD-08. Editais são republicados com retificações e o usuário precisa ver o que mudou antes de aceitar.

**Files:**
- Create: `lib/core/src/syllabus/diff.ts`, `.../diff.test.ts`
- Modify: `artifacts/kalibra/src/pages/EditalRevisar.tsx`, `lib/core/src/index.ts`

**Interfaces:**
- Consumes: `Syllabus`, `SyllabusItem`, `Concept`, `matchConcept`; `CargoFilter` de `@/components/CargoFilter` (criado na Task 11)
- Produces:
  - `export type SyllabusDiff = { added: SyllabusItem[]; removed: SyllabusItem[]; renamed: Array<{ from: SyllabusItem; to: SyllabusItem }>; unchanged: SyllabusItem[] }`
  - `export function diffSyllabus(previous: Syllabus, next: Syllabus, concepts: readonly Concept[]): SyllabusDiff`

> **A regra que o PD-08 exige e que o modelo torna fácil:** renomeado não é remoção mais adição. "Emprego do acento indicativo de crase" liga ao mesmo conceito de "Crase" pelos aliases, então aparece como renomeação e o histórico de estudo é preservado. Os testes precisam cobrir exatamente esse caso.
>
> Item removido que **já tem histórico** recebe aviso coral, e o histórico não é apagado — o item sai da lista ativa e o dado permanece.

- [ ] **Step 1: Escrever os testes que falham**

Cobrir: item novo aparece em `added`; item sumido aparece em `removed`; item cujo rótulo mudou mas o conceito é o mesmo aparece em `renamed` e **não** em `added`/`removed`; item idêntico aparece em `unchanged`; diff contra programa vazio devolve tudo em `added`; diff de um programa contra si mesmo devolve tudo em `unchanged`.

- [ ] **Step 2: Implementar, ligar na tela, verificar, commitar**

O bloco "Comparado com a versão 1" já existe em `EditalRevisar` com dados fixos; passa a receber o resultado de `diffSyllabus`. O `CargoFilter` nasce aqui porque a Task 11 já precisa dele — se as tasks forem executadas em ordem, crie-o na 11 e apenas consuma aqui.

```bash
git add lib/core/src artifacts/kalibra/src
git commit -m "feat: comparar versoes de edital preservando renomeacoes"
```

---

### Task 14: Aprovação da estrutura fecha o ciclo

Liga a revisão do edital à fila de aprovação: confirmar a estrutura deixa de ser um botão solto e passa a ser a decisão de um item da fila.

**Files:**
- Modify: `artifacts/kalibra/src/pages/EditalRevisar.tsx`, `src/pages/Aprovacoes.tsx`

**Interfaces:**
- Consumes: `useApprovals`, `useSyllabus`, `assertTransition`
- Produces: nenhuma nova

- [ ] **Step 1: Enfileirar a estrutura extraída**

Quando a extração termina, um `ApprovalItem` do tipo `edital_structure` entra na fila com `payloadBefore` sendo o programa atual (ou `null` na primeira importação) e `payloadAfter` sendo o proposto.

- [ ] **Step 2: `EditalRevisar` vira a superfície de revisão desse item**

O botão "Confirmar estrutura" aprova o item da fila, grava o programa e move o status para `diagnostico_pendente` via `assertTransition`. "Descartar" rejeita o item. **Nada é gravado no programa antes da aprovação** — é o invariante do PD-06 e do spec §4.4.

- [ ] **Step 3: A fila lincar para a tela dedicada**

Um item `edital_structure` em `/aprovacoes` mostra o resumo e um botão que leva a `/edital/revisar/<versao>`, em vez de tentar renderizar uma árvore inteira dentro do cartão.

- [ ] **Step 4: Verificar e commitar**

```bash
pnpm run typecheck && pnpm run test && pnpm run build
git add artifacts/kalibra/src
git commit -m "feat: aprovar estrutura do edital pela fila de aprovacao"
```

---

### Task 15: Tela Edital com dados reais

**Files:**
- Modify: `artifacts/kalibra/src/pages/Edital.tsx`

**Interfaces:**
- Consumes: `useSyllabus`, `CargoFilter`, `isCommon`, `totalQuestionsFor`

- [ ] **Step 1: Trocar a fonte dos dados**

A lista de tópicos deixa de vir de `@/data` e passa a vir do programa salvo. Os filtros existentes (matéria, prioridade, status) permanecem; ganha o `CargoFilter`.

Os campos que o programa ainda não tem — prioridade e acerto por tópico — só chegam com o diagnóstico, na Fase 1C. Até lá, **mostre estado vazio honesto** nesses campos em vez de inventar número: "sem dados até o diagnóstico". Não é aceitável preencher com zero e deixar parecer que o aluno errou tudo.

- [ ] **Step 2: Verificar e commitar**

```bash
pnpm run typecheck && pnpm run test && pnpm run build
git add artifacts/kalibra/src
git commit -m "feat: alimentar a tela Edital com o programa salvo"
```

---

### Task 16: Verificação final da Fase 1B

**Files:**
- Create: `docs/superpowers/plans/2026-09-13-kalibra-fase-1b-verificacao.md`

- [ ] **Step 1: Rodar o portão completo**

```bash
cd "C:/Users/User/Documents/Kalibra"
pnpm run typecheck
pnpm run test
pnpm run build
```

- [ ] **Step 2: Confirmar as restrições**

```bash
grep -rn "localStorage\|sessionStorage\|fetch(" artifacts/kalibra/src/pages artifacts/kalibra/src/components --include=*.tsx | grep -v "components/ui/" | grep -v "\.test\." || echo "nenhuma tela toca persistencia"
grep -rnE "Date\.now\(\)|new Date\(\)" lib/core/src --include=*.ts | grep -v test || echo "lib/core sem leitura de relogio"
grep -rn "hasEdital" artifacts/kalibra/src/ | grep -v "hasEdital(" || echo "hasEdital so como funcao derivada"
grep -rn "from '@/data'" artifacts/kalibra/src/pages/Edital.tsx || echo "Edital nao le mais dados mockados"
```

- [ ] **Step 3: Rodar a suíte em três fusos**

```bash
# via PowerShell — o Bash desta sessão descarta TZ
foreach ($tz in @("UTC","America/Sao_Paulo","Pacific/Kiritimati")) { $env:TZ = $tz; pnpm run test }
```

Esperado: mesmo resultado nos três, zero snapshots reescritos.

- [ ] **Step 4: Conferência visual manual nos dois temas**

Percorrer, em dark e em claro: criação de workspace com edital colado (os quatro estágios), revisão com pesos e trechos, um item comum sendo separado, a fila de aprovação com um item pendente, aprovação fechando o ciclo, e a tela Edital com o programa salvo.

Requer `VITE_CLERK_PUBLISHABLE_KEY`. Se a chave não existir, **registrar isso explicitamente**, listando o que ficou sem cobertura. Não fabricar a conferência.

- [ ] **Step 5: Escrever o registro e commitar**

Incluir: contagem de testes por pacote, saída dos comandos, resultado dos quatro greps, o resultado por fuso, todo snapshot que mudou e por quê, e qualquer desvio.

```bash
git add docs/superpowers/plans/2026-09-13-kalibra-fase-1b-verificacao.md
git commit -m "docs: registrar verificacao final da fase 1b"
```

---

## Estado ao fim da Fase 1B

- `lib/core` com a espinha do domínio: conceito global, programa de estudo, deduplicação entre cargos, contrato de extração, diff de versões e fila de aprovação — tudo puro e testado
- Edital importado vira estrutura real, com peso e quantidade de questões por cargo
- Conteúdo comum entre cargos aparece uma vez, marcado como comum, e pode ser separado quando a união estiver errada
- Versão nova de edital mostra o que mudou, tratando renomeação como renomeação
- Nada entra no programa sem aprovação humana, e a fila que governa isso existe
- Os dois débitos da Fase 1A quitados: a máquina de estados descreve o fluxo real e é aplicada, e `hasEdital` deixou de ser um segundo lugar onde a verdade mora

**Próximo plano:** Fase 1C — diagnóstico obrigatório, plano quinzenal e sessões de estudo.
