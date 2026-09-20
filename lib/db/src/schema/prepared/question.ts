import { pgTable, uuid, timestamp, unique, foreignKey } from 'drizzle-orm/pg-core';
import { appUser } from '../app-user';
import { workspace } from '../workspace';
import { concept } from '../concept';

/**
 * PREPARATÓRIA — nenhum código de aplicação a usa nesta fase.
 *
 * Só o esqueleto: identidade, as chaves estrangeiras de escopo e timestamps. As
 * colunas de conteúdo (`stem`, `options`, `correct`, `explanation`, `origin`,
 * `difficulty_est`, `approval_status`…) entram na fase que implementa o
 * diagnóstico, junto com os enums e checks que as governam.
 *
 * Por que preparar só isto: acrescentar coluna é migração aditiva e barata.
 * Acrescentar ou corrigir FK de escopo depois, com dados dentro, não é — e a
 * espinha de posse é justamente o que o §2.3 exige que o banco prove. Deixar essa
 * parte para depois seria adiar o caro e antecipar o barato.
 *
 * As FKs são compostas pelo mesmo princípio das tabelas da fase: uma FK simples
 * deixaria uma questão do usuário A apontar para conceito do usuário B.
 */
export const question = pgTable('question', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }),
  /** Nulo = questão global por banca, reutilizável entre workspaces do mesmo concurso. */
  workspaceId: uuid('workspace_id'),
  conceptId: uuid('concept_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('question_usuario_id').on(t.userId, t.id),
  foreignKey({
    columns: [t.userId, t.workspaceId],
    foreignColumns: [workspace.userId, workspace.id],
    name: 'question_workspace_do_mesmo_usuario',
  }).onDelete('cascade'),
  foreignKey({
    columns: [t.userId, t.conceptId],
    foreignColumns: [concept.userId, concept.id],
    name: 'question_conceito_do_mesmo_usuario',
  }),
]);
