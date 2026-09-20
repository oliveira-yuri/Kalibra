import { pgTable, uuid, timestamp, unique, foreignKey } from 'drizzle-orm/pg-core';
import { appUser } from '../app-user';
import { workspace } from '../workspace';

/**
 * PREPARATÓRIA — nenhum código de aplicação a usa nesta fase.
 *
 * Uma aplicação de prova: o diagnóstico inicial ou um simulado. `kind`,
 * `blueprint`, `duration_s`, `status` e a aritmética do cronômetro
 * (`started_at + accumulated_pause_s` contra o relógio do servidor) entram na fase
 * que implementa o diagnóstico — são regra de negócio, e o formato ainda pode
 * mudar quando essa fase for desenhada.
 */
export const exam = pgTable('exam', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('exam_usuario_id').on(t.userId, t.id),
  foreignKey({
    columns: [t.userId, t.workspaceId],
    foreignColumns: [workspace.userId, workspace.id],
    name: 'exam_workspace_do_mesmo_usuario',
  }).onDelete('cascade'),
]);
