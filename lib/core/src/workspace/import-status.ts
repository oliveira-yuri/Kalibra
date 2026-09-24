import type { WorkspaceStatus } from './status';

/**
 * Como foi a importação do edital.
 *
 * **Não é campo persistido.** O banco guarda `status`, e `importStatus` é uma
 * leitura mais grossa dele — a Fase 2 removeu a coluna por ser segunda
 * representação de um fato que o `status` já carrega. O formato antigo do
 * navegador ainda o traz, e a API ainda o expõe na resposta, então a conversão
 * entre os dois precisa existir **num lugar só**.
 *
 * Morava no adaptador local. Com a API passando a computá-lo, duas cópias
 * divergiriam — e divergir aqui significa a mesma tela mostrar coisas diferentes
 * conforme o adaptador, que é exatamente o que o harness de contrato existe para
 * pegar. Mover para cá é mais barato que deixar o harness pegar depois.
 */
export type ImportStatus = 'pending' | 'parsing' | 'completed' | 'error';

const IMPORT_STATUS_SET: Record<ImportStatus, true> = {
  pending: true,
  parsing: true,
  completed: true,
  error: true,
};

export const IMPORT_STATUSES: readonly ImportStatus[] = Object.keys(
  IMPORT_STATUS_SET,
) as ImportStatus[];

/**
 * O status canônico que um `importStatus` implica.
 *
 * `completed` significa só que **a extração do edital terminou** — o diagnóstico
 * inicial ainda não rodou. Por isso leva a `diagnostico_pendente` e nunca a
 * `estudando`, que só é alcançável depois de diagnóstico e plano quinzenal.
 */
export function statusFromImport(importStatus: ImportStatus): WorkspaceStatus {
  return STATUS_FROM_IMPORT[importStatus];
}

const STATUS_FROM_IMPORT: Record<ImportStatus, WorkspaceStatus> = {
  pending: 'aguardando_revisao_edital',
  parsing: 'extraindo_edital',
  completed: 'diagnostico_pendente',
  error: 'erro',
};

/**
 * A leitura inversa: o `importStatus` que um status implica.
 *
 * **Total por construção** — o `Record` cobre todo `WorkspaceStatus`, então o
 * compilador recusa o literal se um status novo aparecer sem tradução. Uma função
 * com `switch` e `default` aceitaria o status novo em silêncio, mapeando-o para o
 * que estivesse no `default`.
 *
 * Não é bijeção: quatro valores de importação descrevem nove de status. O que a
 * inversa preserva é a ida e volta a partir da importação — há teste exaustivo
 * fixando que `importStatusFor(statusFromImport(i)) === i` para todo `i`.
 */
export function importStatusFor(status: WorkspaceStatus): ImportStatus {
  return IMPORT_STATUS_FROM_STATUS[status];
}

const IMPORT_STATUS_FROM_STATUS: Record<WorkspaceStatus, ImportStatus> = {
  // Ainda não houve importação para relatar.
  sem_edital: 'pending',
  aguardando_upload: 'pending',
  extraindo_edital: 'parsing',
  aguardando_revisao_edital: 'pending',
  // Daqui para a frente a extração terminou; o que varia é o que veio depois dela.
  diagnostico_pendente: 'completed',
  diagnostico_em_andamento: 'completed',
  plano_quinzenal_pendente: 'completed',
  estudando: 'completed',
  erro: 'error',
};
