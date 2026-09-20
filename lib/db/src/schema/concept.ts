import { pgTable, uuid, text, timestamp, unique, foreignKey } from 'drizzle-orm/pg-core';
import { appUser } from './app-user';
import { conceptStatusEnum, conceptKindEnum } from './enums';

/**
 * A biblioteca de conceitos — **global por usuário**, sem `workspace_id`.
 *
 * É o que permite reaproveitar conhecimento entre concursos: "Crase" estudada no
 * concurso A é o mesmo conceito no concurso B, com o mesmo histórico e o mesmo
 * estado de revisão. Por isso apagar um workspace NÃO apaga conceito nenhum.
 *
 * `unique(user_id, slug)` torna impossível o conceito duplicado que o adaptador
 * local hoje tolera (o provisório órfão que uma fusão aprovada deixa para trás).
 * Não é o schema sendo rígido: é o schema encontrando um defeito que o
 * `localStorage` aceitava. A correção é endurecer o local, não afrouxar o banco.
 *
 * A FK de `parent_id` é composta com `user_id`: uma FK simples não impediria um
 * conceito do usuário 1 apontar para pai do usuário 2. Conceito-raiz (`parent_id`
 * nulo) passa sem verificação, por `MATCH SIMPLE`.
 */
export const concept = pgTable('concept', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }),
  canonicalName: text('canonical_name').notNull(),
  slug: text('slug').notNull(),
  parentId: uuid('parent_id'),
  kind: conceptKindEnum('kind').notNull(),
  aliases: text('aliases').array().notNull().default([]),
  status: conceptStatusEnum('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('concept_slug_por_usuario').on(t.userId, t.slug),
  unique('concept_usuario_id').on(t.userId, t.id),
  foreignKey({
    columns: [t.userId, t.parentId],
    foreignColumns: [t.userId, t.id],
    name: 'concept_pai_do_mesmo_usuario',
  }),
]);
