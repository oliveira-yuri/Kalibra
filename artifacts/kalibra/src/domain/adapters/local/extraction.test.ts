import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExtraction } from './extraction';

const STAGE_TOTAL_MS = 400 + 900 + 900 + 100; // enviando + extraindo + identificando + folga

describe('useExtraction — achado 4 da revisão: os quatro estágios/erros precisam de teste', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('progress começa em "enviando" antes de qualquer avanço de tempo', () => {
    const { result } = renderHook(() => useExtraction('setec-campinas'));
    act(() => {
      result.current.start({ sourceMode: 'text', text: 'pouco texto', cargoIds: ['c1'] });
    });
    expect(result.current.progress.stage).toBe('enviando');
  });

  it('texto com menos de 50 palavras produz o erro "short"', async () => {
    const { result } = renderHook(() => useExtraction('setec-campinas'));

    act(() => {
      result.current.start({ sourceMode: 'text', text: 'texto curto demais para ser um edital de verdade', cargoIds: ['c1'] });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STAGE_TOTAL_MS);
    });

    expect(result.current.progress.stage).toBe('erro');
    expect(result.current.progress.errorKind).toBe('short');
    expect(result.current.output).toBeNull();
  });

  it('texto longo sem nenhuma disciplina reconhecível produz o erro "structure"', async () => {
    const prosaSemEstrutura = Array(60).fill('palavra').join(' ');
    const { result } = renderHook(() => useExtraction('setec-campinas'));

    act(() => {
      result.current.start({ sourceMode: 'text', text: prosaSemEstrutura, cargoIds: ['c1'] });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STAGE_TOTAL_MS);
    });

    expect(result.current.progress.stage).toBe('erro');
    expect(result.current.progress.errorKind).toBe('structure');
    expect(result.current.output).toBeNull();
  });

  it('caminho feliz: texto estruturado e longo o bastante produz entradas e chega a "pronto"', async () => {
    const texto = [
      'DIREITO CONSTITUCIONAL',
      'Princípios fundamentais',
      'Direitos e garantias individuais',
      Array(50).fill('palavra').join(' '),
    ].join('\n');
    const { result } = renderHook(() => useExtraction('setec-campinas'));

    act(() => {
      result.current.start({ sourceMode: 'text', text: texto, cargoIds: ['c1'] });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STAGE_TOTAL_MS);
    });

    expect(result.current.progress.stage).toBe('pronto');
    expect(result.current.progress.errorKind).toBeNull();
    expect(result.current.output).not.toBeNull();
    expect(result.current.output!.entries.length).toBeGreaterThan(0);
  });

  it('sourceMode "file" produz a estrutura de demonstração mesmo sem cargoIds', async () => {
    const { result } = renderHook(() => useExtraction('setec-campinas'));

    act(() => {
      result.current.start({ sourceMode: 'file', text: '', cargoIds: [] });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STAGE_TOTAL_MS);
    });

    expect(result.current.progress.stage).toBe('pronto');
    expect(result.current.output!.entries.length).toBeGreaterThan(0);
  });

  it('percorre os estágios enviando -> extraindo -> identificando -> pronto, na ordem', async () => {
    const texto = ['DISCIPLINA ÚNICA', Array(60).fill('palavra').join(' ')].join('\n');
    const { result } = renderHook(() => useExtraction('setec-campinas'));

    act(() => {
      result.current.start({ sourceMode: 'text', text: texto, cargoIds: ['c1'] });
    });
    expect(result.current.progress.stage).toBe('enviando');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(result.current.progress.stage).toBe('extraindo');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(result.current.progress.stage).toBe('identificando');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(result.current.progress.stage).toBe('pronto');
  });

  it('cancel() interrompe antes de chegar a "pronto"', async () => {
    const texto = ['DISCIPLINA ÚNICA', Array(60).fill('palavra').join(' ')].join('\n');
    const { result } = renderHook(() => useExtraction('setec-campinas'));

    act(() => {
      result.current.start({ sourceMode: 'text', text: texto, cargoIds: ['c1'] });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(result.current.progress.stage).toBe('extraindo');

    act(() => {
      result.current.cancel();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STAGE_TOTAL_MS);
    });

    expect(result.current.progress.stage).toBe('extraindo');
    expect(result.current.output).toBeNull();
  });
});
