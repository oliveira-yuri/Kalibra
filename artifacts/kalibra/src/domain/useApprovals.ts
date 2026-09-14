import { useApprovals as localUseApprovals } from './adapters/local/approvals';
import { domainConfig } from './config';

export type { ApprovalItem, ApprovalType, ApprovalStatus } from '@workspace/core';
export { canDecide, pendingCount, groupByType, APPROVAL_TYPES } from '@workspace/core';
export { migrateApprovalItem } from './adapters/local/approvals';

if (domainConfig.approvals !== 'local') {
  throw new Error('Adaptador de API de fila de aprovação ainda não existe (Fase 3).');
}

export const useApprovals = localUseApprovals;
