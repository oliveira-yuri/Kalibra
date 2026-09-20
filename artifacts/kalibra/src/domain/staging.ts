import type { PendingWorkspaceImport } from './ports';

/**
 * Continuidade de interface entre duas telas — **não é domínio, e por isso está fora
 * da porta.**
 *
 * Guarda uma importação de edital em andamento no caminho `Edital` → `EditalRevisar`
 * (ou `NovoWorkspace` → `EditalRevisar`). É por aba, efêmera e nunca compartilhada
 * entre dispositivos: o usuário abandona a importação e ela morre com a sessão do
 * navegador, que é o comportamento certo.
 *
 * Um adaptador de API não implementaria isto — não haveria o que implementar. Por
 * isso `sessionStorage` continua sendo o lugar correto mesmo depois que workspaces,
 * conceitos e programa migrarem para o backend.
 *
 * O **tipo** `PendingWorkspaceImport` fica na porta (é forma de domínio: descreve o
 * que uma importação pendente contém); as três funções abaixo, não.
 */

const pendingKeyFor = (slug: string, userId?: string) =>
  `kalibra_pending_edital:${userId || 'anonymous'}:${slug}`;

export function stageWorkspaceImport(slug: string, pending: PendingWorkspaceImport, userId?: string) {
  sessionStorage.setItem(pendingKeyFor(slug, userId), JSON.stringify(pending));
}

export function getPendingWorkspaceImport(slug: string, userId?: string): PendingWorkspaceImport | null {
  const saved = sessionStorage.getItem(pendingKeyFor(slug, userId));
  return saved ? JSON.parse(saved) : null;
}

export function clearPendingWorkspaceImport(slug: string, userId?: string) {
  sessionStorage.removeItem(pendingKeyFor(slug, userId));
}
