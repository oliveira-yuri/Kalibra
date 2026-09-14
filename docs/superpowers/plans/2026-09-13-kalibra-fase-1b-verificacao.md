# Verificação final da Fase 1B — Kalibra

Data: 2026-09-14
Branch: `fase-1b-edital-aprovacoes`
Commits da fase: `6cfd665` (modelar conceito global em `lib/core`) .. `cf5c2b0` (Task 15:
alimentar a tela Edital com o programa salvo) + este registro (Task 16) — 27 commits antes
deste documento, 28 com ele.
Escopo direto deste registro: Tasks 14–16 (`f1c8f9e`, `cf5c2b0`, e este commit). As Tasks
1–13 já têm sua própria verificação implícita nas mensagens de commit e nos fix rounds
registrados nelas; este documento não re-deriva o que já foi decidido lá, só confirma que o
estado final (depois de 14–16) continua consistente com tudo isso.

## 1. Contagem de testes por pacote

```
$ pnpm run test
```

| Pacote | Arquivos de teste | Testes |
|---|---|---|
| `lib/core` | 11 | 187 |
| `artifacts/kalibra` | 16 | 210 |
| **Total** | **27** | **397** |

Detalhe por arquivo, `lib/core` (187):

| Arquivo | Testes |
|---|---|
| `syllabus/dedup.test.ts` | 43 |
| `syllabus/concept.test.ts` | 38 |
| `workspace/status.test.ts` | 23 |
| `workspace/exam-dates.test.ts` | 13 |
| `workspace/availability.test.ts` | 12 |
| `fsrs/schedule.test.ts` | 12 |
| `syllabus/syllabus.test.ts` | 11 |
| `syllabus/extraction.test.ts` | 10 |
| `syllabus/diff.test.ts` | 9 |
| `approval/approval.test.ts` | 8 |
| `workspace/slug.test.ts` | 8 |

Detalhe por arquivo, `artifacts/kalibra` (210):

| Arquivo | Testes |
|---|---|
| `domain/adapters/local/workspaces.test.ts` | 37 |
| `domain/adapters/local/approvals.test.ts` | 28 |
| `pages/EditalRevisar.test.tsx` | 26 |
| `__tests__/screens.snapshot.test.tsx` | 22 |
| `domain/adapters/local/syllabus.test.ts` | 18 |
| `domain/adapters/local/concepts.test.ts` | 16 |
| `pages/Edital.test.tsx` | 15 |
| `components/SyllabusTree.test.tsx` | 11 |
| `components/EditalUploadProgress.test.tsx` | 10 |
| `domain/adapters/local/extraction.test.ts` | 7 |
| `components/AvailabilityFields.test.tsx` | 4 |
| `lib/date-utils.test.ts` | 4 |
| `components/SourceExcerpt.test.tsx` | 3 |
| `components/CargoFilter.test.tsx` | 3 |
| `pages/Aprovacoes.test.tsx` | 3 |
| `pages/NovoWorkspace.test.tsx` | 3 |

`lib/core` continua puro (sem I/O) — a espinha do domínio descrita no "Estado ao fim da Fase
1B" do plano: conceito global, programa de estudo, deduplicação, contrato de extração, diff
de versões e fila de aprovação, tudo testado sem tocar `localStorage`/`fetch`/relógio.

Números antes de Tasks 14–16 (para referência): `lib/core` já estava em 187 (nenhuma task
destas mexeu em `lib/core`); `artifacts/kalibra` estava em 200. Task 14 acrescentou 5 testes
(4 num novo `describe('EditalRevisar — Task 14 …')` + 1 em `Aprovacoes.test.tsx`), Task 15
acrescentou 5 (`describe('Edital — Task 15 …')`) — 200 → 210.

## 2. Saída do portão

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
lib/core:            11 arquivos, 187 testes — passou
artifacts/kalibra:   16 arquivos, 210 testes — passou
```
Resultado: **passou**. Ver seção 3 para as três execuções sob fusos diferentes (mesmo
resultado nas três, 0 snapshots reescritos).

### `pnpm run build`

```
Scope: 9 of 10 workspace projects
artifacts/api-server build: Done
artifacts/mockup-sandbox build: ✓ built in ~550ms
artifacts/kalibra build: ✓ 1937 modules transformed. ✓ built in ~2.4s
```
Resultado: **passou** (exit 0). Os dois avisos já registrados nas verificações da Fase 0/1A
continuam aparecendo, inalterados e fora do escopo desta fase:
`src/components/ui/tooltip.tsx (2:0): Error when using sourcemap for reporting an error`
(aviso do gerador de sourcemap do Vite/Rollup sobre um arquivo em `components/ui/`, que esta
fase não pode tocar) e o aviso padrão de chunk JS > 500 kB. Nenhum dos dois impede o build.

## 3. Restrições confirmadas (os quatro greps do brief)

```
$ grep -rn "localStorage\|sessionStorage\|fetch(" artifacts/kalibra/src/pages artifacts/kalibra/src/components --include=*.tsx | grep -v "components/ui/" | grep -v "\.test\." || echo "nenhuma tela toca persistencia"
nenhuma tela toca persistencia

$ grep -rnE "Date\.now\(\)|new Date\(\)" lib/core/src --include=*.ts | grep -v test || echo "lib/core sem leitura de relogio"
lib/core sem leitura de relogio

$ grep -rn "hasEdital" artifacts/kalibra/src/ | grep -v "hasEdital(" || echo "hasEdital so como funcao derivada"
(17 linhas — ver análise abaixo, nenhuma é uma segunda fonte de verdade)

$ grep -rn "from '@/data'" artifacts/kalibra/src/pages/Edital.tsx || echo "Edital nao le mais dados mockados"
Edital nao le mais dados mockados
```

Os greps 1, 2 e 4 deram exatamente a mensagem de confirmação esperada. O grep 3
(`hasEdital`) não deu a mensagem de saída — o padrão `grep -v "hasEdital("` é literal
demais: ele também casa qualquer menção a `hasEdital` que não seja seguida imediatamente por
`(`, incluindo a própria linha de `import`. Investigando as 17 linhas devolvidas:

- `import { hasEdital } from '@workspace/core';` (em `workspaces.ts` e `workspaces.test.ts`)
  — a importação da função derivada em si; sem parêntese na mesma linha porque é um import,
  não uma chamada.
- `raw.hasEdital` em `migrateWorkspace` (`workspaces.ts:135-140`) — leitura de um campo
  **legado**, de registros salvos antes desta função existir como derivada; o comentário ao
  lado documenta exatamente isso: "o campo não existe mais no formato atual, mas um
  `hasEdital: false` explícito herdado de um registro antigo não é descartado em silêncio".
  Isso é migração de dado antigo, não uma segunda fonte de verdade ativa.
- As demais linhas são testes (`workspaces.test.ts`) e um fixture de snapshot
  (`screens.snapshot.test.tsx:93`, `hasEdital: true`) que existem exatamente para provar que
  essa migração funciona — deliberadamente simulam o formato antigo.

Chamada de verdade (`hasEdital(`, a função em uso) aparece em exatamente dois lugares:
```
$ grep -rn "hasEdital(" artifacts/kalibra/src/ lib/core/src/ | grep -v "\.test\."
lib/core/src/workspace/status.ts:91:export function hasEdital(status: WorkspaceStatus): boolean {
artifacts/kalibra/src/domain/adapters/local/workspaces.ts:140:  const status = raw.hasEdital === false && hasEdital(derivedStatus) ? 'sem_edital' : derivedStatus;
```
Uma definição pura em `lib/core` (deriva de `status`), uma chamada na migração de registro
legado. Nenhum lugar no app **grava** `hasEdital` como campo novo — `WorkspaceDraft` (o tipo
atual) não tem essa propriedade. O invariante do "Estado ao fim da Fase 1B" ("`hasEdital`
deixou de ser um segundo lugar onde a verdade mora") continua de pé; o grep do brief, tomado
ao pé da letra, não tem como distinguir "import"/"campo legado lido" de "campo gravado de
novo" — não é uma regressão desta fase, é uma limitação do padrão de busca.

## 4. A suíte em três fusos (Task 16, Step 3)

O Bash desta sessão descarta `TZ` — rodado via PowerShell, como o brief instruiu:

```powershell
foreach ($tz in @("UTC","America/Sao_Paulo","Pacific/Kiritimati")) { $env:TZ = $tz; pnpm run test }
```

| Fuso | `lib/core` | `artifacts/kalibra` | Snapshots reescritos |
|---|---|---|---|
| `UTC` | 187 passou | 210 passou | 0 |
| `America/Sao_Paulo` | 187 passou | 210 passou | 0 |
| `Pacific/Kiritimati` | 187 passou | 210 passou | 0 |

Resultado idêntico nos três fusos (397 testes passando em cada rodada), nenhuma linha
`Snapshots … written/updated` em nenhuma das três execuções — exatamente o esperado pelo
brief. `Pacific/Kiritimati` (UTC+14, o fuso mais adiantado do mundo) e `UTC` são os extremos
mais prováveis de expor um `new Date()` sem fuso explícito; `lib/core` não lê relógio algum
(grep da seção 3), e o congelamento de tempo do frontend (`screens.snapshot.test.tsx`, via
`vi.useFakeTimers()`/`vi.setSystemTime()`, herdado da Fase 1A) já resolve o determinismo ali.

## 5. Conferência visual manual nos dois temas (Task 16, Step 4)

**Não realizada de forma genuína** — mesma lacuna já registrada nas verificações da Fase 0 e
da Fase 1A, reconfirmada aqui:

```
$ echo $VITE_CLERK_PUBLISHABLE_KEY
(vazio)
$ find . -maxdepth 3 -iname ".env*" | grep -v node_modules
./.env.example   (só nomes de variável, nenhum valor real — ver conteúdo abaixo)
```
`.env.example` lista `VITE_CLERK_PUBLISHABLE_KEY=` (vazio) ao lado das outras chaves do
projeto; não existe nenhum `.env` real neste ambiente. `src/config/clerk.tsx` consome
`import.meta.env.VITE_CLERK_PUBLISHABLE_KEY` diretamente (via `publishableKeyFromHost`), e
sem ela o app depende de reconhecer o hostname atual — o que este ambiente não satisfaz.

**Tentativa feita antes de descartar o passo** (não só leitura de código): subi
`pnpm run dev` de fato, no diretório `artifacts/kalibra`, e fiz uma requisição HTTP à raiz:
```
$ npx vite --config vite.config.ts --host 127.0.0.1 --port 5183 &
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:5183/
HTTP 200
```
O servidor sobe e responde 200 — o HTML servido é só o shell estático do Vite (a aplicação
React monta no navegador via JS). Sem uma ferramenta de automação de navegador neste
ambiente, não há como capturar o DOM pós-render do cliente nem os widgets reais do Clerk. O
servidor de dev foi encerrado logo em seguida.

**O que foi conferido como substituto** (evidência de código + suíte automatizada, não
inspeção visual real):
- `pnpm run build` e a subida de `pnpm run dev` não falham — a aplicação está sintaticamente
  e estruturalmente sã nas duas telas que Tasks 14–15 tocaram.
- Os 210 testes de `artifacts/kalibra` (incluindo 22 em `screens.snapshot.test.tsx`, que
  cobrem 16 rotas, e os testes dedicados de `EditalRevisar.test.tsx`/`Edital.test.tsx`/
  `Aprovacoes.test.tsx`) exercitam o HTML renderizado via `@testing-library/react`, com
  `@clerk/react` inteiramente mockado (`clerk-mock.ts`) — nunca o widget real.
- As classes `dark:` condicionais de cada elemento novo (chip comum, aviso de deduplicação,
  células "sem dados", filtro de cargo) estão presentes lado a lado no HTML capturado pelos
  snapshots — mas isso prova só a presença da classe CSS, não o resultado visual computado
  (cor, contraste, alinhamento) em cada tema.

**O que ficou explicitamente sem cobertura, por causa dessa lacuna:**
- Estilos computados reais em cada tema (claro/escuro) para todo o trabalho de Tasks 14–15:
  o chip de item comum, o aviso "conteúdos repetidos… unidos", as células honestas
  "sem dados"/"sem dados até o diagnóstico", o filtro de cargo desabilitado de prioridade.
- Comportamento real dos widgets do Clerk (nada nesta fase os toca diretamente, mas o app
  inteiro roda atrás deles).
- Os quatro estágios da criação de workspace com edital colado, clicados de verdade num
  navegador (a suíte simula estágios via `useExtraction` mockado, nunca um upload real).
- A revisão com pesos e trechos, um item comum sendo separado, e a fila de aprovação com um
  item pendente — todos exercitados por `fireEvent` em jsdom, nunca por clique real de mouse
  nem por um navegador renderizando de fato.
- A tela Edital com o programa salvo, como um usuário veria na prática (scroll, hover,
  tooltip do `title` nas células "sem dados", responsividade real de viewport).

A evidência de que Tasks 14–16 estão corretas descansa inteiramente sobre a suíte de testes
(que mocka Clerk e roda em jsdom, não num navegador) e sobre a leitura manual dos diffs de
snapshot antes de cada `-u` (seção 6) — não sobre inspeção visual real. Isto está registrado
como lacuna aberta, não como "verificado".

## 6. Snapshots que mudaram nesta fase (Tasks 14–16), e por quê

Duas rodadas de atualização de snapshot, uma por task de produto; ambos os diffs foram lidos
por completo antes de rodar `-u`, como o brief exige.

### Task 14 — `renderiza /aprovacoes com itens pendentes de forma estável`

Único elemento do diff: o cartão do item `edital_structure` (`appr-2`, fixture do próprio
teste) perdeu a caixa de seleção (`checkbox-select-appr-2`) e o par de botões
Aprovar/Rejeitar (`button-approve-appr-2`, `button-reject-appr-2`). Nada mais mudou no
snapshot — o cartão `appr-1` (`concept_merge`) e todo o resto da página permaneceram
byte a byte idênticos.

**Por quê:** Task 14 move a persistência do programa para dentro de
`EditalRevisar.handleConfirm` (aprovar o item da fila é o que dispara a gravação). Se
`ApprovalCard` continuasse oferecendo Aprovar/Rejeitar inline para `edital_structure`, um
clique em "Aprovar" na fila decidiria o item sem nunca escrever o programa — a fila diria
"aprovado" e nada teria mudado de fato. `ApprovalCard.tsx` passou a esconder essa decisão
inline só para este tipo (`decidableInline = item.type !== 'edital_structure'`), deixando só
o link "Revisar estrutura" (que já existia) como caminho de decisão.

### Task 15 — `renderiza /workspace/setec-campinas/edital de forma estável`

Diff: o eyebrow mudou de `"estrutura da prova · 84 tópicos mapeados"` para
`"estrutura da prova · 0 tópicos mapeados"`, as oito linhas mocadas de `@/data`
desapareceram, e um bloco `data-testid="edital-topics-empty"` com o texto
"Nenhum tópico no programa ainda — importe e confirme um edital para ver a estrutura aqui."
tomou o lugar da tabela. Nada em nenhuma outra rota do snapshot mudou.

**Por quê:** o fixture padrão do workspace `setec-campinas` usado pela suíte de snapshot não
tem programa de estudo salvo (`kalibra_syllabus:*` nunca foi semeado nesse teste) — então,
puxando de `useSyllabus` em vez de `@/data`, a lista honestamente aparece vazia. Isto é
exatamente o comportamento que a Task 15 pede: a tela não pode mais fingir 84 tópicos que não
existem. O comportamento com programa real (linhas reais, chip de item comum, células
honestas) está coberto pelos 5 testes novos de `Edital.test.tsx` (seção 1), que semeiam
`kalibra_syllabus:*` diretamente — fora do loop de snapshot, porque o fixture do snapshot é
deliberadamente o caso "workspace sem programa ainda".

Nenhuma outra rota do arquivo de snapshot (`/portal`, `/workspace/setec-campinas`,
`/workspace/setec-campinas/edital/revisar/1`, `/aprovacoes` sem itens, etc.) moveu em nenhuma
das duas rodadas — confirmado lendo a lista completa de testes de
`screens.snapshot.test.tsx` em cada execução (16 rotas de `it.each`, ambas com `✓`, exceto a
rota afetada em cada rodada). Depois de cada `-u`, a suíte completa foi rodada de novo e
confirmou 0 escritas adicionais (e as três rodadas sob fuso diferente, seção 4, confirmam
isso de novo).

## 7. O que Tasks 14–16 mudaram, resumido

- **Task 14** (`f1c8f9e`): ao montar `EditalRevisar` com uma proposta para revisar, um item
  `edital_structure` entra na fila (`payloadBefore` = programa salvo, ou `null` na primeira
  importação; `payloadAfter` = `{ version, syllabus, mergedCount }`), idempotente entre
  remontagens via um novo campo `PendingWorkspaceImport.approvalItemId`. "Confirmar
  estrutura" aprova esse item antes de gravar o programa; "Descartar" rejeita. A checagem de
  `canTransition` continua acontecendo antes de qualquer persistência (nenhum retrocesso ao
  padrão que já causou dois achados Críticos nesta fase). `ApprovalCard`/`Aprovacoes.tsx`
  deixam de oferecer decisão inline para `edital_structure` — só o link para a tela dedicada.
- **Task 15** (`cf5c2b0`): `Edital.tsx` lê `useSyllabus` em vez de `@/data`; itens-folha do
  programa são as linhas da tabela, o item pai vira a coluna "matéria". Ganhou `CargoFilter`
  (filtra a lista e mostra `totalQuestionsFor` do cargo selecionado) e um aviso de
  deduplicação (`isCommon`) quando algum tópico é comum a mais de um cargo. Prioridade e
  acerto mostram estado honesto ("sem dados" / "sem dados até o diagnóstico") em vez de zero
  fabricado; o filtro de prioridade fica desabilitado até existir dado real.
- **Task 16** (este commit): este documento.

## 8. Desvios encontrados

- **O grep de `hasEdital` (seção 3) não produz a mensagem de saída esperada pelo brief**,
  mas por uma limitação do próprio padrão (`grep -v "hasEdital("` casa a linha de `import`
  também), não por uma regressão real — analisado em detalhe na seção 3. Nenhuma mudança de
  código foi necessária; o invariante que o grep tenta proteger continua de pé.
- **Task 14 mudou o comportamento de testes já existentes de `EditalRevisar.test.tsx`**: várias
  asserções de `readApprovals()).toHaveLength(0)` (antes de confirmar) e `toHaveLength(2)`
  (depois de confirmar, só `concept_merge`) passaram a `1` e `3` respectivamente, porque
  agora existe um item `edital_structure` pendente assim que a proposta é computada. Isto é
  a mudança de comportamento que a própria Task 14 pede (a decisão passa a ser explícita na
  fila, não mais implícita) — os testes foram atualizados para refletir o novo contrato, com
  comentários explicando a contagem nova em cada um.
- **Decisão de design não coberta literalmente pelo brief**: esconder Aprovar/Rejeitar/
  seleção em lote para `edital_structure` em `ApprovalCard.tsx` (Task 14) não estava no texto
  do brief (que só lista `EditalRevisar.tsx`/`Aprovacoes.tsx` como arquivos a modificar), mas
  era necessário para não abrir um caminho onde aprovar pela fila decide o item sem nunca
  escrever o programa — a mesma classe de bug que a Task 14 existe para fechar. Documentado
  no commit de Task 14 e na seção 6 acima.
- **Coluna "status" da tabela do Edital (Task 15)**: o brief pede estado honesto só para
  prioridade e acerto por tópico; "status" (dominar/em andamento/não iniciado) não tem essa
  ressalva explícita. Decisão tomada: todo tópico mostra "não iniciado", porque isso é
  literalmente verdadeiro nesta fase (não existe nenhum mecanismo de sessão de estudo ainda)
  — não é uma fabricação, é a única resposta honesta possível hoje. O filtro de status
  continua funcional (selecionar "não iniciado" mostra tudo; selecionar outra opção mostra
  vazio, corretamente).
- **Verificação manual em navegador (Step 4)**: não realizada, por ausência de
  `VITE_CLERK_PUBLISHABLE_KEY` e de ferramenta de automação de navegador neste ambiente —
  mesma lacuna já registrada nas Fases 0 e 1A, reconfirmada aqui para Tasks 14–16
  especificamente (seção 5). A tentativa de subir `pnpm run dev` e confirmar o boot do
  servidor foi feita antes de descartar o passo, não só por leitura de código.
- Nenhum outro desvio, classe nova fora do esperado, elemento removido ou mudança de texto
  foi encontrado nas etapas que puderam ser executadas (typecheck, build, testes, greps).

## 9. Estado final confirmado

- `lib/core`: 187 testes, 11 arquivos, intocado por Tasks 14–16 — nenhuma destas tasks
  precisou mexer em regra de domínio já testada.
- `artifacts/kalibra`: 210 testes, 16 arquivos, 397 testes no total da fase, mesmo resultado
  em três fusos horários (UTC, America/Sao_Paulo, Pacific/Kiritimati), 0 snapshots
  reescritos em nenhuma das três rodadas.
- Nada entra no programa de estudo sem uma decisão registrada na fila de aprovação — inclusive
  a estrutura extraída do edital, que fechou o ciclo nesta fase (Task 14): a fila não é mais
  só onde `concept_merge` aparece depois do fato, é onde a própria confirmação da estrutura
  vive como uma decisão.
- A tela Edital reflete o programa realmente salvo, nunca dados mocados — com honestidade
  explícita sobre o que a Fase 1B não sabe ainda (prioridade e acerto por tópico, que só
  chegam com o diagnóstico da Fase 1C).
- Os dois débitos da Fase 1A seguem quitados e confirmados por grep: a máquina de estados
  descreve o fluxo real e é aplicada (`canTransition`/`assertTransition`, checados antes de
  qualquer persistência em todo handler de clique desta fase), e `hasEdital` é só uma função
  derivada (seção 3).
- Nenhuma tela toca `localStorage`, `sessionStorage` ou `fetch` diretamente fora de
  `components/ui/` (confirmado por grep, seção 3).
- Nenhum dos arquivos protegidos (`src/index.css`, `src/data.ts`,
  `src/components/ui/`, lógica de `lib/core`) foi tocado por Tasks 14–16.

**Próximo plano:** Fase 1C — diagnóstico obrigatório, plano quinzenal e sessões de estudo.
