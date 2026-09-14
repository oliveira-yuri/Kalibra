import { daysUntil } from '@workspace/core';

/**
 * Convenção de três vias para uma contagem regressiva: D−n para o futuro, HOJE para
 * hoje, D+n para o passado. Compartilhada entre a barra lateral (`getDaysRemaining`,
 * abaixo) e o card do Portal (`Portal.tsx`) para que as duas telas nunca possam voltar
 * a mostrar textos diferentes para a mesma conta — ver a regressão I1.
 */
export function formatCountdown(dias: number): string {
  if (dias > 0) return `D−${dias}`;
  if (dias === 0) return 'HOJE';
  return `D+${Math.abs(dias)}`;
}

export function getDaysRemaining(dateString: string): string {
  if (!dateString) return 'D−?';
  const dias = daysUntil(dateString, new Date());
  if (dias === null) return 'D−?';
  return formatCountdown(dias);
}

export function formatShortDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${date.getDate().toString().padStart(2, '0')} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function getCurrentDateFormatted(): string {
  const now = new Date();
  const weekdays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${weekdays[now.getDay()]}, ${now.getDate().toString().padStart(2, '0')} ${months[now.getMonth()]}`;
}

export function getCurrentTimeFormatted(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} BRT`;
}
