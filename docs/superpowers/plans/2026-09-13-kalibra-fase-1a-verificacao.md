# Verificação final da Fase 1A — Kalibra

Data: 2026-09-13
Branch: `fase-1a-core-workspace`
Commits da fase: `a355642` (criar pacote `lib/core`) .. `2f10503` (Fix round 1: contagem
regressiva D+/HOJE/D− para provas passadas) + este registro

## 1. Contagem de testes por pacote

```
$ pnpm run test
```

| Pacote | Arquivos de teste | Testes |
|---|---|---|
| `lib/core` | 5 (`slug.test.ts`, `status.test.ts`, `exam-dates.test.ts`, `availability.test.ts`, `fsrs/schedule.test.ts`) | 51 |
| `artifacts/kalibra` | 2 (`domain/adapters/local/workspaces.test.ts`, `__tests__/screens.snapshot.test.tsx`) | 45 (25 + 20) |
| **Total** | **7** | **96** |

(Números atualizados no Fix round 1 — seção 9 — que acrescentou 2 testes a
`screens.snapshot.test.tsx`, 18 → 20, 43 → 45 em `artifacts/kalibra`, 94 → 96 no total. A
submissão original da Task 11/12 tinha 94; ver seção 9 para o antes/depois completo.)

`lib/core` tem suíte própria, testando só regras puras (sem I/O), importável tanto pelo frontend
hoje quanto pelo servidor na Fase 2 — é o pacote descrito no "Estado ao fim da Fase 1A" do plano.

## 2. Saída do portão (Task 12, Step 1)

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

### `pnpm run test` (rodado duas vezes seguidas)

```
Run 1:
 lib/core:            5 arquivos, 51 testes — passou
 artifacts/kalibra:   2 arquivos, 43 testes — passou
   ✓ telas do Kalibra > renderiza /portal de forma estável   403ms
   (demais 17 testes de tela/tema)

Run 2 (imediatamente em seguida, mesmo estado de árvore):
 lib/core:            51 testes — passou
 artifacts/kalibra:   43 testes — passou
```
Resultado: **passou nas duas execuções**, **0 snapshots escritos na segunda execução** (nenhuma
linha `Snapshots ... written/updated` aparece — só quando havia mudança real, na primeira rodada
de `-u` antes de commitar, apareceu `2 updated`, ver seção 4). Isso confirma o requisito do Step 1:
"a suíte agora tem duas execuções — `lib/core` e `artifacts/kalibra` — e 0 snapshots escritos".

### `pnpm run build`

```
Scope: 9 of 10 workspace projects
artifacts/api-server build: Done
artifacts/mockup-sandbox build: ✓ built in 574ms
artifacts/kalibra build: ✓ 1917 modules transformed. ✓ built in 2.40s
```
Resultado: **passou** (exit 0). Dois avisos pré-existentes e não relacionados a esta fase aparecem
durante o build do kalibra (já registrados na verificação da Fase 0):
`src/components/ui/tooltip.tsx (2:0): Error when using sourcemap for reporting an error` (aviso do
gerador de sourcemap do Vite/Rollup sobre um arquivo em `components/ui/`, fora do escopo desta
fase, que não pode ser tocado) e o aviso padrão de chunk JS > 500 kB. Nenhum dos dois impede o
build nem indica erro de compilação.

## 3. Restrições confirmadas (Task 12, Step 2)

```
$ grep -rn "localStorage\|sessionStorage\|fetch(" artifacts/kalibra/src/pages artifacts/kalibra/src/components --include=*.tsx | grep -v "components/ui/" || echo "nenhuma tela toca persistencia"
nenhuma tela toca persistencia

$ grep -rn "5 MB\|5MB" artifacts/kalibra/src/ || echo "limite de 5 MB eliminado"
limite de 5 MB eliminado

$ grep -rn "from 'ts-fsrs'\|from \"ts-fsrs\"" artifacts/kalibra/src/ || echo "frontend nao importa ts-fsrs direto"
frontend nao importa ts-fsrs direto
```

As três mensagens de confirmação esperadas pelo brief apareceram. `ts-fsrs` só é importado dentro
de `lib/core/src/fsrs/schedule.ts`; o frontend consome o agendamento já calculado, nunca a
biblioteca crua. O limite de upload é 20 MB (ver Task 9/10 desta fase, commits `ee56e0f` e
`3adf5af`), não 5 MB.

## 4. Snapshots que mudaram nesta fase, e por quê

Toda a fase teve **uma única** rodada de atualização de snapshot, na Task 11 (commit `76355a6`),
sobre as rotas `/portal` e `/` (que renderizam a mesma tela — `Home.tsx` redireciona para
`Portal.tsx`, então os dois snapshots são idênticos byte a byte, como já registrado na verificação
da Fase 0).

Diff lido **antes** de rodar `-u` (conforme exigido pelo brief). O diff continha exatamente os
quatro elementos esperados, nada além disso:

1. **Chip de status** — `<span class="k-chip k-chip-active" data-testid="chip-status-estudando">estudando</span>`
   ao lado do chip de tipo já existente, dentro de um novo wrapper `<div class="flex items-center gap-2">`.
2. **Contagem regressiva** — `<span class="k-mono k-focus ml-2">D−126</span>` (para o cargo
   selecionado do workspace `setec-campinas`, cuja `examDate` de cargo é `2027-01-17`, diferente da
   `examDate` de workspace `2026-01-17` — por isso a data exibida na linha "Prova:" também mudou de
   `2026-01-17` para `2027-01-17`, refletindo `effectiveExamDate` em vez da data crua do
   workspace).
3. **Linha de cargo** — `<p class="text-[11px] k-muted">Analista Técnico (Informática)</p>`, só no
   card `setec-campinas` (que tem 2 cargos); o card `bb-escriturario` (1 cargo só) não ganhou essa
   linha, como esperado.
4. **Menu de ações** — `relative` no container do topo do card, `data-testid` novo no botão
   (`button-workspace-menu-<slug>`); o menu suspenso em si (`Abrir`/`Renomear`/`Arquivar`) não
   aparece no snapshot porque começa fechado (`openMenu` inicial é `null`) — só a marcação estática
   do gatilho.

Nenhuma classe de cor, borda, raio ou espaçamento nova apareceu fora dessas quatro mudanças; nenhum
texto ou elemento pré-existente foi removido. Após ler o diff, `-u` foi executado uma vez
(`2 updated`), e as duas execuções seguintes do portão completo confirmaram 0 escritas adicionais
(seção 2).

**Correção pós-revisão (Fix round 1) sobre `D−-104`:** a submissão original desta task exibia
`D−-104` para o card `bb-escriturario` (cargo único com `examDate: '2026-06-01'`, no passado em
relação à data congelada `2026-09-13`) e registrava isso como "achado cosmético, fora do escopo".
Essa classificação estava errada e foi revertida em revisão: é um bug de correção, não um artefato
de fixture — nada no app arquiva ou esconde um workspace quando a data da prova passa (`Arquivar`
é manual), então qualquer usuário real chega a esse estado no dia seguinte à própria prova, e um
sinal duplo num card cujo propósito central é a contagem regressiva é informação errada sobre o
único número que o card existe para mostrar, não um detalhe visual. `Portal.tsx` agora usa
`formatCountdown(dias)` (definida no próprio arquivo, logo abaixo dos imports), que reproduz a
mesma convenção de três vias que `getDaysRemaining` (`src/lib/date-utils.ts`) já usa na sidebar
(`Shell.tsx`): `D−{n}` para o futuro, `HOJE` para hoje, `D+{n}` para o passado — sem inventar
nenhuma classe ou token novo, e sem importar `getDaysRemaining` em si (que opera sobre uma string
de data com seu próprio `new Date()`, mockado de forma fixa no teste; `daysUntil` de
`@workspace/core`, que já recebia `today` explícito, permanece a fonte do número). O card agora
mostra `D+104`. Um teste dedicado (`nao usa sinal duplo para prova de cargo cuja data ja passou`)
cobre essa regressão diretamente sobre o fixture `bb-escriturario`, fora do loop de snapshot.

**Escolha de estilo — `k-focus` mantido também para provas passadas:** `Shell.tsx` (a sidebar, que
já usa `getDaysRemaining`) aplica `k-focus k-mono` incondicionalmente, sem diferenciar
D−/HOJE/D+ por cor. `Portal.tsx` segue exatamente esse precedente — `formatCountdown` só muda o
texto, nunca a classe — em vez de inventar uma variante "muted" para prova passada. Justificativa:
(1) o design system não tem um token "aviso"/"neutro" dedicado para essa distinção sem introduzir
cor nova, o que violaria a restrição de não adicionar tokens; (2) já existe precedente direto na
mesma aplicação, na tela adjacente, usando o mesmo dado (`getDaysRemaining`) sem diferenciar por
cor; divergir do padrão já estabelecido para inventar uma nova regra visual pareceria mais
arbitrário do que segui-lo. Se um design futuro quiser destacar provas vencidas, o lugar certo é
alinhar as duas telas juntas, não fazer o Portal divergir sozinho da sidebar.

## 5. O determinismo do relógio (Task 11, Step 5) — qual rota foi usada e por quê

O brief sugeria congelar o relógio globalmente com `vi.useFakeTimers()` / `vi.setSystemTime()` no
`beforeEach` do arquivo de snapshot, com `vi.useRealTimers()` num `afterAll`, e avisava para não
insistir nisso se travasse ou quebrasse outros testes (React 19 e Radix agendam trabalho via
timers).

**Essa rota foi tentada primeiro e funcionou sem ressalvas** — foi a rota mantida, sem precisar do
fallback de mockar `@workspace/core` diretamente:

- `pnpm run typecheck` passou sem erros após a mudança.
- A primeira execução do portão com o relógio congelado rodou os 94 testes sem travar; só os 2
  testes esperados (`/portal`, `/`) falharam por mismatch de snapshot — exatamente os que a
  mudança do card deveria afetar. Nenhum outro teste (Clerk mockado, Radix, as outras 14 rotas)
  quebrou ou teve timeout.
- Depois de `-u`, duas rodadas consecutivas do portão completo passaram com 0 snapshots escritos
  em ambas (seção 2), confirmando que o relógio congelado não introduziu nenhuma instabilidade
  residual.

Não foi necessário recorrer ao fallback (estender o mock de `../lib/date-utils` ou fazer o Portal
receber o relógio por injeção) porque a suíte deste projeto é pequena e não depende de temporizador
real em nenhum ponto sensível durante o teste. Os mocks de Clerk já resolvem os widgets como
síncronos/`null`. **Correção (Fix round 1):** a versão anterior deste documento atribuía a
segurança dos fake timers a "o Radix usado aqui — nos menus do Portal e do EditalRevisar". Isso
estava errado: esses dois menus de três pontos não são Radix — são dropdowns simples controlados
por `useState` local (`openMenu`), sem overlay/portal DOM próprio, então não dependem de nenhum
temporizador para abrir ou fechar. Radix só entra na árvore desta aplicação via `TooltipProvider`
(usado a partir de `components/ui/`), que também não depende de timer para os testes desta suíte
passarem. A conclusão ("fake timers são seguros aqui") continua válida — só o motivo declarado
estava errado, e foi corrigido aqui. Caso uma fase futura introduza testes que dependam de
temporizadores reais (ex.: debounce, animação com `requestAnimationFrame`, ou um componente Radix
que de fato use timers em teste), a recomendação é isolar `vi.useFakeTimers()` para o describe
específico que precisa de data determinística, em vez de todo o arquivo — mas não foi necessário
fazer isso agora.

## 6. Step 3 — Conferência visual manual nos dois temas

**Não realizada de forma genuína**, pela mesma razão já registrada na verificação da Fase 0:
`VITE_CLERK_PUBLISHABLE_KEY` não está definida no ambiente.

Verificado antes de descartar o passo:
```
$ env | grep -i CLERK        → (vazio)
$ find artifacts/kalibra -maxdepth 1 -iname ".env*"   → (nenhum arquivo)
```
`src/config/clerk.tsx` consome `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY` diretamente, e
`src/routes/AppRoutes.tsx:70` renderiza `Missing VITE_CLERK_PUBLISHABLE_KEY in environment
variables.` quando ausente — confirmado subindo `pnpm run dev` de fato (não só por leitura de
código): o servidor respondeu `200` em `http://localhost:5173/`, mas o HTML servido é o shell
estático do Vite (a aplicação React real só monta no navegador via JS; sem uma ferramenta de
automação de navegador neste ambiente, não há como capturar o DOM pós-render do cliente para
confirmar visualmente a mensagem de erro — a evidência de código + a config do runtime é a prova
disponível). O servidor de dev foi encerrado logo em seguida.

**O que foi conferido como substituto:**
- `pnpm run build` e `pnpm run dev` sobem sem erro de compilação — a aplicação está sintaticamente
  e estruturalmente sã.
- Os 18 testes de `screens.snapshot.test.tsx` cobrem o HTML renderizado (via
  `@testing-library/react`, com `@clerk/react` mockado) de 13 telas distintas em 16 rotas — ver a
  contagem e a ressalva sobre `/` e `/sign-in`/`/sign-up` já detalhadas na verificação da Fase 0
  (seção 5 daquele documento; nada mudou nessa contagem nesta fase, exceto o conteúdo do Portal).
- O card do Portal com status, D−, cargo e menu (o item específico que o Step 3 pedia para revisar
  visualmente) tem sua marcação completa capturada nos dois snapshots atualizados desta fase
  (`/portal` e `/`), incluindo as classes `dark:` condicionais — mas o snapshot só prova a
  presença/ausência de classes CSS no HTML, não o resultado visual computado.

**O que NÃO foi coberto, por causa dessa lacuna** (mesmas categorias da Fase 0, reafirmadas para o
trabalho desta fase especificamente):
- Estilos computados reais em cada tema (cores, contraste, alinhamento do chip de status e do menu
  suspenso).
- Comportamento real dos widgets do Clerk.
- Comportamento interativo do menu de três pontos do Portal — abrir, clicar em "Renomear" (que
  depende de `window.prompt`, não simulável em snapshot), clicar em "Arquivar" e ver o card mudar
  de estado, clicar fora para fechar.
- As três seções de "Novo workspace" (multi-cargo, disponibilidade, aba "Ainda não tenho") e a
  criação completa de um workspace sem edital, na forma como um usuário realmente clica através
  delas — o snapshot cobre apenas o estado inicial da rota `/portal/novo-workspace`.
- Qualquer coisa em `localStorage`/`sessionStorage` real do navegador (os testes usam o
  `localStorage` do jsdom, limpo a cada teste).

A evidência de que o card do Portal está correto nos dois temas descansa inteiramente sobre a
suíte de snapshot (que captura as classes `dark:` condicionais lado a lado com as classes claras
no mesmo HTML, já que o tema é resolvido por classe CSS, não por duas árvores separadas) e sobre a
leitura manual do diff descrita na seção 4 — não sobre inspeção visual real.

## 7. Desvios encontrados

- **Rota de determinismo do relógio**: o brief oferecia `vi.useFakeTimers()`/`vi.setSystemTime()`
  como sugestão principal e um fallback de mock de fronteira como alternativa caso a primeira
  quebrasse algo. A primeira funcionou sem nenhum efeito colateral (seção 5) — não é um desvio do
  brief, é a rota "feliz" que o próprio brief previa como possível.
- **`D−-104` no card `bb-escriturario`**: rebaixado incorretamente a "achado cosmético fora de
  escopo" na primeira submissão desta task; era, na verdade, um bug de correção que qualquer
  usuário real atinge (a data de uma prova passa e nada arquiva o workspace automaticamente).
  Encontrado em revisão (Fix round 1) e corrigido em `Portal.tsx` com `formatCountdown`, que
  reproduz a mesma convenção de três vias que `getDaysRemaining` (`src/lib/date-utils.ts`) já usa
  na sidebar (`Shell.tsx`) — `D−n`/`HOJE`/`D+n` — em vez de inventar uma regra nova. Coberto por um
  teste dedicado. Ver seção 4.
- **Verificação manual em navegador (Step 3)**: não realizada, por ausência de
  `VITE_CLERK_PUBLISHABLE_KEY` e de ferramenta de automação de navegador neste ambiente — mesma
  lacuna já registrada na Fase 0, reconfirmada aqui para o trabalho específico desta fase (seção
  6). A lacuna em si é o achado; nenhum problema real pôde ser observado ou descartado por essa
  via.
- **Correção factual (Fix round 1)**: este documento afirmava que os menus de três pontos do
  Portal e de `EditalRevisar.tsx` eram Radix, usado como parte da justificativa de que os fake
  timers eram seguros. Esses dois menus são dropdowns simples com `useState`, não Radix — Radix só
  entra via `TooltipProvider`. A conclusão sobre a segurança dos fake timers não mudou; só a razão
  declarada estava errada. Corrigido na seção 5.
- Nenhum outro desvio, classe nova fora do esperado, elemento removido ou mudança de texto foi
  encontrado nas etapas que puderam ser executadas (typecheck, build, testes, greps do Step 2).

## 8. Estado final confirmado

- `lib/core`: 51 testes, 5 arquivos, regras puras (workspace, disponibilidade, slug, datas por
  cargo, FSRS), nenhum tocando I/O.
- `artifacts/kalibra`: 45 testes, 2 arquivos (incluindo os 2 testes acrescentados no Fix round 1 —
  seção 9); 96 testes no total da fase, 0 snapshots escritos em duas execuções consecutivas do
  portão completo.
- Workspace com múltiplos cargos, disponibilidade semanal e edital opcional — testado desde as
  Tasks 5–10 desta fase.
- Card do Portal mostrando status real (`WorkspaceStatusChip`, reaproveitando os três tons de
  severidade da tela Erros), contagem regressiva do cargo selecionado
  (`effectiveExamDate` + `daysUntil` de `@workspace/core`), nome do cargo quando há mais de um, e
  menu de ações funcional (Abrir/Renomear/Arquivar, mesmo padrão visual do menu de tópico de
  `EditalRevisar.tsx`) — Task 11, commit `76355a6`.
- Limite de upload em 20 MB (confirmado por grep, seção 3).
- Migração automática dos workspaces salvos no formato antigo (`migrateWorkspace`, testada em
  `domain/adapters/local/workspaces.test.ts`).
- Nenhuma tela toca `localStorage`, `sessionStorage` ou `fetch` diretamente fora de
  `components/ui/` (confirmado por grep, seção 3).
- Frontend não importa `ts-fsrs` diretamente — só consome o agendamento calculado por `lib/core`
  (confirmado por grep, seção 3).

## 9. Fix round 1 — revisão e correção

A revisão de código sobre as Tasks 11–12 encontrou dois problemas nesta task, ambos corrigidos:

1. **`D−-104` era um bug de correção, não um achado cosmético** (Importante). O card
   `bb-escriturario`, com `examDate` já no passado em relação ao relógio congelado, exibia sinal
   duplo. A submissão original classificou isso como "cosmético, fora de escopo" — errado, porque
   (a) não é exclusivo do dado de exemplo: nada arquiva um workspace quando a prova passa,
   `Arquivar` é manual, então todo usuário real chega a esse estado; (b) já existe convenção
   pronta no próprio app para esse caso (`getDaysRemaining` em `src/lib/date-utils.ts`, em uso na
   sidebar via `Shell.tsx`); (c) o sinal duplo pode ser lido como "104 dias para a prova" quando a
   prova já passou há 104 dias — informação errada sobre o número central do card.

   **Correção:** `Portal.tsx` ganhou uma função de módulo `formatCountdown(dias: number)` que
   replica a convenção de três vias de `getDaysRemaining` — `D−{n}` (futuro), `HOJE` (hoje),
   `D+{n}` (passado) — sem importar `getDaysRemaining` (que tem sua própria fonte de data,
   mockada de forma fixa no teste) e sem tocar `lib/core` ou `defaultPrograms`. Nenhuma classe
   nova: `k-mono k-focus` continuam sendo as únicas classes do `<span>` da contagem, em todos os
   três casos — decisão explicada na seção 4 ("Escolha de estilo"), seguindo o precedente de
   `Shell.tsx`, que também não diferencia cor por elapsed-state.

   **Teste adicionado:** `nao usa sinal duplo para prova de cargo cuja data ja passou`, em
   `screens.snapshot.test.tsx`, fora do loop de snapshot — renderiza `/portal` com o fixture
   padrão (que já contém `bb-escriturario` com data passada) e afirma por regex que
   `container.innerHTML` não contém `D−-\d` e que contém `D+104`. Cobre a regressão diretamente,
   sem depender de snapshot (que só detectaria a mudança, não afirma a ausência do sinal duplo por
   si).

   **Diff de snapshot da correção**, lido antes de `-u`: único trecho alterado nos dois snapshots
   (`/portal`, `/`) foi `<span class="k-mono k-focus ml-2">D−-104</span>` →
   `<span class="k-mono k-focus ml-2">D+104</span>` no card `bb-escriturario` — nada mais mudou em
   nenhum dos dois snapshots. `-u` rodado em seguida (`2 updated`), e duas execuções completas do
   portão confirmaram 0 escritas adicionais.

2. **Correção factual sobre Radix** (Menor). Este documento atribuía a segurança dos fake timers,
   em parte, a "o Radix usado aqui — nos menus do Portal e do EditalRevisar". Os dois menus de três
   pontos exercitados pela Task 11 (`Portal.tsx`, `EditalRevisar.tsx`) são dropdowns simples com
   `useState` local, não Radix; Radix só entra na aplicação via `TooltipProvider`. A conclusão
   ("fake timers são seguros nesta suíte") continua correta — só a razão declarada estava errada.
   Corrigida na seção 5, com a razão certa: nenhum dos dois menus abre overlay/portal próprio nem
   depende de temporizador para abrir/fechar, e o único ponto de entrada real do Radix
   (`TooltipProvider`) também não depende de timer para os testes desta suíte passarem.

3. **Teste do "próximo passo" derivado** (Menor, opcional — feito). Nenhuma fixture de
   `defaultPrograms` tem `nextAction` vazio (ambas carregam texto livre), então o branch
   `nextActionFor(program.status)` em `Portal.tsx` nunca era exercitado por teste algum. Em vez de
   alterar `defaultPrograms` (fora do escopo de arquivos desta task), o teste
   `deriva o próximo passo do status quando nextAction está vazio` semeia um único workspace
   diretamente em `localStorage` (mesma chave e formato que `useWorkspaces` espera,
   `kalibra_workspaces:<userId>`), com `nextAction: ''` e `status: 'diagnostico_pendente'`, e
   afirma que o texto `Fazer o diagnóstico inicial` (de `nextActionFor`, `lib/core`) aparece no
   HTML renderizado. Ficou barato o suficiente para incluir — não precisou de cirurgia em
   fixture de produção.

**Gate re-executado após a correção** (root, mesmos três comandos): `pnpm run typecheck` — passou;
`pnpm run test`, duas vezes seguidas — 96 testes (51 `lib/core` + 45 `artifacts/kalibra`) passando
nas duas rodadas, 0 snapshots escritos na segunda; `pnpm run build` — passou (mesmos dois avisos
pré-existentes já registrados na seção 2, não relacionados a esta correção).

**Arquivos tocados nesta correção:** `artifacts/kalibra/src/pages/Portal.tsx` (função
`formatCountdown` + uso no render),
`artifacts/kalibra/src/__tests__/screens.snapshot.test.tsx` (2 testes novos + import de
`emptyAvailability`/`TEST_USER`), `artifacts/kalibra/src/__tests__/__snapshots__/screens.snapshot.test.tsx.snap`
(2 snapshots atualizados, só o `D+104`), e este documento (seções 4, 5, 7, 8, e esta seção 9).
Nenhum arquivo em `lib/core`, `src/index.css`, `src/data.ts` ou `src/components/ui/` foi tocado.

**Próximo plano:** Fase 1B — importação e revisão de edital, mais a fila de aprovações como
infraestrutura transversal.
