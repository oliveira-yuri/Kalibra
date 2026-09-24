import * as local from './adapters/local/workspaces';
import { domainConfig } from './config';
import type { WorkspacesPort } from './ports';

// Os tipos vêm da PORTA, não do adaptador (Fase 1A). Antes disto o contrato era
// definido pelo adaptador local, e um adaptador de API teria de importar tipo de um
// adaptador irmão.
export type {
  WorkspaceDraft, Cargo, SourceMode, ImportStatus, PendingWorkspaceImport,
} from './ports';

if (domainConfig.workspaces !== 'local') {
  throw new Error('Adaptador de API de workspaces ainda não existe (Fase 3).');
}

// Cada export é tipado com o membro correspondente da porta: é assim que o
// compilador PROVA que o adaptador local a satisfaz. Sem isso a interface seria
// decorativa — declarada e verificada por ninguém.
export const useWorkspaces: WorkspacesPort['useWorkspaces'] = local.useWorkspaces;
// `defaultCargo` saiu da PORTA na Fase 5 — é regra pura, sem I/O, sessão nem
// estado, e uma porta existe para o que tem duas implementações. Continua sendo
// reexportado daqui para os chamadores existentes, mas já vem de `lib/core`.
export { defaultCargo } from '@workspace/core';
export const nextSyllabusVersionFor: WorkspacesPort['nextSyllabusVersionFor'] = local.nextSyllabusVersionFor;

export const parseWorkspaceDraft: WorkspacesPort['parseWorkspaceDraft'] = local.parseWorkspaceDraft;
