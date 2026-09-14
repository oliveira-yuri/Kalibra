# Fase 1B.5 — conteúdo por cargo: entrada, vínculos e revisão

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao usuário um caminho real para informar, revisar e editar conteúdo específico de cada cargo — o que a Fase 1B construiu no modelo e testou, mas nunca conseguiu receber pela interface.

**Architecture:** A entrada de texto do edital deixa de ser um textarea único e vira blocos: um bloco "comum a todos" mais um bloco por cargo, num seletor que reusa exatamente o controle segmentado já existente (Arquivo/Texto). Cada bloco vira `RawSyllabusEntry[]` com o `cargoId` certo — o campo que sempre existiu e que ninguém nunca preencheu com dois valores diferentes. Na tela de revisão, o menu do item ganha "Aplicar a \<cargo\>" como inverso do "Separar de \<cargo\>" que já existe, e a linha passa a nomear os cargos em vez de só contá-los.

**Tech Stack:** React 19.1.0, TypeScript 5.9, Vitest 3, @testing-library/react, Tailwind 4, pnpm workspaces. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-09-12-kalibra-design.md` (§4.1 espinha do domínio, §4.4 revisão obrigatória, PD-06)

## Contexto: o que já existe e NÃO deve ser reconstruído

A Fase 1B entregou mais do que parece. Antes de escrever qualquer linha, saiba que **já existe e funciona**:

- `RawSyllabusEntry` tem `cargoId: string` por entrada (`lib/core/src/syllabus/dedup.ts:12-21`).
- `dedupeEntries` une entradas iguais de cargos diferentes num item só com duas ligações. Testado, incluindo independência de ordem.
- `SyllabusItemCargo` carrega `weight` e `questionCount` **por ligação**, não por item.
- `CargoFilter` (`artifacts/kalibra/src/components/CargoFilter.tsx`) já filtra a árvore por cargo, e com um cargo selecionado os campos de peso/quantidade editam **aquela ligação**.
- `SyllabusTree` já mostra o chip "N cargos" e o menu "Separar de \<cargo\>" (`splitItem` em `lib/core`).
- `handleAdd` em `EditalRevisar` já cria o item ligado só ao cargo selecionado no filtro.
- A máquina de estados (`lib/core/src/workspace/status.ts:58`) já impede o diagnóstico antes da revisão: `diagnostico_pendente` só é alcançável a partir de `aguardando_revisao_edital`.

**O único gargalo** é `extractEntriesFromText` (`artifacts/kalibra/src/domain/adapters/local/extraction.ts:70-82`), que recebe um texto e o distribui para todos os cargos num laço — então todo tópico nasce comum a todos, e nada acima tem o que diferenciar.

## Global Constraints

Valem para **todas** as tasks. Um reviewer rejeita a task que violar qualquer uma.

- `lib/core` é puro: sem relógio (`Date.now`, `new Date()` sem argumento), sem I/O, sem `localStorage`/`sessionStorage`, sem `window`, sem `Math.random`. Entram dados, saem dados. É essa propriedade que deixa a Fase 2 importá-lo no servidor.
- Nenhuma tela (`src/pages/**`) e nenhum componente fora de `src/components/ui/` toca `localStorage`, `sessionStorage` ou `fetch` direto. Telas consomem hooks de domínio.
- `artifacts/kalibra/src/index.css` **não pode ser modificado**. Nenhuma cor, raio, fonte, sombra ou token novo. Componentes novos compõem apenas classes `k-*` existentes e utilitários Tailwind já usados em arquivos vizinhos.
- Dark é o tema principal: toda classe de cor nova vem em par `light dark:`.
- React e react-dom ficam em `19.1.0` exato. Nenhuma dependência nova.
- Mensagens de commit em português, formato `tipo: descrição`, corpo terminando com:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- Limite de upload de edital: 20 MB (já aplicado nas duas telas).
- TDD: o teste vem antes da implementação, e precisa **falhar** por ausência da implementação antes de você escrevê-la.

## Regras de produto desta fase

- Conteúdo comum entre cargos continua sendo **uma** entidade com várias ligações — nunca cópias.
- Editar conteúdo de um cargo **não pode** alterar os demais. Isso vale para peso, quantidade de questões e vínculo.
- A interface precisa deixar explícito o que é comum e o que é específico, sem o usuário ter que deduzir de um contador.
- O fluxo atual de importação e aprovação não pode quebrar: workspaces e importações já salvos continuam abrindo.
- Modo "Arquivo" continua sendo um bloco único (o parser real é da Fase 4).

## Estrutura de arquivos

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `lib/core/src/syllabus/extraction.ts` | `CargoTextBlock` e `expandBlocks` — a regra pura de "bloco comum vale para todos, bloco de cargo vale para um" | Modificar |
| `lib/core/src/syllabus/syllabus.ts` | `linkItemToCargo` — inverso puro de `splitItem` | Modificar |
| `artifacts/kalibra/src/domain/adapters/local/extraction.ts` | Converter blocos em `RawSyllabusEntry[]` com o `cargoId` certo | Modificar |
| `artifacts/kalibra/src/components/EditalSourceBlocks.tsx` | O seletor de blocos + textarea por bloco | Criar |
| `artifacts/kalibra/src/domain/adapters/local/workspaces.ts` | Persistir `sourceBlocks` e migrar `sourceText` antigo | Modificar |
| `artifacts/kalibra/src/pages/NovoWorkspace.tsx` | Usar o componente de blocos na criação | Modificar |
| `artifacts/kalibra/src/pages/Edital.tsx` | Usar o componente de blocos na reimportação | Modificar |
| `artifacts/kalibra/src/components/SyllabusTree.tsx` | "Aplicar a \<cargo\>" e nomes dos cargos na linha | Modificar |
| `artifacts/kalibra/src/domain/adapters/local/syllabus.ts` | `linkToCargo` no hook de domínio | Modificar |
| `artifacts/kalibra/src/pages/EditalRevisar.tsx` | Ligar `onLinkToCargo` nos dois caminhos (proposta e persistido) | Modificar |

---

### Task 1: `CargoTextBlock` e `expandBlocks` em `lib/core`

A regra "bloco comum vale para todos os cargos, bloco de cargo vale só para aquele cargo" é determinística e não depende de React nem de storage. Ela vive em `lib/core` porque é exatamente o lugar onde um defeito ficaria escondido: um bloco escrito para um cargo que o usuário depois apagou não pode virar conteúdo de todo mundo em silêncio.

**Files:**
- Modify: `lib/core/src/syllabus/extraction.ts` (acrescentar ao final do arquivo; não alterar nada existente)
- Test: `lib/core/src/syllabus/extraction.test.ts` (arquivo já existe — acrescentar um `describe` novo)

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces:
  - `export type CargoTextBlock = { cargoId: string | null; text: string }`
  - `export function expandBlocks(blocks: readonly CargoTextBlock[], cargoIds: readonly string[]): Array<{ cargoId: string; text: string }>`

- [ ] **Step 1: Escrever os testes que falham**

Acrescente ao final de `lib/core/src/syllabus/extraction.test.ts` (e acrescente `expandBlocks` ao import que o arquivo já faz de `'./extraction'`):

```ts
describe('expandBlocks', () => {
  it('um bloco comum vira uma entrada por cargo, com o mesmo texto', () => {
    const result = expandBlocks([{ cargoId: null, text: 'PORTUGUÊS' }], ['c1', 'c2']);
    expect(result).toEqual([
      { cargoId: 'c1', text: 'PORTUGUÊS' },
      { cargoId: 'c2', text: 'PORTUGUÊS' },
    ]);
  });

  it('um bloco de cargo vale só para aquele cargo', () => {
    const result = expandBlocks([{ cargoId: 'c2', text: 'INFORMÁTICA' }], ['c1', 'c2']);
    expect(result).toEqual([{ cargoId: 'c2', text: 'INFORMÁTICA' }]);
  });

  it('bloco de um cargo que não existe mais é DESCARTADO, nunca promovido a comum', () => {
    // O usuário digitou o específico do cargo c3 e depois removeu c3 do workspace.
    // Tratar isso como conteúdo comum daria a todos os cargos um conteúdo que
    // ninguém pediu — contaminação silenciosa, que é o que esta fase existe para matar.
    const result = expandBlocks(
      [{ cargoId: null, text: 'COMUM' }, { cargoId: 'c3', text: 'ÓRFÃO' }],
      ['c1', 'c2'],
    );
    expect(result).toEqual([
      { cargoId: 'c1', text: 'COMUM' },
      { cargoId: 'c2', text: 'COMUM' },
    ]);
  });

  it('bloco vazio ou só com espaços não produz nada', () => {
    const result = expandBlocks(
      [{ cargoId: null, text: '   \n  ' }, { cargoId: 'c1', text: '' }],
      ['c1'],
    );
    expect(result).toEqual([]);
  });

  it('sem cargo nenhum, um bloco comum não tem a quem pertencer e não produz nada', () => {
    expect(expandBlocks([{ cargoId: null, text: 'PORTUGUÊS' }], [])).toEqual([]);
  });

  it('preserva a ordem dos blocos e, dentro do comum, a ordem dos cargos', () => {
    const result = expandBlocks(
      [{ cargoId: 'c2', text: 'B' }, { cargoId: null, text: 'A' }],
      ['c1', 'c2'],
    );
    expect(result.map((pair) => pair.cargoId + ':' + pair.text)).toEqual(['c2:B', 'c1:A', 'c2:A']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd lib/core && npx vitest run src/syllabus/extraction.test.ts`
Expected: FAIL — `expandBlocks is not a function` (ou erro de tipo no import).

- [ ] **Step 3: Implementar**

Acrescente ao final de `lib/core/src/syllabus/extraction.ts`:

```ts
/**
 * Um bloco de texto do edital e a quem ele pertence. `cargoId: null` significa
 * "comum a todos os cargos" — o bloco de conhecimentos básicos que os editais
 * publicam uma vez só para todos os cargos do certame.
 */
export type CargoTextBlock = {
  cargoId: string | null;
  text: string;
};

/**
 * Expande blocos em pares (cargo, texto) — a regra que faltava para o `cargoId` de
 * `RawSyllabusEntry` algum dia carregar dois valores diferentes.
 *
 * Um bloco de um cargo que não está mais em `cargoIds` é DESCARTADO. Promovê-lo a
 * comum daria a todos os cargos um conteúdo que ninguém pediu, e tratá-lo como
 * pertencente a um cargo inexistente criaria ligação órfã — as duas saídas são piores
 * que perder um texto que o usuário já não consegue ver na interface.
 */
export function expandBlocks(
  blocks: readonly CargoTextBlock[],
  cargoIds: readonly string[],
): Array<{ cargoId: string; text: string }> {
  const known = new Set(cargoIds);
  const pairs: Array<{ cargoId: string; text: string }> = [];

  for (const block of blocks) {
    if (block.text.trim() === '') continue;
    if (block.cargoId === null) {
      for (const cargoId of cargoIds) pairs.push({ cargoId, text: block.text });
    } else if (known.has(block.cargoId)) {
      pairs.push({ cargoId: block.cargoId, text: block.text });
    }
  }

  return pairs;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd lib/core && npx vitest run src/syllabus/extraction.test.ts`
Expected: PASS, todos.

- [ ] **Step 5: Provar que os testes não são decorativos**

Troque `else if (known.has(block.cargoId))` por `else` e rode de novo. O teste "bloco de um cargo que não existe mais é DESCARTADO" tem que ficar **vermelho**. Desfaça a alteração.

- [ ] **Step 6: Commit**

```bash
git add lib/core/src/syllabus/extraction.ts lib/core/src/syllabus/extraction.test.ts
git commit -m "feat: blocos de texto por cargo em lib/core"
```

---

### Task 2: `linkItemToCargo` — o inverso puro de `splitItem`

Hoje o usuário consegue **separar** um item comum de um cargo (`splitItem`, em `lib/core/src/syllabus/dedup.ts`), mas não consegue **ligar** um item existente a um cargo a mais. O critério "revisar vínculos tópico ↔ cargo" precisa das duas direções.

**Files:**
- Modify: `lib/core/src/syllabus/syllabus.ts` (acrescentar ao final)
- Test: `lib/core/src/syllabus/syllabus.test.ts` (arquivo já existe — acrescentar um `describe` novo)

**Interfaces:**
- Consumes: `Syllabus`, `SyllabusItemCargo` (já definidos no próprio arquivo); `splitItem` de `./dedup` para o teste de inverso.
- Produces: `export function linkItemToCargo(syllabus: Syllabus, itemId: string, cargoId: string): Syllabus`

- [ ] **Step 1: Escrever os testes que falham**

Acrescente ao final de `lib/core/src/syllabus/syllabus.test.ts`. Acrescente `linkItemToCargo` ao import de `'./syllabus'` e importe `splitItem` de `'./dedup'`:

```ts
describe('linkItemToCargo', () => {
  const base: Syllabus = {
    items: [
      { id: 'i1', workspaceId: 'w', parentItemId: null, conceptId: 'k1', sourceLabel: 'Português', uncertain: false },
      { id: 'i2', workspaceId: 'w', parentItemId: null, conceptId: 'k2', sourceLabel: 'Informática', uncertain: false },
    ],
    links: [
      { syllabusItemId: 'i1', cargoId: 'c1', weight: 30, questionCount: 10 },
      { syllabusItemId: 'i2', cargoId: 'c2', weight: 20, questionCount: 5 },
    ],
  };

  it('liga um item a um cargo novo, com peso e quantidade zerados', () => {
    const next = linkItemToCargo(base, 'i1', 'c2');
    expect(next.links).toContainEqual({ syllabusItemId: 'i1', cargoId: 'c2', weight: null, questionCount: null });
  });

  it('NÃO altera a ligação que o item já tinha com o outro cargo', () => {
    const next = linkItemToCargo(base, 'i1', 'c2');
    expect(next.links).toContainEqual({ syllabusItemId: 'i1', cargoId: 'c1', weight: 30, questionCount: 10 });
  });

  it('NÃO altera as ligações de outros itens', () => {
    const next = linkItemToCargo(base, 'i1', 'c2');
    expect(next.links.filter((link) => link.syllabusItemId === 'i2'))
      .toEqual(base.links.filter((link) => link.syllabusItemId === 'i2'));
  });

  it('não cria item novo — o conteúdo comum continua sendo UMA entidade', () => {
    const next = linkItemToCargo(base, 'i1', 'c2');
    expect(next.items).toEqual(base.items);
  });

  it('ligar de novo ao mesmo cargo é no-op (não duplica a ligação)', () => {
    expect(linkItemToCargo(base, 'i1', 'c1')).toEqual(base);
  });

  it('item inexistente devolve o syllabus intacto', () => {
    expect(linkItemToCargo(base, 'nao-existe', 'c2')).toEqual(base);
  });

  it('não muta a entrada', () => {
    const snapshot = JSON.parse(JSON.stringify(base));
    linkItemToCargo(base, 'i1', 'c2');
    expect(base).toEqual(snapshot);
  });

  it('é o inverso de splitItem para o cargo original', () => {
    const linked = linkItemToCargo(base, 'i1', 'c2');
    const split = splitItem(linked, 'i1', 'c2', (seed) => 'novo-' + seed);
    const c1Links = (syllabus: Syllabus) => syllabus.links
      .filter((link) => link.cargoId === 'c1')
      .map((link) => link.syllabusItemId + ':' + link.cargoId)
      .sort();
    expect(c1Links(split)).toEqual(c1Links(base));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd lib/core && npx vitest run src/syllabus/syllabus.test.ts`
Expected: FAIL — `linkItemToCargo is not a function`.

- [ ] **Step 3: Implementar**

Acrescente ao final de `lib/core/src/syllabus/syllabus.ts`:

```ts
/**
 * Liga um item já existente a mais um cargo — o inverso de `splitItem`, e a metade
 * que faltava para o usuário conseguir revisar vínculos nas duas direções.
 *
 * Peso e quantidade nascem `null` de propósito: são valores por cargo (§4.1), e
 * herdá-los do outro cargo inventaria um dado que o edital não afirma. A ausência é
 * visível na interface (campo vazio) e pede o olho do usuário; um número herdado
 * passaria despercebido.
 *
 * Nunca cria item novo: conteúdo comum a vários cargos é UMA entidade com várias
 * ligações, e é isso que mantém nota, histórico e FSRS inteiros.
 */
export function linkItemToCargo(syllabus: Syllabus, itemId: string, cargoId: string): Syllabus {
  const item = syllabus.items.find((candidate) => candidate.id === itemId);
  if (!item) return syllabus;

  const already = syllabus.links.some(
    (link) => link.syllabusItemId === itemId && link.cargoId === cargoId,
  );
  if (already) return syllabus;

  const link: SyllabusItemCargo = { syllabusItemId: itemId, cargoId, weight: null, questionCount: null };
  return { items: syllabus.items, links: [...syllabus.links, link] };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd lib/core && npx vitest run src/syllabus/syllabus.test.ts`
Expected: PASS, todos.

- [ ] **Step 5: Provar que os testes não são decorativos**

Remova a guarda `if (already) return syllabus;` e rode de novo: "ligar de novo ao mesmo cargo é no-op" tem que ficar **vermelho**. Desfaça.

- [ ] **Step 6: Rodar o pacote inteiro e commitar**

Run: `cd lib/core && npx vitest run`
Expected: PASS, todos.

```bash
git add lib/core/src/syllabus/syllabus.ts lib/core/src/syllabus/syllabus.test.ts
git commit -m "feat: linkItemToCargo, o inverso puro de splitItem"
```

---

### Task 3: o adaptador de extração passa a receber blocos

`extractEntriesFromText` hoje recebe um texto e o distribui para todos os cargos num laço — a linha exata que faz todo tópico nascer comum. Esta task troca a entrada por blocos e mantém o resto do arquivo como está.

Atenção a uma armadilha: a contagem de palavras que dispara o erro `short` (menos de 50 palavras) precisa contar cada bloco **uma vez**. Se contar o resultado expandido, um edital curto com cinco cargos passa no limiar só porque o bloco comum foi contado cinco vezes.

**Files:**
- Modify: `artifacts/kalibra/src/domain/adapters/local/extraction.ts`
- Test: `artifacts/kalibra/src/domain/adapters/local/extraction.test.ts` (já existe)

**Interfaces:**
- Consumes: `expandBlocks`, `CargoTextBlock` de `@workspace/core` (Task 1).
- Produces:
  - `export type ExtractionInput = { sourceMode: ExtractionSourceMode; blocks: CargoTextBlock[]; cargoIds: string[] }`
  - `useExtraction(workspaceSlug).start(input: ExtractionInput)` — mesma assinatura de hook, campo `text` substituído por `blocks`.

- [ ] **Step 1: Escrever os testes que falham**

Acrescente ao final de `artifacts/kalibra/src/domain/adapters/local/extraction.test.ts`. Use o mesmo padrão de montagem de hook que os testes já existentes nesse arquivo usam (`renderHook` + `act` + `vi.advanceTimersByTime`, com fake timers) — copie a estrutura do teste existente mais próximo em vez de inventar outra:

```ts
describe('blocos por cargo (Fase 1B.5)', () => {
  const LONGO = Array.from({ length: 60 }, (_, index) => 'palavra' + index).join(' ');

  it('um bloco específico só gera entradas do seu cargo', async () => {
    const output = await runExtraction({
      sourceMode: 'text',
      cargoIds: ['c1', 'c2'],
      blocks: [
        { cargoId: null, text: 'LÍNGUA PORTUGUESA\nInterpretação de texto\n' + LONGO },
        { cargoId: 'c2', text: 'INFORMÁTICA\nRedes de computadores' },
      ],
    });

    const informatica = output.entries.filter((entry) => entry.label === 'INFORMÁTICA');
    expect(informatica.map((entry) => entry.cargoId)).toEqual(['c2']);
  });

  it('um bloco comum gera entradas para TODOS os cargos', async () => {
    const output = await runExtraction({
      sourceMode: 'text',
      cargoIds: ['c1', 'c2'],
      blocks: [{ cargoId: null, text: 'LÍNGUA PORTUGUESA\nInterpretação de texto\n' + LONGO }],
    });

    const portugues = output.entries.filter((entry) => entry.label === 'LÍNGUA PORTUGUESA');
    expect(portugues.map((entry) => entry.cargoId).sort()).toEqual(['c1', 'c2']);
  });

  it('o conteúdo de um cargo NÃO aparece no outro', async () => {
    const output = await runExtraction({
      sourceMode: 'text',
      cargoIds: ['c1', 'c2'],
      blocks: [
        { cargoId: 'c1', text: 'DIREITO ADMINISTRATIVO\nAtos administrativos\n' + LONGO },
        { cargoId: 'c2', text: 'INFORMÁTICA\nRedes de computadores' },
      ],
    });

    const doCargo1 = output.entries.filter((entry) => entry.cargoId === 'c1').map((entry) => entry.label);
    expect(doCargo1).not.toContain('INFORMÁTICA');
    expect(doCargo1).not.toContain('Redes de computadores');
  });

  it('a contagem de palavras conta cada bloco UMA vez, não o resultado expandido', async () => {
    // 30 palavras num bloco comum, com 5 cargos. Se a contagem usasse o expandido
    // seriam 150 palavras e o edital passaria no limiar de 50 sem ter tamanho nenhum.
    const trinta = Array.from({ length: 30 }, (_, index) => 'p' + index).join(' ');
    const progress = await runExtractionExpectingError({
      sourceMode: 'text',
      cargoIds: ['c1', 'c2', 'c3', 'c4', 'c5'],
      blocks: [{ cargoId: null, text: 'MATÉRIA\n' + trinta }],
    });
    expect(progress.errorKind).toBe('short');
  });

  it('modo arquivo continua gerando conteúdo comum a todos os cargos', async () => {
    const output = await runExtraction({ sourceMode: 'file', cargoIds: ['c1', 'c2'], blocks: [] });
    const portugues = output.entries.filter((entry) => entry.label === 'Língua Portuguesa');
    expect(portugues.map((entry) => entry.cargoId).sort()).toEqual(['c1', 'c2']);
  });
});
```

Escreva os dois auxiliares `runExtraction(input): Promise<ExtractionOutput>` e `runExtractionExpectingError(input): Promise<ExtractionProgress>` no topo do `describe`, montando o hook com `renderHook(() => useExtraction('w'))`, chamando `start(input)` dentro de `act`, avançando os timers dos quatro estágios e devolvendo `result.current.output` (ou `result.current.progress`). Se o arquivo já tiver um auxiliar equivalente, use o que existe em vez de escrever outro.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd artifacts/kalibra && npx vitest run src/domain/adapters/local/extraction.test.ts`
Expected: FAIL — erro de tipo em `blocks` (a propriedade não existe em `ExtractionInput`).

- [ ] **Step 3: Trocar o tipo de entrada**

Em `artifacts/kalibra/src/domain/adapters/local/extraction.ts`, acrescente `expandBlocks` e `type CargoTextBlock` ao import de `'@workspace/core'`, e substitua o tipo:

```ts
export type ExtractionInput = {
  sourceMode: ExtractionSourceMode;
  /** Blocos do edital: `cargoId: null` é o conteúdo comum a todos os cargos. */
  blocks: CargoTextBlock[];
  cargoIds: string[];
};
```

- [ ] **Step 4: Separar o parser da distribuição por cargo**

Substitua a função `extractEntriesFromText` inteira por estas duas. O parser de linhas não muda de comportamento — só deixa de saber sobre cargos:

```ts
/**
 * Analisa UM bloco de texto em linhas rotuladas. Sem nenhuma noção de cargo: uma
 * linha em CAIXA ALTA ou com numeração de primeiro nível vira disciplina, as demais
 * viram tópico da última disciplina vista, e uma linha antes de qualquer disciplina
 * é descartada (é assim que um texto sem estrutura produz zero entradas e alcança o
 * erro `structure`).
 */
function parseBlockLines(text: string): Array<{ label: string; parentLabel: string | null }> {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const parsed: Array<{ label: string; parentLabel: string | null }> = [];
  let currentDiscipline: string | null = null;

  for (const line of lines) {
    const isDiscipline = isUpperCaseLine(line) || isFirstLevelHeading(line);
    if (isDiscipline) {
      currentDiscipline = line;
    } else if (currentDiscipline === null) {
      continue;
    }
    parsed.push({ label: line, parentLabel: isDiscipline ? null : currentDiscipline });
  }

  return parsed;
}

/**
 * Converte blocos em `RawSyllabusEntry[]`. `expandBlocks` (`lib/core`) decide a quem
 * cada bloco pertence; aqui só se analisa o texto resultante.
 *
 * Antes da Fase 1B.5 esta função recebia UM texto e o distribuía para todos os cargos
 * num laço — então todo tópico nascia comum a todos, e a deduplicação multi-cargo,
 * construída e testada, nunca tinha duas entradas diferentes para distinguir.
 */
function entriesFromBlocks(blocks: readonly CargoTextBlock[], cargoIds: string[]): RawSyllabusEntry[] {
  // Sem cargoIds, nenhuma entrada teria a quem pertencer — um edital bem formado não
  // pode virar erro de `structure` só porque o chamador não informou cargos ainda.
  const cargos = cargoIds.length > 0 ? cargoIds : ['c1'];
  const entries: RawSyllabusEntry[] = [];

  for (const pair of expandBlocks(blocks, cargos)) {
    for (const line of parseBlockLines(pair.text)) {
      entries.push({
        cargoId: pair.cargoId,
        label: line.label,
        parentLabel: line.parentLabel,
        weight: null,
        questionCount: null,
        sourceExcerpt: null,
        page: null,
        confidence: 0.75,
      });
    }
  }

  return entries;
}
```

- [ ] **Step 5: Ligar no `start`**

Dentro de `start`, substitua a contagem de palavras e a produção de entradas:

```ts
      // Cada bloco conta UMA vez. Contar o resultado expandido faria um edital curto
      // passar do limiar só por ter muitos cargos — o bloco comum contado N vezes.
      const words = input.blocks.reduce((total, block) => total + wordCount(block.text), 0);
```

```ts
      const entries = input.sourceMode === 'file'
        ? demoFileEntries(input.cargoIds)
        : entriesFromBlocks(input.blocks, input.cargoIds);
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd artifacts/kalibra && npx vitest run src/domain/adapters/local/extraction.test.ts`
Expected: PASS. Os testes antigos do arquivo podem exigir ajuste de `text: '...'` para `blocks: [{ cargoId: null, text: '...' }]` — esse ajuste é esperado e não muda o que eles verificam.

- [ ] **Step 7: Provar que o teste de contaminação não é decorativo**

Em `entriesFromBlocks`, troque `cargoId: pair.cargoId` por `cargoId: cargos[0]`. O teste "o conteúdo de um cargo NÃO aparece no outro" tem que ficar **vermelho**. Desfaça.

- [ ] **Step 8: Commit**

```bash
git add artifacts/kalibra/src/domain/adapters/local/extraction.ts artifacts/kalibra/src/domain/adapters/local/extraction.test.ts
git commit -m "feat: a extracao recebe blocos por cargo em vez de um texto unico"
```

---

### Task 4: `EditalSourceBlocks` — o seletor de blocos

O componente que o usuário vê. Reusa **exatamente** o controle segmentado que `Edital.tsx:277-281` e `NovoWorkspace.tsx:320-338` já usam para Arquivo/Texto — mesmas classes, mesmas cores, mesmo raio. A única diferença é que os botões não usam `flex-1` (com muitos cargos ficariam espremidos) e o container permite quebra de linha.

**Files:**
- Create: `artifacts/kalibra/src/components/EditalSourceBlocks.tsx`
- Test: `artifacts/kalibra/src/components/EditalSourceBlocks.test.tsx`

**Interfaces:**
- Consumes: `CargoTextBlock` de `@workspace/core` (Task 1); `Cargo` de `@/domain/useWorkspaces`.
- Produces: `export function EditalSourceBlocks({ cargos, blocks, onChange }: { cargos: Cargo[]; blocks: CargoTextBlock[]; onChange(blocks: CargoTextBlock[]): void }): ReactElement`

- [ ] **Step 1: Escrever os testes que falham**

Crie `artifacts/kalibra/src/components/EditalSourceBlocks.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditalSourceBlocks } from './EditalSourceBlocks';

const CARGOS = [
  { id: 'c1', name: 'Analista', examDate: '2026-06-01' },
  { id: 'c2', name: 'Técnico', examDate: '2026-06-01' },
];

describe('EditalSourceBlocks', () => {
  it('mostra uma aba para o conteúdo comum e uma para cada cargo', () => {
    render(<EditalSourceBlocks cargos={CARGOS} blocks={[]} onChange={() => {}} />);
    expect(screen.getByTestId('bloco-aba-comum')).toBeInTheDocument();
    expect(screen.getByTestId('bloco-aba-c1')).toHaveTextContent('Analista');
    expect(screen.getByTestId('bloco-aba-c2')).toHaveTextContent('Técnico');
  });

  it('começa no bloco comum', () => {
    render(<EditalSourceBlocks cargos={CARGOS} blocks={[]} onChange={() => {}} />);
    expect(screen.getByTestId('bloco-textarea')).toHaveAttribute('data-cargo', 'comum');
  });

  it('digitar no bloco comum emite um bloco com cargoId null', () => {
    const onChange = vi.fn();
    render(<EditalSourceBlocks cargos={CARGOS} blocks={[]} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('bloco-textarea'), { target: { value: 'PORTUGUÊS' } });
    expect(onChange).toHaveBeenCalledWith([{ cargoId: null, text: 'PORTUGUÊS' }]);
  });

  it('digitar no bloco de um cargo NÃO altera o texto dos outros blocos', () => {
    const onChange = vi.fn();
    render(
      <EditalSourceBlocks
        cargos={CARGOS}
        blocks={[{ cargoId: null, text: 'COMUM' }, { cargoId: 'c1', text: 'DO ANALISTA' }]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId('bloco-aba-c2'));
    fireEvent.change(screen.getByTestId('bloco-textarea'), { target: { value: 'DO TÉCNICO' } });

    expect(onChange).toHaveBeenCalledWith([
      { cargoId: null, text: 'COMUM' },
      { cargoId: 'c1', text: 'DO ANALISTA' },
      { cargoId: 'c2', text: 'DO TÉCNICO' },
    ]);
  });

  it('trocar de aba mostra o texto daquele bloco', () => {
    render(
      <EditalSourceBlocks
        cargos={CARGOS}
        blocks={[{ cargoId: null, text: 'COMUM' }, { cargoId: 'c1', text: 'DO ANALISTA' }]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByTestId('bloco-textarea')).toHaveValue('COMUM');
    fireEvent.click(screen.getByTestId('bloco-aba-c1'));
    expect(screen.getByTestId('bloco-textarea')).toHaveValue('DO ANALISTA');
  });

  it('uma aba com conteúdo é marcada como preenchida', () => {
    render(
      <EditalSourceBlocks
        cargos={CARGOS}
        blocks={[{ cargoId: 'c1', text: 'DO ANALISTA' }]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByTestId('bloco-aba-c1')).toHaveAttribute('data-preenchido', 'true');
    expect(screen.getByTestId('bloco-aba-c2')).toHaveAttribute('data-preenchido', 'false');
  });

  it('com um cargo só, a distinção comum/específico não faz sentido e as abas somem', () => {
    render(<EditalSourceBlocks cargos={[CARGOS[0]]} blocks={[]} onChange={() => {}} />);
    expect(screen.queryByTestId('bloco-aba-comum')).not.toBeInTheDocument();
    expect(screen.getByTestId('bloco-textarea')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd artifacts/kalibra && npx vitest run src/components/EditalSourceBlocks.test.tsx`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar o componente**

Crie `artifacts/kalibra/src/components/EditalSourceBlocks.tsx`:

```tsx
import { useState, type ReactElement } from 'react';
import type { CargoTextBlock } from '@workspace/core';
import type { Cargo } from '@/domain/useWorkspaces';

const ABA_ATIVA = 'bg-white dark:bg-[#202b20] text-[#16232b] dark:text-[#d5f35b] shadow-sm border border-[#d5dede] dark:border-[#35404e]';
const ABA_INATIVA = 'text-[#6f7b85] dark:text-[#8e98a8] hover:text-[#16232b] dark:hover:text-[#f0f0e8]';

function textOf(blocks: readonly CargoTextBlock[], cargoId: string | null): string {
  return blocks.find((block) => block.cargoId === cargoId)?.text ?? '';
}

/**
 * A entrada de texto do edital, dividida por cargo. `cargoId: null` é o bloco comum a
 * todos os cargos — a forma como os editais são de fato publicados (conhecimentos
 * básicos uma vez só, específicos por cargo).
 *
 * Antes desta fase havia um textarea único aplicado a todos os cargos, então todo
 * tópico nascia comum e a deduplicação multi-cargo nunca tinha o que distinguir.
 *
 * Com um cargo só a distinção não existe: as abas somem e sobra o textarea, que é
 * exatamente a tela anterior — nenhum usuário de workspace simples paga por isto.
 */
export function EditalSourceBlocks({
  cargos,
  blocks,
  onChange,
}: {
  cargos: Cargo[];
  blocks: CargoTextBlock[];
  onChange(blocks: CargoTextBlock[]): void;
}): ReactElement {
  const [aba, setAba] = useState<string | null>(null);
  const multiplos = cargos.length > 1;
  const ativo = multiplos ? aba : null;

  const handleChange = (text: string) => {
    const outros = blocks.filter((block) => block.cargoId !== ativo);
    const proximo = [...outros, { cargoId: ativo, text }];
    // Ordem estável: o comum primeiro, depois os cargos na ordem do workspace. Sem
    // isto a lista se reordenaria a cada digitação e o diff de persistência ficaria
    // ruidoso sem nada ter mudado de fato.
    const ordem = [null, ...cargos.map((cargo) => cargo.id)];
    onChange(proximo.slice().sort((a, b) => ordem.indexOf(a.cargoId) - ordem.indexOf(b.cargoId)));
  };

  const preenchido = (cargoId: string | null) => textOf(blocks, cargoId).trim() !== '';

  return (
    <div className="mb-6">
      {multiplos && (
        <>
          <div className="mb-2 flex flex-wrap gap-1 rounded-[4px] border border-[#dfe6e4] bg-[#f1f4f2] p-1 dark:border-[#242a34] dark:bg-[#0b0e13]">
            <button
              type="button"
              onClick={() => setAba(null)}
              className={`flex justify-center rounded-[3px] px-3 py-2 text-[12px] font-medium transition-colors ${ativo === null ? ABA_ATIVA : ABA_INATIVA}`}
              data-testid="bloco-aba-comum"
              data-preenchido={preenchido(null)}
            >
              Comum a todos
              {preenchido(null) && <span className="ml-2 text-[#6b8d00] dark:text-[#8ed9ae]">•</span>}
            </button>
            {cargos.map((cargo) => (
              <button
                key={cargo.id}
                type="button"
                onClick={() => setAba(cargo.id)}
                className={`flex justify-center rounded-[3px] px-3 py-2 text-[12px] font-medium transition-colors ${ativo === cargo.id ? ABA_ATIVA : ABA_INATIVA}`}
                data-testid={`bloco-aba-${cargo.id}`}
                data-preenchido={preenchido(cargo.id)}
              >
                {cargo.name || cargo.id}
                {preenchido(cargo.id) && <span className="ml-2 text-[#6b8d00] dark:text-[#8ed9ae]">•</span>}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[11px] text-[#6f7b85] dark:text-[#8e98a8]">
            {ativo === null
              ? 'Conteúdo cobrado de todos os cargos. Entra uma vez e vale para todos.'
              : `Conteúdo cobrado só de ${cargos.find((cargo) => cargo.id === ativo)?.name || ativo}.`}
          </p>
        </>
      )}
      <textarea
        className="k-input min-h-[150px] resize-y text-[12px]"
        placeholder={ativo === null ? 'Cole aqui o conteúdo programático...' : 'Cole aqui o conteúdo específico deste cargo...'}
        value={textOf(blocks, ativo)}
        onChange={(event) => handleChange(event.target.value)}
        data-testid="bloco-textarea"
        data-cargo={ativo ?? 'comum'}
      />
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd artifacts/kalibra && npx vitest run src/components/EditalSourceBlocks.test.tsx`
Expected: PASS, todos.

- [ ] **Step 5: Provar que o teste de não-contaminação não é decorativo**

Em `handleChange`, troque `blocks.filter((block) => block.cargoId !== ativo)` por `[]`. O teste "digitar no bloco de um cargo NÃO altera o texto dos outros blocos" tem que ficar **vermelho**. Desfaça.

- [ ] **Step 6: Commit**

```bash
git add artifacts/kalibra/src/components/EditalSourceBlocks.tsx artifacts/kalibra/src/components/EditalSourceBlocks.test.tsx
git commit -m "feat: componente de blocos de edital por cargo"
```

---

### Task 5: persistir os blocos e migrar o `sourceText` antigo

`sourceText?: string` é campo persistido de `WorkspaceDraft` (`workspaces.ts:48`). Trocá-lo por blocos exige migração: todo workspace já salvo no navegador do usuário tem `sourceText` e nenhum tem `sourceBlocks`. Um texto antigo era, por construção, comum a todos os cargos — então migra para exatamente um bloco comum.

A migração segue a disciplina que a Fase 1A fixou depois de um defeito que destruía todos os workspaces: **total** (todo valor de entrada produz uma saída válida), **idempotente** (migrar duas vezes dá o mesmo resultado), e nunca lança.

**Files:**
- Modify: `artifacts/kalibra/src/domain/adapters/local/workspaces.ts` (tipo `WorkspaceDraft`, função `migrateWorkspace`)
- Test: `artifacts/kalibra/src/domain/adapters/local/workspaces.test.ts` (já existe)

**Interfaces:**
- Consumes: `CargoTextBlock` de `@workspace/core` (Task 1).
- Produces: `WorkspaceDraft.sourceBlocks: CargoTextBlock[]` — campo novo, **obrigatório** no tipo (a migração sempre produz um array, nunca `undefined`, para nenhum leitor precisar checar). `sourceText` **permanece** no tipo para não quebrar leitura de registro antigo.

- [ ] **Step 1: Escrever os testes que falham**

Acrescente ao final de `artifacts/kalibra/src/domain/adapters/local/workspaces.test.ts`, seguindo o padrão de montagem de `localStorage` que os testes de migração já usam nesse arquivo:

```ts
describe('migração de sourceText para sourceBlocks (Fase 1B.5)', () => {
  it('um registro antigo com sourceText vira um bloco comum', () => {
    localStorage.setItem('kalibra_workspaces', JSON.stringify([{
      slug: 'antigo', title: 'Antigo', cargos: [{ id: 'c1', name: 'Analista', examDate: '2026-06-01' }],
      sourceMode: 'text', sourceText: 'LÍNGUA PORTUGUESA', importStatus: 'pending',
    }]));

    const [workspace] = getWorkspaces();
    expect(workspace.sourceBlocks).toEqual([{ cargoId: null, text: 'LÍNGUA PORTUGUESA' }]);
  });

  it('um registro sem sourceText nenhum não inventa bloco', () => {
    localStorage.setItem('kalibra_workspaces', JSON.stringify([{
      slug: 'antigo', title: 'Antigo', cargos: [{ id: 'c1', name: 'Analista', examDate: '2026-06-01' }],
      sourceMode: 'file', importStatus: 'pending',
    }]));

    expect(getWorkspaces()[0].sourceBlocks).toEqual([]);
  });

  it('um registro que JÁ tem sourceBlocks é preservado como está', () => {
    localStorage.setItem('kalibra_workspaces', JSON.stringify([{
      slug: 'novo', title: 'Novo', cargos: [{ id: 'c1', name: 'Analista', examDate: '2026-06-01' }],
      sourceMode: 'text', sourceText: 'IGNORAR ESTE',
      sourceBlocks: [{ cargoId: null, text: 'COMUM' }, { cargoId: 'c1', text: 'ESPECÍFICO' }],
      importStatus: 'pending',
    }]));

    expect(getWorkspaces()[0].sourceBlocks).toEqual([
      { cargoId: null, text: 'COMUM' },
      { cargoId: 'c1', text: 'ESPECÍFICO' },
    ]);
  });

  it('sourceBlocks com formato inválido não derruba o registro inteiro', () => {
    localStorage.setItem('kalibra_workspaces', JSON.stringify([{
      slug: 'quebrado', title: 'Quebrado', cargos: [{ id: 'c1', name: 'Analista', examDate: '2026-06-01' }],
      sourceMode: 'text', sourceBlocks: [null, { cargoId: 5, text: 'x' }, 'lixo'],
      importStatus: 'pending',
    }]));

    const workspaces = getWorkspaces();
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0].slug).toBe('quebrado');
    expect(workspaces[0].sourceBlocks).toEqual([]);
  });

  it('migrar é idempotente: o resultado de duas leituras é igual', () => {
    localStorage.setItem('kalibra_workspaces', JSON.stringify([{
      slug: 'antigo', title: 'Antigo', cargos: [{ id: 'c1', name: 'Analista', examDate: '2026-06-01' }],
      sourceMode: 'text', sourceText: 'LÍNGUA PORTUGUESA', importStatus: 'pending',
    }]));

    const primeira = getWorkspaces();
    localStorage.setItem('kalibra_workspaces', JSON.stringify(primeira));
    expect(getWorkspaces()).toEqual(primeira);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd artifacts/kalibra && npx vitest run src/domain/adapters/local/workspaces.test.ts`
Expected: FAIL — `sourceBlocks` não existe em `WorkspaceDraft`.

- [ ] **Step 3: Acrescentar o campo ao tipo**

Em `workspaces.ts`, acrescente `type CargoTextBlock` ao import de `'@workspace/core'` e acrescente o campo logo após `sourceText`:

```ts
  sourceText?: string;
  /**
   * Blocos do edital por cargo (Fase 1B.5). `sourceText` continua no tipo porque
   * registros antigos gravados no navegador do usuário ainda o têm — `migrateWorkspace`
   * converte um em outro na leitura. Escrita nova sempre usa `sourceBlocks`.
   */
  sourceBlocks: CargoTextBlock[];
```

- [ ] **Step 4: Escrever o validador e a migração**

Acrescente perto das outras funções de validação de `workspaces.ts`:

```ts
function isValidBlock(value: unknown): value is CargoTextBlock {
  if (typeof value !== 'object' || value === null) return false;
  const block = value as Record<string, unknown>;
  const cargoOk = block.cargoId === null || typeof block.cargoId === 'string';
  return cargoOk && typeof block.text === 'string';
}

/**
 * Blocos do edital a partir de um registro cru. Migração total e idempotente:
 * - já tem `sourceBlocks` válidos → preserva (só os elementos válidos);
 * - só tem `sourceText` → vira UM bloco comum, que é o que aquele texto de fato era:
 *   um conteúdo aplicado a todos os cargos;
 * - não tem nada → lista vazia.
 *
 * Um elemento inválido é descartado sozinho, sem derrubar o registro: a Fase 1A
 * aprendeu isso da pior forma, quando um `cargos: [null]` fazia `.map` abortar o array
 * inteiro e o fallback devolvia dados de demonstração no lugar do histórico real.
 */
function blocksFrom(raw: Record<string, unknown>): CargoTextBlock[] {
  if (Array.isArray(raw.sourceBlocks)) {
    return raw.sourceBlocks.filter(isValidBlock).map((block) => ({ cargoId: block.cargoId, text: block.text }));
  }
  const legacy = str(raw.sourceText, undefined);
  return legacy ? [{ cargoId: null, text: legacy }] : [];
}
```

E no objeto devolvido por `migrateWorkspace`, logo após a linha `sourceText: str(raw.sourceText, undefined),`:

```ts
    sourceBlocks: blocksFrom(raw),
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd artifacts/kalibra && npx vitest run src/domain/adapters/local/workspaces.test.ts`
Expected: PASS, todos. Ajuste os fixtures dos testes já existentes desse arquivo apenas se o typecheck exigir `sourceBlocks`.

- [ ] **Step 6: Provar que a migração não é decorativa**

Em `blocksFrom`, troque o retorno do ramo legado por `return [];`. O teste "um registro antigo com sourceText vira um bloco comum" tem que ficar **vermelho**. Desfaça.

- [ ] **Step 7: Commit**

```bash
git add artifacts/kalibra/src/domain/adapters/local/workspaces.ts artifacts/kalibra/src/domain/adapters/local/workspaces.test.ts
git commit -m "feat: persistir blocos do edital e migrar sourceText antigo"
```

---

### Task 6: ligar os blocos nas duas telas de importação

As duas telas que hoje têm um textarea passam a usar `EditalSourceBlocks`. O modo "Arquivo" e o modo "sem edital" não mudam em nada.

**Files:**
- Modify: `artifacts/kalibra/src/pages/NovoWorkspace.tsx` (estado `sourceText`, validação do submit, chamada de `extraction.start`, o `textarea` em ~L380)
- Modify: `artifacts/kalibra/src/pages/Edital.tsx` (estado `sourceText`, `saveEditalUpdate`, chamada de `extraction.start`, o `textarea` em L306)
- Test: `artifacts/kalibra/src/pages/NovoWorkspace.test.tsx` e `artifacts/kalibra/src/pages/Edital.test.tsx` (já existem)

**Interfaces:**
- Consumes: `EditalSourceBlocks` (Task 4); `ExtractionInput.blocks` (Task 3); `WorkspaceDraft.sourceBlocks` (Task 5).
- Produces: nada para tasks seguintes.

- [ ] **Step 1: Escrever os testes que falham**

Acrescente a `artifacts/kalibra/src/pages/NovoWorkspace.test.tsx`, seguindo o padrão de render com rota que o arquivo já usa:

```tsx
it('com dois cargos, a criação oferece blocos comum e por cargo', async () => {
  renderNovoWorkspace();
  // preencha título, os dois cargos e escolha o modo Texto com os mesmos
  // auxiliares que os testes vizinhos deste arquivo já usam.
  expect(screen.getByTestId('bloco-aba-comum')).toBeInTheDocument();
  expect(screen.getByTestId('bloco-aba-c2')).toBeInTheDocument();
});
```

E a `artifacts/kalibra/src/pages/Edital.test.tsx`:

```tsx
it('a reimportação oferece blocos por cargo quando o workspace tem mais de um', async () => {
  renderEdital();
  fireEvent.click(screen.getByTestId('button-atualizar-edital'));
  fireEvent.click(screen.getByText('Texto'));
  expect(screen.getByTestId('bloco-aba-comum')).toBeInTheDocument();
});
```

Os `data-testid` dos botões e auxiliares de render são os que cada arquivo já usa — leia o arquivo antes e reuse; não invente identificadores novos.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd artifacts/kalibra && npx vitest run src/pages/NovoWorkspace.test.tsx src/pages/Edital.test.tsx`
Expected: FAIL — `bloco-aba-comum` não encontrado.

- [ ] **Step 3: Trocar o estado nas duas telas**

Em cada tela, substitua `const [sourceText, setSourceText] = useState('')` por:

```tsx
  const [sourceBlocks, setSourceBlocks] = useState<CargoTextBlock[]>([]);
```

Acrescente `type CargoTextBlock` ao import de `'@workspace/core'` e `EditalSourceBlocks` ao import de componentes.

- [ ] **Step 4: Trocar o textarea pelo componente**

Em `Edital.tsx`, substitua o `<textarea className="k-input min-h-[150px] mb-6 ...">` (L306) por:

```tsx
                <EditalSourceBlocks cargos={workspace?.cargos ?? []} blocks={sourceBlocks} onChange={setSourceBlocks} />
```

Em `NovoWorkspace.tsx`, substitua o `<textarea>` do ramo `sourceMode === 'text'` (~L380) por:

```tsx
                <EditalSourceBlocks cargos={cargos} blocks={sourceBlocks} onChange={setSourceBlocks} />
```

onde `cargos` é a lista de cargos que o formulário já mantém em estado.

- [ ] **Step 5: Atualizar validação, persistência e a chamada de extração**

Em ambas as telas, a validação "texto vazio" passa a olhar os blocos:

```tsx
    if (sourceMode === 'text' && sourceBlocks.every((block) => block.text.trim() === '')) {
```

A persistência do rascunho troca `sourceText` por `sourceBlocks`:

```tsx
      sourceBlocks: sourceMode === 'text' ? sourceBlocks : [],
```

E a chamada de extração passa blocos:

```tsx
      sourceMode: sourceMode === 'text' ? 'text' : 'file',
      blocks: sourceMode === 'text' ? sourceBlocks : [],
      cargoIds: ...,   // mantenha a expressão que cada tela já usa
```

Em `Edital.tsx` a expressão existente é `workspace?.cargos.map((cargo) => cargo.id) ?? []`; em `NovoWorkspace.tsx` é `finalCargos.map((cargo) => cargo.id)`. Não troque uma pela outra.

- [ ] **Step 6: Rodar as duas suítes e ver passar**

Run: `cd artifacts/kalibra && npx vitest run src/pages/NovoWorkspace.test.tsx src/pages/Edital.test.tsx`
Expected: PASS, todos.

- [ ] **Step 7: Conferir os snapshots**

Run: `cd artifacts/kalibra && npx vitest run`
Se algum snapshot mudar, **leia o diff antes de aceitar**, descreva em uma frase o que mudou e só então rode com `-u`. Depois rode outra vez e confirme `0 snapshots written`. Um snapshot que muda mais do que a substituição do textarea pelo bloco é sinal de que algo saiu do lugar.

- [ ] **Step 8: Commit**

```bash
git add artifacts/kalibra/src/pages/NovoWorkspace.tsx artifacts/kalibra/src/pages/Edital.tsx artifacts/kalibra/src/pages/NovoWorkspace.test.tsx artifacts/kalibra/src/pages/Edital.test.tsx artifacts/kalibra/src/__tests__
git commit -m "feat: as telas de importacao usam blocos por cargo"
```

---

### Task 7: revisar vínculos na árvore — "Aplicar a \<cargo\>" e o que é comum vs. específico

O menu do item hoje só desliga (`Separar de <cargo>`). Esta task acrescenta a direção que falta e torna visível, na própria linha, se um item é comum ou específico — hoje um item de um cargo só não tem marca nenhuma, e o usuário não tem como saber sem trocar o filtro.

**Files:**
- Modify: `artifacts/kalibra/src/components/SyllabusTree.tsx`
- Modify: `artifacts/kalibra/src/domain/adapters/local/syllabus.ts`
- Modify: `artifacts/kalibra/src/pages/EditalRevisar.tsx`
- Test: `artifacts/kalibra/src/components/SyllabusTree.test.tsx`, `artifacts/kalibra/src/domain/adapters/local/syllabus.test.ts`

**Interfaces:**
- Consumes: `linkItemToCargo` de `@workspace/core` (Task 2).
- Produces:
  - `SyllabusTree` ganha a prop `onLinkToCargo(itemId: string, cargoId: string): void`
  - `useSyllabus(...).linkToCargo(itemId: string, cargoId: string): void`

- [ ] **Step 1: Escrever os testes que falham**

Em `artifacts/kalibra/src/components/SyllabusTree.test.tsx`, acrescente (reusando o helper de render que o arquivo já tem):

```tsx
describe('vínculos por cargo (Fase 1B.5)', () => {
  it('o menu de um item específico oferece aplicar aos cargos que faltam', () => {
    // item i1 ligado só a c1, workspace com c1 e c2
    renderTree({ cargoId: null });
    fireEvent.click(screen.getByLabelText('Ações para Português'));
    expect(screen.getByTestId('button-link-i1-c2')).toHaveTextContent('Aplicar a Técnico');
  });

  it('não oferece aplicar a um cargo ao qual o item JÁ está ligado', () => {
    renderTree({ cargoId: null });
    fireEvent.click(screen.getByLabelText('Ações para Português'));
    expect(screen.queryByTestId('button-link-i1-c1')).not.toBeInTheDocument();
  });

  it('clicar em aplicar chama onLinkToCargo com o item e o cargo', () => {
    const onLinkToCargo = vi.fn();
    renderTree({ cargoId: null, onLinkToCargo });
    fireEvent.click(screen.getByLabelText('Ações para Português'));
    fireEvent.click(screen.getByTestId('button-link-i1-c2'));
    expect(onLinkToCargo).toHaveBeenCalledWith('i1', 'c2');
  });

  it('um item ligado a todos os cargos é marcado como comum a todos', () => {
    renderTree({ cargoId: null });
    expect(screen.getByTestId('chip-common-i2')).toHaveTextContent('comum a todos');
  });

  it('um item ligado a um cargo só é marcado com o nome daquele cargo', () => {
    renderTree({ cargoId: null });
    expect(screen.getByTestId('chip-escopo-i1')).toHaveTextContent('só Analista');
  });
});
```

Em `artifacts/kalibra/src/domain/adapters/local/syllabus.test.ts`:

```ts
it('linkToCargo liga o item ao cargo sem tocar nas ligações existentes', () => {
  const { result } = renderHook(() => useSyllabus('w'));
  act(() => { result.current.addItem(null, 'Português', ['c1']); });
  const itemId = result.current.syllabus.items[0].id;
  act(() => { result.current.updateLink(itemId, 'c1', { weight: 30 }); });
  act(() => { result.current.linkToCargo(itemId, 'c2'); });

  const links = result.current.syllabus.links.filter((link) => link.syllabusItemId === itemId);
  expect(links).toHaveLength(2);
  expect(links.find((link) => link.cargoId === 'c1')?.weight).toBe(30);
  expect(links.find((link) => link.cargoId === 'c2')?.weight).toBeNull();
  expect(result.current.syllabus.items).toHaveLength(1);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd artifacts/kalibra && npx vitest run src/components/SyllabusTree.test.tsx src/domain/adapters/local/syllabus.test.ts`
Expected: FAIL — `onLinkToCargo` e `linkToCargo` não existem.

- [ ] **Step 3: Acrescentar a prop e o item de menu no `SyllabusTree`**

Acrescente `onLinkToCargo(itemId: string, cargoId: string): void` à assinatura de props. Dentro de `renderMenu`, logo após o bloco que gera os botões "Separar de", acrescente:

```tsx
        {cargos
          .filter((cargo) => !cargosFor(syllabus, item.id).includes(cargo.id))
          .map((cargo) => (
            <button
              key={cargo.id}
              className="k-button k-button-quiet justify-start text-[10px]"
              onClick={() => { onLinkToCargo(item.id, cargo.id); setOpenMenu(null); }}
              data-testid={`button-link-${item.id}-${cargo.id}`}
            >
              Aplicar a {cargoName(cargo.id)}
            </button>
          ))}
```

- [ ] **Step 4: Tornar visível o que é comum e o que é específico**

Em `renderRow`, substitua a linha do chip (`{common && <span className="k-chip" ...>{itemCargos.length} cargos</span>}`) por:

```tsx
          {common && (
            <span className="k-chip" data-testid={`chip-common-${item.id}`}>
              {itemCargos.length === cargos.length && cargos.length > 0 ? 'comum a todos' : `${itemCargos.length} cargos`}
            </span>
          )}
          {!common && cargos.length > 1 && itemCargos.length === 1 && (
            <span className="k-chip" data-testid={`chip-escopo-${item.id}`}>só {cargoName(itemCargos[0])}</span>
          )}
```

O segundo chip é a parte que faltava: hoje um item específico não tem marca nenhuma, então "comum" e "específico" são indistinguíveis na lista consolidada.

- [ ] **Step 5: Acrescentar `linkToCargo` ao hook de domínio**

Em `artifacts/kalibra/src/domain/adapters/local/syllabus.ts`, acrescente `linkItemToCargo` ao import de `'@workspace/core'` e, junto de `splitFromCargo`:

```ts
  const linkToCargo = (itemId: string, cargoId: string) => {
    persist(linkItemToCargo(syllabusRef.current, itemId, cargoId));
  };
```

Acrescente `linkToCargo` ao objeto devolvido pelo hook.

- [ ] **Step 6: Ligar na tela de revisão**

Em `EditalRevisar.tsx`, acrescente o handler junto de `handleSplit`, cobrindo os **dois** caminhos — a proposta em revisão e o programa já persistido. Este é o ponto onde a Fase 1B errou repetidamente: implementar só um dos dois deixa a função sem chamador real em metade dos casos.

```tsx
  const handleLinkToCargo = (itemId: string, cargoId: string) => {
    if (review) {
      setReviewState((current) => (current && {
        ...current,
        review: { ...current.review, syllabus: linkItemToCargo(current.review.syllabus, itemId, cargoId) },
      }));
    } else {
      syllabusApi.linkToCargo(itemId, cargoId);
    }
  };
```

Acrescente `linkItemToCargo` ao import de `'@workspace/core'` e passe `onLinkToCargo={handleLinkToCargo}` ao `<SyllabusTree>`.

- [ ] **Step 7: Rodar e ver passar**

Run: `cd artifacts/kalibra && npx vitest run`
Expected: PASS. Snapshots que mudarem: leia o diff, descreva, `-u`, confirme `0 written`.

- [ ] **Step 8: Provar que o filtro do menu não é decorativo**

Remova o `.filter(...)` do Step 3. O teste "não oferece aplicar a um cargo ao qual o item JÁ está ligado" tem que ficar **vermelho**. Desfaça.

- [ ] **Step 9: Commit**

```bash
git add artifacts/kalibra/src/components/SyllabusTree.tsx artifacts/kalibra/src/components/SyllabusTree.test.tsx artifacts/kalibra/src/domain/adapters/local/syllabus.ts artifacts/kalibra/src/domain/adapters/local/syllabus.test.ts artifacts/kalibra/src/pages/EditalRevisar.tsx artifacts/kalibra/src/__tests__
git commit -m "feat: aplicar item a um cargo e distinguir comum de especifico na arvore"
```

---

### Task 8: os testes de aceite ponta a ponta, e a verificação

As tasks anteriores testaram cada peça. Esta prova as afirmações que o usuário pediu, atravessando o fluxo inteiro — importar com blocos, revisar, confirmar — porque foi exatamente em junções entre peças corretas que a Fase 1B acumulou defeitos.

**Files:**
- Test: `artifacts/kalibra/src/pages/EditalRevisar.test.tsx` (acrescentar um `describe`)
- Test: `lib/core/src/workspace/status.test.ts` (acrescentar um teste)
- Create: `docs/superpowers/plans/2026-09-14-kalibra-fase-1b5-verificacao.md`

**Interfaces:**
- Consumes: tudo das Tasks 1–7.
- Produces: nada.

- [ ] **Step 1: Escrever os testes de aceite**

Estes testes montam um workspace com **dois** cargos e uma extração que já tem a forma que a Fase 1B.5 produz: um item comum aos dois cargos (veio do bloco comum) e um item só do segundo (veio do bloco específico). Acrescente os dois auxiliares junto dos que o arquivo já tem, no topo do arquivo:

```tsx
function seedWorkspaceDoisCargos(status: WorkspaceStatus = 'aguardando_revisao_edital') {
  window.localStorage.setItem(WORKSPACES_KEY, JSON.stringify([{
    slug: 'setec-campinas',
    title: 'Concurso SETEC Campinas',
    institution: 'SETEC',
    type: 'Concurso Público',
    examDate: '2027-01-17',
    cargos: [
      { id: 'c1', name: 'Analista', examDate: '2027-01-17', period: 'A' },
      { id: 'c2', name: 'Técnico', examDate: '2027-01-17', period: 'A' },
    ],
    selectedCargoId: 'c1',
    availability: { days: [], maxSessionMinutes: 50 },
    status,
    sourceMode: 'text',
    sourceBlocks: [],
    importStatus: 'completed',
    progress: 0,
    nextAction: 'texto qualquer',
    active: true,
  }]));
}

/**
 * A saída que blocos por cargo produzem: "LÍNGUA PORTUGUESA" veio do bloco comum
 * (uma entrada por cargo, que `dedupeEntries` une num item com duas ligações) e
 * "INFORMÁTICA" veio do bloco específico do c2 (uma entrada só).
 */
function seedImportDoisCargos() {
  stageWorkspaceImport('setec-campinas', {
    isNew: false,
    updates: {},
    extractionOutput: {
      entries: [
        entrada({ cargoId: 'c1', label: 'LÍNGUA PORTUGUESA' }),
        entrada({ cargoId: 'c2', label: 'LÍNGUA PORTUGUESA' }),
        entrada({ cargoId: 'c2', label: 'INFORMÁTICA' }),
      ],
      detectedCargos: ['c1', 'c2'],
      examFormat: null,
      examDurationMinutes: null,
      uncertainties: [],
    },
  }, TEST_USER.id);
}

/** A linha da árvore que contém aquele rótulo — os ids de item são gerados. */
function rowOf(label: string): HTMLElement {
  return screen.getByText(label).closest('[data-testid^="row-syllabus-item-"]') as HTMLElement;
}

function itemIdOf(label: string): string {
  return rowOf(label).getAttribute('data-testid')!.replace('row-syllabus-item-', '');
}
```

E o bloco de testes:

```tsx
describe('critérios de aceite da Fase 1B.5', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(CONCEPTS_KEY, JSON.stringify([]));
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital/revisar/1');
    seedWorkspaceDoisCargos();
    seedImportDoisCargos();
  });

  afterEach(() => { cleanup(); });

  const renderApp = async () => {
    const { default: App } = await import('../App');
    return render(<App />);
  };

  it('conteúdo específico de um cargo não aparece no outro cargo', async () => {
    await renderApp();

    fireEvent.click(screen.getByTestId('cargo-filter-c1'));
    expect(screen.queryByText('INFORMÁTICA')).not.toBeInTheDocument();
    expect(screen.getByText('LÍNGUA PORTUGUESA')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cargo-filter-c2'));
    expect(screen.getByText('INFORMÁTICA')).toBeInTheDocument();
  });

  it('conteúdo comum aparece UMA vez, marcado como comum a todos', async () => {
    await renderApp();

    expect(screen.getAllByText('LÍNGUA PORTUGUESA')).toHaveLength(1);
    expect(screen.getByTestId(`chip-common-${itemIdOf('LÍNGUA PORTUGUESA')}`)).toHaveTextContent('comum a todos');
  });

  it('conteúdo específico é marcado com o nome do cargo, não fica sem marca', async () => {
    await renderApp();
    expect(screen.getByTestId(`chip-escopo-${itemIdOf('INFORMÁTICA')}`)).toHaveTextContent('só Técnico');
  });

  it('editar o peso de um cargo não altera o peso do outro', async () => {
    await renderApp();
    const itemId = itemIdOf('LÍNGUA PORTUGUESA');

    fireEvent.click(screen.getByTestId('cargo-filter-c1'));
    fireEvent.change(screen.getByTestId(`input-peso-${itemId}`), { target: { value: '30' } });
    expect(screen.getByTestId(`input-peso-${itemId}`)).toHaveValue(30);

    fireEvent.click(screen.getByTestId('cargo-filter-c2'));
    expect(screen.getByTestId(`input-peso-${itemId}`)).toHaveValue(null);

    fireEvent.click(screen.getByTestId('cargo-filter-c1'));
    expect(screen.getByTestId(`input-peso-${itemId}`)).toHaveValue(30);
  });

  it('aplicar um item a outro cargo não altera o peso já informado no primeiro', async () => {
    await renderApp();
    const itemId = itemIdOf('INFORMÁTICA');

    fireEvent.click(screen.getByTestId('cargo-filter-c2'));
    fireEvent.change(screen.getByTestId(`input-peso-${itemId}`), { target: { value: '40' } });

    fireEvent.click(screen.getByTestId('cargo-filter-todos'));
    fireEvent.click(within(rowOf('INFORMÁTICA')).getByLabelText('Ações para INFORMÁTICA'));
    fireEvent.click(screen.getByTestId(`button-link-${itemId}-c1`));

    fireEvent.click(screen.getByTestId('cargo-filter-c2'));
    expect(screen.getByTestId(`input-peso-${itemId}`)).toHaveValue(40);

    fireEvent.click(screen.getByTestId('cargo-filter-c1'));
    expect(screen.getByTestId(`input-peso-${itemId}`)).toHaveValue(null);
  });

  it('separar um item de um cargo não remove o conteúdo do outro cargo', async () => {
    await renderApp();
    const itemId = itemIdOf('LÍNGUA PORTUGUESA');

    fireEvent.click(within(rowOf('LÍNGUA PORTUGUESA')).getByLabelText('Ações para LÍNGUA PORTUGUESA'));
    fireEvent.click(screen.getByTestId(`button-split-${itemId}-c2`));

    fireEvent.click(screen.getByTestId('cargo-filter-c1'));
    expect(screen.getByText('LÍNGUA PORTUGUESA')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cargo-filter-c2'));
    expect(screen.getByText('LÍNGUA PORTUGUESA')).toBeInTheDocument();
  });

  it('confirmar grava a topologia revisada: um item comum com duas ligações, um item só do c2', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('Confirmar estrutura'));

    const syllabus = JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!);
    const idComum = syllabus.items.find((item: { sourceLabel: string }) => item.sourceLabel === 'LÍNGUA PORTUGUESA').id;
    const idEspecifico = syllabus.items.find((item: { sourceLabel: string }) => item.sourceLabel === 'INFORMÁTICA').id;

    expect(syllabus.links.filter((link: { syllabusItemId: string }) => link.syllabusItemId === idComum)
      .map((link: { cargoId: string }) => link.cargoId).sort()).toEqual(['c1', 'c2']);
    expect(syllabus.links.filter((link: { syllabusItemId: string }) => link.syllabusItemId === idEspecifico)
      .map((link: { cargoId: string }) => link.cargoId)).toEqual(['c2']);
  });
});
```

Se `toHaveValue(null)` não corresponder ao comportamento de um `<input type="number">` vazio na versão de `@testing-library/jest-dom` do projeto, use `expect(input).toHaveValue(null)` ou `expect((input as HTMLInputElement).value).toBe('')` — confira qual o arquivo já usa para campos numéricos vazios e siga o mesmo.

Em `lib/core/src/workspace/status.test.ts`:

```ts
it('o diagnóstico só é alcançável a partir da revisão do edital', () => {
  // A garantia que a Fase 1C depende: nenhum caminho leva ao diagnóstico sem passar
  // pela revisão humana da estrutura extraída (§4.4, PD-06).
  expect(canTransition('aguardando_revisao_edital', 'diagnostico_pendente')).toBe(true);
  expect(canTransition('sem_edital', 'diagnostico_pendente')).toBe(false);
  expect(canTransition('aguardando_upload', 'diagnostico_pendente')).toBe(false);
  expect(canTransition('extraindo_edital', 'diagnostico_pendente')).toBe(false);
  expect(canTransition('erro', 'diagnostico_pendente')).toBe(false);
});
```

- [ ] **Step 2: Rodar e ver falhar ou passar**

Run: `cd artifacts/kalibra && npx vitest run src/pages/EditalRevisar.test.tsx` e `cd lib/core && npx vitest run src/workspace/status.test.ts`

Se algum teste de aceite falhar, **é defeito de produto, não do teste** — corrija a implementação das tasks anteriores, não o teste. O teste do diagnóstico deve passar de primeira: ele fixa uma propriedade que já existe.

- [ ] **Step 3: Rodar o portão completo**

```bash
pnpm run typecheck
pnpm run test
pnpm run build
```

Todos verdes. Anote as contagens de teste por pacote.

- [ ] **Step 4: Rodar a suíte nos três fusos**

```bash
TZ=UTC pnpm run test
TZ=America/Sao_Paulo pnpm run test
TZ=Pacific/Kiritimati pnpm run test
```

Mesmo resultado nos três, e `0 snapshots written`. No PowerShell use `$env:TZ='UTC'; pnpm run test`.

- [ ] **Step 5: Conferência visual manual nos dois temas**

Abra a aplicação, crie um workspace com dois cargos, e confira: as abas de bloco aparecem, o marcador de preenchido aparece, a árvore mostra "comum a todos" e "só \<cargo\>", e o menu oferece "Aplicar a \<cargo\>". Confira no **dark primeiro**, depois no light. Registre o que viu.

- [ ] **Step 6: Escrever o documento de verificação**

Crie `docs/superpowers/plans/2026-09-14-kalibra-fase-1b5-verificacao.md` com: contagem de testes por pacote antes e depois; saída dos três comandos do portão; confirmação das restrições globais (varredura de pureza em `lib/core`, ausência de storage nas telas, `index.css` intocado, React em `19.1.0`); o resultado nos três fusos; a conferência visual nos dois temas; e uma seção "Limites conhecidos" listando o que continua em aberto.

- [ ] **Step 7: Commit**

```bash
git add artifacts/kalibra/src/pages/EditalRevisar.test.tsx lib/core/src/workspace/status.test.ts docs/superpowers/plans/2026-09-14-kalibra-fase-1b5-verificacao.md
git commit -m "test: criterios de aceite da Fase 1B.5 e verificacao"
```

---

## Limites que esta fase NÃO resolve

Registrados de propósito, para ninguém tentar consertá-los no meio do caminho:

- **`dedupeEntries` continua quadrático e síncrono na tela.** Esta fase aumenta o volume de entradas reais (agora há conteúdo distinto por cargo), então o problema fica mais visível — mas resolvê-lo exige worker ou effect, que é mudança maior e própria.
- **`Dashboard` e `Shell` continuam lendo mock de `@/data`.**
- **Modo "Arquivo" continua bloco único.** O parser real é da Fase 4; UI de upload por cargo agora seria construir para dados falsos.
- **`concept_merge` continua deixando um conceito provisório órfão** na primeira aprovação de cada item.
- **`workspaceId` continua guardando slug.**
- **Não existe campo de "prioridade" no modelo.** O critério pedia "pesos, número de questões ou prioridade quando disponíveis": `weight` e `questionCount` existem por ligação e esta fase os cobre; prioridade não existe em `SyllabusItemCargo` e não é inventada aqui. Se for necessária, é decisão de modelo para uma fase própria — provavelmente derivada de peso × desempenho, na Fase 1C.

