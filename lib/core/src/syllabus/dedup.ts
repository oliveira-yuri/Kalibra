import { matchConcept, normalizeConceptName, shouldLinkDirectly, type Concept } from './concept';
import { type Syllabus, type SyllabusItem, type SyllabusItemCargo } from './syllabus';

export type RawSyllabusEntry = {
  cargoId: string;
  label: string;
  parentLabel: string | null;
  weight: number | null;
  questionCount: number | null;
  sourceExcerpt: string | null;
  page: number | null;
  confidence: number;
};

/** Uma ligação que a extração quis fazer mas não tinha autoridade para fazer. */
export type ProposedConceptLink = {
  itemId: string;
  conceptId: string;
  score: number;
  reason: 'provisional_concept' | 'low_score';
};

export type DedupResult = {
  syllabus: Syllabus;
  /** O que foi unido, para a tela poder explicar ao usuário. */
  merged: Array<{ itemId: string; labels: string[] }>;
  /** Conceitos provisórios criados, que só viram confirmados por decisão humana. */
  newConcepts: Concept[];
  /** Ligações propostas à fila de aprovação, nunca aplicadas aqui. */
  proposedLinks: ProposedConceptLink[];
};

/** Abaixo disto o item entra marcado como incerto e pede olho humano. */
const UNCERTAIN_BELOW = 0.6;

export function dedupeEntries(
  workspaceId: string,
  entries: readonly RawSyllabusEntry[],
  concepts: readonly Concept[],
  makeId: (seed: string) => string,
): DedupResult {
  const byNormalized = new Map<string, { item: SyllabusItem; labels: string[] }>();
  const links: SyllabusItemCargo[] = [];
  const newConcepts: Concept[] = [];
  const proposedLinks: ProposedConceptLink[] = [];

  for (const entry of entries) {
    const normalized = normalizeConceptName(entry.label);
    if (!normalized) continue;

    let bucket = byNormalized.get(normalized);

    if (!bucket) {
      const id = makeId(normalized);

      // Restrições R3 e R4 do spec: só um conceito já confirmado serve de ponte
      // entre workspaces. Qualquer outro caso cria um provisório e propõe a
      // ligação, em vez de aplicá-la.
      const match = matchConcept(entry.label, concepts);
      let conceptId: string;

      if (shouldLinkDirectly(match)) {
        conceptId = match!.concept.id;
      } else {
        const provisional: Concept = {
          id: makeId(`concept-${normalized}`),
          canonicalName: entry.label,
          slug: normalized.replace(/\s+/g, '-'),
          parentId: null,
          kind: 'topico',
          aliases: [],
          status: 'provisional',
        };
        newConcepts.push(provisional);
        conceptId = provisional.id;

        if (match) {
          proposedLinks.push({
            itemId: id,
            conceptId: match.concept.id,
            score: match.score,
            reason: match.concept.status === 'provisional' ? 'provisional_concept' : 'low_score',
          });
        }
      }

      bucket = {
        item: {
          id,
          workspaceId,
          conceptId,
          parentItemId: null,
          sourceLabel: entry.label,
          sourceExcerpt: entry.sourceExcerpt,
          page: entry.page,
          confidence: entry.confidence,
          uncertain: entry.confidence < UNCERTAIN_BELOW,
        },
        labels: [],
      };
      byNormalized.set(normalized, bucket);
    }

    if (!bucket.labels.includes(entry.label)) {
      bucket.labels.push(entry.label);
    }

    // Um cargo não pode aparecer duas vezes no mesmo item.
    const already = links.some(
      (link) => link.syllabusItemId === bucket!.item.id && link.cargoId === entry.cargoId,
    );
    if (!already) {
      links.push({
        syllabusItemId: bucket.item.id,
        cargoId: entry.cargoId,
        weight: entry.weight,
        questionCount: entry.questionCount,
      });
    }
  }

  // Hierarquia num segundo passe, quando todos os itens já existem.
  for (const entry of entries) {
    const normalized = normalizeConceptName(entry.label);
    if (!normalized || !entry.parentLabel) continue;

    const child = byNormalized.get(normalized);
    const parent = byNormalized.get(normalizeConceptName(entry.parentLabel));
    if (child && parent && child.item.id !== parent.item.id) {
      child.item.parentItemId = parent.item.id;
    }
  }

  const buckets = [...byNormalized.values()];

  return {
    syllabus: { items: buckets.map((bucket) => bucket.item), links },
    merged: buckets
      .filter((bucket) => bucket.labels.length > 1)
      .map((bucket) => ({ itemId: bucket.item.id, labels: bucket.labels })),
    newConcepts,
    proposedLinks,
  };
}

/**
 * Desfaz uma união: tira `cargoId` do item e lhe dá um item próprio, com o
 * mesmo conceito e o mesmo peso. Usado quando a deduplicação uniu conteúdos que
 * o usuário considera distintos.
 */
export function splitItem(
  syllabus: Syllabus,
  itemId: string,
  cargoId: string,
  makeId: (seed: string) => string,
): Syllabus {
  const item = syllabus.items.find((candidate) => candidate.id === itemId);
  if (!item) return syllabus;

  const linksOfItem = syllabus.links.filter((link) => link.syllabusItemId === itemId);
  const moving = linksOfItem.find((link) => link.cargoId === cargoId);
  if (!moving || linksOfItem.length < 2) return syllabus;

  const newItem: SyllabusItem = { ...item, id: makeId(`${item.id}-${cargoId}`) };

  return {
    items: [...syllabus.items, newItem],
    links: syllabus.links.map((link) =>
      link.syllabusItemId === itemId && link.cargoId === cargoId
        ? { ...link, syllabusItemId: newItem.id }
        : link,
    ),
  };
}
