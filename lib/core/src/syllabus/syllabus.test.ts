import { describe, it, expect } from 'vitest';
import {
  cargosFor, isCommon, hasCommonItems, itemsForCargo, totalQuestionsFor,
  consolidatedQuestionCount, emptySyllabus, type Syllabus,
} from './syllabus';

const item = (id: string, conceptId: string) => ({
  id, workspaceId: 'w1', conceptId, parentItemId: null,
  sourceLabel: id, sourceExcerpt: null, page: null, confidence: 1, uncertain: false,
});

// Matemática e Português são comuns aos dois cargos; Legislação é do c1 e
// Tecnologia é do c2 — o exemplo do §5 do brief.
const SYLLABUS: Syllabus = {
  items: [item('i1', 'mat'), item('i2', 'por'), item('i3', 'leg'), item('i4', 'tec')],
  links: [
    { syllabusItemId: 'i1', cargoId: 'c1', weight: 25, questionCount: 10 },
    { syllabusItemId: 'i1', cargoId: 'c2', weight: 30, questionCount: 10 },
    { syllabusItemId: 'i2', cargoId: 'c1', weight: 25, questionCount: 10 },
    { syllabusItemId: 'i2', cargoId: 'c2', weight: 30, questionCount: 10 },
    { syllabusItemId: 'i3', cargoId: 'c1', weight: 50, questionCount: 20 },
    { syllabusItemId: 'i4', cargoId: 'c2', weight: 40, questionCount: 20 },
  ],
};

describe('cargos de um item', () => {
  it('lista os cargos ligados', () => {
    expect(cargosFor(SYLLABUS, 'i1')).toEqual(['c1', 'c2']);
    expect(cargosFor(SYLLABUS, 'i3')).toEqual(['c1']);
  });

  it('devolve vazio para item sem ligação', () => {
    expect(cargosFor(SYLLABUS, 'inexistente')).toEqual([]);
  });
});

describe('comum versus específico', () => {
  it('é comum quando está em mais de um cargo', () => {
    expect(isCommon(SYLLABUS, 'i1')).toBe(true);
    expect(isCommon(SYLLABUS, 'i2')).toBe(true);
  });

  it('é específico quando está em um cargo só', () => {
    expect(isCommon(SYLLABUS, 'i3')).toBe(false);
    expect(isCommon(SYLLABUS, 'i4')).toBe(false);
  });
});

describe('itens por cargo', () => {
  it('filtra pelo cargo', () => {
    expect(itemsForCargo(SYLLABUS, 'c1').map((i) => i.id)).toEqual(['i1', 'i2', 'i3']);
    expect(itemsForCargo(SYLLABUS, 'c2').map((i) => i.id)).toEqual(['i1', 'i2', 'i4']);
  });

  it('devolve vazio para cargo desconhecido', () => {
    expect(itemsForCargo(SYLLABUS, 'c9')).toEqual([]);
  });
});

describe('contagem de questões', () => {
  it('soma as questões de um cargo', () => {
    expect(totalQuestionsFor(SYLLABUS, 'c1')).toBe(40);
    expect(totalQuestionsFor(SYLLABUS, 'c2')).toBe(40);
  });

  it('conta o conteúdo comum uma vez só, não uma por cargo', () => {
    // É a regra do diagnóstico consolidado: 10 mat + 10 por + 20 leg + 20 tec.
    expect(consolidatedQuestionCount(SYLLABUS, 'i1')).toBe(10);
    expect(consolidatedQuestionCount(SYLLABUS, 'i3')).toBe(20);
    const total = SYLLABUS.items.reduce((sum, i) => sum + consolidatedQuestionCount(SYLLABUS, i.id), 0);
    expect(total).toBe(60);
  });

  it('usa o maior valor quando os cargos discordam', () => {
    const divergente: Syllabus = {
      items: [item('i1', 'mat')],
      links: [
        { syllabusItemId: 'i1', cargoId: 'c1', weight: 25, questionCount: 10 },
        { syllabusItemId: 'i1', cargoId: 'c2', weight: 30, questionCount: 15 },
      ],
    };
    expect(consolidatedQuestionCount(divergente, 'i1')).toBe(15);
  });

  it('trata questionCount nulo como zero', () => {
    const semContagem: Syllabus = {
      items: [item('i1', 'mat')],
      links: [{ syllabusItemId: 'i1', cargoId: 'c1', weight: null, questionCount: null }],
    };
    expect(consolidatedQuestionCount(semContagem, 'i1')).toBe(0);
    expect(totalQuestionsFor(semContagem, 'c1')).toBe(0);
  });
});

describe('programa vazio', () => {
  it('não tem itens nem ligações', () => {
    const vazio = emptySyllabus();
    expect(vazio.items).toEqual([]);
    expect(vazio.links).toEqual([]);
    expect(totalQuestionsFor(vazio, 'c1')).toBe(0);
  });
});

describe('hasCommonItems — a mesma pergunta de `items.some(isCommon)`, numa passada só', () => {
  it('é verdadeiro quando algum item está ligado a mais de um cargo', () => {
    expect(hasCommonItems(SYLLABUS)).toBe(true);
  });

  it('é falso quando cada item pertence a um único cargo', () => {
    expect(hasCommonItems({
      items: [item('i1', 'mat'), item('i2', 'por')],
      links: [
        { syllabusItemId: 'i1', cargoId: 'c1', weight: null, questionCount: null },
        { syllabusItemId: 'i2', cargoId: 'c2', weight: null, questionCount: null },
      ],
    })).toBe(false);
  });

  it('é falso num programa vazio', () => {
    expect(hasCommonItems(emptySyllabus())).toBe(false);
  });

  it('uma ligação órfã (item que não existe mais) não inventa um item comum', () => {
    expect(hasCommonItems({
      items: [item('i1', 'mat')],
      links: [
        { syllabusItemId: 'sumiu', cargoId: 'c1', weight: null, questionCount: null },
        { syllabusItemId: 'sumiu', cargoId: 'c2', weight: null, questionCount: null },
      ],
    })).toBe(false);
  });

  it('concorda com `items.some(isCommon)` — a definição que ela substitui', () => {
    const some = (syllabus: Syllabus) => syllabus.items.some((entry) => isCommon(syllabus, entry.id));
    expect(hasCommonItems(SYLLABUS)).toBe(some(SYLLABUS));
    const soloCargo: Syllabus = {
      items: [item('i1', 'mat')],
      links: [{ syllabusItemId: 'i1', cargoId: 'c1', weight: null, questionCount: null }],
    };
    expect(hasCommonItems(soloCargo)).toBe(some(soloCargo));
  });
});
