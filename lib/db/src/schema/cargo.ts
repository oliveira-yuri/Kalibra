import { pgTable, uuid, text, boolean, integer, date, primaryKey, uniqueIndex } from 'drizzle-orm/pg-core';
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
  /**
   * **Identidade LOCAL ao workspace, e escolhida por quem cria.**
   *
   * Era `uuid` com valor gerado pelo banco. A Fase 5 mostrou por que não podia
   * ser: `syllabus_item_cargo` guarda `cargo_id`, e o módulo de syllabus migra
   * só na Fase 8. Enquanto ele for local, as ligações que ele grava precisam
   * casar com o cargo que a API conhece — e não casariam se o servidor trocasse
   * o id por um UUID próprio na criação.
   *
   * O id do cargo, portanto, é **identidade de domínio compartilhada** entre os
   * módulos, não detalhe privado desta tabela. `text` porque o domínio usa
   * rótulos curtos (`c1`, `c2`) desde antes de existir banco.
   */
  id: text('id').notNull(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  examDate: date('exam_date'),
  period: text('period'),
  position: integer('position').notNull().default(0),
  isSelected: boolean('is_selected').notNull().default(false),
}, (t) => [
  /**
   * A chave é o PAR, não o id sozinho.
   *
   * Dois workspaces podem — e na prática sempre vão — ter um cargo `c1`: é o
   * rótulo que o domínio usa para "o primeiro cargo deste edital". Uma PK só
   * sobre `id` tornaria o segundo workspace impossível de criar.
   *
   * Continua sendo o alvo das FKs compostas de `edital_source_block` e
   * `syllabus_item_cargo`, que já apontavam para este par.
   */
  primaryKey({ columns: [t.workspaceId, t.id] }),
  uniqueIndex('cargo_um_selecionado_por_workspace').on(t.workspaceId).where(sql`${t.isSelected}`),
]);
