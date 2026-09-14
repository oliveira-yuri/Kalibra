import type { ApprovalItem } from '@workspace/core';

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

/**
 * A mesma leitura, como NÚMERO — `null` quando o payload não traz uma versão
 * reconhecível como inteiro positivo. As três funções abaixo raciocinam sobre ordem
 * ("qual é a próxima", "com qual comparar"), e ordem só existe sobre números.
 */
export function versionNumberFromPayload(payload: unknown): number | null {
  const parsed = Number.parseInt(versionFromPayload(payload), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function structureItemsOf(items: readonly ApprovalItem[], workspaceId: string): ApprovalItem[] {
  return items.filter((item) => item.type === 'edital_structure' && item.workspaceId === workspaceId);
}

/**
 * A próxima versão de edital para este workspace — derivada do que JÁ EXISTE DE FATO,
 * nunca de um contador guardado à parte (achado R2 da re-revisão).
 *
 * O fix wave anterior reservava a versão num contador durável próprio
 * (`kalibra_syllabus_version:…`), incrementado no início de cada extração e NUNCA
 * liberado quando a importação era abandonada antes de virar proposta de verdade.
 * Consequências medidas: (a) uma primeira importação abandonada e refeita com o mesmo
 * título caía na versão 2 e a tela anunciava "COMPARADO COM A VERSÃO 1" para um
 * workspace que nunca teve versão 1 nenhuma — cada tentativa abandonada inflava mais;
 * (b) um workspace que já tinha programa salvo mas nenhuma chave de contador (todos os
 * que existiam antes do fix wave) reservava 1, e a tela de reimportação escondia a
 * comparação do PD-08 inteira, que é a única razão daquela tela existir.
 *
 * As duas somem quando a versão deixa de ser um contador e passa a ser uma LEITURA da
 * realidade: uma versão é real quando ou (1) existe um item `edital_structure` na fila
 * que a nomeia — o momento em que a proposta foi de fato encenada, sobrevive a fechar
 * a aba porque a fila é durável — ou (2) existe um programa salvo, que só pode ter
 * vindo de uma versão confirmada. Uma tentativa abandonada ANTES de a proposta chegar
 * à fila não deixa número queimado: nada a nomeia, então o número volta a estar livre,
 * e reutilizá-lo não pode colidir com coisa nenhuma. Uma tentativa abandonada DEPOIS
 * (item pendente na fila) continua protegida — era o achado C1 — porque o item ainda
 * está lá nomeando aquele número.
 */
export function nextSyllabusVersion(
  items: readonly ApprovalItem[], workspaceId: string, hasSavedProgramme: boolean,
): number {
  const claimed = structureItemsOf(items, workspaceId)
    .map((item) => versionNumberFromPayload(item.payloadAfter))
    .filter((version): version is number => version !== null);
  // Um programa salvo sem nenhum item aprovado na fila (dado anterior à fila, ou
  // semeado) ainda É uma versão que existe: ocupa o número 1.
  return Math.max(hasSavedProgramme ? 1 : 0, 0, ...claimed) + 1;
}

/**
 * Com qual versão a tela de revisão deve comparar a proposta atual (PD-08) — `null`
 * quando não há nada com que comparar, isto é, quando não existe programa salvo.
 *
 * Achado R2 da re-revisão: o rótulo era `versão da URL − 1`, uma aritmética que nomeia
 * versões que nunca existiram assim que qualquer número é pulado (reserva abandonada,
 * ou o contador do fix wave anterior inflando). A versão comparada é a que o "antes"
 * da comparação de fato tem: a maior versão já APROVADA deste workspace — foi ela que
 * escreveu o programa salvo — com 1 como piso para um programa salvo que antecede a
 * fila. Nunca um número que ninguém aprovou.
 */
export function comparedSyllabusVersion(
  items: readonly ApprovalItem[], workspaceId: string, currentVersion: number | null, hasSavedProgramme: boolean,
): number | null {
  if (!hasSavedProgramme) return null;
  const approved = structureItemsOf(items, workspaceId)
    .filter((item) => item.status === 'aprovado')
    .map((item) => versionNumberFromPayload(item.payloadAfter))
    .filter((version): version is number => version !== null && version !== currentVersion);
  return approved.length > 0 ? Math.max(...approved) : 1;
}
