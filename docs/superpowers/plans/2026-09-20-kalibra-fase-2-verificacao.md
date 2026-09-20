# Fase 2 — Verificação

**Branch:** `fase-2-schema` · **Plano:** `docs/superpowers/plans/2026-09-20-kalibra-fase-2-schema.md`
**Spec:** `docs/superpowers/specs/2026-09-14-kalibra-fase-1c-design.md` (§2)

---

## 1. Contagem final por pacote

| Pacote | Antes da fase | Depois | Delta |
|---|---|---|---|
| `lib/core` | 231 | **235** | +4 (os três arrays de enum em runtime) |
| `lib/db` | não existia na suíte | **41** | +41 (4 harness + 23 integridade + 7 forma + 7 preparatórias) |
| `artifacts/kalibra` | 341 | **341** | **0 — frontend intocado** |
| **Total** | 572 | **617** | +45 |

## 2. Portão

```
pnpm run typecheck   # 0 erros
pnpm run test        # 617
pnpm run build       # verde
```

**Três fusos, resultado idêntico:**

| `TZ` | `lib/core` | `lib/db` | frontend |
|---|---|---|---|
| `UTC` | 235 | 41 | 341 |
| `America/Sao_Paulo` | 235 | 41 | 341 |
| `Pacific/Kiritimati` | 235 | 41 | 341 |

## 3. Migrations aplicam do zero

Três migrations no journal: `0000_nebulous_zarek`, `0001_adorable_vermin`,
`0002_careful_sally_floyd`.

**Cada arquivo de teste de `lib/db` sobe uma instância PGlite nova e vazia e aplica
as três em ordem** (`createTestDb`). Não há caminho em que a suíte rode contra um
banco pré-existente: a aplicação do zero é exercitada a cada execução, não uma vez
numa verificação manual.

`drizzle-kit generate` ao final reporta `No schema changes` — a migration no disco
corresponde exatamente ao schema em TypeScript.

## 4. Constraints críticas — prova formal (Tarefa E2)

Cada constraint foi **removida mecanicamente** do schema, a migration regenerada, a
suíte executada, e o resultado registrado. Depois restaurada.

| # | Constraint | Teste que fica vermelho |
|---|---|---|
| 1 | `unique(clerk_user_id)` | recusa dois registros com o mesmo clerk_user_id |
| 2 | `unique(user_id, slug)` em workspace | o MESMO usuário não pode ter dois workspaces com o mesmo slug |
| 3 | índice único parcial (um cargo selecionado) | recusa dois cargos selecionados no MESMO workspace |
| 4 | FK composta bloco → cargo do mesmo workspace | bloco NÃO pode apontar para cargo de outro workspace |
| 5 | `unique(user_id, slug)` em concept | recusa dois conceitos com o mesmo slug para o MESMO usuário |
| 6 | FK composta concept → pai do mesmo usuário | conceito NÃO pode ter pai de outro usuário |
| 7 | FK composta item → pai do mesmo workspace | item de syllabus NÃO pode ter pai de outro workspace |
| 8 | PK tripla da ligação item-cargo | a mesma tripla item+cargo não entra duas vezes |
| 9 | FK composta ligação → cargo do mesmo workspace | ligação NÃO pode unir item do workspace A a cargo do workspace B · apagar cargo apaga suas ligações, mas NÃO o item que ainda pertence a outro cargo |
| 10 | FK composta aprovação → conceito do mesmo usuário | aprovação NÃO pode apontar para conceito de outro usuário |
| 11 | FK composta aprovação → workspace do mesmo usuário | aprovação NÃO pode apontar para workspace de outro usuário · apagar workspace apaga cargos, blocos, itens, ligações e aprovações |
| 12 | cascata `app_user → workspace` | apagar o usuário apaga seus workspaces, conceitos e aprovações |
| 13 | cascata `workspace → cargo` | apagar workspace apaga cargos, blocos, itens, ligações e aprovações |

**13 de 13 provadas.**

### O buraco que a prova encontrou

Na primeira execução, a constraint 12 (`cascata app_user → workspace`) saiu como
**"suíte verde — CONSTRAINT NÃO PROVADA"**: a cascata existia no schema e nenhum
teste a defendia. Removê-la não quebrava nada.

Constraint sem rede é constraint que alguém remove numa refatoração futura sem nada
reclamar. Foi acrescentado o teste `apagar o usuário apaga seus workspaces,
conceitos e aprovações` — que também verifica que **o outro usuário não é afetado**
— e a prova foi repetida: agora fica vermelho.

Este é o valor da E2: ela não confirma o que já se sabe, ela encontra o que ninguém
estava olhando.

### Outros dois testes provados não-vacuosos

- **Anti-deriva de enums:** plantando `valor_fantasma` no enum do banco sem
  acrescentá-lo a `lib/core`, cai só o teste de `concept_kind`.
- **Varredura de `timestamptz`:** tirando `withTimezone` de `app_user.created_at`,
  o teste acusa nomeando a coluna — `app_user.created_at: timestamp without time
  zone`.
- **Tabelas preparatórias:** plantando um arquivo em `artifacts/` que importa
  `question` de `@workspace/db`, dois testes caem e nomeiam o arquivo.

## 5. `minimumReleaseAge` intacto

```yaml
minimumReleaseAge: 1440
```

**Não foi afrouxado, e `minimumReleaseAgeExclude` não foi tocado.**

As duas dependências novas passam pela regra sem exceção:

| Pacote | Versão | Publicado | Folga sobre 24 h |
|---|---|---|---|
| `@electric-sql/pglite` | 0.5.8 | 2026-08-26 | ~3 semanas |
| `vitest` (devDep de `lib/db`) | ^3.2.7 | já no catálogo do monorepo | — |

## 6. Desvios e decisões registradas

### `source_mode` é `text`, deliberadamente — não enum

Os valores de `SourceMode` (`'file' | 'text' | 'none'`) vivem hoje em
`artifacts/kalibra/src/domain/ports/workspaces.ts`. `lib/db` **não pode importar da
aplicação** — seria inverter a dependência, uma biblioteca passando a depender de
um app.

**Isto não relaxa nenhuma constraint de posse ou integridade entre entidades.** É
escolha de fronteira entre pacotes: a coluna aceita qualquer texto, mas nada sobre
quem é dono de quê fica mais frouxo.

**Conserto certo, e quando:** promover `SourceMode` para `lib/core` e transformar a
coluna em `pgEnum`. Pertence à fase que migra o módulo de workspaces para a API,
onde o contrato precisa desses valores de qualquer forma.

Enquanto isso, `source_mode` fica **explicitamente fora** do teste anti-deriva,
com a razão escrita no próprio teste (`forma.test.ts`) e não só aqui.

### `exam_question` sem `unique(exam_id, question_id)`

Parece regra óbvia — uma questão não se repete numa prova. Mas "óbvio" é a forma
que uma regra de produto prematura tem, e remover unicidade com dados dentro é
caro. Se o diagnóstico vier a repetir uma questão em blocos, versões ou pesos
diferentes, a unicidade atrapalharia. A chave surrogate não fecha porta nenhuma.

### Tabelas preparatórias: só espinha de posse

As cinco entraram com identidade, FKs de escopo compostas e timestamps. Nada de
conteúdo: sem enum de tipo de questão, sem check de pontuação, sem unicidade
específica.

**Critério:** acrescentar coluna é migração aditiva e barata; corrigir FK de escopo
depois, com dados dentro, não é. Preparar o caro e adiar o barato.

## 7. O que NÃO foi verificado

### Nada foi testado contra um Postgres real

Toda a verificação desta fase rodou contra **PGlite** — Postgres compilado para
WASM, no mesmo processo do Vitest. Não há Docker nem `psql` nesta máquina,
confirmado.

PGlite aplica as mesmas migrations e faz valer as mesmas constraints, mas **não é
a mesma coisa** que o Postgres que vai rodar em produção: versão, extensões,
comportamento em rede, concorrência real e limites de conexão não foram
exercitados.

**Isto fica registrado como não verificado, não como verificado por aproximação.**
A verificação contra Postgres real depende de o Yuri decidir onde o banco vai
rodar e fornecer `DATABASE_URL` — decisão explicitamente adiada por ele nesta
fase.

### Nenhum endpoint, adaptador ou rota existe

Por desenho: é a Fase 3 em diante. Não há como verificar comportamento de API
nesta fase porque não há API.

### O frontend não foi exercitado contra o banco

Continua rodando inteiramente sobre adaptadores locais. Os 341 testes provam que
**nada quebrou**, não que algo novo funciona — esta fase não deveria mudar o
comportamento dele, e não mudou.

## 8. Frontend intocado — confirmação

```
git diff --stat main...HEAD -- artifacts/kalibra
```

Nenhum arquivo de `artifacts/kalibra` foi modificado nesta fase. Os 341 testes
terminam idênticos aos 341 do início, nos três fusos, com zero snapshots
reescritos.
