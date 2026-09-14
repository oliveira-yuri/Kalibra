import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExtraction, type ExtractionInput } from './extraction';
import type { ExtractionOutput, ExtractionProgress } from '@workspace/core';

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
      result.current.start({ sourceMode: 'text', blocks: [{ cargoId: null, text: 'pouco texto' }], cargoIds: ['c1'] });
    });
    expect(result.current.progress.stage).toBe('enviando');
  });

  it('texto com menos de 50 palavras produz o erro "short"', async () => {
    const { result } = renderHook(() => useExtraction('setec-campinas'));

    act(() => {
      result.current.start({ sourceMode: 'text', blocks: [{ cargoId: null, text: 'texto curto demais para ser um edital de verdade' }], cargoIds: ['c1'] });
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
      result.current.start({ sourceMode: 'text', blocks: [{ cargoId: null, text: prosaSemEstrutura }], cargoIds: ['c1'] });
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
      result.current.start({ sourceMode: 'text', blocks: [{ cargoId: null, text: texto }], cargoIds: ['c1'] });
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
      result.current.start({ sourceMode: 'file', blocks: [], cargoIds: [] });
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
      result.current.start({ sourceMode: 'text', blocks: [{ cargoId: null, text: texto }], cargoIds: ['c1'] });
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
      result.current.start({ sourceMode: 'text', blocks: [{ cargoId: null, text: texto }], cargoIds: ['c1'] });
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

describe('blocos por cargo (Fase 1B.5)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function runExtraction(input: ExtractionInput): Promise<ExtractionOutput> {
    const { result } = renderHook(() => useExtraction('w'));

    act(() => {
      result.current.start(input);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STAGE_TOTAL_MS);
    });

    return result.current.output!;
  }

  async function runExtractionExpectingError(input: ExtractionInput): Promise<ExtractionProgress> {
    const { result } = renderHook(() => useExtraction('w'));

    act(() => {
      result.current.start(input);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STAGE_TOTAL_MS);
    });

    return result.current.progress;
  }

  const LONGO = Array.from({ length: 60 }, (_, index) => 'palavra' + index).join(' ');

  it('um bloco específico só gera entradas do seu cargo', async () => {
    const output = await runExtraction({
      sourceMode: 'text',
      cargoIds: ['c1', 'c2'],
      blocks: [
        { cargoId: null, text: 'LÍNGUA PORTUGUESA\nInterpretação de texto\n' + LONGO },
        { cargoId: 'c2', text: 'INFORMÁTICA\nRedes de computadores' },
      ],
    });

    const informatica = output.entries.filter((entry) => entry.label === 'INFORMÁTICA');
    expect(informatica.map((entry) => entry.cargoId)).toEqual(['c2']);
  });

  it('um bloco comum gera entradas para TODOS os cargos', async () => {
    const output = await runExtraction({
      sourceMode: 'text',
      cargoIds: ['c1', 'c2'],
      blocks: [{ cargoId: null, text: 'LÍNGUA PORTUGUESA\nInterpretação de texto\n' + LONGO }],
    });

    const portugues = output.entries.filter((entry) => entry.label === 'LÍNGUA PORTUGUESA');
    expect(portugues.map((entry) => entry.cargoId).sort()).toEqual(['c1', 'c2']);
  });

  it('o conteúdo de um cargo NÃO aparece no outro', async () => {
    const output = await runExtraction({
      sourceMode: 'text',
      cargoIds: ['c1', 'c2'],
      blocks: [
        { cargoId: 'c1', text: 'DIREITO ADMINISTRATIVO\nAtos administrativos\n' + LONGO },
        { cargoId: 'c2', text: 'INFORMÁTICA\nRedes de computadores' },
      ],
    });

    const doCargo1 = output.entries.filter((entry) => entry.cargoId === 'c1').map((entry) => entry.label);
    expect(doCargo1).not.toContain('INFORMÁTICA');
    expect(doCargo1).not.toContain('Redes de computadores');
  });

  it('a contagem de palavras conta cada bloco UMA vez, não o resultado expandido', async () => {
    // 30 palavras num bloco comum, com 5 cargos. Se a contagem usasse o expandido
    // seriam 150 palavras e o edital passaria no limiar de 50 sem ter tamanho nenhum.
    const trinta = Array.from({ length: 30 }, (_, index) => 'p' + index).join(' ');
    const progress = await runExtractionExpectingError({
      sourceMode: 'text',
      cargoIds: ['c1', 'c2', 'c3', 'c4', 'c5'],
      blocks: [{ cargoId: null, text: 'MATÉRIA\n' + trinta }],
    });
    expect(progress.errorKind).toBe('short');
  });

  it('modo arquivo continua gerando conteúdo comum a todos os cargos', async () => {
    const output = await runExtraction({ sourceMode: 'file', cargoIds: ['c1', 'c2'], blocks: [] });
    const portugues = output.entries.filter((entry) => entry.label === 'Língua Portuguesa');
    expect(portugues.map((entry) => entry.cargoId).sort()).toEqual(['c1', 'c2']);
  });
});
