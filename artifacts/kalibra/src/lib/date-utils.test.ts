import { describe, it, expect, afterEach, vi } from 'vitest';
import { daysUntil } from '@workspace/core';
import { getDaysRemaining, formatCountdown } from './date-utils';

describe('getDaysRemaining — regressão I1 (Portal e barra lateral não podem divergir)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('produz a mesma string que o Portal produziria para a mesma data e o mesmo relógio', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 13, 11, 45));

    for (const data of ['2026-01-17', '2026-06-01', '2027-01-17', '2026-09-13']) {
      const stringDoPortal = formatCountdown(daysUntil(data, new Date())!);
      expect(getDaysRemaining(data)).toBe(stringDoPortal);
    }
  });

  it('devolve D+239 para 2026-01-17 quando hoje é 13/set/2026 (antes da correção, a barra lateral mostrava D+240)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 13, 11, 45));
    expect(getDaysRemaining('2026-01-17')).toBe('D+239');
  });

  it('devolve D+104 para 2026-06-01 quando hoje é 13/set/2026 (antes da correção, a barra lateral mostrava D+105)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 13, 11, 45));
    expect(getDaysRemaining('2026-06-01')).toBe('D+104');
  });

  it('devolve D−? para uma data vazia', () => {
    expect(getDaysRemaining('')).toBe('D−?');
  });
});
