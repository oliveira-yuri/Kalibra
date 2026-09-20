import { pgTable, uuid, text, integer, real, boolean, unique, foreignKey } from 'drizzle-orm/pg-core';
import { workspace } from './workspace';
import { concept } from './concept';

/**
 * Um item do programa de estudo deste workspace, apontando para um `concept`
 * global. A espinha do domínio é `concept → syllabus_item → syllabus_item_cargo`.
 *
 * `source_label` preserva o nome literal como veio no edital, para rastreabilidade:
 * o conceito pode ter nome canônico diferente, e o diff do PD-08 compara rótulo.
 *
 * A FK de `parent_item_id` é composta com `workspace_id` pelo mesmo motivo da
 * hierarquia de conceitos: uma FK simples deixaria um item do workspace A ter pai
 * no workspace B.
 */
export const syllabusItem = pgTable('syllabus_item', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id, { onDelete: 'cascade' }),
  conceptId: uuid('concept_id').notNull().references(() => concept.id),
  parentItemId: uuid('parent_item_id'),
  sourceLabel: text('source_label').notNull(),
  sourceExcerpt: text('source_excerpt'),
  page: integer('page'),
  confidence: real('confidence').notNull().default(1),
  uncertain: boolean('uncertain').notNull().default(false),
}, (t) => [
  unique('syllabus_item_workspace_id').on(t.workspaceId, t.id),
  foreignKey({
    columns: [t.workspaceId, t.parentItemId],
    foreignColumns: [t.workspaceId, t.id],
    name: 'syllabus_item_pai_do_mesmo_workspace',
  }),
]);
