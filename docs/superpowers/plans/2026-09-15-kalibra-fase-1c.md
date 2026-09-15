# Fase 1C — Plano de implementação: backend do domínio existente

> **Nível deste documento:** roteiro de fases. Cada fase numerada abaixo precisa
> do seu próprio plano executável (tarefas com passos de 2–5 minutos e código
> real) antes de ser implementada — via `superpowers:writing-plans`. Este
> documento fixa a sequência, as fronteiras e os critérios; não substitui o plano
> de cada fase.

**Objetivo:** migrar o Kalibra de `localStorage` puro para frontend Vite/React +
`api-server` Express 5 + Postgres, preservando o frontend atual e trocando
adaptador módulo a módulo.

**Spec:** `docs/superpowers/specs/2026-09-14-kalibra-fase-1c-design.md`
(§1, §2 e §3 aprovados).

---

## Restrições globais

Valem em todas as fases. Um revisor rejeita a fase que violar qualquer uma.

- O frontend existente é base obrigatória. **Não redesenhar UI, não trocar design
  system, não alterar `artifacts/kalibra/src/index.css`, não criar token novo.**
- `lib/core` é fonte única de regra de domínio. Pode evoluir, mas continua **puro,
  determinístico e compartilhável**: sem relógio, I/O, `window`, storage, `fetch`
  ou `Math.random`. Varredura no pacote inteiro, não só no diff.
- Nenhuma regra de domínio reimplementada no `api-server` ou nas telas.
- Cliente valida para UX; **servidor valida como autoridade**.
- `userId` vem **só** da sessão Clerk validada. Nunca de `body`, `query` ou `path`.
- Toda rota privada filtra por `user_id`. Consulta por `id` sozinho é proibida.
- Segredos só no servidor: `DATABASE_URL`, `ANTHROPIC_API_KEY`,
  `CLERK_SECRET_KEY`. **Nenhum segredo com prefixo `VITE_`.** Nenhum segredo em
  erro, log ou mensagem.
- Nenhum componente React toca `localStorage`, `sessionStorage` ou `fetch` direto.
- Adaptadores locais **não são apagados**.
- `timestamptz` sempre; nunca `timestamp` sem fuso.
- Dark é o tema principal; toda classe de cor em par `light dark:`.
- React e react-dom em `19.1.0` exato.
- Commits em português, `tipo: descrição`, corpo terminando com:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- Portão de cada fase: `pnpm run typecheck`, `pnpm run test`, `pnpm run build`,
  verdes, e a suíte idêntica em `TZ=UTC`, `America/Sao_Paulo` e
  `Pacific/Kiritimati`, com `0 snapshots written`.

**Ponto de partida:** 570 testes (231 `lib/core` + 339 frontend), `main` em
`65ec0bb`.

---

# Fase 1 — Portas reais *(refatoração mecânica, sem backend)*

**Objetivo:** extrair o contrato do adaptador local para portas independentes, de
modo que os dois adaptadores passem a implementar algo que nenhum dos dois
define. Nenhuma mudança de comportamento.

**Arquivos**
- Criar: `artifacts/kalibra/src/domain/ports/{workspaces,source-blocks,concepts,syllabus,approvals,index}.ts`
- Criar: `artifacts/kalibra/src/domain/staging.ts` (importação pendente, client-side)
- Modificar: `artifacts/kalibra/src/domain/adapters/local/*.ts` — passam a importar tipos das portas
- Modificar: `artifacts/kalibra/src/domain/use*.ts` — re-exportam da porta, não do adaptador
- Modificar: consumidores que hoje fazem `import type { Cargo } from '@/domain/useWorkspaces'`

**Tarefas**
1. Mover `WorkspaceDraft`, `Cargo`, `SourceMode`, `ImportStatus` de
   `adapters/local/workspaces.ts` para `ports/workspaces.ts`, por recorte e
   colagem. O adaptador local passa a importar.
2. Declarar a interface de cada porta: os métodos que hoje o hook local expõe,
   com assinatura explícita.
3. Tirar `stageWorkspaceImport`, `getPendingWorkspaceImport` e
   `clearPendingWorkspaceImport` da porta e movê-los para `staging.ts`,
   documentado como client-side por desenho.
4. Tirar `migrateWorkspace` da porta; volta a ser interno do adaptador local.
5. Remover do `PendingWorkspaceImport` qualquer tipo que só o local usa.
6. Rodar o portão.

**Testes obrigatórios**
- A suíte existente passa **idêntica**, nas mesmas contagens (570), antes e
  depois. Esta fase não acrescenta teste de comportamento.
- Teste estrutural: nenhum arquivo em `domain/ports/` importa de
  `domain/adapters/`. A seta de dependência aponta num sentido só.
- Teste estrutural: nenhum tipo de domínio é declarado em `adapters/local/`.
- Nenhum snapshot muda.

**Critério de pronto**
- Portão verde, 570 testes, `0 snapshots written`.
- O diff contém movimentação e troca de import — **nenhuma alteração de lógica**.
  Um revisor consegue ler o diff inteiro e afirmar isso.

**Riscos**
- Refatoração "mecânica" que muda comportamento sem querer. A Fase 0 estabeleceu
  a regra que vale aqui: mover primeiro, verificar, só depois mudar. Se algum
  teste mudar de resultado, a fase parou de ser mecânica e o defeito está no
  movimento.
- Tipos com dependência circular entre portas (ex.: `syllabus` referenciando
  `Cargo`). Mitigação: `ports/index.ts` reexporta; portas importam de portas, não
  de hooks.

---

# Fase 2 — Schema e migrations *(banco, sem servidor)*

**Objetivo:** o schema do §2 existindo, migrado e testado contra PGlite, sem
nenhum endpoint.

**Arquivos**
- Criar: `lib/db/src/schema/{app-user,workspace,cargo,edital-source-block,concept,syllabus-item,syllabus-item-cargo,approval-item}.ts`
- Criar: `lib/db/src/schema/prepared/{question,question-attempt,exam,exam-question,diagnostic-result}.ts`
- Modificar: `lib/db/src/schema/index.ts`, `lib/db/drizzle.config.ts`
- Criar: `lib/db/src/test/pglite.ts` (banco de teste + aplicação de migrations + reset)
- Criar: `lib/db/migrations/*`
- Modificar: `lib/db/package.json` (dependência `@electric-sql/pglite`)

**Tarefas**
1. Relaxar `drizzle.config.ts` para não lançar quando `DATABASE_URL` falta —
   gerar SQL a partir do schema não precisa de banco vivo. Lançar só quando a
   operação realmente exigir conexão.
2. Escrever as oito tabelas do §2.4, com as FKs compostas do §2.3 e as unicidades
   redundantes (`unique(user_id, id)`, `unique(workspace_id, id)`).
3. `cargo.is_selected` com índice único parcial `(workspace_id) where is_selected`
   (§2.5). **Não criar `workspace.selected_cargo_id`.**
4. `workspace.version` (inteiro), que as fases 6 e 8 usam como `If-Match`.
   Decisão: versão **por workspace**, não por documento — grosseira (qualquer
   escrita incrementa) mas simples e correta. Versão por documento fica para o dia
   em que a grosseira gerar conflito espúrio.
5. Enums do Postgres para `workspace.status`, `concept.status`, `concept.kind`,
   `approval_item.type`, `approval_item.status`. `workspace.type` é texto livre.
6. Tabelas preparatórias com **FK estrutural e timestamps apenas** — sem
   constraint de negócio (§2.10).
7. Gerar as migrations.
8. Montar o harness PGlite: sobe banco em memória, aplica migrations, reseta entre
   testes.

**Testes obrigatórios**
- **Escopo composto (7):** conceito com pai de outro usuário rejeitado; item com
  pai de outro workspace rejeitado; `syllabus_item_cargo` cruzando workspace
  rejeitado; bloco com cargo de outro workspace rejeitado;
  `approval_item.target_concept_id` de outro usuário rejeitado;
  `approval_item.workspace_id` de outro usuário rejeitado; **e os casos nulos
  aceitos** (conceito-raiz, bloco comum) — `MATCH SIMPLE`.
- **Unicidade (6):** `unique(user_id, slug)` em `workspace` (dois usuários podem
  repetir, um não); `unique(clerk_user_id)` sob escrita concorrente;
  `unique(user_id, slug)` em `concept`; no máximo um `is_selected` por workspace;
  apagar o cargo selecionado não deixa seleção pendurada; tripla de
  `syllabus_item_cargo` não duplica.
- **Cascatas (3):** apagar workspace apaga cargos/blocos/itens/ligações/aprovações;
  apagar workspace **não apaga conceito**; apagar cargo não apaga item que ainda
  pertence a outro cargo.
- **Anti-deriva:** valores de cada enum no banco são exatamente os arrays de
  `lib/core`.
- **Forma:** varredura confirma que nenhuma coluna é `timestamp` sem fuso.
- Nenhuma tabela preparatória referenciada por código.

**Critério de pronto**
- Portão verde; migrations aplicam do zero num banco vazio.
- Os 17 testes acima passam, e cada um fica **vermelho** quando a constraint
  correspondente é removida mecanicamente.

**Riscos**
- PGlite pode divergir do Postgres real em detalhe de constraint. Mitigação:
  usar só recursos padrão; registrar que a verificação contra Postgres real
  depende de o Yuri fornecer `DATABASE_URL`, e **não afirmar** o que não foi
  rodado.
- Índice único parcial e FK composta são as partes menos familiares do Drizzle.
  Se o Drizzle não expressar alguma delas, escrever SQL bruto na migration é
  aceitável — o que não é aceitável é relaxar a constraint.

---

# Fase 3 — Fundação do `api-server` *(auth e erro, sem recurso de domínio)*

**Objetivo:** um servidor que autentica, identifica o usuário, responde erro no
formato certo e não vaza nada — ainda sem nenhum endpoint de domínio.

**Arquivos**
- Criar: `artifacts/api-server/src/middlewares/requireAuth.ts`
- Criar: `artifacts/api-server/src/lib/ensureAppUser.ts`
- Criar: `artifacts/api-server/src/lib/problem.ts`
- Criar: `artifacts/api-server/src/lib/db.ts`
- Modificar: `artifacts/api-server/src/app.ts`, `src/routes/index.ts`
- Criar: `artifacts/api-server/src/test/harness.ts` (app + PGlite + sessão falsa)

**Tarefas**
1. `requireAuth`: valida a sessão do Clerk e anexa `clerkUserId` derivado do
   token. Requisição sem sessão válida responde 401 e **não toca o banco**.
2. `ensureAppUser(clerkClaims)`: `upsert` idempotente por `clerk_user_id`.
3. `problem.ts`: resposta `application/problem+json` com `type`, `title`,
   `status`, `detail` e `code` estável. **Nunca inclui valor de variável de
   ambiente, stack ou SQL.**
4. Harness de teste do servidor: injeta claims sem Clerk real, para que os testes
   rodem sem `CLERK_SECRET_KEY`.
5. Um endpoint privado mínimo só para exercitar o middleware (ex.: `GET /me`
   devolvendo o `app_user`). Ele tem chamador nos testes; se a Fase 5 não o
   usar, ele sai.

**Testes obrigatórios**
- Requisição sem sessão: 401, e nenhuma linha lida ou escrita.
- `userId` em `body`, `query` e `path` é **ignorado** — a posse sai da sessão.
- `ensureAppUser` idempotente: N chamadas com os mesmos claims → uma linha.
- `ensureAppUser` concorrente não viola `unique(clerk_user_id)`.
- Erro responde `problem+json` com `code` estável.
- **Nenhuma resposta de erro contém valor de segredo** — teste que planta valores
  reconhecíveis em `DATABASE_URL`/`ANTHROPIC_API_KEY` no ambiente de teste e
  varre o corpo de todas as respostas de erro.

**Critério de pronto**
- Portão verde. Os testes do servidor rodam **sem nenhuma variável real**, sobre
  PGlite e sessão injetada.

**Riscos**
- O middleware do Clerk pode exigir configuração real para montar. Se exigir, a
  saída é uma fronteira fina — uma função que extrai `clerkUserId` de uma
  requisição — com o Clerk de um lado e a sessão injetada do outro. O que não é
  aceitável é teste que contorna o middleware e prova o caminho errado.
- O endpoint mínimo virar código sem chamador. Se a Fase 5 não o consumir, ele é
  removido na Fase 10.

---

# Fase 4 — Harness de contrato *(esqueleto, rodando contra o local)*

**Objetivo:** a suíte de cenários existir e passar contra o adaptador local,
**antes** de existir qualquer adaptador de API. É o mecanismo de segurança da
migração inteira, e precisa ser real antes de ter algo a comparar.

**Arquivos**
- Criar: `artifacts/kalibra/src/domain/__contract__/scenarios.ts`
- Criar: `artifacts/kalibra/src/domain/__contract__/runner.ts`
- Criar: `artifacts/kalibra/src/domain/__contract__/local.test.ts`

**Tarefas**
1. Escrever os cenários como funções puras sobre a **porta** (Fase 1), nunca
   sobre um adaptador: criar workspace; importar edital; deduplicar entre cargos;
   renomear item; aplicar e separar cargo; diff de versão (PD-08); decidir
   aprovação.
2. `runner` recebe uma fábrica de adaptador e roda todos os cenários.
3. `local.test.ts` roda o runner contra o adaptador local.

**Testes obrigatórios**
- Todos os cenários verdes contra o local.
- Teste estrutural: nenhum cenário importa de `adapters/` nem menciona chave de
  `localStorage`. Um cenário que conhece o armazenamento não é contrato.

**Critério de pronto**
- Portão verde; o runner é parametrizável e o arquivo de API ainda não existe.

**Riscos**
- **O risco central da fase:** escrever cenários que só o local consegue
  satisfazer — dependência de ordem de escrita, de sincronicidade, ou de detalhe
  de storage. Mitigação: o teste estrutural acima, e escrever cada cenário em
  termos de *o que o usuário fez* e *o que o domínio deve dizer depois*, nunca de
  como foi guardado.
- Cenário que assume escrita síncrona. A porta precisa ser assíncrona desde já,
  mesmo para o adaptador local — senão a fase 5 quebra toda a suíte.
  **Decisão: a porta é assíncrona desde a Fase 1**; o adaptador local resolve
  imediatamente.

---

# Fases 5 a 9 — Um módulo por vez

As cinco fases seguintes têm a **mesma forma**. Cada uma:

1. Acrescenta as rotas do módulo a `lib/api-spec/openapi.yaml`, **escrito à mão**.
2. Roda o Orval; `lib/api-zod` e `lib/api-client-react` são gerados.
3. Implementa as rotas no `api-server`, validando entrada e saída com o Zod
   **gerado** e o domínio com `lib/core`.
4. Escreve o adaptador de API em `artifacts/kalibra/src/domain/adapters/api/<módulo>.ts`,
   implementando a porta.
5. Liga o harness de contrato ao adaptador de API do módulo (`api.test.ts`),
   contra o `api-server` real sobre PGlite.
6. Vira o módulo para `'api'` em `artifacts/kalibra/src/domain/config.ts`.
7. Roda a suíte inteira antes de seguir.

**Testes obrigatórios comuns a todas:**
- Harness de contrato verde contra os **dois** adaptadores.
- Isolamento: usuário A não lê, não atualiza e não apaga recurso de B; trocar
  slug/id na URL não contorna a posse.
- A suíte de telas continua verde com o módulo em `'api'`.
- Mutação otimista que falha **reverte e mostra** o erro.
- Nenhum snapshot muda.

**Critério de pronto comum:** portão verde com o módulo em `'api'`, e o harness
passando nos dois adaptadores.

**Risco comum:** um endpoint que "funciona" no teste do servidor mas cujo
adaptador nunca é chamado pela tela — a junta morta que a Fase 1B produziu três
vezes. Mitigação: a fase só está pronta quando `config.ts` está virado e a suíte
de telas passa **através** da API.

### Fase 5 — `workspaces` + `cargos`
Primeiro porque tudo pende dele. Inclui `GET/POST /workspaces`,
`GET/PATCH /workspaces/{slug}`, e o CRUD de cargos aninhado. A resposta de
workspace passa a devolver `nextAction` **computado** por `nextActionFor(status)`
e `selectedCargoId` **derivado** de `cargo.is_selected` (§2.5, §2.8).
*Risco próprio:* é a primeira vez que a tela lida com latência; é aqui que o
padrão otimista é estabelecido para as quatro fases seguintes.

### Fase 6 — `source-blocks`
`PUT /workspaces/{slug}/source-blocks` substitui o conjunto, com `If-Match` sobre
`workspace.version`.
*Risco próprio:* a hidratação do editor (mergeada em `65ec0bb`) lê
`workspace.sourceBlocks` na abertura do modal. Com a fonte assíncrona, o dado pode
não ter chegado quando o modal abre — e abrir vazio é exatamente o defeito que
aquela correção fechou.

### Fase 7 — `concepts`
Global por usuário. **Aqui o harness vai reprovar o adaptador local** por causa de
`unique(user_id, slug)` (§2.9): o local tolera o conceito provisório órfão que o
banco recusa.
*Tarefa extra desta fase:* endurecer o adaptador local para recusar também.
*Risco próprio:* essa correção muda comportamento que a Fase 1B registrou como
limite conhecido — precisa de teste próprio, não de ajuste silencioso.

### Fase 8 — `syllabus`
O módulo maior: `GET`, `PUT` de documento inteiro com `If-Match`, e os cinco
granulares que mapeiam `addItem`, `renameItem`, `updateLink`, `linkToCargo`,
`unlinkFromCargo`.
*Risco próprio:* o confirmar da revisão é hoje uma sequência de escritas
(conceitos → syllabus → aprovação → workspace) que a Fase 1B já viu rasgar no
meio. Sobre HTTP, cada uma é uma chamada. **Esta sequência precisa virar uma
transação do lado do servidor** — um endpoint que faz as quatro ou nenhuma.

### Fase 9 — `approvals`
Último porque referencia workspace e conceito. `GET`, `POST`, `PATCH` (decidir).
*Risco próprio:* `payload_before`/`payload_after` guardam árvores inteiras; sobre
HTTP isso vira payload grande. Medir antes de assumir que é aceitável.

---

# Fase 10 — Fechamento e verificação

**Objetivo:** fixar o que ficou combinado mas não implementado, e registrar
honestamente o que não foi verificado.

**Arquivos**
- Criar: `lib/api-spec/openapi.jobs.yaml` (**não** acrescentado à entrada do Orval)
- Criar: `docs/superpowers/plans/2026-09-15-kalibra-fase-1c-verificacao.md`
- Modificar: `.env.example` se algum nome novo surgiu

**Tarefas**
1. Escrever o contrato dos jobs de IA (`POST /jobs/question-generation`,
   `GET /jobs/{id}`) em arquivo separado, com comentário explicando por que o
   Orval não o lê ainda.
2. Remover o endpoint mínimo da Fase 3 se nada o consumir.
3. Varredura final das restrições globais: pureza de `lib/core`, ausência de
   storage/`fetch` nas telas, `index.css` intocado, nenhum `VITE_` com segredo,
   bundle sem segredo.
4. Escrever o documento de verificação.

**Testes obrigatórios**
- `openapi.jobs.yaml` não produz nenhum arquivo gerado — conferido por diff.
- Varredura: o bundle de produção não contém `DATABASE_URL`, `ANTHROPIC_API_KEY`
  nem `CLERK_SECRET_KEY`.
- Portão completo nos três fusos.

**Critério de pronto**
- Documento de verificação escrito, com uma seção declarando **o que não foi
  verificado** e por quê.

**Riscos**
- Afirmar verificação que não aconteceu. A regra é a da Fase 1B.5: a conferência
  visual foi registrada como **não feita** por falta de chave, em vez de
  inventada. Vale igual para "testado contra Postgres real" e "testado com Clerk
  real" — se não rodou, o documento diz que não rodou.

---

# O que NÃO implementar nesta fase

- **Diagnóstico, plano quinzenal e sessões de estudo.** São 1D, 1E e 1F.
- **Notas, erros, FSRS, questões, simulados, revisão ativa, pesquisa técnica,
  padrões de banca, fontes confiáveis, Anki, notificações.** Continuam em
  adaptador local.
- **IA de qualquer tipo:** nenhum endpoint implementado, nenhum hook gerado,
  nenhum worker, nenhuma chamada ao modelo. Só o contrato em arquivo separado.
- **RLS no Postgres.** Hardening posterior (§1.6).
- **Importação do `localStorage` existente.** Decisão registrada: começar limpo no
  servidor; o dado local fica intocado como cópia.
- **Telas novas, esqueletos de carregamento, painéis de erro, tokens novos.** A
  decisão aprovada é otimista reusando o que existe.
- **Remoção dos adaptadores locais.** Eles ficam.
- **Deploy, VPS, Docker, CI.** Não estão no escopo acordado e precisam de decisão
  própria — inclusive porque não há Docker nesta máquina.
- **Versão por documento** para `If-Match`. Fica a versão por workspace.

---

# Primeira PR recomendada

**Fase 1 — Portas reais. Nada além disso.**

**Escopo exato:**
- Criar `artifacts/kalibra/src/domain/ports/` com os tipos e interfaces dos cinco
  módulos a migrar.
- Mover `WorkspaceDraft`, `Cargo`, `SourceMode`, `ImportStatus` (e os equivalentes
  de concepts, syllabus e approvals) do adaptador local para as portas.
- Criar `artifacts/kalibra/src/domain/staging.ts` e mover para lá
  `stageWorkspaceImport`, `getPendingWorkspaceImport` e
  `clearPendingWorkspaceImport`.
- Devolver `migrateWorkspace` ao interior do adaptador local.
- Tornar a porta **assíncrona** (o adaptador local resolve imediatamente).
- Atualizar os imports dos consumidores.
- Dois testes estruturais: `ports/` não importa de `adapters/`; nenhum tipo de
  domínio é declarado em `adapters/local/`.

**Fora do escopo desta PR:** qualquer linha de schema, de servidor, de OpenAPI ou
de adaptador de API.

**Por que ela primeiro:** sem contrato independente, o harness de contrato é uma
tautologia e o adaptador de API teria de depender do local. É a única fase que
não pode ser reordenada.

**Como se prova que ficou certa:** a suíte passa idêntica — mesmas 570 —, nenhum
snapshot muda, e o diff contém apenas movimentação de código e troca de import.
Se algum teste mudar de resultado, a refatoração deixou de ser mecânica.

**Atenção:** tornar a porta assíncrona é a única parte desta PR que **não** é
puramente mecânica, e é o ponto onde ela pode quebrar. Se o custo for alto, é
defensável dividir em duas PRs — mover primeiro, tornar assíncrono depois — mas
as duas precisam entrar antes da Fase 2.
