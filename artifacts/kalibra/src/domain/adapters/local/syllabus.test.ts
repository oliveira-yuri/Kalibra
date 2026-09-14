import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Syllabus, SyllabusItem, SyllabusItemCargo } from '@workspace/core';
import { migrateSyllabus, getSyllabusRecord, saveSyllabusRecord } from './syllabus';

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

describe('getSyllabusRecord / saveSyllabusRecord', () => {
  const KEY = 'kalibra_syllabus:anonymous:setec-campinas';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('devolve um programa vazio quando não há nada salvo', () => {
    const record = getSyllabusRecord('setec-campinas');
    expect(record.syllabus).toEqual({ items: [], links: [] });
    expect(record.concepts).toEqual([]);
  });

  it('faz o round-trip de salvar e ler', () => {
    saveSyllabusRecord({ syllabus: SYLLABUS, concepts: [] }, 'setec-campinas');
    const record = getSyllabusRecord('setec-campinas');
    expect(record.syllabus).toEqual(SYLLABUS);
  });

  it('namespacea a chave por usuário e por workspace', () => {
    saveSyllabusRecord({ syllabus: SYLLABUS, concepts: [] }, 'setec-campinas', 'user-1');
    expect(localStorage.getItem('kalibra_syllabus:user-1:setec-campinas')).not.toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('nunca lança e descarta um registro totalmente corrompido', () => {
    localStorage.setItem(KEY, 'não é json válido{{{');
    expect(() => getSyllabusRecord('setec-campinas')).not.toThrow();
    expect(getSyllabusRecord('setec-campinas').syllabus).toEqual({ items: [], links: [] });
  });
});
