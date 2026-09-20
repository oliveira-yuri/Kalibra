import { pgTable, uuid, text, real, jsonb, timestamp, foreignKey } from 'drizzle-orm/pg-core';
import { appUser } from './app-user';
import { workspace } from './workspace';
import { concept } from './concept';
import { approvalTypeEnum, approvalStatusEnum } from './enums';

/**
 * A fila de aprovação: nada que a extração propõe vira estrutura oficial sem
 * decisão humana.
 *
 * `source_ref` é **proveniência** — de onde a proposta veio. `target_concept_id` é
 * **o que a decisão muta**. São campos diferentes de propósito: confundi-los fez
 * `confirmConcept` receber um id que não batia com nada, e a aprovação "aplicar" em
 * silêncio, sem efeito nenhum.
 *
 * `payload_before`/`payload_after` ficam em `jsonb` porque são instantâneos opacos
 * por natureza — o banco não precisa entender a forma deles.
 *
 * As duas FKs compostas garantem que conceito-alvo e workspace pertencem ao mesmo
 * usuário do item. Ambas as colunas são anuláveis: um item sem workspace ou sem
 * conceito-alvo passa sem verificação, por `MATCH SIMPLE`.
 */
export const approvalItem = pgTable('approval_item', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id'),
  type: approvalTypeEnum('type').notNull(),
  status: approvalStatusEnum('status').notNull(),
  title: text('title').notNull(),
  rationale: text('rationale').notNull().default(''),
  sourceRef: text('source_ref'),
  targetConceptId: uuid('target_concept_id'),
  confidence: real('confidence'),
  payloadBefore: jsonb('payload_before'),
  payloadAfter: jsonb('payload_after'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  reason: text('reason'),
}, (t) => [
  foreignKey({
    columns: [t.userId, t.targetConceptId],
    foreignColumns: [concept.userId, concept.id],
    name: 'aprovacao_conceito_do_mesmo_usuario',
  }),
  foreignKey({
    columns: [t.userId, t.workspaceId],
    foreignColumns: [workspace.userId, workspace.id],
    name: 'aprovacao_workspace_do_mesmo_usuario',
  }).onDelete('cascade'),
]);
