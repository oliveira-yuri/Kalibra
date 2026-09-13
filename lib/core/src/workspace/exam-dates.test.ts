import { describe, it, expect } from 'vitest';
import { effectiveExamDate, daysUntil, type CargoDates } from './exam-dates';

const CARGOS: CargoDates[] = [
  { id: 'c1', examDate: '2027-01-17', period: 'A' },
  { id: 'c2', examDate: '2027-01-17', period: 'B' },
  { id: 'c3' },
];

describe('data efetiva da prova', () => {
  it('usa a data do cargo selecionado', () => {
    expect(effectiveExamDate(CARGOS, 'c1', '2026-01-01')).toBe('2027-01-17');
  });

  it('cai na data do workspace quando o cargo não tem data própria', () => {
    expect(effectiveExamDate(CARGOS, 'c3', '2026-01-01')).toBe('2026-01-01');
  });

  it('cai na data do workspace quando nenhum cargo está selecionado', () => {
    expect(effectiveExamDate(CARGOS, undefined, '2026-01-01')).toBe('2026-01-01');
  });

  it('cai na data do workspace quando o id selecionado não existe', () => {
    expect(effectiveExamDate(CARGOS, 'inexistente', '2026-01-01')).toBe('2026-01-01');
  });

  it('funciona sem cargo nenhum', () => {
    expect(effectiveExamDate([], undefined, '2026-06-01')).toBe('2026-06-01');
  });
});

describe('dias restantes', () => {
  it('conta os dias até a prova', () => {
    expect(daysUntil('2026-01-17', new Date('2026-01-01T12:00:00Z'))).toBe(16);
  });

  it('devolve zero no dia da prova', () => {
    expect(daysUntil('2026-01-17', new Date('2026-01-17T23:00:00Z'))).toBe(0);
  });

  it('devolve negativo depois da prova', () => {
    expect(daysUntil('2026-01-17', new Date('2026-01-20T00:00:00Z'))).toBe(-3);
  });

  it('ignora a hora do dia', () => {
    const cedo = daysUntil('2026-01-17', new Date('2026-01-01T00:01:00Z'));
    const tarde = daysUntil('2026-01-17', new Date('2026-01-01T23:59:00Z'));
    expect(cedo).toBe(tarde);
  });

  it('devolve null para data ausente ou inválida', () => {
    expect(daysUntil('', new Date('2026-01-01T00:00:00Z'))).toBeNull();
    expect(daysUntil('não é data', new Date('2026-01-01T00:00:00Z'))).toBeNull();
  });
});
