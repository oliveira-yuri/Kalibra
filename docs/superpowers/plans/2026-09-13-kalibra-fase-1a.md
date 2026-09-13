# Kalibra Fase 1A — lib/core e workspace multi-cargo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o pacote de regras puras `lib/core` com testes, e expandir o workspace para multi-cargos, disponibilidade semanal e edital opcional — tudo dentro dos padrões visuais que já existem.

**Architecture:** `lib/core` contém funções puras, sem I/O, importadas tanto pelos adaptadores locais do frontend quanto — nas fases seguintes — pelo servidor. O frontend continua consumindo apenas hooks de `src/domain/`; a expansão do modelo de workspace acontece no adaptador local, que passa a delegar as regras ao core. As telas `NovoWorkspace` e `Portal` ganham campos novos compostos exclusivamente de padrões visuais existentes.

**Tech Stack:** TypeScript 5.9, Vitest 3, `ts-fsrs` 5.4.2, React 19.1.0, Vite 7, Wouter, Tailwind 4, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-12-kalibra-design.md`

## Global Constraints

- **Seções do spec que mais governam esta fase:** §3.2 (`lib/core`), §4.3 (FSRS), §4.14 (workspace, cargo, availability), §5 (preservação do frontend).
- **Nenhuma tela chama `fetch` ou `localStorage` direto.** Só hooks de `src/domain/`. Esta é a restrição R1 do spec e vale sem exceção.
- **Nenhuma cor, raio, fonte, sombra ou espaçamento fora dos tokens `k-*` existentes** em `artifacts/kalibra/src/index.css`. Se algo não tem padrão, componha a partir de dois existentes.
- **Dark é o tema padrão**; toda tela nova ou alterada precisa funcionar nos dois temas.
- React e react-dom em **exatamente `19.1.0`**; Zod **3.x**; `minimumReleaseAge: 1440` em `pnpm-workspace.yaml` **não pode ser desabilitado ou reduzido**.
- **Nenhum segredo em commit, chat ou arquivo versionado.** Só `.env.example` com nomes.
- **Mensagens de commit em português**, formato `tipo: descrição`. Terminar o corpo com:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- **Portão de cada task:** `pnpm run typecheck`, `pnpm run test` e `pnpm run build` passam, todos a partir da raiz do repositório.
- **Snapshots:** ao contrário da Fase 0, esta fase **adiciona interface**, então snapshots vão mudar. A regra passa a ser: um snapshot só muda quando a task pediu aquela mudança, e a diferença precisa ser inspecionada e descrita no relatório antes de ser aceita. Uma diferença que a task não pediu continua sendo bug. **Nunca rode `vitest -u` sem antes ler o diff.**

### Estado herdado da Fase 0

- `App.tsx` tem 24 linhas; páginas em `src/pages/`, componentes em `src/components/`, rotas em `src/routes/`.
- `src/domain/` existe com `useWorkspaces`, `useNotes`, `useStudyState`, `useTheme` e adaptadores em `src/domain/adapters/local/`.
- `src/domain/config.ts` é hoje uma **asserção, não um seletor**: os guardas provam que o valor é `'local'` e lançam para qualquer outro. Esta fase não o conserta — a Fase 3 o faz quando existir o primeiro `adapters/api/`.
- A suíte tem 18 testes (16 snapshots de rota + 2 de tema). A cobertura real é de **13 telas distintas**: `/` redireciona para `/portal`, e `/sign-in` e `/sign-up` capturam só o wrapper de tema.

---

## Escopo desta fase

`lib/core` nasce com **FSRS e regras de workspace apenas**. Deduplicação, geração de plano, priorização e classificação de erro operam sobre `syllabus_item`, conceitos e registros de erro, que não existem antes das Fases 1B–1D; escrevê-las agora seria projetar contra entradas imaginárias. FSRS entra mesmo sem consumidor até a Fase 1D porque é matemática pura e isolada, o spec §4.3 já fixa sua forma, e testá-la cedo remove o risco da parte mais difícil do produto.

---

## Estrutura de arquivos

**Criados:**

| Arquivo | Responsabilidade |
|---|---|
| `lib/core/package.json` | pacote `@workspace/core` |
| `lib/core/tsconfig.json` | build composite, igual aos outros `lib/*` |
| `lib/core/vitest.config.ts` | testes do pacote |
| `lib/core/src/index.ts` | superfície pública |
| `lib/core/src/workspace/status.ts` | estados do workspace e transições válidas |
| `lib/core/src/workspace/availability.ts` | disponibilidade semanal |
| `lib/core/src/workspace/slug.ts` | geração de slug sem colisão |
| `lib/core/src/workspace/exam-dates.ts` | data efetiva e dias restantes por cargo |
| `lib/core/src/fsrs/types.ts` | tipos de estado e avaliação |
| `lib/core/src/fsrs/schedule.ts` | agendamento sobre `ts-fsrs` |
| `artifacts/kalibra/src/components/CargoFields.tsx` | lista editável de cargos |
| `artifacts/kalibra/src/components/AvailabilityFields.tsx` | grade de disponibilidade semanal |
| `artifacts/kalibra/src/components/WorkspaceStatusChip.tsx` | chip de status do workspace |

**Modificados:**

| Arquivo | Mudança |
|---|---|
| `tsconfig.json` (raiz) | referência para `lib/core` |
| `artifacts/kalibra/package.json` | dependência `@workspace/core` |
| `artifacts/kalibra/src/domain/adapters/local/workspaces.ts` | modelo expandido + migração de dados |
| `artifacts/kalibra/src/domain/useWorkspaces.ts` | reexportar tipos novos |
| `artifacts/kalibra/src/pages/NovoWorkspace.tsx` | multi-cargo, disponibilidade, edital opcional, 20 MB |
| `artifacts/kalibra/src/pages/Portal.tsx` | status, D−, cargo, menu de ações |
| `artifacts/kalibra/src/__tests__/screens.snapshot.test.tsx` | snapshots atualizados quando a task pedir |

---

### Task 1: Criar o pacote `lib/core`

**Files:**
- Create: `lib/core/package.json`, `lib/core/tsconfig.json`, `lib/core/vitest.config.ts`, `lib/core/src/index.ts`, `lib/core/src/version.test.ts`
- Modify: `tsconfig.json` (raiz)

**Interfaces:**
- Consumes: nada
- Produces: pacote `@workspace/core` resolvível por `workspace:*`, com `pnpm run test` da raiz executando seus testes. Exporta `export const CORE_PACKAGE = 'core'` provisoriamente (a Task 2 substitui por conteúdo real).

- [ ] **Step 1: Criar o package.json**

`lib/core/package.json` — espelha `lib/api-zod/package.json`, que é a convenção do repositório:

```json
{
  "name": "@workspace/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^3.2.7"
  }
}
```

- [ ] **Step 2: Criar o tsconfig**

`lib/core/tsconfig.json` — idêntico em forma ao de `lib/api-zod`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Referenciar o pacote na raiz**

Em `tsconfig.json` da raiz, acrescentar ao array `references`, mantendo os três existentes:

```json
    {
      "path": "./lib/core"
    }
```

- [ ] **Step 4: Criar a configuração de teste**

`lib/core/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
  },
});
```

`environment: 'node'` porque `lib/core` é puro: nenhuma função aqui pode tocar DOM, storage ou rede. Se um teste precisar de jsdom, a função está no pacote errado.

- [ ] **Step 5: Criar o ponto de entrada**

`lib/core/src/index.ts`:

```ts
export const CORE_PACKAGE = 'core';
```

- [ ] **Step 6: Escrever o teste que prova que o harness funciona**

`lib/core/src/version.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CORE_PACKAGE } from './index';

describe('pacote core', () => {
  it('expõe sua identidade', () => {
    expect(CORE_PACKAGE).toBe('core');
  });
});
```

- [ ] **Step 7: Instalar e verificar**

```bash
cd "C:/Users/User/Documents/Kalibra"
pnpm install
pnpm run typecheck
pnpm run test
```

Esperado: `pnpm run test` executa **duas** suítes — a de `artifacts/kalibra` (18 testes) e a de `lib/core` (1 teste). Se a de `lib/core` não aparecer, o pacote não foi detectado: confirme que `lib/*` está em `packages:` no `pnpm-workspace.yaml` e que o `pnpm install` rodou.

- [ ] **Step 8: Commit**

```bash
git add lib/core tsconfig.json pnpm-lock.yaml
git commit -m "feat: criar pacote lib/core para regras puras"
```

---

### Task 2: Estados do workspace

Substitui o campo livre `importStatus` por uma máquina de estados explícita. O spec §4.14 define nove estados.

**Files:**
- Create: `lib/core/src/workspace/status.ts`, `lib/core/src/workspace/status.test.ts`
- Modify: `lib/core/src/index.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `export type WorkspaceStatus = 'sem_edital' | 'aguardando_upload' | 'extraindo_edital' | 'aguardando_revisao_edital' | 'diagnostico_pendente' | 'diagnostico_em_andamento' | 'plano_quinzenal_pendente' | 'estudando' | 'erro'`
  - `export function canTransition(from: WorkspaceStatus, to: WorkspaceStatus): boolean`
  - `export function nextActionFor(status: WorkspaceStatus): string` — o texto de "próximo passo" exibido no card do Portal
  - `export const WORKSPACE_STATUS_LABELS: Record<WorkspaceStatus, string>`

- [ ] **Step 1: Escrever os testes que falham**

`lib/core/src/workspace/status.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { canTransition, nextActionFor, WORKSPACE_STATUS_LABELS } from './status';

describe('transições de status', () => {
  it('permite sair de sem_edital para aguardando_upload', () => {
    expect(canTransition('sem_edital', 'aguardando_upload')).toBe(true);
  });

  it('permite o caminho feliz completo', () => {
    expect(canTransition('aguardando_upload', 'extraindo_edital')).toBe(true);
    expect(canTransition('extraindo_edital', 'aguardando_revisao_edital')).toBe(true);
    expect(canTransition('aguardando_revisao_edital', 'diagnostico_pendente')).toBe(true);
    expect(canTransition('diagnostico_pendente', 'diagnostico_em_andamento')).toBe(true);
    expect(canTransition('diagnostico_em_andamento', 'plano_quinzenal_pendente')).toBe(true);
    expect(canTransition('plano_quinzenal_pendente', 'estudando')).toBe(true);
  });

  it('recusa pular o diagnóstico obrigatório', () => {
    expect(canTransition('aguardando_revisao_edital', 'estudando')).toBe(false);
    expect(canTransition('diagnostico_pendente', 'estudando')).toBe(false);
  });

  it('permite cair em erro a partir de qualquer estado de processamento', () => {
    expect(canTransition('extraindo_edital', 'erro')).toBe(true);
    expect(canTransition('aguardando_upload', 'erro')).toBe(true);
  });

  it('permite retomar de erro para o upload', () => {
    expect(canTransition('erro', 'aguardando_upload')).toBe(true);
  });

  it('recusa transição para o próprio estado', () => {
    expect(canTransition('estudando', 'estudando')).toBe(false);
  });

  it('permite reabrir o edital estando em estudo', () => {
    expect(canTransition('estudando', 'aguardando_upload')).toBe(true);
  });
});

describe('próximo passo por status', () => {
  it('dá um texto para cada status, sem placeholder', () => {
    const statuses = Object.keys(WORKSPACE_STATUS_LABELS) as Array<keyof typeof WORKSPACE_STATUS_LABELS>;
    expect(statuses).toHaveLength(9);
    for (const status of statuses) {
      const action = nextActionFor(status);
      expect(action.length).toBeGreaterThan(0);
      expect(action).not.toMatch(/TODO|TBD/);
    }
  });

  it('pede o edital quando não há edital', () => {
    expect(nextActionFor('sem_edital')).toBe('Importar edital ou cadastrar manualmente');
  });

  it('pede o diagnóstico quando ele está pendente', () => {
    expect(nextActionFor('diagnostico_pendente')).toBe('Fazer o diagnóstico inicial');
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
cd "C:/Users/User/Documents/Kalibra"
pnpm --filter @workspace/core run test
```

Esperado: FALHA com `Failed to resolve import "./status"`.

- [ ] **Step 3: Implementar**

`lib/core/src/workspace/status.ts`:

```ts
export type WorkspaceStatus =
  | 'sem_edital'
  | 'aguardando_upload'
  | 'extraindo_edital'
  | 'aguardando_revisao_edital'
  | 'diagnostico_pendente'
  | 'diagnostico_em_andamento'
  | 'plano_quinzenal_pendente'
  | 'estudando'
  | 'erro';

export const WORKSPACE_STATUS_LABELS: Record<WorkspaceStatus, string> = {
  sem_edital: 'sem edital',
  aguardando_upload: 'aguardando upload',
  extraindo_edital: 'extraindo edital',
  aguardando_revisao_edital: 'aguardando revisão',
  diagnostico_pendente: 'diagnóstico pendente',
  diagnostico_em_andamento: 'diagnóstico em andamento',
  plano_quinzenal_pendente: 'plano pendente',
  estudando: 'estudando',
  erro: 'erro',
};

const NEXT_ACTIONS: Record<WorkspaceStatus, string> = {
  sem_edital: 'Importar edital ou cadastrar manualmente',
  aguardando_upload: 'Enviar o arquivo do edital',
  extraindo_edital: 'Aguardando a extração terminar',
  aguardando_revisao_edital: 'Revisar a estrutura extraída',
  diagnostico_pendente: 'Fazer o diagnóstico inicial',
  diagnostico_em_andamento: 'Retomar o diagnóstico',
  plano_quinzenal_pendente: 'Revisar o plano quinzenal',
  estudando: 'Continuar a sessão de estudo',
  erro: 'Revisar o erro e tentar de novo',
};

/**
 * Estados alcançáveis a partir de cada estado. `erro` é alcançável a partir de
 * qualquer estado de processamento, e dele se retoma pelo upload.
 */
const TRANSITIONS: Record<WorkspaceStatus, readonly WorkspaceStatus[]> = {
  sem_edital: ['aguardando_upload', 'erro'],
  aguardando_upload: ['extraindo_edital', 'sem_edital', 'erro'],
  extraindo_edital: ['aguardando_revisao_edital', 'erro'],
  aguardando_revisao_edital: ['diagnostico_pendente', 'aguardando_upload', 'erro'],
  diagnostico_pendente: ['diagnostico_em_andamento', 'aguardando_upload', 'erro'],
  diagnostico_em_andamento: ['plano_quinzenal_pendente', 'diagnostico_pendente', 'erro'],
  plano_quinzenal_pendente: ['estudando', 'diagnostico_pendente', 'erro'],
  estudando: ['aguardando_upload', 'diagnostico_pendente', 'erro'],
  erro: ['aguardando_upload', 'sem_edital'],
};

export function canTransition(from: WorkspaceStatus, to: WorkspaceStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextActionFor(status: WorkspaceStatus): string {
  return NEXT_ACTIONS[status];
}
```

- [ ] **Step 4: Exportar do índice**

Em `lib/core/src/index.ts`, substituir todo o conteúdo por:

```ts
export * from './workspace/status';
```

O `CORE_PACKAGE` provisório sai, e `src/version.test.ts` deve ser **deletado** junto — ele testava apenas o harness, que agora é provado pelos testes reais.

- [ ] **Step 5: Rodar até passar**

```bash
pnpm --filter @workspace/core run test
pnpm run typecheck
```

Esperado: todos os testes de `status.test.ts` passam; typecheck limpo.

- [ ] **Step 6: Commit**

```bash
git add lib/core/src tsconfig.json
git rm --cached lib/core/src/version.test.ts 2>/dev/null || true
git commit -m "feat: modelar estados do workspace em lib/core"
```

---

### Task 3: Disponibilidade semanal

**Files:**
- Create: `lib/core/src/workspace/availability.ts`, `lib/core/src/workspace/availability.test.ts`
- Modify: `lib/core/src/index.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6` (0 = domingo, alinhado a `Date.getDay()`)
  - `export type DayAvailability = { weekday: Weekday; minutes: number }`
  - `export type WeeklyAvailability = { days: DayAvailability[]; maxSessionMinutes: number }`
  - `export function emptyAvailability(): WeeklyAvailability`
  - `export function totalWeeklyMinutes(a: WeeklyAvailability): number`
  - `export function minutesFor(a: WeeklyAvailability, weekday: Weekday): number`
  - `export function validateAvailability(a: WeeklyAvailability): string[]` — lista de mensagens em português; vazia significa válida
  - `export const WEEKDAY_LABELS: Record<Weekday, string>`

- [ ] **Step 1: Escrever os testes que falham**

`lib/core/src/workspace/availability.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  emptyAvailability, totalWeeklyMinutes, minutesFor,
  validateAvailability, WEEKDAY_LABELS, type WeeklyAvailability,
} from './availability';

describe('disponibilidade vazia', () => {
  it('tem os sete dias em zero', () => {
    const a = emptyAvailability();
    expect(a.days).toHaveLength(7);
    expect(totalWeeklyMinutes(a)).toBe(0);
  });

  it('começa com sessão máxima de 50 minutos', () => {
    expect(emptyAvailability().maxSessionMinutes).toBe(50);
  });
});

describe('soma semanal', () => {
  it('soma os minutos de todos os dias', () => {
    const a: WeeklyAvailability = {
      days: [
        { weekday: 1, minutes: 60 },
        { weekday: 3, minutes: 90 },
        { weekday: 5, minutes: 30 },
      ],
      maxSessionMinutes: 50,
    };
    expect(totalWeeklyMinutes(a)).toBe(180);
  });

  it('devolve zero para um dia não informado', () => {
    const a: WeeklyAvailability = { days: [{ weekday: 1, minutes: 60 }], maxSessionMinutes: 50 };
    expect(minutesFor(a, 2)).toBe(0);
    expect(minutesFor(a, 1)).toBe(60);
  });
});

describe('validação', () => {
  it('aceita uma disponibilidade coerente', () => {
    const a: WeeklyAvailability = { days: [{ weekday: 1, minutes: 60 }], maxSessionMinutes: 50 };
    expect(validateAvailability(a)).toEqual([]);
  });

  it('recusa minutos negativos', () => {
    const a: WeeklyAvailability = { days: [{ weekday: 1, minutes: -10 }], maxSessionMinutes: 50 };
    expect(validateAvailability(a)).toContain('Minutos não podem ser negativos.');
  });

  it('recusa mais de 24 horas num dia', () => {
    const a: WeeklyAvailability = { days: [{ weekday: 1, minutes: 1441 }], maxSessionMinutes: 50 };
    expect(validateAvailability(a)).toContain('Um dia não pode ter mais de 24 horas.');
  });

  it('recusa sessão máxima maior que o dia mais curto disponível', () => {
    const a: WeeklyAvailability = {
      days: [{ weekday: 1, minutes: 30 }, { weekday: 2, minutes: 120 }],
      maxSessionMinutes: 50,
    };
    expect(validateAvailability(a)).toContain('A sessão máxima é maior que a disponibilidade de segunda-feira.');
  });

  it('recusa sessão máxima não positiva', () => {
    const a: WeeklyAvailability = { days: [], maxSessionMinutes: 0 };
    expect(validateAvailability(a)).toContain('A sessão máxima precisa ser maior que zero.');
  });

  it('ignora dias zerados ao comparar com a sessão máxima', () => {
    const a: WeeklyAvailability = {
      days: [{ weekday: 1, minutes: 0 }, { weekday: 2, minutes: 120 }],
      maxSessionMinutes: 50,
    };
    expect(validateAvailability(a)).toEqual([]);
  });
});

describe('rótulos', () => {
  it('nomeia os sete dias em português', () => {
    expect(WEEKDAY_LABELS[0]).toBe('domingo');
    expect(WEEKDAY_LABELS[1]).toBe('segunda-feira');
    expect(WEEKDAY_LABELS[6]).toBe('sábado');
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
pnpm --filter @workspace/core run test
```

Esperado: FALHA com `Failed to resolve import "./availability"`.

- [ ] **Step 3: Implementar**

`lib/core/src/workspace/availability.ts`:

```ts
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type DayAvailability = {
  weekday: Weekday;
  minutes: number;
};

export type WeeklyAvailability = {
  days: DayAvailability[];
  maxSessionMinutes: number;
};

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: 'domingo',
  1: 'segunda-feira',
  2: 'terça-feira',
  3: 'quarta-feira',
  4: 'quinta-feira',
  5: 'sexta-feira',
  6: 'sábado',
};

const ALL_WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const MINUTES_IN_A_DAY = 24 * 60;
const DEFAULT_MAX_SESSION_MINUTES = 50;

export function emptyAvailability(): WeeklyAvailability {
  return {
    days: ALL_WEEKDAYS.map((weekday) => ({ weekday, minutes: 0 })),
    maxSessionMinutes: DEFAULT_MAX_SESSION_MINUTES,
  };
}

export function minutesFor(availability: WeeklyAvailability, weekday: Weekday): number {
  return availability.days.find((day) => day.weekday === weekday)?.minutes ?? 0;
}

export function totalWeeklyMinutes(availability: WeeklyAvailability): number {
  return availability.days.reduce((total, day) => total + day.minutes, 0);
}

export function validateAvailability(availability: WeeklyAvailability): string[] {
  const problems: string[] = [];

  if (availability.days.some((day) => day.minutes < 0)) {
    problems.push('Minutos não podem ser negativos.');
  }

  if (availability.days.some((day) => day.minutes > MINUTES_IN_A_DAY)) {
    problems.push('Um dia não pode ter mais de 24 horas.');
  }

  if (availability.maxSessionMinutes <= 0) {
    problems.push('A sessão máxima precisa ser maior que zero.');
  }

  // Um dia zerado significa indisponível, não um dia curto — não conflita.
  for (const day of availability.days) {
    if (day.minutes > 0 && day.minutes < availability.maxSessionMinutes) {
      problems.push(`A sessão máxima é maior que a disponibilidade de ${WEEKDAY_LABELS[day.weekday]}.`);
    }
  }

  return problems;
}
```

- [ ] **Step 4: Exportar do índice**

Acrescentar a `lib/core/src/index.ts`:

```ts
export * from './workspace/availability';
```

- [ ] **Step 5: Rodar até passar**

```bash
pnpm --filter @workspace/core run test
pnpm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add lib/core/src
git commit -m "feat: modelar disponibilidade semanal em lib/core"
```

---

### Task 4: Slug de workspace

Hoje a geração de slug está inline em `NovoWorkspace.tsx`, misturada com o submit. Ela vira função pura e testável.

**Files:**
- Create: `lib/core/src/workspace/slug.ts`, `lib/core/src/workspace/slug.test.ts`
- Modify: `lib/core/src/index.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `export function slugify(title: string): string`
  - `export function uniqueSlug(title: string, taken: readonly string[]): string`

- [ ] **Step 1: Escrever os testes que falham**

`lib/core/src/workspace/slug.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { slugify, uniqueSlug } from './slug';

describe('slugify', () => {
  it('reproduz o comportamento atual da tela', () => {
    expect(slugify('Concurso SETEC Campinas')).toBe('concurso-setec-campinas');
  });

  it('remove acentos', () => {
    expect(slugify('Analista Técnico de Informática')).toBe('analista-tecnico-de-informatica');
    expect(slugify('Educação Física')).toBe('educacao-fisica');
  });

  it('colapsa separadores e apara as pontas', () => {
    expect(slugify('  Banco   do  Brasil — Escriturário  ')).toBe('banco-do-brasil-escriturario');
  });

  it('devolve string vazia quando não sobra nada', () => {
    expect(slugify('—  ')).toBe('');
    expect(slugify('')).toBe('');
  });
});

describe('uniqueSlug', () => {
  it('usa o slug direto quando está livre', () => {
    expect(uniqueSlug('Prova X', [])).toBe('prova-x');
  });

  it('sufixa quando já existe', () => {
    expect(uniqueSlug('Prova X', ['prova-x'])).toBe('prova-x-2');
  });

  it('incrementa até achar um livre', () => {
    expect(uniqueSlug('Prova X', ['prova-x', 'prova-x-2', 'prova-x-3'])).toBe('prova-x-4');
  });

  it('não colide quando o título não gera slug', () => {
    expect(uniqueSlug('—', [])).toBe('workspace');
    expect(uniqueSlug('—', ['workspace'])).toBe('workspace-2');
  });
});
```

> Nota: o comportamento antigo sufixava com `Date.now().toString().slice(-6)`, que é não-determinístico e impossível de testar. O sufixo numérico sequencial é a substituição deliberada.

- [ ] **Step 2: Rodar para ver falhar**

```bash
pnpm --filter @workspace/core run test
```

Esperado: FALHA com `Failed to resolve import "./slug"`.

- [ ] **Step 3: Implementar**

`lib/core/src/workspace/slug.ts`:

```ts
const FALLBACK_SLUG = 'workspace';

export function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function uniqueSlug(title: string, taken: readonly string[]): string {
  const base = slugify(title) || FALLBACK_SLUG;
  if (!taken.includes(base)) return base;

  let suffix = 2;
  while (taken.includes(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}
```

- [ ] **Step 4: Exportar do índice**

Acrescentar a `lib/core/src/index.ts`:

```ts
export * from './workspace/slug';
```

- [ ] **Step 5: Rodar até passar**

```bash
pnpm --filter @workspace/core run test
pnpm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add lib/core/src
git commit -m "feat: extrair geracao de slug para lib/core"
```

---

### Task 5: Data efetiva e contagem regressiva por cargo

O spec e o PD-01 exigem que data e contagem regressiva venham do **cargo selecionado**, não do concurso. Hoje isso está espalhado entre `Shell.tsx` e `src/lib/date-utils.ts`.

**Files:**
- Create: `lib/core/src/workspace/exam-dates.ts`, `lib/core/src/workspace/exam-dates.test.ts`
- Modify: `lib/core/src/index.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `export type CargoDates = { id: string; examDate?: string; period?: string }`
  - `export function effectiveExamDate(cargos: readonly CargoDates[], selectedCargoId: string | undefined, workspaceExamDate: string): string`
  - `export function daysUntil(isoDate: string, today: Date): number | null`

> `daysUntil` recebe `today` como parâmetro em vez de ler o relógio. Função pura é testável; uma que lê `new Date()` internamente não é.

- [ ] **Step 1: Escrever os testes que falham**

`lib/core/src/workspace/exam-dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { effectiveExamDate, daysUntil, type CargoDates } from './exam-dates';

const CARGOS: CargoDates[] = [
  { id: 'c1', examDate: '2027-01-17', period: 'A' },
  { id: 'c2', examDate: '2027-01-17', period: 'B' },
  { id: 'c3' },
];

describe('data efetiva da prova', () => {
  it('usa a data do cargo selecionado', () => {
    expect(effectiveExamDate(CARGOS, 'c1', '2026-01-01')).toBe('2027-01-17');
  });

  it('cai na data do workspace quando o cargo não tem data própria', () => {
    expect(effectiveExamDate(CARGOS, 'c3', '2026-01-01')).toBe('2026-01-01');
  });

  it('cai na data do workspace quando nenhum cargo está selecionado', () => {
    expect(effectiveExamDate(CARGOS, undefined, '2026-01-01')).toBe('2026-01-01');
  });

  it('cai na data do workspace quando o id selecionado não existe', () => {
    expect(effectiveExamDate(CARGOS, 'inexistente', '2026-01-01')).toBe('2026-01-01');
  });

  it('funciona sem cargo nenhum', () => {
    expect(effectiveExamDate([], undefined, '2026-06-01')).toBe('2026-06-01');
  });
});

describe('dias restantes', () => {
  it('conta os dias até a prova', () => {
    expect(daysUntil('2026-01-17', new Date('2026-01-01T12:00:00Z'))).toBe(16);
  });

  it('devolve zero no dia da prova', () => {
    expect(daysUntil('2026-01-17', new Date('2026-01-17T23:00:00Z'))).toBe(0);
  });

  it('devolve negativo depois da prova', () => {
    expect(daysUntil('2026-01-17', new Date('2026-01-20T00:00:00Z'))).toBe(-3);
  });

  it('ignora a hora do dia', () => {
    const cedo = daysUntil('2026-01-17', new Date('2026-01-01T00:01:00Z'));
    const tarde = daysUntil('2026-01-17', new Date('2026-01-01T23:59:00Z'));
    expect(cedo).toBe(tarde);
  });

  it('devolve null para data ausente ou inválida', () => {
    expect(daysUntil('', new Date('2026-01-01T00:00:00Z'))).toBeNull();
    expect(daysUntil('não é data', new Date('2026-01-01T00:00:00Z'))).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
pnpm --filter @workspace/core run test
```

Esperado: FALHA com `Failed to resolve import "./exam-dates"`.

- [ ] **Step 3: Implementar**

`lib/core/src/workspace/exam-dates.ts`:

```ts
export type CargoDates = {
  id: string;
  examDate?: string;
  period?: string;
};

export function effectiveExamDate(
  cargos: readonly CargoDates[],
  selectedCargoId: string | undefined,
  workspaceExamDate: string,
): string {
  const selected = cargos.find((cargo) => cargo.id === selectedCargoId);
  return selected?.examDate || workspaceExamDate;
}

const MS_IN_A_DAY = 24 * 60 * 60 * 1000;

/**
 * Dias inteiros entre hoje e a data da prova, comparando datas em UTC para que
 * a hora do dia não mude o resultado. Devolve null quando a data é ausente ou
 * não parseável — quem chama decide como exibir isso.
 */
export function daysUntil(isoDate: string, today: Date): number | null {
  if (!isoDate) return null;

  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return null;

  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  return Math.round((targetUtc - todayUtc) / MS_IN_A_DAY);
}
```

- [ ] **Step 4: Exportar do índice**

Acrescentar a `lib/core/src/index.ts`:

```ts
export * from './workspace/exam-dates';
```

- [ ] **Step 5: Rodar até passar**

```bash
pnpm --filter @workspace/core run test
pnpm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add lib/core/src
git commit -m "feat: calcular data e contagem regressiva por cargo em lib/core"
```

---

### Task 6: FSRS

Envolve `ts-fsrs` numa superfície própria, para que o resto do produto nunca importe a biblioteca diretamente. O spec §4.3 fixa os campos de estado e §D3 fixa o escopo: FSRS governa revisão ativa, questões erradas e tópicos frágeis — **flashcards vão para o Anki e não passam por aqui**.

**Files:**
- Create: `lib/core/src/fsrs/types.ts`, `lib/core/src/fsrs/schedule.ts`, `lib/core/src/fsrs/schedule.test.ts`
- Modify: `lib/core/src/index.ts`, `lib/core/package.json`

**Interfaces:**
- Consumes: `ts-fsrs` 5.4.2
- Produces:
  - `export type ReviewItemKind = 'active_recall' | 'question' | 'topic'`
  - `export type RecallRating = 'nada' | 'parcial' | 'bom' | 'completo'`
  - `export type FsrsState = { difficulty: number; stability: number; reps: number; lapses: number; dueAt: string; lastReviewAt: string | null }`
  - `export function newFsrsState(now: Date): FsrsState`
  - `export function scheduleReview(state: FsrsState, rating: RecallRating, now: Date): FsrsState`
  - `export function isDue(state: FsrsState, now: Date): boolean`
  - `export function previewIntervals(state: FsrsState, now: Date): Record<RecallRating, number>` — dias até a próxima revisão para cada nota, usado pela tela de revisão para mostrar o efeito antes do clique

- [ ] **Step 1: Instalar a dependência**

```bash
cd "C:/Users/User/Documents/Kalibra"
pnpm --filter @workspace/core add ts-fsrs@5.4.2
```

Se o pnpm recusar por `minimumReleaseAge`, use a versão estável imediatamente anterior. **Não** desabilite a trava.

- [ ] **Step 2: Escrever os testes que falham**

`lib/core/src/fsrs/schedule.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { newFsrsState, scheduleReview, isDue, previewIntervals } from './schedule';

const NOW = new Date('2026-09-13T10:00:00Z');

describe('estado inicial', () => {
  it('nasce vencido, para ser revisado na hora', () => {
    const state = newFsrsState(NOW);
    expect(isDue(state, NOW)).toBe(true);
    expect(state.reps).toBe(0);
    expect(state.lapses).toBe(0);
    expect(state.lastReviewAt).toBeNull();
  });
});

describe('agendamento', () => {
  it('conta a revisão', () => {
    const next = scheduleReview(newFsrsState(NOW), 'bom', NOW);
    expect(next.reps).toBe(1);
    expect(next.lastReviewAt).toBe(NOW.toISOString());
  });

  it('adia mais quanto melhor a recuperação', () => {
    const inicial = newFsrsState(NOW);
    const nada = new Date(scheduleReview(inicial, 'nada', NOW).dueAt).getTime();
    const parcial = new Date(scheduleReview(inicial, 'parcial', NOW).dueAt).getTime();
    const bom = new Date(scheduleReview(inicial, 'bom', NOW).dueAt).getTime();
    const completo = new Date(scheduleReview(inicial, 'completo', NOW).dueAt).getTime();

    expect(nada).toBeLessThan(parcial);
    expect(parcial).toBeLessThan(bom);
    expect(bom).toBeLessThan(completo);
  });

  it('conta lapso quando o usuário não recupera nada', () => {
    const estudado = scheduleReview(newFsrsState(NOW), 'bom', NOW);
    const depois = new Date('2026-09-20T10:00:00Z');
    const esquecido = scheduleReview(estudado, 'nada', depois);
    expect(esquecido.lapses).toBe(1);
  });

  it('não conta lapso numa recuperação bem-sucedida', () => {
    const estudado = scheduleReview(newFsrsState(NOW), 'bom', NOW);
    expect(estudado.lapses).toBe(0);
  });

  it('ganha estabilidade ao longo de revisões boas', () => {
    let state = newFsrsState(NOW);
    state = scheduleReview(state, 'bom', NOW);
    const primeira = state.stability;
    state = scheduleReview(state, 'bom', new Date(state.dueAt));
    expect(state.stability).toBeGreaterThan(primeira);
  });

  it('agenda sempre no futuro', () => {
    const next = scheduleReview(newFsrsState(NOW), 'nada', NOW);
    expect(new Date(next.dueAt).getTime()).toBeGreaterThan(NOW.getTime());
  });
});

describe('vencimento', () => {
  it('não está vencido antes da data', () => {
    const state = scheduleReview(newFsrsState(NOW), 'completo', NOW);
    expect(isDue(state, NOW)).toBe(false);
  });

  it('está vencido na data ou depois', () => {
    const state = scheduleReview(newFsrsState(NOW), 'bom', NOW);
    expect(isDue(state, new Date(state.dueAt))).toBe(true);
  });
});

describe('prévia de intervalos', () => {
  it('dá um intervalo para cada nota, em ordem crescente', () => {
    const preview = previewIntervals(newFsrsState(NOW), NOW);
    expect(preview.nada).toBeLessThanOrEqual(preview.parcial);
    expect(preview.parcial).toBeLessThanOrEqual(preview.bom);
    expect(preview.bom).toBeLessThanOrEqual(preview.completo);
  });

  it('devolve dias inteiros não negativos', () => {
    const preview = previewIntervals(newFsrsState(NOW), NOW);
    for (const dias of Object.values(preview)) {
      expect(Number.isInteger(dias)).toBe(true);
      expect(dias).toBeGreaterThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 3: Rodar para ver falhar**

```bash
pnpm --filter @workspace/core run test
```

Esperado: FALHA com `Failed to resolve import "./schedule"`.

- [ ] **Step 4: Criar os tipos**

`lib/core/src/fsrs/types.ts`:

```ts
/** O que o FSRS do Kalibra agenda. Flashcards NÃO entram: vão para o Anki. */
export type ReviewItemKind = 'active_recall' | 'question' | 'topic';

/** Os quatro botões que a tela de revisão já usa hoje. */
export type RecallRating = 'nada' | 'parcial' | 'bom' | 'completo';

export type FsrsState = {
  difficulty: number;
  stability: number;
  reps: number;
  lapses: number;
  /** ISO 8601 */
  dueAt: string;
  /** ISO 8601, ou null se nunca revisado */
  lastReviewAt: string | null;
};
```

- [ ] **Step 5: Implementar o agendamento**

> **Confira a superfície da biblioteca antes de copiar.** O código abaixo assume que `ts-fsrs@5.4.2` exporta `createEmptyCard`, `fsrs`, `generatorParameters`, `Rating` e o tipo `Card`, e que `scheduler.next(card, now, rating)` devolve `{ card }`. Abra `node_modules/ts-fsrs/dist/index.d.ts` e confirme antes de escrever. Se a API divergir, **mantenha as assinaturas públicas deste arquivo exatamente como estão** — elas são o contrato que a Fase 1D consome — e adapte só o miolo. Registre a divergência no relatório.

`lib/core/src/fsrs/schedule.ts`:

```ts
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card } from 'ts-fsrs';
import type { FsrsState, RecallRating } from './types';

export type { FsrsState, RecallRating, ReviewItemKind } from './types';

const scheduler = fsrs(generatorParameters({ enable_fuzz: false }));

const RATING_MAP: Record<RecallRating, Rating> = {
  nada: Rating.Again,
  parcial: Rating.Hard,
  bom: Rating.Good,
  completo: Rating.Easy,
};

const RATINGS: readonly RecallRating[] = ['nada', 'parcial', 'bom', 'completo'];

function toCard(state: FsrsState): Card {
  const card = createEmptyCard(new Date(state.dueAt));
  return {
    ...card,
    difficulty: state.difficulty,
    stability: state.stability,
    reps: state.reps,
    lapses: state.lapses,
    due: new Date(state.dueAt),
    last_review: state.lastReviewAt ? new Date(state.lastReviewAt) : undefined,
  };
}

function fromCard(card: Card): FsrsState {
  return {
    difficulty: card.difficulty,
    stability: card.stability,
    reps: card.reps,
    lapses: card.lapses,
    dueAt: card.due.toISOString(),
    lastReviewAt: card.last_review ? card.last_review.toISOString() : null,
  };
}

export function newFsrsState(now: Date): FsrsState {
  return fromCard(createEmptyCard(now));
}

export function scheduleReview(state: FsrsState, rating: RecallRating, now: Date): FsrsState {
  const result = scheduler.next(toCard(state), now, RATING_MAP[rating]);
  return fromCard(result.card);
}

export function isDue(state: FsrsState, now: Date): boolean {
  return new Date(state.dueAt).getTime() <= now.getTime();
}

const MS_IN_A_DAY = 24 * 60 * 60 * 1000;

export function previewIntervals(state: FsrsState, now: Date): Record<RecallRating, number> {
  const preview = {} as Record<RecallRating, number>;
  for (const rating of RATINGS) {
    const next = scheduleReview(state, rating, now);
    const dias = Math.round((new Date(next.dueAt).getTime() - now.getTime()) / MS_IN_A_DAY);
    preview[rating] = Math.max(0, dias);
  }
  return preview;
}
```

> `enable_fuzz: false` é deliberado: o fuzz do FSRS randomiza o intervalo em ±5% para espalhar a carga. Com ele ligado, os testes de ordenação ficam intermitentes. A Fase 1D decide se o fuzz volta na configuração real.

- [ ] **Step 6: Exportar do índice**

Acrescentar a `lib/core/src/index.ts`:

```ts
export * from './fsrs/schedule';
```

- [ ] **Step 7: Rodar até passar**

```bash
pnpm --filter @workspace/core run test
pnpm run typecheck
pnpm run build
```

Esperado: todos os testes de FSRS passam. Se algum teste de ordenação de intervalos falhar de forma intermitente, o fuzz não foi desligado — confirme o `generatorParameters`.

- [ ] **Step 8: Commit**

```bash
git add lib/core pnpm-lock.yaml
git commit -m "feat: agendamento FSRS em lib/core sobre ts-fsrs"
```

---

### Task 7: Expandir o modelo de workspace no frontend

Liga `lib/core` ao adaptador local e expande `WorkspaceDraft`, migrando os dados que já existirem em `localStorage`.

**Files:**
- Modify: `artifacts/kalibra/package.json`, `artifacts/kalibra/src/domain/adapters/local/workspaces.ts`, `artifacts/kalibra/src/domain/useWorkspaces.ts`
- Create: `artifacts/kalibra/src/domain/adapters/local/workspaces.test.ts`

**Interfaces:**
- Consumes: `WorkspaceStatus`, `WeeklyAvailability`, `emptyAvailability` de `@workspace/core`
- Produces:
  - `WorkspaceDraft` com os campos novos: `status: WorkspaceStatus`, `cargos: Cargo[]` (agora obrigatório), `availability: WeeklyAvailability`, `hasEdital: boolean`
  - `export function migrateWorkspace(raw: unknown): WorkspaceDraft | null` — converte um registro salvo no formato antigo; devolve `null` para lixo irreconhecível
  - `useWorkspaces` mantém a mesma assinatura

- [ ] **Step 1: Declarar a dependência**

Em `artifacts/kalibra/package.json`, acrescentar em `devDependencies`, mantendo a ordem alfabética junto dos outros `@workspace/*`:

```json
    "@workspace/core": "workspace:*",
```

Depois:

```bash
cd "C:/Users/User/Documents/Kalibra"
pnpm install
```

- [ ] **Step 2: Escrever os testes de migração que falham**

`artifacts/kalibra/src/domain/adapters/local/workspaces.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { migrateWorkspace } from './workspaces';

const ANTIGO = {
  slug: 'setec-campinas',
  title: 'Concurso SETEC Campinas',
  type: 'Concurso Público',
  institution: 'SETEC',
  examDate: '2026-01-17',
  cargos: [{ id: 'c1', name: 'Analista Técnico (Informática)', examDate: '2027-01-17', period: 'A' }],
  selectedCargoId: 'c1',
  progress: 47.2,
  nextAction: 'Resolver 8 questões de porcentagem',
  active: true,
  sourceMode: 'text',
  importStatus: 'completed',
};

describe('migração de workspace', () => {
  it('preserva os campos que já existiam', () => {
    const migrado = migrateWorkspace(ANTIGO);
    expect(migrado?.slug).toBe('setec-campinas');
    expect(migrado?.title).toBe('Concurso SETEC Campinas');
    expect(migrado?.institution).toBe('SETEC');
    expect(migrado?.cargos).toHaveLength(1);
    expect(migrado?.selectedCargoId).toBe('c1');
  });

  it('traduz importStatus completed para um status real', () => {
    expect(migrateWorkspace(ANTIGO)?.status).toBe('estudando');
  });

  it('traduz importStatus pending para aguardando revisão', () => {
    expect(migrateWorkspace({ ...ANTIGO, importStatus: 'pending' })?.status).toBe('aguardando_revisao_edital');
  });

  it('traduz importStatus error para erro', () => {
    expect(migrateWorkspace({ ...ANTIGO, importStatus: 'error' })?.status).toBe('erro');
  });

  it('dá disponibilidade vazia a quem não tinha', () => {
    const migrado = migrateWorkspace(ANTIGO);
    expect(migrado?.availability.days).toHaveLength(7);
    expect(migrado?.availability.maxSessionMinutes).toBe(50);
  });

  it('marca hasEdital a partir da origem antiga', () => {
    expect(migrateWorkspace(ANTIGO)?.hasEdital).toBe(true);
    expect(migrateWorkspace({ ...ANTIGO, sourceMode: undefined, importStatus: 'pending' })?.hasEdital).toBe(false);
  });

  it('dá um cargo padrão a quem não tinha nenhum', () => {
    const migrado = migrateWorkspace({ ...ANTIGO, cargos: undefined, selectedCargoId: undefined });
    expect(migrado?.cargos).toHaveLength(1);
    expect(migrado?.cargos[0].name).toBe('Cargo único');
    expect(migrado?.selectedCargoId).toBe(migrado?.cargos[0].id);
  });

  it('não altera um registro já no formato novo', () => {
    const novo = migrateWorkspace(ANTIGO)!;
    expect(migrateWorkspace(novo)).toEqual(novo);
  });

  it('devolve null para lixo', () => {
    expect(migrateWorkspace(null)).toBeNull();
    expect(migrateWorkspace({})).toBeNull();
    expect(migrateWorkspace({ slug: 'x' })).toBeNull();
    expect(migrateWorkspace('string')).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar para ver falhar**

```bash
pnpm --filter @workspace/kalibra run test
```

Esperado: FALHA com `migrateWorkspace is not a function` (ou erro de import).

- [ ] **Step 4: Expandir o tipo e implementar a migração**

Em `artifacts/kalibra/src/domain/adapters/local/workspaces.ts`, acrescentar ao topo:

```ts
import {
  emptyAvailability,
  type WeeklyAvailability,
  type WorkspaceStatus,
} from '@workspace/core';
```

Expandir a interface, **mantendo os campos existentes** para não quebrar as telas que ainda não foram adaptadas:

```ts
export interface WorkspaceDraft {
  slug: string;
  title: string;
  institution: string;
  type: string;
  examDate: string;
  cargos: Cargo[];
  selectedCargoId: string;
  availability: WeeklyAvailability;
  status: WorkspaceStatus;
  hasEdital: boolean;
  sourceMode: SourceMode;
  sourceFileName?: string;
  sourceText?: string;
  importStatus: ImportStatus;
  progress: number;
  nextAction: string;
  active: boolean;
}
```

E acrescentar a migração:

```ts
const STATUS_FROM_IMPORT: Record<ImportStatus, WorkspaceStatus> = {
  pending: 'aguardando_revisao_edital',
  parsing: 'extraindo_edital',
  completed: 'estudando',
  error: 'erro',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Converte um registro salvo em qualquer formato anterior para o formato atual.
 * Devolve null quando o registro não tem o mínimo para ser um workspace.
 */
export function migrateWorkspace(raw: unknown): WorkspaceDraft | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.slug !== 'string' || !raw.slug) return null;
  if (typeof raw.title !== 'string' || !raw.title) return null;

  const importStatus = (raw.importStatus as ImportStatus) ?? 'pending';
  const cargos = Array.isArray(raw.cargos) && raw.cargos.length > 0
    ? (raw.cargos as Cargo[])
    : [{ id: 'c1', name: 'Cargo único', examDate: (raw.examDate as string) ?? '' }];

  return {
    slug: raw.slug,
    title: raw.title,
    institution: (raw.institution as string) ?? '',
    type: (raw.type as string) ?? 'Concurso Público',
    examDate: (raw.examDate as string) ?? '',
    cargos,
    selectedCargoId: (raw.selectedCargoId as string) ?? cargos[0].id,
    availability: (raw.availability as WeeklyAvailability) ?? emptyAvailability(),
    status: (raw.status as WorkspaceStatus) ?? STATUS_FROM_IMPORT[importStatus] ?? 'sem_edital',
    hasEdital: typeof raw.hasEdital === 'boolean'
      ? raw.hasEdital
      : Boolean(raw.sourceMode) && importStatus !== 'pending' ? true : Boolean(raw.sourceText || raw.sourceFileName),
    sourceMode: (raw.sourceMode as SourceMode) ?? 'text',
    sourceFileName: raw.sourceFileName as string | undefined,
    sourceText: raw.sourceText as string | undefined,
    importStatus,
    progress: typeof raw.progress === 'number' ? raw.progress : 0,
    nextAction: (raw.nextAction as string) ?? '',
    active: typeof raw.active === 'boolean' ? raw.active : true,
  };
}
```

- [ ] **Step 5: Aplicar a migração na leitura**

Na função `getWorkspaces`, passar cada registro salvo por `migrateWorkspace` e descartar os nulos:

```ts
export function getWorkspaces(userId?: string): WorkspaceDraft[] {
  try {
    const saved = localStorage.getItem(storageKeyFor(userId));
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed
          .map(migrateWorkspace)
          .filter((workspace): workspace is WorkspaceDraft => workspace !== null);
      }
    }
  } catch (error) {
    console.error('Não foi possível carregar os workspaces locais.', error);
  }
  return defaultPrograms;
}
```

- [ ] **Step 6: Atualizar os workspaces de demonstração**

`defaultPrograms` precisa dos campos novos. Acrescentar a cada um dos dois registros: `availability: emptyAvailability()`, `hasEdital: true`, `status: 'estudando'`, e garantir que `cargos` e `selectedCargoId` existam nos dois (o segundo hoje não tem cargo nenhum — dar-lhe `[{ id: 'c1', name: 'Cargo único', examDate: '2026-06-01' }]` e `selectedCargoId: 'c1'`).

- [ ] **Step 7: Reexportar os tipos novos**

Em `artifacts/kalibra/src/domain/useWorkspaces.ts`, acrescentar `migrateWorkspace` à lista de reexports, junto dos que já estão lá.

- [ ] **Step 8: Rodar até passar**

```bash
pnpm run typecheck
pnpm run test
pnpm run build
```

Esperado: os testes de migração passam. **Os snapshots podem mudar** se `defaultPrograms` alterar o que o Portal renderiza — inspecione o diff: só valores de card de workspace devem mudar, nada estrutural. Descreva a diferença no relatório antes de aceitar.

- [ ] **Step 9: Commit**

```bash
git add artifacts/kalibra/package.json artifacts/kalibra/src/domain pnpm-lock.yaml
git commit -m "feat: expandir modelo de workspace com status, cargos e disponibilidade"
```

---

### Task 8: Campos de cargo em Novo Workspace

**Files:**
- Create: `artifacts/kalibra/src/components/CargoFields.tsx`
- Modify: `artifacts/kalibra/src/pages/NovoWorkspace.tsx`

**Interfaces:**
- Consumes: `Cargo` de `@/domain/useWorkspaces`
- Produces: `export function CargoFields(props: { cargos: Cargo[]; onChange: (cargos: Cargo[]) => void }): JSX.Element`

**Padrões visuais a reutilizar — não invente nenhum:**
- Rótulo de campo: `text-[11px] font-medium uppercase tracking-wider text-[#6f7b85] dark:text-[#8e98a8]` (padrão já usado em `NovoWorkspace`)
- Entrada: `k-input`
- Botão de remover: `k-button k-button-quiet k-icon-button` com `k-coral`
- Botão de acrescentar: `k-button k-button-quiet` com `Plus` de `lucide-react`
- Linha de cargo: `k-option` com `p-3`

- [ ] **Step 1: Criar o componente**

`artifacts/kalibra/src/components/CargoFields.tsx`:

```tsx
import { Plus, X } from 'lucide-react';
import type { Cargo } from '@/domain/useWorkspaces';

export function CargoFields({ cargos, onChange }: { cargos: Cargo[]; onChange: (cargos: Cargo[]) => void }) {
  const update = (index: number, patch: Partial<Cargo>) =>
    onChange(cargos.map((cargo, i) => i === index ? { ...cargo, ...patch } : cargo));

  const add = () =>
    onChange([...cargos, { id: `c${Date.now()}`, name: '', examDate: '', period: '' }]);

  const remove = (index: number) =>
    onChange(cargos.filter((_, i) => i !== index));

  return (
    <div className="space-y-2" data-testid="fields-cargos">
      {cargos.map((cargo, index) => (
        <div key={cargo.id} className="k-option grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_130px_90px_auto]">
          <input
            className="k-input"
            placeholder="Nome do cargo"
            value={cargo.name}
            onChange={(event) => update(index, { name: event.target.value })}
            data-testid={`input-cargo-nome-${index}`}
          />
          <input
            type="date"
            className="k-input"
            value={cargo.examDate}
            onChange={(event) => update(index, { examDate: event.target.value })}
            data-testid={`input-cargo-data-${index}`}
          />
          <input
            className="k-input"
            placeholder="Período"
            value={cargo.period ?? ''}
            onChange={(event) => update(index, { period: event.target.value })}
            data-testid={`input-cargo-periodo-${index}`}
          />
          <button
            type="button"
            className="k-button k-button-quiet k-icon-button k-coral"
            onClick={() => remove(index)}
            disabled={cargos.length === 1}
            aria-label={`Remover cargo ${index + 1}`}
            data-testid={`button-remover-cargo-${index}`}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="k-button k-button-quiet text-[11px]" onClick={add} data-testid="button-adicionar-cargo">
        <Plus size={14} /> Adicionar cargo
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Usar na tela**

Em `NovoWorkspace.tsx`, dentro da seção "Informações Gerais", abaixo da grade de campos existente, acrescentar um bloco com o mesmo padrão de rótulo da seção:

```tsx
<div className="mt-5 space-y-2">
  <label className="text-[11px] font-medium uppercase tracking-wider text-[#6f7b85] dark:text-[#8e98a8]">
    Cargos
  </label>
  <CargoFields cargos={cargos} onChange={setCargos} />
</div>
```

E o estado, junto dos outros `useState` do componente:

```tsx
const [cargos, setCargos] = useState<Cargo[]>([{ id: 'c1', name: '', examDate: '', period: '' }]);
```

O `handleSubmit` passa a gravar `cargos` (filtrando os sem nome) e `selectedCargoId: cargos[0].id`, em vez do `[{ id: 'c1', name: 'Cargo Único', examDate }]` fixo de hoje.

- [ ] **Step 3: Verificar**

```bash
pnpm run typecheck
pnpm run test
```

Esperado: o snapshot de `/portal/novo-workspace` **muda** — era exatamente o objetivo. Inspecione o diff: deve conter só a nova seção de cargos, com as classes listadas acima. Se qualquer outra parte da tela mudar, é bug. Descreva o diff no relatório e então atualize:

```bash
pnpm --filter @workspace/kalibra run test -- -u
pnpm --filter @workspace/kalibra run test
```

Esperado na segunda rodada: 0 snapshots escritos.

- [ ] **Step 4: Commit**

```bash
git add artifacts/kalibra/src/components/CargoFields.tsx artifacts/kalibra/src/pages/NovoWorkspace.tsx artifacts/kalibra/src/__tests__
git commit -m "feat: aceitar multiplos cargos na criacao de workspace"
```

---

### Task 9: Disponibilidade semanal em Novo Workspace

**Files:**
- Create: `artifacts/kalibra/src/components/AvailabilityFields.tsx`
- Modify: `artifacts/kalibra/src/pages/NovoWorkspace.tsx`

**Interfaces:**
- Consumes: `WeeklyAvailability`, `Weekday`, `WEEKDAY_LABELS`, `minutesFor`, `totalWeeklyMinutes` de `@workspace/core`
- Produces: `export function AvailabilityFields(props: { value: WeeklyAvailability; onChange: (value: WeeklyAvailability) => void }): JSX.Element`

**Padrões visuais a reutilizar:** `k-option` por dia, `k-input` para minutos, `k-eyebrow` para o rótulo do dia, `k-mono` para o total.

- [ ] **Step 1: Criar o componente**

`artifacts/kalibra/src/components/AvailabilityFields.tsx`:

```tsx
import {
  WEEKDAY_LABELS, minutesFor, totalWeeklyMinutes,
  type Weekday, type WeeklyAvailability,
} from '@workspace/core';

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export function AvailabilityFields({ value, onChange }: { value: WeeklyAvailability; onChange: (value: WeeklyAvailability) => void }) {
  const setMinutes = (weekday: Weekday, minutes: number) =>
    onChange({
      ...value,
      days: WEEKDAYS.map((day) => ({ weekday: day, minutes: day === weekday ? minutes : minutesFor(value, day) })),
    });

  const total = totalWeeklyMinutes(value);

  return (
    <div className="space-y-3" data-testid="fields-disponibilidade">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="k-option p-3">
            <p className="k-eyebrow mb-2">{WEEKDAY_LABELS[weekday]}</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={15}
                className="k-input"
                value={minutesFor(value, weekday)}
                onChange={(event) => setMinutes(weekday, Number(event.target.value) || 0)}
                data-testid={`input-disponibilidade-${weekday}`}
              />
              <span className="k-mono text-[10px] k-muted">min</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 border-t border-[#d5dede] pt-3 dark:border-[#242a34] sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-[11px] k-muted">
          Sessão máxima
          <input
            type="number"
            min={5}
            step={5}
            className="k-input w-[90px]"
            value={value.maxSessionMinutes}
            onChange={(event) => onChange({ ...value, maxSessionMinutes: Number(event.target.value) || 0 })}
            data-testid="input-sessao-maxima"
          />
          <span className="k-mono text-[10px]">min</span>
        </label>
        <span className="k-mono text-[11px] k-muted">
          total semanal <span className="k-focus">{Math.floor(total / 60)}h {String(total % 60).padStart(2, '0')}</span>
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Usar na tela**

Em `NovoWorkspace.tsx`, acrescentar uma terceira seção, com o mesmo cabeçalho numerado das duas existentes (o `<span>` com o círculo e o número):

```tsx
<section className={`p-6 md:p-8 rounded-[4px] border ${theme === 'dark' ? 'bg-[#131821] border-[#29313d]' : 'bg-white border-[#d5dede]'}`}>
  <h2 className="text-[15px] font-semibold mb-6 flex items-center gap-2">
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e5eed5] dark:bg-[#202b20] text-[#5f7900] dark:text-[#d5f35b] text-[10px] font-bold">3</span>
    Disponibilidade semanal
  </h2>
  <AvailabilityFields value={availability} onChange={setAvailability} />
</section>
```

E o estado: `const [availability, setAvailability] = useState(emptyAvailability());`

O `handleSubmit` grava `availability` no workspace criado.

- [ ] **Step 3: Verificar**

```bash
pnpm run typecheck
pnpm run test
```

Snapshot de `/portal/novo-workspace` muda de novo — esperado. Mesma disciplina: inspecione, descreva, depois `-u`, depois confirme 0 escritos.

- [ ] **Step 4: Commit**

```bash
git add artifacts/kalibra/src/components/AvailabilityFields.tsx artifacts/kalibra/src/pages/NovoWorkspace.tsx artifacts/kalibra/src/__tests__
git commit -m "feat: coletar disponibilidade semanal na criacao de workspace"
```

---

### Task 10: Edital opcional e limite de 20 MB

**Files:**
- Modify: `artifacts/kalibra/src/pages/NovoWorkspace.tsx`

**Interfaces:**
- Consumes: `canTransition`, `nextActionFor`, `uniqueSlug` de `@workspace/core`
- Produces: nenhuma nova; muda o comportamento do formulário

> Esta é a task que substitui a geração de slug inline por `uniqueSlug` da Task 4 — ver Step 2 abaixo.

- [ ] **Step 1: Acrescentar a terceira aba de origem**

O seletor de origem hoje tem duas opções (`Anexar Arquivo` / `Colar Texto`), no bloco com `flex gap-1 p-1 rounded-[4px] bg-[#f1f4f2] dark:bg-[#0b0e13]`. Acrescentar uma terceira, **com exatamente as mesmas classes das duas existentes**, rotulada `Ainda não tenho`. O estado `sourceMode` passa a aceitar `'file' | 'text' | 'none'`.

Quando `sourceMode === 'none'`, no lugar da área de upload, mostrar um bloco no padrão de aviso já usado na tela (`k-card-soft p-4` com ícone e texto `text-[12px] leading-5 k-muted`) explicando que o workspace será criado com status "sem edital" e que o edital pode ser importado depois pela tela Edital.

- [ ] **Step 2: Ajustar a validação**

Em `handleSubmit`, a checagem que hoje exige arquivo ou texto passa a exigir só quando `sourceMode !== 'none'`. Os campos obrigatórios continuam sendo título, instituição e data.

**Trocar também a geração de slug.** O bloco atual de `handleSubmit` que monta `baseSlug` com `.normalize('NFD')...` e sufixa com `Date.now().toString().slice(-6)` sai inteiro, substituído por:

```ts
const slug = uniqueSlug(title, workspaces.map((workspace) => workspace.slug));
```

O workspace criado recebe:
- `status: sourceMode === 'none' ? 'sem_edital' : 'aguardando_revisao_edital'`
- `hasEdital: sourceMode !== 'none'`
- `nextAction: nextActionFor(status)`

E quando `sourceMode === 'none'`, o fluxo **não** vai para `EditalUploadProgress` nem para `/edital/revisar/1`: cria o workspace e navega direto para `/workspace/<slug>`.

- [ ] **Step 3: Elevar o limite de arquivo para 20 MB**

Em `handleFileChange`, trocar `5 * 1024 * 1024` por `20 * 1024 * 1024` e a mensagem `'O arquivo deve ter no máximo 5 MB.'` por `'O arquivo deve ter no máximo 20 MB.'`.

Na área de arraste, trocar o texto `Aceita PDF, DOCX ou TXT (Max 5MB)` por `Aceita PDF, DOCX ou TXT (Max 20MB)`.

```bash
cd "C:/Users/User/Documents/Kalibra"
grep -rn "5 MB\|5MB\|5 \* 1024" artifacts/kalibra/src/
```

Esperado depois da mudança: nenhuma ocorrência.

- [ ] **Step 4: Verificar**

```bash
pnpm run typecheck
pnpm run test
```

Snapshot de `/portal/novo-workspace` muda (terceira aba e texto do limite). Inspecione, descreva, atualize, confirme 0 escritos.

- [ ] **Step 5: Commit**

```bash
git add artifacts/kalibra/src/pages/NovoWorkspace.tsx artifacts/kalibra/src/__tests__
git commit -m "feat: permitir criar workspace sem edital e aceitar ate 20 MB"
```

---

### Task 11: Card do Portal com status, contagem regressiva e ações

**Files:**
- Create: `artifacts/kalibra/src/components/WorkspaceStatusChip.tsx`
- Modify: `artifacts/kalibra/src/pages/Portal.tsx`

**Interfaces:**
- Consumes: `WorkspaceStatus`, `WORKSPACE_STATUS_LABELS`, `effectiveExamDate`, `daysUntil` de `@workspace/core`
- Produces: `export function WorkspaceStatusChip(props: { status: WorkspaceStatus }): JSX.Element`

**Padrões visuais:** `k-chip` neutro para estados de espera, `k-chip-active` para `estudando`, e `k-chip` com `border-[#db8f83] text-[#c94f45] dark:border-[#ff907d] dark:text-[#ff907d]` para `erro` — os mesmos três tratamentos que a tela `Erros` já usa para severidade.

- [ ] **Step 1: Criar o chip**

`artifacts/kalibra/src/components/WorkspaceStatusChip.tsx`:

```tsx
import { WORKSPACE_STATUS_LABELS, type WorkspaceStatus } from '@workspace/core';

export function WorkspaceStatusChip({ status }: { status: WorkspaceStatus }) {
  const tone =
    status === 'estudando' ? 'k-chip-active' :
    status === 'erro' ? 'border-[#db8f83] text-[#c94f45] dark:border-[#ff907d] dark:text-[#ff907d]' :
    '';

  return (
    <span className={`k-chip ${tone}`} data-testid={`chip-status-${status}`}>
      {WORKSPACE_STATUS_LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 2: Mostrar status e contagem regressiva no card**

No card do Portal, na linha que hoje mostra `{program.institution} · Prova: {program.examDate}`, trocar por instituição, data efetiva do cargo selecionado e a contagem regressiva:

```tsx
<p className={`text-[12px] ${theme === 'dark' ? 'text-[#8e98a8]' : 'text-[#6f7b85]'}`}>
  {program.institution} · Prova: {effectiveExamDate(program.cargos, program.selectedCargoId, program.examDate)}
  {dias !== null && <span className="k-mono k-focus ml-2">D−{dias}</span>}
</p>
```

com `const dias = daysUntil(effectiveExamDate(program.cargos, program.selectedCargoId, program.examDate), new Date());`

E acrescentar `<WorkspaceStatusChip status={program.status} />` ao lado do chip de tipo que já existe no topo do card.

Quando o workspace tiver mais de um cargo, mostrar o nome do cargo selecionado numa linha `text-[11px] k-muted` abaixo do título — o mesmo tratamento que a sidebar já dá.

- [ ] **Step 3: Fazer o menu de três pontos funcionar**

O botão `MoreHorizontal` hoje só faz `e.preventDefault()`. Transformá-lo num menu com o mesmo padrão do menu de tópico em `EditalRevisar.tsx` (`absolute right-2 top-8 z-10 flex w-36 flex-col border ... p-1 shadow-lg`), com três ações: `Abrir`, `Renomear` e `Arquivar`. `Renomear` usa `window.prompt` e grava via `updateWorkspace`; `Arquivar` alterna `active`.

- [ ] **Step 4: Usar o próximo passo vindo do status**

O bloco "Próximo passo" hoje lê `program.nextAction`, que é texto livre gravado na criação. Passar a derivá-lo do status com `nextActionFor(program.status)`, mantendo `program.nextAction` como sobrescrita quando não estiver vazio.

- [ ] **Step 5: Verificar**

```bash
pnpm run typecheck
pnpm run test
pnpm run build
```

Snapshots de `/portal` e `/` mudam (são a mesma tela). **Atenção:** a contagem regressiva usa `new Date()`, o que torna o snapshot não-determinístico. Acrescentar ao mock de data já existente em `src/__tests__/screens.snapshot.test.tsx` um congelamento do relógio:

```ts
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-09-13T12:00:00Z'));
```

dentro do `beforeEach`, com `vi.useRealTimers()` num `afterAll`. Sem isso, os snapshots quebram todo dia.

- [ ] **Step 6: Commit**

```bash
git add artifacts/kalibra/src/components/WorkspaceStatusChip.tsx artifacts/kalibra/src/pages/Portal.tsx artifacts/kalibra/src/__tests__
git commit -m "feat: mostrar status, contagem regressiva e acoes no card do portal"
```

---

### Task 12: Verificação final da Fase 1A

**Files:**
- Create: `docs/superpowers/plans/2026-09-13-kalibra-fase-1a-verificacao.md`

**Interfaces:**
- Consumes: resultado das Tasks 1–11
- Produces: registro consumido pelo plano da Fase 1B

- [ ] **Step 1: Rodar o portão completo**

```bash
cd "C:/Users/User/Documents/Kalibra"
pnpm run typecheck
pnpm run test
pnpm run build
```

Esperado: os três passam. A suíte agora tem duas execuções — `lib/core` e `artifacts/kalibra` — e 0 snapshots escritos.

- [ ] **Step 2: Confirmar que as restrições seguem valendo**

```bash
grep -rn "localStorage\|sessionStorage\|fetch(" artifacts/kalibra/src/pages artifacts/kalibra/src/components --include=*.tsx | grep -v "components/ui/" || echo "nenhuma tela toca persistencia"
grep -rn "5 MB\|5MB" artifacts/kalibra/src/ || echo "limite de 5 MB eliminado"
grep -rn "from 'ts-fsrs'\|from \"ts-fsrs\"" artifacts/kalibra/src/ || echo "frontend nao importa ts-fsrs direto"
```

Esperado: as três mensagens de confirmação.

- [ ] **Step 3: Conferência visual manual nos dois temas**

```bash
cd artifacts/kalibra
pnpm run dev
```

Percorrer, em dark e em claro: Portal (card com status, D−, cargo e menu), Novo workspace (as três seções, incluindo multi-cargo, disponibilidade e a aba "Ainda não tenho"), e a criação completa de um workspace sem edital.

Requer `VITE_CLERK_PUBLISHABLE_KEY`. Se a chave não estiver disponível, **registrar isso explicitamente** em vez de omitir, listando o que ficou sem cobertura.

- [ ] **Step 4: Escrever o registro**

Criar `docs/superpowers/plans/2026-09-13-kalibra-fase-1a-verificacao.md` com: contagem de testes por pacote, saída dos três comandos do portão, saída dos três greps do Step 2, o que foi conferido no navegador e em quais temas, todo snapshot que mudou e por quê, e qualquer desvio encontrado.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-09-13-kalibra-fase-1a-verificacao.md
git commit -m "docs: registrar verificacao final da fase 1a"
```

---

## Estado ao fim da Fase 1A

- Pacote `@workspace/core` com regras puras e testes próprios, importável pelo frontend hoje e pelo servidor na Fase 2
- Estados de workspace, disponibilidade semanal, slug, datas por cargo e FSRS — todos testados, nenhum tocando I/O
- Workspace com múltiplos cargos, disponibilidade semanal e edital opcional
- Card do Portal mostrando status real, contagem regressiva do cargo selecionado e menu de ações funcional
- Limite de upload em 20 MB, conforme o spec
- Migração automática dos workspaces salvos no formato antigo

**Próximo plano:** Fase 1B — importação e revisão de edital, mais a fila de aprovações como infraestrutura transversal.
