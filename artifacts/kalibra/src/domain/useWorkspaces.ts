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
export const defaultCargo: WorkspacesPort['defaultCargo'] = local.defaultCargo;
export const nextSyllabusVersionFor: WorkspacesPort['nextSyllabusVersionFor'] = local.nextSyllabusVersionFor;

// As quatro abaixo saem daqui no Lote 4: as três de staging vão para
// `domain/staging.ts` (continuidade de interface por aba, fora da porta), e
// `migrateWorkspace` vira `parseWorkspaceDraft` na porta, com o mesmo corpo.
export const stageWorkspaceImport = local.stageWorkspaceImport;
export const getPendingWorkspaceImport = local.getPendingWorkspaceImport;
export const clearPendingWorkspaceImport = local.clearPendingWorkspaceImport;
export const migrateWorkspace = local.migrateWorkspace;
