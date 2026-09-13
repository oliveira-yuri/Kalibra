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

/** Uma entrada bruta junto do seu índice na lista original recebida. */
type EntryRef = { entry: RawSyllabusEntry; index: number };

/**
 * Um grupo de entradas que o casamento por similaridade considerou o mesmo
 * conteúdo. `anchorLabel` é o rótulo usado para comparar CANDIDATOS NOVOS
 * contra este grupo (via `nameSimilarity`) — durante o agrupamento (Fase 1)
 * é o rótulo de quem criou o grupo na ordem ordenada; depois que a Fase 2
 * calcula qual membro é o "canônico" (o de menor índice original, ou seja, o
 * que aparece primeiro no edital), `anchorLabel` é atualizado para o rótulo
 * canônico — mantendo uma identidade só para o grupo, usada também na busca
 * de pai na Fase 3 (hierarquia).
 */
type Group = { anchorLabel: string; members: EntryRef[] };

/**
 * Acha, entre os grupos já existentes, aquele cujo `anchorLabel` é o mesmo
 * conteúdo que `rawLabel` — usando a mesma régua de similaridade do
 * casamento de conceito (Finding 3 da revisão): duas entradas de cargos
 * diferentes escritas de formas ligeiramente distintas ("Interpretação de
 * textos" vs "Interpretação de texto") são o mesmo item, não dois. A guarda
 * de numeração embutida em `nameSimilarity` impede que isso funda leis ou
 * artigos diferentes.
 */
function findGroup(rawLabel: string, groups: readonly Group[]): Group | undefined {
  let best: { group: Group; score: number } | undefined;

  for (const group of groups) {
    const score = nameSimilarity(rawLabel, group.anchorLabel);
    if (score >= CONCEPT_MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { group, score };
    }
  }

  return best?.group;
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
  const indexed: EntryRef[] = entries.map((entry, index) => ({ entry, index }));

  // Fase 1 — agrupamento, independente da ordem de chegada (fix round 2,
  // "Finding B"): o agrupamento guloso contra o primeiro grupo que bate o
  // limiar não é transitivo — o mesmo conjunto de entradas produzia números
  // de item diferentes dependendo da ordem de chegada (ex.: A~B, B~C, mas A
  // não~C: [A,B,C] funde só A+B, [B,A,C] funde os três). Ordenar por rótulo
  // normalizado antes do passe guloso torna o AGRUPAMENTO função só do
  // CONJUNTO de entradas — qualquer embaralhamento ordena para a mesma
  // sequência. O índice original de cada entrada viaja junto (`EntryRef`)
  // porque a Fase 2 precisa dele: agrupar sem depender da ordem de chegada é
  // uma coisa; decidir qual rótulo o usuário vê é outra (Finding B, fix
  // round 3) — não dá pra usar a mesma ordenação alfabética pras duas.
  const sortedForGrouping = [...indexed].sort((a, b) => {
    const na = normalizeConceptName(a.entry.label);
    const nb = normalizeConceptName(b.entry.label);
    if (na < nb) return -1;
    if (na > nb) return 1;
    return 0;
  });

  const groups: Group[] = [];

  for (const ref of sortedForGrouping) {
    const normalized = normalizeConceptName(ref.entry.label);
    if (!normalized) continue;

    let group = findGroup(ref.entry.label, groups);
    if (!group) {
      group = { anchorLabel: ref.entry.label, members: [] };
      groups.push(group);
    }
    group.members.push(ref);
  }

  // Fase 2 — um item por grupo, nomeado pela entrada "canônica": a que
  // aparece PRIMEIRO no edital (menor índice original), não a que criou o
  // grupo na varredura ordenada da Fase 1. Achado da revisão (fix round 3,
  // "Finding B"): antes, `sourceLabel` — e por tabela `Concept.canonicalName`
  // e `slug`, porque o conceito provisório nasce do mesmo rótulo — vinha de
  // quem batia primeiro na ordem ALFABÉTICA, então "Interpretação de textos"
  // (1º cargo do edital) virava "Interpretação de texto" (2º cargo, mas
  // alfabeticamente antes) na tela. Os grupos saem ordenados pelo menor
  // índice de cada um, então `items` também sai na ordem de primeira
  // aparição no edital, não em ordem alfabética.
  const groupsInAppearanceOrder = [...groups].sort((a, b) => {
    const minA = Math.min(...a.members.map((member) => member.index));
    const minB = Math.min(...b.members.map((member) => member.index));
    return minA - minB;
  });

  const items: SyllabusItem[] = [];
  const labelsByItemId = new Map<string, string[]>();
  const bucketByEntry = new Map<RawSyllabusEntry, SyllabusItem>();
  const itemByGroup = new Map<Group, SyllabusItem>();
  const links: SyllabusItemCargo[] = [];
  const newConcepts: Concept[] = [];
  const proposedLinks: ProposedConceptLink[] = [];

  for (const group of groupsInAppearanceOrder) {
    const membersByAppearance = [...group.members].sort((a, b) => a.index - b.index);
    const canonical = membersByAppearance[0].entry;
    const normalized = normalizeConceptName(canonical.label);

    // A identidade do grupo, para a busca de pai na Fase 3, passa a ser o
    // rótulo canônico — o mesmo que virou `sourceLabel` — não mais o rótulo
    // que só serviu para montar o grupo na Fase 1.
    group.anchorLabel = canonical.label;

    const id = makeId(normalized);

    // Restrições R3 e R4 do spec: só um conceito já confirmado serve de ponte
    // entre workspaces. Qualquer outro caso cria um provisório e propõe a
    // ligação, em vez de aplicá-la. `bestConceptCandidate` (ao contrário de
    // `matchConcept`) devolve o melhor candidato mesmo abaixo do limiar, para
    // que a razão 'low_score' seja alcançável — `shouldLinkDirectly` é o
    // único portão que decide se a ligação é aplicada de fato.
    const match = bestConceptCandidate(canonical.label, concepts);
    let conceptId: string;

    if (shouldLinkDirectly(match)) {
      conceptId = match!.concept.id;
    } else {
      const provisional: Concept = {
        id: makeId(`concept-${normalized}`),
        canonicalName: canonical.label,
        slug: slugify(canonical.label),
        parentId: null,
        // Um item sem pai é uma disciplina do edital; um item com pai é um
        // tópico dela — decidido pela entrada canônica, a mesma que nomeia o
        // item.
        kind: canonical.parentLabel ? 'topico' : 'disciplina',
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

    const item: SyllabusItem = {
      id,
      workspaceId,
      conceptId,
      parentItemId: null,
      sourceLabel: canonical.label,
      sourceExcerpt: canonical.sourceExcerpt,
      page: canonical.page,
      confidence: canonical.confidence,
      uncertain: canonical.confidence < UNCERTAIN_BELOW,
    };
    items.push(item);
    itemByGroup.set(group, item);

    const labels: string[] = [];
    labelsByItemId.set(id, labels);

    // Por cargo, quais rótulos BRUTOS já contribuíram para a ligação daquele
    // cargo neste item — usado pela regra do achado A (fix round 3).
    const contributedLabelsByCargo = new Map<string, Set<string>>();

    for (const { entry } of membersByAppearance) {
      bucketByEntry.set(entry, item);

      if (!labels.includes(entry.label)) {
        labels.push(entry.label);
      }

      const existingLinkIndex = links.findIndex(
        (link) => link.syllabusItemId === id && link.cargoId === entry.cargoId,
      );

      if (existingLinkIndex === -1) {
        links.push({
          syllabusItemId: id,
          cargoId: entry.cargoId,
          weight: entry.weight,
          questionCount: entry.questionCount,
        });
        contributedLabelsByCargo.set(entry.cargoId, new Set([entry.label]));
        continue;
      }

      // Achado da revisão (fix round 3, "Finding A"): somar sempre não
      // distingue "duas linhas de edital legítimas para o mesmo tópico" de
      // "o extrator emitiu a mesma linha duas vezes" — e essa contagem
      // alimenta `totalQuestionsFor`/`consolidatedQuestionCount`, que decidem
      // quantas questões de diagnóstico gerar. O único sinal disponível é o
      // rótulo bruto: se já vimos ESSE rótulo exato neste cargo, é a mesma
      // linha repetida — mantém os valores já registrados. Se o rótulo é
      // diferente (agrupado por similaridade, não por igualdade), é uma
      // linha distinta de verdade — mescla (soma questionCount, já que são
      // dois blocos de questões contados; usa o maior weight, que é
      // porcentagem do total e não é aditivo).
      const seenLabels = contributedLabelsByCargo.get(entry.cargoId);
      if (seenLabels?.has(entry.label)) {
        continue;
      }
      seenLabels?.add(entry.label);

      const existing = links[existingLinkIndex];
      links[existingLinkIndex] = {
        ...existing,
        questionCount: sumNullable(existing.questionCount, entry.questionCount),
        weight: maxNullable(existing.weight, entry.weight),
      };
    }
  }

  // Fase 3 — hierarquia, quando todos os itens já existem. A ordem de
  // varredura aqui não importa: só faz busca nos grupos já prontos.
  for (const entry of entries) {
    if (!entry.parentLabel) continue;

    const child = bucketByEntry.get(entry);
    const parentGroup = findGroup(entry.parentLabel, groups);
    const parent = parentGroup && itemByGroup.get(parentGroup);
    if (child && parent && child.id !== parent.id) {
      child.parentItemId = parent.id;
    }
  }

  return {
    syllabus: { items, links },
    // Um item é "unido" quando reúne mais de um cargo — o rótulo pode ter
    // sido idêntico nos dois (mesmo texto em dois cargos) ou ligeiramente
    // diferente; o que importa para explicar a união ao usuário é quantos
    // cargos caíram ali, não quantas grafias distintas do rótulo existem.
    merged: items
      .filter((item) => {
        const cargos = new Set(
          links.filter((link) => link.syllabusItemId === item.id).map((link) => link.cargoId),
        );
        return cargos.size > 1;
      })
      .map((item) => ({ itemId: item.id, labels: labelsByItemId.get(item.id) ?? [] })),
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
