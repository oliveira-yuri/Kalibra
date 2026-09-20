import type { ApprovalItem } from '@workspace/core';

/**
 * A fila de aprovação. Tipos vêm de `@workspace/core`.
 *
 * `enqueue` recebe o relógio (`now`) em vez de lê-lo: manter a decisão de tempo do
 * lado de quem chama é o que permite testar a fila com relógio congelado, e é a
 * mesma disciplina que mantém `lib/core` puro.
 */
export interface ApprovalsPort {
  useApprovals(userId?: string): {
    items: ApprovalItem[];
    pending: number;
    approve(id: string, payloadAfter?: unknown): void;
    reject(id: string, reason?: string, payloadAfter?: unknown): void;
    enqueue(
      item: Omit<ApprovalItem, 'id' | 'status' | 'createdAt' | 'decidedAt' | 'reason'>,
      now: Date,
    ): string;
  };
}
