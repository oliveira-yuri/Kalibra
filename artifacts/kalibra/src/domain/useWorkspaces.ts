import * as local from './adapters/local/workspaces';
import { domainConfig } from './config';

export type {
  WorkspaceDraft, Cargo, SourceMode, ImportStatus, PendingWorkspaceImport,
} from './adapters/local/workspaces';

if (domainConfig.workspaces !== 'local') {
  throw new Error('Adaptador de API de workspaces ainda não existe (Fase 3).');
}

export const useWorkspaces = local.useWorkspaces;
export const stageWorkspaceImport = local.stageWorkspaceImport;
export const getPendingWorkspaceImport = local.getPendingWorkspaceImport;
export const clearPendingWorkspaceImport = local.clearPendingWorkspaceImport;
export const migrateWorkspace = local.migrateWorkspace;
