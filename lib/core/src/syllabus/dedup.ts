import {
  bestConceptCandidate,
  nameSimilarity,
  normalizeConceptName,
  shouldLinkDirectly,
  CONCEPT_MATCH_THRESHOLD,
  type Concept,
} from './concept';
import { slugify } from '../workspace/slug';
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

/**
 * Abaixo disto, o melhor candidato de `bestConceptCandidate` é ruído — nomes
 * como "Tecnologia da informação" contra "Crase" sempre têm *algum* score
 * (é sempre o melhor de uma lista não vazia), mas próximo de zero. Só vale a
 * pena incomodar um humano com a proposta quando o quase-acerto é real.
 */
const PROPOSAL_MIN_SCORE = 0.5;

type Bucket = { item: SyllabusItem; labels: string[] };

/**
 * Acha, entre os buckets já criados, aquele cujo rótulo de origem é o mesmo
 * conteúdo que `rawLabel` — usando a mesma régua de similaridade do
 * casamento de conceito (Finding 3 da revisão): duas entradas de cargos
 * diferentes escritas de formas ligeiramente distintas ("Interpretação de
 * textos" vs "Interpretação de texto") são o mesmo item, não dois. A guarda
 * de numeração embutida em `nameSimilarity` impede que isso funda leis ou
 * artigos diferentes.
 */
function findBucket(rawLabel: string, buckets: readonly Bucket[]): Bucket | undefined {
  let best: { bucket: Bucket; score: number } | undefined;

  for (const bucket of buckets) {
    const score = nameSimilarity(rawLabel, bucket.item.sourceLabel);
    if (score >= CONCEPT_MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { bucket, score };
    }
  }

  return best?.bucket;
}

export function dedupeEntries(
  workspaceId: string,
  entries: readonly RawSyllabusEntry[],
  concepts: readonly Concept[],
  makeId: (seed: string) => string,
): DedupResult {
  const buckets: Bucket[] = [];
  const bucketByEntry = new Map<RawSyllabusEntry, Bucket>();
  const links: SyllabusItemCargo[] = [];
  const newConcepts: Concept[] = [];
  const proposedLinks: ProposedConceptLink[] = [];

  for (const entry of entries) {
    const normalized = normalizeConceptName(entry.label);
    if (!normalized) continue;

    let bucket = findBucket(entry.label, buckets);

    if (!bucket) {
      const id = makeId(normalized);

      // Restrições R3 e R4 do spec: só um conceito já confirmado serve de ponte
      // entre workspaces. Qualquer outro caso cria um provisório e propõe a
      // ligação, em vez de aplicá-la. `bestConceptCandidate` (ao contrário de
      // `matchConcept`) devolve o melhor candidato mesmo abaixo do limiar, para
      // que a razão 'low_score' seja alcançável — `shouldLinkDirectly` é o
      // único portão que decide se a ligação é aplicada de fato.
      const match = bestConceptCandidate(entry.label, concepts);
      let conceptId: string;

      if (shouldLinkDirectly(match)) {
        conceptId = match!.concept.id;
      } else {
        const provisional: Concept = {
          id: makeId(`concept-${normalized}`),
          canonicalName: entry.label,
          slug: slugify(entry.label),
          parentId: null,
          // Um item sem pai é uma disciplina do edital; um item com pai é um
          // tópico dela — conhecido já na entrada, sem esperar o segundo passe
          // de hierarquia.
          kind: entry.parentLabel ? 'topico' : 'disciplina',
          aliases: [],
          status: 'provisional',
        };
        newConcepts.push(provisional);
        conceptId = provisional.id;

        if (match && match.score >= PROPOSAL_MIN_SCORE) {
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
      buckets.push(bucket);
    }

    bucketByEntry.set(entry, bucket);

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
    if (!entry.parentLabel) continue;

    const child = bucketByEntry.get(entry);
    const parent = findBucket(entry.parentLabel, buckets);
    if (child && parent && child.item.id !== parent.item.id) {
      child.item.parentItemId = parent.item.id;
    }
  }

  return {
    syllabus: { items: buckets.map((bucket) => bucket.item), links },
    // Um bucket é "unido" quando reúne mais de um cargo — o rótulo pode ter
    // sido idêntico nos dois (mesmo texto em dois cargos) ou ligeiramente
    // diferente; o que importa para explicar a união ao usuário é quantos
    // cargos caíram ali, não quantas grafias distintas do rótulo existem.
    merged: buckets
      .filter((bucket) => {
        const cargos = new Set(
          links.filter((link) => link.syllabusItemId === bucket.item.id).map((link) => link.cargoId),
        );
        return cargos.size > 1;
      })
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
