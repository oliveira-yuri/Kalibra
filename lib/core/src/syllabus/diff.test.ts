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

describe('diffSyllabus — fix round 1, Finding 3 (dois itens no mesmo conceito não podem perder um deles)', () => {
  it('reprodução exata do achado: dois itens anteriores no mesmo conceito, só um sobrevive na versão nova — o outro é removido, não desaparece', () => {
    // prev = ["Crase", "Emprego do acento indicativo de crase"]  (ambos -> mesmo conceito, via alias)
    // next = ["Crase"]
    // Antes do fix: added [] | removed [] | renamed 1 | unchanged [] — um dos dois itens
    // anteriores sumia sem aparecer em lugar nenhum do diff.
    const previous: Syllabus = {
      items: [
        item({ id: 'i-crase', conceptId: 'concept-crase', sourceLabel: 'Crase' }),
        item({ id: 'i-emprego', conceptId: 'concept-crase', sourceLabel: 'Emprego do acento indicativo de crase' }),
      ],
      links: [],
    };
    const next: Syllabus = {
      items: [item({ id: 'i-crase-v2', conceptId: 'concept-crase', sourceLabel: 'Crase' })],
      links: [],
    };

    const diff = diffSyllabus(previous, next, [CRASE_CONCEPT]);

    // O item cujo rótulo bate exatamente ("Crase") casa e fica unchanged; o outro,
    // que não tem correspondente na versão nova, é removido de verdade — nunca
    // some sem aparecer em added, removed, renamed OU unchanged.
    expect(diff.unchanged.map((i) => i.id)).toEqual(['i-crase-v2']);
    expect(diff.removed.map((i) => i.id)).toEqual(['i-emprego']);
    expect(diff.added).toEqual([]);
    expect(diff.renamed).toEqual([]);

    // Nenhum item anterior desaparece: os dois somam exatamente a soma dos buckets.
    const accountedFor = [...diff.removed, ...diff.renamed.map((r) => r.from)];
    expect(accountedFor.map((i) => i.id).sort()).toEqual(['i-emprego']);
  });

  it('forma produzida pela Task 12 (splitItem): dois itens, cargos diferentes, mesmo conceito — remover um na v2 não apaga o outro do diff', () => {
    // `splitItem` (Task 12) desfaz uma união criando um segundo item com o MESMO
    // conceito do primeiro, só que ligado a outro cargo — exatamente a forma que
    // este achado apontou como reproduzível de verdade, não hipotética.
    const previous: Syllabus = {
      items: [
        item({ id: 'item-c1', conceptId: 'concept-comum', sourceLabel: 'Matemática básica' }),
        item({ id: 'item-c2', conceptId: 'concept-comum', sourceLabel: 'Matemática básica' }),
      ],
      links: [
        { syllabusItemId: 'item-c1', cargoId: 'c1', weight: null, questionCount: null },
        { syllabusItemId: 'item-c2', cargoId: 'c2', weight: null, questionCount: null },
      ],
    };
    // A versão nova só extraiu o conteúdo para c1 — o de c2 sumiu do edital novo.
    const next: Syllabus = {
      items: [item({ id: 'item-c1-v2', conceptId: 'concept-comum', sourceLabel: 'Matemática básica' })],
      links: [{ syllabusItemId: 'item-c1-v2', cargoId: 'c1', weight: null, questionCount: null }],
    };

    const diff = diffSyllabus(previous, next, []);

    expect(diff.unchanged.map((i) => i.id)).toEqual(['item-c1-v2']);
    expect(diff.removed).toHaveLength(1);
    expect(diff.added).toEqual([]);
  });
});

describe('diffSyllabus — o que ele NÃO lê (achado R4 da re-revisão)', () => {
  it('peso e quantidade de questões não mudam o resultado — só rótulo e conceito entram', () => {
    // `EditalRevisar` memoiza o diff sem depender de `syllabus.links` exatamente por
    // isto. Se algum dia o diff passar a olhar as ligações, este teste cai e a
    // dependência lá precisa voltar — em vez de a tela silenciosamente mostrar uma
    // comparação desatualizada.
    const items = [item({ id: 'a', conceptId: 'concept-a', sourceLabel: 'Matéria' })];
    const previous: Syllabus = { items: [], links: [] };
    const semPesos: Syllabus = {
      items,
      links: [{ syllabusItemId: 'a', cargoId: 'c1', weight: null, questionCount: null }],
    };
    const comPesos: Syllabus = {
      items,
      links: [
        { syllabusItemId: 'a', cargoId: 'c1', weight: 42, questionCount: 9 },
        { syllabusItemId: 'a', cargoId: 'c2', weight: 7, questionCount: 3 },
      ],
    };

    expect(diffSyllabus(previous, comPesos, [])).toEqual(diffSyllabus(previous, semPesos, []));
  });
});
