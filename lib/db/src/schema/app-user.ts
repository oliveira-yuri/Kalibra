import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * A referência ao usuário do Clerk, e nada além disso.
 *
 * O Clerk continua dono da identidade: nome, e-mail, foto, sessões, tudo vive lá.
 * O Postgres guarda só o necessário para chave estrangeira e posse — sem isso,
 * `user_id` seria uma string solta em cada tabela, sem nada garantindo que aponta
 * para alguém que existe.
 *
 * `email` e `name` são anuláveis e existem apenas por conveniência de leitura; não
 * são fonte da verdade e não precisam acompanhar mudanças no Clerk.
 *
 * `ensureAppUser` (Fase 3) faz `upsert` sobre `clerk_user_id` na primeira
 * requisição autenticada que precise persistir algo. A unicidade abaixo é o que
 * torna a idempotência real sob escrita concorrente: duas requisições simultâneas
 * do mesmo usuário produzem uma linha, garantido pelo banco e não pela ordem de
 * execução.
 */
export const appUser = pgTable('app_user', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  email: text('email'),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
