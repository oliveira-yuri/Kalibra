export type ModuleSource = 'local' | 'api';

/**
 * Qual adaptador cada módulo do domínio usa.
 * Fase 1 mantém tudo em 'local'. Fase 3 vira módulo a módulo para 'api'.
 */
export const domainConfig = {
  workspaces: 'local',
  notes: 'local',
  studyState: 'local',
  theme: 'local',
  extraction: 'local',
} satisfies Record<string, ModuleSource>;
