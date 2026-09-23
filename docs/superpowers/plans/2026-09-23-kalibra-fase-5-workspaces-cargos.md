# Fase 5 — `workspaces` + `cargos` (plano executável)

> **O primeiro módulo com backend de verdade.** Ao final, a tela de workspaces lê
> e escreve pela API, os mesmos cenários do harness rodam contra os dois
> adaptadores, e a divergência entre eles — se houver — aparece como teste
> vermelho.

**Roteiro:** `docs/superpowers/plans/2026-09-15-kalibra-fase-1c.md` (Fase 5)
**Spec:** `docs/superpowers/specs/2026-09-14-kalibra-fase-1c-design.md` (§2.5, §2.8, §3.3–§3.7)
**Linha de base:** `main` em `954d4d5`, 705 testes, portão verde.

---

## Descoberta feita antes de escrever este plano

Quatro verificações executadas. **Duas mudam o plano e uma é bloqueante.**

### 1. O pipeline de contratos JÁ EXISTE e funciona

```
lib/api-spec/openapi.yaml      → só /healthz, escrito à mão
lib/api-spec/orval.config.ts   → gera api-client-react (React Query) e api-zod (Zod 3)
lib/api-zod/src/generated/     → healthStatus
lib/api-client-react/src/      → custom-fetch.ts + generated/
node_modules/.bin/orval        → instalado
```

Herdado do setup Replit e preservado desde a Fase 0. **Não há nada a montar** —
esta fase acrescenta caminhos ao YAML e roda `pnpm --filter @workspace/api-spec
run codegen`. O `orval.config.ts` já fixa Zod 3 para casar com o catálogo, com o
motivo escrito no arquivo.

### 2. BLOQUEANTE — o cookie de sessão não chega ao servidor

Dois fatos que só juntos formam o problema:

```
artifacts/kalibra/vite.config.ts  → NÃO tem proxy para /api
lib/api-client-react/custom-fetch.ts → NUNCA define `credentials`
artifacts/api-server/criar-app.ts:74 → cors({ credentials: true, origin: true })
```

Em dev, o frontend serve em `:5173` e o `api-server` em outra porta. **Origens
diferentes.** O servidor aceita credenciais, mas o cliente nunca as manda: o
padrão de `fetch` é `same-origin`, e ninguém sobrescreve. **O cookie do Clerk não
viaja, e toda requisição privada responderia 401** — parecendo defeito de
autenticação quando é de origem.

**Duas saídas, e a escolha importa:**

| | Proxy `/api` no Vite | `credentials: 'include'` no `custom-fetch` |
|---|---|---|
| Origem | mesma | cruzada |
| Cookie | viaja sozinho | precisa de CORS afinado em produção |
| Parecido com produção | **sim** — lá o servidor serve o frontend | não |
| Toca arquivo vizinho do gerado | não | sim |

**Decisão: proxy no Vite.** Mesma origem é o que produção terá, e é a única das
duas que não depende de o CORS estar certo. `custom-fetch.ts` não é gerado, mas
vive ao lado do gerado e é infraestrutura herdada — mexer nele é o último
recurso, não o primeiro.

### 3. `SourceMode` ainda não está em `lib/core`

A Fase 2 registrou isto como dívida com prazo: *"movê-los para `lib/core` é o
conserto certo e pertence à fase que migra o módulo de workspaces"*. É esta fase.
Hoje `workspace.source_mode` é `text` em vez de `pgEnum` por causa disso, e o
contrato da API precisa do tipo de qualquer forma.

### 4. Os 20 cenários NÃO podem todos rodar contra a API nesta fase

`GET /workspaces` existe ao final desta fase; `/syllabus`, `/concepts` e
`/approvals` não. Dos 20 cenários, **5 tocam só workspaces e cargos**; os outros
15 dependem de módulos que só chegam nas Fases 6–9.

Rodar os 20 contra a API faria 15 falharem por ausência de endpoint — ruído que
esconderia a única falha que interessa. Mas "rodar um subconjunto" é exatamente
como um cenário some em silêncio.

**Solução na Tarefa C2:** cada cenário declara de que módulos precisa, e um teste
confere que o conjunto rodado contra a API é **exatamente** o derivável dos
módulos migrados — nem um a menos. Pular vira uma afirmação verificada, não uma
omissão.

---

## Restrições globais desta fase

- **`userId` vem só da sessão validada.** Nunca de `body`, `query` ou `path`.
- **Toda consulta filtra por `user_id`**; posse entra na cláusula `where`.
- **Segredo nunca aparece** em erro, log, resposta ou bundle. `VITE_` só na chave
  publicável do Clerk.
- **Validação de forma vem do Zod gerado; validação de domínio vem de `lib/core`.**
  O servidor não escreve schema próprio nem reimplementa regra.
- **Nenhum texto de produto vem do servidor** — o cliente escolhe a partir do `code`.
- **Nada de token getter no frontend.** Cookie, nunca `Authorization: Bearer`.
- **Toda reversão otimista é visível** ao usuário (§3.7).
- **O design não muda.** Nenhuma tela nova, nenhum componente novo, nenhum token
  visual alterado. Latência se resolve com o que já existe.
- Commits em português, `tipo: descrição`, corpo terminando com:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

---

## Escopo exato

**Dentro:**

| | |
|---|---|
| Endpoints | `GET/POST /workspaces`, `GET/PATCH /workspaces/{slug}`, `POST /workspaces/{slug}/cargos`, `PATCH`/`DELETE …/cargos/{id}` |
| Derivados na resposta | `nextAction` de `nextActionFor(status)`, `selectedCargoId` de `cargo.is_selected`, `importStatus` mapeado do status |
| Contrato | caminhos novos no `openapi.yaml`, Orval regenerado, servidor validando com o Zod gerado |
| Frontend | adaptador de API para workspaces, `domainConfig.workspaces = 'api'`, mutações otimistas com reversão visível |
| Harness | driver de API sobre o `api-server` real em PGlite; os 5 cenários de workspace/cargo rodando dos dois lados |
| Dívida | `SourceMode` promovido a `lib/core`; `source_mode` vira `pgEnum` |
| Limpeza | `/api/me` e `/api/users/:id` removidos, sob critério escrito |

**Fora:** `source-blocks` (Fase 6), `concepts` (7), `syllabus` (8), `approvals`
(9). `If-Match` é **implementado e testado** nesta fase, mas o único endpoint que
o exige — `PUT …/source-blocks` — chega na Fase 6; aqui ele guarda o `PATCH` de
workspace. Sem IA, sem RLS, sem deploy.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/core/src/workspace/source-mode.ts` | `SourceMode` e sua lista em runtime |
| `lib/db/src/schema/workspace.ts` | `source_mode` vira `pgEnum` |
| `lib/api-spec/openapi.yaml` | +4 caminhos, +schemas |
| `artifacts/api-server/src/routes/workspaces.ts` | os quatro endpoints de workspace |
| `artifacts/api-server/src/routes/cargos.ts` | os três de cargo |
| `artifacts/api-server/src/lib/workspace-dto.ts` | linha do banco → corpo da resposta, com os derivados |
| `artifacts/api-server/src/lib/if-match.ts` | `428`/`412` e o incremento na mesma transação |
| `artifacts/kalibra/src/domain/adapters/api/workspaces.ts` | o adaptador, sobre os hooks gerados |
| `artifacts/kalibra/src/domain/__contract__/api-driver.ts` | `Driver` sobre a API |
| `artifacts/kalibra/src/domain/__contract__/api.test.ts` | roda o contrato contra a API |
| `artifacts/kalibra/vite.config.ts` | proxy `/api` |

---

# Bloco A — Contrato

### Tarefa A1 — `SourceMode` para `lib/core`

**Objetivo:** pagar a dívida registrada na Fase 2, que esta fase precisa de
qualquer forma.

**Arquivos:** criar `lib/core/src/workspace/source-mode.ts`; modificar
`lib/core/src/index.ts`, `artifacts/kalibra/src/domain/ports/workspaces.ts`,
`lib/db/src/schema/workspace.ts` e `enums.ts`

- [ ] **Passo 1: declarar em `lib/core`**, no mesmo padrão exaustivo-por-construção
  dos outros enums:

```ts
/** De onde veio o edital. `none` = ainda não importado. */
export type SourceMode = 'file' | 'text' | 'none';

const SOURCE_MODE_SET: Record<SourceMode, true> = { file: true, text: true, none: true };

/**
 * Derivado de um `Record` completo, como `WORKSPACE_STATUSES`: o compilador
 * recusa o literal se faltar ou sobrar chave, então a lista não pode ficar atrás
 * do tipo.
 */
export const SOURCE_MODES: readonly SourceMode[] = Object.keys(SOURCE_MODE_SET) as SourceMode[];
```

- [ ] **Passo 2:** `ports/workspaces.ts` passa a **reexportar** de `@workspace/core`
  em vez de declarar. A porta continua exportando o nome; o que muda é a origem.
- [ ] **Passo 3:** `lib/db/src/schema/enums.ts` ganha
  `sourceModeEnum = pgEnum('source_mode', comoTupla(SOURCE_MODES))`, e
  `workspace.sourceMode` deixa de ser `text`.
- [ ] **Passo 4:** migration gerada por `drizzle-kit generate`.
- [ ] **Passo 5:** o teste anti-drift de `lib/db` passa a cobrir **seis** enums
  compartilhados em vez de cinco, e a nota de exceção de `source_mode` sai do
  arquivo — a exceção deixou de existir.
- [ ] **Passo 6: provar load-bearing.** Acrescentar `'pdf'` a `SOURCE_MODES` sem
  regenerar a migration: o teste anti-drift fica **vermelho**. Reverter.
- [ ] **Passo 7: commit** — `feat: SourceMode sai de ports para lib/core e vira pgEnum`

### Tarefa A2 — OpenAPI: os sete caminhos

**Arquivos:** modificar `lib/api-spec/openapi.yaml`

**O YAML é escrito à mão — é a fonte.** Nada aqui é gerado.

- [ ] **Passo 1: schemas.** `Workspace`, `WorkspaceCreate`, `WorkspacePatch`,
  `Cargo`, `CargoCreate`, `CargoPatch`, `Problem`.

`Workspace` na resposta inclui os **derivados**, marcados `readOnly`:

```yaml
Workspace:
  type: object
  required: [slug, title, institution, type, cargos, availability, status,
             sourceMode, active, version, nextAction, importStatus]
  properties:
    slug: { type: string }
    title: { type: string }
    institution: { type: string }
    type: { type: string }
    examDate: { type: string, format: date, nullable: true }
    cargos: { type: array, items: { $ref: "#/components/schemas/Cargo" } }
    # Derivado de cargo.is_selected (§2.5) — o cliente lê, nunca escreve.
    selectedCargoId: { type: string, nullable: true, readOnly: true }
    availability: { $ref: "#/components/schemas/WeeklyAvailability" }
    status: { $ref: "#/components/schemas/WorkspaceStatus" }
    sourceMode: { $ref: "#/components/schemas/SourceMode" }
    sourceFileName: { type: string, nullable: true }
    active: { type: boolean }
    # If-Match das operações destrutivas. Por workspace, não por documento.
    version: { type: integer, readOnly: true }
    # Função pura do status (§2.8). Nunca persistido.
    nextAction: { type: string, readOnly: true }
    importStatus: { $ref: "#/components/schemas/ImportStatus", readOnly: true }
```

**`progress` não entra.** A Fase 2 o removeu do schema por não haver dado real de
estudo para computá-lo, e inventá-lo aqui recriaria a segunda representação que
aquela fase eliminou. Volta quando houver diagnóstico.

- [ ] **Passo 2: caminhos.** Os quatro de workspace e os três de cargo, com
  `operationId` em camelCase (`listWorkspaces`, `createWorkspace`,
  `getWorkspace`, `patchWorkspace`, `createCargo`, `patchCargo`, `deleteCargo`).
- [ ] **Passo 3:** cada operação declara `401`, `404` e `500` apontando para
  `Problem`; `patchWorkspace` declara também `428` e `412`.
- [ ] **Passo 4: gerar** — `pnpm --filter @workspace/api-spec run codegen`. O
  script já roda `typecheck:libs` no fim.
- [ ] **Passo 5:** conferir que `lib/api-zod/src/generated` e
  `lib/api-client-react/src/generated` ganharam os schemas e hooks, e que o
  `git diff` deles é **só** gerado — nenhuma edição à mão.
- [ ] **Passo 6: teste de não-divergência.** Um teste que falha se
  `src/generated` estiver fora de data em relação ao YAML: roda o codegen num
  diretório temporário e compara. Sem ele, alguém edita o gerado à mão e o "fonte
  única" vira duas cópias.
- [ ] **Passo 7: commit** — `feat: openapi de workspaces e cargos, com Orval regenerado`

---

# Bloco B — Servidor

### Tarefa B1 — DTO e derivados

**Arquivos:** criar `artifacts/api-server/src/lib/workspace-dto.ts`

- [ ] **Passo 1:** função pura que recebe a linha de `workspace` mais os `cargo`
  e devolve o corpo da resposta, computando:
  - `nextAction` = `nextActionFor(status)` de `lib/core`;
  - `selectedCargoId` = id do cargo com `is_selected`, ou `null`;
  - `importStatus` = mapeado do status, pela tabela inversa da que o adaptador
    local já usa.

**Nenhuma dessas três regras é reimplementada aqui** — `nextActionFor` vem de
`lib/core`, e o mapeamento de `importStatus` é movido para `lib/core` na mesma
tarefa, para que os dois lados leiam a mesma função. Duas cópias divergem.

- [ ] **Passo 2: testes** — um por derivado, mais um que exige que **todo**
  `WorkspaceStatus` produza `nextAction` não vazio (exaustivo sobre
  `WORKSPACE_STATUSES`, que é exaustivo por construção).
- [ ] **Passo 3: commit**

### Tarefa B2 — `GET /workspaces` e `GET /workspaces/{slug}`

**Arquivos:** criar `artifacts/api-server/src/routes/workspaces.ts`

- [ ] **Passo 1:** ambas atrás de `requireAuth`, com `user_id` da sessão **na
  cláusula `where`**. `{slug}` localiza por `slug + user_id`; slug de outro
  usuário devolve **404**, nunca 403.
- [ ] **Passo 2:** resposta validada pelo Zod gerado antes de sair. Divergência
  entre spec e implementação vira erro em teste, não bug em produção.
- [ ] **Passo 3: testes** — lista vazia para usuário novo; workspace de outro
  usuário dá 404; `nextAction` e `selectedCargoId` vêm computados; sem sessão dá
  401 **sem tocar o banco** (o contador do harness da Fase 3).
- [ ] **Passo 4: commit**

### Tarefa B3 — `POST /workspaces` e `PATCH /workspaces/{slug}`

- [ ] **Passo 1:** `POST` valida forma com o Zod gerado e **domínio com
  `lib/core`** — slug normalizado por `slugify`, status inicial decidido por
  `lib/core`, nunca pelo corpo da requisição.
- [ ] **Passo 2:** slug duplicado **do mesmo usuário** responde `409` com
  `code: slug_em_uso`. É `unique(user_id, slug)` da Fase 2 que garante — o
  servidor traduz a violação, não a previne com um `select` antes (que teria
  janela de corrida).
- [ ] **Passo 3:** `PATCH` aceita subconjunto de campos. **Recusa** `nextAction`,
  `selectedCargoId`, `importStatus` e `version` — são derivados ou do servidor.
  Recusar é `400` com `code: campo_derivado`, não ignorar em silêncio.
- [ ] **Passo 4:** toda escrita **incrementa `version` na mesma transação**.
- [ ] **Passo 5: testes** — criar e reler; slug duplicado do mesmo usuário dá 409;
  **o mesmo slug para outro usuário é aceito** (sem esta, uma unicidade global
  passaria); `PATCH` de campo derivado dá 400; `version` incrementa.
- [ ] **Passo 6: provar load-bearing.** Remover `user_id` do `where` do `PATCH`:
  o teste de posse fica vermelho. Reverter.
- [ ] **Passo 7: commit**

### Tarefa B4 — `If-Match` e versão

**Arquivos:** criar `artifacts/api-server/src/lib/if-match.ts`

- [ ] **Passo 1:** a política do roteiro, literal:
  - sem cabeçalho → **428**, `code: precondition_required`;
  - diferente de `workspace.version` → **412**, `code: precondition_failed`;
  - aceito → incrementa **na mesma transação** da escrita;
  - a resposta devolve a **nova** `version`.
- [ ] **Passo 2:** nesta fase o guarda protege `PATCH /workspaces/{slug}`;
  a Fase 6 o reusa em `PUT …/source-blocks`, que é o destrutivo de verdade.
- [ ] **Passo 3: testes** — 428 sem cabeçalho; 412 com versão velha; sucesso
  devolve versão nova; **duas requisições com a MESMA versão: a segunda dá 412**
  (é o caso real — duas abas abertas).
- [ ] **Passo 4: provar load-bearing.** Mover o incremento para fora da transação:
  um teste que dispara duas escritas concorrentes fica vermelho. Reverter.

> **Atenção do revisor da Fase 2 que se aplica aqui:** incrementar fora da
> transação reabre exatamente a janela que o `If-Match` existe para fechar.

- [ ] **Passo 5: commit**

### Tarefa B5 — CRUD de cargos

**Arquivos:** criar `artifacts/api-server/src/routes/cargos.ts`

- [ ] **Passo 1:** os três endpoints, aninhados sob o workspace, **com a posse do
  workspace verificada na cláusula** — cargo de workspace alheio é 404.
- [ ] **Passo 2:** `PATCH` com `isSelected: true` **desmarca os outros na mesma
  transação**. O índice único parcial da Fase 2 recusaria dois selecionados; o
  servidor não pode depender de tentar e falhar.
- [ ] **Passo 3:** apagar o cargo selecionado **não deixa o workspace sem
  seleção silenciosamente** — decidir explicitamente: ou promove outro, ou
  responde `409`. **Decisão: promove o de menor `position`**, porque a interface
  sempre mostra um cargo, e um workspace sem cargo selecionado não tem tela.
- [ ] **Passo 4:** apagar o **último** cargo é `409`, `code: ultimo_cargo` —
  `WorkspaceDraft.cargos` não pode ficar vazio (regressão I3 da Fase 1).
- [ ] **Passo 5: testes** — os quatro comportamentos acima, mais posse.
- [ ] **Passo 6: commit**

---

# Bloco C — Harness contra os dois lados

**É o bloco que dá sentido à Fase 4.**

### Tarefa C1 — Driver de API

**Arquivos:** criar `artifacts/kalibra/src/domain/__contract__/api-driver.ts`

- [ ] **Passo 1:** sobe o `api-server` **real** sobre PGlite, numa porta efêmera,
  reusando o harness da Fase 3 — com **sessão injetada**, nunca Clerk real.
- [ ] **Passo 2:** implementa `Driver` chamando a API por `fetch`. `recarregar()`
  aqui é **descartar cache e refazer a requisição** — a mesma pergunta que o
  driver local responde remontando o hook.
- [ ] **Passo 3:** as operações de módulos ainda não migrados lançam um erro
  declarado, `NaoMigradoNestaFase`, que a Tarefa C2 usa.
- [ ] **Passo 4:** um mundo por cenário = um usuário novo, como no local.
- [ ] **Passo 5: commit**

### Tarefa C2 — Cenários por módulo

**Arquivos:** modificar `cenarios.ts`, `runner.ts`, `estrutura.test.ts`; criar
`api.test.ts`

- [ ] **Passo 1:** `Cenario` ganha `modulos: readonly Modulo[]`.

```ts
export type Modulo = 'workspaces' | 'cargos' | 'edital' | 'syllabus' | 'concepts' | 'approvals';
export type Cenario = { nome: string; modulos: readonly Modulo[]; roda(d: Driver): Promise<void> };
```

- [ ] **Passo 2:** `rodarContrato` recebe os módulos disponíveis e **pula, com
  razão declarada**, o cenário que precisa de mais.
- [ ] **Passo 3: a guarda que impede o subconjunto de virar omissão.** Um teste
  que computa o conjunto esperado a partir de `modulos` e exige que o rodado
  contra a API seja **exatamente** ele:

```ts
it('a API roda exatamente os cenários dos módulos migrados — nem um a menos', () => {
  const migrados = new Set<Modulo>(['workspaces', 'cargos']);
  const esperados = CENARIOS.filter((c) => c.modulos.every((m) => migrados.has(m)));
  expect(esperados.length).toBeGreaterThan(0);
  expect(new Set(rodadosContraApi())).toEqual(new Set(esperados.map((c) => c.nome)));
});
```

- [ ] **Passo 4:** e a guarda contra o caminho inverso — marcar um cenário com
  módulo que ele não usa, para se livrar dele:

```ts
it('nenhum cenário declara módulo que não exercita', () => {
  // Um cenário marcado 'syllabus' sem tocar syllabus ficaria fora da API para
  // sempre, sem ninguém notar. Confere a declaração contra as operações que o
  // corpo do cenário de fato chama.
});
```

- [ ] **Passo 5: rodar** — 5 cenários contra a API, 20 contra o local, 20 contra
  o lento.
- [ ] **Passo 6: PARADA OBRIGATÓRIA E RELATO.**

> **É aqui que a Fase 4 cobra o que prometeu.** Se um dos 5 passa no local e falha
> na API, **o contrato está quebrado** — e a divergência mais provável já é
> previsível: o adaptador local **guarda** `nextAction`, `importStatus` e
> `progress` como campos; a API os **computa** (§2.8).
>
> Quando isso aparecer, **não ajustar o cenário para passar nos dois.** A pergunta
> é qual lado está certo, e a resposta já está no spec: a API. O conserto é
> endurecer o adaptador local — o mesmo movimento que a Fase 7 já prevê para
> conceitos.
>
> Trazer cada divergência com: o cenário, o que cada lado respondeu, e qual lado o
> spec sustenta.

- [ ] **Passo 7: commit**

---

# Bloco D — Frontend

### Tarefa D1 — Proxy `/api` no Vite

**Arquivos:** modificar `artifacts/kalibra/vite.config.ts`

- [ ] **Passo 1:** `server.proxy` e `preview.proxy` encaminhando `/api` para
  `process.env.API_URL ?? 'http://localhost:3000'`.
- [ ] **Passo 2:** comentário explicando **por que proxy e não CORS**: mesma
  origem faz o cookie do Clerk viajar sozinho, é o que produção terá, e não
  depende de o CORS estar certo.
- [ ] **Passo 3:** confirmar por execução — `curl` no `/api/healthz` **através do
  Vite**, não direto no servidor.
- [ ] **Passo 4: commit**

### Tarefa D2 — Adaptador de API

**Arquivos:** criar `artifacts/kalibra/src/domain/adapters/api/workspaces.ts`

- [ ] **Passo 1:** implementa `WorkspacesPort` sobre os **hooks gerados** pelo
  Orval. Nenhum `fetch` à mão, nenhum tipo copiado.
- [ ] **Passo 2:** mutações otimistas (§3.7): `onMutate` aplica e guarda o
  anterior, `onError` reverte **e dispara o toast que o app já tem**, `onSettled`
  invalida.
- [ ] **Passo 3: o teste que a Fase 1B.5 ensinou a escrever** — uma escrita que
  falha reverte **e o usuário vê**. Escrita que falha e some em silêncio é a
  família de defeito que apareceu três vezes naquela fase.
- [ ] **Passo 4:** nenhum token getter. Um teste estrutural: nenhum arquivo do
  frontend chama `setAuthTokenGetter` nem monta `Authorization`.
- [ ] **Passo 5: commit**

### Tarefa D3 — Virar a chave

**Arquivos:** modificar `artifacts/kalibra/src/domain/config.ts`

> **O risco central da fase, e o roteiro o nomeia:** um endpoint que funciona no
> teste do servidor mas cujo adaptador nenhuma tela chama — a junta morta que a
> Fase 1B produziu três vezes. **A fase só está pronta com `config.ts` virado e a
> suíte de telas passando através da API.**

- [ ] **Passo 1: medir antes de decidir.** Virar `workspaces` para `'api'` e
  rodar a suíte do frontend. Registrar **quantos** dos 341 quebram e **por quê**.
- [ ] **Passo 2:** os testes de tela que tocam workspaces sobem **um `api-server`
  sobre PGlite por arquivo**, pelo mesmo helper da Tarefa C1. Sem MSW: o
  repositório trata dependência como superfície de ataque, e a Fase 3 já provou
  que subir o servidor real custa pouco.
- [ ] **Passo 3: PARADA OBRIGATÓRIA E RELATO.** Se o custo medido no Passo 1 for
  alto — muitos arquivos, ou segundos demais por arquivo — **parar e trazer** em
  vez de empurrar. A alternativa seria migrar tela a tela em mais de uma fase, e
  isso é decisão sua, não minha.
- [ ] **Passo 4:** nenhum arquivo de teste anterior muda de **asserção**. Só o
  setup pode mudar. Uma asserção reescrita para passar pela API é a forma como se
  perde a garantia que ela dava.
- [ ] **Passo 5: commit**

---

# Bloco E — Segredo, limpeza e verificação

### Tarefa E1 — Clerk real sem vazar segredo

**Objetivo:** o app autentica de verdade, e nenhum segredo sai do servidor.

- [ ] **Passo 1: quem lê o quê.**

| Variável | Quem lê | Vai ao navegador? |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Vite, no build do frontend | **sim — é pública por definição** |
| `CLERK_SECRET_KEY` | só `api-server` | nunca |
| `DATABASE_URL` | só `api-server` | nunca |
| `ANTHROPIC_API_KEY` | só `api-server` | nunca |

- [ ] **Passo 2:** nenhuma suíte usa Clerk real. Servidor e harness continuam com
  **sessão injetada**; o Clerk real serve o app no navegador, e isso é conferido
  a olho, não por teste.
- [ ] **Passo 3: a guarda nova — varrer o BUNDLE.** Plantar valores reconhecíveis
  nos três segredos, rodar `pnpm run build`, e varrer `dist/` inteiro. Nenhum
  pode aparecer.

> A Fase 3 varre respostas de erro do servidor. **Esta varre o artefato que vai
> para o navegador** — o caminho pelo qual um segredo vaza de verdade é alguém
> prefixar com `VITE_` sem pensar, e aí o Vite o embute no bundle sem avisar
> ninguém.

- [ ] **Passo 4: provar load-bearing.** Acrescentar temporariamente
  `VITE_SEGREDO_DE_TESTE` com um dos valores plantados e usá-lo num componente:
  a varredura fica **vermelha**. Reverter.
- [ ] **Passo 5:** teste estrutural — nenhuma variável `VITE_` além da chave
  publicável e do `VITE_CLERK_PROXY_URL` é referenciada no frontend.
- [ ] **Passo 6: commit**

### Tarefa E2 — Remover `/api/me` e `/api/users/:id`

**Os critérios, decididos na Fase 3 e cobráveis aqui.** As duas rotas só saem
quando **todos** valerem:

1. `GET /workspaces/{slug}` existe e está coberto;
2. as quatro guardas que elas exercitavam têm cobertura equivalente **pelas rotas
   de domínio**:
   - 401 sem tocar o banco,
   - `userId` de `body`/`query`/`path` ignorado — nos três vetores,
   - recurso de outro usuário dá 404, não 403,
   - `problem+json` uniforme;
3. os testes de isolamento são **reescritos contra workspace**, e a marcação
   `RASO nesta fase` sai — porque deixou de ser verdade.

- [ ] **Passo 1:** conferir os três, um a um, por execução.
- [ ] **Passo 2:** mover cada teste de `require-auth.test.ts` para o alvo de
  domínio **antes** de apagar as rotas. Apagar primeiro perderia a cobertura entre
  um commit e outro.
- [ ] **Passo 3:** apagar `routes/tecnicas.ts` e `routes/tecnicas.test.ts` —
  incluindo a varredura do frontend, que perde objeto junto.
- [ ] **Passo 4:** confirmar que a contagem do `api-server` **não cai**: os testes
  mudaram de alvo, não desapareceram. Se cair, alguma cobertura se perdeu.
- [ ] **Passo 5: commit** — `refactor: rotas tecnicas saem, cobertura migra para workspaces`

### Tarefa E3 — Portão e documento

- [ ] **Passo 1:**

```bash
pnpm run typecheck && pnpm run test && pnpm run build
TZ=UTC pnpm run test
TZ=America/Sao_Paulo pnpm run test
TZ=Pacific/Kiritimati pnpm run test
pnpm --filter @workspace/api-spec run codegen   # deve dizer "sem mudanças"
```

- [ ] **Passo 2: documento** em
  `docs/superpowers/plans/2026-09-XX-kalibra-fase-5-verificacao.md`, com:
  contagem por pacote; portão nos três fusos; **a tabela de divergências
  local × API** encontradas pelo harness e como cada uma foi resolvida; as guardas
  load-bearing; os critérios de remoção das rotas técnicas conferidos um a um; e
  **o que ainda não foi verificado**.

---

## O que é testado contra PGlite e o que precisa de Postgres real

Esta é a pergunta que mais engana, então vai explícita.

**Contra PGlite — tudo desta fase:** rotas, posse, `If-Match`, unicidade de slug,
índice único parcial dos cargos, e o harness de contrato. PGlite **é** Postgres
compilado para WASM: o SQL, os tipos e as constraints são os mesmos.

**Precisa de Postgres real, e NÃO acontece nesta fase:**

| O quê | Por quê PGlite não serve |
|---|---|
| Pool sob concorrência | PGlite é monoconexão embutida; não há pool |
| Latência e timeout | não há rede |
| Reconexão após queda | não há conexão para cair |
| `pg_dump`/restore, extensões, `EXPLAIN` sob carga | ambiente, não SQL |
| A migration aplicando num banco com dado real | o de teste nasce vazio |

**Consequência prática, e a decisão que ela pede:** com `DATABASE_URL` de um
Postgres gerenciado, a única coisa que muda é que passa a existir um caminho
manual — subir o `api-server` contra ele e abrir o app — que **não é suíte
automatizada**. Nenhum teste desta fase depende disso.

**Decisão registrada:** a suíte continua em PGlite. O Postgres real entra como
**verificação manual de fumaça** ao final — criar um workspace pelo app, conferir
que a linha existe, e registrar como conferido à mão. Montar CI contra Postgres é
outra fase, e depende de decisões de deploy que estão fora de escopo.

---

# Critério de pronto

- Portão verde nos três fusos; `codegen` reporta "sem mudanças".
- Os 4 endpoints de workspace e 3 de cargo respondendo, validados pelo Zod gerado.
- `nextAction`, `selectedCargoId` e `importStatus` **computados**, nunca lidos do
  corpo da requisição.
- `If-Match`: 428 sem cabeçalho, 412 com versão velha, incremento na mesma
  transação.
- **Os 5 cenários de workspace/cargo passando contra os DOIS adaptadores**, e toda
  divergência resolvida com o lado certo corrigido — nunca o cenário afrouxado.
- A guarda que impede o subconjunto de cenários de virar omissão, provada.
- `domainConfig.workspaces = 'api'`, e a suíte de telas passando **através** da
  API. Nenhuma asserção anterior reescrita.
- Nenhum segredo no bundle, provado por varredura com valor plantado.
- `/api/me` e `/api/users/:id` removidos, com os três critérios conferidos, e a
  contagem do `api-server` **sem cair**.
- `SourceMode` em `lib/core`, `source_mode` como `pgEnum`.

# Fora do escopo

- `source-blocks`, `concepts`, `syllabus`, `approvals` — Fases 6 a 9.
- RLS, IA, deploy, CI, Docker.
- Suíte automatizada contra Postgres real.
- Qualquer mudança de design, tela ou componente.
