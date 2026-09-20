import { useApprovals as localUseApprovals } from './adapters/local/approvals';
import { domainConfig } from './config';
import type { ApprovalsPort } from './ports';

export type { ApprovalItem, ApprovalType, ApprovalStatus } from '@workspace/core';
// `groupByType` não é reexportado aqui: nada em `artifacts/kalibra` monta seções por
// tipo (a fila desta tela é uma lista plana com chips de filtro — `.filter()` já
// resolve isso). Continua disponível direto de `@workspace/core` para a tela que vier
// a precisar de fato de um bucket por tipo.
export { canDecide, pendingCount, APPROVAL_TYPES } from '@workspace/core';

if (domainConfig.approvals !== 'local') {
  throw new Error('Adaptador de API de fila de aprovação ainda não existe (Fase 3).');
}

// Tipado com o membro da porta: o compilador prova que o adaptador local a satisfaz.
export const useApprovals: ApprovalsPort['useApprovals'] = localUseApprovals;
