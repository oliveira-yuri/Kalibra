# Kalibra — estado e pendências (2026-09-18)

> Relatório de retomada. Escrito para que uma sessão nova continue sem depender do
> histórico da conversa. Leia este arquivo primeiro.

## Onde paramos, em uma frase

A Fase 1C (backend do domínio existente) está **especificada e planejada**; a
execução começou pela sub-fase 1A (extrair portas), com **2 de 7 lotes
concluídos**.

---

## 1. Estado do repositório

| Item | Situação |
|---|---|
| `main` | `845bedb` — Fases 0, 1A, 1B, 1B.5 e a correção de hidratação, mais toda a documentação da 1C |
| Branch atual | **`fase-1a-portas`**, 1 commit (`15bf0ef`), **não publicada** |
| Árvore de trabalho | limpa |
| Suíte | **570 testes** — 231 `lib/core` + 339 `artifacts/kalibra` |
| Portão | typecheck, test e build verdes; nenhum snapshot reescrito |

**Branches antigas já mergeadas** (limpeza opcional, nada depende delas):
`fase-0-refatoracao`, `fase-1a-core-workspace`, `fase-1b-edital-aprovacoes`,
`fase-1b5-conteudo-por-cargo`, `fase-1b5-hidratar-blocos`, `fase-1c-design`.

## 2. Documentos que governam o trabalho

Leia nesta ordem:

1. **Spec da Fase 1C** — `docs/superpowers/specs/2026-09-14-kalibra-fase-1c-design.md`
   §1 arquitetura e segredos · §2 schema · §3 API e adaptadores. §4 foi absorvido
   no roteiro.
2. **Roteiro das 10 fases** — `docs/superpowers/plans/2026-09-15-kalibra-fase-1c.md`
3. **Plano executável da Fase 1A** — `docs/superpowers/plans/2026-09-15-kalibra-fase-1a-portas.md`
   31 tarefas em 8 seções, agrupadas em 7 lotes.
4. Spec original do produto — `docs/superpowers/specs/2026-09-12-kalibra-design.md`

---

## 3. O que falta na Fase 1A (imediato)

Execução **inline em lotes**, decidida pelo Yuri: esta é refatoração fina de
imports e tipos, com risco de renomear a coisa errada — pede contexto contínuo,
não subagentes. Checkpoint no fim de cada lote.

### ✅ Lote 1 — Descoberta e baseline *(feito)*
Baseline fixada em 570. Inventário confirmado contra o código.

### ✅ Lote 2 — Porta de workspaces + mover tipos *(feito, `15bf0ef`)*
`SourceMode`, `ImportStatus`, `Cargo`, `WorkspaceDraft` e
`PendingWorkspaceImport` saíram de `adapters/local/workspaces.ts` para
`domain/ports/workspaces.ts`, por recorte e colagem. O adaptador local
**reexporta os cinco temporariamente**, para que nenhum consumidor precisasse
mudar neste lote — esse re-export sai no Lote 5.

### ⬜ Lote 3 — Interfaces das quatro portas *(próximo)*
Tarefas B3, B4, F1 do plano executável.
- Declarar a interface de `workspaces`, `concepts`, `syllabus` e `approvals` —
  os métodos que cada hook local expõe hoje, **com as assinaturas atuais**.
  Nada vira `Promise` nesta fase.
- `defaultCargo` entra na interface da porta de workspaces (ficou no adaptador
  no Lote 2 por ser função, não tipo).
- `concepts`, `syllabus` e `approvals` **não movem tipo** — os deles já vêm de
  `@workspace/core`. São só declaração de interface.
- Ligar `ports/index.ts`; hooks passam a reexportar da porta.
- **Checkpoint:** typecheck verde.

### ⬜ Lote 4 — Staging e `parseWorkspaceDraft`
Tarefas D1–D3, E1–E3, E5.
- Criar `domain/staging.ts` e mover para lá `stageWorkspaceImport`,
  `getPendingWorkspaceImport`, `clearPendingWorkspaceImport`. O **tipo**
  `PendingWorkspaceImport` fica na porta; as três funções, não.
- Declarar `parseWorkspaceDraft(raw: unknown): WorkspaceDraft | null` na porta,
  implementada com **o corpo atual de `migrateWorkspace`, sem alterar uma linha**.
  `EditalRevisar` passa a chamá-la; a migração de storage fica interna.
- **O typecheck fica vermelho entre D1→D2 e E2→E3, de propósito.** O checkpoint é
  no fim do lote.
- **Checkpoint:** suíte do frontend verde.

### ⬜ Lote 5 — Re-exports mortos e imports dos consumidores
Tarefas E4, F2–F4.
- Remover os re-exports de `migrateConcepts`, `migrateSyllabus` e
  `migrateApprovalItem` — **nenhum tem consumidor** (verificado por varredura).
- Os 6 consumidores de `Cargo` passam a importar de `@/domain/ports`.
- Remover o re-export temporário dos cinco tipos no adaptador local.
- **Checkpoint:** `grep` não acha mais import de tipo vindo de `@/domain/use*`.

### ⬜ Lote 6 — Testes estruturais
Tarefas G1–G4.
- Teste: nenhum arquivo em `domain/ports/` importa de `domain/adapters/`.
- Teste: nenhum tipo de domínio declarado nos quatro adaptadores que migram
  (`extraction.ts` fica **explicitamente fora** — não é um dos cinco módulos).
- **Cada um precisa ficar vermelho com a violação plantada.**

### ⬜ Lote 7 — Portão final e auditoria do diff
Tarefas H1–H4. **O Yuri pediu para revisar este lote junto.**
- Portão nos três fusos (`UTC`, `America/Sao_Paulo`, `Pacific/Kiritimati`).
- `grep` confirmando que nenhuma porta contém `Promise`.
- **Auditoria do diff:** ler o diff inteiro e confirmar que toda linha cabe em
  cinco categorias mecânicas — criação de porta, movimentação sem alteração de
  corpo, troca de import, remoção de re-export morto, testes estruturais novos.
  *Qualquer linha fora disso é defeito desta fase, inclusive "melhorias" de
  passagem.*

---

## 4. Armadilhas conhecidas (não redescobrir)

- **`EditalRevisar.tsx` e `NovoWorkspace.tsx` misturam valor e tipo no mesmo
  import multi-linha** de `@/domain/useWorkspaces`. São os dois arquivos de maior
  risco nos Lotes 4 e 5.
- **`@testing-library/jest-dom` NÃO existe no repositório.** Usar asserção DOM
  crua (`.textContent`, `.getAttribute()`, `.value`, `toBeTruthy()`/`toBeNull()`).
- **Chaves de `localStorage` têm sufixo de usuário**: `kalibra_workspaces:anonymous`,
  não `kalibra_workspaces`. Chave errada cai em fallback e o teste passa pelo
  motivo errado.
- **Testes de componente precisam de `afterEach(cleanup)`** — `globals: false`
  deixa o DOM sujo entre testes.
- **`screens.snapshot.test.tsx.snap` aparece como modificado após rodar a suíte**,
  mas com `git diff` vazio — é só normalização CRLF/LF. Não commitar.
- **Edição de arquivo por script Python: usar `newline=''` e casar CRLF.**
  `.replace()` com `\n` num arquivo CRLF não casa e **não avisa** — já produziu
  uma edição silenciosamente perdida neste projeto.

---

## 5. Depois da Fase 1A

### Fase 1B — Tornar as portas assíncronas
**Não é mecânica**, e é por isso que foi separada da 1A. Assinaturas viram
`Promise`, adaptador local resolve imediatamente. Entra **antes da Fase 2**.
Risco: um handler que hoje lê estado logo após escrever pode passar a ler o valor
antigo. Testes que afirmam efeito síncrono vão precisar de `await` — legítimo,
**desde que a asserção não seja enfraquecida**.

### Fases 2 a 10 (ver o roteiro para o detalhe)

| Fase | Entrega |
|---|---|
| 2 | Schema Drizzle + migrations + harness PGlite + testes de integridade |
| 3 | Fundação do `api-server`: auth Clerk, `ensureAppUser`, erro `problem+json` |
| 4 | Harness de contrato rodando contra o adaptador local |
| 5 | Módulo `workspaces` + `cargos` |
| 6 | Módulo `source-blocks` (e é aqui que a porta dele se separa) |
| 7 | Módulo `concepts` — **vai reprovar o adaptador local** por `unique(user_id, slug)`; a correção é endurecer o local |
| 8 | Módulo `syllabus` — o confirmar da revisão vira **endpoint transacional** |
| 9 | Módulo `approvals` |
| 10 | Fechamento: `openapi.jobs.yaml`, varredura, documento de verificação |

### Fases seguintes do produto
**1D** diagnóstico real com IA mínima · **1E** plano quinzenal · **1F** sessões de
estudo.

---

## 6. O que depende do Yuri

**Nada bloqueia agora.** As Fases 1A, 1B e 2 rodam inteiras sem segredo nenhum —
o banco de teste é PGlite e a sessão do Clerk é injetada nos testes.

**Quando quiser rodar o app de verdade** (por volta da Fase 3), criar um `.env`
local com `DATABASE_URL`, `CLERK_SECRET_KEY` e `VITE_CLERK_PUBLISHABLE_KEY`.
Hoje só existe `.env.example`. **Nunca colar essas variáveis no chat nem no
repositório** — regra §3.5 do spec original.

Consequência já observada: a conferência visual manual da Fase 1B.5 **não pôde
ser feita** por falta de `VITE_CLERK_PUBLISHABLE_KEY`, e foi registrada como não
feita em vez de inventada. A mesma honestidade vale para "testado contra Postgres
real" e "testado com Clerk real".

**Decisões ainda em aberto, sem urgência:**
- Deploy, VPS, Docker e CI não estão no escopo acordado da 1C e precisam de
  decisão própria — inclusive porque **não há Docker nesta máquina**, o que
  também limita verificar contra Postgres real.
- Limpar as seis branches já mergeadas no GitHub.

---

## 7. Limites conhecidos herdados (não são regressão)

Registrados nas fases anteriores, todos ainda abertos:

- `Edital.tsx` tem sua própria implementação do chip de cargo (`N cargos`,
  sempre) e não ganhou "comum a todos" nem "só \<cargo\>" — duas telas mostram a
  mesma árvore com marcações diferentes.
- Digitar antes de nomear um cargo deixa o texto como "comum" sem aviso
  (reclassificação silenciosa, não perda).
- Separar e aplicar cargo não levam os subtópicos junto.
- `dedupeEntries` é quadrático e roda síncrono na tela.
- Aprovar um `concept_merge` deixa um conceito provisório órfão, uma vez por item
  — **é o que a Fase 7 vai expor via constraint do banco**.
- Não existe campo de "prioridade" no modelo.
