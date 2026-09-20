import type {
  WeeklyAvailability,
  WorkspaceStatus,
  ExtractionOutput,
  CargoTextBlock,
} from '@workspace/core';

/**
 * A porta de workspaces: os tipos do domínio que os DOIS adaptadores — o local e o
 * de API — implementam. Antes desta fase eles moravam dentro de
 * `adapters/local/workspaces.ts`, o que significava que o contrato *era* o
 * adaptador local: um adaptador de API teria de importar tipo de um adaptador
 * irmão, e o harness de contrato (Fase 4) seria uma tautologia — comparar o
 * adaptador local contra um contrato que ele próprio define.
 *
 * A seta de dependência aponta num sentido só: adaptadores importam da porta, e a
 * porta não conhece implementação nenhuma. Há teste estrutural fixando isso.
 *
 * As assinaturas aqui são **as de hoje**. Torná-las assíncronas é a Fase 1B.
 */

export type SourceMode = 'file' | 'text' | 'none';
export type ImportStatus = 'pending' | 'parsing' | 'completed' | 'error';

export interface Cargo {
  id: string;
  name: string;
  examDate: string;
  period?: string;
}

export interface WorkspaceDraft {
  slug: string;
  title: string;
  institution: string;
  type: string;
  examDate: string; // default date
  cargos: Cargo[];
  selectedCargoId: string;
  availability: WeeklyAvailability;
  status: WorkspaceStatus;
  sourceMode: SourceMode;
  sourceFileName?: string;
  sourceText?: string;
  /**
   * Blocos do edital por cargo (Fase 1B.5). `sourceText` continua no tipo porque
   * registros antigos gravados no navegador do usuário ainda o têm — `migrateWorkspace`
   * converte um em outro na leitura. Escrita nova sempre usa `sourceBlocks`.
   */
  sourceBlocks: CargoTextBlock[];
  importStatus: ImportStatus;
  progress: number;
  nextAction: string;
  active: boolean;
}

export interface PendingWorkspaceImport {
  isNew: boolean;
  workspace?: WorkspaceDraft;
  updates?: Partial<WorkspaceDraft>;
  /**
   * A saída bruta da extração (Task 10), levada até a tela de revisão para que ela
   * rode `dedupeEntries` (Task 11) — nunca aplicada aqui, só transportada. `undefined`
   * enquanto a extração ainda não chegou a "pronto".
   */
  extractionOutput?: ExtractionOutput;
  /**
   * Marca que `dedupeEntries` já rodou sobre `extractionOutput` (Task 11) —
   * sem isto, reabrir a mesma tela de revisão (mesmo import, sem confirmar
   * nem descartar) rodaria a deduplicação de novo a cada montagem e
   * duplicaria itens/conceitos/aprovações. `extractionOutput` continua
   * presente mesmo depois de aplicado: é o único lugar que guarda as
   * incertezas do PD-06 para o bloco "Não encontrado no edital".
   */
  extractionApplied?: boolean;
}

/**
 * O que qualquer adaptador de workspaces oferece. As assinaturas são **as de hoje**,
 * síncronas — torná-las `Promise` é a Fase 1B, deliberadamente separada porque
 * mudar ordem de execução não é refatoração mecânica.
 *
 * `stageWorkspaceImport` e companhia NÃO entram aqui: guardam uma importação em
 * andamento entre duas telas, por aba, efêmera e nunca compartilhada. Vivem em
 * `domain/staging.ts` — um adaptador de API não as implementaria.
 */
export interface WorkspacesPort {
  useWorkspaces(userId?: string): {
    workspaces: WorkspaceDraft[];
    addWorkspace(workspace: WorkspaceDraft): void;
    updateWorkspace(slug: string, updates: Partial<WorkspaceDraft>): void;
  };
  /**
   * Valida e normaliza um registro de workspace de origem não confiável.
   * `EditalRevisar` o usa sobre o `workspaceDraft` de um item da fila de aprovação,
   * que pode estar corrompido ou num formato anterior.
   */
  parseWorkspaceDraft(raw: unknown): WorkspaceDraft | null;
  /** O cargo sintético de um workspace sem cargo nomeado. */
  defaultCargo(examDate: string): Cargo;
  /** A próxima versão de edital, apurada da fila de aprovação e do programa salvo. */
  nextSyllabusVersionFor(slug: string, userId?: string): number;
}
