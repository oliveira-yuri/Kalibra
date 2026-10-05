import * as local from './adapters/local/workspaces';
import * as api from './adapters/api/workspaces';
import { domainConfig } from './config';
import type { WorkspacesPort } from './ports';

// Os tipos vêm da PORTA, não do adaptador (Fase 1A). Antes disto o contrato era
// definido pelo adaptador local, e um adaptador de API teria de importar tipo de um
// adaptador irmão.
export type {
  WorkspaceDraft, Cargo, SourceMode, ImportStatus, PendingWorkspaceImport,
} from './ports';

/**
 * A fonte deste módulo. Virada para `'api'` na Fase 5 — é o que faz a tela
 * atravessar o backend de verdade, e não só os testes do servidor.
 */
const fonte = domainConfig.workspaces === 'api' ? api : local;

// Cada export é tipado com o membro correspondente da porta: é assim que o
// compilador PROVA que o adaptador local a satisfaz. Sem isso a interface seria
// decorativa — declarada e verificada por ninguém.
export const useWorkspaces: WorkspacesPort['useWorkspaces'] = fonte.useWorkspaces;
// `defaultCargo` saiu da PORTA na Fase 5 — é regra pura, sem I/O, sessão nem
// estado, e uma porta existe para o que tem duas implementações. Continua sendo
// reexportado daqui para os chamadores existentes, mas já vem de `lib/core`.
export { defaultCargo } from '@workspace/core';
export const nextSyllabusVersionFor: WorkspacesPort['nextSyllabusVersionFor'] = fonte.nextSyllabusVersionFor;

export const parseWorkspaceDraft: WorkspacesPort['parseWorkspaceDraft'] = fonte.parseWorkspaceDraft;
