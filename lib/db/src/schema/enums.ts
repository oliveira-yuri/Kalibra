import { pgEnum } from 'drizzle-orm/pg-core';
import {
  WORKSPACE_STATUSES,
  CONCEPT_STATUSES,
  CONCEPT_KINDS,
  APPROVAL_TYPES,
  APPROVAL_STATUSES,
} from '@workspace/core';

/**
 * Os cinco enums do banco, com os valores vindos de `lib/core` — a fonte única de
 * regra de domínio.
 *
 * Derivar em vez de repetir torna a deriva **estruturalmente impossível**: não há
 * uma segunda lista para alguém esquecer de atualizar. Acrescentar um status em
 * `lib/core` acrescenta aqui no mesmo commit.
 *
 * O teste anti-deriva (`enums.test.ts`) continua existindo e não é redundante: ele
 * verifica o que ESTÁ NO BANCO contra `lib/core`, e pega o caso que a derivação não
 * pega — alguém muda `lib/core` e esquece de rodar `drizzle-kit generate`, deixando
 * a migration para trás do código.
 *
 * `workspace.type` NÃO está aqui: guarda "Concurso Público", texto livre, não uma
 * enumeração fechada.
 */

/**
 * `pgEnum` exige uma tupla não-vazia; `lib/core` expõe `readonly T[]`, que é a
 * forma certa para o domínio. O cast afirma só o que o `Record` de origem já
 * garante: a lista não é vazia.
 */
const comoTupla = <T extends string>(valores: readonly T[]) => valores as unknown as [T, ...T[]];

export const workspaceStatusEnum = pgEnum('workspace_status', comoTupla(WORKSPACE_STATUSES));
export const conceptStatusEnum = pgEnum('concept_status', comoTupla(CONCEPT_STATUSES));
export const conceptKindEnum = pgEnum('concept_kind', comoTupla(CONCEPT_KINDS));
export const approvalTypeEnum = pgEnum('approval_type', comoTupla(APPROVAL_TYPES));
export const approvalStatusEnum = pgEnum('approval_status', comoTupla(APPROVAL_STATUSES));
