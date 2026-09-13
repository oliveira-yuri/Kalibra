import { describe, it, expect } from 'vitest';
import { newFsrsState, scheduleReview, isDue, previewIntervals } from './schedule';

const NOW = new Date('2026-09-13T10:00:00Z');

describe('estado inicial', () => {
  it('nasce vencido, para ser revisado na hora', () => {
    const state = newFsrsState(NOW);
    expect(isDue(state, NOW)).toBe(true);
    expect(state.reps).toBe(0);
    expect(state.lapses).toBe(0);
    expect(state.lastReviewAt).toBeNull();
  });
});

describe('agendamento', () => {
  it('conta a revisão', () => {
    const next = scheduleReview(newFsrsState(NOW), 'bom', NOW);
    expect(next.reps).toBe(1);
    expect(next.lastReviewAt).toBe(NOW.toISOString());
  });

  it('adia mais quanto melhor a recuperação', () => {
    const inicial = newFsrsState(NOW);
    const nada = new Date(scheduleReview(inicial, 'nada', NOW).dueAt).getTime();
    const parcial = new Date(scheduleReview(inicial, 'parcial', NOW).dueAt).getTime();
    const bom = new Date(scheduleReview(inicial, 'bom', NOW).dueAt).getTime();
    const completo = new Date(scheduleReview(inicial, 'completo', NOW).dueAt).getTime();

    expect(nada).toBeLessThan(parcial);
    expect(parcial).toBeLessThan(bom);
    expect(bom).toBeLessThan(completo);
  });

  it('conta lapso quando o usuário não recupera nada', () => {
    const estudado = scheduleReview(newFsrsState(NOW), 'bom', NOW);
    const depois = new Date('2026-09-20T10:00:00Z');
    const esquecido = scheduleReview(estudado, 'nada', depois);
    expect(esquecido.lapses).toBe(1);
  });

  it('não conta lapso numa recuperação bem-sucedida', () => {
    const estudado = scheduleReview(newFsrsState(NOW), 'bom', NOW);
    expect(estudado.lapses).toBe(0);
  });

  it('ganha estabilidade ao longo de revisões boas', () => {
    let state = newFsrsState(NOW);
    state = scheduleReview(state, 'bom', NOW);
    const primeira = state.stability;
    state = scheduleReview(state, 'bom', new Date(state.dueAt));
    expect(state.stability).toBeGreaterThan(primeira);
  });

  it('agenda sempre no futuro', () => {
    const next = scheduleReview(newFsrsState(NOW), 'nada', NOW);
    expect(new Date(next.dueAt).getTime()).toBeGreaterThan(NOW.getTime());
  });
});

describe('vencimento', () => {
  it('não está vencido antes da data', () => {
    const state = scheduleReview(newFsrsState(NOW), 'completo', NOW);
    expect(isDue(state, NOW)).toBe(false);
  });

  it('está vencido na data ou depois', () => {
    const state = scheduleReview(newFsrsState(NOW), 'bom', NOW);
    expect(isDue(state, new Date(state.dueAt))).toBe(true);
  });
});

describe('prévia de intervalos', () => {
  it('dá um intervalo para cada nota, em ordem estritamente crescente', () => {
    const preview = previewIntervals(newFsrsState(NOW), NOW);
    expect(preview.nada).toBeLessThan(preview.parcial);
    expect(preview.parcial).toBeLessThan(preview.bom);
    expect(preview.bom).toBeLessThan(preview.completo);
  });

  it('devolve dias inteiros não negativos', () => {
    const preview = previewIntervals(newFsrsState(NOW), NOW);
    for (const dias of Object.values(preview)) {
      expect(Number.isInteger(dias)).toBe(true);
      expect(dias).toBeGreaterThanOrEqual(0);
    }
  });

  it('nunca agenda no mesmo dia: sem learning steps de curto prazo, o menor intervalo é de pelo menos 1 dia', () => {
    const preview = previewIntervals(newFsrsState(NOW), NOW);
    const menorIntervalo = Math.min(...Object.values(preview));
    expect(menorIntervalo).toBeGreaterThanOrEqual(1);
  });
});
