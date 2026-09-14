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

/**
 * Existe ALGUM item comum a mais de um cargo? A pergunta que a tela de revisão faz para
 * decidir se explica a deduplicação ao usuário (Task 12) — `syllabus.items.some((item)
 * => isCommon(syllabus, item.id))` responde o mesmo, mas varre as ligações inteiras uma
 * vez por item: O(itens × ligações). Aqui é uma passada só, O(itens + ligações).
 *
 * Ligações órfãs (apontando para um item que não existe mais) não contam — é a mesma
 * restrição que `.some()` sobre `items` impunha de graça, e `migrateSyllabus` aceita
 * uma ligação órfã de propósito (ver a nota em `isValidLink`).
 */
export function hasCommonItems(syllabus: Syllabus): boolean {
  const existingItemIds = new Set(syllabus.items.map((item) => item.id));
  const seen = new Set<string>();
  for (const link of syllabus.links) {
    if (!existingItemIds.has(link.syllabusItemId)) continue;
    if (seen.has(link.syllabusItemId)) return true;
    seen.add(link.syllabusItemId);
  }
  return false;
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

/**
 * Liga um item já existente a mais um cargo — a direção contrária à de `splitItem`
 * (que TIRA um cargo do item), e a metade que faltava para o usuário conseguir
 * revisar vínculos nas duas direções. Não é o inverso exato: `splitItem` sempre cria
 * um item NOVO para o cargo separado, então ligar e separar de volta devolve dois
 * itens onde havia um só — o conteúdo sobrevive nos dois cargos, a topologia não
 * volta a ser a mesma. Quem quer tirar um cargo SEM criar item novo usa
 * `unlinkItemFromCargo`, abaixo.
 *
 * Peso e quantidade nascem `null` de propósito: são valores por cargo (§4.1), e
 * herdá-los do outro cargo inventaria um dado que o edital não afirma. A ausência é
 * visível na interface (campo vazio) e pede o olho do usuário; um número herdado
 * passaria despercebido.
 *
 * Nunca cria item novo: conteúdo comum a vários cargos é UMA entidade com várias
 * ligações, e é isso que mantém nota, histórico e FSRS inteiros.
 */
export function linkItemToCargo(syllabus: Syllabus, itemId: string, cargoId: string): Syllabus {
  const item = syllabus.items.find((candidate) => candidate.id === itemId);
  if (!item) return syllabus;

  const already = syllabus.links.some(
    (link) => link.syllabusItemId === itemId && link.cargoId === cargoId,
  );
  if (already) return syllabus;

  const link: SyllabusItemCargo = { syllabusItemId: itemId, cargoId, weight: null, questionCount: null };
  return { items: syllabus.items, links: [...syllabus.links, link] };
}

/**
 * Tira UM cargo de um item — sem criar item novo (é isso que a distingue de
 * `splitItem`) e sem tocar nos outros cargos: é a operação por trás de "excluir este
 * conteúdo do cargo que estou vendo".
 *
 * Três regras, todas consequência de "alterar um cargo não contamina os demais":
 *
 * 1. Os subtópicos vão junto. Um item que deixa de pertencer ao cargo não pode deixar
 *    os filhos dele pendurados naquele cargo — o usuário excluiu a matéria, não pediu
 *    para ficar com os tópicos soltos.
 * 2. Um item que fica sem NENHUMA ligação deixa de existir. O modelo não tem lugar
 *    para conteúdo que não pertence a cargo nenhum: ele não apareceria em tela alguma
 *    e só engordaria o registro. Tirar o último cargo é, portanto, excluir o item.
 * 3. Um filho que SOBREVIVE (porque ainda pertence a outro cargo) e cujo pai foi
 *    removido vira raiz (`parentItemId: null`), nunca fica apontando para um pai que
 *    já não existe.
 *
 * Itens que não fazem parte da subárvore afetada nunca são removidos, mesmo que já
 * estivessem sem ligação antes — esta função responde por uma exclusão, não por uma
 * faxina geral do registro.
 */
export function unlinkItemFromCargo(syllabus: Syllabus, itemId: string, cargoId: string): Syllabus {
  const target = syllabus.items.find((candidate) => candidate.id === itemId);
  if (!target) return syllabus;

  const hasLink = syllabus.links.some(
    (link) => link.syllabusItemId === itemId && link.cargoId === cargoId,
  );
  if (!hasLink) return syllabus;

  // A subárvore inteira do item. O laço cresce um conjunto monotônico, então termina
  // mesmo diante de uma hierarquia corrompida com ciclo — o que `migrateSyllabus`
  // aceita hoje e nenhuma tela deve conseguir travar.
  const afetados = new Set<string>([itemId]);
  let cresceu = true;
  while (cresceu) {
    cresceu = false;
    for (const candidate of syllabus.items) {
      if (candidate.parentItemId === null) continue;
      if (afetados.has(candidate.parentItemId) && !afetados.has(candidate.id)) {
        afetados.add(candidate.id);
        cresceu = true;
      }
    }
  }

  const links = syllabus.links.filter(
    (link) => !(afetados.has(link.syllabusItemId) && link.cargoId === cargoId),
  );
  const comLigacao = new Set(links.map((link) => link.syllabusItemId));
  const items = syllabus.items.filter((item) => !afetados.has(item.id) || comLigacao.has(item.id));
  const sobreviventes = new Set(items.map((item) => item.id));

  return {
    items: items.map((item) =>
      (item.parentItemId !== null && !sobreviventes.has(item.parentItemId)
        ? { ...item, parentItemId: null }
        : item)),
    links,
  };
}
