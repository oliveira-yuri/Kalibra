/**
 * A fila nasce com dois tipos só: os que esta fase realmente produz
 * (`edital_structure`, a partir da extração; `concept_merge`, a partir da
 * deduplicação). O spec lista dez tipos; os outros oito chegam com as fases
 * que os geram — um tipo declarado sem produtor seria código morto fingindo
 * cobertura.
 */
export type ApprovalType = 'edital_structure' | 'concept_merge';

export const APPROVAL_TYPES: readonly ApprovalType[] = ['edital_structure', 'concept_merge'];

export type ApprovalStatus = 'pendente' | 'revisando' | 'aprovado' | 'rejeitado';

export type ApprovalItem = {
  id: string;
  workspaceId: string | null;
  type: ApprovalType;
  status: ApprovalStatus;
  title: string;
  rationale: string;
  /** Proveniência: de onde a proposta veio (a linha do edital, o registro de origem). Nunca o que a decisão muta — ver `targetConceptId`. */
  sourceRef: string | null;
  /** O que uma decisão aprovada muta. Para `concept_merge`, o id do `Concept` a promover a `confirmed`; `null` para tipos que não mutam um conceito. */
  targetConceptId: string | null;
  confidence: number | null;
  payloadBefore: unknown;
  payloadAfter: unknown;
  createdAt: string;
  decidedAt: string | null;
  reason: string | null;
};

/** Só `pendente` e `revisando` ainda podem receber uma decisão; `aprovado`/`rejeitado` são terminais. */
export function canDecide(status: ApprovalStatus): boolean {
  return status === 'pendente' || status === 'revisando';
}

/** Quantos itens ainda esperam por uma decisão humana — a mesma régua de `canDecide`. */
export function pendingCount(items: readonly ApprovalItem[]): number {
  return items.filter((item) => canDecide(item.status)).length;
}

/**
 * Agrupa por tipo com todos os tipos presentes, mesmo vazios — a tela de
 * fila desenha uma seção por tipo mesmo quando não há itens nela ainda.
 */
export function groupByType(items: readonly ApprovalItem[]): Record<ApprovalType, ApprovalItem[]> {
  const result = Object.fromEntries(
    APPROVAL_TYPES.map((type) => [type, [] as ApprovalItem[]]),
  ) as Record<ApprovalType, ApprovalItem[]>;

  for (const item of items) {
    // `item.type` só é `ApprovalType` de verdade quando passou por
    // `migrateApprovalItem`; um valor fora de `APPROVAL_TYPES` chegando via
    // cast (`as ApprovalType`) não pode desreferenciar um bucket inexistente.
    (result[item.type] ??= []).push(item);
  }

  return result;
}
