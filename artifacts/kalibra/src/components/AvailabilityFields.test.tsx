import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { emptyAvailability, type WeeklyAvailability } from '@workspace/core';
import { AvailabilityFields } from './AvailabilityFields';

afterEach(() => {
  cleanup();
});

describe('AvailabilityFields — regressão M1 (não pode reordenar nem descartar dados)', () => {
  it('preserva a ordem domingo-primeiro de emptyAvailability() ao editar um único dia', () => {
    const onChange = vi.fn();
    render(<AvailabilityFields value={emptyAvailability()} onChange={onChange} />);

    fireEvent.change(screen.getByTestId('input-disponibilidade-1'), { target: { value: '30' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as WeeklyAvailability;
    // emptyAvailability() gera os dias na ordem [0,1,2,3,4,5,6] (domingo primeiro) —
    // essa ordem tem que sobreviver a uma edição, mesmo que a grade mostre
    // segunda-feira primeiro.
    expect(next.days.map((day) => day.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(next.days.find((day) => day.weekday === 1)?.minutes).toBe(30);
    expect(next.days.find((day) => day.weekday === 2)?.minutes).toBe(0);
  });

  it('preserva uma entrada com weekday fora do padrão, em vez de descartá-la', () => {
    // Simula um registro migrado com uma entrada "estranha" (fora de 0-6) que passou
    // pela validação de forma em workspaces.ts (que só checa `typeof === 'number'`,
    // não o intervalo). Antes da correção, reconstruir a partir de `WEEKDAYS` descartava
    // silenciosamente qualquer entrada assim.
    const comEntradaEstranha = {
      days: [
        { weekday: 0, minutes: 10 },
        { weekday: 1, minutes: 20 },
        { weekday: 9, minutes: 99 },
      ],
      maxSessionMinutes: 50,
    } as unknown as WeeklyAvailability;

    const onChange = vi.fn();
    render(<AvailabilityFields value={comEntradaEstranha} onChange={onChange} />);

    fireEvent.change(screen.getByTestId('input-disponibilidade-0'), { target: { value: '15' } });

    const next = onChange.mock.calls[0][0] as WeeklyAvailability;
    expect(next.days).toHaveLength(3);
    expect(next.days.find((day) => (day as { weekday: number }).weekday === 9)).toEqual({ weekday: 9, minutes: 99 });
    expect(next.days.find((day) => day.weekday === 0)?.minutes).toBe(15);
  });
});

describe('AvailabilityFields — regressão M2 (o passo do campo não pode armar a validação)', () => {
  it('o incremento de cada dia acompanha a sessão máxima atual', () => {
    const value: WeeklyAvailability = { ...emptyAvailability(), maxSessionMinutes: 50 };
    render(<AvailabilityFields value={value} onChange={vi.fn()} />);
    expect(screen.getByTestId('input-disponibilidade-1').getAttribute('step')).toBe('50');
  });

  it('acompanha uma sessão máxima diferente de 50', () => {
    const value: WeeklyAvailability = { ...emptyAvailability(), maxSessionMinutes: 25 };
    render(<AvailabilityFields value={value} onChange={vi.fn()} />);
    expect(screen.getByTestId('input-disponibilidade-1').getAttribute('step')).toBe('25');
  });
});
