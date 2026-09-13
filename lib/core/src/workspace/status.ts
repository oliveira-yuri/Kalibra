export type WorkspaceStatus =
  | 'sem_edital'
  | 'aguardando_upload'
  | 'extraindo_edital'
  | 'aguardando_revisao_edital'
  | 'diagnostico_pendente'
  | 'diagnostico_em_andamento'
  | 'plano_quinzenal_pendente'
  | 'estudando'
  | 'erro';

export const WORKSPACE_STATUS_LABELS: Record<WorkspaceStatus, string> = {
  sem_edital: 'sem edital',
  aguardando_upload: 'aguardando upload',
  extraindo_edital: 'extraindo edital',
  aguardando_revisao_edital: 'aguardando revisão',
  diagnostico_pendente: 'diagnóstico pendente',
  diagnostico_em_andamento: 'diagnóstico em andamento',
  plano_quinzenal_pendente: 'plano pendente',
  estudando: 'estudando',
  erro: 'erro',
};

/**
 * Lista em tempo de execução de todo `WorkspaceStatus`, exaustiva por construção: como
 * `WORKSPACE_STATUS_LABELS` está anotado como `Record<WorkspaceStatus, string>`, o
 * compilador já recusa esse objeto literal se faltar (ou sobrar) uma chave em relação à
 * união de tipos — então `Object.keys` sobre ele nunca pode ficar desatualizado da
 * forma como uma lista mantida à mão (`VALID_STATUSES` em workspaces.ts) podia: um
 * status novo era aceito pelo type-checker e rejeitado em runtime por todo registro
 * migrado. O cast de volta para `WorkspaceStatus[]` é seguro exatamente por causa dessa
 * anotação — não é uma afirmação nova, só reflete o que o compilador já garantiu.
 */
export const WORKSPACE_STATUSES: readonly WorkspaceStatus[] = Object.keys(
  WORKSPACE_STATUS_LABELS,
) as WorkspaceStatus[];

const NEXT_ACTIONS: Record<WorkspaceStatus, string> = {
  sem_edital: 'Importar edital ou cadastrar manualmente',
  aguardando_upload: 'Enviar o arquivo do edital',
  extraindo_edital: 'Aguardando a extração terminar',
  aguardando_revisao_edital: 'Revisar a estrutura extraída',
  diagnostico_pendente: 'Fazer o diagnóstico inicial',
  diagnostico_em_andamento: 'Retomar o diagnóstico',
  plano_quinzenal_pendente: 'Revisar o plano quinzenal',
  estudando: 'Continuar a sessão de estudo',
  erro: 'Revisar o erro e tentar de novo',
};

/**
 * Estados alcançáveis a partir de cada estado. `erro` é alcançável a partir de
 * qualquer estado de processamento, e dele se retoma pelo upload.
 */
const TRANSITIONS: Record<WorkspaceStatus, readonly WorkspaceStatus[]> = {
  sem_edital: ['aguardando_upload', 'erro'],
  aguardando_upload: ['extraindo_edital', 'sem_edital', 'erro'],
  extraindo_edital: ['aguardando_revisao_edital', 'erro'],
  aguardando_revisao_edital: ['diagnostico_pendente', 'aguardando_upload', 'erro'],
  diagnostico_pendente: ['diagnostico_em_andamento', 'aguardando_upload', 'erro'],
  diagnostico_em_andamento: ['plano_quinzenal_pendente', 'diagnostico_pendente', 'erro'],
  plano_quinzenal_pendente: ['estudando', 'diagnostico_pendente', 'erro'],
  estudando: ['aguardando_upload', 'diagnostico_pendente', 'erro'],
  erro: ['aguardando_upload', 'sem_edital'],
};

export function canTransition(from: WorkspaceStatus, to: WorkspaceStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextActionFor(status: WorkspaceStatus): string {
  return NEXT_ACTIONS[status];
}

/**
 * Estado em que um workspace nasce. Com edital há um arquivo a processar, então
 * ele entra na fila de upload e caminha por `extraindo_edital` até a revisão —
 * pular direto para a revisão esconderia o processamento e foi o que permitiu a
 * tela de progresso existir como decoração.
 */
export function initialStatus(hasEdital: boolean): WorkspaceStatus {
  return hasEdital ? 'aguardando_upload' : 'sem_edital';
}

export function assertTransition(from: WorkspaceStatus, to: WorkspaceStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Transição inválida de "${WORKSPACE_STATUS_LABELS[from]}" para "${WORKSPACE_STATUS_LABELS[to]}".`,
    );
  }
}
