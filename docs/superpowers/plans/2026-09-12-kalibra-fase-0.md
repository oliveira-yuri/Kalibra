# Kalibra Fase 0 — Refatoração Mecânica Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestruturar o frontend existente do Kalibra — quebrar o `App.tsx` de 958 linhas em páginas, introduzir a camada de domínio com adaptadores locais e tornar o dark o tema padrão — sem alterar uma única linha do que o usuário vê.

**Architecture:** Refatoração puramente mecânica, protegida por uma rede de snapshots de HTML renderizado capturada **antes** do primeiro movimento. Cada extração move JSX verbatim para um arquivo novo; o snapshot precisa continuar passando sem ser atualizado. Depois das extrações, a camada `src/domain/` assume a posse do estado que hoje mora em `useState` dentro de `WorkspaceApp` e em `localStorage` espalhado, de modo que nenhuma tela toque em persistência diretamente.

**Tech Stack:** React 19.1.0, Vite 7, TypeScript 5.9, Wouter 3.3, Clerk, TanStack Query 5, Tailwind 4, pnpm workspaces. Vitest 3 + @testing-library/react + jsdom (adicionados por este plano).

**Spec:** `docs/superpowers/specs/2026-09-12-kalibra-design.md`

## Global Constraints

- **Nenhuma mudança visual.** Fase 0 não altera layout, classes, cores, espaçamento ou texto. Qualquer diferença de HTML renderizado é bug, não melhoria.
- **Nenhuma tela chama `fetch` ou `localStorage` direto** ao fim da fase. Só hooks de `src/domain/`.
- **Nenhuma cor, raio, fonte, sombra ou espaçamento fora dos tokens existentes** (`k-*` em `src/index.css`).
- **Dark é o tema padrão** ao fim da fase; o claro continua funcionando.
- **Nenhum segredo em commit, chat ou arquivo versionado.** Apenas `.env` e `.env.example` com nomes, nunca valores.
- **React e react-dom são `19.1.0` exatos** (catálogo do workspace; não alterar).
- **Zod é 3.x** (`^3.25.76` no catálogo). Usar sintaxe Zod 3.
- **Mensagens de commit em português**, formato `tipo: descrição` (`refactor:`, `feat:`, `test:`, `chore:`).
- **Portão de cada task:** `pnpm run typecheck` e `pnpm --filter @workspace/kalibra run test` passam antes do commit.
- **Números de linha são sempre do `App.tsx` original** (958 linhas, commit `c62b681`), não do arquivo no estado em que você o encontrar. Cada task remove linhas, então os números deslocam. **Localize sempre o bloco pelo nome da função** (`function Edital(`, `function Review(`); o intervalo de linhas é conferência, não endereço. Para recuperar o original a qualquer momento:
  ```bash
  git show c62b681:artifacts/kalibra/src/App.tsx > /tmp/App.original.tsx
  ```
  (após a Task 1, o caminho no commit antigo pode diferir; use `git log --follow -- '*App.tsx'` para localizar.)

---

## Estrutura de arquivos

**Criados nesta fase:**

| Arquivo | Responsabilidade |
|---|---|
| `artifacts/kalibra/vitest.config.ts` | configuração de teste do app |
| `artifacts/kalibra/src/test/setup.ts` | polyfills de jsdom (matchMedia, ResizeObserver) |
| `artifacts/kalibra/src/test/clerk-mock.ts` | mock compartilhado do Clerk para testes |
| `artifacts/kalibra/src/__tests__/screens.snapshot.test.tsx` | rede de segurança: HTML de cada rota |
| `artifacts/kalibra/src/config/nav.ts` | itens da sidebar |
| `artifacts/kalibra/src/config/clerk.tsx` | aparência e chaves do Clerk |
| `artifacts/kalibra/src/components/Shell.tsx` | shell do workspace (sidebar + header) |
| `artifacts/kalibra/src/components/Metric.tsx` | card de métrica reutilizável |
| `artifacts/kalibra/src/components/MarkdownPreview.tsx` | renderizador de Markdown |
| `artifacts/kalibra/src/components/StudyCalendar.tsx` | grade semanal `k-plan-*` |
| `artifacts/kalibra/src/pages/Dashboard.tsx` | visão geral |
| `artifacts/kalibra/src/pages/Edital.tsx` | checklist do edital |
| `artifacts/kalibra/src/pages/Estudo.tsx` | tela do tópico com 6 abas |
| `artifacts/kalibra/src/pages/estudo/Dissertativa.tsx` | aba dissertativa |
| `artifacts/kalibra/src/pages/estudo/Flashcards.tsx` | aba cards para o Anki |
| `artifacts/kalibra/src/pages/estudo/Summary.tsx` | aba resumo |
| `artifacts/kalibra/src/pages/Revisao.tsx` | recuperação escrita |
| `artifacts/kalibra/src/pages/Questoes.tsx` | prática com confiança |
| `artifacts/kalibra/src/pages/Erros.tsx` | caderno de erros |
| `artifacts/kalibra/src/pages/Recomendacoes.tsx` | ajustes + calendário |
| `artifacts/kalibra/src/pages/Notas.tsx` | notas Markdown |
| `artifacts/kalibra/src/routes/WorkspaceApp.tsx` | rotas internas do workspace |
| `artifacts/kalibra/src/routes/AppRoutes.tsx` | rotas raiz + guardas de sessão |
| `artifacts/kalibra/src/domain/config.ts` | qual adaptador cada módulo usa |
| `artifacts/kalibra/src/domain/useWorkspaces.ts` | hook de workspaces |
| `artifacts/kalibra/src/domain/useNotes.ts` | hook de notas |
| `artifacts/kalibra/src/domain/useStudyState.ts` | cards, erros, recomendações, plano |
| `artifacts/kalibra/src/domain/useTheme.ts` | tema |
| `artifacts/kalibra/src/domain/adapters/local/workspaces.ts` | ex-`store/workspaces.ts` |
| `artifacts/kalibra/src/domain/adapters/local/notes.ts` | notas em localStorage |
| `artifacts/kalibra/src/domain/adapters/local/studyState.ts` | estado de estudo em memória |
| `artifacts/kalibra/src/domain/adapters/local/theme.ts` | tema em localStorage |

**Modificados:**

| Arquivo | Mudança |
|---|---|
| `artifacts/kalibra/src/App.tsx` | de 958 linhas para ~40: providers e composição |
| `artifacts/kalibra/src/types.ts` | passa a ser a única definição de tipos |
| `artifacts/kalibra/package.json` | dependências de teste + script `test` |
| `.gitignore` (raiz) | ignora `.superpowers/` |

**Removidos:** `artifacts/kalibra/src/store/workspaces.ts` (movido para `domain/adapters/local/`).

---

### Task 1: Estabelecer a raiz do projeto

O repositório git hoje está aninhado em `frontend-replit/Kalibra-Study-Workspace (1)/Kalibra-Study-Workspace`, dentro de um caminho com espaço e parênteses que quebra scripts. O spec e os planos já vivem na raiz. Esta task promove o workspace a raiz, preservando o histórico do Replit.

> **Requer confirmação do Yuri antes de executar.** É a única task deste plano que move arquivos fora do app.

**Files:**
- Move: todo o conteúdo de `frontend-replit/Kalibra-Study-Workspace (1)/Kalibra-Study-Workspace/` para a raiz
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nada
- Produces: raiz do projeto em `C:\Users\User\Documents\Kalibra` com `.git` funcional, `package.json` do workspace e `pnpm-workspace.yaml` na raiz. Todas as tasks seguintes usam caminhos relativos a essa raiz.

- [ ] **Step 1: Confirmar que não há trabalho não commitado**

```bash
cd "frontend-replit/Kalibra-Study-Workspace (1)/Kalibra-Study-Workspace"
git status --porcelain
```

Esperado: saída vazia. Se houver algo, commitar antes de prosseguir.

- [ ] **Step 2: Mover o conteúdo para a raiz**

```bash
cd "C:/Users/User/Documents/Kalibra"
SRC="frontend-replit/Kalibra-Study-Workspace (1)/Kalibra-Study-Workspace"
# arquivos visíveis e ocultos, sem . e ..
(shopt -s dotglob nullglob; mv "$SRC"/* .)
rm -rf frontend-replit
```

- [ ] **Step 3: Verificar que o git veio junto e enxerga tudo**

```bash
cd "C:/Users/User/Documents/Kalibra"
git log --oneline | head -3
git status --porcelain | head -20
```

Esperado: os commits do Replit (`c62b681 Refactor App component logic` no topo) e nenhum arquivo do app marcado como deletado.

- [ ] **Step 4: Ignorar os artefatos de brainstorm**

Acrescentar ao fim de `.gitignore`:

```
# Superpowers
.superpowers/
```

- [ ] **Step 5: Instalar dependências e capturar o estado de referência**

```bash
pnpm install
pnpm run typecheck
pnpm run build
```

Esperado: os três comandos passam. Se `typecheck` ou `build` já falharem **antes** de qualquer alteração, parar e reportar — a Fase 0 pressupõe base verde.

- [ ] **Step 6: Commit**

```bash
git add .gitignore docs kalibra-brief-final-para-claude-code.md
git commit -m "chore: promover workspace a raiz do projeto e versionar spec e planos"
```

---

### Task 2: Rede de segurança — Vitest e snapshots das telas atuais

Esta é a task mais importante do plano. Ela captura o HTML renderizado de cada rota **antes** de qualquer movimento. Todas as extrações seguintes são validadas contra estes snapshots, que nunca devem ser atualizados durante a Fase 0.

**Files:**
- Create: `artifacts/kalibra/vitest.config.ts`
- Create: `artifacts/kalibra/src/test/setup.ts`
- Create: `artifacts/kalibra/src/test/clerk-mock.ts`
- Create: `artifacts/kalibra/src/__tests__/screens.snapshot.test.tsx`
- Modify: `artifacts/kalibra/package.json`

**Interfaces:**
- Consumes: `App` (export default de `src/App.tsx`)
- Produces: script `pnpm --filter @workspace/kalibra run test`; arquivo `src/__tests__/__snapshots__/screens.snapshot.test.tsx.snap` que serve de contrato visual para as Tasks 4–15. `renderRoute(path: string): string` exportado do próprio teste não é necessário — a função vive dentro do arquivo de teste.

- [ ] **Step 1: Instalar as dependências de teste**

```bash
cd "C:/Users/User/Documents/Kalibra"
pnpm --filter @workspace/kalibra add -D vitest@^3.2.4 jsdom@^26.1.0 @testing-library/react@^16.3.0 @testing-library/dom@^10.4.0
```

Nota: o workspace tem `minimumReleaseAge: 1440` em `pnpm-workspace.yaml`. Se o pnpm recusar alguma versão por ser recente demais, usar a versão estável imediatamente anterior — **não** desabilitar a trava.

- [ ] **Step 2: Adicionar o script de teste**

Em `artifacts/kalibra/package.json`, dentro de `"scripts"`, acrescentar:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Criar a configuração do Vitest**

`artifacts/kalibra/vitest.config.ts`:

```ts
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(import.meta.dirname, '..', '..', 'attached_assets'),
    },
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

Nota: não reutilizar `vite.config.ts`, porque ele exige `PORT` e `BASE_PATH` no ambiente e lança erro se faltarem.

- [ ] **Step 4: Criar os polyfills de jsdom**

`artifacts/kalibra/src/test/setup.ts`:

```ts
import { vi } from 'vitest';

// Radix e o hook use-mobile leem matchMedia; jsdom não implementa.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

// Radix usa ResizeObserver em popovers e scroll areas.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// Silencia o aviso de act() do React 19 em renderizações síncronas de snapshot.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.stubGlobal('scrollTo', () => {});
```

- [ ] **Step 5: Criar o mock do Clerk**

`artifacts/kalibra/src/test/clerk-mock.ts`:

```ts
import type { ReactNode } from 'react';

export const TEST_USER = { id: 'user_snapshot', firstName: 'Yuri' };

export const clerkReactMock = {
  ClerkProvider: ({ children }: { children: ReactNode }) => children,
  SignIn: () => null,
  SignUp: () => null,
  Show: ({ when, children }: { when: string; children: ReactNode }) =>
    when === 'signed-in' ? children : null,
  useClerk: () => ({ signOut: () => {} }),
  useUser: () => ({ user: TEST_USER, isLoaded: true, isSignedIn: true }),
};
```

- [ ] **Step 6: Escrever o teste de snapshot**

`artifacts/kalibra/src/__tests__/screens.snapshot.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { clerkReactMock } from '../test/clerk-mock';

vi.mock('@clerk/react', () => clerkReactMock);
vi.mock('@clerk/react/internal', () => ({
  publishableKeyFromHost: () => 'pk_test_snapshot',
}));
vi.mock('@clerk/themes', () => ({ shadcn: {} }));
vi.mock('@clerk/localizations', () => ({ ptBR: {} }));

// Data e hora reais tornariam o snapshot instável.
vi.mock('../lib/date-utils', () => ({
  getDaysRemaining: () => 'D−129',
  formatShortDate: () => '17 jan 2027',
  getCurrentDateFormatted: () => 'sexta, 12 set',
  getCurrentTimeFormatted: () => '16:20 BRT',
}));

const ROTAS = [
  '/portal',
  '/portal/novo-workspace',
  '/workspace/setec-campinas',
  '/workspace/setec-campinas/edital',
  '/workspace/setec-campinas/edital/revisar/1',
  '/workspace/setec-campinas/estudo',
  '/workspace/setec-campinas/notas',
  '/workspace/setec-campinas/revisao',
  '/workspace/setec-campinas/questoes',
  '/workspace/setec-campinas/erros',
  '/workspace/setec-campinas/recomendacoes',
  '/workspace/setec-campinas/diagnostico',
];

describe('telas do Kalibra', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    document.documentElement.className = '';
  });

  it.each(ROTAS)('renderiza %s de forma estável', async (rota) => {
    window.history.replaceState({}, '', rota);
    const { default: App } = await import('../App');
    const { container } = render(<App />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});
```

- [ ] **Step 7: Rodar e gerar os snapshots de referência**

```bash
cd "C:/Users/User/Documents/Kalibra"
pnpm --filter @workspace/kalibra run test
```

Esperado: 12 testes passam e o Vitest informa `12 snapshots written`. Abrir `artifacts/kalibra/src/__tests__/__snapshots__/screens.snapshot.test.tsx.snap` e confirmar que contém HTML real com classes `k-card`, `k-eyebrow`, `k-button`. Se algum snapshot estiver vazio ou só com `<div></div>`, o mock do Clerk não está deixando a árvore renderizar — corrigir antes de seguir.

- [ ] **Step 8: Rodar de novo para provar que é determinístico**

```bash
pnpm --filter @workspace/kalibra run test
```

Esperado: 12 passam, **0 escritos, 0 obsoletos**. Se algum snapshot mudar entre duas execuções seguidas, há fonte de não-determinismo (data, `Math.random`, `Date.now`) que precisa ser mockada antes de continuar.

- [ ] **Step 9: Commit**

```bash
git add artifacts/kalibra/vitest.config.ts artifacts/kalibra/package.json artifacts/kalibra/src/test artifacts/kalibra/src/__tests__ pnpm-lock.yaml
git commit -m "test: capturar snapshots das telas antes da refatoracao"
```

---

### Task 3: Eliminar a duplicação de tipos

`App.tsx` linhas 25–38 redefinem, palavra por palavra, os 14 tipos que já existem em `src/types.ts`. Extrair páginas sem resolver isso espalharia a duplicação por dez arquivos.

**Files:**
- Modify: `artifacts/kalibra/src/App.tsx:25-38`
- Read: `artifacts/kalibra/src/types.ts`

**Interfaces:**
- Consumes: `src/types.ts` (já exporta `TopicStatus`, `Priority`, `Difficulty`, `ErrorStatus`, `Subject`, `Topic`, `ReviewCard`, `Question`, `ErrorRecord`, `Recommendation`, `Note`, `PlanItem`, `Theme`)
- Produces: `App.tsx` sem definições locais de tipo. Todas as tasks 4–13 importam tipos de `@/types`.

- [ ] **Step 1: Confirmar que as definições são idênticas**

```bash
cd "C:/Users/User/Documents/Kalibra/artifacts/kalibra"
sed -n '25,38p' src/App.tsx | sed '/^$/d' > /tmp/a.txt
sed 's/^export //' src/types.ts | sed '/^$/d' > /tmp/b.txt
diff /tmp/a.txt /tmp/b.txt && echo "IDENTICOS"
```

Esperado: `IDENTICOS`. Se `diff` mostrar diferenças, **`types.ts` é a versão autoritativa**: anotar cada divergência, verificar se o `App.tsx` depende do formato local, e ajustar `types.ts` para cobrir o uso real antes de prosseguir. Não apagar as definições locais enquanto houver divergência não resolvida.

- [ ] **Step 2: Remover as definições locais e importar**

Apagar as linhas 25–38 de `src/App.tsx` e, no lugar, inserir:

```ts
import type {
  TopicStatus, Priority, Difficulty, ErrorStatus,
  Subject, Topic, ReviewCard, Question, ErrorRecord,
  Recommendation, Note, PlanItem, Theme,
} from './types';
```

- [ ] **Step 3: Verificar typecheck e snapshots**

```bash
cd "C:/Users/User/Documents/Kalibra"
pnpm run typecheck
pnpm --filter @workspace/kalibra run test
```

Esperado: typecheck passa. Se acusar `TopicStatus`, `IconLabel` ou `useMemo` declarados e não usados, deixar como está — a regra `noUnusedLocals` está desligada em `tsconfig.base.json`. Testes: 12 passam, **0 escritos**.

- [ ] **Step 4: Commit**

```bash
git add artifacts/kalibra/src/App.tsx
git commit -m "refactor: importar tipos de types.ts em vez de redefinir no App"
```

---

### Task 4: Extrair a navegação e o Shell

**Files:**
- Create: `artifacts/kalibra/src/config/nav.ts`
- Create: `artifacts/kalibra/src/components/Shell.tsx`
- Modify: `artifacts/kalibra/src/App.tsx` (remove linhas 48–162)

**Interfaces:**
- Consumes: `useWorkspaces` de `@/store/workspaces`, `topics` de `@/data`, `QuickPracticeRegistro`, `useToast`, `date-utils`
- Produces:
  - `src/config/nav.ts` → `export const navItems: { href: string; label: string; icon: LucideIcon }[]`
  - `src/components/Shell.tsx` → `export function Shell(props: { children: ReactNode; theme: Theme; onToggleTheme: () => void; workspaceSlug?: string }): JSX.Element`

- [ ] **Step 1: Criar o arquivo de navegação**

`artifacts/kalibra/src/config/nav.ts` recebe **verbatim** as linhas 52–62 de `App.tsx` (o array `navItems`), com este cabeçalho:

```ts
import { BookOpen, FileText, Gauge, Layers3, Lightbulb, ListChecks, NotebookPen, RotateCcw, ShieldAlert } from 'lucide-react';

export const navItems = [
  // ...linhas 53–62 de App.tsx, sem alteração
];
```

- [ ] **Step 2: Criar o Shell**

`artifacts/kalibra/src/components/Shell.tsx` recebe **verbatim** as linhas 48–50 (`IconLabel`) e 65–162 (`Shell`) de `App.tsx`. Cabeçalho do arquivo:

```tsx
import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useUser } from '@clerk/react';
import {
  Activity, ArrowLeft, CalendarDays, CheckCircle2, ChevronDown, CircleDot,
  Menu, MoreHorizontal, Moon, Search, Settings2, Sun,
} from 'lucide-react';
import { useWorkspaces } from '@/store/workspaces';
import { topics } from '@/data';
import { QuickPracticeRegistro } from '@/components/QuickPracticeRegistro';
import { useToast } from '@/hooks/use-toast';
import { getDaysRemaining, formatShortDate, getCurrentDateFormatted, getCurrentTimeFormatted } from '@/lib/date-utils';
import { navItems } from '@/config/nav';
import type { Theme } from '@/types';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
```

Depois trocar `function Shell(` por `export function Shell(` e `function IconLabel(` por `function IconLabel(` (segue privado do módulo).

- [ ] **Step 3: Remover do App.tsx e importar**

Apagar de `App.tsx` as linhas 48–50, 52–62 e 65–162. Acrescentar no topo:

```ts
import { Shell } from '@/components/Shell';
```

- [ ] **Step 4: Verificar**

```bash
cd "C:/Users/User/Documents/Kalibra"
pnpm run typecheck
pnpm --filter @workspace/kalibra run test
```

Esperado: typecheck passa; 12 testes passam com **0 snapshots escritos**. Se algum snapshot divergir, o JSX foi alterado durante a cópia — reverter e refazer com cópia literal.

- [ ] **Step 5: Commit**

```bash
git add artifacts/kalibra/src/config/nav.ts artifacts/kalibra/src/components/Shell.tsx artifacts/kalibra/src/App.tsx
git commit -m "refactor: extrair Shell e itens de navegacao do App"
```

---

### Task 5: Extrair Metric e Dashboard

**Files:**
- Create: `artifacts/kalibra/src/components/Metric.tsx`
- Create: `artifacts/kalibra/src/pages/Dashboard.tsx`
- Modify: `artifacts/kalibra/src/App.tsx` (remove linhas 164–181)

**Interfaces:**
- Consumes: `subjects`, `topics` de `@/data`; tipos `ReviewCard`, `Difficulty` de `@/types`
- Produces:
  - `export function Metric(props: { label: string; value: string; note: string; accent?: boolean }): JSX.Element`
  - `export function Dashboard(props: { cards: ReviewCard[]; onGrade: (id: string, difficulty: Difficulty) => void }): JSX.Element`

- [ ] **Step 1: Criar Metric**

`artifacts/kalibra/src/components/Metric.tsx` recebe verbatim as linhas 164–166 de `App.tsx`, com `export` antes de `function`:

```tsx
export function Metric({ label, value, note, accent = false }: { label: string; value: string; note: string; accent?: boolean }) {
  // ...linha 165 de App.tsx, sem alteração
}
```

- [ ] **Step 2: Criar Dashboard**

`artifacts/kalibra/src/pages/Dashboard.tsx` recebe verbatim as linhas 168–181 de `App.tsx`. Cabeçalho:

```tsx
import { Link } from 'wouter';
import { ArrowRight, BookOpen, Brain, Check, Play, TrendingDown, Zap } from 'lucide-react';
import { Metric } from '@/components/Metric';
import { subjects, topics } from '@/data';
import type { ReviewCard, Difficulty } from '@/types';
```

E `function Dashboard(` vira `export function Dashboard(`.

- [ ] **Step 3: Remover do App.tsx e importar**

Apagar as linhas 164–181 de `App.tsx`. Acrescentar:

```ts
import { Metric } from '@/components/Metric';
import { Dashboard } from '@/pages/Dashboard';
```

`Metric` continua importado no `App.tsx` porque a tela `Errors` (ainda lá) o usa.

- [ ] **Step 4: Verificar**

```bash
pnpm run typecheck
pnpm --filter @workspace/kalibra run test
```

Esperado: typecheck passa; 12 testes, 0 snapshots escritos.

- [ ] **Step 5: Commit**

```bash
git add artifacts/kalibra/src/components/Metric.tsx artifacts/kalibra/src/pages/Dashboard.tsx artifacts/kalibra/src/App.tsx
git commit -m "refactor: extrair Metric e Dashboard do App"
```

---

### Task 6: Extrair Edital

**Files:**
- Create: `artifacts/kalibra/src/pages/Edital.tsx`
- Modify: `artifacts/kalibra/src/App.tsx` (remove linhas 183–307)

**Interfaces:**
- Consumes: `stageWorkspaceImport` de `@/store/workspaces`; `EditalUploadProgress`; `topics`, `subjects` de `@/data`; `QuickPracticeRegistro`
- Produces: `export function Edital(props: { workspaceSlug: string }): JSX.Element`

- [ ] **Step 1: Criar o arquivo**

`artifacts/kalibra/src/pages/Edital.tsx` recebe verbatim as linhas 185–307 de `App.tsx`. Cabeçalho:

```tsx
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useUser } from '@clerk/react';
import {
  AlertCircle, ArrowRight, Check, CheckCircle2, Filter, Search,
  UploadCloud, X,
} from 'lucide-react';
import { EditalUploadProgress } from '@/components/EditalUploadProgress';
import { QuickPracticeRegistro } from '@/components/QuickPracticeRegistro';
import { stageWorkspaceImport } from '@/store/workspaces';
import { subjects, topics } from '@/data';
import { useToast } from '@/hooks/use-toast';
```

E `function Edital(` vira `export function Edital(`.

Nota: a linha 183 de `App.tsx` é um `import` de `EditalUploadProgress` no meio do arquivo; ele some junto, pois já está no cabeçalho novo.

- [ ] **Step 2: Conferir os ícones realmente usados**

```bash
cd "C:/Users/User/Documents/Kalibra/artifacts/kalibra"
grep -o '<[A-Z][A-Za-z0-9]* ' src/pages/Edital.tsx | sort -u
```

Ajustar a lista de import de `lucide-react` para conter exatamente os ícones que aparecem, nem mais nem menos.

- [ ] **Step 3: Remover do App.tsx e importar**

Apagar as linhas 183–307. Acrescentar:

```ts
import { Edital } from '@/pages/Edital';
```

- [ ] **Step 4: Verificar**

```bash
cd "C:/Users/User/Documents/Kalibra"
pnpm run typecheck
pnpm --filter @workspace/kalibra run test
```

Esperado: typecheck passa; 12 testes, 0 snapshots escritos. A rota `/workspace/setec-campinas/edital` é a que prova esta task.

- [ ] **Step 5: Commit**

```bash
git add artifacts/kalibra/src/pages/Edital.tsx artifacts/kalibra/src/App.tsx
git commit -m "refactor: extrair pagina Edital do App"
```

---

### Task 7: Extrair Estudo e suas três abas

`Study` (309), `Dissertativa` (323), `Flashcards` (398) e `Summary` (426) formam uma unidade: as três últimas só existem como abas da primeira.

**Files:**
- Create: `artifacts/kalibra/src/pages/Estudo.tsx`
- Create: `artifacts/kalibra/src/pages/estudo/Dissertativa.tsx`
- Create: `artifacts/kalibra/src/pages/estudo/Flashcards.tsx`
- Create: `artifacts/kalibra/src/pages/estudo/Summary.tsx`
- Modify: `artifacts/kalibra/src/App.tsx` (remove linhas 309–428)

**Interfaces:**
- Consumes: nada de outras tasks
- Produces:
  - `export function Estudo(): JSX.Element` (era `Study`)
  - `export function Dissertativa(): JSX.Element`
  - `export function Flashcards(): JSX.Element`
  - `export function Summary(): JSX.Element`

- [ ] **Step 1: Criar as três abas**

`src/pages/estudo/Dissertativa.tsx` recebe verbatim as linhas 323–396; cabeçalho `import { useState } from 'react';`.

`src/pages/estudo/Flashcards.tsx` recebe verbatim as linhas 398–424; cabeçalho:

```tsx
import { useState } from 'react';
import { ArrowRight, Check, CircleDot, Plus } from 'lucide-react';
```

`src/pages/estudo/Summary.tsx` recebe verbatim as linhas 426–428; sem imports.

Em cada um, prefixar `export` na declaração da função.

- [ ] **Step 2: Criar a página Estudo**

`src/pages/Estudo.tsx` recebe verbatim as linhas 309–321, com a função renomeada de `Study` para `Estudo`. Cabeçalho:

```tsx
import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Brain, Check, CheckCircle2, Play } from 'lucide-react';
import { Dissertativa } from '@/pages/estudo/Dissertativa';
import { Flashcards } from '@/pages/estudo/Flashcards';
import { Summary } from '@/pages/estudo/Summary';
```

> A renomeação `Study` → `Estudo` é o **único** identificador que muda nesta fase, para alinhar com o nome de arquivo e a rota. O JSX não muda, então o snapshot não muda.

- [ ] **Step 3: Remover do App.tsx e importar**

Apagar as linhas 309–428. Acrescentar:

```ts
import { Estudo } from '@/pages/Estudo';
```

Na tabela de rotas de `WorkspaceApp`, trocar `component={Study}` por `component={Estudo}`.

- [ ] **Step 4: Verificar**

```bash
pnpm run typecheck
pnpm --filter @workspace/kalibra run test
```

Esperado: typecheck passa; 12 testes, 0 snapshots escritos.

- [ ] **Step 5: Commit**

```bash
git add artifacts/kalibra/src/pages/Estudo.tsx artifacts/kalibra/src/pages/estudo artifacts/kalibra/src/App.tsx
git commit -m "refactor: extrair pagina Estudo e suas abas do App"
```

---

### Task 8: Extrair Revisao

**Files:**
- Create: `artifacts/kalibra/src/pages/Revisao.tsx`
- Modify: `artifacts/kalibra/src/App.tsx` (remove linhas 430–536)

**Interfaces:**
- Consumes: `MarkdownPreview` — que ainda vive no `App.tsx` neste momento. Para não criar dependência circular, esta task extrai `MarkdownPreview` junto.
- Produces:
  - `export function MarkdownPreview(props: { content: string }): JSX.Element` em `src/components/MarkdownPreview.tsx`
  - `export function Revisao(props: { cards: ReviewCard[]; onGrade: (id: string, difficulty: Difficulty) => void }): JSX.Element`

- [ ] **Step 1: Extrair MarkdownPreview primeiro**

`src/components/MarkdownPreview.tsx` recebe verbatim as linhas 647–660 de `App.tsx`, com `export` na função. Sem imports.

Remover as linhas 647–660 do `App.tsx` e acrescentar `import { MarkdownPreview } from '@/components/MarkdownPreview';`.

- [ ] **Step 2: Verificar que só isso não quebrou nada**

```bash
pnpm run typecheck
pnpm --filter @workspace/kalibra run test
```

Esperado: 12 testes, 0 snapshots escritos.

- [ ] **Step 3: Criar a página Revisao**

`src/pages/Revisao.tsx` recebe verbatim as linhas 430–536, com a função renomeada de `Review` para `Revisao`. Cabeçalho:

```tsx
import { useState } from 'react';
import { MarkdownPreview } from '@/components/MarkdownPreview';
import { initialNotes } from '@/data';
import type { ReviewCard, Difficulty } from '@/types';
```

- [ ] **Step 4: Remover do App.tsx e importar**

Apagar as linhas 430–536. Acrescentar `import { Revisao } from '@/pages/Revisao';` e, na tabela de rotas, trocar `<Review ...>` por `<Revisao ...>`.

- [ ] **Step 5: Verificar**

```bash
pnpm run typecheck
pnpm --filter @workspace/kalibra run test
```

Esperado: typecheck passa; 12 testes, 0 snapshots escritos. As rotas `/revisao` e `/notas` provam esta task.

- [ ] **Step 6: Commit**

```bash
git add artifacts/kalibra/src/components/MarkdownPreview.tsx artifacts/kalibra/src/pages/Revisao.tsx artifacts/kalibra/src/App.tsx
git commit -m "refactor: extrair MarkdownPreview e pagina Revisao do App"
```

---

### Task 9: Extrair Questoes

**Files:**
- Create: `artifacts/kalibra/src/pages/Questoes.tsx`
- Modify: `artifacts/kalibra/src/App.tsx` (remove linhas 538–587)

**Interfaces:**
- Consumes: `questions` de `@/data`; tipo `Question` de `@/types`
- Produces: `export function Questoes(props: { onRegisterError: (question: Question) => void }): JSX.Element`

- [ ] **Step 1: Criar o arquivo**

`src/pages/Questoes.tsx` recebe verbatim as linhas 538–587, com a função renomeada de `Questions` para `Questoes`. Cabeçalho:

```tsx
import { useState } from 'react';
import { AlertCircle, ArrowRight, Check, CheckCircle2, CircleAlert, Flag, RotateCcw, Timer } from 'lucide-react';
import { questions } from '@/data';
import type { Question } from '@/types';
```

- [ ] **Step 2: Remover do App.tsx e importar**

Apagar as linhas 538–587. Acrescentar `import { Questoes } from '@/pages/Questoes';` e atualizar a rota para `<Questoes onRegisterError={registerError} />`.

- [ ] **Step 3: Verificar**

```bash
pnpm run typecheck
pnpm --filter @workspace/kalibra run test
```

Esperado: typecheck passa; 12 testes, 0 snapshots escritos.

- [ ] **Step 4: Commit**

```bash
git add artifacts/kalibra/src/pages/Questoes.tsx artifacts/kalibra/src/App.tsx
git commit -m "refactor: extrair pagina Questoes do App"
```

---

### Task 10: Extrair Erros

**Files:**
- Create: `artifacts/kalibra/src/pages/Erros.tsx`
- Modify: `artifacts/kalibra/src/App.tsx` (remove linhas 589–595)

**Interfaces:**
- Consumes: `Metric` de `@/components/Metric`; tipo `ErrorRecord` de `@/types`
- Produces: `export function Erros(props: { errors: ErrorRecord[] }): JSX.Element`

- [ ] **Step 1: Criar o arquivo**

`src/pages/Erros.tsx` recebe verbatim as linhas 589–595, com a função renomeada de `Errors` para `Erros`. Cabeçalho:

```tsx
import { useState } from 'react';
import { Filter, Search } from 'lucide-react';
import { Metric } from '@/components/Metric';
import type { ErrorRecord } from '@/types';
```

- [ ] **Step 2: Remover do App.tsx e importar**

Apagar as linhas 589–595. Acrescentar `import { Erros } from '@/pages/Erros';` e atualizar a rota para `<Erros errors={errors} />`.

Neste ponto o `import { Metric }` do `App.tsx` fica sem uso — remover.

- [ ] **Step 3: Verificar**

```bash
pnpm run typecheck
pnpm --filter @workspace/kalibra run test
```

Esperado: typecheck passa; 12 testes, 0 snapshots escritos.

- [ ] **Step 4: Commit**

```bash
git add artifacts/kalibra/src/pages/Erros.tsx artifacts/kalibra/src/App.tsx
git commit -m "refactor: extrair pagina Erros do App"
```

---

### Task 11: Extrair StudyCalendar e Recomendacoes

**Files:**
- Create: `artifacts/kalibra/src/components/StudyCalendar.tsx`
- Create: `artifacts/kalibra/src/pages/Recomendacoes.tsx`
- Modify: `artifacts/kalibra/src/App.tsx` (remove linhas 597–631)

**Interfaces:**
- Consumes: tipos `PlanItem`, `Recommendation` de `@/types`
- Produces:
  - `export function StudyCalendar(props: { plan: PlanItem[] }): JSX.Element`
  - `export function Recomendacoes(props: { recommendations: Recommendation[]; plan: PlanItem[]; onApprove: (id: string) => void }): JSX.Element`

> `StudyCalendar` vira componente próprio porque a Fase 1 o move para `/plano` inteiro, junto com as classes `k-plan-*`.

- [ ] **Step 1: Criar StudyCalendar**

`src/components/StudyCalendar.tsx` recebe verbatim as linhas 597–620. Cabeçalho:

```tsx
import { CalendarDays } from 'lucide-react';
import type { PlanItem } from '@/types';
```

Prefixar `export` na função.

- [ ] **Step 2: Criar Recomendacoes**

`src/pages/Recomendacoes.tsx` recebe verbatim as linhas 622–631, com a função renomeada de `Recommendations` para `Recomendacoes`. Cabeçalho:

```tsx
import { Check, Lightbulb, ShieldAlert, Zap } from 'lucide-react';
import { StudyCalendar } from '@/components/StudyCalendar';
import type { PlanItem, Recommendation } from '@/types';
```

- [ ] **Step 3: Remover do App.tsx e importar**

Apagar as linhas 597–631. Acrescentar `import { Recomendacoes } from '@/pages/Recomendacoes';` e atualizar a rota.

- [ ] **Step 4: Verificar**

```bash
pnpm run typecheck
pnpm --filter @workspace/kalibra run test
```

Esperado: typecheck passa; 12 testes, 0 snapshots escritos.

- [ ] **Step 5: Commit**

```bash
git add artifacts/kalibra/src/components/StudyCalendar.tsx artifacts/kalibra/src/pages/Recomendacoes.tsx artifacts/kalibra/src/App.tsx
git commit -m "refactor: extrair StudyCalendar e pagina Recomendacoes do App"
```

---

### Task 12: Extrair Notas

**Files:**
- Create: `artifacts/kalibra/src/pages/Notas.tsx`
- Modify: `artifacts/kalibra/src/App.tsx` (remove linhas 662–710)

**Interfaces:**
- Consumes: `MarkdownPreview` de `@/components/MarkdownPreview` (criado na Task 8); tipo `Note` de `@/types`
- Produces: `export function Notas(props: { notes: Note[]; onCreateNote: () => string; onSaveNote: (id: string, title: string, content: string) => void }): JSX.Element`

> A função `loadNotes` (linhas 633–645) **não** vem nesta task: ela toca `localStorage` e vai para o adaptador local na Task 14.

- [ ] **Step 1: Criar o arquivo**

`src/pages/Notas.tsx` recebe verbatim as linhas 662–710, com a função renomeada de `Notes` para `Notas`. Cabeçalho:

```tsx
import { useEffect, useState } from 'react';
import { Check, NotebookPen } from 'lucide-react';
import { MarkdownPreview } from '@/components/MarkdownPreview';
import type { Note } from '@/types';
```

- [ ] **Step 2: Remover do App.tsx e importar**

Apagar as linhas 662–710. Acrescentar `import { Notas } from '@/pages/Notas';` e atualizar a rota.

- [ ] **Step 3: Verificar**

```bash
pnpm run typecheck
pnpm --filter @workspace/kalibra run test
```

Esperado: typecheck passa; 12 testes, 0 snapshots escritos.

- [ ] **Step 4: Commit**

```bash
git add artifacts/kalibra/src/pages/Notas.tsx artifacts/kalibra/src/App.tsx
git commit -m "refactor: extrair pagina Notas do App"
```

---

### Task 13: Extrair as rotas e a configuração do Clerk

Sobram no `App.tsx`: `NotFound`, `WorkspaceApp`, `WorkspaceRouter`, os três guardas de sessão, `RoutedErrorBoundary`, `stripBase`, `ClerkProviderWithRoutes` e `App`.

**Files:**
- Create: `artifacts/kalibra/src/pages/NotFound.tsx`
- Create: `artifacts/kalibra/src/config/clerk.tsx`
- Create: `artifacts/kalibra/src/routes/WorkspaceApp.tsx`
- Create: `artifacts/kalibra/src/routes/AppRoutes.tsx`
- Modify: `artifacts/kalibra/src/App.tsx` (fica com ~40 linhas)

**Interfaces:**
- Consumes: todas as páginas das tasks 5–12
- Produces:
  - `export function NotFound(): JSX.Element`
  - `export function buildClerkAppearance(theme: Theme): Record<string, unknown>` e `export const clerkPubKey: string | undefined`, `export const clerkProxyUrl: string | undefined`
  - `export function WorkspaceApp(props: { theme: Theme; onToggleTheme: () => void; slug: string }): JSX.Element`
  - `export function WorkspaceRouter(props: { theme: Theme; onToggleTheme: () => void }): JSX.Element` — é **este** que `AppRoutes` importa, não `WorkspaceApp`
  - `export function AppRoutes(props: { theme: Theme; onToggleTheme: () => void }): JSX.Element`

- [ ] **Step 1: Criar NotFound**

`src/pages/NotFound.tsx` recebe verbatim as linhas 715–717. Cabeçalho:

```tsx
import { Link } from 'wouter';
```

> Atenção: já existe `src/pages/not-found.tsx`, um arquivo diferente e não usado pelas rotas. Não sobrescrever nem consolidar agora — isso é decisão da Fase 1.

- [ ] **Step 2: Criar a configuração do Clerk**

`src/config/clerk.tsx` recebe verbatim as linhas 820–824 (`clerkPubKey`, `clerkProxyUrl`) e o objeto `clerkAppearance` que hoje é montado dentro de `ClerkProviderWithRoutes` (linhas 838–905), transformado em função:

```tsx
import { shadcn } from '@clerk/themes';
import { publishableKeyFromHost } from '@clerk/react/internal';
import type { Theme } from '@/types';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
export const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

export function buildClerkAppearance(theme: Theme) {
  return {
    // ...objeto verbatim das linhas 838–905, sem alteração de valores
  };
}
```

- [ ] **Step 3: Criar WorkspaceApp**

`src/routes/WorkspaceApp.tsx` recebe verbatim as linhas 720–774 (`WorkspaceApp` e `WorkspaceRouter`) e a função `loadNotes` das linhas 633–645, que ainda é usada por `WorkspaceApp`. Cabeçalho:

```tsx
import { useEffect, useState } from 'react';
import { Route, Router as WouterRouter, Switch, useRoute } from 'wouter';
import { Shell } from '@/components/Shell';
import { Dashboard } from '@/pages/Dashboard';
import { Edital } from '@/pages/Edital';
import { EditalRevisar } from '@/pages/EditalRevisar';
import { Estudo } from '@/pages/Estudo';
import { Notas } from '@/pages/Notas';
import { Revisao } from '@/pages/Revisao';
import { Questoes } from '@/pages/Questoes';
import { Erros } from '@/pages/Erros';
import { Recomendacoes } from '@/pages/Recomendacoes';
import { Diagnostico } from '@/pages/Diagnostico';
import { NotFound } from '@/pages/NotFound';
import { initialCards, initialErrors, initialRecommendations, initialPlan, initialNotes, today } from '@/data';
import type { Difficulty, Question, Theme } from '@/types';
```

- [ ] **Step 4: Criar AppRoutes**

`src/routes/AppRoutes.tsx` recebe verbatim as linhas 776–818 (os três guardas e `RoutedErrorBoundary`), 826–830 (`stripBase`) e 832–931 (`ClerkProviderWithRoutes`, renomeado para `AppRoutes`), usando `buildClerkAppearance(theme)` no lugar do objeto inline. Cabeçalho:

```tsx
import { type ReactNode } from 'react';
import { Redirect, Route, Switch, useLocation } from 'wouter';
import { ClerkProvider, SignIn, SignUp, Show } from '@clerk/react';
import { ptBR } from '@clerk/localizations';
import { ErrorBoundary } from '@/components/error-boundary';
import { Home } from '@/pages/Home';
import { Portal } from '@/pages/Portal';
import { NovoWorkspace } from '@/pages/NovoWorkspace';
import { NotFound } from '@/pages/NotFound';
import { WorkspaceRouter } from '@/routes/WorkspaceApp';
import { buildClerkAppearance, clerkPubKey, clerkProxyUrl } from '@/config/clerk';
import type { Theme } from '@/types';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
```

- [ ] **Step 5: Reduzir o App.tsx**

`src/App.tsx` fica exatamente assim:

```tsx
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router as WouterRouter } from 'wouter';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppRoutes } from '@/routes/AppRoutes';
import type { Theme } from '@/types';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const queryClient = new QueryClient();

function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    return window.localStorage.getItem('kalibra-theme') === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem('kalibra-theme', theme);
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <AppRoutes theme={theme} onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} />
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
```

> `RoutedErrorBoundary` passa a ser aplicado dentro de `AppRoutes`, preservando a mesma árvore. O `<Toaster />` que hoje é importado e **nunca renderizado** no `App.tsx` continua não sendo renderizado — remover o import morto, não adicionar o componente.

- [ ] **Step 6: Verificar**

```bash
cd "C:/Users/User/Documents/Kalibra"
pnpm run typecheck
pnpm --filter @workspace/kalibra run test
pnpm run build
```

Esperado: os três passam; 12 testes com **0 snapshots escritos**. Este é o momento de maior risco do plano — se algum snapshot divergir, a árvore de providers mudou de forma.

- [ ] **Step 7: Confirmar o tamanho do App.tsx**

```bash
wc -l artifacts/kalibra/src/App.tsx
```

Esperado: 40 linhas ou menos (era 958).

- [ ] **Step 8: Commit**

```bash
git add artifacts/kalibra/src/pages/NotFound.tsx artifacts/kalibra/src/config/clerk.tsx artifacts/kalibra/src/routes artifacts/kalibra/src/App.tsx
git commit -m "refactor: extrair rotas e configuracao do Clerk do App"
```

---

### Task 14: Camada de domínio com adaptadores locais

Nenhuma tela pode mais tocar `localStorage`. Hoje isso acontece em três lugares: `store/workspaces.ts` (lido por Shell, Portal, NovoWorkspace, EditalRevisar), `loadNotes` + efeito de persistência dentro de `WorkspaceApp`, e o tema dentro de `App`.

**Files:**
- Create: `artifacts/kalibra/src/domain/config.ts`
- Create: `artifacts/kalibra/src/domain/useWorkspaces.ts`
- Create: `artifacts/kalibra/src/domain/useNotes.ts`
- Create: `artifacts/kalibra/src/domain/useStudyState.ts`
- Create: `artifacts/kalibra/src/domain/useTheme.ts`
- Create: `artifacts/kalibra/src/domain/adapters/local/workspaces.ts` (conteúdo de `store/workspaces.ts`)
- Create: `artifacts/kalibra/src/domain/adapters/local/notes.ts`
- Create: `artifacts/kalibra/src/domain/adapters/local/studyState.ts`
- Create: `artifacts/kalibra/src/domain/adapters/local/theme.ts`
- Delete: `artifacts/kalibra/src/store/workspaces.ts`
- Modify: `Shell.tsx`, `Portal.tsx`, `NovoWorkspace.tsx`, `EditalRevisar.tsx`, `Edital.tsx`, `routes/WorkspaceApp.tsx`, `App.tsx`

**Interfaces:**
- Consumes: tudo das tasks anteriores
- Produces:
  - `export type ModuleSource = 'local' | 'api'`
  - `export const domainConfig: Record<'workspaces' | 'notes' | 'studyState' | 'theme', ModuleSource>`
  - `export function useWorkspaces(userId?: string): { workspaces: WorkspaceDraft[]; addWorkspace(w: WorkspaceDraft): void; updateWorkspace(slug: string, updates: Partial<WorkspaceDraft>): void }`
  - `export function useNotes(): { notes: Note[]; createNote(): string; saveNote(id: string, title: string, content: string): void }`
  - `export function useStudyState(): { cards: ReviewCard[]; errors: ErrorRecord[]; recommendations: Recommendation[]; plan: PlanItem[]; gradeCard(id: string, difficulty: Difficulty): void; registerError(q: Question): void; approveRecommendation(id: string): void }`
  - `export function useTheme(): { theme: Theme; toggleTheme(): void }`
  - Re-exports de `WorkspaceDraft`, `Cargo`, `SourceMode`, `ImportStatus`, `PendingWorkspaceImport`, `stageWorkspaceImport`, `getPendingWorkspaceImport`, `clearPendingWorkspaceImport` a partir de `@/domain/useWorkspaces`

- [ ] **Step 1: Mover o store de workspaces sem alterá-lo**

```bash
cd "C:/Users/User/Documents/Kalibra/artifacts/kalibra"
mkdir -p src/domain/adapters/local
git mv src/store/workspaces.ts src/domain/adapters/local/workspaces.ts
rmdir src/store 2>/dev/null || true
```

O conteúdo do arquivo **não muda**.

- [ ] **Step 2: Criar o arquivo de configuração**

`src/domain/config.ts`:

```ts
export type ModuleSource = 'local' | 'api';

/**
 * Qual adaptador cada módulo do domínio usa.
 * Fase 1 mantém tudo em 'local'. Fase 3 vira módulo a módulo para 'api'.
 */
export const domainConfig = {
  workspaces: 'local',
  notes: 'local',
  studyState: 'local',
  theme: 'local',
} satisfies Record<string, ModuleSource>;
```

- [ ] **Step 3: Criar o hook de workspaces**

`src/domain/useWorkspaces.ts`:

```ts
import * as local from './adapters/local/workspaces';
import { domainConfig } from './config';

export type {
  WorkspaceDraft, Cargo, SourceMode, ImportStatus, PendingWorkspaceImport,
} from './adapters/local/workspaces';

if (domainConfig.workspaces !== 'local') {
  throw new Error('Adaptador de API de workspaces ainda não existe (Fase 3).');
}

export const useWorkspaces = local.useWorkspaces;
export const stageWorkspaceImport = local.stageWorkspaceImport;
export const getPendingWorkspaceImport = local.getPendingWorkspaceImport;
export const clearPendingWorkspaceImport = local.clearPendingWorkspaceImport;
```

- [ ] **Step 4: Apontar as telas para o domínio**

Em `src/components/Shell.tsx`, `src/pages/Portal.tsx`, `src/pages/NovoWorkspace.tsx`, `src/pages/EditalRevisar.tsx` e `src/pages/Edital.tsx`, trocar toda importação de `@/store/workspaces` (ou `./store/workspaces`, ou `../store/workspaces`) por `@/domain/useWorkspaces`.

```bash
cd "C:/Users/User/Documents/Kalibra/artifacts/kalibra"
grep -rn "store/workspaces" src/ || echo "nenhuma referencia restante"
```

Esperado ao fim: `nenhuma referencia restante`.

- [ ] **Step 5: Verificar**

```bash
cd "C:/Users/User/Documents/Kalibra"
pnpm run typecheck
pnpm --filter @workspace/kalibra run test
```

Esperado: typecheck passa; 12 testes, 0 snapshots escritos.

- [ ] **Step 6: Commit parcial**

```bash
git add artifacts/kalibra/src/domain artifacts/kalibra/src/components/Shell.tsx artifacts/kalibra/src/pages artifacts/kalibra/src/routes
git commit -m "refactor: mover store de workspaces para a camada de dominio"
```

- [ ] **Step 7: Criar o adaptador local de notas**

`src/domain/adapters/local/notes.ts`:

```ts
import { useEffect, useState } from 'react';
import { initialNotes } from '@/data';
import type { Note } from '@/types';

const STORAGE_KEY = 'kalibra-notes';

function loadNotes(): Note[] {
  if (typeof window === 'undefined') return initialNotes;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed as Note[];
    }
  } catch {
    return initialNotes;
  }
  return initialNotes;
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  const createNote = () => {
    const id = `n${Date.now()}`;
    setNotes((current) => [{ id, title: 'Nova nota', subject: 'Rascunho', updatedAt: 'agora', content: '# Nova nota\n\n' }, ...current]);
    return id;
  };

  const saveNote = (id: string, title: string, content: string) =>
    setNotes((current) => current.map((note) => note.id === id ? { ...note, title, content, updatedAt: 'agora' } : note));

  return { notes, createNote, saveNote };
}
```

> Isto é exatamente `loadNotes` (linhas 633–645) mais os três trechos de `WorkspaceApp` que hoje cuidam de notas, sem mudança de comportamento.

- [ ] **Step 8: Criar o adaptador local de estado de estudo**

`src/domain/adapters/local/studyState.ts`:

```ts
import { useState } from 'react';
import { initialCards, initialErrors, initialRecommendations, initialPlan, today } from '@/data';
import type { Difficulty, ErrorRecord, PlanItem, Question, Recommendation, ReviewCard } from '@/types';

export function useStudyState() {
  const [cards, setCards] = useState<ReviewCard[]>(initialCards);
  const [errors, setErrors] = useState<ErrorRecord[]>(initialErrors);
  const [recommendations, setRecommendations] = useState<Recommendation[]>(initialRecommendations);
  const [plan, setPlan] = useState<PlanItem[]>(initialPlan);

  const gradeCard = (id: string, difficulty: Difficulty) =>
    setCards((current) => current.map((card) => card.id === id
      ? { ...card, difficulty, due: difficulty === 'errei' ? 'Hoje' : difficulty === 'difícil' ? 'Amanhã' : difficulty === 'bom' ? '20 dez' : '24 dez' }
      : card));

  const registerError = (question: Question) =>
    setErrors((current) => current.some((error) => error.topic === question.topic && error.date === today)
      ? current
      : [{ id: `e${current.length + 1}`, classification: 'falha de procedimento', subject: question.subject, topic: question.topic, date: today, status: 'aberto', severity: 'alta' }, ...current]);

  const approveRecommendation = (id: string) => {
    setRecommendations((current) => current.map((r) => r.id === id ? { ...r, approved: true } : r));
    if (id === 'rec1') {
      setPlan((current) => current.some((item) => item.id === 'p8')
        ? current
        : [...current, { id: 'p8', weekday: 'quinta-feira', date: '18 dez', label: 'Bloco extra · porcentagem e juros', subject: 'Matemática', duration: '40 min', kind: 'prática', tone: 'focus' }]);
    }
    if (id === 'rec2') {
      setPlan((current) => current.map((item) => item.id === 'p2'
        ? { ...item, weekday: 'quarta-feira', date: '17 dez', label: 'Revisão antecipada · Lei de Acesso à Informação' }
        : item));
    }
  };

  return { cards, errors, recommendations, plan, gradeCard, registerError, approveRecommendation };
}
```

> Cópia literal da lógica das linhas 721–746 de `WorkspaceApp`, sem alteração de comportamento.

- [ ] **Step 9: Criar os hooks de domínio correspondentes**

`src/domain/useNotes.ts`:

```ts
import { useNotes as localUseNotes } from './adapters/local/notes';
import { domainConfig } from './config';

if (domainConfig.notes !== 'local') {
  throw new Error('Adaptador de API de notas ainda não existe (Fase 3).');
}

export const useNotes = localUseNotes;
```

`src/domain/useStudyState.ts`:

```ts
import { useStudyState as localUseStudyState } from './adapters/local/studyState';
import { domainConfig } from './config';

if (domainConfig.studyState !== 'local') {
  throw new Error('Adaptador de API de estado de estudo ainda não existe (Fase 3).');
}

export const useStudyState = localUseStudyState;
```

- [ ] **Step 10: Consumir os hooks em WorkspaceApp**

Em `src/routes/WorkspaceApp.tsx`, substituir todo o corpo de estado da função `WorkspaceApp` (os cinco `useState`, o `useEffect` de notas, `loadNotes`, `gradeCard`, `registerError`, `createNote`, `saveNote`, `approveRecommendation`) por:

```tsx
const { cards, errors, recommendations, plan, gradeCard, registerError, approveRecommendation } = useStudyState();
const { notes, createNote, saveNote } = useNotes();
```

E os imports:

```tsx
import { useStudyState } from '@/domain/useStudyState';
import { useNotes } from '@/domain/useNotes';
```

Remover de `WorkspaceApp.tsx` os imports que ficaram sem uso: `useEffect`, `useState`, `initialCards`, `initialErrors`, `initialRecommendations`, `initialPlan`, `initialNotes`, `today`, e os tipos `Difficulty` e `Question`.

- [ ] **Step 11: Verificar**

```bash
cd "C:/Users/User/Documents/Kalibra"
pnpm run typecheck
pnpm --filter @workspace/kalibra run test
```

Esperado: typecheck passa; 12 testes, 0 snapshots escritos.

- [ ] **Step 12: Provar que nenhuma tela toca persistência**

```bash
cd "C:/Users/User/Documents/Kalibra/artifacts/kalibra"
grep -rn "localStorage\|sessionStorage\|fetch(" src/pages src/components --include=*.tsx | grep -v "src/components/ui/"
```

Esperado: **nenhuma linha**. Se aparecer alguma, ela precisa migrar para um adaptador antes do commit.

- [ ] **Step 13: Commit**

```bash
git add artifacts/kalibra/src/domain artifacts/kalibra/src/routes/WorkspaceApp.tsx
git commit -m "refactor: mover notas e estado de estudo para a camada de dominio"
```

---

### Task 15: Dark como tema padrão

**Files:**
- Create: `artifacts/kalibra/src/domain/adapters/local/theme.ts`
- Create: `artifacts/kalibra/src/domain/useTheme.ts`
- Modify: `artifacts/kalibra/src/App.tsx`
- Modify: `artifacts/kalibra/src/__tests__/screens.snapshot.test.tsx`

**Interfaces:**
- Consumes: `domainConfig` de `@/domain/config`
- Produces: `export function useTheme(): { theme: Theme; toggleTheme(): void }`

> Esta é a **única** task da Fase 0 que muda comportamento visível, e por isso é a última. O snapshot precisa ser explicitamente ampliado, não silenciosamente atualizado.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `src/__tests__/screens.snapshot.test.tsx`:

```tsx
describe('tema padrão', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    document.documentElement.className = '';
  });

  it('abre em dark quando não há preferência salva', async () => {
    window.history.replaceState({}, '', '/portal');
    const { default: App } = await import('../App');
    render(<App />);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('respeita a preferência salva pelo usuário', async () => {
    window.localStorage.setItem('kalibra-theme', 'light');
    window.history.replaceState({}, '', '/portal');
    const { default: App } = await import('../App');
    render(<App />);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
cd "C:/Users/User/Documents/Kalibra"
pnpm --filter @workspace/kalibra run test
```

Esperado: `abre em dark quando não há preferência salva` **FALHA** com `expected false to be true`. O segundo teste passa.

- [ ] **Step 3: Criar o adaptador de tema**

`src/domain/adapters/local/theme.ts`:

```ts
import { useEffect, useState } from 'react';
import type { Theme } from '@/types';

const STORAGE_KEY = 'kalibra-theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = window.localStorage.getItem(STORAGE_KEY);
    // Dark é o padrão do Kalibra; só o valor explícito 'light' muda isso.
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark');

  return { theme, toggleTheme };
}
```

- [ ] **Step 4: Criar o hook de domínio**

`src/domain/useTheme.ts`:

```ts
import { useTheme as localUseTheme } from './adapters/local/theme';
import { domainConfig } from './config';

if (domainConfig.theme !== 'local') {
  throw new Error('Adaptador de API de tema ainda não existe (Fase 3).');
}

export const useTheme = localUseTheme;
```

- [ ] **Step 5: Consumir no App.tsx**

`src/App.tsx` fica:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router as WouterRouter } from 'wouter';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppRoutes } from '@/routes/AppRoutes';
import { useTheme } from '@/domain/useTheme';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const queryClient = new QueryClient();

function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <AppRoutes theme={theme} onToggleTheme={toggleTheme} />
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
```

- [ ] **Step 6: Rodar os testes**

```bash
pnpm --filter @workspace/kalibra run test
```

Esperado: os dois testes de tema **passam**.

Os 12 snapshots de tela vão acusar diferença, porque `Portal`, `NovoWorkspace` e `Home` recebem `theme` como prop e trocam classes conforme ele. **Essa mudança é esperada e desejada.** Conferir o diff antes de aceitar: as únicas diferenças devem ser trocas de classe entre os pares claro/escuro já existentes (`bg-[#f6f8f7]` → `bg-[#10131a]`, `border-[#d5dede]` → `border-[#242a34]`, `text-[#16232b]` → `text-[#f0f0e8]`). Se aparecer qualquer classe nova ou remoção de elemento, é bug.

- [ ] **Step 7: Atualizar os snapshots deliberadamente**

```bash
pnpm --filter @workspace/kalibra run test -- -u
pnpm --filter @workspace/kalibra run test
```

Esperado: a segunda execução passa com 0 escritos.

- [ ] **Step 8: Commit**

```bash
git add artifacts/kalibra/src/domain artifacts/kalibra/src/App.tsx artifacts/kalibra/src/__tests__
git commit -m "feat: adotar dark como tema padrao do Kalibra"
```

---

### Task 16: Verificação final da Fase 0

**Files:**
- Modify: nenhum (só verificação e documentação)
- Create: `docs/superpowers/plans/2026-09-12-kalibra-fase-0-verificacao.md`

**Interfaces:**
- Consumes: todo o resultado das Tasks 1–15
- Produces: registro do estado final, consumido pelo plano da Fase 1A

- [ ] **Step 1: Rodar o portão completo**

```bash
cd "C:/Users/User/Documents/Kalibra"
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/kalibra run test
```

Esperado: os três passam; 14 testes (12 de tela + 2 de tema), 0 snapshots escritos.

- [ ] **Step 2: Conferir que o App.tsx encolheu e nada ficou órfão**

```bash
wc -l artifacts/kalibra/src/App.tsx
grep -rn "store/workspaces" artifacts/kalibra/src/ || echo "store removido"
grep -rn "localStorage\|sessionStorage\|fetch(" artifacts/kalibra/src/pages artifacts/kalibra/src/components --include=*.tsx | grep -v "components/ui/" || echo "nenhuma tela toca persistencia"
```

Esperado: `App.tsx` com 30 linhas ou menos; `store removido`; `nenhuma tela toca persistencia`.

- [ ] **Step 3: Conferência visual manual no navegador**

```bash
cd artifacts/kalibra
PORT=5173 BASE_PATH=/ pnpm run dev
```

Abrir `http://localhost:5173` e percorrer, **em dark e em claro**: Home, Portal, Novo workspace, Dashboard, Edital, Edital/revisar/1, Estudo (as 6 abas), Notas, Revisão, Questões, Erros, Recomendações, Diagnóstico (os 3 estados).

Requer `VITE_CLERK_PUBLISHABLE_KEY` no ambiente. Se a chave não estiver disponível, registrar isso e apoiar-se apenas nos snapshots — eles cobrem o HTML, mas não a folha de estilo aplicada.

Procurar por: espaçamento alterado, cor fora do par claro/escuro, card sem borda, texto truncado, botão trocado de lugar. Qualquer achado vira correção antes de fechar a fase.

- [ ] **Step 4: Registrar o estado final**

Criar `docs/superpowers/plans/2026-09-12-kalibra-fase-0-verificacao.md` com: número de linhas de cada arquivo criado, saída dos três comandos do portão, lista das telas conferidas no navegador nos dois temas, e qualquer desvio encontrado e corrigido.

- [ ] **Step 5: Commit final**

```bash
git add docs/superpowers/plans/2026-09-12-kalibra-fase-0-verificacao.md
git commit -m "docs: registrar verificacao final da fase 0"
```

---

## Estado ao fim da Fase 0

- `App.tsx` com ~30 linhas, contra 958
- 21 arquivos novos de página, componente, rota e configuração
- 14 testes automatizados protegendo o HTML de todas as telas
- Nenhuma tela tocando `localStorage`, `sessionStorage` ou `fetch`
- `src/domain/config.ts` com quatro módulos em `'local'`, prontos para virar `'api'` na Fase 3
- Dark como tema padrão
- Zero mudança visual além do tema padrão

**Próximo plano:** Fase 1A — `lib/core` com testes (FSRS, deduplicação, priorização) e workspace multi-cargo.
