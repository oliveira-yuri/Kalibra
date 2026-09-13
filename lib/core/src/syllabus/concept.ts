export type ConceptStatus = 'confirmed' | 'provisional';
export type ConceptKind = 'disciplina' | 'topico' | 'subtopico';

export type Concept = {
  id: string;
  canonicalName: string;
  slug: string;
  parentId: string | null;
  kind: ConceptKind;
  aliases: string[];
  status: ConceptStatus;
};

export type ConceptMatch = {
  concept: Concept;
  score: number;
};

/** Abaixo disto, a ligação vira proposta em vez de fato. */
export const CONCEPT_MATCH_THRESHOLD = 0.82;

// Numeração de item de edital: "1.2.3", "4 -", "II –", "a)" etc.
//
// DISCREPÂNCIA vs. o brief: o exemplo original exigia `\s+` (espaço) depois do
// separador para reconhecer a numeração, então uma entrada que é *só*
// numeração — "1.2." sem nada depois — não batia (faltava espaço após o
// ponto final) e sobrava "1.2" em vez de "". Trocado por `(?:\s+|$)` para
// aceitar também o fim da string como fronteira válida.
const LEADING_NUMBERING = /^\s*(?:[0-9]+(?:\.[0-9]+)*|[ivxlcdm]+|[a-z])\s*[.)\-–—]*(?:\s+|$)/i;
const TRAILING_PUNCTUATION = /[.,;:]+\s*$/;

export function normalizeConceptName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(LEADING_NUMBERING, '')
    .replace(TRAILING_PUNCTUATION, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Similaridade por distância de edição normalizada. Escolhida em vez de algo
 * mais sofisticado porque é determinística, explicável e não precisa de corpus:
 * dois nomes de tópico de edital que diferem por uma letra são o mesmo tópico.
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = Array.from({ length: cols }, (_, index) => index);

  for (let i = 1; i < rows; i += 1) {
    const current = [i];
    for (let j = 1; j < cols; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, substitution);
    }
    previous = current;
  }

  const distance = previous[cols - 1];
  return 1 - distance / Math.max(a.length, b.length);
}

export function matchConcept(name: string, concepts: readonly Concept[]): ConceptMatch | null {
  const normalized = normalizeConceptName(name);
  if (!normalized) return null;

  let best: ConceptMatch | null = null;

  for (const concept of concepts) {
    const candidates = [concept.canonicalName, ...concept.aliases];
    for (const candidate of candidates) {
      const score = similarity(normalized, normalizeConceptName(candidate));
      if (score >= CONCEPT_MATCH_THRESHOLD && (best === null || score > best.score)) {
        best = { concept, score };
      }
    }
  }

  return best;
}

/**
 * Restrição R4 do spec: liga direto apenas quando o casamento passa do limiar
 * E o conceito encontrado já é `confirmed`. Conceito provisório nunca serve de
 * ponte — senão a extração automática polui a biblioteca global do usuário.
 */
export function shouldLinkDirectly(match: ConceptMatch | null): boolean {
  if (match === null) return false;
  if (match.concept.status !== 'confirmed') return false;
  return match.score >= CONCEPT_MATCH_THRESHOLD;
}
