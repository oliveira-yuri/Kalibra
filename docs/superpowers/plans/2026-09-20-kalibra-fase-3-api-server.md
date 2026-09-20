# Fase 3 — Fundação do `api-server` (plano executável)

> **Auth, posse e erro. Nenhum recurso de domínio.** Ao final o servidor autentica,
> identifica o usuário, recusa quem não tem sessão e responde erro no formato
> certo — sem nenhum endpoint de workspace, conceito ou syllabus. Esses são a
> Fase 5 em diante.

**Roteiro:** `docs/superpowers/plans/2026-09-15-kalibra-fase-1c.md` (Fase 3)
**Spec:** `docs/superpowers/specs/2026-09-14-kalibra-fase-1c-design.md` (§1.3–§1.7)

**Linha de base:** `main` em `4c3195f`, 617 testes (235 `lib/core` + 41 `lib/db` +
341 `artifacts/kalibra`), portão verde.

---

## Descoberta feita antes de escrever este plano

Três verificações executadas. Duas mudam o plano, e a segunda é bloqueante.

### 1. O middleware do Clerk monta sem segredo — auth é testável

```
node -e "clerkMiddleware()"  → montou sem CLERK_SECRET_KEY
@clerk/express exporta: authenticateRequest, clerkClient, clerkMiddleware,
                        createClerkClient, getAuth, requireAuth, verifyToken
```

`clerkMiddleware` já está montado em `app.ts` e não lança na ausência da chave.
`getAuth(req)` lê o que ele anexou. Ou seja: a fronteira de autenticação pode ser
exercitada sem credencial real, desde que o teste injete a sessão pelo mesmo ponto
por onde o Clerk a entrega — não contornando o middleware.

### 2. BLOQUEANTE — `lib/db` lança na importação e abre um `Pool` ansiosamente

```ts
// lib/db/src/index.ts, hoje
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set…");
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

`artifacts/api-server` importa `@workspace/db`. Com isso, **o servidor não
consegue nem ser importado num teste sem `DATABASE_URL`** — e abriria um pool de
conexões TCP como efeito colateral de `import`, mesmo num processo que só quer
rodar asserções contra PGlite.

É o mesmo padrão que a Fase 2 já corrigiu em `drizzle.config.ts`: exigir segredo
para uma operação que não conecta em nada.

**Consequência:** a Tarefa A1 torna `lib/db` livre de efeito colateral na
importação — o schema sai sempre, e a conexão vira função que só abre pool quando
alguém pede. Sem isso, nenhuma tarefa desta fase é testável.

### 3. `app.ts` exporta um singleton; o teste precisa de uma fábrica

Hoje `app.ts` monta o Express no topo do módulo e exporta `app`. Para testar auth
e posse é preciso injetar duas coisas: o banco (PGlite em vez de Postgres) e o
extrator de `userId` (sessão falsa em vez do Clerk).

A Tarefa A2 extrai `criarApp({ db, extrairUserId })`. `app.ts` passa a ser só o
wiring de produção — o mesmo código, com as dependências reais.

---

## Restrições globais desta fase

Copiadas do §1 do spec; um revisor rejeita a tarefa que violar qualquer uma.

- **`userId` vem só da sessão validada.** Nunca de `body`, `query` ou `path`. Um
  `userId` que chegue no corpo é campo inexistente para o servidor, não erro de
  validação.
- **Dado enviado pelo cliente não declara posse.**
- Toda consulta a recurso de usuário filtra por `user_id`. Buscar por `id` e
  conferir posse depois, em código, é proibido.
- **Segredo nunca aparece** em erro, log, resposta ou mensagem. `DATABASE_URL`,
  `ANTHROPIC_API_KEY` e `CLERK_SECRET_KEY` existem só no servidor.
- Nenhuma regra de domínio reimplementada no servidor — ela vive em `lib/core`.
- Nenhuma tarefa pesada de IA dentro da requisição (nesta fase não há IA nenhuma).
- **Nada no frontend muda**; os 341 testes devem terminar idênticos.
- Nenhuma tabela preparatória referenciada por código de aplicação.
- Commits em português, `tipo: descrição`, corpo terminando com:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

---

# A. Fundação testável

### Tarefa A1 — `lib/db` sem efeito colateral na importação
**Objetivo:** desbloquear a fase. Importar o pacote não pode exigir segredo nem
abrir conexão.
**Arquivos:** `lib/db/src/index.ts`; criar `lib/db/src/connection.ts`
**Ação exata:** `index.ts` passa a reexportar o schema e a fábrica, sem executar
nada. A conexão vira `criarDb(databaseUrl)`, que abre o pool **quando chamada** e
lança com mensagem clara se a URL faltar — a validação continua existindo, só
deixa de acontecer em tempo de importação.
**Testes obrigatórios:** importar `@workspace/db` sem `DATABASE_URL` **não lança**
e não abre conexão; `criarDb(undefined)` **lança**.
**Verificação:** `pnpm run typecheck && pnpm run test` verdes.
**Riscos:** algum consumidor pode depender do `db` exportado como valor. Hoje não
há nenhum — `artifacts/api-server` importa o pacote mas não usa `db`. Se aparecer,
o conserto é passar a instância por parâmetro, não restaurar o singleton.

### Tarefa A2 — `criarApp({ db, extrairUserId })`
**Objetivo:** permitir injetar banco e sessão sem tocar no caminho de produção.
**Arquivos:** criar `artifacts/api-server/src/criar-app.ts`; modificar `src/app.ts`
**Ação exata:** mover o corpo de `app.ts` para uma fábrica que recebe as duas
dependências. `app.ts` fica sendo o wiring de produção: chama a fábrica com
`criarDb(process.env.DATABASE_URL)` e o extrator do Clerk. **A ordem dos
middlewares não muda** — em especial, o proxy do Clerk continua montado antes do
`express.json()`, como o comentário daquele arquivo exige.
**Testes obrigatórios:** a fábrica monta com dependências falsas e responde no
`/api/healthz` existente.
**Riscos:** reordenar middleware sem querer. O diff desta tarefa deve ser
movimentação, não reescrita.

### Tarefa A3 — Harness de teste do servidor
**Objetivo:** subir o app real, com PGlite e sessão injetada, e falar HTTP com ele.
**Arquivos:** criar `artifacts/api-server/src/test/harness.ts`; modificar
`artifacts/api-server/package.json` (script `test`, `vitest` como devDep) e criar
`vitest.config.ts`
**Ação exata:** o harness sobe o app numa porta efêmera, devolve uma função que faz
requisições com `fetch`, e permite escolher quem está autenticado — incluindo
"ninguém". **Sem `supertest`:** `fetch` contra uma porta efêmera resolve, e evita
uma dependência nova.
**Testes obrigatórios:** fumaça — `GET /api/healthz` responde 200 com o app real.
**Riscos:** PGlite é WASM e custa segundos por instância; reusar entre testes do
mesmo arquivo, como `lib/db` já faz.

---

# B. Autenticação e posse

### Tarefa B1 — `requireAuth`
**Arquivos:** criar `artifacts/api-server/src/middlewares/require-auth.ts`
**Ação exata:** middleware que obtém o `clerkUserId` **pelo extrator injetado** e
responde 401 quando não há sessão. Em produção o extrator chama `getAuth(req)`; em
teste, devolve a sessão injetada. A lógica do middleware — negar sem sessão, nunca
ler posse do cliente — é **o mesmo código** nos dois casos.
**Testes obrigatórios:**
- requisição sem sessão: **401**, e **nenhuma linha lida ou escrita no banco**
  (verificado contando linhas antes e depois, não por inspeção de código);
- `userId` em `body`, `query` e `path` é **ignorado** — três testes, um por lugar.

### Tarefa B2 — `ensureAppUser`
**Arquivos:** criar `artifacts/api-server/src/lib/ensure-app-user.ts`
**Ação exata:** `upsert` sobre `clerk_user_id`. Roda na primeira requisição
autenticada que precise persistir algo.
**Testes obrigatórios:**
- N chamadas com os mesmos claims produzem **uma** linha;
- chamadas **concorrentes** não violam `unique(clerk_user_id)` — a idempotência é
  garantida pela constraint, não pela ordem de execução. Este é o teste que a
  Fase 2 preparou ao criar aquela unicidade.

### Tarefa B3 — Isolamento entre usuários
**Objetivo:** os três invariantes do §1.5, no nível de HTTP.
**Ação exata:** um endpoint privado mínimo é necessário para exercitá-los. Usar
`GET /api/me`, que devolve o `app_user` da sessão — ele tem chamador nos testes
desta fase e **é removido na Tarefa D2 se a Fase 5 não o consumir**.
**Testes obrigatórios (os três do §1.5):**
- usuário A não lê recurso de B;
- usuário A não atualiza recurso de B;
- trocar id na URL não contorna a posse.
**Riscos:** com só `app_user` no ar, os três testes ficam rasos. Devem ser
**reescritos como testes de recurso de verdade na Fase 5**, quando houver
workspace. Registrar isso no documento de verificação em vez de fingir que a
cobertura está completa.

---

# C. Erro

### Tarefa C1 — `problem+json`
**Arquivos:** criar `artifacts/api-server/src/lib/problem.ts`
**Ação exata:** resposta de erro com `type`, `title`, `status`, `detail` e um
`code` **estável** que o cliente compare. **Nunca** inclui valor de variável de
ambiente, stack ou SQL. O texto que o usuário vê é escolhido pelo cliente a partir
do `code` (§3.6) — o servidor não manda texto de produto.
**Testes obrigatórios:** erro responde `application/problem+json`; o `code` é
estável entre execuções.

### Tarefa C2 — Nenhum segredo vaza
**Objetivo:** provar por execução, não por revisão de código.
**Ação exata:** teste que planta valores reconhecíveis em `DATABASE_URL`,
`ANTHROPIC_API_KEY` e `CLERK_SECRET_KEY` no ambiente de teste, provoca erros em
várias rotas, e **varre o corpo e os cabeçalhos de todas as respostas** procurando
esses valores.
**Testes obrigatórios:** nenhuma resposta de erro contém nenhum dos três valores.
**Por quê assim:** revisar código acha o vazamento que alguém escreveu de
propósito; varrer a resposta acha o que um `error.message` de biblioteca trouxe
junto sem ninguém notar.

---

# D. Portão e verificação

### Tarefa D1 — Portão completo
```bash
pnpm run typecheck && pnpm run test && pnpm run build
TZ=UTC pnpm run test
TZ=America/Sao_Paulo pnpm run test
TZ=Pacific/Kiritimati pnpm run test
```
Esperado: verde; **os 341 do frontend idênticos**; `api-server` é pacote novo na
contagem.

### Tarefa D2 — Remover `/api/me` se não tiver chamador
**Ação exata:** se a Fase 5 não o consome, ele sai — ou fica, com a justificativa
escrita. A decisão registrada é "tabela sem endpoint é aceitável; código sem
chamador não é", e um endpoint só com chamador em teste está na fronteira. Decidir
explicitamente em vez de deixar por inércia.

### Tarefa D3 — Provar as guardas load-bearing
**Ação exata:** como na Tarefa E2 da Fase 2 — remover mecanicamente cada guarda e
registrar **o nome do teste que fica vermelho**:
- o 401 de `requireAuth`;
- o descarte do `userId` vindo do cliente;
- o `upsert` de `ensureAppUser` (trocado por `insert`);
- a omissão de segredo na resposta de erro.

### Tarefa D4 — Documento de verificação
**Arquivos:** criar `docs/superpowers/plans/2026-09-20-kalibra-fase-3-verificacao.md`
**Ação exata:** contagens por pacote, portão nos três fusos, a tabela das guardas
com o vermelho medido, e a seção **"O que não foi verificado"** — que nesta fase
inclui, no mínimo: **nada foi exercitado contra o Clerk real**, só contra sessão
injetada; e **nada contra Postgres real**, só PGlite.

---

# Critério de pronto

- Portão verde nos três fusos; **341 do frontend inalterados**.
- Importar `@workspace/db` sem `DATABASE_URL` não lança e não abre conexão.
- Requisição sem sessão: 401, sem tocar o banco.
- `userId` de `body`/`query`/`path` ignorado — provado nos três lugares.
- `ensureAppUser` idempotente, inclusive concorrente.
- Nenhum segredo em corpo ou cabeçalho de resposta de erro, provado por varredura.
- Cada guarda provada vermelha quando removida (D3).
- Documento de verificação com a seção do que não foi verificado.

# Fora do escopo desta fase

- Endpoints de workspace, cargo, edital, conceito, syllabus ou aprovação — Fase 5+.
- OpenAPI e Orval — entram com o primeiro módulo.
- Qualquer adaptador de API no frontend.
- RLS — hardening posterior.
- Deploy, VPS, Docker, CI.
- IA de qualquer tipo.
