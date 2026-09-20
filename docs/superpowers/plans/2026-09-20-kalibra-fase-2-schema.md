# Fase 2 — Schema, migrations e harness PGlite (plano executável)

> **Primeira fase que toca banco.** Nenhum endpoint, nenhum adaptador de API,
> nenhuma rota. Ao final existe um schema migrado e testado, e nada no frontend
> mudou.

**Roteiro:** `docs/superpowers/plans/2026-09-15-kalibra-fase-1c.md` (Fase 2)
**Spec:** `docs/superpowers/specs/2026-09-14-kalibra-fase-1c-design.md` (§2)

**Linha de base:** `main` em `f5e2e7c`, 572 testes (231 `lib/core` + 341
`artifacts/kalibra`), portão verde.

---

## Descoberta feita antes de escrever este plano

Quatro verificações executadas, não supostas. Duas mudam o plano.

### 1. O Drizzle expressa TUDO — nenhum SQL bruto é necessário

Montei um schema de prova com as três construções de que o §2 depende e rodei
`drizzle-kit generate` de verdade. O SQL emitido:

```sql
-- FK composta AUTO-REFERENTE (§2.3: conceito não pode ter pai de outro usuário)
FOREIGN KEY ("user_id","parent_id") REFERENCES "public"."concept"("user_id","id")

-- Índice único PARCIAL (§2.5: no máximo um cargo selecionado por workspace)
CREATE UNIQUE INDEX "cargo_um_selecionado"
  ON "cargo" USING btree ("workspace_id") WHERE "cargo"."is_selected";

-- Unicidade composta redundante no alvo (§2.3)
CONSTRAINT "workspace_user_id" UNIQUE("user_id","id")
```

Versões: `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`. A API
(`foreignKey`, `uniqueIndex().where()`, `unique()`, `uuid().defaultRandom()`)
está disponível e produz exatamente o SQL do §2.

**Consequência para o plano:** a ressalva do roteiro — *"se o Drizzle não
expressar alguma delas, escrever SQL bruto na migration é aceitável"* — **não
precisa ser exercida**. Se durante a implementação aparecer um caso que o Drizzle
não expresse, a regra continua valendo: escreve-se SQL bruto, **nunca** se relaxa
a constraint.

### 2. Só DOIS dos cinco enums têm array em runtime — o teste anti-deriva exige três novos

`lib/core` hoje exporta:

| Símbolo | Existe? |
|---|---|
| `WORKSPACE_STATUSES` | ✅ array, derivado de `Object.keys(WORKSPACE_STATUS_LABELS)` |
| `APPROVAL_TYPES` | ✅ array literal |
| `ConceptStatus` | ❌ **só tipo** |
| `ConceptKind` | ❌ **só tipo** |
| `ApprovalStatus` | ❌ **só tipo** |

Um teste não consegue comparar um enum do Postgres com um **tipo** do TypeScript —
tipos não existem em runtime. Sem arrays, o teste anti-deriva do §2.7 cobriria
dois enums e fingiria cobrir cinco.

**Consequência:** a Fase 2 acrescenta `CONCEPT_STATUSES`, `CONCEPT_KINDS` e
`APPROVAL_STATUSES` a `lib/core`, seguindo o padrão que `WORKSPACE_STATUSES` já
estabeleceu — derivados de um `Record` completo, para que a lista nunca possa
ficar atrás do tipo. Isso é Tarefa A2 e vem **antes** do schema.

### 3. PGlite instala sem tocar na allowlist

`@electric-sql/pglite@0.5.8`, publicado em 2026-08-26 — muito além do
`minimumReleaseAge: 1440` (24 h) do `pnpm-workspace.yaml`. **Não** precisa entrar
em `minimumReleaseAgeExclude`, e essa regra de defesa de cadeia de suprimentos
não é afrouxada.

### 4. Não há Postgres real nesta máquina

Sem Docker e sem `psql`, confirmado. **Decisão do Yuri:** seguir com PGlite e
registrar como **não testado contra Postgres real** até ele decidir onde o banco
vai rodar. A mesma honestidade aplicada à conferência visual da Fase 1B.5 — o
documento diz o que não foi feito, em vez de presumir.

---

## Restrições globais desta fase

- `lib/core` continua **puro**: sem relógio, I/O, `window`, storage, `fetch`,
  `Math.random`. A Tarefa A2 acrescenta arrays constantes, nada mais.
- **Nada no frontend muda.** `artifacts/kalibra` não é tocado; seus 341 testes
  devem terminar idênticos.
- `timestamptz` **sempre**; nenhuma coluna `timestamp` sem fuso.
- Nenhuma tabela preparatória é referenciada por endpoint, adaptador ou export.
- Nenhum segredo. `DATABASE_URL` não é necessária para `generate` nem para os
  testes.
- Commits em português, `tipo: descrição`, corpo terminando com:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

---

# A. Fundação

### Tarefa A1 — Baseline e destravar o `generate`
**Objetivo:** poder gerar migration sem banco vivo.
**Arquivos:** `lib/db/drizzle.config.ts`
**Ação exata:** hoje o config **lança** quando falta `DATABASE_URL`. Gerar SQL a
partir do schema não conecta em nada. Tornar `dbCredentials` condicional: exigir a
variável só quando a operação realmente precisar conectar (`push`, `studio`).
**Verificação:**
```bash
pnpm run typecheck && pnpm run test
cd lib/db && npx drizzle-kit generate --config ./drizzle.config.ts
```
Esperado: portão verde (572); `generate` roda sem `DATABASE_URL` e informa que não
há mudança (schema ainda vazio).

### Tarefa A2 — Os três arrays de enum que faltam em `lib/core`
**Objetivo:** dar ao teste anti-deriva algo real para comparar (ver descoberta 2).
**Arquivos:** `lib/core/src/syllabus/concept.ts`, `lib/core/src/approval/approval.ts`
**Test:** `lib/core/src/syllabus/concept.test.ts`, `lib/core/src/approval/approval.test.ts`
**Ação exata:** acrescentar `CONCEPT_STATUSES`, `CONCEPT_KINDS` e
`APPROVAL_STATUSES` como `readonly` arrays, **derivados de um `Record` completo**
— o padrão de `WORKSPACE_STATUSES`, em que `Object.keys` sobre um
`Record<Tipo, …>` não pode ficar atrás do tipo. Uma lista literal mantida à mão
aceitaria um valor novo no tipo e o rejeitaria em runtime, que é o defeito que
aquele comentário já documenta.
**Testes obrigatórios:** cada array contém exatamente os valores do seu tipo —
e o teste fica **vermelho** se um valor for removido do array.
**Verificação:** `cd lib/core && npx vitest run` verde, contagem sobe.

### Tarefa A3 — Harness PGlite
**Objetivo:** um banco Postgres de verdade, em memória, que aplica as migrations e
reseta entre testes.
**Arquivos:** criar `lib/db/src/test/pglite.ts`; modificar `lib/db/package.json`
**Ação exata:** acrescentar `@electric-sql/pglite` como devDependency; escrever um
auxiliar que sobe uma instância em memória, aplica as migrations geradas, devolve
um cliente Drizzle, e oferece reset entre testes.
**Testes obrigatórios:** um teste de fumaça que cria a instância, aplica as
migrations e roda `select 1`. Sem ele, um harness quebrado só apareceria como
falha confusa nas tarefas seguintes.
**Riscos:** PGlite é WASM; a primeira instanciação é lenta. Se o custo por arquivo
de teste for alto, reusar a instância e resetar por `truncate` em vez de recriar.
**Verificação:** `cd lib/db && npx vitest run` verde.

---

# B. Schema — as oito tabelas

> Uma tabela por arquivo, como o comentário de `lib/db/src/schema/index.ts` já
> orienta. A ordem abaixo respeita as dependências.

### Tarefa B1 — `app_user`
**Arquivos:** criar `lib/db/src/schema/app-user.ts`; modificar `schema/index.ts`
**Ação exata:** `id` uuid PK, `clerk_user_id` text **unique not null**, `email` e
`name` anuláveis, `created_at`/`updated_at` **`timestamptz`**.
**Testes:** inserir dois registros com o mesmo `clerk_user_id` é rejeitado.

### Tarefa B2 — `workspace`
**Ação exata:** colunas do §2.4. `availability` em `jsonb`. `status` no enum.
**`unique(user_id, slug)`** e **`unique(user_id, id)`** (esta última é a chave
redundante que as FKs compostas de outras tabelas referenciam). `version` inteiro,
default 1 — usada pelo `If-Match` das Fases 6 e 8.
**Não existe** coluna `next_action`, `import_status` nem `progress` (§2.8).
**Testes:** dois usuários podem ter o mesmo slug; um usuário não pode ter dois.

### Tarefa B3 — `cargo`
**Ação exata:** `unique(workspace_id, id)`; FK para workspace com
`on delete cascade`; **índice único parcial** `(workspace_id) where is_selected`.
**Testes:** dois cargos selecionados no mesmo workspace é rejeitado; dois
selecionados em workspaces diferentes é aceito; apagar o workspace apaga os cargos.

### Tarefa B4 — `edital_source_block`
**Ação exata:** `cargo_id` **anulável** (null = bloco comum); **FK composta**
`(workspace_id, cargo_id) → cargo(workspace_id, id)` com `on delete cascade`.
**Testes:** bloco com cargo de OUTRO workspace é rejeitado; bloco comum
(`cargo_id` nulo) é aceito — `MATCH SIMPLE` não verifica FK com coluna nula;
apagar o cargo apaga seus blocos.

### Tarefa B5 — `concept`
**Ação exata:** **global por usuário** — sem `workspace_id`. `aliases` em
`text[]`. `unique(user_id, slug)` e `unique(user_id, id)`; **FK composta
auto-referente** `(user_id, parent_id) → concept(user_id, id)`.
**Testes:** conceito com pai de OUTRO usuário é rejeitado; conceito-raiz
(`parent_id` nulo) é aceito; dois conceitos com o mesmo slug para o mesmo usuário
é rejeitado.

### Tarefa B6 — `syllabus_item`
**Ação exata:** `unique(workspace_id, id)`; **FK composta auto-referente**
`(workspace_id, parent_item_id) → syllabus_item(workspace_id, id)`; FK para
`concept`.
**Testes:** item com pai de OUTRO workspace é rejeitado; item-raiz é aceito.

### Tarefa B7 — `syllabus_item_cargo`
**Ação exata:** carrega **`workspace_id`** (§2.4). `PK(workspace_id,
syllabus_item_id, cargo_id)`; **duas FKs compostas**, uma para `syllabus_item` e
outra para `cargo`, ambas por `workspace_id`.
**Testes:** ligar item do workspace A a cargo do workspace B é rejeitado; a mesma
tripla duas vezes é rejeitada; apagar o cargo apaga a ligação **sem** apagar o
item que ainda pertence a outro cargo.

### Tarefa B8 — `approval_item`
**Ação exata:** `payload_before`/`payload_after` em `jsonb`; **FK composta**
`(user_id, target_concept_id) → concept(user_id, id)` e **FK composta**
`(user_id, workspace_id) → workspace(user_id, id)`, ambas com coluna anulável.
**Testes:** `target_concept_id` de outro usuário é rejeitado; `workspace_id` de
outro usuário é rejeitado; ambos nulos são aceitos.

### Tarefa B9 — Cascatas e o que sobrevive
**Objetivo:** fixar a regra do §2.6, que nenhuma tabela isolada prova.
**Testes obrigatórios:**
- apagar workspace apaga cargos, blocos, itens, ligações e aprovações;
- **apagar workspace NÃO apaga conceito nenhum** — a biblioteca global sobrevive,
  porque conceitos são reutilizados entre workspaces (§4.2 do spec do produto).

---

# C. Enums e forma

### Tarefa C1 — Os cinco enums do Postgres
**Ação exata:** `pgEnum` para `workspace.status`, `concept.status`,
`concept.kind`, `approval_item.type` e `approval_item.status`. **`workspace.type`
continua texto livre** — guarda "Concurso Público", não é enumeração.

### Tarefa C2 — Teste anti-deriva
**Objetivo:** impedir que `lib/core` e o banco divirjam em silêncio. Sem isto,
alguém acrescenta um status em `lib/core`, o banco rejeita a escrita em produção,
e ninguém descobre até um usuário travar.
**Ação exata:** para cada um dos cinco enums, consultar os valores **no banco**
(`pg_enum`) e comparar com o array de `lib/core` — usando os três arrays criados
na Tarefa A2.
**Testes obrigatórios:** os cinco conjuntos batem exatamente; e o teste fica
**vermelho** quando um valor é acrescentado ao enum do banco sem estar em
`lib/core`.

### Tarefa C3 — Varredura de `timestamptz`
**Ação exata:** teste que consulta `information_schema.columns` e afirma que
**nenhuma** coluna de tempo é `timestamp without time zone`.
**Por quê:** a Fase 1A perdeu uma rodada para uma contagem regressiva que andava
um dia para trás porque `new Date('2026-06-01')` é meia-noite UTC. `timestamp` sem
fuso é a mesma armadilha com a mesma cara — e uma coluna errada só apareceria
meses depois, como dado torto.

---

# D. Tabelas preparatórias

### Tarefa D1 — As cinco, com FK estrutural e timestamps apenas
**Arquivos:** `lib/db/src/schema/prepared/{question,question-attempt,exam,exam-question,diagnostic-result}.ts`
**Ação exata:** criar as cinco com as chaves estrangeiras que já se sabem estáveis
(`app_user`, `workspace`, `cargo`, `concept`) e timestamps. **Sem constraint de
negócio** — sem enum de tipo de questão, sem check de pontuação, sem unicidade
específica: §4.5/§4.6 do spec do produto ainda pode mudar quando o diagnóstico for
desenhado de verdade (decisão registrada no §2.10).
**Testes obrigatórios:** teste estrutural afirmando que **nenhum endpoint,
adaptador ou export referencia** as cinco. É a fronteira entre "schema
preparatório é aceitável" e "código sem chamador não é" — a decisão explícita que
o Yuri registrou.
**Riscos:** a fase que as implementar provavelmente vai alterá-las. Migração
aditiva é barata; a alternativa era descobrir só lá que a espinha não comportava o
diagnóstico.

---

# E. Portão final

### Tarefa E1 — Migrations aplicam do zero
**Ação exata:** apagar o banco de teste e aplicar todas as migrations numa base
vazia, confirmando que a ordem das dependências está correta.

### Tarefa E2 — Provar que as constraints são load-bearing
**Objetivo:** a verificação que importa. Um teste de constraint que passa com a
constraint removida não vale nada.
**Ação exata:** para **cada** constraint listada nas tarefas B1–B8, removê-la
mecanicamente do schema, regenerar, rodar, e confirmar que o teste correspondente
fica **vermelho** — e só ele. Restaurar entre uma e outra. Registrar a saída de
cada uma.
**Esta tarefa não é opcional e não pode ser resumida.** É o equivalente, nesta
fase, à auditoria do diff da Fase 1A.

### Tarefa E3 — Portão completo
```bash
pnpm run typecheck && pnpm run test && pnpm run build
TZ=UTC pnpm run test
TZ=America/Sao_Paulo pnpm run test
TZ=Pacific/Kiritimati pnpm run test
```
Esperado: verde; **os 341 testes do frontend idênticos** (esta fase não o toca);
`lib/core` sobe pelos testes da Tarefa A2; `lib/db` é pacote novo na contagem.

### Tarefa E4 — Documento de verificação
**Arquivos:** criar `docs/superpowers/plans/2026-09-20-kalibra-fase-2-verificacao.md`
**Ação exata:** contagens por pacote, saída do portão, os três fusos, a tabela das
constraints com o vermelho medido de cada uma, e uma seção **"O que não foi
verificado"** declarando que **nada foi testado contra Postgres real** — só contra
PGlite — e por quê.

---

# Critério de pronto

- Portão verde nos três fusos; **os 341 testes do frontend inalterados**.
- Migrations aplicam do zero numa base vazia.
- Toda constraint de B1–B8 tem teste, e **cada teste foi provado vermelho** com a
  constraint removida (Tarefa E2).
- Os cinco enums batem com `lib/core`, e o teste anti-deriva foi provado vermelho.
- Nenhuma coluna `timestamp` sem fuso.
- Nenhuma tabela preparatória referenciada por código.
- `minimumReleaseAge` **não** foi afrouxado; `minimumReleaseAgeExclude` intocado.
- Documento de verificação escrito, com a seção do que não foi verificado.

# Fora do escopo desta fase

- Qualquer endpoint, rota ou middleware — é a Fase 3.
- Qualquer adaptador de API — é a Fase 5 em diante.
- RLS — hardening posterior (§1.6).
- Importar o `localStorage` existente — a decisão é começar limpo no servidor.
- Tocar em `artifacts/kalibra`.
- Constraints de negócio nas tabelas preparatórias.
- Deploy, VPS, Docker, CI.
