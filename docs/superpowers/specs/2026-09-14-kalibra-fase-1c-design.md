# Fase 1C — Backend do domínio existente

> **DOCUMENTO EM CONSTRUÇÃO.** Duas de quatro seções aprovadas. Ver "Estado da
> sessão" abaixo antes de continuar.

## Estado da sessão

**Onde paramos:** §1 e §2 aprovados pelo Yuri, com emendas dele já incorporadas.
Próximo passo é escrever o **§3 — API, contratos e a troca de adaptadores**, e
depois o **§4 — Testes, verificação e riscos**. Quando as quatro seções
estiverem aprovadas, este documento vira o spec final, passa pela auto-revisão
(placeholders, contradições, ambiguidade, escopo), o Yuri revisa o arquivo, e só
então se invoca `superpowers:writing-plans`.

**Processo em uso:** `superpowers:brainstorming`, caminho arquitetural. A skill
exige aprovação seção a seção — não pular para implementação.

**Branch deste documento:** `fase-1c-design`, criada de `main` em `aea00e8`.

### Estado do repositório em 2026-09-14

| Item | Situação |
|---|---|
| Fases 0, 1A, 1B | Mergeadas em `main` (`9a217fd`) |
| Fase 1B.5 (conteúdo por cargo) | PR aberto, branch `fase-1b5-conteudo-por-cargo`, base `main`, 16 commits |
| Correção de hidratação de `sourceBlocks` | PR aberto, branch `fase-1b5-hidratar-blocos`, base `fase-1b5-conteudo-por-cargo`, 2 commits |
| Ordem de merge | 1B.5 → hidratação |
| Suíte | 570 testes (231 `lib/core` + 339 frontend), três fusos, 0 snapshots reescritos |

**Atenção:** `main` local está 1 commit à frente de `origin/main` (`aea00e8`, o
plano da 1B.5). Ele entra pelo PR da 1B.5.

---

## Escopo da Fase 1C (decidido)

A 1C **não** é o diagnóstico. É transformar em persistência real o domínio que as
Fases 1A/1B/1B.5 validaram sem backend, para não ter de refazer o diagnóstico
depois.

**Dentro do escopo:**

- auth/usuário
- workspace
- cargos
- edital/material
- `sourceBlocks`
- concepts
- `syllabus_item`
- `syllabus_item_cargo`
- fila de aprovação
- adaptadores API substituindo os locais nos módulos acima
- schema **preparado** para `question`/`exam`/`attempt`/`diagnostic_result`

**Fora do escopo por enquanto:** plano quinzenal, sessões, notificações, Anki,
pesquisa técnica avançada, IA complexa.

**IA:** preparar contratos e tabelas; implementar IA mínima só depois que o
backend base estiver verde.

### Sequência de fases revista

O spec original (`2026-09-12-kalibra-design.md` §8) previa backend na Fase 2 e IA
real na Fase 4. O Yuri antecipou o backend. A sequência passa a ser:

- **1C** — backend do domínio existente (este documento)
- **1D** — diagnóstico real ponta a ponta, com IA mínima
- **1E** — plano quinzenal
- **1F** — sessões de estudo

### Decisões de direção já tomadas

| Decisão | Escolha |
|---|---|
| Recorte | Backend do domínio já implementado, não do produto inteiro |
| Carregamento e erro nas telas | **Otimista**, reusando o que existe: TanStack Query com atualização otimista, reversão em falha, erro no toast que o app já tem. Zero tela nova, zero token novo |
| Dado atual no `localStorage` | **Começar limpo no servidor.** O dado local não é apagado; fica como cópia no navegador |
| Verificação sem Docker | **PGlite** (Postgres em WASM) nos testes; Postgres real em produção via `DATABASE_URL` |
| IA nos testes | Transporte vira interface; testes usam transporte falso. A normalização determinística em `lib/core` é testada inteira |

### O que só o Yuri pode prover

`DATABASE_URL`, `ANTHROPIC_API_KEY`, `CLERK_SECRET_KEY` e
`VITE_CLERK_PUBLISHABLE_KEY` — em `.env` local ou secret manager, **nunca**
coladas no chat ou no repositório (§3.5 do spec original). Sem elas dá para
construir e testar; não dá para demonstrar rodando ponta a ponta.

Hoje nem `VITE_CLERK_PUBLISHABLE_KEY` está configurada — foi por isso que a
conferência visual manual da 1B.5 não pôde ser feita.

### Andaime que já existe

- `artifacts/api-server` — Express 5 + Clerk + proxy, só rota de health
- `lib/db` — Drizzle e drizzle-kit configurados, **schema vazio**
- `lib/api-spec` / `lib/api-zod` / `lib/api-client-react` — pipeline
  OpenAPI → Orval → Zod + hooks de React Query, montado
- `.env.example` — nomes dos segredos já declarados

Não se começa do zero.

---

## §1 — Arquitetura, fronteiras e segredos *(APROVADO)*

### 1.1 Processos e núcleo compartilhado

Três processos: o frontend (Vite/React), o `api-server` (Express 5) e o Postgres.
O frontend nunca fala com o banco.

`lib/core` é importado pelos **dois** lados e **continua puro e compartilhável**:
sem I/O, sem relógio, sem `window`, sem dependência de browser ou de banco. Essa
propriedade é verificada por varredura no pacote inteiro a cada revisão, desde a
Fase 1A.

Ele pode evoluir nesta fase. O que não pode é perder as três propriedades que o
tornam compartilhável: **pureza**, **determinismo** e **compatibilidade dos
testes existentes**. Qualquer mudança que precise de relógio, rede ou storage não
pertence a `lib/core` — pertence ao adaptador que o chama.

**`lib/core` é a fonte única de regra de domínio.** Máquina de estados do
workspace, deduplicação, matching de conceito, diff do PD-08, FSRS e validações
de domínio existem **uma vez**. É proibido reimplementá-las no servidor ou no
cliente, mesmo "só para validar rápido" — uma segunda implementação diverge, e a
divergência aparece como bug de dado, não como erro de compilação.

### 1.2 Validação: cliente e servidor

O cliente valida para dar **resposta imediata** — é o que sustenta a atualização
otimista, em que a tela muda na hora e reverte se o servidor recusar.

O servidor valida como **autoridade**. Nenhuma decisão de integridade ou de
autorização depende só do cliente. Uma requisição forjada, um cliente
desatualizado ou um bug de frontend não podem produzir estado inválido no banco.

Os dois rodam o mesmo `lib/core`, então "validar duas vezes" não significa
"escrever a regra duas vezes".

### 1.3 Autenticação

Frontend usa `@clerk/react`; backend usa `@clerk/express` (ou middleware
equivalente). O servidor valida o token de sessão e deriva o `clerkUserId` **do
token**.

Duas regras absolutas:

- **`userId` nunca vem de `body`, `query` ou `path`.** Vem sempre da sessão
  validada.
- **Dado enviado pelo cliente não declara posse.** Um `userId` que chegue no
  corpo da requisição é ignorado — não é erro de validação, é campo inexistente
  para o servidor.

### 1.4 `app_user`

Tabela fina. O Clerk continua dono da identidade; o Postgres guarda apenas a
referência necessária para chave estrangeira e posse. **Não replicamos o perfil
do Clerk.**

Campos mínimos: `id`, `clerk_user_id` (unique, not null), `email` (nullable),
`name` (nullable), `created_at`, `updated_at`.

`ensureAppUser(clerkClaims)` é **idempotente**, por `upsert` sobre
`clerk_user_id`, e roda na primeira requisição autenticada que precise persistir
algo. Chamá-la N vezes em paralelo produz uma linha, não N — a unicidade é
garantida pela constraint, não pela ordem de execução.

### 1.5 Autorização por linha

Todo recurso persistido que pertence a um usuário carrega `user_id`. Todo
`select`, `update` e `delete` filtra por `user_id`.

IDs e slugs na URL servem **só para localizar** o recurso. Posse é sempre
revalidada no banco:

- correto: buscar por `id` **+** `user_id`
- proibido: buscar por `id` e conferir a posse depois, em código

A diferença importa: a segunda forma vaza existência (404 vs. 403 revela que o
recurso existe) e depende de um `if` que alguém pode esquecer numa rota nova.

**Ressalva sobre recurso público (emenda do Yuri):** se no futuro existir recurso
intencionalmente público ou compartilhável, ele terá **modelo de autorização
próprio, explícito e testado**. Nesta fase, todo recurso persistido de usuário é
privado e exige `user_id`. Este texto não pode ser usado como argumento contra um
modo de compartilhamento legítimo depois.

### 1.6 RLS

Nesta fase todo acesso ao Postgres passa pelo `api-server`. A autorização é
enforced na API, por filtros obrigatórios por `user_id`, constraints de banco e
testes de isolamento.

RLS no Postgres fica registrado como **hardening posterior**. Se em algum momento
existir acesso direto ao Postgres por cliente ou serviço externo, RLS deixa de
ser hardening e passa a ser obrigatório.

### 1.7 Fronteira de segredos

`DATABASE_URL`, `ANTHROPIC_API_KEY` e `CLERK_SECRET_KEY` existem **só no
servidor**, em `.env` fora do versionamento. O frontend nunca vê nenhuma das
três.

**Em Vite, qualquer variável com prefixo `VITE_` é pública por definição** — vai
para o bundle e chega ao navegador. Portanto nenhum segredo pode ter prefixo
`VITE_`. `VITE_CLERK_PUBLISHABLE_KEY` é legítima porque chave publicável é
pública por desenho; `CLERK_SECRET_KEY` nunca ganha esse prefixo.

Segredo nunca aparece em erro, log, chat, commit, spec, plano ou mensagem ao
usuário.

### 1.8 Fronteira assíncrona para IA

Nenhuma tarefa pesada de IA roda dentro da requisição HTTP.

Nesta fase a IA não é implementada, mas **o contrato já nasce assíncrono**, para
que ligá-la depois não seja mudança quebrante: criar um job
(`POST /jobs/question-generation`) e consultar estado e resultado
(`GET /jobs/:id`). Um endpoint síncrono que espera o modelo terminar é proibido
por desenho — ele amarra um worker HTTP ao tempo de resposta de um terceiro.

### 1.9 Adaptadores

Adaptadores locais **continuam existindo**: são o modo de desenvolvimento sem
banco e carregam a rede de testes que codifica o comportamento do domínio.

Adaptadores API entram **módulo a módulo**, com `config.ts` selecionando por
módulo — a garantia fixada ao aprovar a Abordagem A.

Os dois implementam **o mesmo contrato**. Componentes React não sabem — e não
podem saber — se o dado veio de `localStorage` ou da API: consomem apenas os
hooks de domínio. Adaptadores são casca fina; nenhum dos dois decide nada. Um lê
storage, o outro chama a rede; a regra está em `lib/core`.

O frontend existente segue sendo base obrigatória: esta fase não redesenha tela,
não troca o design system e não introduz token novo.

### 1.10 Risco registrado

Manter dois adaptadores em paralelo tem custo real: duas implementações do mesmo
contrato para manter em sincronia, e o risco de uma ganhar comportamento que a
outra não tem.

Mitigação: regra de domínio concentrada em `lib/core`, contrato comum entre os
dois, **harness de contrato compartilhado** (ver decisão abaixo) e migração
módulo a módulo — nunca dois módulos migrando ao mesmo tempo.

**Os adaptadores locais não são apagados nesta fase.**

### Invariantes do §1 que viram teste

- `lib/core` não contém relógio, I/O, `localStorage`/`sessionStorage`, `window`,
  `document`, `fetch` ou `Math.random` — varredura no pacote inteiro, não só no
  diff.
- Nenhuma regra de domínio de `lib/core` aparece reimplementada em `api-server`
  ou nas telas.
- O servidor rejeita estado inválido mesmo quando o cliente o envia — requisição
  forjada não produz linha inválida.
- `userId` vindo em `body`, `query` ou `path` é ignorado; a posse sai sempre da
  sessão.
- `ensureAppUser` é idempotente: N chamadas com os mesmos claims produzem uma
  linha.
- Chamadas concorrentes de `ensureAppUser` não violam a unicidade de
  `clerk_user_id`.
- **Isolamento — usuário A não lê workspace do usuário B.**
- **Isolamento — usuário A não atualiza workspace do usuário B.**
- **Isolamento — trocar slug ou id na URL não contorna a posse.**
- Requisição sem sessão válida não lê nem escreve nada.
- Nenhuma variável com prefixo `VITE_` contém segredo; o bundle do frontend não
  contém `DATABASE_URL`, `ANTHROPIC_API_KEY` nem `CLERK_SECRET_KEY`.
- Mensagens de erro e logs não imprimem valores de segredo.
- Adaptador local e adaptador API satisfazem o mesmo contrato — a mesma suíte
  roda contra os dois.
- Nenhum componente React referencia `localStorage`, `sessionStorage` ou `fetch`
  direto.
- `index.css` intocado; nenhum token, cor, raio ou fonte novo.

### Decisões explícitas do §1

- **`lib/core` pode evoluir**, desde que preserve pureza, determinismo e
  compatibilidade dos testes. A regra não é "não mudar" — é "não deixar de ser
  compartilhável".
- **Regra de domínio existe uma vez.** Duplicá-la no servidor é defeito de
  revisão, não otimização.
- **Cliente valida para UX; servidor valida como autoridade.**
- **`clerkUserId` vem do token, sempre.** O cliente não declara posse.
- **`app_user` é referência, não perfil.**
- **Consulta por `id + user_id`.** Conferir posse depois, em código, é proibido.
- **Recurso privado sempre exige `id + user_id`; recurso público/compartilhado
  futuro precisa de autorização própria, explícita e testada.**
- **RLS é hardening posterior** nesta fase, e vira obrigatório no dia em que
  existir acesso direto ao banco.
- **Nenhum segredo com prefixo `VITE_`.**
- **Contrato de IA nasce assíncrono**, mesmo sem IA implementada.
- **Adaptadores locais permanecem** e não são apagados nesta fase.
- **Um módulo migra por vez.**
- **Harness de contrato entre adaptadores é parte obrigatória da fase, não "nice
  to have"** — tarefa própria no plano, não detalhe de outra tarefa.
- **Tabelas preparatórias podem existir; código sem chamador não.** Tabela sem
  endpoint não é código morto, desde que tenha justificativa de roadmap e não
  complique o uso atual.
- **O frontend existente continua sendo base obrigatória.**

---

## §2 — Schema do banco *(APROVADO)*

### 2.1 Duas regras de forma

`jsonb` só para forma que `lib/core` possui inteira e que é sempre lida por
completo. Tabela para tudo que precisa de chave estrangeira ou consulta
independente.

Isso não é preferência estética. `sourceBlocks` guarda um `cargoId`; como tabela
com FK e `on delete cascade`, um bloco órfão de cargo apagado deixa de ser
possível — e bloco órfão foi exatamente o achado I3 da Fase 1B.5, hoje resolvido
por poda no código de tela. O banco faz de graça e sem esquecer.

Todo carimbo de tempo é **`timestamptz`**, nunca `timestamp`. A Fase 1A perdeu
uma rodada para uma contagem regressiva que andava um dia para trás porque
`new Date('2026-06-01')` é meia-noite UTC. `timestamp` sem fuso é a mesma
armadilha com a mesma cara.

### 2.2 Identidade: uuid como chave, slug como endereço

Hoje `workspaceId` guarda um slug, e ids de item/conceito são strings geradas no
cliente (`c${Date.now()}` para cargo — que colide se dois cargos nascem no mesmo
milissegundo, como a revisão da 1B.5 registrou). Este é o momento de reconciliar;
foi registrado como limite conhecido desde a 1B.

- **PK é `uuid`, gerada pelo banco.** O cliente para de inventar id.
- **`workspace.slug` é chave natural, única por usuário** — não global.
- **A URL continua usando slug.** A rota localiza por `slug + user_id`.

Começamos limpo no servidor, então não há mapa de migração de ids antigos.

### 2.3 Escopo composto — o princípio

**Toda FK opcional que convive com `user_id` ou `workspace_id` precisa provar, no
banco, que os dois pertencem ao mesmo escopo.** Uma FK simples para
`concept(id)` não impede um conceito do usuário 1 apontar para pai do usuário 2;
uma FK simples para `cargo(id)` não impede ligar item do workspace A a cargo do
workspace B.

A técnica: chave única redundante no alvo (`unique(user_id, id)`,
`unique(workspace_id, id)`) e **FK composta** na origem.

Isso funciona com coluna anulável por causa do `MATCH SIMPLE`, que é o padrão do
Postgres: se **qualquer** coluna da FK é `NULL`, a restrição não é verificada.
Como `user_id`/`workspace_id` são `NOT NULL` e a coluna opcional é anulável, um
conceito-raiz (`parent_id NULL`) ou um bloco comum (`cargo_id NULL`) passa sem
checagem — que é exatamente o desejado.

### 2.4 Tabelas desta fase

| Tabela | Colunas | Integridade |
|---|---|---|
| `app_user` | `id`, `clerk_user_id`, `email?`, `name?`, timestamps | `unique(clerk_user_id)` |
| `workspace` | `id`, `user_id`, `slug`, `title`, `institution`, `type`, `exam_date`, `availability` (jsonb), `status`, `source_mode`, `source_file_name?`, `active`, timestamps | `unique(user_id, slug)`, `unique(user_id, id)` |
| `cargo` | `id`, `workspace_id`, `name`, `exam_date`, `period?`, `position`, `is_selected` | `unique(workspace_id, id)`; índice único parcial `(workspace_id) where is_selected` |
| `edital_source_block` | `id`, `workspace_id`, `cargo_id?`, `text`, `position` | `FK(workspace_id, cargo_id) → cargo(workspace_id, id)` on delete cascade |
| `concept` | `id`, `user_id`, `canonical_name`, `slug`, `parent_id?`, `kind`, `aliases` (`text[]`), `status`, timestamps | `unique(user_id, slug)`, `unique(user_id, id)`; `FK(user_id, parent_id) → concept(user_id, id)` |
| `syllabus_item` | `id`, `workspace_id`, `concept_id`, `parent_item_id?`, `source_label`, `source_excerpt?`, `page?`, `confidence`, `uncertain` | `unique(workspace_id, id)`; `FK(workspace_id, parent_item_id) → syllabus_item(workspace_id, id)` |
| `syllabus_item_cargo` | **`workspace_id`**, `syllabus_item_id`, `cargo_id`, `weight?`, `question_count?` | `PK(workspace_id, syllabus_item_id, cargo_id)`; `FK(workspace_id, syllabus_item_id) → syllabus_item(workspace_id, id)`; `FK(workspace_id, cargo_id) → cargo(workspace_id, id)` |
| `approval_item` | `id`, `user_id`, `workspace_id?`, `type`, `status`, `title`, `rationale`, `source_ref?`, `target_concept_id?`, `confidence?`, `payload_before` (jsonb), `payload_after` (jsonb), `created_at`, `decided_at?`, `reason?` | `FK(user_id, target_concept_id) → concept(user_id, id)`; `FK(user_id, workspace_id) → workspace(user_id, id)` |

`availability` fica em `jsonb` porque é `{days:[{weekday,minutes}],
maxSessionMinutes}`: sem FK, sempre lida inteira, já validada por `lib/core`.
`payload_before`/`payload_after` ficam em `jsonb` porque são instantâneos opacos
por natureza.

### 2.5 `selected_cargo_id`: a seleção vira propriedade do cargo

FK composta de `workspace.selected_cargo_id` para `cargo` cria dependência
circular (`cargo.workspace_id → workspace.id` e volta). As saídas óbvias eram FK
*deferrable* ou validar só na API. Terceira saída, melhor que as duas:

**`cargo.is_selected` com índice único parcial `unique(workspace_id) where
is_selected`.**

Por quê: não há ciclo, então nada de *deferrable* nem de dependência de versão do
Postgres; apagar o cargo selecionado remove a seleção por cascata, sem precisar
de `ON DELETE SET NULL` sobre FK composta — que em coluna `NOT NULL` como
`workspace.id` seria inválido, e cuja forma por colunas só existe a partir do
Postgres 15; e "no máximo um selecionado por workspace" passa a ser garantido
pelo banco, coisa que nenhuma das duas saídas anteriores dava.

**O contrato da API não muda:** o recurso de workspace continua expondo
`selectedCargoId`, agora derivado.

### 2.6 Cascatas

Apagar workspace apaga cargos, blocos, itens, ligações e aprovações.
**Conceitos não são apagados** — são globais por usuário e reutilizados entre
workspaces (§4.2 do spec original). Apagar cargo apaga seus blocos e suas linhas
de `syllabus_item_cargo`, mas **não** apaga o `syllabus_item` que ainda pertence a
outro cargo.

### 2.7 Enums sem deriva

`workspace.status`, `concept.status`, `concept.kind`, `approval_item.type` e
`approval_item.status` são enums do Postgres. Um teste compara os valores do enum
com os arrays de `lib/core` (`WORKSPACE_STATUS_LABELS`, `APPROVAL_TYPES`,
`ConceptStatus`, `ConceptKind`) e falha se divergirem. Sem ele, alguém acrescenta
um status em `lib/core`, o banco rejeita a escrita em produção, e ninguém
descobre até um usuário travar.

`workspace.type` continua **texto livre** — guarda "Concurso Público", não é
enumeração. O nome `type` fica: não é palavra reservada no Postgres, o Drizzle
cita identificadores, e `lib/core` já chama assim. Um teste de ida e volta prova.

### 2.8 Campos derivados não são persistidos

Três campos do registro atual não vão para o banco, porque são segunda
representação de um fato que já existe:

- **`next_action`** é escrito como `nextActionFor(status)` em **todos** os cinco
  pontos de escrita do código atual, sem exceção. Função pura do status. **Não é
  persistido.** A API o computa e o devolve, então o contrato do frontend não
  muda.
- **`import_status`** só é lido pelo caminho legado de migração do adaptador
  local, com mapa `STATUS_FROM_IMPORT` para prová-lo. **Não é persistido nem
  devolvido.**
- **`progress`** não é lido por ninguém: o `progress` do Dashboard é
  `subject.progress`, do mock `@/data`. Persistir um zero fabricado contraria a
  regra que a 1B já aplicou. **Não é persistido.** Volta quando houver dado real
  de estudo para computá-lo.

Isto encerra uma pendência registrada no PR da Fase 1A: *"`hasEdital` e `status`
são duas representações do mesmo fato e já podem discordar. Eleger uma como
canônica antes que apareça um terceiro escritor."*

Regra geral para o que sobrar: **campo derivado persistido só pode ser escrito
por função de domínio de `lib/core`, nunca calculado ad hoc na API.**

### 2.9 Uma divergência que este schema expõe de propósito

`unique(user_id, slug)` em `concept` torna impossível o conceito provisório órfão
que o adaptador local hoje tolera — o limite registrado na 1B (aprovar um
`concept_merge` deixa um provisório órfão, uma vez por item).

Não é problema do schema: é o schema encontrando um defeito que o `localStorage`
tolerava. O harness de contrato vai reprovar o adaptador local, e **a correção é
endurecer o local, não afrouxar o banco.** Isto é trabalho que não estava na
lista de escopo original e é consequência direta de persistir de verdade.

### 2.10 Tabelas preparatórias

`question`, `question_attempt`, `exam`, `exam_question`, `diagnostic_result`
entram na migração com **FKs estruturais estáveis e timestamps apenas**.
Constraints de negócio — enums de tipo de questão, checks de pontuação,
unicidades específicas — entram na fase que as usa, porque §4.5/§4.6 do spec
original ainda pode mudar quando o diagnóstico for desenhado.

Nenhum endpoint, adaptador, export ou tipo gerado as referencia nesta fase.

Custo registrado: a fase que as implementar provavelmente vai alterá-las.
Migração aditiva é barata; a alternativa era descobrir só lá que a espinha não
comportava o diagnóstico.

### Invariantes do §2 que viram teste

**Escopo composto**
- Conceito não pode ter pai de outro usuário.
- Item de syllabus não pode ter pai de outro workspace.
- `syllabus_item_cargo` não pode ligar item do workspace A a cargo do workspace B.
- `edital_source_block` com `cargo_id` sempre aponta para cargo do mesmo
  workspace.
- `approval_item.target_concept_id` sempre aponta para conceito do mesmo usuário.
- `approval_item.workspace_id` sempre aponta para workspace do mesmo usuário.
- Conceito-raiz (`parent_id NULL`) e bloco comum (`cargo_id NULL`) são aceitos —
  `MATCH SIMPLE` não verifica FK com coluna nula.

**Unicidade e seleção**
- `unique(user_id, slug)` em `workspace`; dois usuários podem repetir o slug, um
  usuário não.
- `unique(clerk_user_id)` em `app_user`, sob escrita concorrente.
- `unique(user_id, slug)` em `concept`.
- No máximo um cargo com `is_selected` por workspace.
- Apagar o cargo selecionado não deixa seleção pendurada.
- `syllabus_item_cargo` não aceita a mesma tripla duas vezes.

**Cascatas**
- Apagar workspace apaga cargos, blocos, itens, ligações e aprovações.
- Apagar workspace **não apaga conceito nenhum**.
- Apagar cargo apaga blocos e ligações dele, mas não apaga item que ainda
  pertence a outro cargo.

**Forma e deriva**
- Valores de cada enum no banco são exatamente os arrays de `lib/core`.
- Toda coluna de tempo é `timestamptz`; nenhuma `timestamp` sem fuso.
- Suíte idêntica em `TZ=UTC`, `America/Sao_Paulo` e `Pacific/Kiritimati`.
- `next_action` devolvido pela API é sempre igual a `nextActionFor(status)` —
  nunca uma string armazenada.
- Nenhuma coluna `next_action`, `import_status` ou `progress` existe em
  `workspace`.
- Coluna chamada `type` faz ida e volta pelo Drizzle sem quebrar.
- Nenhuma tabela preparatória é referenciada por endpoint, adaptador ou export.

### Decisões explícitas do §2

- **FK opcional ao lado de `user_id`/`workspace_id` é sempre composta**, com
  unicidade redundante no alvo.
- **`syllabus_item_cargo` carrega `workspace_id`** — redundância pequena,
  integridade muito melhor.
- **`selected_cargo_id` deixa de existir; a seleção vira `cargo.is_selected` com
  índice único parcial.**
- **`syllabus_item.parent_item_id` também ganha FK composta.**
- **`sourceBlocks` vira tabela**, não `jsonb`.
- **`availability` fica em `jsonb`.**
- **`uuid` como PK, `slug` como endereço.**
- **`concept` é global por usuário**, sem `workspace_id`, e sobrevive à exclusão
  de workspace.
- **`unique(user_id, slug)` em `concept`** — o adaptador local terá de ficar
  igualmente estrito.
- **Enums do Postgres, com teste anti-deriva contra `lib/core`.**
- **`timestamptz` sempre.**
- **`next_action`, `import_status` e `progress` não são persistidos.**
- **`workspace.type` fica com esse nome e como texto livre.**
- **Tabelas preparatórias entram só com FK estrutural e timestamps.**

---

## §3 — API, contratos e a troca de adaptadores *(A ESCREVER)*

Pontos que já se sabe que precisam ser cobertos:

- Desenho dos endpoints por módulo (workspace, cargos, edital/blocos, concepts,
  syllabus, aprovações) e o verbo/forma de cada um.
- O pipeline `lib/api-spec` (OpenAPI) → Orval → `lib/api-zod` +
  `lib/api-client-react`: quem escreve o quê, e em que ordem, para que o tipo
  gerado seja a fonte e não uma cópia.
- A porta comum que adaptador local e adaptador API implementam.
- **O harness de contrato** — tarefa própria: roda os mesmos cenários de
  workspace/dedupe/diff/FSRS contra os dois adaptadores e prova que obedecem o
  mesmo contrato. Decisão registrada: obrigatório, não "nice to have".
- Atualização otimista com TanStack Query: onde reverte, e como o erro chega ao
  toast existente sem tela nova.
- Forma do erro da API (código, mensagem, sem segredo) e como `lib/core` traduz
  para texto de produto.
- Endpoints de job para IA declarados no OpenAPI mas **não implementados** —
  confirmar que declarar sem implementar não gera código morto no cliente
  gerado (risco real do Orval: ele gera hook para tudo que está no spec).

## §4 — Testes, verificação e riscos *(A ESCREVER)*

Pontos que já se sabe que precisam ser cobertos:

- PGlite como banco de teste; como as migrações são aplicadas na suíte.
- Testes de isolamento entre usuários (os três do §1).
- O harness de contrato, e o que ele prova.
- O que **não** dá para verificar neste ambiente (sem Docker, sem chaves) e como
  isso é registrado honestamente — a 1B.5 registrou a conferência visual como não
  feita em vez de inventá-la; mesma regra aqui.
- Risco: dois adaptadores em paralelo.
- Risco: `main` ganha um backend que ninguém consegue rodar sem as chaves.
- Risco: a fase encontra defeitos tolerados pelo `localStorage` (§2.9) e cresce.
