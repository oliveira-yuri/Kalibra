import { pgTable, uuid, real, integer, primaryKey, foreignKey } from 'drizzle-orm/pg-core';
import { workspace } from './workspace';
import { cargo } from './cargo';
import { syllabusItem } from './syllabus-item';

/**
 * A ligação N:N entre item e cargo. **A deduplicação é a cardinalidade desta
 * tabela**: duas linhas para o mesmo item significam conteúdo comum aos dois
 * cargos — uma entidade, não duas cópias. É isso que mantém nota, histórico e FSRS
 * inteiros quando o mesmo tópico é cobrado em dois cargos.
 *
 * Peso e quantidade de questões ficam aqui, não no item, porque o mesmo conteúdo
 * pode valer 25% num cargo e 30% no outro.
 *
 * `workspace_id` é redundante com o que `syllabus_item` e `cargo` já sabem, e é de
 * propósito: é o que permite as duas FKs compostas abaixo. Sem ele, duas FKs
 * simples deixariam ligar um item do workspace A a um cargo do workspace B.
 */
export const syllabusItemCargo = pgTable('syllabus_item_cargo', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id, { onDelete: 'cascade' }),
  syllabusItemId: uuid('syllabus_item_id').notNull(),
  cargoId: uuid('cargo_id').notNull(),
  weight: real('weight'),
  questionCount: integer('question_count'),
}, (t) => [
  primaryKey({ columns: [t.workspaceId, t.syllabusItemId, t.cargoId] }),
  foreignKey({
    columns: [t.workspaceId, t.syllabusItemId],
    foreignColumns: [syllabusItem.workspaceId, syllabusItem.id],
    name: 'ligacao_item_do_mesmo_workspace',
  }).onDelete('cascade'),
  foreignKey({
    columns: [t.workspaceId, t.cargoId],
    foreignColumns: [cargo.workspaceId, cargo.id],
    name: 'ligacao_cargo_do_mesmo_workspace',
  }).onDelete('cascade'),
]);
