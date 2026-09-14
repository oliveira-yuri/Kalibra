# Verificação final da Fase 1B.5 — Kalibra

Data: 2026-09-14
Branch: `fase-1b5-conteudo-por-cargo`
Escopo deste registro: Task 8 (os testes de aceite ponta a ponta que atravessam o fluxo
inteiro — importar com blocos, revisar, confirmar — e este documento). As Tasks 1–7 já têm
sua própria verificação implícita nas mensagens de commit; este documento não re-deriva o
que já foi decidido lá, só prova, com um teste por afirmação, que as sete peças que elas
construíram se encaixam corretamente quando usadas juntas.

## 1. Contagem de testes por pacote

```
$ pnpm run test
```

| Pacote | Antes da Task 8 | Depois da Task 8 |
|---|---|---|
| `lib/core` | 218 | **219** (+1) |
| `artifacts/kalibra` | 306 | **313** (+7) |
| **Total** | **524** | **532** (+8) |

Detalhe por arquivo, `lib/core` (11 arquivos, 219 testes):

| Arquivo | Testes |
|---|---|
| `syllabus/concept.test.ts` | 49 |
| `syllabus/dedup.test.ts` | 43 |
| `syllabus/syllabus.test.ts` | 24 |
| `workspace/status.test.ts` | 24 (+1 — o teste de aceite do diagnóstico) |
| `syllabus/extraction.test.ts` | 16 |
| `workspace/exam-dates.test.ts` | 13 |
| `fsrs/schedule.test.ts` | 12 |
| `workspace/availability.test.ts` | 12 |
| `syllabus/diff.test.ts` | 10 |
| `approval/approval.test.ts` | 8 |
| `workspace/slug.test.ts` | 8 |

Detalhe por arquivo, `artifacts/kalibra` (19 arquivos, 313 testes):

| Arquivo | Testes |
|---|---|
| `domain/adapters/local/workspaces.test.ts` | 59 |
| `pages/EditalRevisar.test.tsx` | 50 (+7 — o `describe` de aceite da Fase 1B.5) |
| `domain/adapters/local/approvals.test.ts` | 33 |
| `domain/adapters/local/syllabus.test.ts` | 23 |
| `__tests__/screens.snapshot.test.tsx` | 22 |
| `pages/Edital.test.tsx` | 17 |
| `domain/adapters/local/concepts.test.ts` | 16 |
| `components/SyllabusTree.test.tsx` | 16 |
| `domain/edital-structure-payload.test.ts` | 15 |
| `domain/adapters/local/extraction.test.ts` | 12 |
| `components/EditalUploadProgress.test.tsx` | 10 |
| `pages/NovoWorkspace.test.tsx` | 7 |
| `components/EditalSourceBlocks.test.tsx` | 7 |
| `pages/Aprovacoes.test.tsx` | 7 |
| `pages/EditalRevisar.derivacoes.test.tsx` | 5 |
| `components/AvailabilityFields.test.tsx` | 4 |
| `lib/date-utils.test.ts` | 4 |
| `components/SourceExcerpt.test.tsx` | 3 |
| `components/CargoFilter.test.tsx` | 3 |

`lib/core` continua puro: `grep -rln "localStorage\|window\.\|document\.\|fetch(" lib/core/src --include=*.ts` (excluindo `.test.ts`) não devolve arquivo nenhum. Esta task só acrescentou um teste a `status.test.ts` — nenhuma linha de produção em `lib/core` foi tocada.

## 2. Os dois testes de aceite pedidos pelo Step 2 do brief, isoladamente

```
$ cd artifacts/kalibra && npx vitest run src/pages/EditalRevisar.test.tsx
$ cd lib/core && npx vitest run src/workspace/status.test.ts
```

| Arquivo | Resultado |
|---|---|
| `lib/core/src/workspace/status.test.ts` (24 testes, incluindo o novo) | **passou de primeira** — fixa uma propriedade que já existia (só `aguardando_revisao_edital` tem aresta para `diagnostico_pendente`), como o brief previu. |
| `artifacts/kalibra/src/pages/EditalRevisar.test.tsx` (50 testes, incluindo os 7 novos) | **passou de primeira**, os 7 testes de aceite inclusos. |

**As sete afirmações de aceite, uma por `it`, todas verdes:**

1. "conteúdo específico de um cargo não aparece no outro cargo" — filtrar por c1 esconde
   INFORMÁTICA (só do c2); filtrar por c2 mostra INFORMÁTICA.
2. "conteúdo comum aparece UMA vez, marcado como comum a todos" — LÍNGUA PORTUGUESA (uma
   entrada por cargo, unida por `dedupeEntries`) aparece uma única vez na árvore sem filtro,
   com o chip `comum a todos` (não "2 cargos" — o texto que a Fase 1B.5 introduziu quando
   `itemCargos.length === cargos.length`).
3. "conteúdo específico é marcado com o nome do cargo, não fica sem marca" — INFORMÁTICA
   ganha o chip `chip-escopo-*` com o texto "só Técnico".
4. "editar o peso de um cargo não altera o peso do outro" — mudar o peso de LÍNGUA
   PORTUGUESA para 30 sob o filtro c1 não vaza para a visão do c2 (input vazio lá), e volta a
   30 ao reselecionar c1 — os pesos são por `SyllabusItemCargo` (por par item×cargo), não uma
   propriedade única do item.
5. "aplicar um item a outro cargo não altera o peso já informado no primeiro" — aplicar
   INFORMÁTICA (só do c2, peso 40 já informado) também ao c1 via "Aplicar a Analista" cria
   uma ligação nova com peso nulo para c1, sem tocar o peso 40 já salvo para c2.
6. "separar um item de um cargo não remove o conteúdo do outro cargo" — `splitItem` sobre
   LÍNGUA PORTUGUESA separando do c2 deixa o rótulo visível tanto filtrando por c1 (item
   original) quanto por c2 (cópia nova que o split cria).
7. "confirmar grava a topologia revisada: um item comum com duas ligações, um item só do
   c2" — depois de "Confirmar estrutura", o `Syllabus` persistido em `localStorage` tem
   exatamente essa topologia: `links` de LÍNGUA PORTUGUESA apontando para `['c1', 'c2']`
   (ordenado) e `links` de INFORMÁTICA apontando só para `['c2']`.

**Nenhum defeito de produto foi encontrado.** As sete afirmações do critério de aceite do
usuário se sustentaram na primeira execução, sem precisar ajustar `EditalRevisar.tsx`,
`SyllabusTree.tsx`, `CargoFilter.tsx` nem `lib/core` — Tasks 1–7 já tinham entregue o
comportamento certo; esta task só o provou atravessando o fluxo inteiro de uma vez.

### As traduções de asserção aplicadas (não há `@testing-library/jest-dom` neste repositório)

O texto do brief usa uma API de `jest-dom` que não está instalada e que nenhum outro teste
do repositório usa. Traduzido para o estilo de asserção DOM crua que os testes vizinhos do
mesmo arquivo já usam (ex.: `expect(screen.getByText('peso das matérias')).toBeTruthy()` na
linha 198 do arquivo já existente, `expect(screen.queryByText(...)).toBeNull()` já usado
várias vezes no arquivo):

| Do brief (`jest-dom`, não instalado) | Traduzido para |
|---|---|
| `expect(screen.queryByText('INFORMÁTICA')).not.toBeInTheDocument()` | `expect(screen.queryByText('INFORMÁTICA')).toBeNull()` |
| `expect(screen.getByText('LÍNGUA PORTUGUESA')).toBeInTheDocument()` | `expect(screen.getByText('LÍNGUA PORTUGUESA')).toBeTruthy()` |
| `expect(screen.getByText('INFORMÁTICA')).toBeInTheDocument()` | `expect(screen.getByText('INFORMÁTICA')).toBeTruthy()` |
| `expect(getByTestId(\`chip-common-...\`)).toHaveTextContent('comum a todos')` | `expect(screen.getByTestId(\`chip-common-...\`).textContent).toContain('comum a todos')` |
| `expect(getByTestId(\`chip-escopo-...\`)).toHaveTextContent('só Técnico')` | `expect(screen.getByTestId(\`chip-escopo-...\`).textContent).toContain('só Técnico')` |
| `expect(input).toHaveValue(30)` | `expect((input as HTMLInputElement).value).toBe('30')` |
| `expect(input).toHaveValue(null)` (input numérico vazio) | `expect((input as HTMLInputElement).value).toBe('')` |
| `expect(input).toHaveValue(40)` | `expect((input as HTMLInputElement).value).toBe('40')` |
| `expect(screen.getByText('LÍNGUA PORTUGUESA')).toBeInTheDocument()` (×2, teste do split) | `expect(screen.getByText('LÍNGUA PORTUGUESA')).toBeTruthy()` |

Nenhuma tradução enfraquece a semântica original: `toBeNull()` sobre `queryBy…` continua
provando ausência (não "não lançou"), `toBeTruthy()` sobre um elemento já obtido por `getBy…`
(que lança se ausente) prova presença com a mesma força, `.textContent).toContain(...)`
preserva a checagem de substring de `toHaveTextContent`, e o cast para `HTMLInputElement` com
comparação de string preserva exatamente o valor renderizado de um `<input type="number">`
vazio (string vazia) ou preenchido. Não foi instalado `@testing-library/jest-dom` — violaria
a restrição global de não adicionar dependência nova.

### As chaves de `localStorage` usadas

Os dois auxiliares novos (`seedWorkspaceDoisCargos`, `seedImportDoisCargos`) usam
`WORKSPACES_KEY` e `stageWorkspaceImport(...)` — as constantes e a função que o arquivo já
define no topo (linhas 14–18 e a importação de `@/domain/useWorkspaces`), nunca uma chave
literal. Isso importa porque as chaves reais têm sufixo de usuário
(`` `kalibra_workspaces:${TEST_USER.id}` ``) — semear a chave errada faria o teste cair em
fallback (o app não acharia o workspace seedado, cairia num caminho de "workspace inexistente")
e passar pelo motivo errado. A leitura de `SYLLABUS_KEY` no último teste de aceite também usa
a constante já definida (`` `kalibra_syllabus:${TEST_USER.id}:setec-campinas` ``).

## 3. Saída do portão completo (Step 3)

### `pnpm run typecheck`

```
$ pnpm run typecheck:libs && pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck
$ tsc --build
Scope: 4 of 10 workspace projects
scripts typecheck: Done
artifacts/api-server typecheck: Done
artifacts/mockup-sandbox typecheck: Done
artifacts/kalibra typecheck: Done
```
Resultado: **passou** (exit 0), sem erros em nenhum dos 4 pacotes com typecheck.

### `pnpm run test`

```
Scope: 9 of 10 workspace projects
lib/core:            11 arquivos, 219 testes — passou
artifacts/kalibra:   19 arquivos, 313 testes — passou
```
Resultado: **passou**. Ver seção 4 para as execuções sob os três fusos.

### `pnpm run build`

```
Scope: 9 of 10 workspace projects
artifacts/api-server build: Done
artifacts/mockup-sandbox build: ✓ 30 modules transformed. ✓ built in 541ms
artifacts/kalibra build: ✓ 1939 modules transformed. ✓ built in 2.37s
```
Resultado: **passou** (exit 0). O mesmo aviso já registrado nas verificações de fases
anteriores continua aparecendo, inalterado e fora do escopo desta fase:
`src/components/ui/tooltip.tsx (2:0): Error when using sourcemap for reporting an error`
(aviso do gerador de sourcemap do Vite/Rollup sobre um arquivo em `components/ui/`, que esta
fase não toca) e o aviso padrão de chunk JS > 500 kB. Nenhum dos dois impede o build.

## 4. Restrições globais confirmadas

```
$ git diff --stat artifacts/kalibra/src/index.css
(sem saída — arquivo intocado)

$ grep -rln "localStorage\|window\.\|document\.\|fetch(" lib/core/src --include=*.ts | grep -v ".test.ts"
(sem saída — lib/core continua puro; esta task só acrescentou um teste a status.test.ts)

$ grep -rln "localStorage\|sessionStorage" artifacts/kalibra/src/pages artifacts/kalibra/src/components
src/pages/Aprovacoes.test.tsx
src/pages/Edital.test.tsx
src/pages/EditalRevisar.derivacoes.test.tsx
src/pages/EditalRevisar.test.tsx
src/pages/NovoWorkspace.test.tsx
(só arquivos de teste — nenhuma tela de produção toca persistência diretamente; passa pela
camada de adapters, como nas fases anteriores)

$ grep -m2 '"react"\|"react-dom"' artifacts/kalibra/package.json
    "react": "catalog:",
    "react-dom": "catalog:",
$ grep -n "^react:\|^react-dom:" pnpm-workspace.yaml
react: 19.1.0
react-dom: 19.1.0
(React e react-dom pinados em 19.1.0 exato, via catálogo do pnpm workspace)

$ git diff --stat -- '*package.json' pnpm-lock.yaml
(sem saída — nenhuma dependência nova; esta task só editou dois arquivos de teste e criou
este documento)
```

Todas as restrições globais do brief confirmadas: `index.css` intocado, `lib/core` continua
puro (a única mudança nele é um teste a mais), nenhuma tela lê `localStorage`/`sessionStorage`
diretamente, React/react-dom em `19.1.0` exato, nenhuma dependência nova instalada (em
particular, `@testing-library/jest-dom` **não** foi adicionado — as asserções foram
traduzidas, seção 2).

## 5. A suíte em três fusos (Step 4)

O Bash desta sessão descarta `TZ` — rodado via PowerShell (`$env:TZ='...'; pnpm run test`),
como o brief instruiu para este ambiente.

```powershell
foreach ($tz in @("UTC","America/Sao_Paulo","Pacific/Kiritimati")) { $env:TZ = $tz; pnpm run test }
```

| Fuso | `lib/core` | `artifacts/kalibra` | Linha "Snapshots … written" |
|---|---|---|---|
| `UTC` | 219 passou | 313 passou | nenhuma (ausente do output) |
| `America/Sao_Paulo` | 219 passou | 313 passou | nenhuma (ausente do output) |
| `Pacific/Kiritimati` | 219 passou | 313 passou | nenhuma (ausente do output) |

Resultado idêntico nos três fusos (532 testes passando em cada rodada). Depois das três
execuções, `git status --porcelain` mostra só o `.snap` de screenshots com diff vazio (nota
abaixo) e os dois arquivos de teste editados por esta task — nenhuma escrita de snapshot
nova. `Pacific/Kiritimati` (UTC+14, o fuso mais adiantado do mundo) e `UTC` são os extremos
mais prováveis de expor um `new Date()` sem fuso explícito; os testes de aceite novos não leem
relógio algum (`readApprovals()`, leitura de `localStorage`, `data-testid`, valores de input),
e `lib/core` não lê relógio (confirmado na seção 4 das verificações anteriores e ainda válido
aqui, já que esta task não tocou nenhuma função de produção).

**Nota sobre `screens.snapshot.test.tsx.snap` no `git status`:** o arquivo aparece como
modificado (`git status --porcelain`) em todas as execuções, mas `git diff` sobre ele não
mostra nenhuma linha — é só a normalização CRLF/LF que o Git aplica na working copy
(`warning: in the working copy of '...' LF will be replaced by CRLF the next time Git
touches it`), não uma mudança de conteúdo. Não foi commitado.

## 6. Conferência visual manual nos dois temas (Step 5)

**Não realizada — registrado honestamente, não inventado.**

```
$ env | grep -i CLERK
(vazio — nenhuma variável CLERK no ambiente)

$ find . -maxdepth 3 -iname ".env*" -not -path "*/node_modules/*"
./.env.example
```

`.env.example` só lista os nomes de variável (`VITE_CLERK_PUBLISHABLE_KEY=`, sem valor); não
existe `.env` real neste ambiente, e nenhuma variável `VITE_CLERK_PUBLISHABLE_KEY` está
definida no processo. `src/config/clerk.tsx` consome essa variável diretamente via
`import.meta.env`, e sem ela o Clerk não inicializa — a aplicação não monta de forma
utilizável num navegador real neste ambiente.

Como o brief pede explicitamente para não inventar o resultado quando a chave não está
disponível: **a conferência visual manual (dark e light) do filtro de cargo, do marcador de
preenchido, da árvore com "comum a todos"/"só \<cargo\>" e do menu "Aplicar a \<cargo\>" não
foi feita nesta verificação.** O que cobre esse comportamento nesta submissão é só a suíte
automatizada (`SyllabusTree.test.tsx`, `CargoFilter.test.tsx`, e os 7 testes de aceite desta
task), que roda em jsdom com `@clerk/react` mockado — nunca um navegador real nem o Clerk de
verdade. Isto é uma lacuna aberta, não um "verificado"; consistente com o que os documentos de
verificação das Fases 0, 1A e 1B já registraram para o mesmo motivo.

## 7. Arquivos tocados nesta task

- `lib/core/src/workspace/status.test.ts` — um teste novo (`describe` "o diagnóstico só é
  alcançável a partir da revisão do edital"), fixando que só `aguardando_revisao_edital` tem
  aresta para `diagnostico_pendente`. Nenhuma linha de produção de `lib/core` foi tocada.
- `artifacts/kalibra/src/pages/EditalRevisar.test.tsx` — dois auxiliares novos
  (`seedWorkspaceDoisCargos`, `seedImportDoisCargos`, `rowOf`, `itemIdOf`) e um `describe`
  novo ("critérios de aceite da Fase 1B.5") com sete `it`, reaproveitando `entrada()`,
  `stageWorkspaceImport` e o padrão `render(<App/>)` com `window.history.replaceState` que o
  arquivo já usa. Nenhuma linha de produção foi tocada — os sete testes passaram sem exigir
  correção nenhuma em `EditalRevisar.tsx`, `SyllabusTree.tsx` ou `CargoFilter.tsx`.
- `docs/superpowers/plans/2026-09-14-kalibra-fase-1b5-verificacao.md` — este documento.

## 8. Limites conhecidos

Os do brief da Fase 1B.5 (registrados de propósito, para ninguém tentar consertá-los no meio
do caminho):

- **`dedupeEntries` continua quadrático e síncrono na tela.** Esta fase aumenta o volume de
  entradas reais (agora há conteúdo distinto por cargo), então o problema fica mais visível —
  mas resolvê-lo exige worker ou effect, mudança maior e própria.
- **`Dashboard` e `Shell` continuam lendo mock de `@/data`.**
- **Modo "Arquivo" continua bloco único.** O parser real é da Fase 4; UI de upload por cargo
  agora seria construir para dados falsos.
- **`concept_merge` continua deixando um conceito provisório órfão** na primeira aprovação de
  cada item.
- **`workspaceId` continua guardando slug.**
- **Não existe campo de "prioridade" no modelo.** O critério pedia "pesos, número de questões
  ou prioridade quando disponíveis": `weight` e `questionCount` existem por ligação e esta
  fase os cobre; prioridade não existe em `SyllabusItemCargo` e não é inventada aqui — decisão
  de modelo para uma fase própria, provavelmente derivada de peso × desempenho na Fase 1C.

Encontrados durante a execução desta task, ao escrever e ler os testes de aceite (não
corrigidos aqui — são comportamento das Tasks 1–7, e nenhum dos sete testes de aceite os
exercita como falha; registrados porque a Task 8 é o ponto de observação de ponta a ponta que
os revelou):

- **Nomear um cargo *depois* de já ter digitado conteúdo deixa esse conteúdo classificado
  como "comum" sem aviso.** É uma reclassificação silenciosa (não perda de dado): o texto já
  digitado num bloco permanece associado ao `cargoId` que existia no momento da digitação: se
  esse era o único cargo, ou o bloco comum, o conteúdo continua contado como comum mesmo
  depois de o cargo ganhar nome — nada avisa o usuário que a classificação mudou de sentido.
- **`Edital.tsx` tem sua própria implementação do chip de cargo** (sempre "N cargos", nunca
  "comum a todos"/"só \<cargo\>") — não reaproveita a lógica de `SyllabusTree.tsx` (que esta
  task confirma correta nos testes de aceite). Duas telas mostram a mesma árvore com
  marcações diferentes para o mesmo dado.
- **`workspace.sourceBlocks` é write-only.** Nenhuma tela pré-carrega os blocos salvos ao
  reabrir o editor — o rascunho por cargo não sobrevive a fechar e reabrir a tela de edição do
  edital, mesmo estando salvo em `localStorage`.
- **O comentário de `linkItemToCargo` (`lib/core/src/syllabus/syllabus.ts:94`, "o inverso de
  `splitItem`") está impreciso.** `splitItem` sempre cria um item novo (nunca reaproveita um
  id existente), então
  aplicar um item a um cargo e depois separá-lo de volta não devolve a topologia original —
  vira dois itens em vez de um único item com duas ligações. O teste de aceite 6 desta task
  ("separar... não remove o conteúdo do outro cargo") exercita exatamente esse split e
  confirma que o conteúdo sobrevive nos dois lados, mas não que a topologia volte a ser a
  mesma — porque não é.

## 9. Onda de correção da revisão final de branch (2026-09-14)

A revisão final de branch inteira devolveu **não pronta para merge** com dois achados
Importantes e dois menores baratos. Esta seção descreve o comportamento DEPOIS da onda
única de correção, e fecha a lista do que fica parqueado como limite conhecido.

Commits: `d6c1697` (I-1 + M-5) e `85b6b3c` (I-2 + M-4), sobre `1eedb31`.

### 9.1 I-1 — o editor não aceita mais texto para um cargo que já não existe

**Antes:** `EditalSourceBlocks.tsx:34` calculava `const ativo = multiplos ? aba : null`
e nunca validava se `aba` ainda estava em `cargos`. Removendo (ou apagando o nome de) o
cargo cuja aba estava aberta, a aba sumia da barra, **nenhuma aba ficava acesa** e o
textarea continuava mostrando — e aceitando — o texto do cargo morto, com
`data-cargo="<id morto>"`. Tudo o que fosse digitado dali em diante entrava em
`sourceBlocks` sob o id morto, e a poda do submit (`NovoWorkspace.tsx`, achado I3 da
Task 6) o descartava em silêncio.

**Depois:** a aba ativa é validada contra a lista de cargos **a cada render**. Quando o
cargo da aba aberta deixa de existir, o campo volta para o bloco **comum** — o único
destino que nenhuma edição de cargo pode fazer sumir — e a aba "Comum a todos" acende.
O critério é comportamental e está fixado por teste: **não existe textarea editável cujo
conteúdo o submit vá descartar**.

Vale para as duas formas de o cargo "deixar de existir", porque para o componente elas
são a mesma coisa (a tela de criação só passa os cargos NOMEADOS):

| Ação do usuário | Comportamento agora |
|---|---|
| Clicar no X do cargo da aba aberta | Campo volta ao bloco comum, com o texto comum; digitar dali em diante grava em `cargoId: null` |
| Apagar o nome do cargo da aba aberta | Idem |
| Remover um cargo que **não** é o da aba aberta | Nada muda para quem está digitando |

Testes: `EditalSourceBlocks.test.tsx` (4 novos, no componente) e `NovoWorkspace.test.tsx`
(2 novos, na jornada real de criação com três cargos). Reverter `ativo` para a forma
antiga deixa os 6 vermelhos.

### 9.2 I-2 — excluir com um cargo no filtro exclui só daquele cargo

**Antes:** `SyllabusTree.tsx` chamava `onRemove(item.id)` em qualquer situação, e
`EditalRevisar.handleRemove` apagava o item e **todas** as ligações dele. Com o filtro em
"Analista", excluir "Crase" (comum a Analista e Técnico) apagava o conteúdo do Técnico
junto, com peso e quantidade de questões, sem confirmação e sem aviso — enquanto o chip
da mesma linha dizia "comum a todos" e o menu logo acima oferecia "Separar de Analista",
a operação não destrutiva. Violava o critério de aceite **"alterar um cargo não
contamina os demais"**.

**Depois**, o contrato de comportamento em vigor:

| Situação | O que "Excluir" faz | Rótulo no menu |
|---|---|---|
| Filtro num cargo, item comum a vários | Remove **só** a ligação daquele cargo; os demais ficam com o item, o peso e a quantidade intactos | `Excluir de <cargo>` |
| Filtro em "todos os cargos", item comum | Remove o item inteiro, como antes | `Excluir de todos os cargos` |
| Item que pertence a um cargo só | Remove o item inteiro (tirar a última ligação é excluir o item) | `Excluir` |

A operação pura nova é `unlinkItemFromCargo(syllabus, itemId, cargoId)`, em
`lib/core/src/syllabus/syllabus.ts`, ao lado de `linkItemToCargo` e `splitItem`. Três
regras, todas consequência do mesmo critério:

1. **Os subtópicos vão junto.** Um item que deixa de pertencer ao cargo não deixa filhos
   pendurados naquele cargo.
2. **Item sem nenhuma ligação deixa de existir.** Tirar o último cargo é excluir o item —
   o modelo não tem lugar para conteúdo que não pertence a cargo nenhum.
3. **Filho que sobrevive a um pai excluído vira raiz** (`parentItemId: null`), nunca
   aponta para um pai que já não existe.

Itens fora da subárvore afetada nunca são removidos, mesmo que já estivessem sem ligação
antes: a função responde por uma exclusão, não por uma faxina do registro. `lib/core`
continua puro — sem relógio, I/O, storage ou `window`.

Os **dois** caminhos de `EditalRevisar` foram ligados, não um só:

- proposta em revisão (estado `review`, nada persistido ainda) → `unlinkItemFromCargo`
  sobre `review.syllabus`;
- programa já persistido → `syllabusApi.unlinkFromCargo`, novo no adaptador local, que
  chama a mesma função pura e persiste.

Testes: 12 em `lib/core/src/syllabus/syllabus.test.ts` (incluindo os quatro de
subtópicos), 4 em `SyllabusTree.test.tsx` (rótulo e qual callback dispara nos três
casos) e 7 em `EditalRevisar.test.tsx` — 4 no caminho da proposta (some da visão do
Analista, continua na do Técnico; peso 30 e 7 questões do Técnico intactos depois da
exclusão do Analista; confirmar grava `links` só com `c2`; sem filtro continua apagando
tudo) e 3 no caminho persistido (a ligação `c1` some do `localStorage`, a `c2` fica com
`weight: 6, questionCount: 3`; "Crase" continua visível para o Técnico; item de um cargo
só é excluído inteiro).

### 9.3 M-5 — a aparência do campo volta a ser de quem monta o componente

Ao adotar o componente compartilhado, o textarea da tela de criação perdeu
`min-h-[200px] font-mono text-[11px] leading-relaxed` e ficou com as medidas do modal de
reimportação (`min-h-[150px] text-[12px]`). Perder `font-mono` na superfície principal de
colar edital era o que mais custava. O componente passa a aceitar `textareaClassName`
(padrão: as medidas do modal, então `Edital.tsx` fica exatamente como estava) e
`NovoWorkspace` passa as suas. Nenhum token novo, `index.css` intocado.

### 9.4 M-4 — dois comentários imprecisos corrigidos

- `lib/core/src/syllabus/syllabus.ts`: `linkItemToCargo` não é "o inverso de
  `splitItem`". `splitItem` sempre cria um item NOVO, então ligar e separar de volta
  devolve dois itens onde havia um — o conteúdo sobrevive nos dois cargos, a topologia
  não volta a ser a mesma. O texto agora diz "a direção contrária", aponta a diferença e
  remete a `unlinkItemFromCargo` para quem quer tirar um cargo sem criar item novo.
- `EditalRevisar.tsx`: o rascunho carrega `sourceBlocks` (um bloco por cargo mais o
  comum), não `sourceText`.

### 9.5 Portão depois da onda

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | passou (4 pacotes, exit 0) |
| `pnpm run test` | passou — **564 testes** (231 `lib/core` + 333 `artifacts/kalibra`), contra 532 antes |
| `pnpm run build` | passou (exit 0), com os mesmos dois avisos pré-existentes (sourcemap de `components/ui/tooltip.tsx` e chunk > 500 kB) |
| `TZ` em `UTC`, `America/Sao_Paulo`, `Pacific/Kiritimati` | 564 em cada, idêntico; nenhuma linha "Snapshots … written" |

Contagem por arquivo tocado: `syllabus.test.ts` 24 → 36; `EditalRevisar.test.tsx` 50 →
57; `SyllabusTree.test.tsx` 16 → 20; `EditalSourceBlocks.test.tsx` 7 → 13;
`NovoWorkspace.test.tsx` 7 → 10.

`screens.snapshot.test.tsx.snap` volta a aparecer em `git status` com `git diff` vazio —
a normalização CRLF já documentada na seção 5, não mudança de conteúdo (`git diff
--numstat` não devolve linha alguma, e o arquivo não contém o textarea alterado).

Restrições globais reconferidas: `index.css` intocado, nenhuma dependência nova
(`git diff --stat -- '*package.json' pnpm-lock.yaml` vazio), nenhuma tela de produção
tocando storage direto, React/react-dom em `19.1.0` exato, `lib/core` puro.

### 9.6 Cada correção provada por reversão mecânica

Antes de commitar, cada guarda foi revertida mecanicamente e a suíte rodada; todas
ficaram vermelhas, e o código foi restaurado em seguida.

| Reversão | Vermelhos |
|---|---|
| `ativo` volta a `multiplos ? aba : null` | 6 (4 em `EditalSourceBlocks.test.tsx`, 2 em `NovoWorkspace.test.tsx`) |
| `textareaClassName` removido da tela de criação | 1 (`expected 'k-input min-h-[150px] …' to contain 'font-mono'`) |
| `porCargo` neutralizado em `SyllabusTree` | 7 (2 no componente, 5 na tela) |
| só o ramo persistido trocado por `removeItem` | 2 |
| só o ramo da proposta trocado por `removeSyllabusItem` | 3 |
| filtro de ligações de `unlinkItemFromCargo` ignorando o cargo | 4 (`lib/core`) |
| cascata de subtópicos desligada | 2 (`lib/core`) |

## 10. Limites parqueados desta fase (decisão explícita, não esquecimento)

Além dos da seção 8, a onda de correção decidiu **não** mexer nestes — entram como
limites conhecidos da Fase 1B.5:

- **`sourceBlocks` continua write-only:** nenhuma tela pré-carrega os blocos salvos ao
  reabrir o editor do edital.
- **`Edital.tsx:408` mantém o chip divergente** (`N cargos`, sempre) em vez de "comum a
  todos" / "só \<cargo\>" como `SyllabusTree`.
- **Reclassificação silenciosa:** nomear um cargo DEPOIS de já ter digitado deixa o texto
  classificado como comum, sem aviso (não há perda de dado).
- **Id cru na aba de um cargo sem nome** — inalcançável em produção, porque as telas só
  passam cargos nomeados.
- **Teste amarrado a `vi.setSystemTime(2)`** para forçar id de cargo previsível (a onda
  reusou o mesmo padrão, com `3` para o terceiro cargo).
- **Separar (`splitItem`) e aplicar (`linkItemToCargo`) não levam os filhos junto** —
  pré-existente. A exclusão por cargo (`unlinkItemFromCargo`) leva; uniformizar as três é
  mudança de modelo, com fase própria.
- **Conferência visual manual nos dois temas continua não feita** (sem
  `VITE_CLERK_PUBLISHABLE_KEY` neste ambiente) — ver seção 6. As classes novas do menu e
  do campo seguem o par `light dark:` já usado nos arquivos, mas isso é leitura de
  código, não conferência em navegador.
