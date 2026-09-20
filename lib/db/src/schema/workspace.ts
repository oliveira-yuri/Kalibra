import { pgTable, uuid, text, boolean, integer, date, jsonb, timestamp, unique } from 'drizzle-orm/pg-core';
import type { WeeklyAvailability } from '@workspace/core';
import { appUser } from './app-user';
import { workspaceStatusEnum } from './enums';

/**
 * Um concurso, prova ou objetivo de estudo.
 *
 * `slug` é único **por usuário**, não globalmente: dois usuários podem ter
 * `setec-campinas`; um usuário não pode ter dois. A URL continua usando slug, e a
 * rota localiza por `slug + user_id`.
 *
 * `unique(user_id, id)` é redundante com a PK, e é de propósito: é o alvo das FKs
 * compostas de `approval_item`, que precisam provar "este workspace pertence a este
 * usuário" dentro do próprio banco.
 *
 * Três campos do formato antigo NÃO existem aqui, por serem segunda representação
 * de um fato que já está no `status` (§2.8): `next_action` (função pura do status,
 * computada pela API), `import_status` (mapeado de/para status) e `progress` (nada
 * o lia; volta quando houver dado real de estudo para computá-lo).
 */
export const workspace = pgTable('workspace', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  institution: text('institution').notNull().default(''),
  /** Texto livre ("Concurso Público"), não enumeração — por isso não é `pgEnum`. */
  type: text('type').notNull().default('Concurso Público'),
  examDate: date('exam_date'),
  /** `{days:[{weekday,minutes}], maxSessionMinutes}` — sem FK, sempre lida inteira, já validada por `lib/core`. */
  availability: jsonb('availability').$type<WeeklyAvailability>().notNull(),
  status: workspaceStatusEnum('status').notNull(),
  /**
   * Texto e não enum: os valores de `SourceMode` vivem hoje em
   * `artifacts/kalibra/src/domain/ports`, e `lib/db` não pode importar da aplicação
   * — seria inverter a dependência. Movê-los para `lib/core` é o conserto certo e
   * pertence à fase que migra o módulo de workspaces, onde o contrato da API
   * precisa deles de qualquer forma.
   */
  sourceMode: text('source_mode').notNull().default('text'),
  sourceFileName: text('source_file_name'),
  active: boolean('active').notNull().default(true),
  /** `If-Match` das operações destrutivas de documento inteiro. Por workspace, não por documento. */
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('workspace_slug_por_usuario').on(t.userId, t.slug),
  unique('workspace_usuario_id').on(t.userId, t.id),
]);
