import { pgTable, uuid, text, integer, foreignKey } from 'drizzle-orm/pg-core';
import { workspace } from './workspace';
import { cargo } from './cargo';

/**
 * Os blocos de texto do edital, por cargo. `cargo_id` nulo = conteúdo comum a
 * todos os cargos — a forma como os editais são publicados.
 *
 * É tabela e não `jsonb` dentro de `workspace` exatamente por causa da FK composta
 * abaixo: bloco órfão de cargo apagado deixa de ser possível. Isso foi o achado I3
 * da Fase 1B.5, hoje resolvido por poda no código de tela — o banco faz de graça e
 * sem esquecer.
 *
 * A FK é composta `(workspace_id, cargo_id)` e não simples `cargo_id`: uma FK
 * simples não impediria um bloco do workspace A apontar para um cargo do workspace
 * B. Com `cargo_id` nulo a restrição não é verificada (`MATCH SIMPLE`), que é
 * exatamente o desejado para o bloco comum.
 */
export const editalSourceBlock = pgTable('edital_source_block', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id, { onDelete: 'cascade' }),
  cargoId: uuid('cargo_id'),
  text: text('text').notNull(),
  position: integer('position').notNull().default(0),
}, (t) => [
  foreignKey({
    columns: [t.workspaceId, t.cargoId],
    foreignColumns: [cargo.workspaceId, cargo.id],
    name: 'bloco_cargo_do_mesmo_workspace',
  }).onDelete('cascade'),
]);
