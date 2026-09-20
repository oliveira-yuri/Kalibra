/**
 * Ponto único de entrada das portas do domínio.
 *
 * As portas declaram o contrato que o adaptador local e o futuro adaptador de API
 * implementam. Consumidores (telas, componentes, hooks) importam tipo daqui — nunca
 * de `adapters/`.
 *
 * Nesta fase só a porta de workspaces tem tipos próprios: `concepts`, `syllabus` e
 * `approvals` tiram os seus de `@workspace/core`, que já é o lugar certo. As
 * quatro interfaces estao declaradas.
 */

export type {
  SourceMode,
  ImportStatus,
  Cargo,
  WorkspaceDraft,
  PendingWorkspaceImport,
} from './workspaces';

export type { WorkspacesPort } from './workspaces';
export type { ConceptsPort } from './concepts';
export type { SyllabusPort } from './syllabus';
export type { ApprovalsPort } from './approvals';
