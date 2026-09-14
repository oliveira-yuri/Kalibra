export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type DayAvailability = {
  weekday: Weekday;
  minutes: number;
};

export type WeeklyAvailability = {
  days: DayAvailability[];
  maxSessionMinutes: number;
};

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: 'domingo',
  1: 'segunda-feira',
  2: 'terça-feira',
  3: 'quarta-feira',
  4: 'quinta-feira',
  5: 'sexta-feira',
  6: 'sábado',
};

const ALL_WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const MINUTES_IN_A_DAY = 24 * 60;
const DEFAULT_MAX_SESSION_MINUTES = 50;
// Mesmo mínimo anunciado pelo campo "Sessão máxima" (min={5} em AvailabilityFields.tsx).
const MIN_SESSION_MINUTES = 5;

export function emptyAvailability(): WeeklyAvailability {
  return {
    days: ALL_WEEKDAYS.map((weekday) => ({ weekday, minutes: 0 })),
    maxSessionMinutes: DEFAULT_MAX_SESSION_MINUTES,
  };
}

export function minutesFor(availability: WeeklyAvailability, weekday: Weekday): number {
  return availability.days.find((day) => day.weekday === weekday)?.minutes ?? 0;
}

export function totalWeeklyMinutes(availability: WeeklyAvailability): number {
  return availability.days.reduce((total, day) => total + day.minutes, 0);
}

export function validateAvailability(availability: WeeklyAvailability): string[] {
  const problems: string[] = [];

  if (availability.days.some((day) => day.minutes < 0)) {
    problems.push('Minutos não podem ser negativos.');
  }

  if (availability.days.some((day) => day.minutes > MINUTES_IN_A_DAY)) {
    problems.push('Um dia não pode ter mais de 24 horas.');
  }

  if (availability.maxSessionMinutes < MIN_SESSION_MINUTES) {
    problems.push(`A sessão máxima precisa ser de pelo menos ${MIN_SESSION_MINUTES} minutos.`);
  }

  // Um dia zerado significa indisponível, não um dia curto — não conflita.
  for (const day of availability.days) {
    if (day.minutes > 0 && day.minutes < availability.maxSessionMinutes) {
      problems.push(`A sessão máxima é maior que a disponibilidade de ${WEEKDAY_LABELS[day.weekday]}.`);
    }
  }

  return problems;
}
