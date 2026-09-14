import { describe, it, expect } from 'vitest';
import { diffSyllabus } from './diff';
import { emptySyllabus, type Syllabus, type SyllabusItem } from './syllabus';
import type { Concept } from './concept';

const item = (over: Partial<SyllabusItem> & { id: string; conceptId: string; sourceLabel: string }): SyllabusItem => ({
  workspaceId: 'w1',
  parentItemId: null,
  sourceExcerpt: null,
  page: null,
  confidence: 1,
  uncertain: false,
  ...over,
});

const CRASE_CONCEPT: Concept = {
  id: 'concept-crase',
  canonicalName: 'Crase',
  slug: 'crase',
  parentId: null,
  kind: 'topico',
  // O alias é o que faz "Emprego do acento indicativo de crase" (texto
  // completamente diferente de "Crase") resolver para o MESMO conceito.
  aliases: ['Emprego do acento indicativo de crase'],
  status: 'confirmed',
};

describe('diffSyllabus — PD-08 (renomeado não é remoção mais adição)', () => {
  it('item novo (sem correspondente na versão anterior) aparece em added', () => {
    const previous: Syllabus = { items: [], links: [] };
    const next: Syllabus = {
      items: [item({ id: 'i1', conceptId: 'concept-nova', sourceLabel: 'Nova disciplina' })],
      links: [],
    };

    const diff = diffSyllabus(previous, next, []);
    expect(diff.added.map((i) => i.id)).toEqual(['i1']);
    expect(diff.removed).toEqual([]);
    expect(diff.renamed).toEqual([]);
    expect(diff.unchanged).toEqual([]);
  });

  it('item que sumiu na versão nova aparece em removed', () => {
    const previous: Syllabus = {
      items: [item({ id: 'i1', conceptId: 'concept-antiga', sourceLabel: 'Disciplina antiga' })],
      links: [],
    };
    const next: Syllabus = { items: [], links: [] };

    const diff = diffSyllabus(previous, next, []);
    expect(diff.removed.map((i) => i.id)).toEqual(['i1']);
    expect(diff.added).toEqual([]);
    expect(diff.renamed).toEqual([]);
  });

  it('item cujo rótulo mudou mas o conceito é o mesmo aparece em renamed — nunca em added ou removed', () => {
    const previous: Syllabus = {
      items: [item({ id: 'i1', conceptId: 'concept-crase', sourceLabel: 'Crase' })],
      links: [],
    };
    const next: Syllabus = {
      // Segunda extração: provisório novo (id de conceito diferente do da
      // primeira) — mas o rótulo bate no alias do MESMO conceito confirmado.
      items: [item({ id: 'i2', conceptId: 'concept-provisorio-outro', sourceLabel: 'Emprego do acento indicativo de crase' })],
      links: [],
    };

    const diff = diffSyllabus(previous, next, [CRASE_CONCEPT]);
    expect(diff.renamed).toEqual([{ from: previous.items[0], to: next.items[0] }]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.unchanged).toEqual([]);
  });

  it('item idêntico (mesmo conceito, mesmo rótulo) aparece em unchanged', () => {
    const previous: Syllabus = {
      items: [item({ id: 'i1', conceptId: 'concept-x', sourceLabel: 'Direito Administrativo' })],
      links: [],
    };
    const next: Syllabus = {
      items: [item({ id: 'i2', conceptId: 'concept-x', sourceLabel: 'Direito Administrativo' })],
      links: [],
    };

    const diff = diffSyllabus(previous, next, []);
    expect(diff.unchanged.map((i) => i.id)).toEqual(['i2']);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.renamed).toEqual([]);
  });

  it('diff contra um programa vazio devolve tudo em added', () => {
    const next: Syllabus = {
      items: [
        item({ id: 'i1', conceptId: 'c1', sourceLabel: 'Matéria A' }),
        item({ id: 'i2', conceptId: 'c2', sourceLabel: 'Matéria B' }),
      ],
      links: [],
    };

    const diff = diffSyllabus(emptySyllabus(), next, []);
    expect(diff.added).toHaveLength(2);
    expect(diff.removed).toEqual([]);
    expect(diff.renamed).toEqual([]);
    expect(diff.unchanged).toEqual([]);
  });

  it('diff de um programa contra si mesmo devolve tudo em unchanged', () => {
    const syllabus: Syllabus = {
      items: [
        item({ id: 'i1', conceptId: 'c1', sourceLabel: 'Matéria A' }),
        item({ id: 'i2', conceptId: 'c2', sourceLabel: 'Matéria B' }),
      ],
      links: [],
    };

    const diff = diffSyllabus(syllabus, syllabus, []);
    expect(diff.unchanged).toHaveLength(2);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.renamed).toEqual([]);
  });

  it('não confunde dois itens de conceitos diferentes só porque o rótulo mudou (sem alias que os ligue)', () => {
    const previous: Syllabus = {
      items: [item({ id: 'i1', conceptId: 'concept-a', sourceLabel: 'Direito Civil' })],
      links: [],
    };
    const next: Syllabus = {
      items: [item({ id: 'i2', conceptId: 'concept-b', sourceLabel: 'Direito Penal' })],
      links: [],
    };

    const diff = diffSyllabus(previous, next, []);
    expect(diff.added.map((i) => i.id)).toEqual(['i2']);
    expect(diff.removed.map((i) => i.id)).toEqual(['i1']);
    expect(diff.renamed).toEqual([]);
  });
});
