import { pgTable, uuid, timestamp, foreignKey } from 'drizzle-orm/pg-core';
import { appUser } from '../app-user';
import { workspace } from '../workspace';
import { question } from './question';
import { exam } from './exam';

/**
 * PREPARATÓRIA — nenhum código de aplicação a usa nesta fase.
 *
 * Uma resposta a uma questão. `selected`, `correct`, `confidence`, `elapsed_ms` e
 * `answered_at` entram na fase que implementa a prática — inclusive a política de
 * confiança, que é obrigatória em diagnóstico e simulado, configurável em treino
 * rápido e ausente na revisão ativa. Isso é regra de produto, não forma.
 */
export const questionAttempt = pgTable('question_attempt', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull(),
  workspaceId: uuid('workspace_id'),
  examId: uuid('exam_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({
    columns: [t.userId, t.questionId],
    foreignColumns: [question.userId, question.id],
    name: 'tentativa_questao_do_mesmo_usuario',
  }).onDelete('cascade'),
  foreignKey({
    columns: [t.userId, t.workspaceId],
    foreignColumns: [workspace.userId, workspace.id],
    name: 'tentativa_workspace_do_mesmo_usuario',
  }).onDelete('cascade'),
  foreignKey({
    columns: [t.userId, t.examId],
    foreignColumns: [exam.userId, exam.id],
    name: 'tentativa_exam_do_mesmo_usuario',
  }).onDelete('cascade'),
]);
