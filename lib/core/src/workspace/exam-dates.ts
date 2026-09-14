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
 * Lê os componentes numéricos de um ISO date (YYYY-MM-DD) sem passar por `Date.parse`.
 * Uma string "date-only" é interpretada pela especificação como meia-noite UTC — em um
 * fuso negativo (ex.: America/Sao_Paulo, UTC-3) isso corresponde a 21h do dia anterior
 * no calendário local, então ler `getFullYear`/`getMonth`/`getDate` de volta a partir daí
 * devolveria o dia errado. Aqui a string é sempre lida como o calendário pretendido, não
 * como um instante. Devolve null para uma data de calendário que não existe (ex.: 30/fev).
 */
function parseIsoDateParts(isoDate: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);

  const probe = new Date(year, month, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month || probe.getDate() !== day) return null;

  return { year, month, day };
}

/**
 * Dias inteiros entre hoje e a data da prova, comparando calendários locais (nunca UTC)
 * dos dois lados, para que duas telas que chamam esta função com o mesmo `today` sempre
 * concordem, e para que o resultado vire no início do dia local de quem chama — não à
 * meia-noite UTC (que em America/Sao_Paulo é 21h). `today` é o relógio de quem chama:
 * esta função nunca lê o relógio do sistema, então é pura e determinística em teste.
 * Devolve null quando a data é ausente ou não parseável — quem chama decide como exibir isso.
 */
export function daysUntil(isoDate: string, today: Date): number | null {
  if (!isoDate) return null;

  const parts = parseIsoDateParts(isoDate);
  if (!parts) return null;

  const target = new Date(parts.year, parts.month, parts.day);
  const todayLocalMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return Math.round((target.getTime() - todayLocalMidnight.getTime()) / MS_IN_A_DAY);
}
