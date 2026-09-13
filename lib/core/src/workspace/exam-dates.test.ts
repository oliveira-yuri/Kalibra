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
  // `today` é sempre construído com o construtor local (`new Date(ano, mês, dia, ...)`),
  // nunca com uma string ISO em UTC: é exatamente essa mistura entre UTC e calendário
  // local que causava o card do Portal e a barra lateral mostrarem números diferentes
  // para a mesma prova (ver o teste de consistência ao final deste arquivo).
  it('conta os dias até a prova', () => {
    expect(daysUntil('2026-01-17', new Date(2026, 0, 1, 12, 0))).toBe(16);
  });

  it('devolve zero no dia da prova', () => {
    expect(daysUntil('2026-01-17', new Date(2026, 0, 17, 23, 0))).toBe(0);
  });

  it('devolve negativo depois da prova', () => {
    expect(daysUntil('2026-01-17', new Date(2026, 0, 20, 0, 0))).toBe(-3);
  });

  it('ignora a hora do dia', () => {
    const cedo = daysUntil('2026-01-17', new Date(2026, 0, 1, 0, 1));
    const tarde = daysUntil('2026-01-17', new Date(2026, 0, 1, 23, 59));
    expect(cedo).toBe(tarde);
  });

  it('devolve null para data ausente ou inválida', () => {
    expect(daysUntil('', new Date(2026, 0, 1))).toBeNull();
    expect(daysUntil('não é data', new Date(2026, 0, 1))).toBeNull();
  });

  it('devolve null para uma data de calendário que não existe', () => {
    expect(daysUntil('2026-02-30', new Date(2026, 0, 1))).toBeNull();
  });

  it('trata a string da prova como um calendário local, nunca como um instante UTC', () => {
    // Regressão: `new Date('2026-01-17')` é meia-noite UTC. Em America/Sao_Paulo
    // (UTC-3) isso é 16/jan 21h local — se a data da prova fosse lida via
    // `Date.parse` + `getFullYear`/`getMonth`/`getDate` locais, a prova "voltaria"
    // um dia para quem está nesse fuso, e a contagem regressiva erraria por 1.
    expect(daysUntil('2026-01-17', new Date(2026, 0, 17))).toBe(0);
  });

  it('é determinística: o mesmo isoDate e o mesmo today sempre produzem o mesmo resultado', () => {
    // Base da regressão I1: o card do Portal e a barra lateral agora chamam a mesma
    // função pura com o mesmo `today`. Sendo pura e determinística, os dois nunca mais
    // podem divergir — a divergência só era possível quando cada tela tinha sua própria
    // conta (uma em UTC, outra em calendário local).
    const hoje = new Date(2026, 8, 13, 11, 45);
    expect(daysUntil('2026-01-17', hoje)).toBe(daysUntil('2026-01-17', hoje));
    expect(daysUntil('2026-01-17', hoje)).toBe(-239);
  });
});
