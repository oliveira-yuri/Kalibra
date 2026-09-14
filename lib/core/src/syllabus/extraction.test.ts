import { describe, it, expect } from 'vitest';
import { validateExtractionOutput, EXTRACTION_ERROR_MESSAGES, expandBlocks } from './extraction';

const VALIDO = {
  entries: [{
    cargoId: 'c1', label: 'Crase', parentLabel: null, weight: 25,
    questionCount: 10, sourceExcerpt: null, page: null, confidence: 0.9,
  }],
  detectedCargos: ['Analista'],
  examFormat: 'múltipla escolha, 4 alternativas',
  examDurationMinutes: 210,
  uncertainties: [],
};

describe('validação da saída da extração', () => {
  it('aceita uma saída completa', () => {
    expect(validateExtractionOutput(VALIDO)).not.toBeNull();
  });

  it('rejeita entrada que não é objeto', () => {
    expect(validateExtractionOutput(null)).toBeNull();
    expect(validateExtractionOutput('texto')).toBeNull();
    expect(validateExtractionOutput([])).toBeNull();
    expect(validateExtractionOutput(42)).toBeNull();
  });

  it('rejeita quando entries não é array', () => {
    expect(validateExtractionOutput({ ...VALIDO, entries: 'x' })).toBeNull();
  });

  it('descarta entradas malformadas sem derrubar a extração inteira', () => {
    const saida = validateExtractionOutput({
      ...VALIDO,
      entries: [null, VALIDO.entries[0], { label: 42 }],
    });
    expect(saida?.entries).toHaveLength(1);
  });

  it('aceita campos opcionais ausentes', () => {
    const saida = validateExtractionOutput({ entries: [] });
    expect(saida?.detectedCargos).toEqual([]);
    expect(saida?.examFormat).toBeNull();
    expect(saida?.uncertainties).toEqual([]);
  });

  it('normaliza confiança fora da faixa', () => {
    const saida = validateExtractionOutput({
      entries: [{ ...VALIDO.entries[0], confidence: 5 }],
    });
    expect(saida?.entries[0].confidence).toBe(1);
  });

  it('descarta objeto com as chaves certas mas tipos errados dentro de entries', () => {
    const saida = validateExtractionOutput({
      entries: [{ cargoId: 42, label: true, parentLabel: 9, weight: 'x', questionCount: 'y', sourceExcerpt: 1, page: 'z', confidence: 'nan' }],
    });
    expect(saida?.entries).toEqual([]);
  });

  it('é idempotente: validar uma saída já validada devolve o mesmo resultado', () => {
    const primeira = validateExtractionOutput(VALIDO);
    const segunda = validateExtractionOutput(primeira);
    expect(segunda).toEqual(primeira);
  });
});

describe('mensagens de erro', () => {
  it('tem mensagem e ação para os quatro tipos', () => {
    for (const kind of ['scanned', 'corrupted', 'short', 'structure'] as const) {
      expect(EXTRACTION_ERROR_MESSAGES[kind].message.length).toBeGreaterThan(0);
      expect(EXTRACTION_ERROR_MESSAGES[kind].action.length).toBeGreaterThan(0);
    }
  });

  // Fix round 1 (achado menor): o teste acima só provava que as strings não estavam
  // vazias — um "Erro." passaria. Fixado contra o texto literal do PD-07, para que o
  // copy não possa derivar do spec com a suíte verde.
  it('mensagem e ação batem literalmente com o texto do PD-07', () => {
    expect(EXTRACTION_ERROR_MESSAGES).toEqual({
      scanned: {
        message: 'Este PDF é uma imagem, não texto. Não é possível extrair o conteúdo automaticamente.',
        action: 'Colar o texto manualmente',
      },
      corrupted: {
        message: 'Não foi possível abrir o arquivo.',
        action: 'Enviar outro arquivo',
      },
      short: {
        message: 'O conteúdo enviado tem poucas palavras. Verifique se é o edital completo.',
        action: 'Enviar mesmo assim',
      },
      structure: {
        message: 'O conteúdo foi extraído, mas não conseguimos identificar a estrutura.',
        action: 'Montar manualmente',
      },
    });
  });
});

describe('expandBlocks', () => {
  it('um bloco comum vira uma entrada por cargo, com o mesmo texto', () => {
    const result = expandBlocks([{ cargoId: null, text: 'PORTUGUÊS' }], ['c1', 'c2']);
    expect(result).toEqual([
      { cargoId: 'c1', text: 'PORTUGUÊS' },
      { cargoId: 'c2', text: 'PORTUGUÊS' },
    ]);
  });

  it('um bloco de cargo vale só para aquele cargo', () => {
    const result = expandBlocks([{ cargoId: 'c2', text: 'INFORMÁTICA' }], ['c1', 'c2']);
    expect(result).toEqual([{ cargoId: 'c2', text: 'INFORMÁTICA' }]);
  });

  it('bloco de um cargo que não existe mais é DESCARTADO, nunca promovido a comum', () => {
    // O usuário digitou o específico do cargo c3 e depois removeu c3 do workspace.
    // Tratar isso como conteúdo comum daria a todos os cargos um conteúdo que
    // ninguém pediu — contaminação silenciosa, que é o que esta fase existe para matar.
    const result = expandBlocks(
      [{ cargoId: null, text: 'COMUM' }, { cargoId: 'c3', text: 'ÓRFÃO' }],
      ['c1', 'c2'],
    );
    expect(result).toEqual([
      { cargoId: 'c1', text: 'COMUM' },
      { cargoId: 'c2', text: 'COMUM' },
    ]);
  });

  it('bloco vazio ou só com espaços não produz nada', () => {
    const result = expandBlocks(
      [{ cargoId: null, text: '   \n  ' }, { cargoId: 'c1', text: '' }],
      ['c1'],
    );
    expect(result).toEqual([]);
  });

  it('sem cargo nenhum, um bloco comum não tem a quem pertencer e não produz nada', () => {
    expect(expandBlocks([{ cargoId: null, text: 'PORTUGUÊS' }], [])).toEqual([]);
  });

  it('preserva a ordem dos blocos e, dentro do comum, a ordem dos cargos', () => {
    const result = expandBlocks(
      [{ cargoId: 'c2', text: 'B' }, { cargoId: null, text: 'A' }],
      ['c1', 'c2'],
    );
    expect(result.map((pair) => pair.cargoId + ':' + pair.text)).toEqual(['c2:B', 'c1:A', 'c2:A']);
  });
});
