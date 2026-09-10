export function getDaysRemaining(dateString: string): string {
  if (!dateString) return 'D−?';
  const targetDate = new Date(dateString);
  targetDate.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffTime = targetDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays > 0) return `D−${diffDays}`;
  if (diffDays === 0) return `HOJE`;
  return `D+${Math.abs(diffDays)}`;
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
