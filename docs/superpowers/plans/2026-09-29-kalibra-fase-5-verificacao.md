# Fase 5 — Verificação

**Branch:** `fase-5-plano` · **Plano:** `docs/superpowers/plans/2026-09-23-kalibra-fase-5-workspaces-cargos.md`
**Spec:** `docs/superpowers/specs/2026-09-14-kalibra-fase-1c-design.md` (§2.5, §2.8, §3.3–§3.7)

O primeiro módulo com backend de verdade. **Um critério do plano não foi
cumprido**, e o §9 diz qual e por quê.

---

## 1. Portão

```
pnpm run typecheck     # 0 erros
pnpm run build         # exit 0
pnpm run codegen:check # gerado corresponde ao YAML
pnpm run test          # 778
```

**Três fusos, resultado idêntico:**

| `TZ` | `lib/core` | `lib/db` | `api-server` | `kalibra` |
|---|---|---|---|---|
| `UTC` | 244 | 45 | 80 | 409 |
| `America/Sao_Paulo` | 244 | 45 | 80 | 409 |
| `Pacific/Kiritimati` | 244 | 45 | 80 | 409 |

## 2. Contagem por pacote

| Pacote | Antes | Depois | Delta |
|---|---|---|---|
| `lib/core` | 235 | **244** | +9 (`cargo` 4, `import-status` 5) |
| `lib/db` | 44 | **45** | +1 (`source_mode` no anti-deriva) |
| `artifacts/api-server` | 31 | **80** | +49 |
| `artifacts/kalibra` | 395 | **409** | +14 |
| **Total** | 705 | **778** | +73 |

## 3. Endpoints implementados

| Método e caminho | Notas |
|---|---|
| `GET /workspaces` | só os do usuário da sessão |
| `POST /workspaces` | status inicial decidido por `lib/core`; 409 traduzido de `unique(user_id, slug)` |
| `GET /workspaces/{slug}` | posse na cláusula; alheio responde **404, nunca 403** |
| `PATCH /workspaces/{slug}` | exige `If-Match`; 428 sem, 412 com versão velha |
| `POST /workspaces/{slug}/cargos` | id opcional; 409 se duplicado no workspace |
| `PATCH …/cargos/{cargoId}` | selecionar desmarca os outros na mesma transação |
| `DELETE …/cargos/{cargoId}` | promove o de menor `position`; 409 no último |

Os derivados — `nextAction`, `selectedCargoId`, `importStatus` — são **computados**
e recusados na escrita com 400. `progress` não existe no contrato.

## 4. O harness de contrato rodando contra os dois lados

**É o que dá sentido à Fase 4.**

| Alvo | Cenários |
|---|---|
| adaptador local | 19 |
| adaptador local, artificialmente lento | 19 |
| **adaptador de API** | **4** |

Os 4 são os que tocam só workspaces e cargos. Os outros 15 dependem de módulos
das Fases 6–9, e o mecanismo que decide isso tem duas guardas: uma exige que o
conjunto rodado contra a API seja **exatamente** o derivável dos módulos
migrados, e outra fixa a lista literal esperada — tirar um cenário exige editar
uma linha visível no diff.

## 5. Divergências encontradas — e resolvidas no lado que o spec sustenta

**Nenhum cenário foi afrouxado. `cenarios.ts` não mudou para fazer a API passar.**

### 5.1 Derivados eram tratados como escrita

O adaptador local **guardava** `nextAction`, `importStatus`, `progress` e
`selectedCargoId`; a API os **computa** e recusa recebê-los. O §2.8 sustenta a API.

Nasceu `WorkspaceEscrita` como `Omit` dos quatro. Cinco escritas de `nextAction`
saíram de `Edital.tsx` e duas de `EditalRevisar.tsx`.

**O achado mais fino foi o `selectedCargoId`.** Ele não podia virar somente-leitura
e pronto — o `Shell` precisa trocar o cargo. Virou **operação**, `selectCargo`. A
tela escrevia como se fosse dado, enquanto a API o computa de qual cargo está
marcado. Um campo derivado não se escreve; pede-se a mudança que o deriva.

### 5.2 `defaultCargo` era regra pura disfarçada de porta

Sem I/O, sessão, posse nem estado. Promovida a `lib/core` junto com o tipo
`Cargo`, **sem endpoint**. O cenário saiu do harness e a cobertura virou teste de
`lib/core`: não foi cobertura perdida, foi cobertura movida.

**O contrato ficou menor** — 19 cenários em vez de 20.

### 5.3 O id do cargo é identidade de domínio, não detalhe do banco

`syllabus_item_cargo` guarda `cargo_id`, e o módulo de syllabus só migra na Fase
8. Enquanto ele for local, as ligações que grava precisam casar com o cargo que a
API conhece — e não casariam se o servidor trocasse o id por um UUID próprio.

`cargo.id` virou `text`, a PK virou o par `(workspace_id, id)`, e `CargoCreate.id`
é opcional com formato restrito. **O mesmo id em outro workspace é permitido, e
esse é o caso normal:** `c1` é o rótulo do primeiro cargo de qualquer edital.

As duas FKs compostas já apontavam para `(workspace_id, id)` desde a Fase 2 — o
escopo certo já estava lá; faltava a PK concordar.

**A migration `0004` foi escrita à mão.** A gerada pelo `drizzle-kit` **falharia**:
ele não soube o nome da PK antiga e deixou o `DROP` comentado, e as duas FKs
dependem do `unique` que precisa cair. A ordem correta é derrubar FKs, `unique` e
PK; alterar tipos; recriar a PK composta; recriar as FKs.

### 5.4 `sourceBlocks` é leitura já consumida pelas telas

`WorkspaceDraft` os carrega e `Edital.tsx` os lê para hidratar o editor de
reimportação. A API não os devolvia, porque blocos são módulo da Fase 6 — e
através dela **o modal abriria vazio**, que é exatamente o defeito que a Fase 1B.5
fechou.

Entraram **só na leitura**, `readOnly`, fora de `Create` e `Patch`. Ordenados por
`position`. `PUT /workspaces/{slug}/source-blocks` continua sendo da Fase 6.

### 5.5 Costuras do contrato que só a execução revelou

| O quê | Por quê importa |
|---|---|
| `useDates` do Orval transforma `format: date` em `Date` | a coluna espera string; um cast faria a data **andar um dia** a oeste de Greenwich |
| `Schema.parse()` na saída **transforma** | devolveria `2027-03-01T00:00:00.000Z` em vez de `2027-03-01`, contrariando o contrato que se valida. O schema confere, não transforma |
| `weekday` é união literal em `lib/core`, `number` no Zod | estreitado com verificação real, e a validação de domínio passou a vir de `validateAvailability` |
| O hook gerado **não passa cabeçalho por chamada** | `If-Match` nunca chegava: 428 em toda escrita. Resolvido usando a **função** gerada em vez do hook |
| `examDate: ''` não é data | o armazenamento local aceitava; `format: date` não. String vazia é ausência |

## 6. Guardas load-bearing — provadas por reversão

| Reversão | Teste vermelho |
|---|---|
| `'pdf'` em `SOURCE_MODES` sem regenerar a migration | `source_mode tem exatamente os valores de lib/core` |
| edição à mão no gerado, **commitada** | `codegen:check` |
| YAML alterado sem regenerar, **commitado** | `codegen:check` |
| `selectedCargoId` virando o primeiro cargo da lista | 3 testes do DTO |
| `nextAction` virando texto fixo | `é exatamente o que lib/core diz` |
| posse fora do `where` (workspaces) | 2 testes |
| posse fora do `where` (cargos) | 2 testes |
| recusa de derivado virando silêncio | 2 testes |
| selecionar sem desmarcar os outros | `selecionar um DESMARCA os outros` |
| apagar selecionado sem promover ninguém | `apagar o SELECIONADO promove o de menor position` |
| permitir apagar o último cargo | `apagar o ÚLTIMO cargo responde 409` |
| servidor ignorando o id do cliente | 2 testes |
| sem o 409 de id duplicado | `duplicar o id DENTRO do mesmo workspace` |
| `PATCH` gravando id do corpo bruto | `o id é IMUTÁVEL depois de criado` |
| DTO sem devolver blocos | 2 testes |
| blocos sem ordenar por `position` | `ordenados por position` |
| `criarWorkspace` do driver virando no-op | cenário de durabilidade |
| `preverExtracao` passando a gravar | `prever a extração NÃO grava nada` |
| sem o aviso de reversão otimista | 2 testes |
| avisando **sempre**, inclusive no sucesso | `o aviso NÃO aparece quando a escrita dá certo` |

### 6.1 Uma reversão produziu falso verde, e a lição é de método

A prova da ordenação dos blocos ficou **verde** na primeira tentativa. Havia **duas
linhas `.sort((a, b) => a.position - b.position)` idênticas** no arquivo — a de
cargos e a de blocos — e a reversão removeu a errada.

**Reversão mecânica precisa mirar com contexto, não com a linha solta.** Sem
desconfiar e abrir o arquivo, eu teria registrado "guarda não provada" sobre uma
guarda que funciona.

## 7. Proxy e adaptador: prontos, e não ligados

**O proxy `/api` no Vite**, provado por execução:

```
direto no alvo (3000):     {"chegouEm":"/api/healthz","cookie":null}
ATRAVÉS do Vite (5199):    {"chegouEm":"/api/healthz","cookie":"__session=abc123"}
```

O cookie atravessa — era o bloqueio descoberto na descoberta da fase. Sem ele, o
frontend em `:5173` e o servidor em `:3000` são **origens diferentes**, o padrão do
`fetch` é `same-origin`, e toda requisição privada responderia 401 parecendo
defeito de autenticação.

**O adaptador de API** existe, usa os hooks gerados, faz atualização otimista e
**avisa quando reverte** — com duas guardas provadas, inclusive a que exige
silêncio no sucesso, sem a qual um adaptador que gritasse erro em toda escrita
bem-sucedida passaria.

**Mas `domainConfig.workspaces` segue `'local'`.** Ver §9.

## 8. Infraestrutura de teste contra a API real

PGlite **não roda sob jsdom**, e os testes de tela precisam de jsdom. Um
`api-server` real sobe no `globalSetup` do Vitest, que roda em Node, e os arquivos
falam HTTP com ele.

**O isolamento é o do próprio produto:** cada teste usa um usuário novo, e como a
API filtra tudo por `user_id` na cláusula `where`, um arquivo não enxerga o do
outro. Não é truque de teste — é a garantia que protege dois usuários reais,
exercitada a cada execução.

### 8.1 O diagnóstico que destravou a ponte

Uma incompatibilidade real: **o React Query passa um `AbortSignal` criado pelo
jsdom, e o `fetch` do Node o recusa.** A requisição falhava, o React Query tentava
de novo com recuo exponencial, e a consulta ficava **pendente para sempre** — a
tela nunca recebia o workspace e o teste dizia "não achei o filtro de cargo", o
sintoma mais distante possível da causa.

**Duas lições de método:**

1. **`retry` ligado atrasou o diagnóstico.** Ele não era a causa — era o que a
   escondia, transformando cada hipótese em sete segundos de espera devolvendo
   "pendente" em vez do erro. Desligá-lo como **instrumento** fez a causa aparecer
   em uma execução.
2. **A primeira correção estava errada, e parecia certa.** Usei
   `signal instanceof globalThis.AbortSignal` — mas sob jsdom aquele **é** o do
   jsdom, então a checagem sempre passava. Só o instrumento de fronteira, logando
   o construtor de cada peça, mostrou.

Depois do conserto, o teste mínimo passa em **111ms**.

---

# 9. Critério originalmente planejado e NÃO cumprido

**`domainConfig.workspaces` segue `'local'`. As telas ainda não chamam a API em
produção.**

O plano dizia: *"a fase só está pronta quando `config.ts` está virado e a suíte de
telas passa através da API"*. **Não está.** 74 testes de tela em cinco arquivos
continuam contra o adaptador local.

**O que foi medido**, com a virada aplicada e depois revertida:

| Arquivo | Testes |
|---|---|
| `EditalRevisar.test.tsx` | 38 |
| `Edital.test.tsx` | 16 |
| `screens.snapshot.test.tsx` | 16 |
| `NovoWorkspace.test.tsx` | 2 |
| `EditalRevisar.derivacoes.test.tsx` | 2 |

**Dois arquivos foram migrados inteiros e passaram** — `NovoWorkspace` (10/10) e
`EditalRevisar.derivacoes` (5/5) — e depois revertidos, porque com o `config` em
`'local'` não fazem sentido. O padrão está validado; o que falta é volume e as
camadas que ele ainda esconde.

## 9.1 O risco de junta morta foi REDUZIDO, não eliminado

O roteiro nomeia o risco: *"um endpoint que funciona no teste do servidor mas cujo
adaptador nenhuma tela chama"*.

**O que mitiga hoje:** o harness roda os 4 cenários de workspaces/cargos contra os
**dois** adaptadores. Os endpoints não estão sem verificação — estão sem *tela*.

**O que permanece:** nenhuma tela de produção exercita a API. Um defeito que só
apareça na junta entre tela e adaptador continua invisível.

## 9.2 Por que isso é fase, e não resto

A virada não é migração de setup. É a **primeira vez que o app inteiro lida com
latência**, e dela saíram — nenhuma prevista no plano:

- `AbortSignal` do jsdom incompatível com o `fetch` do Node;
- `If-Match` não suportado pelo hook gerado pelo Orval;
- `cargoId` como identidade compartilhada entre módulos;
- `sourceBlocks` como leitura necessária antes da escrita;
- `examDate: ''` incompatível com `format: date`;
- a separação `WorkspaceDraft` × `WorkspaceEscrita`;
- a latência mudando a **forma** dos testes, não só o setup.

**Recomendação: Fase 5.5 — Virada do frontend para API**, com plano próprio,
orçamento explícito de turnos e checkpoints. Escopo: virar o `config`, migrar os
cinco arquivos, tratar latência e React Query de forma sistemática, manter os
`.snap` byte a byte ou parar, e nenhuma asserção antiga reescrita.

---

# 10. O que NÃO foi verificado

- **Postgres real: não verificado.** Tudo roda em PGlite. Sem prova de pool sob
  concorrência, latência, timeout ou reconexão.
- **Clerk real: não verificado.** Sessão injetada em toda parte.
- **A comparação de versão dentro do `where` do `UPDATE` não está provada
  load-bearing.** Removê-la deixa a suíte verde, inclusive o teste de duas
  requisições concorrentes: contra PGlite — conexão única — elas serializam e a
  conferência em código chega primeiro. Fica por ser correta e gratuita; o regime
  em que importa exige Postgres real.
- **Nenhum `.snap` foi alterado**, e nenhuma asserção antiga reescrita. Os
  arquivos de teste que mudaram foram os novos, os fixtures que carregavam
  derivados, e `integridade.test.ts`, que passou a dar id explícito ao cargo.
- **`sourceBlocks` não tem escrita pela API.** Os testes de tela a semeiam por uma
  rota montada **só** pelo servidor compartilhado de teste, que a Fase 6 apaga
  quando `PUT …/source-blocks` existir.
- **Os módulos `syllabus`, `concepts` e `approvals` seguem locais**, e as costuras
  entre eles e o que migrou são a fonte das duas divergências do §5.3 e §5.4.
  Outras podem existir e ainda não apareceram.
