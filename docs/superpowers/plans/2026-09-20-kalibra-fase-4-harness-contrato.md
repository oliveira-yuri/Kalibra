# Fase 4 — Harness de contrato (plano executável)

> **Os cenários existem e passam contra o adaptador local, antes de existir
> qualquer adaptador de API.** Nada de backend nesta fase. O que se constrói aqui
> é o instrumento que vai dizer, nas Fases 5–9, se o adaptador de API faz a mesma
> coisa que o local — e ele precisa ser escrito enquanto ainda não há backend para
> copiar.

**Roteiro:** `docs/superpowers/plans/2026-09-15-kalibra-fase-1c.md` (Fase 4)
**Spec:** `docs/superpowers/specs/2026-09-14-kalibra-fase-1c-design.md` (§3)
**Linha de base:** `main` em `8d60994`, 651 testes, portão verde.

---

## Descoberta feita antes de escrever este plano

Três verificações executadas contra o código. **As três mudam o plano**, e a
primeira muda a forma da fase inteira.

### 1. As quatro portas são *hooks React*, não funções

```ts
// ports/workspaces.ts
export interface WorkspacesPort {
  useWorkspaces(userId?: string): { workspaces; addWorkspace; updateWorkspace };
  parseWorkspaceDraft(raw: unknown): WorkspaceDraft | null;
  defaultCargo(examDate: string): Cargo;
  nextSyllabusVersionFor(slug: string, userId?: string): number;
}
// ports/syllabus.ts, ports/concepts.ts, ports/approvals.ts: idem —
// useSyllabus, useConcepts, useApprovals
```

O roteiro dizia "escrever os cenários como funções puras sobre a **porta**". Isso
não é executável como está: chamar `useWorkspaces` exige uma árvore React
renderizando. Um cenário escrito literalmente sobre a porta carregaria
`renderHook` e `act` dentro de si — e aí ele deixa de ser contrato, porque um
adaptador de API atendido por `fetch` não tem hook nenhum para renderizar.

**Consequência: entra uma camada que o roteiro não previu — o `Driver`.** É a
porta vista por um cenário: as mesmas operações, todas assíncronas, sem React.
Quem sabe que o local é hook é o *driver local*; quem saberá que a API é HTTP
será o *driver de API*, na Fase 5. O cenário não sabe nem uma coisa nem outra.

O risco disso está na Tarefa 1 e é tratado lá: um driver escrito à mão pode virar
"o contrato que o adaptador local define", que é a tautologia que a Fase 1A
trabalhou para evitar.

### 2. `getWorkspaces` inventa dois workspaces quando a chave está ausente

```ts
// adapters/local/workspaces.ts
export function getWorkspaces(userId?: string): WorkspaceDraft[] {
  // chave GENUINAMENTE ausente = primeiro uso → devolve `defaultPrograms`
  // (setec-campinas e bb-escriturario, dois concursos fictícios de demonstração)
```

**Nenhum adaptador de API vai fazer isso.** Um cenário que comece do zero e
afirme "há 1 workspace depois de eu criar 1" passa no local por acidente
aritmético errado (são 3) ou falha, e no caso em que passar estará codificando um
comportamento de demonstração como se fosse contrato.

**Regra que sai daqui, e que a Tarefa 9 fiscaliza:** nenhum cenário afirma
contagem total de workspaces. Todo cenário afirma sobre **o que ele mesmo criou**,
localizado por `slug`.

### 3. Os adaptadores locais se coordenam por `window` e `localStorage`

`useWorkspaces`, `useSyllabus`, `useConcepts` e `useApprovals` escrevem em
`localStorage` e disparam `window.dispatchEvent(new Event('storage'))` para se
notificarem. Além disso, `applyApprovalSideEffects` alcança três módulos de uma
vez: promove o conceito, reaponta o item de syllabus e registra o alias.

Nada disso pode aparecer num cenário. Mas o **efeito observável** — depois de
aprovar uma fusão, o conceito está confirmado e o item aponta para ele — é
contrato legítimo, e um adaptador de API terá de reproduzi-lo. A distinção entre
as duas coisas é o assunto da Tarefa 8.

---

## Restrições globais desta fase

Um revisor rejeita a tarefa que violar qualquer uma.

- **Nenhum cenário importa de `adapters/`.** Nem tipo.
- **Nenhum cenário menciona `localStorage`, `window`, `dispatchEvent`,
  `renderHook`, `act`, nem chave de armazenamento.**
- **Nenhum cenário afirma ordem de array** a menos que o domínio defina a ordem.
- **Nenhum cenário assume escrita síncrona.** Tudo é `await`.
- **Nenhum cenário afirma contagem total** de workspace, conceito ou aprovação —
  só sobre o que ele próprio criou.
- **Nenhum adaptador de API é escrito nesta fase.** `domainConfig` continua
  inteiro em `'local'`.
- **Nada no frontend de produção muda.** Os 341 testes existentes terminam
  idênticos; os cenários são adição.
- **Nenhuma regra de domínio reimplementada** no harness — ela vive em `lib/core`.
- Commits em português, `tipo: descrição`, corpo terminando com:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

---

## Estrutura de arquivos

Todos sob `artifacts/kalibra/src/domain/__contract__/`.

| Arquivo | Responsabilidade |
|---|---|
| `driver.ts` | **O contrato.** A interface que um cenário enxerga: as operações das quatro portas, todas assíncronas, sem React. Nenhuma implementação. |
| `cenarios.ts` | Os cenários. Funções `(d: Driver) => Promise<void>` com asserts de comportamento. Não importa de `adapters/`, não conhece React. |
| `runner.ts` | Recebe uma **fábrica** de driver e roda todos os cenários, um mundo limpo por cenário. |
| `local-driver.ts` | Implementa `Driver` sobre os hooks locais, com `renderHook`/`act`. **É o único arquivo do harness que sabe que o local é React.** |
| `local.test.ts` | Roda o runner contra o driver local. |
| `estrutura.test.ts` | As proibições acima, verificadas por varredura de fonte. |
| `lentidao.test.ts` | Roda os mesmos cenários contra um driver **artificialmente lento**, para provar que nenhum depende de imediatismo. |

O driver de API **não é criado nesta fase**. `local.test.ts` é o único chamador do
runner até a Fase 5.

---

# Tarefa 1 — A interface `Driver`

**Objetivo:** declarar o contrato que os dois adaptadores vão satisfazer, sem que
ele seja definido por nenhum dos dois.

**Arquivos:** criar `src/domain/__contract__/driver.ts`

**Interfaces produzidas:** `Driver`, `FabricaDeDriver`, `MundoDeTeste`.

- [ ] **Passo 1: escrever a interface**

```ts
import type {
  Concept, DedupResult, ExtractionOutput, Syllabus, SyllabusItemCargo,
} from '@workspace/core';
import type { ApprovalItem } from '@workspace/core';
import type { Cargo, WorkspaceDraft } from '../ports';

/**
 * A porta como um CENÁRIO a enxerga.
 *
 * As quatro portas do domínio expõem hooks (`useWorkspaces`, `useSyllabus`,
 * `useConcepts`, `useApprovals`). Um cenário não pode chamá-los: exigiria árvore
 * React dentro do próprio cenário, e um adaptador de API atendido por `fetch` não
 * tem hook para renderizar. O `Driver` é a mesma superfície sem essa exigência.
 *
 * **Toda operação é assíncrona, inclusive as que o local resolve na hora.** Não é
 * cerimônia: um cenário que pudesse ler um valor sem `await` estaria autorizado a
 * depender de imediatismo, e quebraria inteiro contra HTTP. `lentidao.test.ts`
 * prova que nenhum depende.
 */
export interface Driver {
  // ---- workspaces + cargos ----
  criarWorkspace(w: WorkspaceDraft): Promise<void>;
  atualizarWorkspace(slug: string, updates: Partial<WorkspaceDraft>): Promise<void>;
  /** O workspace de `slug`, ou `null`. NUNCA a lista inteira — ver Descoberta 2. */
  lerWorkspace(slug: string): Promise<WorkspaceDraft | null>;
  cargoPadrao(examDate: string): Promise<Cargo>;
  proximaVersaoDeEdital(slug: string): Promise<number>;

  // ---- syllabus ----
  lerSyllabus(slug: string): Promise<Syllabus>;
  salvarSyllabus(slug: string, next: Syllabus): Promise<void>;
  adicionarItem(slug: string, parentItemId: string | null, label: string, cargoIds: string[]): Promise<void>;
  renomearItem(slug: string, itemId: string, label: string): Promise<void>;
  removerItem(slug: string, itemId: string): Promise<void>;
  ligarACargo(slug: string, itemId: string, cargoId: string): Promise<void>;
  desligarDeCargo(slug: string, itemId: string, cargoId: string): Promise<void>;
  separarDeCargo(slug: string, itemId: string, cargoId: string): Promise<void>;
  atualizarLigacao(
    slug: string, itemId: string, cargoId: string,
    patch: Partial<Pick<SyllabusItemCargo, 'weight' | 'questionCount'>>,
  ): Promise<void>;
  /** COMPUTA a proposta. Não grava — é isso que o cenário `previsao_nao_grava` afirma. */
  preverExtracao(slug: string, output: ExtractionOutput): Promise<DedupResult>;

  // ---- conceitos ----
  lerConceitos(): Promise<Concept[]>;
  adicionarConceito(c: Concept): Promise<void>;
  confirmarConceito(conceptId: string): Promise<void>;
  renomearConceito(conceptId: string, novoNome: string): Promise<void>;

  // ---- aprovações ----
  lerAprovacoes(): Promise<ApprovalItem[]>;
  enfileirar(
    item: Omit<ApprovalItem, 'id' | 'status' | 'createdAt' | 'decidedAt' | 'reason'>,
    now: Date,
  ): Promise<string>;
  aprovar(id: string, payloadAfter?: unknown): Promise<void>;
  rejeitar(id: string, reason?: string, payloadAfter?: unknown): Promise<void>;

  /**
   * **A primitiva central do harness.** Esquece tudo que está em memória e volta
   * a perguntar ao sistema.
   *
   * É o que permite afirmar durabilidade sem olhar armazenamento: em vez de
   * espiar `localStorage` — que só o local tem — o cenário para de olhar, olha de
   * novo, e afirma sobre o que o sistema responde. No local isso é remontar o
   * hook; na API, refazer a requisição. A pergunta é a mesma nos dois: *o que o
   * sistema diz depois que eu deixei de estar olhando?*
   */
  recarregar(): Promise<void>;
}

/** Um mundo isolado: driver mais o que for preciso para desmontá-lo. */
export type MundoDeTeste = { driver: Driver; encerrar(): Promise<void> };

/**
 * Cria um mundo **limpo**. O runner chama uma vez por cenário.
 *
 * Como o isolamento é obtido é problema de cada adaptador — limpar armazenamento
 * no local, usuário novo ou transação na API — e de propósito não aparece aqui.
 * Um cenário que soubesse limpar o mundo saberia como o mundo é guardado.
 */
export type FabricaDeDriver = () => Promise<MundoDeTeste>;
```

- [ ] **Passo 2: teste estrutural — o driver espelha as portas**

Criar em `estrutura.test.ts` (o arquivo nasce aqui e cresce na Tarefa 9):

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const AQUI = __dirname;
const PORTAS = join(AQUI, '..', 'ports');

describe('o Driver é derivado das portas, não do adaptador', () => {
  it('driver.ts não importa nada de adapters/', () => {
    const fonte = readFileSync(join(AQUI, 'driver.ts'), 'utf8');
    expect(fonte).not.toMatch(/from\s+['"][^'"]*adapters\//);
  });

  it('todo tipo de domínio do Driver vem de @workspace/core ou de ../ports', () => {
    // Se um tipo entrasse aqui vindo de outro lugar, o contrato passaria a ter
    // vocabulário próprio — e "os dois adaptadores implementam o mesmo contrato"
    // deixaria de ser verificável.
    const fonte = readFileSync(join(AQUI, 'driver.ts'), 'utf8');
    const origens = [...fonte.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(origens.length).toBeGreaterThan(0);
    expect(origens.every((o) => o === '@workspace/core' || o === '../ports')).toBe(true);
  });

  it('cada operação do Driver corresponde a uma operação de porta', () => {
    // A tautologia que este teste impede: o Driver ganhar um método que nenhuma
    // porta tem, e o "contrato" passar a descrever o harness em vez do domínio.
    const driver = readFileSync(join(AQUI, 'driver.ts'), 'utf8');
    const portas = ['workspaces', 'concepts', 'syllabus', 'approvals']
      .map((n) => readFileSync(join(PORTAS, `${n}.ts`), 'utf8')).join('\n');

    // `recarregar` é do harness, não do domínio: é a primitiva de observação.
    const DO_HARNESS = new Set(['recarregar']);
    const metodos = [...driver.matchAll(/^\s{2}(\w+)\(/gm)].map((m) => m[1])
      .filter((n) => !DO_HARNESS.has(n));

    expect(metodos.length).toBeGreaterThan(15);
    const CORRESPONDENCIA: Record<string, string> = {
      criarWorkspace: 'addWorkspace', atualizarWorkspace: 'updateWorkspace',
      lerWorkspace: 'workspaces', cargoPadrao: 'defaultCargo',
      proximaVersaoDeEdital: 'nextSyllabusVersionFor',
      lerSyllabus: 'syllabus', salvarSyllabus: 'save', adicionarItem: 'addItem',
      renomearItem: 'renameItem', removerItem: 'removeItem',
      ligarACargo: 'linkToCargo', desligarDeCargo: 'unlinkFromCargo',
      separarDeCargo: 'splitFromCargo', atualizarLigacao: 'updateLink',
      preverExtracao: 'previewExtraction',
      lerConceitos: 'concepts', adicionarConceito: 'addConcept',
      confirmarConceito: 'confirmConcept', renomearConceito: 'renameConcept',
      lerAprovacoes: 'items', enfileirar: 'enqueue',
      aprovar: 'approve', rejeitar: 'reject',
    };
    const semPorta = metodos.filter((m) => {
      const alvo = CORRESPONDENCIA[m];
      return !alvo || !portas.includes(alvo);
    });
    expect(semPorta).toEqual([]);
  });
});
```

- [ ] **Passo 3: rodar e confirmar verdes**

`pnpm --filter ./artifacts/kalibra test -- __contract__` → 3 passando.

- [ ] **Passo 4: provar não-vacuidade**

Acrescentar temporariamente a `driver.ts` um método `limparArmazenamento(): Promise<void>`.
Esperado: `cada operação do Driver corresponde a uma operação de porta` **vermelho**.
Remover. Registrar o nome do teste vermelho no relatório da tarefa.

- [ ] **Passo 5: commit**

```bash
git add artifacts/kalibra/src/domain/__contract__
git commit -m "feat: interface Driver e a guarda contra o contrato virar tautologia"
```

---

# Tarefa 2 — O driver local

**Objetivo:** implementar `Driver` sobre os hooks, confinando React a este arquivo.

**Arquivos:** criar `src/domain/__contract__/local-driver.ts`

**Interfaces consumidas:** `Driver`, `MundoDeTeste` (Tarefa 1).
**Interfaces produzidas:** `criarDriverLocal: FabricaDeDriver`.

- [ ] **Passo 1: escrever o driver**

```ts
import { renderHook, act, cleanup } from '@testing-library/react';
import { useWorkspaces, defaultCargo, nextSyllabusVersionFor } from '../adapters/local/workspaces';
import { useSyllabus } from '../adapters/local/syllabus';
import { useConcepts } from '../adapters/local/concepts';
import { useApprovals } from '../adapters/local/approvals';
import type { Driver, MundoDeTeste } from './driver';

/**
 * `Driver` sobre o adaptador local. **O único arquivo do harness que sabe que o
 * local é React** — nenhum cenário importa daqui.
 *
 * Cada mundo usa um `userId` próprio, e não uma limpeza global: os hooks são
 * indexados por usuário, então um id novo é um mundo vazio de verdade, sem
 * depender de ordem de execução entre arquivos de teste.
 */
let proximoUsuario = 0;

export const criarDriverLocal = async (): Promise<MundoDeTeste> => {
  const userId = `contrato-${proximoUsuario++}`;
  localStorage.clear();

  // Um render por hook. `recarregar` desmonta tudo e monta de novo — que é
  // exatamente "parei de olhar e voltei a olhar".
  let montado = montar(userId);

  const d: Driver = {
    criarWorkspace: (w) => agir(() => montado.workspaces.current.addWorkspace(w)),
    atualizarWorkspace: (slug, u) => agir(() => montado.workspaces.current.updateWorkspace(slug, u)),
    lerWorkspace: async (slug) =>
      montado.workspaces.current.workspaces.find((w) => w.slug === slug) ?? null,
    cargoPadrao: async (examDate) => defaultCargo(examDate),
    proximaVersaoDeEdital: async (slug) => nextSyllabusVersionFor(slug, userId),
    // ... uma linha por operação, no mesmo formato; `slug` seleciona qual
    // `useSyllabus` usar (o driver mantém um por workspace visitado).
    async recarregar() {
      cleanup();
      montado = montar(userId);
    },
    // (restante das operações omitido aqui por brevidade do plano — o
    //  implementador escreve todas as declaradas em `driver.ts`; a Tarefa 3
    //  falha imediatamente se alguma faltar)
  } as Driver;

  return { driver: d, async encerrar() { cleanup(); } };
};
```

> **Nota ao implementador.** Este é o único lugar do plano com código abreviado, e
> é deliberado: as operações restantes são mecânicas e a assinatura de cada uma já
> está fixada em `driver.ts`. Escreva **todas**; `as Driver` sai assim que o
> objeto estiver completo, e o `tsc` passa a cobrar o que faltar. **Não deixe o
> `as Driver` no código final** — ele existe só para o arquivo compilar enquanto
> você preenche.

- [ ] **Passo 2: teste de fumaça**

```ts
// local.test.ts — nasce aqui, cresce na Tarefa 3
it('cria e relê um workspace, sobrevivendo a um recarregar', async () => {
  const { driver, encerrar } = await criarDriverLocal();
  try {
    await driver.criarWorkspace(umWorkspace({ slug: 'w-fumaca' }));
    await driver.recarregar();
    expect((await driver.lerWorkspace('w-fumaca'))?.slug).toBe('w-fumaca');
  } finally { await encerrar(); }
});
```

`umWorkspace` é um construtor de fixture que a Tarefa 3 cria em `cenarios.ts`.

- [ ] **Passo 3: rodar** → verde. Se falhar aqui, as tarefas seguintes falhariam
pela razão errada.

- [ ] **Passo 4: commit**

```bash
git commit -m "feat: driver local sobre os hooks, com React confinado a um arquivo"
```

---

# Tarefa 3 — Runner e o primeiro cenário

**Objetivo:** a máquina completa de ponta a ponta, com um cenário só.

**Arquivos:** criar `cenarios.ts`, `runner.ts`; modificar `local.test.ts`

- [ ] **Passo 1: `cenarios.ts` — fixtures e o primeiro cenário**

```ts
import { expect } from 'vitest';
import { emptyAvailability } from '@workspace/core';
import type { WorkspaceDraft } from '../ports';
import type { Driver } from './driver';

/** Um cenário: o que o usuário fez, e o que o domínio deve dizer depois. */
export type Cenario = { nome: string; roda(d: Driver): Promise<void> };

export function umWorkspace(p: Partial<WorkspaceDraft> = {}): WorkspaceDraft {
  return {
    slug: 'w1', title: 'Concurso de teste', institution: 'Banca X',
    type: 'Concurso Público', examDate: '2027-03-01',
    cargos: [{ id: 'c1', name: 'Cargo A', examDate: '2027-03-01' }],
    selectedCargoId: 'c1', availability: emptyAvailability(),
    status: 'rascunho', sourceMode: 'none', sourceBlocks: [],
    importStatus: 'pending', progress: 0, nextAction: '', active: true,
    ...p,
  };
}

export const CENARIOS: Cenario[] = [
  {
    nome: 'workspace criado sobrevive a recarregar',
    async roda(d) {
      await d.criarWorkspace(umWorkspace({ slug: 'w-dur', title: 'Título original' }));
      await d.recarregar();

      const lido = await d.lerWorkspace('w-dur');
      expect(lido?.title).toBe('Título original');
      // Afirma sobre o que ESTE cenário criou, por slug. Contagem total seria
      // contaminada por `defaultPrograms` do adaptador local — ver Descoberta 2.
    },
  },
];
```

- [ ] **Passo 2: `runner.ts`**

```ts
import { describe, it } from 'vitest';
import type { FabricaDeDriver } from './driver';
import { CENARIOS } from './cenarios';

/**
 * Roda todos os cenários contra um driver qualquer.
 *
 * **Um mundo por cenário**, criado pela fábrica: se um cenário pudesse ver o que
 * o anterior deixou, o conjunto passaria a depender da ordem — e ordem é
 * exatamente o que não sobrevive à troca de adaptador.
 */
export function rodarContrato(nome: string, fabrica: FabricaDeDriver): void {
  describe(`contrato: ${nome}`, () => {
    for (const cenario of CENARIOS) {
      it(cenario.nome, async () => {
        const mundo = await fabrica();
        try { await cenario.roda(mundo.driver); } finally { await mundo.encerrar(); }
      });
    }
  });
}
```

- [ ] **Passo 3: `local.test.ts` vira duas linhas**

```ts
import { rodarContrato } from './runner';
import { criarDriverLocal } from './local-driver';

rodarContrato('adaptador local', criarDriverLocal);
```

- [ ] **Passo 4: rodar** → 1 cenário verde.

- [ ] **Passo 5: provar que o cenário é load-bearing**

Em `local-driver.ts`, fazer `criarWorkspace` não chamar `addWorkspace`.
Esperado: `contrato: adaptador local > workspace criado sobrevive a recarregar`
**vermelho**. Restaurar.

- [ ] **Passo 6: commit**

```bash
git commit -m "feat: runner parametrizavel e o primeiro cenario de contrato"
```

---

# Tarefa 4 — Cenários: workspace e cargos

**Arquivos:** modificar `cenarios.ts`

Acrescentar a `CENARIOS`. Cada um: agir, `recarregar`, afirmar.

- [ ] **Passo 1: escrever os quatro**

```ts
{
  nome: 'atualizar um workspace não cria outro',
  async roda(d) {
    await d.criarWorkspace(umWorkspace({ slug: 'w-upd', title: 'Antes' }));
    await d.atualizarWorkspace('w-upd', { title: 'Depois' });
    await d.recarregar();
    expect((await d.lerWorkspace('w-upd'))?.title).toBe('Depois');
  },
},
{
  nome: 'atualizar um workspace não afeta outro',
  async roda(d) {
    await d.criarWorkspace(umWorkspace({ slug: 'w-a', title: 'A' }));
    await d.criarWorkspace(umWorkspace({ slug: 'w-b', title: 'B' }));
    await d.atualizarWorkspace('w-a', { title: 'A editado' });
    await d.recarregar();
    expect((await d.lerWorkspace('w-a'))?.title).toBe('A editado');
    expect((await d.lerWorkspace('w-b'))?.title).toBe('B');
  },
},
{
  nome: 'trocar o cargo selecionado persiste',
  async roda(d) {
    await d.criarWorkspace(umWorkspace({
      slug: 'w-cargo',
      cargos: [
        { id: 'c1', name: 'Cargo A', examDate: '2027-03-01' },
        { id: 'c2', name: 'Cargo B', examDate: '2027-05-10' },
      ],
      selectedCargoId: 'c1',
    }));
    await d.atualizarWorkspace('w-cargo', { selectedCargoId: 'c2' });
    await d.recarregar();

    const w = await d.lerWorkspace('w-cargo');
    expect(w?.selectedCargoId).toBe('c2');
    // Os dois cargos continuam existindo — selecionar não é apagar.
    expect(new Set(w?.cargos.map((c) => c.id))).toEqual(new Set(['c1', 'c2']));
    // Conjunto, não índice: a ordem de `cargos` não é contrato.
  },
},
{
  nome: 'um workspace sem cargo nomeado recebe o cargo padrão',
  async roda(d) {
    const padrao = await d.cargoPadrao('2027-09-09');
    expect(padrao.examDate).toBe('2027-09-09');
    expect(padrao.id).toBeTruthy();
    expect(padrao.name).toBeTruthy();
    // Afirma FORMA, não o texto: "Cargo único" é escolha de produto do
    // adaptador local, e um adaptador de API poderia nomear diferente sem
    // quebrar contrato nenhum.
  },
},
```

- [ ] **Passo 2: rodar** → 5 cenários verdes.
- [ ] **Passo 3: commit** — `feat: cenarios de workspace e cargos`

---

# Tarefa 5 — Cenários: edital e a previsão que não grava

**Arquivos:** modificar `cenarios.ts`

- [ ] **Passo 1: o cenário mais importante da fase**

```ts
{
  nome: 'prever a extração NÃO grava nada',
  async roda(d) {
    await d.criarWorkspace(umWorkspace({ slug: 'w-prev' }));
    const antesSyllabus = await d.lerSyllabus('w-prev');
    const antesConceitos = await d.lerConceitos();
    const antesAprovacoes = await d.lerAprovacoes();

    const proposta = await d.preverExtracao('w-prev', umaExtracao());

    // A proposta existe...
    expect(proposta.syllabus.items.length).toBeGreaterThan(0);

    // ...e nada foi gravado. `recarregar` é o que torna isto uma afirmação sobre
    // o SISTEMA e não sobre memória: se `preverExtracao` tivesse gravado, o
    // estado voltaria diferente.
    await d.recarregar();
    expect((await d.lerSyllabus('w-prev')).items).toHaveLength(antesSyllabus.items.length);
    expect(await d.lerConceitos()).toHaveLength(antesConceitos.length);
    expect(await d.lerAprovacoes()).toHaveLength(antesAprovacoes.length);
  },
},
{
  nome: 'aplicar a proposta grava o que a previsão mostrou',
  async roda(d) {
    await d.criarWorkspace(umWorkspace({ slug: 'w-apl' }));
    const proposta = await d.preverExtracao('w-apl', umaExtracao());
    for (const c of proposta.newConcepts) await d.adicionarConceito(c);
    await d.salvarSyllabus('w-apl', proposta.syllabus);
    await d.recarregar();

    const depois = await d.lerSyllabus('w-apl');
    expect(depois.items).toHaveLength(proposta.syllabus.items.length);
    expect(new Set(depois.items.map((i) => i.sourceLabel)))
      .toEqual(new Set(proposta.syllabus.items.map((i) => i.sourceLabel)));
  },
},
{
  nome: 'blocos de edital por cargo sobrevivem a recarregar',
  async roda(d) {
    await d.criarWorkspace(umWorkspace({
      slug: 'w-blocos',
      cargos: [
        { id: 'c1', name: 'Cargo A', examDate: '2027-03-01' },
        { id: 'c2', name: 'Cargo B', examDate: '2027-03-01' },
      ],
      selectedCargoId: 'c1',
      sourceMode: 'text',
      sourceBlocks: [
        { cargoId: null, text: 'Conteúdo comum a todos os cargos' },
        { cargoId: 'c1', text: 'Específico do cargo A' },
      ],
    }));
    await d.recarregar();

    const blocos = (await d.lerWorkspace('w-blocos'))?.sourceBlocks ?? [];
    const porCargo = new Map(blocos.map((b) => [b.cargoId, b.text]));
    expect(porCargo.get(null)).toContain('comum');
    expect(porCargo.get('c1')).toContain('cargo A');
    // Mapa por chave, não índice: a ordem dos blocos não é contrato.
  },
},
```

Com o fixture:

```ts
import type { ExtractionOutput } from '@workspace/core';

export function umaExtracao(p: Partial<ExtractionOutput> = {}): ExtractionOutput {
  return {
    entries: [
      { cargoId: 'c1', label: 'Português', parentLabel: null, weight: 2,
        questionCount: 10, sourceExcerpt: '1. Português', page: 1, confidence: 0.9 },
      { cargoId: 'c1', label: 'Crase', parentLabel: 'Português', weight: null,
        questionCount: null, sourceExcerpt: '1.1 Crase', page: 1, confidence: 0.9 },
    ],
    detectedCargos: ['Cargo A'], examFormat: null,
    examDurationMinutes: null, uncertainties: [],
    ...p,
  };
}
```

- [ ] **Passo 2: rodar** → 8 cenários verdes.

- [ ] **Passo 3: provar `previsao_nao_grava` load-bearing**

Em `local-driver.ts`, fazer `preverExtracao` chamar `salvarSyllabus` com o
resultado antes de devolvê-lo. Esperado: **`prever a extração NÃO grava nada`
vermelho**. Restaurar.

Sem este passo o cenário mais importante da fase poderia estar afirmando o que já
é verdade por construção do driver, e não do domínio.

- [ ] **Passo 4: commit** — `feat: cenarios de edital e a previsao que nao grava`

---

# Tarefa 6 — Cenários: syllabus

**Arquivos:** modificar `cenarios.ts`

- [ ] **Passo 1: os cinco cenários**

```ts
{
  nome: 'o mesmo tópico em dois cargos vira UM item com DUAS ligações',
  async roda(d) {
    await d.criarWorkspace(umWorkspace({
      slug: 'w-dedup',
      cargos: [
        { id: 'c1', name: 'Cargo A', examDate: '2027-03-01' },
        { id: 'c2', name: 'Cargo B', examDate: '2027-03-01' },
      ],
      selectedCargoId: 'c1',
    }));
    const proposta = await d.preverExtracao('w-dedup', umaExtracao({
      entries: [
        { cargoId: 'c1', label: 'Português', parentLabel: null, weight: null,
          questionCount: null, sourceExcerpt: null, page: null, confidence: 0.9 },
        { cargoId: 'c2', label: 'Português', parentLabel: null, weight: null,
          questionCount: null, sourceExcerpt: null, page: null, confidence: 0.9 },
      ],
    }));
    await d.salvarSyllabus('w-dedup', proposta.syllabus);
    await d.recarregar();

    const s = await d.lerSyllabus('w-dedup');
    const portugues = s.items.filter((i) => i.sourceLabel === 'Português');
    expect(portugues).toHaveLength(1);
    // A deduplicação vive na CARDINALIDADE das ligações — é a espinha do §2.3
    // do spec, e vale para os dois adaptadores.
    const ligacoes = s.links.filter((l) => l.syllabusItemId === portugues[0].id);
    expect(new Set(ligacoes.map((l) => l.cargoId))).toEqual(new Set(['c1', 'c2']));
  },
},
{
  nome: 'renomear um item preserva as ligações',
  async roda(d) {
    const { slug, itemId } = await umSyllabusComUmItem(d);
    const antes = (await d.lerSyllabus(slug)).links.filter((l) => l.syllabusItemId === itemId);
    await d.renomearItem(slug, itemId, 'Nome novo');
    await d.recarregar();

    const s = await d.lerSyllabus(slug);
    const item = s.items.find((i) => i.id === itemId);
    expect(item).toBeDefined();
    const depois = s.links.filter((l) => l.syllabusItemId === itemId);
    expect(new Set(depois.map((l) => l.cargoId)))
      .toEqual(new Set(antes.map((l) => l.cargoId)));
    // NÃO afirma em qual campo o nome novo foi parar: `sourceLabel` preserva o
    // literal do edital, e onde o nome editado aparece é decisão de domínio que
    // o cenário não deve congelar. O que é contrato: renomear não desliga nada.
  },
},
{
  nome: 'ligar e desligar um cargo é observável depois de recarregar',
  async roda(d) {
    const { slug, itemId } = await umSyllabusComUmItem(d);
    await d.ligarACargo(slug, itemId, 'c2');
    await d.recarregar();
    expect(cargosDe(await d.lerSyllabus(slug), itemId)).toContain('c2');

    await d.desligarDeCargo(slug, itemId, 'c2');
    await d.recarregar();
    expect(cargosDe(await d.lerSyllabus(slug), itemId)).not.toContain('c2');
  },
},
{
  nome: 'separar de um cargo deixa o outro cargo intacto',
  async roda(d) {
    const { slug, itemId } = await umSyllabusComUmItem(d, ['c1', 'c2']);
    await d.separarDeCargo(slug, itemId, 'c2');
    await d.recarregar();

    const s = await d.lerSyllabus(slug);
    // O item original continua ligado a c1...
    expect(cargosDe(s, itemId)).toEqual(['c1']);
    // ...e c2 continua tendo o tópico, por outro item.
    const deC2 = s.links.filter((l) => l.cargoId === 'c2').map((l) => l.syllabusItemId);
    expect(deC2).toHaveLength(1);
    expect(deC2[0]).not.toBe(itemId);
  },
},
{
  nome: 'peso e número de questões de uma ligação persistem',
  async roda(d) {
    const { slug, itemId } = await umSyllabusComUmItem(d);
    await d.atualizarLigacao(slug, itemId, 'c1', { weight: 3, questionCount: 12 });
    await d.recarregar();

    const l = (await d.lerSyllabus(slug)).links
      .find((x) => x.syllabusItemId === itemId && x.cargoId === 'c1');
    expect(l?.weight).toBe(3);
    expect(l?.questionCount).toBe(12);
  },
},
```

Com os dois auxiliares:

```ts
/** Cargos ligados a um item, ORDENADOS — para a asserção não depender da ordem interna. */
function cargosDe(s: Syllabus, itemId: string): string[] {
  return s.links.filter((l) => l.syllabusItemId === itemId).map((l) => l.cargoId).sort();
}

/** Monta o arranjo mínimo e devolve o que o cenário precisa nomear. */
async function umSyllabusComUmItem(
  d: Driver, cargoIds: string[] = ['c1'],
): Promise<{ slug: string; itemId: string }> {
  const slug = `w-${Math.random().toString(36).slice(2, 8)}`;
  await d.criarWorkspace(umWorkspace({
    slug,
    cargos: [
      { id: 'c1', name: 'Cargo A', examDate: '2027-03-01' },
      { id: 'c2', name: 'Cargo B', examDate: '2027-03-01' },
    ],
    selectedCargoId: 'c1',
  }));
  await d.adicionarItem(slug, null, 'Tópico base', cargoIds);
  await d.recarregar();
  const s = await d.lerSyllabus(slug);
  const item = s.items.find((i) => i.sourceLabel === 'Tópico base');
  if (!item) throw new Error('arranjo do cenário falhou: item não foi criado');
  return { slug, itemId: item.id };
}
```

> O `throw` no auxiliar é proposital: um arranjo que falha em silêncio faria o
> cenário afirmar sobre `undefined` e passar por vacuidade.

- [ ] **Passo 2: rodar** → 13 cenários verdes.
- [ ] **Passo 3: commit** — `feat: cenarios de syllabus`

---

# Tarefa 7 — Cenários: conceitos

**Arquivos:** modificar `cenarios.ts`

- [ ] **Passo 1: os três cenários**

```ts
{
  nome: 'a biblioteca de conceitos é global — o conceito criado num workspace aparece no outro',
  async roda(d) {
    await d.criarWorkspace(umWorkspace({ slug: 'w-um' }));
    await d.criarWorkspace(umWorkspace({ slug: 'w-dois' }));
    await d.adicionarConceito({
      id: 'k1', canonicalName: 'Crase', slug: 'crase',
      parentId: null, kind: 'topic', aliases: [], status: 'provisional',
    });
    await d.recarregar();

    // O conceito não pertence a workspace nenhum: é do usuário (§4.2 do spec).
    // Isto é contrato de verdade, e um adaptador de API que guardasse conceito
    // por workspace quebraria aqui — que é justamente o erro que este cenário
    // existe para pegar na Fase 7.
    expect((await d.lerConceitos()).map((c) => c.id)).toContain('k1');
  },
},
{
  nome: 'confirmar um conceito provisório muda seu status',
  async roda(d) {
    await d.adicionarConceito({
      id: 'k2', canonicalName: 'Concordância', slug: 'concordancia',
      parentId: null, kind: 'topic', aliases: [], status: 'provisional',
    });
    await d.confirmarConceito('k2');
    await d.recarregar();

    const k = (await d.lerConceitos()).find((c) => c.id === 'k2');
    expect(k?.status).toBe('confirmed');
  },
},
{
  nome: 'renomear um conceito preserva o nome antigo como alias',
  async roda(d) {
    await d.adicionarConceito({
      id: 'k3', canonicalName: 'Nome antigo', slug: 'nome-antigo',
      parentId: null, kind: 'topic', aliases: [], status: 'provisional',
    });
    await d.renomearConceito('k3', 'Nome novo');
    await d.recarregar();

    const k = (await d.lerConceitos()).find((c) => c.id === 'k3');
    expect(k?.canonicalName).toBe('Nome novo');
    // Rastreabilidade: o edital dizia o nome antigo, e perder isso quebraria a
    // reconciliação numa reimportação.
    expect(k?.aliases).toContain('Nome antigo');
  },
},
```

- [ ] **Passo 2: rodar.** Se `renomear ... alias` falhar, **não ajuste o cenário
para passar.** Pare e reporte: ou o comportamento existe e o driver está errado,
ou o cenário afirma algo que o domínio não promete — e essa é uma decisão de
contrato, não de teste.

- [ ] **Passo 3: commit** — `feat: cenarios de conceitos`

---

# Tarefa 8 — Cenários: aprovações

**Arquivos:** modificar `cenarios.ts`

- [ ] **Passo 1: os quatro cenários**

```ts
{
  nome: 'enfileirar deixa um item pendente',
  async roda(d) {
    const id = await d.enfileirar(umaProposta(), new Date('2026-03-01T12:00:00Z'));
    await d.recarregar();
    const item = (await d.lerAprovacoes()).find((i) => i.id === id);
    expect(item?.status).toBe('pendente');
  },
},
{
  nome: 'aprovar decide o item e registra quando',
  async roda(d) {
    const id = await d.enfileirar(umaProposta(), new Date('2026-03-01T12:00:00Z'));
    await d.aprovar(id);
    await d.recarregar();

    const item = (await d.lerAprovacoes()).find((i) => i.id === id);
    expect(item?.status).toBe('aprovado');
    expect(item?.decidedAt).toBeTruthy();
    // Afirma que EXISTE, não qual instante: o relógio é de quem chama, e
    // congelar um valor aqui acoplaria o contrato ao fuso da máquina.
  },
},
{
  nome: 'rejeitar preserva o motivo',
  async roda(d) {
    const id = await d.enfileirar(umaProposta(), new Date('2026-03-01T12:00:00Z'));
    await d.rejeitar(id, 'fora do edital');
    await d.recarregar();

    const item = (await d.lerAprovacoes()).find((i) => i.id === id);
    expect(item?.status).toBe('rejeitado');
    expect(item?.reason).toBe('fora do edital');
  },
},
{
  nome: 'aprovar uma fusão de conceito confirma o conceito alvo',
  async roda(d) {
    await d.adicionarConceito({
      id: 'k-alvo', canonicalName: 'Crase', slug: 'crase',
      parentId: null, kind: 'topic', aliases: [], status: 'provisional',
    });
    const id = await d.enfileirar(
      umaProposta({ type: 'concept_merge', targetConceptId: 'k-alvo' }),
      new Date('2026-03-01T12:00:00Z'),
    );
    await d.aprovar(id);
    await d.recarregar();

    // O EFEITO é contrato; o mecanismo não. O local faz isso por
    // `applyApprovalSideEffects` alcançando três módulos via `window`; a API
    // fará numa transação. O cenário afirma só o que o usuário observa.
    const k = (await d.lerConceitos()).find((c) => c.id === 'k-alvo');
    expect(k?.status).toBe('confirmed');
  },
},
```

Com o fixture:

```ts
import type { ApprovalItem } from '@workspace/core';

type Proposta = Omit<ApprovalItem, 'id' | 'status' | 'createdAt' | 'decidedAt' | 'reason'>;

export function umaProposta(p: Partial<Proposta> = {}): Proposta {
  return {
    workspaceId: null, type: 'syllabus_item', title: 'Incluir tópico X',
    rationale: 'Apareceu no edital', sourceRef: 'linha 12',
    targetConceptId: null, confidence: 0.8,
    payloadBefore: null, payloadAfter: null,
    ...p,
  };
}
```

- [ ] **Passo 2: rodar** → 20 cenários verdes.

- [ ] **Passo 3: provar o cenário de fusão load-bearing**

No adaptador local, fazer `applyApprovalSideEffects` retornar imediatamente.
Esperado: **`aprovar uma fusão de conceito confirma o conceito alvo` vermelho**.
Restaurar. Este é o único passo do plano que reverte código de produção — vale
porque é o cenário que mais depende de acoplamento invisível.

- [ ] **Passo 4: commit** — `feat: cenarios de aprovacoes`

---

# Tarefa 9 — As guardas do harness

**Objetivo:** impedir que um cenário futuro contrabandeie detalhe do local.
**Esta tarefa é o valor da fase inteira.** Sem ela, nada impede a Fase 5 de
"consertar" um cenário quebrado colando nele uma suposição do adaptador local.

**Arquivos:** modificar `estrutura.test.ts`; criar `lentidao.test.ts`

- [ ] **Passo 1: o vocabulário proibido**

```ts
describe('nenhum cenário conhece o adaptador', () => {
  const FONTE = readFileSync(join(AQUI, 'cenarios.ts'), 'utf8');

  it('a varredura tem o que varrer', () => {
    expect(FONTE.length).toBeGreaterThan(2000);
    expect(FONTE).toContain('CENARIOS');
  });

  it.each([
    ['localStorage', /localStorage/],
    ['window', /\bwindow\./],
    ['dispatchEvent', /dispatchEvent/],
    ['renderHook', /renderHook/],
    ['act(', /\bact\(/],
    ['import de adapters/', /from\s+['"][^'"]*adapters\//],
    ['chave de armazenamento', /kalibra[_:]/],
  ])('cenarios.ts não menciona %s', (_nome, agulha) => {
    expect(FONTE).not.toMatch(agulha);
  });

  it('nenhum cenário indexa array por posição', () => {
    // `items[0]` afirma ordem, e ordem é a primeira coisa que muda quando a
    // leitura passa a vir de um `select` sem `order by`.
    // Exceção: destructuring nomeado e `.find(...)` — estes não são indexação.
    const indexacoes = [...FONTE.matchAll(/\.(items|links|concepts|cargos|sourceBlocks)\[\d+\]/g)];
    expect(indexacoes.map((m) => m[0])).toEqual([]);
  });
});
```

- [ ] **Passo 2: provar cada proibição**

Para cada agulha, inserir temporariamente a string em `cenarios.ts` (dentro de um
comentário basta — a varredura é textual), confirmar o teste correspondente
**vermelho**, remover. Registrar os 7 nomes no relatório.

- [ ] **Passo 3: o driver lento**

```ts
// lentidao.test.ts
import { rodarContrato } from './runner';
import { criarDriverLocal } from './local-driver';
import type { Driver, MundoDeTeste } from './driver';

/**
 * Os MESMOS cenários, contra um driver em que toda operação só resolve no
 * próximo macrotask.
 *
 * É a prova de que nenhum cenário depende de imediatismo. O adaptador local
 * resolve tudo na hora; o de API não vai resolver — e um cenário que tivesse
 * aprendido a contar com a resposta instantânea passaria aqui e quebraria só na
 * Fase 5, parecendo bug de backend quando seria defeito do harness.
 *
 * Atrasar é diferente de embaralhar: isto não prova que os cenários toleram
 * REORDENAÇÃO, só que não dependem de sincronicidade. Reordenação não é risco
 * aqui porque o runner sempre aguarda cada operação antes da seguinte.
 */
function lento(d: Driver): Driver {
  const atrasar = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 0));
  return new Proxy(d, {
    get(alvo, prop, receptor) {
      const valor = Reflect.get(alvo, prop, receptor);
      if (typeof valor !== 'function') return valor;
      return async (...args: unknown[]) =>
        atrasar(await (valor as (...a: unknown[]) => unknown).apply(alvo, args));
    },
  });
}

const criarDriverLento = async (): Promise<MundoDeTeste> => {
  const mundo = await criarDriverLocal();
  return { driver: lento(mundo.driver), encerrar: mundo.encerrar };
};

rodarContrato('adaptador local, artificialmente lento', criarDriverLento);
```

- [ ] **Passo 4: rodar** → 40 testes de contrato (20 cenários × 2 drivers).

- [ ] **Passo 5: provar o driver lento load-bearing**

Escrever um cenário temporário que leia **sem** `await`:

```ts
{ nome: 'TEMPORARIO', async roda(d) {
    await d.criarWorkspace(umWorkspace({ slug: 'w-sync' }));
    const p = d.lerWorkspace('w-sync') as unknown as { slug?: string };
    expect(p.slug).toBe('w-sync');   // verdadeiro só se resolver na hora
} },
```

Esperado: **verde no driver normal, vermelho no lento.** É a prova de que o
arquivo pega o que se propõe a pegar. Remover o cenário depois.

Se ele ficar vermelho nos dois, o cenário temporário está errado e a prova não
foi feita — refazer, não seguir.

- [ ] **Passo 6: commit** — `feat: guardas do harness contra vazamento do adaptador`

---

# Tarefa 10 — Portão e documento de verificação

**Arquivos:** criar `docs/superpowers/plans/2026-09-20-kalibra-fase-4-verificacao.md`

- [ ] **Passo 1: portão completo**

```bash
pnpm run typecheck && pnpm run test && pnpm run build
TZ=UTC pnpm run test
TZ=America/Sao_Paulo pnpm run test
TZ=Pacific/Kiritimati pnpm run test
```

Esperado: verde nos três. **`lib/core` 235, `lib/db` 44, `api-server` 31
inalterados** — esta fase não os toca. `artifacts/kalibra` sobe de 341 para
341 + (20 × 2) + estruturais.

> Os 341 do frontend **deixam de ser invariante** nesta fase, e é a primeira vez
> desde a Fase 1. Os cenários vivem dentro do pacote do frontend, então a
> contagem dele sobe por construção. O que permanece invariante é que **nenhum
> dos 341 testes existentes muda** — verificável por `git diff --stat` não tocar
> nenhum arquivo `.test.tsx` anterior.

- [ ] **Passo 2: escrever o documento**

Seções obrigatórias:
1. Contagem por pacote, antes e depois.
2. Portão nos três fusos.
3. **Tabela das guardas load-bearing** — uma linha por reversão dos Passos de
   prova das Tarefas 1, 3, 5, 8 e 9, com o nome do teste vermelho.
4. Os 20 cenários, um por linha, com **o que cada um afirma em termos de usuário**.
5. **"O que este harness ainda NÃO prova"**, no mínimo:
   - roda contra **um adaptador só** — a comparação que dá sentido à fase só
     acontece na Fase 5, quando o driver de API existir;
   - `previewExtraction`/`dedupeEntries` é código de `lib/core` chamado pelos dois
     lados, então o cenário de deduplicação prova **integração**, não o algoritmo;
   - o driver lento prova independência de **sincronicidade**, não de
     **reordenação** nem de falha parcial;
   - nada sobre concorrência, `If-Match` ou versão — é a Fase 5;
   - `staging.ts` está fora do contrato de propósito (efêmero por aba, nenhum
     adaptador de API o implementaria).

- [ ] **Passo 3: commit** — `docs: documento de verificacao da Fase 4`

---

# Critério de pronto

- Portão verde nos três fusos; nenhum dos 341 testes anteriores modificado.
- 20 cenários passando contra o driver local **e** contra o driver lento.
- `cenarios.ts` não menciona `localStorage`, `window`, `dispatchEvent`,
  `renderHook`, `act`, chave de armazenamento, nem importa de `adapters/`.
- Nenhum cenário afirma contagem total de workspaces nem indexa array por posição.
- `driver.ts` não importa de `adapters/`, e toda operação sua corresponde a uma
  operação de porta.
- O arquivo de driver de API **não existe**; `domainConfig` segue inteiro `'local'`.
- Cada guarda provada vermelha quando removida.

# Fora do escopo desta fase

- Qualquer adaptador de API, e qualquer endpoint de domínio.
- OpenAPI, Orval, hooks gerados.
- `If-Match`, versão, concorrência — Fase 5.
- Cenários de diagnóstico, plano, sessões, FSRS, notas, questões — não existem
  como domínio implementado.
- Postgres real, Clerk real, `.env` — a pausa de infraestrutura acordada vem
  depois desta fase, antes da Fase 5.
