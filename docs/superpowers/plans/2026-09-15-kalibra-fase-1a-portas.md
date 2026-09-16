# Fase 1A — Extrair portas e tipos (plano executável)

> **Refatoração mecânica.** Nenhuma mudança de comportamento, nenhuma mudança de
> assinatura síncrona/assíncrona, nenhuma regra de domínio alterada. O diff
> inteiro deve ser legível como movimentação de código e troca de import.

**Roteiro:** `docs/superpowers/plans/2026-09-15-kalibra-fase-1c.md`
**Spec:** `docs/superpowers/specs/2026-09-14-kalibra-fase-1c-design.md` (§3)

**Linha de base:** 570 testes (231 `lib/core` + 339 `artifacts/kalibra`),
`main` em `65ec0bb`.

---

## O que a descoberta mudou em relação ao roteiro

Três achados de leitura do código, todos verificados, que o roteiro não podia
conhecer:

**1. Só `adapters/local/workspaces.ts` declara tipo de domínio.** `concepts.ts`,
`syllabus.ts` e `approvals.ts` já importam seus tipos de `@workspace/core`
(`Concept`, `Syllabus`, `SyllabusItem`, `SyllabusItemCargo`, `ApprovalItem`). A
tarefa de "mover tipos" é inteiramente de workspaces; as outras três portas são
declaração de interface, sem movimentação.

**2. Não existe porta de `source-blocks` para criar nesta fase.** Não há adaptador
local de blocos: `sourceBlocks` é campo de `WorkspaceDraft` e `CargoTextBlock` vem
de `@workspace/core`. Criar a porta agora produziria contrato sem implementação —
código sem chamador, que a decisão registrada proíbe. **Decisão: a capacidade de
gravar blocos fica na porta de workspaces**, onde o dado de fato mora, e a Fase 6
a separa no momento em que ganhar endpoint próprio e uma segunda implementação.

**3. `migrateWorkspace` tem chamador de produção fora do adaptador.**
`EditalRevisar.tsx:96` o usa para **validar um payload não confiável** da fila de
aprovação, não para migrar registro de storage. Torná-lo simplesmente interno
quebra a tela. **Decisão: a porta declara `parseWorkspaceDraft(raw: unknown):
WorkspaceDraft | null`** — mesmo corpo, nome que descreve o que a tela usa — e a
migração de registro de `localStorage` fica interna ao adaptador local.
(`NovoWorkspace.tsx` só o cita em comentário; não tem chamada.)

**Achado menor, aproveitado como limpeza:** `migrateConcepts`, `migrateSyllabus` e
`migrateApprovalItem` são reexportados pelos hooks e **não têm nenhum consumidor**.
Saem nesta fase.

---

# A. Descoberta inicial

### Tarefa A1 — Fixar a linha de base
**Objetivo:** ter o número exato contra o qual o "sem mudança de comportamento"
será verificado.
**Arquivos:** nenhum.
**Ação exata:** rodar o portão completo no `HEAD` atual e anotar as contagens por
pacote, mais o número de arquivos de teste.
**Verificação imediata:**
```bash
pnpm run typecheck && pnpm run test && pnpm run build
```
Esperado: verde, 231 em `lib/core` e 339 em `artifacts/kalibra`, sem linha
`Snapshots … written`.

### Tarefa A2 — Inventariar o que sai de `workspaces.ts`
**Objetivo:** listar exatamente os símbolos a mover, para o diff não crescer no
meio do caminho.
**Arquivos:** `artifacts/kalibra/src/domain/adapters/local/workspaces.ts`
**Ação exata:** listar os exports e classificar cada um em: **tipo de domínio**
(vai para a porta), **operação de domínio** (entra na interface da porta),
**mecânica de storage** (fica no adaptador), **staging** (vai para `staging.ts`).
**Verificação imediata:**
```bash
grep -n "^export type\|^export interface\|^export const\|^export function" \
  artifacts/kalibra/src/domain/adapters/local/workspaces.ts
```
Esperado: 5 tipos (`SourceMode`, `ImportStatus`, `Cargo`, `WorkspaceDraft`,
`PendingWorkspaceImport`) e as funções já conhecidas.

### Tarefa A3 — Inventariar os consumidores de tipo
**Objetivo:** saber quantos arquivos terão import trocado, antes de trocar.
**Arquivos:** nenhum.
**Ação exata:** listar os arquivos que importam tipo de `@/domain/use*`.
**Verificação imediata:**
```bash
grep -rn "import type.*from '@/domain/use" artifacts/kalibra/src --include=*.ts --include=*.tsx
```
Esperado: 6 arquivos importando `Cargo`; anotar a lista para conferir na seção F.

---

# B. Criação das portas

### Tarefa B1 — Criar a pasta e o barril
**Objetivo:** ter o destino das portas antes de mover qualquer coisa.
**Arquivos:** criar `artifacts/kalibra/src/domain/ports/index.ts`
**Ação exata:** criar o arquivo reexportando as quatro portas que virão. Ele nasce
vazio de conteúdo próprio; é só o ponto único de entrada.
**Verificação imediata:** `pnpm run typecheck` verde (arquivo sem conteúdo ainda
não quebra nada).

### Tarefa B2 — Porta de workspaces (só a casca)
**Objetivo:** declarar a interface com **as assinaturas de hoje**, sem mover tipo
ainda.
**Arquivos:** criar `artifacts/kalibra/src/domain/ports/workspaces.ts`
**Ação exata:** declarar a interface do que o hook expõe hoje —
`workspaces`, `addWorkspace`, `updateWorkspace` e demais métodos, **copiando as
assinaturas exatamente como estão**, inclusive síncronas. Importar os tipos
temporariamente de `adapters/local/workspaces` para o arquivo compilar; a seta é
invertida na Tarefa C1.
**Verificação imediata:** `pnpm run typecheck` verde.

### Tarefa B3 — Portas de concepts, syllabus e approvals
**Objetivo:** declarar as três interfaces restantes. Não há tipo a mover: os tipos
já vêm de `@workspace/core`.
**Arquivos:** criar `ports/concepts.ts`, `ports/syllabus.ts`, `ports/approvals.ts`
**Ação exata:** cada arquivo importa seus tipos de `@workspace/core` e declara a
interface com os métodos que o hook local expõe hoje, assinaturas idênticas.
Reexportar os tipos de domínio a partir da porta, para que os consumidores passem
a importar da porta.
**Verificação imediata:** `pnpm run typecheck` verde.

### Tarefa B4 — Ligar o barril
**Objetivo:** `ports/index.ts` passa a reexportar as quatro portas.
**Arquivos:** `artifacts/kalibra/src/domain/ports/index.ts`
**Ação exata:** reexportar tipos e interfaces das quatro portas.
**Verificação imediata:** `pnpm run typecheck` verde.

### Tarefa B5 — Commit
```bash
git add artifacts/kalibra/src/domain/ports/
git commit -m "feat: declara as portas do domínio sem mover tipo ainda"
```

---

# C. Movimentação dos tipos

### Tarefa C1 — Mover os cinco tipos de workspaces
**Objetivo:** inverter a seta: a porta passa a declarar, o adaptador a importar.
**Arquivos:** `ports/workspaces.ts`, `adapters/local/workspaces.ts`
**Ação exata:** recortar `SourceMode`, `ImportStatus`, `Cargo`, `WorkspaceDraft` e
`PendingWorkspaceImport` de `adapters/local/workspaces.ts` e colar em
`ports/workspaces.ts`, **sem alterar uma linha do corpo**. O adaptador local passa
a importar os cinco da porta. Remover o import temporário da Tarefa B2.
**Verificação imediata:**
```bash
pnpm run typecheck && pnpm --filter @workspace/kalibra test
```
Esperado: verde, 339 testes no frontend.

### Tarefa C2 — Conferir que nenhum tipo ficou para trás
**Objetivo:** provar que a movimentação foi completa.
**Arquivos:** nenhum.
**Ação exata:** varrer os adaptadores locais por declaração de tipo de domínio.
**Verificação imediata:**
```bash
grep -n "^export type\|^export interface" artifacts/kalibra/src/domain/adapters/local/*.ts
```
Esperado: só `extraction.ts` (`ExtractionSourceMode`, `ExtractionInput`), que **não
está no escopo desta fase** — extração não é um dos cinco módulos a migrar.

### Tarefa C3 — Commit
```bash
git add artifacts/kalibra/src/domain/ports/ artifacts/kalibra/src/domain/adapters/local/
git commit -m "refactor: tipos de workspace passam a morar na porta"
```

---

# D. Staging

### Tarefa D1 — Criar `staging.ts`
**Objetivo:** separar continuidade de interface, que é client-side por desenho, do
contrato de domínio.
**Arquivos:** criar `artifacts/kalibra/src/domain/staging.ts`
**Ação exata:** mover `stageWorkspaceImport`, `getPendingWorkspaceImport` e
`clearPendingWorkspaceImport` de `adapters/local/workspaces.ts` para o arquivo
novo, com os corpos intactos. Documentar no topo **por que** vivem fora da porta:
guardam uma importação em andamento entre duas telas, por aba, efêmera, nunca
compartilhada — o adaptador de API não implementa isso porque não faria sentido.
O tipo `PendingWorkspaceImport` fica na porta (é forma de domínio); as três
funções, não.
**Verificação imediata:** `pnpm run typecheck` — vai falhar nos consumidores; é
esperado e a Tarefa D2 conserta.

### Tarefa D2 — Apontar os consumidores para `staging.ts`
**Objetivo:** fechar o typecheck.
**Arquivos:** `domain/useWorkspaces.ts`, `pages/Edital.tsx`,
`pages/EditalRevisar.tsx`, `pages/NovoWorkspace.tsx`,
`pages/EditalRevisar.test.tsx`, `pages/EditalRevisar.derivacoes.test.tsx`
**Ação exata:** trocar o import das três funções para `@/domain/staging`. Remover
as três do re-export de `useWorkspaces.ts`.
**Verificação imediata:**
```bash
pnpm run typecheck && pnpm --filter @workspace/kalibra test
```
Esperado: verde, 339 testes.

### Tarefa D3 — Commit
```bash
git add artifacts/kalibra/src/domain/ artifacts/kalibra/src/pages/
git commit -m "refactor: staging da importação sai da porta para modulo proprio"
```

---

# E. `migrateWorkspace` e `parseWorkspaceDraft`

> Ver achado 3 no topo: há chamador de produção, então "tornar interno" sem mais
> nada quebraria `EditalRevisar`.

### Tarefa E1 — Declarar `parseWorkspaceDraft` na porta
**Objetivo:** dar nome de domínio ao que a tela realmente usa — validar um payload
não confiável — e deixar a obrigação explícita para o futuro adaptador de API.
**Arquivos:** `ports/workspaces.ts`, `adapters/local/workspaces.ts`
**Ação exata:** declarar na porta `parseWorkspaceDraft(raw: unknown):
WorkspaceDraft | null`. No adaptador local, exportá-la com **o corpo atual de
`migrateWorkspace`, sem alterar uma linha**. Não é reimplementação: é o mesmo
código sob o nome que descreve o uso.
**Verificação imediata:** `pnpm run typecheck` verde.

### Tarefa E2 — Tornar a migração de storage interna
**Objetivo:** o que sobrou de `migrateWorkspace` é migração de registro salvo, e
não pertence à porta.
**Arquivos:** `adapters/local/workspaces.ts`, `domain/useWorkspaces.ts`
**Ação exata:** remover `migrateWorkspace` do re-export de `useWorkspaces.ts` e
do conjunto público do adaptador — passa a ser usada só por `getWorkspaces`
dentro do próprio arquivo.
**Verificação imediata:** `pnpm run typecheck` — vai falhar em
`EditalRevisar.tsx` e `EditalRevisar.test.tsx`; esperado, a Tarefa E3 conserta.

### Tarefa E3 — Apontar `EditalRevisar` para `parseWorkspaceDraft`
**Objetivo:** fechar o typecheck sem a tela conhecer mecânica de storage.
**Arquivos:** `pages/EditalRevisar.tsx`, `pages/EditalRevisar.test.tsx`
**Ação exata:** em `workspaceDraftFromPayload`, trocar a chamada de
`migrateWorkspace` por `parseWorkspaceDraft`, importada de `@/domain/useWorkspaces`.
Atualizar o comentário acima da função, que hoje cita `migrateWorkspace` pelo
nome. No teste, trocar o import.
**Verificação imediata:**
```bash
pnpm --filter @workspace/kalibra test -- src/pages/EditalRevisar
```
Esperado: verde, mesmos testes de antes.

### Tarefa E4 — Remover os três re-exports mortos
**Objetivo:** limpeza que a descoberta encontrou: `migrateConcepts`,
`migrateSyllabus` e `migrateApprovalItem` são reexportados e não têm consumidor.
**Arquivos:** `domain/useConcepts.ts`, `domain/useSyllabus.ts`,
`domain/useApprovals.ts`
**Ação exata:** remover as três linhas de re-export. **Não** remover as funções dos
adaptadores — elas são usadas internamente.
**Verificação imediata:**
```bash
grep -rn "migrateConcepts\|migrateSyllabus\|migrateApprovalItem" artifacts/kalibra/src \
  | grep -v "adapters/local"
```
Esperado: nenhuma linha. Depois: `pnpm run typecheck` verde.

### Tarefa E5 — Commit
```bash
git add artifacts/kalibra/src/domain/ artifacts/kalibra/src/pages/
git commit -m "refactor: parseWorkspaceDraft na porta, migracao de storage interna"
```

---

# F. Atualização de imports

### Tarefa F1 — Hooks passam a reexportar da porta
**Objetivo:** o hook deixa de ser a definição do contrato e passa a ser a seleção
de implementação.
**Arquivos:** `domain/useWorkspaces.ts`, `useConcepts.ts`, `useSyllabus.ts`,
`useApprovals.ts`
**Ação exata:** em cada hook, os tipos passam a ser reexportados de
`@/domain/ports`, não do adaptador. A seleção por `domainConfig` e o `throw` de
"adaptador de API ainda não existe" ficam como estão.
**Verificação imediata:** `pnpm run typecheck` verde.

### Tarefa F2 — Consumidores de `Cargo`
**Objetivo:** os 6 arquivos da Tarefa A3 passam a importar da porta.
**Arquivos:** `components/CargoFields.tsx`, `CargoFilter.tsx`,
`CargoFilter.test.tsx`, `EditalSourceBlocks.tsx`, `SyllabusTree.tsx`,
`SyllabusTree.test.tsx`
**Ação exata:** trocar `import type { Cargo } from '@/domain/useWorkspaces'` por
`from '@/domain/ports'`. Nada mais muda nesses arquivos.
**Verificação imediata:**
```bash
grep -rn "import type.*Cargo.*from '@/domain/useWorkspaces'" artifacts/kalibra/src
```
Esperado: nenhuma linha.

### Tarefa F3 — Consumidores de `WorkspaceDraft`, `SourceMode` e `PendingWorkspaceImport`
**Objetivo:** fechar os tipos restantes.
**Arquivos:** `pages/EditalRevisar.tsx`, `pages/NovoWorkspace.tsx`,
`pages/Edital.tsx`, `domain/useExtraction.ts`
**Ação exata:** trocar os imports de tipo para `@/domain/ports`.
**Verificação imediata:**
```bash
pnpm run typecheck && pnpm --filter @workspace/kalibra test
```
Esperado: verde, 339 testes.

### Tarefa F4 — Commit
```bash
git add artifacts/kalibra/src/
git commit -m "refactor: consumidores importam tipos da porta"
```

---

# G. Testes estruturais

### Tarefa G1 — Escrever o teste da seta de dependência
**Objetivo:** fixar que a porta não conhece implementação. Sem ele, o próximo
desenvolvedor reintroduz o acoplamento sem que nada reclame.
**Arquivos:** criar `artifacts/kalibra/src/domain/ports/ports.estrutura.test.ts`
**Ação exata:** teste que lê os arquivos de `domain/ports/` e afirma que nenhum
contém import de `domain/adapters/`.
**Verificação imediata:** o teste passa.

### Tarefa G2 — Provar que o teste da seta não é decorativo
**Objetivo:** um teste estrutural que passa com a violação plantada não vale nada.
**Arquivos:** `ports/workspaces.ts` (temporariamente)
**Ação exata:** acrescentar um import qualquer de `adapters/local/workspaces` na
porta, rodar, confirmar **vermelho**, desfazer.
**Verificação imediata:** o teste fica vermelho com a violação e verde sem ela.

### Tarefa G3 — Teste de que nenhum tipo de domínio ficou no adaptador
**Objetivo:** fixar o achado 1: os adaptadores dos cinco módulos não declaram tipo.
**Arquivos:** `ports/ports.estrutura.test.ts`
**Ação exata:** teste que varre `adapters/local/{workspaces,concepts,syllabus,approvals}.ts`
e afirma que nenhum declara `export type` ou `export interface`. `extraction.ts`
fica **explicitamente fora**, com comentário dizendo por quê: não é um dos cinco
módulos migrando nesta fase.
**Verificação imediata:** passa. Depois plantar um `export type Teste = string` em
`adapters/local/workspaces.ts`, confirmar **vermelho**, desfazer.

### Tarefa G4 — Commit
```bash
git add artifacts/kalibra/src/domain/ports/
git commit -m "test: fixa a seta de dependencia e a ausencia de tipo no adaptador"
```

---

# H. Portão final

### Tarefa H1 — Portão completo
**Ação exata:**
```bash
pnpm run typecheck && pnpm run test && pnpm run build
```
Esperado: verde. `lib/core` em 231 (intocado). `artifacts/kalibra` em 339 + os
estruturais novos. **Sem linha `Snapshots … written`.**

### Tarefa H2 — Três fusos
**Ação exata:**
```bash
TZ=UTC pnpm run test
TZ=America/Sao_Paulo pnpm run test
TZ=Pacific/Kiritimati pnpm run test
```
No PowerShell: `$env:TZ='UTC'; pnpm run test`.
Esperado: resultado idêntico nos três.

### Tarefa H3 — Auditoria do diff
**Objetivo:** a prova de que a refatoração foi mecânica. Esta é a verificação que
importa; as anteriores só dizem que nada quebrou.
**Ação exata:** ler o diff inteiro da branch e confirmar, arquivo a arquivo, que
ele contém **apenas**: criação de arquivo de porta, movimentação de bloco sem
alteração de corpo, troca de import, remoção de re-export morto, e os testes
estruturais novos.
```bash
git diff main...HEAD --stat
git diff main...HEAD
```
Qualquer linha que não caiba nessas cinco categorias é defeito desta fase —
inclusive "melhorias" de passagem.

### Tarefa H4 — Conferir que nada virou assíncrono
**Objetivo:** a fronteira com a Fase 1B.
**Ação exata:** varrer as portas por `Promise`.
```bash
grep -rn "Promise" artifacts/kalibra/src/domain/ports/
```
Esperado: nenhuma linha. Assinatura assíncrona é Fase 1B.

---

# Critério de pronto

- Portão verde nos três fusos, `0 snapshots written`.
- Os **570 testes existentes passam sem alteração**. Nenhum foi removido ou
  reescrito.
- Os testes estruturais novos passam, e cada um fica **vermelho** com a violação
  correspondente plantada (Tarefas G2 e G3).
- `grep` confirma: nenhum import de `adapters/` dentro de `ports/`; nenhum tipo de
  domínio declarado nos quatro adaptadores dos módulos migrando; nenhum `Promise`
  nas portas.
- A auditoria do diff (H3) conclui que toda linha cabe em uma das cinco categorias
  mecânicas.
- `index.css` intocado; nenhum snapshot reescrito; nenhuma dependência nova.

# Fora do escopo desta fase

- **Tornar as portas assíncronas** — Fase 1B, PR seguinte.
- Porta de `source-blocks` — ver achado 2; entra na Fase 6.
- Qualquer linha de schema, servidor, OpenAPI ou adaptador de API.
- Mexer em `extraction`, `notes`, `studyState` ou `theme`: não estão entre os
  cinco módulos que migram.
- Remover ou alterar adaptadores locais além do que a movimentação exige.
