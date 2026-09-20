import { pgTable, uuid, timestamp, foreignKey } from 'drizzle-orm/pg-core';
import { appUser } from '../app-user';
import { workspace } from '../workspace';
import { exam } from './exam';

/**
 * PREPARATÓRIA — nenhum código de aplicação a usa nesta fase.
 *
 * O resultado consolidado de um diagnóstico: o que vira evidência para o plano
 * quinzenal. As colunas de conteúdo — acerto por matéria, cobertura, os sinais que
 * alimentam `plan_item.rationale` — entram na fase que implementa o diagnóstico.
 *
 * O spec do produto não define esta tabela com o mesmo detalhe de `exam` e
 * `question`; ela é a que tem mais chance de mudar de forma. Razão a mais para
 * preparar só a espinha de posse e nada de conteúdo.
 */
export const diagnosticResult = pgTable('diagnostic_result', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').notNull(),
  examId: uuid('exam_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({
    columns: [t.userId, t.workspaceId],
    foreignColumns: [workspace.userId, workspace.id],
    name: 'diagnostico_workspace_do_mesmo_usuario',
  }).onDelete('cascade'),
  foreignKey({
    columns: [t.userId, t.examId],
    foreignColumns: [exam.userId, exam.id],
    name: 'diagnostico_exam_do_mesmo_usuario',
  }).onDelete('cascade'),
]);
