# Fase 3 — Verificação

**Branch:** `fase-3-api-server` · **Plano:** `docs/superpowers/plans/2026-09-20-kalibra-fase-3-api-server.md`
**Spec:** `docs/superpowers/specs/2026-09-14-kalibra-fase-1c-design.md` (§1.3–§1.7)

Auth, posse e erro. Nenhum recurso de domínio — esses são a Fase 5 em diante.

---

## 1. Contagem final por pacote

| Pacote | Antes da fase | Depois | Delta |
|---|---|---|---|
| `lib/core` | 235 | **235** | 0 — não foi tocado |
| `lib/db` | 41 | **44** | +3 (`connection.test.ts`: importar sem `DATABASE_URL`, não abrir conexão, `criarDb(undefined)` lança) |
| `artifacts/api-server` | não existia na suíte | **31** | +31 |
| `artifacts/kalibra` | 341 | **341** | **0 — frontend intocado** |
| **Total** | 617 | **651** | +34 |

Os 31 do `api-server`: 4 em `criar-app.test.ts`, 13 em `require-auth.test.ts`,
10 em `problem.test.ts`, 4 em `tecnicas.test.ts`.

## 2. Portão

```
pnpm run typecheck   # 0 erros
pnpm run test        # 651
pnpm run build       # exit 0
```

**Três fusos, resultado idêntico:**

| `TZ` | `lib/core` | `lib/db` | `api-server` | frontend |
|---|---|---|---|---|
| `UTC` | 235 | 44 | 31 | 341 |
| `America/Sao_Paulo` | 235 | 44 | 31 | 341 |
| `Pacific/Kiritimati` | 235 | 44 | 31 | 341 |

## 3. Guardas load-bearing — prova por reversão (Tarefa D3)

Cada guarda foi **removida mecanicamente**, a suíte do `api-server` executada, o
nome do teste vermelho registrado, e a guarda restaurada.

| # | Guarda revertida | Testes que ficam vermelhos |
|---|---|---|
| 1 | o 401 de `requireAuth` (recusa trocada por `next()`) | `responde 401 e NÃO toca o banco`; `o 401 vem em problem+json com code estável`; `401 — sem sessão`; `app montado SEM extrator injetado responde 401 numa rota protegida` — **4** |
| 2a | `/me` passa a ler `req.query.clerkUserId` | `userId na QUERY é ignorado` — **1** |
| 2b | `/me` passa a ler `req.body.clerkUserId` | `userId no BODY é ignorado` — **1** *(ver §4.1 — antes da correção desta fase, ZERO)* |
| 2c | posse sai da cláusula `where` de `/users/:id` | `id no PATH não contorna a posse`; `A não lê o registro de B`; `trocar o id na URL não promove ninguém` — **3** |
| 3 | `onConflictDoUpdate` de `ensureAppUser` trocado por `insert` puro | `N chamadas sequenciais produzem UMA linha`; `chamadas CONCORRENTES não violam a unicidade nem duplicam`; `o próprio id no PATH funciona` — **3** |
| 4a | `app.use(erroFinal)` removido | `500 — erro interno PROVOCADO DE VERDADE` — **1**, e **nenhum teste de segredo** |
| 4b | 4a **mais** um erro cuja mensagem inclui `DATABASE_URL`, na rota que a varredura percorre | `404 recurso de outro: corpo e cabeçalhos limpos`; `500 provocado: corpo e cabeçalhos limpos`, mais 6 — **8** |
| 5 | `app.use(naoEncontrado)` removido | `404 — rota que não existe`; `404 — fora do prefixo /api também` — **2** |
| 6 | `fetch('/api/me')` plantado num arquivo do frontend | `nenhum arquivo do frontend chama /api/me nem /api/users/` — **1** |

**A guarda 4 precisou de duas etapas, e a primeira sozinha enganaria.** Remover o
`erroFinal` fez a resposta virar `text/html` com stack — mas a varredura de
segredos **não acusou**, porque a stack daquele erro específico não continha
nenhum dos valores plantados. Parar em 4a teria registrado "varredura provada"
sem ela nunca ter pego um vazamento. Só com 4b — um erro cuja mensagem carrega
`DATABASE_URL`, numa rota que a varredura de fato percorre — os testes de segredo
ficaram vermelhos.

## 4. Dois defeitos encontrados pela própria verificação

### 4.1 Um teste vacuoso: `userId no BODY é ignorado`

O teste mandava `method: 'GET'` com `content-type: application/json` e **nenhum
corpo** — porque `fetch` recusa corpo em GET, silenciosamente. Ele defendia o
vetor no nome e não no que executava.

Medido: com `/me` alterado para ler `req.body.clerkUserId`, **a suíte inteira
continuava verde**. Os outros dois vetores (query e path) eram load-bearing; este
não era.

Corrigido: o harness ganhou `pedirComCorpoNoGet`, que fala direto por `node:http`.
O protocolo permite corpo em GET e `express.json()` o analisa. A reversão agora
fica vermelha.

**É o defeito que a D3 existe para achar.** Contar "três vetores cobertos" sem a
reversão teria deixado um terço da guarda sem defesa nenhuma.

### 4.2 Rota desconhecida devolvia HTML

A seção C afirmava uniformidade de `problem+json` e tinha um buraco. Quando
nenhuma rota casava, o Express tratava pelo caminho padrão e devolvia
`Cannot GET /api/rota-que-nao-existe` dentro de uma página HTML.

`erroFinal` não cobre isso: ele é tratador de **erro**, e um 404 de rota
desconhecida não lança nada. E a varredura de segredos passava, porque aquela
página não contém segredo nenhum — foi olhar a resposta de verdade, na D4, que
achou.

Corrigido com `naoEncontrado`, montado depois do router e antes do `erroFinal`,
com corpo fixo que não ecoa o caminho pedido.

## 5. O erro padrão do Express era vazamento real

Não é hipótese. Antes do `erroFinal`, qualquer erro não tratado respondia com a
página padrão do Express, que inclui a mensagem e a **stack completa** em HTML.
Isso já tinha aparecido neste projeto: sem `CLERK_SECRET_KEY`, a resposta trazia
caminho de arquivo, linha e a cadeia de chamadas inteira.

O que isso significa no caminho real: uma mensagem de driver de banco traz o SQL;
um erro de conexão traz a string de conexão, **com a senha dentro**. Por isso o
corpo do `erroFinal` é fixo — nem `error.message`, nem `detail` derivado. O
detalhe vai para o log do servidor; ao cliente volta só um `code` estável.

O 500 do teste é **provocado de verdade**, não simulado: um id que não é UUID faz
o Postgres lançar `invalid input syntax for type uuid`, com SQL na mensagem.

## 6. `vitest` não substitui `typecheck`

Registrado como lição desta fase, repetindo a da Fase 2.

Em dado momento a suíte tinha **17 testes verdes e 13 erros de tipo**. `vitest`
usa `esbuild`, que **apaga** os tipos sem checá-los — testes verdes não dizem nada
sobre tipagem. Os 13 vinham de `Response.json()` devolver `unknown`.

O portão de `typecheck` é obrigatório e pegou erro real. Uma fase que rodasse só
`pnpm run test` teria sido declarada pronta com eles dentro.

## 7. Decisão das rotas técnicas (Tarefa D2)

**`GET /api/me` e `GET /api/users/:id` FICAM, com prazo de validade escrito.**

São rotas **técnicas de fundação/auth, não recurso de produto**. Existem para que
autenticação, posse e formato de erro tenham o que exercitar antes de qualquer
recurso de domínio existir.

A regra registrada é *"tabela sem endpoint é aceitável; código sem chamador não
é"*, e um endpoint cujo único chamador é teste está na fronteira. Ficam porque
cada uma é o instrumento de uma guarda que, sem ela, não teria como ser
exercitada:

- **`/me`** é a única rota cuja resposta correta é definida **só pela sessão**. É
  o que a torna capaz de provar que o cliente não declara quem é: se o servidor
  passasse a confiar no corpo ou na query, a resposta mudaria de forma visível.
- **`/users/:id`** é a única que recebe do cliente o identificador de um recurso.
  Sem ela não há vetor de path, não há prova de 404-em-vez-de-403, e a posse na
  cláusula `where` fica sem nada que a defenda.

**Ficam fora de OpenAPI, Orval, hook gerado e tela.** Isso não é promessa de
comentário: `tecnicas.test.ts` varre o `src` inteiro do frontend e falha se algum
arquivo chamar `/api/me` ou `/api/users/`. A varredura foi provada plantando uma
chamada num arquivo real do frontend (guarda 6 da tabela). O mesmo teste fixa que
nenhum `openapi.*` que venha a existir no `api-server` pode descrevê-las.

**Saem na Fase 5**, no mesmo commit em que `GET /api/workspaces/:id` entrar: aí a
guarda de posse passa a ter recurso de domínio de verdade para defender, e os
testes de isolamento são reescritos contra ele. Manter as duas depois disso seria
exatamente a inércia que esta decisão existe para evitar.

---

# 8. O que NÃO foi verificado

Esta seção é o que impede alguém de ler a tabela do §3 e concluir mais do que ela
diz.

## 8.1 Nada foi exercitado contra o Clerk real

Toda a fase roda contra **sessão injetada**. `CLERK_SECRET_KEY` no teste é
`sk_test_marcador_sintatico_nao_e_segredo` — um marcador que permite ao
`clerkMiddleware` inicializar, não uma credencial.

O que isso deixa sem prova: validação de token de verdade, expiração, rotação de
chave, formato de claims que o Clerk emite em produção. O que **está** provado é
que a lógica que consome o resultado — recusar sem sessão, nunca ler posse do
cliente — é o mesmo código nos dois caminhos, e que o caminho de produção (app
montado **sem** injeção) recusa com 401.

Descoberta rasa corrigida durante a fase: o plano afirmava que `clerkMiddleware`
funciona sem `CLERK_SECRET_KEY`. Ele **monta** sem a chave, mas **lança ao atender
a primeira requisição**, transformando toda resposta em 500. Construção foi
testada; atendimento não.

## 8.2 Nada foi exercitado contra Postgres real

Toda a suíte roda contra **PGlite** (Postgres em WASM). Vale para `lib/db` desde a
Fase 2 e para o `api-server` agora.

O que isso deixa sem prova: comportamento de pool sob concorrência real, latência,
timeout, reconexão, e qualquer divergência entre PGlite e o servidor Postgres.
Onde o Postgres vai rodar continua indefinido — deploy, VPS, Docker e CI estão
fora de escopo por decisão registrada.

## 8.3 Isolamento de recurso de domínio ainda não verificado; será refeito na Fase 5

Os testes de isolamento provam que **a fronteira de posse existe**, não que ela
protege conteúdo. Com só `app_user` no ar, "A não lê o registro de B" é bem menos
do que "A não lê o **edital** de B".

Eles estão marcados como rasos no próprio arquivo (`isolamento entre usuários —
RASO nesta fase`) e **serão reescritos contra workspace, syllabus e aprovação na
Fase 5**, quando esses recursos existirem.

Declarar a lacuna é o que impede alguém de ler "3 testes de isolamento ✓" e
concluir que o isolamento está coberto.

## 8.4 Outras lacunas

- **RLS** não existe — hardening posterior, como o spec prevê.
- **Nenhum endpoint de domínio** (workspace, cargo, edital, conceito, syllabus,
  aprovação) foi escrito. Fase 5 em diante.
- **OpenAPI e Orval** não existem; entram com o primeiro módulo.
- **Nenhum adaptador de API no frontend** — os adaptadores locais continuam sendo
  o único caminho, e os 341 testes do frontend terminam idênticos aos do início.
- **`If-Match` / concorrência otimista** não foi implementada nesta fase; a
  política (428/412) está no roteiro da Fase 1C e entra com o primeiro recurso
  que aceite escrita.
