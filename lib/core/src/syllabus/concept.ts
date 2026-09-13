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

// Uma palavra inteira feita só de dígitos e separadores de lista ("8.080",
// "1.171/94") ou só de algarismos romanos ("ii", "iv") — o formato normal de
// número de lei, artigo, decreto ou edição num nome de edital.
const NUMERIC_WORD = /^[0-9]+(?:[.\-/][0-9]+)*$/;
// Limitado a 4 letras: cobre os algarismos romanos realmente usados como
// sufixo de edição/parte em edital (i..xiii). Sem o limite, palavras comuns
// do português que por acaso só usam letras de i/v/x/l/c/d/m — "civil",
// "mil" — seriam lidas como numeração e bloqueariam comparações legítimas
// (ex.: "Direito Civil" vs "Direito Penal" não deve ser rejeitado por causa
// de "civil"; deve continuar de fora só por não passar do limiar de score).
const ROMAN_WORD = /^[ivxlcdm]{1,4}$/;

function extractNumberingTokens(normalized: string): string[] {
  const tokens: string[] = [];
  for (const word of normalized.split(' ')) {
    if (!word) continue;
    if (NUMERIC_WORD.test(word)) {
      tokens.push(...word.split(/[^0-9]+/).filter(Boolean));
    } else if (ROMAN_WORD.test(word)) {
      tokens.push(word);
    }
  }
  return tokens;
}

function numberingTokensCorrespond(a: string, b: string): boolean {
  if (a === b) return true;
  // Só dígitos toleram truncamento (ano com 2 dígitos abreviando 4, "94" de
  // "1994"). Algarismo romano nunca: "ii" e "iii" são conceitos diferentes.
  if (!/^[0-9]+$/.test(a) || !/^[0-9]+$/.test(b)) return false;
  return a.length !== b.length && (a.endsWith(b) || b.endsWith(a));
}

/**
 * Guarda contra o pior modo de falha do casamento por similaridade: duas leis,
 * artigos ou decretos que diferem só num dígito ("Lei 8.080" vs "Lei 8.078",
 * "Art. 37" vs "Art. 38") têm distância de edição pequena o bastante para
 * passar de qualquer limiar razoável e se fundirem silenciosamente — o pior
 * caso possível num app de concursos, onde o número da norma é o próprio
 * significado. Antes de aceitar qualquer score abaixo de 1, os números e
 * algarismos romanos de cada nome (na mesma posição relativa) precisam
 * corresponder: iguais, ou um sendo a forma truncada do outro.
 */
function numberingCorresponds(a: string, b: string): boolean {
  const tokensA = extractNumberingTokens(a);
  const tokensB = extractNumberingTokens(b);
  if (tokensA.length !== tokensB.length) return false;
  return tokensA.every((token, index) => numberingTokensCorrespond(token, tokensB[index]));
}

/**
 * Similaridade entre dois nomes quaisquer, já normalizada e protegida pela
 * guarda de numeração acima. Exportada porque a deduplicação entre cargos
 * (Task 3) precisa comparar rótulos brutos entre si, não só contra uma lista
 * de `Concept` — é a mesma régua usada por `matchConcept`, só que aplicada a
 * um par de strings em vez de um nome contra vários conceitos.
 */
export function nameSimilarity(a: string, b: string): number {
  const normalizedA = normalizeConceptName(a);
  const normalizedB = normalizeConceptName(b);
  if (!normalizedA || !normalizedB) return 0;
  if (!numberingCorresponds(normalizedA, normalizedB)) return 0;
  return similarity(normalizedA, normalizedB);
}

function bestCandidate(
  name: string,
  concepts: readonly Concept[],
  minScore: number,
): ConceptMatch | null {
  if (!normalizeConceptName(name)) return null;

  let best: ConceptMatch | null = null;

  for (const concept of concepts) {
    const candidates = [concept.canonicalName, ...concept.aliases];
    for (const candidateName of candidates) {
      const score = nameSimilarity(name, candidateName);
      // score === 0 nunca é um candidato de verdade: ou o nome não bateu em
      // nada, ou a guarda de numeração rejeitou o par (leis/artigos/edições
      // diferentes). `bestConceptCandidate` (minScore 0) devolve o melhor
      // candidato "regardless of threshold", mas isso não deve incluir ruído.
      if (score > 0 && score >= minScore && (best === null || score > best.score)) {
        best = { concept, score };
      }
    }
  }

  return best;
}

export function matchConcept(name: string, concepts: readonly Concept[]): ConceptMatch | null {
  return bestCandidate(name, concepts, CONCEPT_MATCH_THRESHOLD);
}

/**
 * Igual a `matchConcept`, mas sem o corte pelo limiar: devolve o melhor
 * candidato mesmo quando o score fica abaixo de `CONCEPT_MATCH_THRESHOLD`.
 *
 * Existe porque `matchConcept` filtrava por dentro, o que tornava a razão
 * `'low_score'` de `ProposedConceptLink` inatingível — um quase-acerto
 * (`Matemática financeira` contra `Matemática financeira básica`, score 0.75)
 * nunca chegava a `dedupeEntries` como candidato, então nunca virava proposta.
 * `shouldLinkDirectly` continua sendo o único portão que decide se a ligação é
 * aplicada; esta função só amplia o que conta como "candidato encontrado".
 */
export function bestConceptCandidate(name: string, concepts: readonly Concept[]): ConceptMatch | null {
  return bestCandidate(name, concepts, 0);
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
