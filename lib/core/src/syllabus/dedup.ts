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
 *
 * Achado da revisão (fix round 2, "Finding E"): 0.5 foi escolhido só para
 * caber entre dois valores de teste (0.125 não devia propor, 0.75 devia) —
 * exatamente o defeito que o teste de limiar fixo (Finding 5) existia para
 * evitar, só que reintroduzido para esta constante. Na prática, 0.5 deixava
 * "Direito Civil" (entrada) propor ligação contra um "Direito Penal"
 * confirmado (score 0.6923) — num corpus em português, prefixos como "Direito
 * …", "Noções de …", "Legislação …" carregam uma fração grande de pares sem
 * relação nenhuma para além de 0.5, e a fila é tempo de um humano. Subido para
 * 0.7: mata esse par (fica abaixo) e mantém o quase-acerto real do exemplo
 * acima (0.75, fica acima). Fixado por teste de fronteira nos dois lados, do
 * mesmo jeito que `CONCEPT_MATCH_THRESHOLD`.
 */
const PROPOSAL_MIN_SCORE = 0.7;

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

/** null significa "sem dado" — soma trata como 0, mas o resultado só é null se as duas faltarem. */
function sumNullable(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  return (a ?? 0) + (b ?? 0);
}

/** null significa "sem dado" — não vira 0 artificialmente; usa o outro lado quando só um existe. */
function maxNullable(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
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

  // Achado da revisão (fix round 2, "Finding B"): o agrupamento ganancioso
  // contra o primeiro bucket que bate o limiar não é transitivo — o mesmo
  // conjunto de entradas produzia números de item diferentes dependendo da
  // ordem de chegada (ex.: A~B, B~C, mas A não~C: [A,B,C] funde só A+B,
  // [B,A,C] funde os três). Isso deixaria o programa depender da ordem em que
  // o extrator emitiu as linhas, que não é uma propriedade estável da
  // entrada. Processar as entradas ordenadas pelo rótulo normalizado (em vez
  // da ordem de chegada) torna o resultado função só do CONJUNTO de entradas:
  // qualquer embaralhamento do array ordena para a mesma sequência antes do
  // passe guloso. Empates (mesmo rótulo normalizado, ex.: dois cargos com a
  // mesma grafia) mantêm a ordem original entre si — sort é estável — para
  // que "o primeiro cargo" continue significando o primeiro na entrada, não
  // o primeiro em ordem alfabética.
  const processingOrder = [...entries].sort((a, b) => {
    const na = normalizeConceptName(a.label);
    const nb = normalizeConceptName(b.label);
    if (na < nb) return -1;
    if (na > nb) return 1;
    return 0;
  });

  for (const entry of processingOrder) {
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

    // Um cargo não pode ter duas LIGAÇÕES para o mesmo item — mas duas
    // entradas do mesmo cargo podem legitimamente cair no mesmo bucket (duas
    // linhas de edital quase-duplicadas para o mesmo cargo, ou o próprio
    // agrupamento por similaridade juntando duas grafias da mesma entrada).
    // Achado da revisão (fix round 2, "Finding C"): antes, a segunda entrada
    // era simplesmente descartada nesse caso, perdendo seu questionCount e
    // weight — "Interpretação de textos" q=10 + "Interpretação de texto"
    // q=15 no mesmo cargo virava só 10, não 25. Agora a segunda entrada é
    // MESCLADA na ligação existente: questionCount SOMA (são duas questões
    // contadas, dois blocos do edital para o mesmo tópico), weight fica com o
    // MAIOR (peso é porcentagem do total, não é aditivo).
    const existingLinkIndex = links.findIndex(
      (link) => link.syllabusItemId === bucket!.item.id && link.cargoId === entry.cargoId,
    );
    if (existingLinkIndex === -1) {
      links.push({
        syllabusItemId: bucket.item.id,
        cargoId: entry.cargoId,
        weight: entry.weight,
        questionCount: entry.questionCount,
      });
    } else {
      const existing = links[existingLinkIndex];
      links[existingLinkIndex] = {
        ...existing,
        questionCount: sumNullable(existing.questionCount, entry.questionCount),
        weight: maxNullable(existing.weight, entry.weight),
      };
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
