/**
 * Leitura do `payloadAfter` de um item `edital_structure` — compartilhada entre
 * `EditalRevisar.tsx` (que reconstrói a proposta em revisão a partir da fila) e
 * `ApprovalCard.tsx` (que monta o link "Revisar estrutura" a partir do mesmo campo).
 *
 * Achado C1 da revisão final: as duas telas tinham cada uma a sua PRÓPRIA cópia desta
 * leitura, com fallbacks DIFERENTES quando `version` está ausente do payload —
 * `ApprovalCard` caía em `'1'`, `EditalRevisar` caía em `null`. Um item nesse formato
 * (sem `version`) linkava para `/edital/revisar/1` (fallback do card) mas nunca batia
 * na comparação de retomada (`null !== '1'`), então a tela abria sem nada para
 * revisar — e "Confirmar" ainda assim avançava o status do workspace, silenciosamente,
 * porque o resto de `handleConfirm` não sabe distinguir esse caso de uma edição normal
 * de uma estrutura já confirmada. Um único fallback, usado nos dois lugares, elimina
 * essa divergência: quando o payload traz uma versão, os dois sempre concordam nela;
 * quando não traz, os dois sempre concordam em `'1'` — o link e a busca da fila nunca
 * mais podem discordar sobre qual string de versão está em jogo.
 */
export function versionFromPayload(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
    const version = (payload as Record<string, unknown>).version;
    if (typeof version === 'string' && version) return version;
    if (typeof version === 'number') return String(version);
  }
  return '1';
}
