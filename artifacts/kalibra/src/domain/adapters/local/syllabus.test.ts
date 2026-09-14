import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Syllabus, SyllabusItem, SyllabusItemCargo } from '@workspace/core';
import { migrateSyllabus, getSyllabus, saveSyllabus, useSyllabus } from './syllabus';
import { getConcepts } from './concepts';

const ITEM: SyllabusItem = {
  id: 'item-1',
  workspaceId: 'setec-campinas',
  conceptId: 'concept-1',
  parentItemId: null,
  sourceLabel: 'Crase',
  sourceExcerpt: null,
  page: null,
  confidence: 0.9,
  uncertain: false,
};

const LINK: SyllabusItemCargo = {
  syllabusItemId: 'item-1',
  cargoId: 'c1',
  weight: 25,
  questionCount: 10,
};

const SYLLABUS: Syllabus = { items: [ITEM], links: [LINK] };

describe('migração do programa de estudo', () => {
  it('devolve null para lixo que não é objeto', () => {
    expect(migrateSyllabus(null)).toBeNull();
    expect(migrateSyllabus(42)).toBeNull();
    expect(migrateSyllabus('texto')).toBeNull();
    expect(migrateSyllabus([])).toBeNull();
  });

  it('trata items em formato errado como programa vazio, não como lixo total', () => {
    const migrado = migrateSyllabus({ items: 'x' });
    expect(migrado).not.toBeNull();
    expect(migrado?.items).toEqual([]);
    expect(migrado?.links).toEqual([]);
  });

  it('descarta um item nulo dentro de items sem derrubar o registro', () => {
    const migrado = migrateSyllabus({ items: [null], links: [] });
    expect(migrado).toEqual({ items: [], links: [] });
  });

  it('preserva um programa já no formato atual', () => {
    expect(migrateSyllabus(SYLLABUS)).toEqual(SYLLABUS);
  });

  it('é idempotente', () => {
    const primeiro = migrateSyllabus(SYLLABUS);
    expect(migrateSyllabus(primeiro)).toEqual(primeiro);
  });

  it('num array misto, mantém só o item bem formado e descarta o inválido', () => {
    const migrado = migrateSyllabus({ items: [ITEM, { id: 42 }, null], links: [LINK] });
    expect(migrado?.items).toEqual([ITEM]);
    expect(migrado?.links).toEqual([LINK]);
  });

  it('descarta item com chaves certas mas tipos de valor errados', () => {
    const migrado = migrateSyllabus({
      items: [{ ...ITEM, confidence: 'alta', uncertain: 'não' }],
      links: [],
    });
    expect(migrado?.items).toEqual([]);
  });

  it('não deixa uma ligação órfã (cargo que não existe mais) derrubar a leitura', () => {
    const linkOrfao: SyllabusItemCargo = { syllabusItemId: 'item-fantasma', cargoId: 'cargo-removido', weight: null, questionCount: null };
    expect(() => migrateSyllabus({ items: [ITEM], links: [linkOrfao] })).not.toThrow();
    const migrado = migrateSyllabus({ items: [ITEM], links: [linkOrfao] });
    expect(migrado?.links).toEqual([linkOrfao]);
    expect(migrado?.items).toEqual([ITEM]);
  });

  it('descarta uma ligação malformada sem derrubar as demais', () => {
    const migrado = migrateSyllabus({ items: [ITEM], links: [LINK, { cargoId: 42 }, null] });
    expect(migrado?.links).toEqual([LINK]);
  });
});

describe('getSyllabus / saveSyllabus', () => {
  const KEY = 'kalibra_syllabus:anonymous:setec-campinas';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('devolve um programa vazio quando não há nada salvo', () => {
    expect(getSyllabus('setec-campinas')).toEqual({ items: [], links: [] });
  });

  it('faz o round-trip de salvar e ler', () => {
    saveSyllabus(SYLLABUS, 'setec-campinas');
    expect(getSyllabus('setec-campinas')).toEqual(SYLLABUS);
  });

  it('namespacea a chave por usuário e por workspace', () => {
    saveSyllabus(SYLLABUS, 'setec-campinas', 'user-1');
    expect(localStorage.getItem('kalibra_syllabus:user-1:setec-campinas')).not.toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('não guarda conceitos junto do programa — eles vivem em kalibra_concepts, não em kalibra_syllabus', () => {
    saveSyllabus(SYLLABUS, 'setec-campinas');
    const saved = JSON.parse(localStorage.getItem(KEY)!);
    expect(saved).not.toHaveProperty('concepts');
  });

  it('nunca lança e descarta um registro totalmente corrompido', () => {
    localStorage.setItem(KEY, 'não é json válido{{{');
    expect(() => getSyllabus('setec-campinas')).not.toThrow();
    expect(getSyllabus('setec-campinas')).toEqual({ items: [], links: [] });
  });
});

describe('useSyllabus — conceitos vêm da biblioteca global, não do workspace', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('addItem grava o conceito em kalibra_concepts (visível a qualquer workspace do mesmo usuário)', () => {
    const { result } = renderHook(() => useSyllabus('setec-campinas', 'user-1'));

    act(() => {
      result.current.addItem(null, 'Direito Constitucional', ['c1']);
    });

    expect(result.current.concepts).toHaveLength(1);
    expect(result.current.concepts[0].canonicalName).toBe('Direito Constitucional');
    expect(result.current.concepts[0].status).toBe('provisional');
    // A mesma biblioteca de conceitos, lida independentemente do workspace.
    expect(getConcepts('user-1')).toHaveLength(1);

    // Um segundo workspace do MESMO usuário enxerga o mesmo conceito —
    // é a razão de existir de um conceito global (achado 1 da revisão).
    const outroWorkspace = renderHook(() => useSyllabus('bb-escriturario', 'user-1'));
    expect(outroWorkspace.result.current.concepts).toHaveLength(1);
    expect(outroWorkspace.result.current.concepts[0].canonicalName).toBe('Direito Constitucional');
  });

  it('duas chamadas de addItem no mesmo tick sobrevivem ambas (achado 3 da revisão)', () => {
    const { result } = renderHook(() => useSyllabus('setec-campinas', 'user-1'));

    act(() => {
      result.current.addItem(null, 'Direito Constitucional', ['c1']);
      result.current.addItem(null, 'Direito Administrativo', ['c1']);
    });

    expect(result.current.syllabus.items).toHaveLength(2);
    expect(result.current.syllabus.items.map((item) => item.sourceLabel)).toEqual([
      'Direito Constitucional',
      'Direito Administrativo',
    ]);
    expect(result.current.concepts).toHaveLength(2);
    expect(getSyllabus('setec-campinas', 'user-1').items).toHaveLength(2);
  });
});

describe('useSyllabus.previewExtraction — fix round 1, Finding 2 (nunca persiste)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('computa a proposta de dedupeEntries sem gravar o Syllabus nem os conceitos novos', () => {
    saveSyllabus(SYLLABUS, 'setec-campinas', 'user-1');
    const { result } = renderHook(() => useSyllabus('setec-campinas', 'user-1'));

    let preview: ReturnType<typeof result.current.previewExtraction>;
    act(() => {
      preview = result.current.previewExtraction({
        entries: [{
          cargoId: 'c1', label: 'Disciplina nova', parentLabel: null,
          weight: null, questionCount: null, sourceExcerpt: null, page: null, confidence: 1,
        }],
        detectedCargos: ['c1'],
        examFormat: null,
        examDurationMinutes: null,
        uncertainties: [],
      });
    });

    expect(preview!.syllabus.items.map((item) => item.sourceLabel)).toEqual(['Disciplina nova']);
    expect(preview!.newConcepts).toHaveLength(1);

    // Nada foi escrito: o Syllabus salvo continua sendo o de antes da chamada, e a
    // biblioteca de conceitos continua vazia — `previewExtraction` é pura.
    expect(getSyllabus('setec-campinas', 'user-1')).toEqual(SYLLABUS);
    expect(getConcepts('user-1')).toEqual([]);
    expect(result.current.syllabus).toEqual(SYLLABUS);
    expect(result.current.concepts).toEqual([]);
  });

  it('chamar previewExtraction duas vezes seguidas não muda nada no estado nem no storage', () => {
    const { result } = renderHook(() => useSyllabus('setec-campinas', 'user-1'));

    act(() => {
      result.current.previewExtraction({
        entries: [{
          cargoId: 'c1', label: 'A', parentLabel: null,
          weight: null, questionCount: null, sourceExcerpt: null, page: null, confidence: 1,
        }],
        detectedCargos: ['c1'], examFormat: null, examDurationMinutes: null, uncertainties: [],
      });
      result.current.previewExtraction({
        entries: [{
          cargoId: 'c1', label: 'B', parentLabel: null,
          weight: null, questionCount: null, sourceExcerpt: null, page: null, confidence: 1,
        }],
        detectedCargos: ['c1'], examFormat: null, examDurationMinutes: null, uncertainties: [],
      });
    });

    expect(getSyllabus('setec-campinas', 'user-1')).toEqual({ items: [], links: [] });
    expect(getConcepts('user-1')).toEqual([]);
  });
});
