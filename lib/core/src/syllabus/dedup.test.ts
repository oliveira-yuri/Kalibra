import { describe, it, expect } from 'vitest';
import { dedupeEntries, splitItem, type RawSyllabusEntry } from './dedup';
import { cargosFor, isCommon } from './syllabus';
import type { Concept } from './concept';

let counter = 0;
const makeId = (seed: string) => `${seed}-${(counter += 1)}`;
const resetIds = () => { counter = 0; };

const entrada = (over: Partial<RawSyllabusEntry> & { cargoId: string; label: string }): RawSyllabusEntry => ({
  parentLabel: null, weight: null, questionCount: null,
  sourceExcerpt: null, page: null, confidence: 1, ...over,
});

describe('deduplicação entre cargos', () => {
  it('une conteúdo idêntico em um item com dois cargos', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: 'Matemática básica', questionCount: 10 }),
      entrada({ cargoId: 'c2', label: 'Matemática básica', questionCount: 10 }),
    ], [], makeId);

    expect(syllabus.items).toHaveLength(1);
    expect(syllabus.links).toHaveLength(2);
    expect(isCommon(syllabus, syllabus.items[0].id)).toBe(true);
  });

  it('une apesar de diferença de acento, caixa e numeração', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: '1.1 Matemática Básica' }),
      entrada({ cargoId: 'c2', label: 'MATEMATICA BASICA' }),
    ], [], makeId);

    expect(syllabus.items).toHaveLength(1);
    expect(cargosFor(syllabus, syllabus.items[0].id)).toEqual(['c1', 'c2']);
  });

  it('mantém conteúdo específico separado', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: 'Legislação' }),
      entrada({ cargoId: 'c2', label: 'Tecnologia' }),
    ], [], makeId);

    expect(syllabus.items).toHaveLength(2);
    expect(syllabus.items.every((item) => !isCommon(syllabus, item.id))).toBe(true);
  });

  it('preserva peso e quantidade por cargo', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: 'Matemática', weight: 25, questionCount: 10 }),
      entrada({ cargoId: 'c2', label: 'Matemática', weight: 30, questionCount: 12 }),
    ], [], makeId);

    const c1 = syllabus.links.find((l) => l.cargoId === 'c1');
    const c2 = syllabus.links.find((l) => l.cargoId === 'c2');
    expect(c1?.weight).toBe(25);
    expect(c1?.questionCount).toBe(10);
    expect(c2?.weight).toBe(30);
    expect(c2?.questionCount).toBe(12);
  });

  it('preserva o rótulo literal do primeiro cargo e registra os unidos', () => {
    resetIds();
    const { syllabus, merged } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: '1.1 Matemática Básica' }),
      entrada({ cargoId: 'c2', label: 'MATEMATICA BASICA' }),
    ], [], makeId);

    expect(syllabus.items[0].sourceLabel).toBe('1.1 Matemática Básica');
    expect(merged).toHaveLength(1);
    expect(merged[0].labels).toEqual(['1.1 Matemática Básica', 'MATEMATICA BASICA']);
  });

  it('não une duas entradas do mesmo cargo', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: 'Matemática' }),
      entrada({ cargoId: 'c1', label: 'Matemática' }),
    ], [], makeId);

    expect(syllabus.links.filter((l) => l.cargoId === 'c1')).toHaveLength(1);
  });

  it('marca como incerto quando a confiança é baixa', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: 'Algo ambíguo', confidence: 0.4 }),
    ], [], makeId);

    expect(syllabus.items[0].uncertain).toBe(true);
  });

  it('constrói a hierarquia a partir de parentLabel', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: 'Matemática' }),
      entrada({ cargoId: 'c1', label: 'Porcentagem', parentLabel: 'Matemática' }),
    ], [], makeId);

    const pai = syllabus.items.find((i) => i.sourceLabel === 'Matemática');
    const filho = syllabus.items.find((i) => i.sourceLabel === 'Porcentagem');
    expect(filho?.parentItemId).toBe(pai?.id);
    expect(pai?.parentItemId).toBeNull();
  });

  it('devolve programa vazio para entrada vazia', () => {
    resetIds();
    const { syllabus, merged } = dedupeEntries('w1', [], [], makeId);
    expect(syllabus.items).toEqual([]);
    expect(merged).toEqual([]);
  });

  it('ignora entradas cujo rótulo normaliza para nada', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: '1.2.' }),
      entrada({ cargoId: 'c1', label: 'Crase' }),
    ], [], makeId);
    expect(syllabus.items).toHaveLength(1);
    expect(syllabus.items[0].sourceLabel).toBe('Crase');
  });
});

describe('ligação com conceitos existentes', () => {
  const confirmado: Concept = {
    id: 'global-crase', canonicalName: 'Crase', slug: 'crase',
    parentId: null, kind: 'topico', aliases: [], status: 'confirmed',
  };

  it('liga direto a conceito confirmado que casa', () => {
    resetIds();
    const { syllabus, newConcepts, proposedLinks } = dedupeEntries(
      'w1', [entrada({ cargoId: 'c1', label: 'Crase' })], [confirmado], makeId,
    );
    expect(syllabus.items[0].conceptId).toBe('global-crase');
    expect(newConcepts).toEqual([]);
    expect(proposedLinks).toEqual([]);
  });

  it('liga direto apesar de acento, caixa e numeração', () => {
    resetIds();
    const { syllabus } = dedupeEntries(
      'w1', [entrada({ cargoId: 'c1', label: '2.1 CRASE' })], [confirmado], makeId,
    );
    expect(syllabus.items[0].conceptId).toBe('global-crase');
  });

  it('NÃO liga a conceito provisório, e propõe a ligação', () => {
    resetIds();
    const provisorio = { ...confirmado, status: 'provisional' as const };
    const { syllabus, newConcepts, proposedLinks } = dedupeEntries(
      'w1', [entrada({ cargoId: 'c1', label: 'Crase' })], [provisorio], makeId,
    );
    expect(syllabus.items[0].conceptId).not.toBe('global-crase');
    expect(newConcepts).toHaveLength(1);
    expect(newConcepts[0].status).toBe('provisional');
    expect(proposedLinks).toEqual([
      { itemId: syllabus.items[0].id, conceptId: 'global-crase', score: 1, reason: 'provisional_concept' },
    ]);
  });

  it('cria conceito provisório quando não casa com nada', () => {
    resetIds();
    const { syllabus, newConcepts, proposedLinks } = dedupeEntries(
      'w1', [entrada({ cargoId: 'c1', label: 'Tecnologia da informação' })], [confirmado], makeId,
    );
    expect(newConcepts).toHaveLength(1);
    expect(newConcepts[0].status).toBe('provisional');
    expect(newConcepts[0].canonicalName).toBe('Tecnologia da informação');
    expect(syllabus.items[0].conceptId).toBe(newConcepts[0].id);
    expect(proposedLinks).toEqual([]);
  });

  it('itens unidos entre cargos compartilham um conceito só', () => {
    resetIds();
    const { syllabus, newConcepts } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: 'Matemática' }),
      entrada({ cargoId: 'c2', label: 'Matematica' }),
    ], [], makeId);
    expect(syllabus.items).toHaveLength(1);
    expect(newConcepts).toHaveLength(1);
  });
});

describe('separar um item unido errado', () => {
  it('extrai um cargo para um item próprio', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: 'Informática', questionCount: 10 }),
      entrada({ cargoId: 'c2', label: 'Informatica', questionCount: 20 }),
    ], [], makeId);
    expect(syllabus.items).toHaveLength(1);

    const separado = splitItem(syllabus, syllabus.items[0].id, 'c2', makeId);

    expect(separado.items).toHaveLength(2);
    expect(cargosFor(separado, separado.items[0].id)).toEqual(['c1']);
    expect(cargosFor(separado, separado.items[1].id)).toEqual(['c2']);
  });

  it('preserva peso e quantidade do cargo separado', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [
      entrada({ cargoId: 'c1', label: 'Informática', weight: 20, questionCount: 10 }),
      entrada({ cargoId: 'c2', label: 'Informatica', weight: 40, questionCount: 20 }),
    ], [], makeId);

    const separado = splitItem(syllabus, syllabus.items[0].id, 'c2', makeId);
    const novo = separado.links.find((l) => l.cargoId === 'c2');
    expect(novo?.weight).toBe(40);
    expect(novo?.questionCount).toBe(20);
  });

  it('não faz nada se o cargo não está no item', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [entrada({ cargoId: 'c1', label: 'Crase' })], [], makeId);
    expect(splitItem(syllabus, syllabus.items[0].id, 'c9', makeId)).toEqual(syllabus);
  });

  it('não faz nada se o item tem um cargo só', () => {
    resetIds();
    const { syllabus } = dedupeEntries('w1', [entrada({ cargoId: 'c1', label: 'Crase' })], [], makeId);
    expect(splitItem(syllabus, syllabus.items[0].id, 'c1', makeId)).toEqual(syllabus);
  });
});
