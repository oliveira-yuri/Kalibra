import { describe, it, expect } from 'vitest';
import {
  emptyAvailability, totalWeeklyMinutes, minutesFor,
  validateAvailability, WEEKDAY_LABELS, type WeeklyAvailability,
} from './availability';

describe('disponibilidade vazia', () => {
  it('tem os sete dias em zero', () => {
    const a = emptyAvailability();
    expect(a.days).toHaveLength(7);
    expect(totalWeeklyMinutes(a)).toBe(0);
  });

  it('começa com sessão máxima de 50 minutos', () => {
    expect(emptyAvailability().maxSessionMinutes).toBe(50);
  });
});

describe('soma semanal', () => {
  it('soma os minutos de todos os dias', () => {
    const a: WeeklyAvailability = {
      days: [
        { weekday: 1, minutes: 60 },
        { weekday: 3, minutes: 90 },
        { weekday: 5, minutes: 30 },
      ],
      maxSessionMinutes: 50,
    };
    expect(totalWeeklyMinutes(a)).toBe(180);
  });

  it('devolve zero para um dia não informado', () => {
    const a: WeeklyAvailability = { days: [{ weekday: 1, minutes: 60 }], maxSessionMinutes: 50 };
    expect(minutesFor(a, 2)).toBe(0);
    expect(minutesFor(a, 1)).toBe(60);
  });
});

describe('validação', () => {
  it('aceita uma disponibilidade coerente', () => {
    const a: WeeklyAvailability = { days: [{ weekday: 1, minutes: 60 }], maxSessionMinutes: 50 };
    expect(validateAvailability(a)).toEqual([]);
  });

  it('recusa minutos negativos', () => {
    const a: WeeklyAvailability = { days: [{ weekday: 1, minutes: -10 }], maxSessionMinutes: 50 };
    expect(validateAvailability(a)).toContain('Minutos não podem ser negativos.');
  });

  it('recusa mais de 24 horas num dia', () => {
    const a: WeeklyAvailability = { days: [{ weekday: 1, minutes: 1441 }], maxSessionMinutes: 50 };
    expect(validateAvailability(a)).toContain('Um dia não pode ter mais de 24 horas.');
  });

  it('recusa sessão máxima maior que o dia mais curto disponível', () => {
    const a: WeeklyAvailability = {
      days: [{ weekday: 1, minutes: 30 }, { weekday: 2, minutes: 120 }],
      maxSessionMinutes: 50,
    };
    expect(validateAvailability(a)).toContain('A sessão máxima é maior que a disponibilidade de segunda-feira.');
  });

  it('recusa sessão máxima não positiva', () => {
    const a: WeeklyAvailability = { days: [], maxSessionMinutes: 0 };
    expect(validateAvailability(a)).toContain('A sessão máxima precisa ser de pelo menos 5 minutos.');
  });

  it('recusa sessão máxima abaixo do mínimo mesmo sendo positiva', () => {
    // Mesmo mínimo anunciado pelo campo (min={5} em AvailabilityFields.tsx) — um valor
    // como 3 passava despercebido porque a checagem só recusava <= 0.
    const a: WeeklyAvailability = { days: [], maxSessionMinutes: 3 };
    expect(validateAvailability(a)).toContain('A sessão máxima precisa ser de pelo menos 5 minutos.');
  });

  it('ignora dias zerados ao comparar com a sessão máxima', () => {
    const a: WeeklyAvailability = {
      days: [{ weekday: 1, minutes: 0 }, { weekday: 2, minutes: 120 }],
      maxSessionMinutes: 50,
    };
    expect(validateAvailability(a)).toEqual([]);
  });
});

describe('rótulos', () => {
  it('nomeia os sete dias em português', () => {
    expect(WEEKDAY_LABELS[0]).toBe('domingo');
    expect(WEEKDAY_LABELS[1]).toBe('segunda-feira');
    expect(WEEKDAY_LABELS[6]).toBe('sábado');
  });
});
