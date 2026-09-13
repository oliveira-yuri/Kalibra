export type SyllabusItem = {
  id: string;
  workspaceId: string;
  conceptId: string;
  parentItemId: string | null;
  /** Nome literal como veio no edital, preservado para rastreabilidade. */
  sourceLabel: string;
  sourceExcerpt: string | null;
  page: number | null;
  confidence: number;
  uncertain: boolean;
};

/**
 * A ligação N:N entre item e cargo. A deduplicação é a cardinalidade desta
 * tabela: duas linhas para o mesmo item significam conteúdo comum aos dois
 * cargos. Peso e quantidade de questões ficam aqui, não no item, porque o mesmo
 * conteúdo pode valer 25% num cargo e 30% no outro.
 */
export type SyllabusItemCargo = {
  syllabusItemId: string;
  cargoId: string;
  weight: number | null;
  questionCount: number | null;
};

export type Syllabus = {
  items: SyllabusItem[];
  links: SyllabusItemCargo[];
};

export function emptySyllabus(): Syllabus {
  return { items: [], links: [] };
}

export function cargosFor(syllabus: Syllabus, itemId: string): string[] {
  return syllabus.links
    .filter((link) => link.syllabusItemId === itemId)
    .map((link) => link.cargoId);
}

export function isCommon(syllabus: Syllabus, itemId: string): boolean {
  return cargosFor(syllabus, itemId).length > 1;
}

export function itemsForCargo(syllabus: Syllabus, cargoId: string): SyllabusItem[] {
  const ids = new Set(
    syllabus.links.filter((link) => link.cargoId === cargoId).map((link) => link.syllabusItemId),
  );
  return syllabus.items.filter((item) => ids.has(item.id));
}

export function totalQuestionsFor(syllabus: Syllabus, cargoId: string): number {
  return syllabus.links
    .filter((link) => link.cargoId === cargoId)
    .reduce((sum, link) => sum + (link.questionCount ?? 0), 0);
}

/**
 * Quantas questões o conteúdo vale no diagnóstico consolidado. Um conteúdo
 * comum a dois cargos entra UMA vez, não uma por cargo. Quando os cargos
 * discordam da quantidade, vale a maior — cobrir menos do que um dos cargos
 * exige seria subpreparar o aluno para aquele cargo.
 */
export function consolidatedQuestionCount(syllabus: Syllabus, itemId: string): number {
  const counts = syllabus.links
    .filter((link) => link.syllabusItemId === itemId)
    .map((link) => link.questionCount ?? 0);
  return counts.length === 0 ? 0 : Math.max(...counts);
}
