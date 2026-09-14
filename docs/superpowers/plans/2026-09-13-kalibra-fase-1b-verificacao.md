# Verificação final da Fase 1B — Kalibra

Data: 2026-09-14
Branch: `fase-1b-edital-aprovacoes`
Commits da fase: `6cfd665` (modelar conceito global em `lib/core`) .. `432a0a9` (docs:
corrigir fix round 2 da revisão das tasks 14-16) + este registro (fix round 3, um único
commit) — 33 commits antes deste documento, 34 com ele.
Escopo direto deste registro: Tasks 14–16 (`f1c8f9e`, `cf5c2b0`, `f79a96d`), o fix round 1
sobre elas (`4092764`, `c6fd346` — dois achados Críticos/Importantes e um Importante
adicional, mais três menores, seção 10), o fix round 2 sobre o próprio fix round 1
(`114d55c` — um achado Importante que virou uma escrita órfã, e um achado menor de PD-06,
seção 11) e o fix round 3 sobre o fix round 2 (achado residual do achado A — a recusa que
faltava implementar — e um vazamento de armazenamento assimétrico entre aprovar e rejeitar,
seção 12; este é o fix round que a coordenação declarou como o último desta fase). As Tasks
1–13 já têm sua própria verificação implícita nas mensagens de commit e nos fix rounds
registrados nelas; este documento não re-deriva o que já foi decidido lá, só confirma que o
estado final (depois de Tasks 14–16 e dos três fix rounds) continua consistente com tudo isso.

## 1. Contagem de testes por pacote

```
$ pnpm run test
```

| Pacote | Arquivos de teste | Testes |
|---|---|---|
| `lib/core` | 11 | 187 |
| `artifacts/kalibra` | 16 | 219 |
| **Total** | **27** | **406** |

Detalhe por arquivo, `lib/core` (187, intocado por Tasks 14–16 e pelos três fix rounds):

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

Detalhe por arquivo, `artifacts/kalibra` (219):

| Arquivo | Testes |
|---|---|
| `domain/adapters/local/workspaces.test.ts` | 37 |
| `pages/EditalRevisar.test.tsx` | 34 |
| `domain/adapters/local/approvals.test.ts` | 28 |
| `__tests__/screens.snapshot.test.tsx` | 22 |
| `domain/adapters/local/syllabus.test.ts` | 18 |
| `domain/adapters/local/concepts.test.ts` | 16 |
| `pages/Edital.test.tsx` | 15 |
| `components/SyllabusTree.test.tsx` | 11 |
| `components/EditalUploadProgress.test.tsx` | 10 |
| `domain/adapters/local/extraction.test.ts` | 7 |
| `components/AvailabilityFields.test.tsx` | 4 |
| `lib/date-utils.test.ts` | 4 |
| `pages/Aprovacoes.test.tsx` | 4 |
| `components/SourceExcerpt.test.tsx` | 3 |
| `components/CargoFilter.test.tsx` | 3 |
| `pages/NovoWorkspace.test.tsx` | 3 |

`lib/core` continua puro (sem I/O) — a espinha do domínio descrita no "Estado ao fim da Fase
1B" do plano: conceito global, programa de estudo, deduplicação, contrato de extração, diff
de versões e fila de aprovação, tudo testado sem tocar `localStorage`/`fetch`/relógio.

Evolução dos números de `artifacts/kalibra` nesta rodada: 200 (antes de Tasks 14–16) → 210
(Task 14 +5, Task 15 +5) → 213 no fix round 1 (`EditalRevisar.test.tsx` 26 → 28: um teste
para cada achado Crítico/Importante do "fix único" — seção 10; `Aprovacoes.test.tsx` 3 → 4:
um teste para o achado do link cruzando workspace) → 216 no fix round 2
(`EditalRevisar.test.tsx` 28 → 31: um teste para o achado A confirmando, um para o achado A
descartando, um para o achado B — seção 11) → 219 no fix round 3
(`EditalRevisar.test.tsx` 31 → 34: dois testes para o achado A residual — sem rascunho
algum, e com um rascunho corrompido — e um para o achado B — seção 12).

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
Resultado: **passou** (exit 0), sem erros em nenhum dos 4 pacotes com typecheck. (O fix round
1 quebrou o typecheck uma vez no caminho — `within(row())` recebendo `Element` em vez de
`HTMLElement` num teste novo — corrigido com um cast antes deste resultado final; não chegou
a ser commitado quebrado. Os fix rounds 2 e 3 não quebraram o typecheck em nenhum momento.)

### `pnpm run test`

```
lib/core:            11 arquivos, 187 testes — passou
artifacts/kalibra:   16 arquivos, 219 testes — passou
```
Resultado: **passou**. Ver seção 4 para as execuções sob fusos diferentes (mesmo resultado nas
três, 0 snapshots reescritos, depois de cada um dos três fix rounds).

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

Os greps 1, 2 e 4 deram exatamente a mensagem de confirmação esperada. **Nota sobre o grep
1:** na primeira passada do fix round 1, os comentários novos de `EditalRevisar.tsx`
(explicando por que a fila substitui o armazenamento por aba) citavam literalmente as
palavras `` `localStorage` `` e `` `sessionStorage` `` em prosa, e o grep — que não distingue
comentário de código — os pegou. Reescritos para descrever o mesmo mecanismo sem citar as
APIs pelo nome (“armazenamento durável e compartilhado entre abas” / “armazenamento por
aba”); o grep volta a dar só a mensagem de confirmação, e nenhuma tela — comentário ou código
— toca essas APIs de verdade.

O grep 3 (`hasEdital`) não dá a mensagem de saída — o padrão `grep -v "hasEdital("` é literal
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

O Bash desta sessão descarta `TZ` — rodado via PowerShell, como o brief instruiu. Executado
quatro vezes: ao final de Tasks 14–16 (210 testes em `artifacts/kalibra`), de novo depois do
fix round 1 (213 testes), de novo depois do fix round 2 (216 testes) e de novo depois do fix
round 3 (219 testes), para confirmar a cada rodada que a correção não introduziu nenhuma
dependência de relógio nova.

```powershell
foreach ($tz in @("UTC","America/Sao_Paulo","Pacific/Kiritimati")) { $env:TZ = $tz; pnpm run test }
```

| Fuso | `lib/core` | `artifacts/kalibra` | Snapshots reescritos |
|---|---|---|---|
| `UTC` | 187 passou | 219 passou | 0 |
| `America/Sao_Paulo` | 187 passou | 219 passou | 0 |
| `Pacific/Kiritimati` | 187 passou | 219 passou | 0 |

Resultado idêntico nos três fusos (406 testes passando em cada rodada, depois do fix round 3),
nenhuma linha `Snapshots … written/updated` em nenhuma das três execuções — exatamente o
esperado pelo brief. `Pacific/Kiritimati` (UTC+14, o fuso mais adiantado do mundo) e `UTC` são
os extremos mais prováveis de expor um `new Date()` sem fuso explícito; `lib/core` não lê
relógio algum (grep da seção 3), e o congelamento de tempo do frontend
(`screens.snapshot.test.tsx`, via `vi.useFakeTimers()`/`vi.setSystemTime()`, herdado da Fase
1A) já resolve o determinismo ali. Nenhum dos testes novos dos três fix rounds usa relógio
real — `readApprovals()`/`readWorkspaceStatus()`/`window.location.pathname` e as buscas por
`data-testid` não dependem de data.

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
  e estruturalmente sã nas telas que Tasks 14–15 e os três fix rounds tocaram.
- Os 219 testes de `artifacts/kalibra` (incluindo 22 em `screens.snapshot.test.tsx`, que
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
- O comportamento real de fechar a aba/reiniciar o navegador que os achados 1 (fix round 1),
  A/B (fix round 2) e o achado A residual (fix round 3) descrevem — os testes que os cobrem
  (seções 10, 11 e 12) simulam a perda de `sessionStorage` chamando
  `window.sessionStorage.clear()` entre dois `render()`, que é a aproximação mais fiel
  disponível em jsdom, mas não é literalmente fechar uma aba do navegador.

A evidência de que Tasks 14–16 e os três fix rounds estão corretos descansa inteiramente sobre
a suíte de testes (que mocka Clerk e roda em jsdom, não num navegador) e sobre a leitura manual
dos diffs de snapshot antes de cada `-u` (seção 6) — não sobre inspeção visual real. Isto está
registrado como lacuna aberta, não como "verificado".

## 6. Snapshots que mudaram nesta fase (Tasks 14–16 e os três fix rounds), e por quê

Duas rodadas de atualização de snapshot em Tasks 14–16, uma por task de produto; ambos os
diffs foram lidos por completo antes de rodar `-u`, como o brief exige. **Nenhum dos três fix
rounds moveu snapshot algum** (seção 4 confirma 0 reescritos, nas três rodadas de fuso, depois
de cada correção) — fix round 1 (achados 1, 2 e 3) muda ONDE a proposta é lida e PARA ONDE um
link aponta, não o HTML renderizado nos casos que os snapshots exercitam: a rota
`/edital/revisar/1` sem importação pendente (achados 1/2 só importam quando existe uma
revisão em andamento) e o item de exemplo de `/aprovacoes` (`workspaceId: 'setec-campinas'`,
igual ao workspace da rota visitada — achado 3 só muda o href quando os dois divergem, caso
que nenhum fixture de snapshot cobre; coberto por um teste dedicado em vez disso, seção 10).
Fix round 2 (achados A e B) só muda o que acontece numa revisão RETOMADA de um workspace
ainda não criado ou sem incertezas registradas — nenhuma rota do arquivo de snapshot está
nesse estado (o fixture de `/edital/revisar/1` usado ali é sempre `setec-campinas`, que já
existe em `defaultPrograms`); coberto pelos três testes dedicados da seção 11. Fix round 3
(achado A residual e achado B) muda só a recusa de `handleConfirm` para um item sem rascunho
reconstruível, e o payload que `reject` grava — de novo, nenhum fixture de snapshot está
nesses estados; coberto pelos três testes dedicados da seção 12.

### Task 14 — `renderiza /aprovacoes com itens pendentes de forma estável`

Único elemento do diff: o cartão do item `edital_structure` (`appr-2`, fixture do próprio
teste) perdeu a caixa de seleção (`checkbox-select-appr-2`) e o par de botões
Aprovar/Rejeitar (`button-approve-appr-2`, `button-reject-appr-2`). Nada mais mudou no
snapshot — o cartão `appr-1` (`concept_merge`) e todo o resto da página permaneceram
byte a byte idênticos.

**Por quê:** a persistência do programa mora inteira em `EditalRevisar.handleConfirm`. Se
`ApprovalCard` continuasse oferecendo Aprovar/Rejeitar inline para `edital_structure`, um
clique em "Aprovar" na fila decidiria o item sem nunca escrever o programa — a fila diria
"aprovado" e nada teria mudado de fato. `ApprovalCard.tsx` passou a esconder essa decisão
inline só para este tipo (`decidableInline = item.type !== 'edital_structure'`), deixando só
o link "Revisar estrutura" (que já existia) como caminho de decisão.

### Task 15 — `renderiza /workspace/setec-campinas/edital de forma estável`

Diff completo (relido para este registro a partir do `.snap` do commit `cf5c2b0`, linha a
linha — a descrição anterior deste documento cobria só parte dele):

1. **Eyebrow**: `"estrutura da prova · 84 tópicos mapeados"` → `"estrutura da prova · 0
   tópicos mapeados"`.
2. **Bloco novo do filtro de cargo** (`CargoFilter`), inserido entre o cabeçalho e o cartão de
   filtros — não existia na versão mocada:
   ```html
   <div class="space-y-2">
   <p class="k-eyebrow">tópicos de</p>
   <div class="flex flex-wrap items-center gap-2" data-testid="cargo-filter">
   <button ... data-testid="cargo-filter-todos">todos os cargos</button>
   <button ... data-testid="cargo-filter-c1">Analista Técnico (Informática)</button>
   <button ... data-testid="cargo-filter-c2">Agente de Suporte Técnico</button>
   </div>
   </div>
   ```
3. **Select de matéria**: as três `<option>` de `@/data` (Língua Portuguesa, Matemática e
   Raciocínio Lógico, Conhecimentos Específicos) desaparecem — sobra só `<option>Todas</option>`,
   porque o fixture do snapshot não tem programa salvo e `subjectOptions` é derivado dele.
4. **Select de prioridade** ganha `disabled=""` e
   `title="Prioridade chega com o diagnóstico (Fase 1C) — ainda não há dado para filtrar."`.
5. **Badge de contagem**: `8 tópicos` → `0 tópicos`.
6. **As oito linhas mocadas de `@/data`** (Razão/proporção, Porcentagem, Conjuntos numéricos,
   Interpretação de textos, Concordância e regência, Lei de Acesso à Informação, Administração
   pública direta, Ética no serviço público — cada uma com sua barra de progresso, chip de
   prioridade colorido, `%` de acerto e status) são inteiramente removidas.
7. **Substituídas por um único bloco de estado vazio**:
   ```html
   <div class="p-8 text-center text-[12px] text-[#8e98a8]" data-testid="edital-topics-empty">
   Nenhum tópico no programa ainda — importe e confirme um edital para ver a estrutura aqui.
   </div>
   ```

Nada em nenhuma outra rota do snapshot mudou.

**Por quê:** o fixture padrão do workspace `setec-campinas` usado pela suíte de snapshot não
tem programa de estudo salvo (`kalibra_syllabus:*` nunca foi semeado nesse teste) — então,
puxando de `useSyllabus` em vez de `@/data`, a lista honestamente aparece vazia, o filtro de
matéria não tem opção nenhuma para oferecer além de "Todas", e o filtro de prioridade — que
nunca pode filtrar nada de verdade até o diagnóstico (Fase 1C) — fica desabilitado com uma
explicação em `title`. Isto é exatamente o comportamento que a Task 15 pede: a tela não pode
mais fingir 84 tópicos que não existem. O comportamento com programa real (linhas reais, chip
de item comum, filtro de cargo restringindo a lista, células honestas) está coberto pelos 5
testes novos de `Edital.test.tsx` (seção 1), que semeiam `kalibra_syllabus:*` diretamente —
fora do loop de snapshot, porque o fixture do snapshot é deliberadamente o caso "workspace sem
programa ainda".

Nenhuma outra rota do arquivo de snapshot (`/portal`, `/workspace/setec-campinas`,
`/workspace/setec-campinas/edital/revisar/1`, `/aprovacoes` sem itens, etc.) moveu em nenhuma
das duas rodadas de Tasks 14–16 nem nas rodadas dos três fix rounds — confirmado lendo a lista
completa de testes de `screens.snapshot.test.tsx` em cada execução (16 rotas de `it.each`,
todas com `✓` nas execuções sem mudança de snapshot, exceto a rota afetada em cada uma das
duas rodadas que tiveram mudança real). Depois de cada `-u`, a suíte completa foi rodada de
novo e confirmou 0 escritas adicionais (e as rodadas sob fuso diferente, seção 4, confirmam
isso de novo, inclusive depois de cada fix round).

## 7. O que Tasks 14–16 e os três fix rounds mudaram, resumido

- **Task 14** (`f1c8f9e`): ao montar `EditalRevisar` com uma proposta para revisar, um item
  `edital_structure` entra na fila (`payloadBefore` = programa salvo, ou `null` na primeira
  importação). "Confirmar estrutura" **grava o programa e depois aprova esse item** (nessa
  ordem — ver a correção da seção 9); "Descartar" rejeita. A checagem de `canTransition`
  continua acontecendo antes de qualquer persistência (nenhum retrocesso ao padrão que já
  causou dois achados Críticos nesta fase). `ApprovalCard`/`Aprovacoes.tsx` deixam de
  oferecer decisão inline para `edital_structure` — só o link para a tela dedicada.
- **Task 15** (`cf5c2b0`): `Edital.tsx` lê `useSyllabus` em vez de `@/data`; itens-folha do
  programa são as linhas da tabela, o item pai vira a coluna "matéria". Ganhou `CargoFilter`
  (filtra a lista e mostra `totalQuestionsFor` do cargo selecionado) e um aviso de
  deduplicação (`isCommon`) quando algum tópico é comum a mais de um cargo. Prioridade e
  acerto mostram estado honesto ("sem dados" / "sem dados até o diagnóstico") em vez de zero
  fabricado; o filtro de prioridade fica desabilitado até existir dado real.
- **Task 16** (`f79a96d`): a primeira versão deste documento.
- **Fix round 1** (`4092764`, `c6fd346`): três achados de uma revisão de código —
  detalhados na seção 10. Em resumo: a proposta em revisão passou a ser reconstruída a partir
  do próprio item da fila (nunca mais de `sessionStorage`), o item aprovado passou a registrar
  a árvore realmente gravada (não a proposta congelada no enfileiramento), e o link "Revisar
  estrutura" passou a apontar sempre para o workspace dono do item. `payloadAfter` de
  `edital_structure` mudou de forma: `{ version, syllabus, mergedCount }` (Task 14) →
  `{ version, review, mergedCount }`, onde `review` é o `DedupResult` inteiro (`syllabus`,
  `merged`, `newConcepts`, `proposedLinks`) — necessário para reconstruir a proposta
  completa a partir só do item da fila, sem depender de `sessionStorage`.
- **Fix round 2** (`114d55c`): dois achados sobre o resultado do fix round 1 —
  detalhados na seção 11. Em resumo: retomar da fila uma importação de workspace NOVO ainda
  não criado, sem `sessionStorage`, deixava de travar (fix round 1) mas passava a gravar
  Syllabus, conceitos e uma aprovação para um workspace que `handleConfirm` nunca chegava a
  criar (achado A, crítico na prática); e o bloco "Não encontrado no edital" (PD-06)
  desaparecia numa retomada porque as incertezas continuavam presas a `sessionStorage`
  (achado B). `payloadAfter` ganhou dois campos: `uncertainties` e `workspaceDraft`.
- **Fix round 3** (um único commit, o último desta fase): dois achados sobre o resultado do
  fix round 2 — detalhados na seção 12. Em resumo: a recusa que o achado A do fix round 2
  deveria ter implementado ("carregar o que precisa, ou recusar completar") nunca foi
  escrita — só o "carregar" existia, e um item sem rascunho reconstruível ainda caía no
  `updateWorkspace` silencioso de um slug ausente (achado A residual, corrigido agora com a
  recusa de fato); e `reject` não anulava `workspaceDraft` como `approve` já fazia, deixando
  o edital colado inteiro (`sourceText`) preso para sempre num item rejeitado (achado B,
  assimetria de armazenamento).

## 8. Desvios encontrados

- **O grep de `hasEdital` (seção 3) não produz a mensagem de saída esperada pelo brief**,
  mas por uma limitação do próprio padrão (`grep -v "hasEdital("` casa a linha de `import`
  também), não por uma regressão real — analisado em detalhe na seção 3. Nenhuma mudança de
  código foi necessária; o invariante que o grep tenta proteger continua de pé.
- **O grep 1 (persistência) também precisou de um ajuste de prosa** no fix round 1: comentários
  novos citavam `` `localStorage` ``/`` `sessionStorage` `` pelo nome, e o grep — que não
  distingue comentário de código — os pegou. Reescritos para descrever o mesmo mecanismo sem
  citar as APIs; nenhum código foi tocado, só texto de comentário (seção 3).
- **Task 14 mudou o comportamento de testes já existentes de `EditalRevisar.test.tsx`**: várias
  asserções de `readApprovals()).toHaveLength(0)` (antes de confirmar) e `toHaveLength(2)`
  (depois de confirmar, só `concept_merge`) passaram a `1` e `3` respectivamente, porque
  agora existe um item `edital_structure` pendente assim que a proposta é computada. Isto é
  a mudança de comportamento que a própria Task 14 pede (a decisão passa a ser explícita na
  fila, não mais implícita) — os testes foram atualizados para refletir o novo contrato, com
  comentários explicando a contagem nova em cada um.
- **Decisão de design não coberta literalmente pelo brief da Task 14**: esconder
  Aprovar/Rejeitar/seleção em lote para `edital_structure` em `ApprovalCard.tsx` não estava no
  texto do brief (que só lista `EditalRevisar.tsx`/`Aprovacoes.tsx` como arquivos a
  modificar), mas era necessário para não abrir um caminho onde aprovar pela fila decide o
  item sem nunca escrever o programa — a mesma classe de bug que a Task 14 existe para
  fechar. Documentado no commit de Task 14 e na seção 6.
- **Coluna "status" da tabela do Edital (Task 15)**: o brief pede estado honesto só para
  prioridade e acerto por tópico; "status" (dominar/em andamento/não iniciado) não tem essa
  ressalva explícita. Decisão tomada: todo tópico mostra "não iniciado", porque isso é
  literalmente verdadeiro nesta fase (não existe nenhum mecanismo de sessão de estudo ainda)
  — não é uma fabricação, é a única resposta honesta possível hoje. O filtro de status
  continua funcional (selecionar "não iniciado" mostra tudo; selecionar outra opção mostra
  vazio, corretamente).
- **Verificação manual em navegador (Step 4)**: não realizada, por ausência de
  `VITE_CLERK_PUBLISHABLE_KEY` e de ferramenta de automação de navegador neste ambiente —
  mesma lacuna já registrada nas Fases 0 e 1A, reconfirmada aqui para Tasks 14–16 e os três
  fix rounds (seção 5). A tentativa de subir `pnpm run dev` e confirmar o boot do servidor foi
  feita antes de descartar o passo, não só por leitura de código.
- **A escolha entre href absoluto e filtro por workspace (achado 3, seção 10)**: o brief
  deixava as duas opções em aberto, pedindo para justificar a escolhida. Optou-se por href
  absoluto — justificativa completa na seção 10.
- **Correção factual sobre a ordem de escrita do `handleConfirm`** (achado menor da revisão):
  este documento e o relatório da task chegaram a afirmar que o item era aprovado ANTES de o
  programa ser gravado. O código sempre fez o contrário — concede os conceitos, grava o
  Syllabus, e só então aprova o item da fila — e essa ordem não mudou no fix round 1 (só o
  QUE é gravado no `approve`, não a posição da chamada). A afirmação errada foi corrigida
  nas seções 6 e 7 deste documento e no relatório da task; ver seção 10 para o detalhe.
- **Três correções factuais adicionais pedidas na revisão do fix round 2** (detalhadas na
  seção 12, junto com os dois achados do fix round 3): o follow-up sobre a fila entre
  workspaces dizia que a contagem "aguardando decisão" fica na Shell — ela não tem badge de
  aprovações nenhum; o chip é na própria tela `/aprovacoes`, só a localização estava errada,
  a substância (a contagem é global, nunca escopada ao workspace atual) continua certa; o
  follow-up sobre um item no formato anterior ao fix round 1 dizia que os dois botões viram
  no-op — Descartar sim, mas Confirmar não: sem `review`, ainda cai no `updateWorkspace`,
  grava `importStatus`/status/`nextAction` e navega; e nenhum dos dois documentos registrava
  que o payload da fila carrega o edital colado inteiro para o `localStorage`, nem a
  assimetria entre aprovar (que já anulava o rascunho) e rejeitar (que não anulava, até o
  achado B do fix round 3 corrigir isso).
- Nenhum outro desvio, classe nova fora do esperado, elemento removido ou mudança de texto
  foi encontrado nas etapas que puderam ser executadas (typecheck, build, testes, greps).

## 9. Correção factual: a ordem real de `handleConfirm`

A submissão original de Tasks 14–16 (este documento e o relatório da task) afirmou que
"Confirmar estrutura" aprova o item da fila **antes** de gravar o programa. Isso está
invertido — sempre foi, mesmo antes do fix round 1 — e importa porque é exatamente o
raciocínio de "torn write" que justifica a ordem `canTransition` → persistência (fix round 2
da Task 11/EditalRevisar, já registrado nesta fase) não pode carregar uma afirmação errada
sobre qual escrita vem primeiro.

A ordem real, em `EditalRevisar.handleConfirm`, dentro do bloco `if (review)`, sempre foi:

1. `review.newConcepts.forEach((concept) => conceptsApi.addConcept(concept))` — conceitos
   provisórios novos entram na biblioteca global.
2. `syllabusApi.save(review.syllabus)` — o programa é gravado.
3. `approvalsApi.approve(structureApprovalId, payload)` — **só então** o item `edital_structure`
   é aprovado (no fix round 1, com o payload atualizado para a árvore recém-gravada).
4. `review.proposedLinks.forEach(...)` — os itens `concept_merge` são enfileirados.
5. `stageWorkspaceImport(..., { extractionApplied: true })`.

O comportamento sempre foi correto (nenhuma escrita depende de a aprovação já ter acontecido);
só a descrição em prosa estava com a ordem trocada. Corrigido nas seções 6 e 7 deste
documento e no relatório da task (`task-14-16-report.md`).

**Adendo do fix round 3**: `handleConfirm` ganhou uma checagem ANTES de todo este bloco — se
existe `review` mas nem o workspace existe nem há rascunho reconstruível, a função recusa e
retorna, sem chegar ao passo 1. Não muda a ordem descrita acima (que continua sendo a ordem
das escritas QUANDO elas acontecem); só adiciona um portão antes de qualquer uma delas — ver
seção 12.

## 10. Fix round 1 — revisão e correção

Uma revisão de código sobre Tasks 14–16 confirmou que o ciclo funciona, o invariante de
aprovação humana se mantém, os estados vazios honestos estão corretos, e este documento de
verificação foi julgado genuinamente honesto (números reconferidos estaticamente). Encontrou,
porém, três achados reais — os dois primeiros com a mesma causa raiz — e três menores.

### Achado 1 (Crítico) — um item `edital_structure` podia ficar indecidível para sempre

O item de aprovação é durável (`localStorage`). A proposta que ele representa vivia em
`sessionStorage`, por aba. Fechar a aba no meio da revisão, reiniciar o navegador, ou abrir a
fila numa segunda aba deixava o item pendente apontando para uma proposta que não existia
mais em lugar nenhum: nem `EditalRevisar.handleConfirm` nem `handleDiscard` tinham como agir
sobre ele (`structureApprovalId` nascia `null`, e o botão virava no-op) — o "aguardando
decisão" da fila ficava permanentemente errado.

### Achado 2 (Importante) — o item aprovado podia registrar uma proposta que não era a gravada

`payloadAfter` era gravado uma vez, no enfileiramento, e nunca atualizado. Toda edição depois
disso — renomear, excluir, separar, mudar peso/questões, adicionar — mudava o que
`handleConfirm` de fato gravava no programa sem nunca atualizar o registro da fila. O ponto
inteiro da fila é que nada entra no programa sem uma aprovação registrada; se o registro
descreve uma árvore diferente da que entrou, a garantia é só aparente.

### Fix único para os dois achados

`EditalRevisar` deixou de tratar `sessionStorage` como a fonte da proposta. Ao montar, procura
na fila (por `workspaceId` + versão da URL + `canDecide(status)`) um item `edital_structure`
já pendente; se existe, a proposta É `payloadAfter.review` dele — reconstruída, não
recomputada (recomputar via `previewExtraction` geraria ids de conceito novos a cada
montagem, via `Math.random`, e desalinharia a tela do que está gravado). Só quando nenhum
item assim existe é que a proposta nasce de `previewExtraction` (extração recém-terminada
nesta aba) e é enfileirada agora. `approve(id, payload)` — `useApprovals.approve` ganhou um
segundo parâmetro opcional — grava a árvore **já editada** como novo `payloadAfter` na MESMA
escrita que decide o item, nunca duas chamadas separadas que poderiam divergir.

Dois testes novos em `EditalRevisar.test.tsx` (describe "Task 14 — aprovação da estrutura
fecha o ciclo") cobrem a propriedade pedida:

- `fix round 1 (achado 1): perder o sessionStorage (fechar a aba, reiniciar o navegador) não
  deixa o item pendente para sempre` — monta, desmonta, `window.sessionStorage.clear()`,
  monta de novo, confirma, e afirma que o Syllabus foi gravado e o item ficou `aprovado`.
- `fix round 1 (achado 2): o item aprovado registra a árvore EDITADA (renomear + separar),
  não a proposta congelada no enfileiramento` — usa a fixture de um item comum a dois cargos,
  renomeia o item e depois o separa de um cargo (as duas edições que o achado citou), confirma,
  e afirma `approvedPayload.review.syllabus` igual (via `toEqual`) ao Syllabus realmente lido
  de volta do `localStorage` — a propriedade exata que o achado pediu para estabelecer.

O campo `PendingWorkspaceImport.approvalItemId`, adicionado pela Task 14 original para dar
idempotência entre remontagens, foi removido: a busca por `workspaceId` + versão na própria
fila cumpre o mesmo papel sem depender de `sessionStorage` — a causa raiz dos achados 1 e 2.

### Achado 3 (Importante) — o link da fila ignorava o workspace do próprio item

`ApprovalCard` montava `href={\`/edital/revisar/${versão}\`}` — um caminho relativo, resolvido
pelo `WouterRouter` aninhado de `WorkspaceApp.tsx` (`base={"/workspace/" + slug}`) contra o
`slug` do workspace **atual**, não o do item. A fila, por sua vez, não filtra por
`workspaceId` — é um inbox entre workspaces (mesmo padrão dos itens `concept_merge`, cuja
biblioteca de conceitos também é global). Abrir `/aprovacoes` a partir do workspace A e
clicar em "Revisar estrutura" de um item do workspace B navegava para dentro de A.

**Escolha: href absoluto para `item.workspaceId`, não filtrar a fila por workspace.**
Justificativa: a fila não tem hoje nenhum indício de que "só os itens deste workspace"
seja o modelo pretendido — nem a cópia da tela ("Nada vira conteúdo oficial sem você decidir",
sem menção a workspace) nem o outro tipo de item (`concept_merge`, cuja biblioteca de
conceitos já é global ao usuário, não por workspace) sugerem isso. Filtrar mudaria
comportamento visível (itens de outros workspaces sumiriam da lista) por causa de um bug de
roteamento; corrigir só o link resolve o bug na raiz sem essa mudança de escopo. A implementação
(`reviewHrefFor`) usa o mesmo prefixo `~` que `EditalRevisar.tsx` já usa para escapar o Router
aninhado (`~${import.meta.env.BASE_URL}workspace/${item.workspaceId}/edital/revisar/${versão}`),
confirmado como a convenção oficial do wouter (`src/index.js`: `targetPath[0] === "~" ?
targetPath.slice(1) : router.base + targetPath`), não um hack local.

Teste novo em `Aprovacoes.test.tsx` ("o link da estrutura sempre aponta para o workspace DONO
do item"): semeia um item `edital_structure` com `workspaceId: 'outro-workspace'`, visita
`/workspace/setec-campinas/aprovacoes`, e afirma que o atributo `href` resolvido do link é
`/workspace/outro-workspace/edital/revisar/1` — nunca contendo `setec-campinas`.

### Três achados menores

- **Erro de concordância em `ApprovalCard`**: `` `já vem${n === 1 ? '' : 'm'}` `` produzia
  "já vemm unidos" para mais de um item — "vem" no plural é "vêm" (circunflexo), não "vemm"
  (dobrar a consoante). Corrigido trocando a palavra inteira por condição
  (`mergedCount === 1 ? 'já vem' : 'já vêm'`), não um sufixo colado.
- **Ordem de escrita descrita ao contrário** neste documento e no relatório da task — ver
  seção 9 para a correção completa.
- **Descrição incompleta do snapshot da Task 15** neste documento — cobria só o eyebrow, as
  linhas mocadas e o estado vazio; faltava o bloco inteiro do `CargoFilter`, o select de
  prioridade desabilitado com `title`, e o select de matéria reduzido a uma única opção.
  Completada na seção 6.

### Um ponto estacionado, registrado e não corrigido

Cada item `edital_structure` agora guarda o `DedupResult` inteiro (duas vezes — uma no
enfileiramento, outra reescrita no `approve`), e itens decididos nunca são removidos da fila:
`localStorage` cresce a cada reimportação, e `saveApprovals` não trata cota esgotada (um throw
ali aconteceria DEPOIS da gravação do Syllabus, um "torn write" da mesma família que o fix
round 2 da Task 11 já corrigiu para o status do workspace). Real, mas fica para a fase que
introduzir limites de armazenamento — e a forma do payload já mudou uma vez neste próprio fix
round, então qualquer decisão de formato agora arriscaria mudar de novo em breve.

### Gate re-executado depois da correção

`pnpm run typecheck` (passou, depois de corrigir um erro de tipo num teste novo —
`within(row())` recebendo `Element` em vez de `HTMLElement`, resolvido com um cast antes deste
resultado), `pnpm run test` (400 testes — 187 `lib/core` + 213 `artifacts/kalibra` — passando,
três vezes sob fusos diferentes, seção 4, 0 snapshots reescritos em todas), `pnpm run build`
(passou, mesmos dois avisos pré-existentes da seção 2).

**Arquivos tocados neste fix round:**
`artifacts/kalibra/src/pages/EditalRevisar.tsx` (fonte da proposta reconstruída da fila,
`approve` com payload atualizado), `artifacts/kalibra/src/pages/EditalRevisar.test.tsx` (dois
testes novos, um teste existente ajustado para não depender mais de
`pending.approvalItemId`), `artifacts/kalibra/src/domain/adapters/local/approvals.ts`
(`approve` ganha o segundo parâmetro opcional), `artifacts/kalibra/src/domain/adapters/local/workspaces.ts`
(campo `approvalItemId` removido), `artifacts/kalibra/src/components/ApprovalCard.tsx`
(`reviewHrefFor` absoluto, concordância corrigida), `artifacts/kalibra/src/pages/Aprovacoes.test.tsx`
(teste novo do link cruzando workspace), e este documento + o relatório da task (achado da
ordem de escrita, seção 9). Nenhum arquivo em `lib/core`, `src/index.css`, `src/data.ts` ou
`src/components/ui/` foi tocado. Nenhum snapshot moveu (seções 4 e 6).

## 11. Fix round 2 — revisão e correção

Uma segunda revisão de código confirmou os seis achados do fix round 1 como corrigidos, com
evidência forte de sonda: a fila é genuinamente a fonte da proposta com `sessionStorage`
esvaziado, a árvore gravada bate campo a campo com `payloadAfter` depois de renomear e
separar, e o link cruzando workspace chega e decide o item certo. Encontrou, porém, dois
problemas novos no próprio caminho de retomada que o fix round 1 introduziu.

### Achado A (Importante) — retomar a importação de um workspace NOVO escrevia dado órfão

`NovoWorkspace` só **estagia** o rascunho em `sessionStorage`; `addWorkspace` só era chamado
dentro de `handleConfirm`, no ramo que exigia `pending.isNew && pending.workspace`. Depois de
perder a aba, esse ramo nunca era alcançado (`pending` vazio) e o `else` rodava
`updateWorkspace` sobre um slug ausente da lista — um `.map` que não casa nada, sem avisar
nada. Antes do fix round 1, o mesmo clique não escrevia nada (o item ficava só preso, achado
1). Depois dele, passou a escrever Syllabus, conceitos e uma aprovação `aprovado` afirmando
que um programa entrou num workspace que nunca chegou a existir — exatamente no cenário de aba
fechada que o achado 1 existia para corrigir. Um achado real revelado pelo próprio fix
anterior, não uma regressão dele na correção que já tinha sido feita.

**Fix**: o rascunho do workspace (`WorkspaceDraft`) viaja no mesmo `payloadAfter` da proposta,
gravado quando a importação é nova (`pending.isNew`) e reconstruído por `migrateWorkspace` — a
mesma validação, já testada, usada para qualquer registro de workspace salvo, em vez de
confiar cegamente no formato do payload. `workspace`, `workspaceDraft` (o rascunho, de
`pending` ou da fila) e `workspaceExists` (existe de verdade na lista?) passaram a ser
resolvidos uma vez só, usados tanto por `handleConfirm` (decide `addWorkspace` vs
`updateWorkspace`, e o status de partida — substituindo um `if (pending?.isNew)` espalhado por
uma única fonte) quanto por `handleDiscard` (evita mandar para `/edital` de um workspace
fantasma quando a criação nunca aconteceu).

Três testes novos em `EditalRevisar.test.tsx` cobrem o cenário fim a fim com um slug
(`novo-concurso`) que não existe em `defaultPrograms` — de propósito, para que
`workspaces.find(...)` nunca ache um registro por coincidência:

- `fix round 2 (achado A, crítico): retomar uma importação NOVA sem sessionStorage cria o
  workspace ao confirmar, não deixa dado órfão` — fecha a aba, confirma, e afirma que o
  workspace existe na lista depois, com Syllabus e aprovação consistentes.
- `fix round 2 (achado A): descartar uma importação NOVA retomada sem sessionStorage não cria
  o workspace nem escreve nada` — mesma retomada, mas descartando: nenhuma escrita em
  `localStorage`, e a navegação vai para o portal (`window.location.pathname`), não para
  `/edital` de um workspace fantasma.

Verificados como não-vácuos: revertendo temporariamente `workspaceDraftFromPayload` para
sempre devolver `null`, o primeiro teste falha (o workspace não é criado) — confirmando que a
asserção pega o bug de verdade, não só a forma do teste.

### Achado B (Menor, mas é PD-06) — o bloco "Não encontrado no edital" sumia numa retomada

`uncertainFields` ainda lia as incertezas de `pending.extractionOutput.uncertainties`, que o
payload da fila não carregava — numa retomada, a lista virava `[]` e o bloco inteiro
desaparecia, escondendo do humano decidindo exatamente o que PD-06 existe para mostrar: o que
a extração não conseguiu achar. O filtro de cargo também sumia no mesmo cenário, mas como
efeito colateral do achado A (sem `workspace` resolvido, `workspace.cargos` também sumia) —
resolvido de graça pelo fix do achado A, sem precisar carregar a lista de cargos à parte.

**Fix**: as incertezas viajam no mesmo `payloadAfter` (`uncertainties: string[]`), lidas de
volta por `uncertaintiesFromPayload`. Coberto pelo terceiro teste novo:

- `fix round 2 (achado B): retomar sem sessionStorage ainda mostra "Não encontrado no edital" e
  o filtro de cargo` — usa a mesma importação nova, com uma incerteza e dois cargos; depois de
  perder a aba, afirma que o bloco e o texto da incerteza aparecem, e que os dois chips do
  filtro de cargo (`cargo-filter-c1`, `cargo-filter-c2`) também aparecem.

### `payloadAfter` mudou de forma outra vez

`{ version, review, mergedCount }` (fix round 1) → `{ version, review, mergedCount,
uncertainties, workspaceDraft }`. O próprio fix round 1 (seção 10, "um ponto estacionado")
já previa isso: "a forma do payload já mudou uma vez … qualquer decisão de formato agora
arriscaria mudar de novo em breve" — o ponto estacionado sobre armazenamento (payload grande,
itens decididos nunca podados) continua sem correção, agora com dois campos a mais por item.
Note-se ainda que `workspaceDraft` carrega o `WorkspaceDraft` inteiro, inclusive
`sourceText` — o edital colado inteiro, potencialmente vários KB — dentro de
`payloadAfter`, que vai para `localStorage`. Nesta submissão, `approve` anula esse campo
(`workspaceDraft: null`) ao decidir, mas `reject` não anulava — uma assimetria que deixava um
item rejeitado carregando o texto colado para sempre, já que a fila não poda itens decididos;
corrigida no fix round 3 (seção 12, achado B).

### Dois pontos registrados nesta rodada — ver correções na seção 12

Os dois pontos abaixo foram registrados aqui na submissão original deste fix round, e a
revisão seguinte (fix round 3) corrigiu dois erros factuais na descrição de cada um — ver
seção 12 para o texto corrigido e para o que mudou de comportamento:

- **A fila entre workspaces não é coerente como está renderizada** — permanece um follow-up
  nomeado, não corrigido; a localização da contagem "aguardando decisão" citada aqui estava
  errada (não é a Shell), corrigida na seção 12.
- **Um item gravado no formato de payload anterior ao fix round 1** — a afirmação de que
  "os dois botões viram no-op" estava errada (só Descartar é no-op), corrigida na seção 12.
  Note-se também que este ponto é sobre um formato DIFERENTE do que o achado A residual do
  fix round 3 corrige: este aqui não tem `review` nenhum (payload de antes do fix round 1);
  o achado A residual é sobre um payload COM `review` mas sem `workspaceDraft` (formato do
  fix round 1, antes do fix round 2) — esse segundo caso passou a ser recusado explicitamente
  em vez de gravar dado órfão (seção 12); o primeiro (sem `review` nenhum) continua não
  recuperável, e essa parte não mudou.

### Gate re-executado depois da correção

`pnpm run typecheck` (passou, sem quebrar em nenhum momento), `pnpm run test` (403 testes —
187 `lib/core` + 216 `artifacts/kalibra` — passando três vezes sob fusos diferentes, seção 4,
0 snapshots reescritos em todas), `pnpm run build` (passou, mesmos dois avisos pré-existentes
da seção 2).

**Arquivos tocados neste fix round:** `artifacts/kalibra/src/pages/EditalRevisar.tsx`
(`workspaceDraft`/`uncertainties` no payload e na leitura de volta, `workspace`/
`workspaceDraft`/`workspaceExists` resolvidos uma vez, `handleConfirm`/`handleDiscard`
usando-os), `artifacts/kalibra/src/pages/EditalRevisar.test.tsx` (três testes novos). Nenhum
arquivo em `lib/core`, `src/index.css`, `src/data.ts` ou `src/components/ui/` foi tocado.
Nenhum snapshot moveu (seções 4 e 6).

## 12. Fix round 3 — revisão e correção (fecha a fase)

Uma terceira revisão confirmou os dois achados do fix round 2 como corrigidos sob execução: a
retomada de workspace novo cria o workspace, a retomada de workspace existente não o duplica,
descartar não escreve nada e cai no portal, e o bloco do PD-06 e o filtro de cargo sobrevivem
à retomada. `migrateWorkspace` foi verificado campo a campo, incluindo `period` (opcional) e
uma disponibilidade populada, sem perda. A mudança não pedida em `handleDiscard` (fix round 2)
foi julgada a extensão correta, não um aumento de escopo — ela responde à mesma pergunta que o
caminho de confirmar responde, e manter duas respostas diferentes num componente só teria sido
o defeito. Encontrou dois achados novos, os dois pequenos, um de cada lado da decisão.

### Achado A (o resíduo) — a recusa nunca foi implementada

O fix round 2 recebeu o pedido "carregue o que precisa, ou recuse completar" e implementou só
o carregar. Um item enfileirado ENTRE o fix round 1 e o fix round 2 — payload com `review`
presente, mas sem `workspaceDraft` (o campo não existia ainda) — faz `workspaceDraftFromPayload`
devolver `null`, indistinguível na chamada de "isto nunca foi uma importação nova". Os dois
casos caíam no mesmo `updateWorkspace` sobre um slug ausente: o mesmo no-op silencioso que o
achado A original apontou, ainda alcançável para qualquer item nesse formato intermediário.

**Fix**: um portão em `handleConfirm`, antes de qualquer escrita — quando `review` existe mas
nem `workspaceDraft` nem `workspaceExists` são verdadeiros, a função recusa: nada é gravado, o
item continua `pendente` na fila (decidível de novo caso o dado apareça por outro caminho), e
a tela mostra o motivo num bloco de erro (`data-testid="confirm-error"`, mesmo estilo visual
já usado em `Edital.tsx` para `updateError` — nenhuma classe nova). Dois testes cobrem os dois
sub-casos que o achado citou: payload com `review` e sem `workspaceDraft` nenhum, e payload com
um `workspaceDraft` corrompido (faltando `slug`, que `migrateWorkspace` rejeita) — os dois
semeados direto na fila, sem nunca passar por `stageWorkspaceImport`, reproduzindo exatamente
uma retomada fria de um item nesse formato. Verificados como não-vácuos: desligando
temporariamente o portão, os dois testes falham (o workspace nunca é criado, mas a asserção de
`toBeNull()` falha porque outros workspaces já estavam na lista — a escrita aconteceu de
qualquer forma, só não criou o slug esperado).

### Achado B (vazamento de armazenamento, assimétrico) — um item rejeitado guarda o edital cru para sempre

`payloadAfter.workspaceDraft` carrega o `WorkspaceDraft` inteiro, inclusive `sourceText` — o
texto colado do edital. `approve` já anulava esse campo (`workspaceDraft: null`) ao decidir;
`reject` não anulava, e itens decididos nunca são podados da fila. Uma colagem de 6,5 KB virava
uma entrada de fila de 7,8 KB que uma rejeição preservava para sempre.

**Fix**: `useApprovals.reject` ganhou o mesmo terceiro parâmetro opcional que `approve` já
tinha (`payloadAfter?: unknown`), e `EditalRevisar.handleDiscard` passa a chamar
`reject(id, undefined, { ...payload, workspaceDraft: null })` — a decisão de rejeitar é tão
terminal quanto a de aprovar, e nada rio abaixo volta a ler esse rascunho depois de decidido.
Coberto por um teste que descarta uma importação nova e confirma que `payloadAfter.workspaceDraft`
vira `null` no item rejeitado — verificado como não-vácuo revertendo temporariamente o `reject`
para ignorar o parâmetro novo, e confirmando que o teste falha (o rascunho sobrevive).

### Três correções de documento

- **Localização da contagem "aguardando decisão"**: o follow-up da fila entre workspaces
  (seção 11) dizia que essa contagem fica na Shell. Não fica — a Shell não tem badge de
  aprovações nenhum; o chip é na própria tela `/aprovacoes` (`<span className="k-chip
  k-chip-active">{pending} aguardando decisão</span>`, em `Aprovacoes.tsx`). A substância do
  follow-up continua certa (a contagem é global, nunca escopada ao workspace atual) — só a
  localização estava errada. Corrigido na seção 11.
- **Um item no formato anterior ao fix round 1 não faz os dois botões virarem no-op**: o
  follow-up dizia isso; está errado para "Confirmar". Sem `review` (este é o formato SEM a
  chave `review` nenhuma — `{ version, syllabus, mergedCount }` — diferente do formato do
  achado A residual acima, que TEM `review`), `handleDiscard` de fato não faz nada de
  observável na fila (nem `reject` é chamado, porque `structureApprovalId` nasce `null` junto
  com `review`) — mas `handleConfirm` não segue o mesmo caminho: a checagem `if (review) {...}`
  é pulada, mas o bloco de `addWorkspace`/`updateWorkspace` que vem depois dela SEMPRE roda,
  gravando `importStatus`, `status` e `nextAction` via `updateWorkspace` e navegando para
  `/edital`. Corrigido na seção 11.
- **Nenhum dos dois documentos registrava** que o payload da fila carrega o edital colado
  inteiro para `localStorage`, nem a assimetria entre aprovar e rejeitar. Acrescentado à seção
  11 (que agora descreve o comportamento CORRIGIDO, não mais o vazamento).

### Gate re-executado depois da correção

`pnpm run typecheck` (passou), `pnpm run test` (406 testes — 187 `lib/core` + 219
`artifacts/kalibra` — passando três vezes sob fusos diferentes, seção 4, 0 snapshots
reescritos em todas), `pnpm run build` (passou, mesmos dois avisos pré-existentes da seção 2).

**Arquivos tocados neste fix round:** `artifacts/kalibra/src/pages/EditalRevisar.tsx` (portão
de recusa em `handleConfirm`, bloco de erro `confirm-error`, `handleDiscard` anulando
`workspaceDraft` no `reject`), `artifacts/kalibra/src/pages/EditalRevisar.test.tsx` (três
testes novos), `artifacts/kalibra/src/domain/adapters/local/approvals.ts` (`reject` ganha o
terceiro parâmetro opcional, espelhando `approve`). Nenhum arquivo em `lib/core`,
`src/index.css`, `src/data.ts` ou `src/components/ui/` foi tocado. Nenhum snapshot moveu
(seções 4 e 6). Este é o último fix round desta fase.

## 13. Estado final confirmado

- `lib/core`: 187 testes, 11 arquivos, intocado por Tasks 14–16 e pelos três fix rounds —
  nenhuma destas mudanças precisou mexer em regra de domínio já testada.
- `artifacts/kalibra`: 219 testes, 16 arquivos, 406 testes no total da fase, mesmo resultado
  em três fusos horários (UTC, America/Sao_Paulo, Pacific/Kiritimati), 0 snapshots
  reescritos em nenhuma das rodadas — antes e depois de cada um dos três fix rounds.
- Nada entra no programa de estudo sem uma decisão registrada na fila de aprovação — inclusive
  a estrutura extraída do edital, que fechou o ciclo nesta fase (Task 14): a fila não é mais
  só onde `concept_merge` aparece depois do fato, é onde a própria confirmação da estrutura
  vive como uma decisão. Essa decisão sobrevive fechar a aba, reiniciar o navegador, ou abrir
  o link da fila numa aba nova (achado 1); o que fica registrado é sempre a árvore que de fato
  entrou no programa mesmo depois de editar a proposta (achado 2); retomar a importação de um
  workspace ainda não criado cria esse workspace em vez de deixar dado órfão, para qualquer
  item que carregue (achado A) ou não (achado A residual, recusado explicitamente em vez de
  gravar) um rascunho reconstruível — sem perder o bloco de incertezas do PD-06 pelo caminho
  (achado B do fix round 2); e uma decisão de rejeitar não deixa o edital colado preso na fila
  para sempre (achado B do fix round 3).
- A tela Edital reflete o programa realmente salvo, nunca dados mocados — com honestidade
  explícita sobre o que a Fase 1B não sabe ainda (prioridade e acerto por tópico, que só
  chegam com o diagnóstico da Fase 1C).
- O link "Revisar estrutura" da fila sempre abre o workspace dono da proposta, mesmo quando
  visitado a partir de outro workspace (achado 3) — com a ressalva registrada na seção 11 de
  que o cartão em si ainda não deixa isso visível antes do clique (follow-up nomeado, não
  corrigido: chip com o nome do workspace dono e um filtro "este workspace / todos").
- Um item enfileirado no formato anterior ao fix round 1 (sem `review` nenhum) continua não
  recuperável — dado de protótipo em `localStorage`, sem usuário real; registrado, não
  corrigido (seção 12).
- Os dois débitos da Fase 1A seguem quitados e confirmados por grep: a máquina de estados
  descreve o fluxo real e é aplicada (`canTransition`/`assertTransition`, checados antes de
  qualquer persistência em todo handler de clique desta fase — nenhum retrocesso ao
  anti-padrão do fix round 2 da Task 11), e `hasEdital` é só uma função derivada (seção 3).
- Nenhuma tela toca `localStorage`, `sessionStorage` ou `fetch` diretamente fora de
  `components/ui/` (confirmado por grep, seção 3).
- Nenhum dos arquivos protegidos (`src/index.css`, `src/data.ts`,
  `src/components/ui/`, lógica de `lib/core`) foi tocado por Tasks 14–16 nem por nenhum dos
  três fix rounds.

## 14. Fix wave da revisão final de branch inteira (pós-Fase 1B, antes do merge)

Uma revisão final de **branch inteira** (não mais incremental sobre um fix round
anterior) devolveu **não pronto para merge**: dois achados Críticos (C1, C2), quatro
Importantes (I1, I4, I5, I6) e dois menores de texto/performance. Diferente dos fix
rounds 1–3 (seções 10–12), que corrigiam achados sobre as Tasks 14–16 especificamente,
esta rodada revisou o branch completo — inclusive comportamento que já existia antes
das Tasks 14–16 (I6) e uma lacuna que atravessa `lib/core` e os adaptadores locais
(C2/I1).

### Achado C1 (Crítico) — uma entrada obsoleta da fila sequestrava a próxima importação

A rota `/edital/revisar/:version` nascia de um LITERAL fixo — `1` em
`NovoWorkspace.tsx`, `2` em `Edital.tsx` — sem contador algum em lugar nenhum (nem no
workspace, nem no Syllabus). `EditalRevisar` resolve qual proposta retomar casando
`workspaceId` + a versão da URL contra `payloadAfter.version` de itens `edital_structure`
pendentes na fila. Com a URL sempre igual entre tentativas, uma reimportação
abandonada (item ainda pendente) era encontrada e retomada por engano pela tentativa
seguinte — "Confirmar estrutura" gravava a árvore errada. O mesmo defeito atingia uma
primeira importação abandonada e refeita com o mesmo título: `uniqueSlug` devolve o
mesmo slug (o workspace anterior nunca chegou a existir), a URL seria de novo `1`, e o
item antigo — incluindo seu `workspaceDraft` obsoleto — ressurgia.

**Corrigido**: `reserveNextSyllabusVersion(slug, userId)` (novo, `workspaces.ts`) — um
contador durável (`localStorage`), namespaced por slug + usuário, reservado no momento
em que a extração É INICIADA (não quando é confirmada). Cada chamada devolve um número
NUNCA usado antes para aquele slug, então duas tentativas — decididas ou abandonadas —
nunca podem colidir. Funciona mesmo para um workspace que `handleConfirm` nunca chegou
a criar, porque a chave é pelo slug, não por um registro em `kalibra_workspaces`.

Reconciliado junto: `ApprovalCard.versionFrom` (fallback `'1'`) e
`EditalRevisar.versionFromPayload` (fallback `null`) divergiam — um payload sem
`version` linkava para `/edital/revisar/1` mas nunca batia na retomada (`null !==
'1'`), abrindo uma tela sem nada para revisar onde "Confirmar" ainda avançava o status
do workspace. Unificados num módulo compartilhado
(`domain/edital-structure-payload.ts`), fallback `'1'` nos dois lugares agora.

### Achado C2 (Crítico) + I1 (Importante) — mesma causa raiz: nada produzia um alias

`diffSyllabus` (`lib/core`) já lia aliases via `matchConcept` para detectar renomeação
entre versões do edital (PD-08) — a função em si estava correta e testada, com
cobertura dedicada em `diff.test.ts`. Mas nenhum escritor em produção jamais
acrescentava um alias: `dedupeEntries`, `addItem`, `confirmConcept` — todos deixavam
`aliases: []`. O próprio exemplo do PD-08 do spec (`Crase` → "Emprego do acento
indicativo de crase") produzia `removed: ["Crase"], added: ["Emprego..."], renamed:
[]` — precisamente o que PD-08 existe para prevenir.

Do mesmo defeito: aprovar um `concept_merge` só promovia `targetConceptId` a
`confirmed` (`applyApprovalSideEffects`) — nunca reapontava
`syllabus_item.conceptId` do item que gerou a proposta, nem registrava alias nenhum.
`itemId` estava no payload e o efeito o ignorava. Cada reimportação acrescentava um
conceito provisório duplicado à biblioteca global, para sempre, sem reconciliação.

**Corrigido em duas camadas**: um produtor puro em `lib/core`
(`withAlias`/`renameConcept`, `syllabus/concept.ts`) e dois escritores reais —
`useSyllabus.renameItem` (item já confirmado: renomeia e atualiza o conceito global
via `renameConcept`) e `EditalRevisar.handleRename` (item ainda em revisão: quando o
conceito pertence a `review.newConcepts`, criado por esta mesma extração, a renomeação
atualiza esse conceito em memória) — e `applyApprovalSideEffects`, que agora reaponta
`syllabus_item.conceptId` para o alvo (`repointSyllabusItemConcept`, novo em
`syllabus.ts`) e acrescenta o `sourceLabel` do item como alias do alvo
(`addConceptAlias`, novo em `concepts.ts`).

Teste do exemplo completo do PD-08 (`EditalRevisar.test.tsx`): importar "Crase",
renomear em revisão para "Emprego do acento indicativo de crase", confirmar,
reimportar com a redação "Crase" de novo — o diff mostra `~ 1 renomeado`, `+ 0
adicionado`, `− 0 removido`.

**Escopo deliberadamente não coberto**: renomear um item em revisão cujo conceito já
existia ANTES desta extração (não está em `review.newConcepts`) só atualiza o rótulo
do item, não o conceito global — fora do pedido literal ("renomear no review screen" +
"concept_merge aprovado"); o caminho equivalente para um item já confirmado
(`useSyllabus.renameItem`) cobre isso.

### Achado I4 (Importante) — efeito colateral durante o render

O inicializador preguiçoso de `useState` de `EditalRevisar` chamava
`approvalsApi.enqueue` — que grava em armazenamento durável e dispatcha `storage`
síncronamente — DURANTE o render (podia atualizar estado de um componente ancestral no
meio da renderização desta árvore, e fazia o app depender de `StrictMode` desligado).
Movido para um `useEffect`, com um `enqueuedRef` cobrindo a lacuna que a guarda de
idempotência original (achar um item já pendente na fila) sozinha não cobre.

### Achado I5 (Importante) — confirmar sem trava numa falha parcial

`handleConfirm` marcava o trinco de idempotência ANTES de uma sequência de escritas
nuas sem tratamento de erro. Uma falha no meio (cota de armazenamento esgotada — o
regime esperado, já que a fila guarda cópias inteiras do Syllabus em todo item e nunca
poda itens decididos) deixava uma escrita pela metade E o trinco preso para sempre.
Corrigido com um `try/catch` em torno da sequência: falha reseta o trinco e mostra o
erro (mesmo bloco visual do achado A residual do fix round 3), sem camada transacional
completa. `newConcepts` (já escrito na biblioteca global) vira `[]` no `payloadAfter`
de um item decidido — poda barata do peso morto que a fila nunca remove sozinha.

### Achado I6 (Importante, pré-existente, agora com carga real) — corrupção não pode ressuscitar a demo

`getWorkspaces` tratava "chave ausente", "não é array" e "JSON corrompido" como o
MESMO caso — todos devolviam os dois workspaces de demonstração
(`defaultPrograms`). Um usuário com uma chave danificada via a demo ressuscitar, e a
primeira escrita persistia essa lista fabricada por cima do registro original
recuperável, enquanto `kalibra_syllabus`/`kalibra_concepts`/`kalibra_approvals`
sobreviviam órfãos. Corrigido: só "chave genuinamente ausente" semeia a demo agora;
corrupção devolve lista vazia.

### Dois menores

- A copy de `EditalRevisar` prometia "mover" um tópico — ação que não existe no menu
  do item (`SyllabusTree` só tem renomear/separar de um cargo/excluir). Removida a
  promessa.
- `diffSyllabus` (O(prev × concepts × strlen²), 339 ms medidos para 260 itens) e
  `hasCommonItems` (`isCommon` é O(links) por item) eram recomputados em todo render
  de `EditalRevisar`, inclusive a cada tecla num campo de peso/questões. Envolvidos em
  `useMemo`.

### Gate re-executado depois da correção

`pnpm run typecheck` (passou, 4 pacotes). `pnpm run test`: `lib/core` 187 → **198**
(+11 — `withAlias`/`renameConcept`), `artifacts/kalibra` 219 → **242** (+23 —
`applyApprovalSideEffects` +5, `useSyllabus.renameItem`/`repointSyllabusItemConcept`
+4, `reserveNextSyllabusVersion`/I6 +11, `EditalRevisar` +3). Total **440**, rodado
três vezes sob fusos diferentes (`UTC`, `America/Sao_Paulo`, `Pacific/Kiritimati`),
resultado idêntico nas três. `pnpm run build` (passou, mesmos dois avisos
pré-existentes). Um único snapshot moveu (`/edital/revisar/1`, só a frase da copy
menor) — diff lido por completo antes do `-u`, 0 escritas adicionais depois.

**Arquivos tocados nesta rodada**: `lib/core/src/syllabus/concept.ts` (+ teste),
`artifacts/kalibra/src/domain/adapters/local/{concepts,syllabus,approvals,workspaces}.ts`
(+ testes), `artifacts/kalibra/src/domain/useWorkspaces.ts`,
`artifacts/kalibra/src/domain/edital-structure-payload.ts` (novo),
`artifacts/kalibra/src/pages/{EditalRevisar,NovoWorkspace,Edital}.tsx` (+ teste de
`EditalRevisar`), `artifacts/kalibra/src/components/ApprovalCard.tsx`. Nenhum arquivo
em `src/index.css`, `src/data.ts` ou `src/components/ui/` foi tocado. React/react-dom
seguem em `19.1.0`.

### Limites conhecidos — registrados nesta rodada, não corrigidos de propósito

- `dedupeEntries` é quadrática e síncrona; um edital de 500 tópicos em dois cargos
  congela a aba por segundos. Precisa de um efeito ou worker — mudança maior que este
  fix wave.
- A UI tem uma única textarea aplicada a todos os cargos — conteúdo por cargo não tem
  caminho de entrada real ainda, então a deduplicação entre cargos não tem input do
  mundo real para exercitar.
- `Dashboard` e `Shell` ainda leem dados mocados de `@/data`, enquanto `Edital` lê o
  programa real — duas telas descrevendo dois editais diferentes.
- `workspaceId` guarda um slug em todo lugar — o schema do servidor vai ter que
  reconciliar isso quando chegar.
- `applyDecision` e `buildApprovalItem` são puras mas vivem no adaptador local, não em
  `lib/core`.
- `index.ts` (dos pacotes) exporta internals que nada consome.
- Renomear um item em revisão cujo conceito já existia antes desta extração (fora de
  `review.newConcepts`) só atualiza o rótulo do item, não o conceito global — ver a
  nota de escopo do achado C2/I1 acima.
- Um item de aprovação `edital_structure` no formato anterior ao fix round 1 da Task
  14 (sem a chave `review` nenhuma) continua irrecuperável — dado de protótipo em
  `localStorage`, sem usuário real; já registrado na seção 12.

### Estado final confirmado (atualiza a seção 13)

Com este fix wave, os dois achados Críticos e os quatro Importantes da revisão final
de branch inteira estão corrigidos e testados: uma importação (primeira ou
reimportação) tem identidade própria e durável, nunca mais compartilhada por acidente
com uma tentativa abandonada; uma renomeação (em revisão ou já confirmada) e uma fusão
de conceito aprovada de fato produzem o alias que `diffSyllabus` sempre soube ler,
fechando o mecanismo do PD-08 ponta a ponta; o enfileiramento da proposta não é mais
um efeito colateral de render; confirmar sobrevive a uma falha parcial sem travar; e
um registro de workspaces corrompido não é mais indistinguível de "primeiro uso" aos
olhos de quem lê. Relatório completo desta rodada:
`.superpowers/sdd/2026-09-13-kalibra-fase-1b/final-fix-report.md`.

**Próximo plano:** Fase 1C — diagnóstico obrigatório, plano quinzenal e sessões de estudo.
