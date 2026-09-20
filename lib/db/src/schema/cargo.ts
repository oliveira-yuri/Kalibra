import { pgTable, uuid, text, boolean, integer, date, unique, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workspace } from './workspace';

/**
 * Um cargo do concurso. O mesmo edital pode ter vários, e é a ligação N:N com
 * `syllabus_item` que guarda peso e quantidade de questões — porque o mesmo
 * conteúdo vale diferente para cargos diferentes.
 *
 * **A seleção é propriedade do cargo, não do workspace.** Um `selected_cargo_id` em
 * `workspace` criaria dependência circular (`cargo.workspace_id → workspace.id` e
 * de volta), forçando FK *deferrable* ou `ON DELETE SET NULL` sobre FK composta —
 * inválido em coluna `NOT NULL` e dependente da versão do Postgres.
 *
 * Com o índice único parcial abaixo não há ciclo, apagar o cargo selecionado remove
 * a seleção por cascata, e "no máximo um selecionado por workspace" passa a ser
 * garantido pelo banco. O contrato da API não muda: continua expondo
 * `selectedCargoId`, agora derivado.
 */
export const cargo = pgTable('cargo', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  examDate: date('exam_date'),
  period: text('period'),
  position: integer('position').notNull().default(0),
  isSelected: boolean('is_selected').notNull().default(false),
}, (t) => [
  unique('cargo_workspace_id').on(t.workspaceId, t.id),
  uniqueIndex('cargo_um_selecionado_por_workspace').on(t.workspaceId).where(sql`${t.isSelected}`),
]);
