export type CargoDates = {
  id: string;
  examDate?: string;
  period?: string;
};

export function effectiveExamDate(
  cargos: readonly CargoDates[],
  selectedCargoId: string | undefined,
  workspaceExamDate: string,
): string {
  const selected = cargos.find((cargo) => cargo.id === selectedCargoId);
  return selected?.examDate || workspaceExamDate;
}

const MS_IN_A_DAY = 24 * 60 * 60 * 1000;

/**
 * Dias inteiros entre hoje e a data da prova, comparando datas em UTC para que
 * a hora do dia não mude o resultado. Devolve null quando a data é ausente ou
 * não parseável — quem chama decide como exibir isso.
 */
export function daysUntil(isoDate: string, today: Date): number | null {
  if (!isoDate) return null;

  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return null;

  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  return Math.round((targetUtc - todayUtc) / MS_IN_A_DAY);
}
