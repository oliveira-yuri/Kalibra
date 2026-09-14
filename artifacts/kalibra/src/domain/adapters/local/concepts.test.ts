import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Concept } from '@workspace/core';
import { migrateConcepts, getConcepts, saveConcepts, confirmConcept, useConcepts } from './concepts';

const CONCEPT: Concept = {
  id: 'concept-1',
  canonicalName: 'Porcentagem e juros simples',
  slug: 'porcentagem-e-juros-simples',
  parentId: null,
  kind: 'topico',
  aliases: [],
  status: 'provisional',
};

describe('migração de conceitos', () => {
  it('devolve lista vazia para lixo que não é array', () => {
    expect(migrateConcepts(null)).toEqual([]);
    expect(migrateConcepts(42)).toEqual([]);
    expect(migrateConcepts('texto')).toEqual([]);
    expect(migrateConcepts({})).toEqual([]);
  });

  it('devolve lista vazia para array vazio', () => {
    expect(migrateConcepts([])).toEqual([]);
  });

  it('preserva um conceito já no formato atual', () => {
    expect(migrateConcepts([CONCEPT])).toEqual([CONCEPT]);
  });

  it('é idempotente', () => {
    const primeiro = migrateConcepts([CONCEPT]);
    expect(migrateConcepts(primeiro)).toEqual(primeiro);
  });

  it('num array misto, mantém só o conceito bem formado e descarta o inválido', () => {
    const migrado = migrateConcepts([CONCEPT, { id: 42 }, null, 'lixo']);
    expect(migrado).toEqual([CONCEPT]);
  });

  it('descarta um conceito com chaves certas mas tipos de valor errados', () => {
    const migrado = migrateConcepts([{
      ...CONCEPT,
      canonicalName: 42,
      slug: true,
      kind: 'invalido',
      aliases: 'não é array',
      status: 'confuso',
    }]);
    expect(migrado).toEqual([]);
  });

  it('descarta um conceito com kind ou status fora do enum', () => {
    expect(migrateConcepts([{ ...CONCEPT, kind: 'capitulo' }])).toEqual([]);
    expect(migrateConcepts([{ ...CONCEPT, status: 'rascunho' }])).toEqual([]);
  });

  it('nunca lança para nenhuma combinação de lixo', () => {
    for (const entrada of [null, 42, 'texto', [], {}, [null, undefined, 1, 'x', {}]]) {
      expect(() => migrateConcepts(entrada)).not.toThrow();
    }
  });
});

describe('getConcepts / saveConcepts', () => {
  const KEY = 'kalibra_concepts:anonymous';

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('devolve lista vazia quando não há nada salvo', () => {
    expect(getConcepts()).toEqual([]);
  });

  it('faz o round-trip de salvar e ler', () => {
    saveConcepts([CONCEPT]);
    expect(getConcepts()).toEqual([CONCEPT]);
  });

  it('namespacea a chave por usuário, sem slug de workspace', () => {
    saveConcepts([CONCEPT], 'user-1');
    expect(localStorage.getItem('kalibra_concepts:user-1')).not.toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('nunca lança para JSON corrompido e devolve lista vazia', () => {
    localStorage.setItem(KEY, 'não é json{{{');
    expect(() => getConcepts()).not.toThrow();
    expect(getConcepts()).toEqual([]);
  });

  it('mantém os conceitos válidos quando um registro é lixo irreconhecível', () => {
    localStorage.setItem(KEY, JSON.stringify([CONCEPT, { lixo: true }, null]));
    expect(getConcepts().map((c) => c.id)).toEqual(['concept-1']);
  });
});

describe('confirmConcept', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('promove o conceito referenciado a confirmed e persiste', () => {
    saveConcepts([CONCEPT]);
    const next = confirmConcept('concept-1');
    expect(next[0].status).toBe('confirmed');
    expect(getConcepts()[0].status).toBe('confirmed');
  });

  it('não afeta conceitos com outro id', () => {
    const outro: Concept = { ...CONCEPT, id: 'concept-2' };
    saveConcepts([CONCEPT, outro]);
    const next = confirmConcept('concept-1');
    expect(next.find((c) => c.id === 'concept-2')).toEqual(outro);
  });
});

describe('useConcepts — duas escritas síncronas no mesmo tick sobrevivem ambas', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('addConcept chamado duas vezes em act() único mantém os dois conceitos', () => {
    const { result } = renderHook(() => useConcepts());
    const a: Concept = { ...CONCEPT, id: 'a' };
    const b: Concept = { ...CONCEPT, id: 'b' };

    act(() => {
      result.current.addConcept(a);
      result.current.addConcept(b);
    });

    expect(result.current.concepts.map((c) => c.id)).toEqual(['a', 'b']);
    expect(getConcepts().map((c) => c.id)).toEqual(['a', 'b']);
  });
});
