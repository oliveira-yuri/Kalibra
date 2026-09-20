import { pgTable, uuid, timestamp, foreignKey } from 'drizzle-orm/pg-core';
import { appUser } from '../app-user';
import { question } from './question';
import { exam } from './exam';

/**
 * PREPARATÓRIA — nenhum código de aplicação a usa nesta fase.
 *
 * Quais questões compõem uma prova. `position` e `flagged` entram com a fase que
 * implementa a aplicação da prova.
 *
 * **Deliberadamente SEM `unique(exam_id, question_id)`.** Parece óbvio que uma
 * questão não se repete numa prova — mas "óbvio" é exatamente a forma que uma
 * regra de negócio prematura tem. Se um formato futuro precisar repetir um item
 * (reaplicação dentro do mesmo exame, por exemplo), a unicidade teria de ser
 * removida com dados dentro. A chave surrogate não fecha nenhuma porta; a fase que
 * implementar o diagnóstico decide.
 */
export const examQuestion = pgTable('exam_question', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }),
  examId: uuid('exam_id').notNull(),
  questionId: uuid('question_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({
    columns: [t.userId, t.examId],
    foreignColumns: [exam.userId, exam.id],
    name: 'exam_question_exam_do_mesmo_usuario',
  }).onDelete('cascade'),
  foreignKey({
    columns: [t.userId, t.questionId],
    foreignColumns: [question.userId, question.id],
    name: 'exam_question_questao_do_mesmo_usuario',
  }).onDelete('cascade'),
]);
