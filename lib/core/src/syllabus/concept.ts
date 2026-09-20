export type ConceptStatus = 'confirmed' | 'provisional';
export type ConceptKind = 'disciplina' | 'topico' | 'subtopico';

/**
 * Os valores em runtime, derivados de um `Record` COMPLETO sobre o tipo — o mesmo
 * padrão de `WORKSPACE_STATUSES`. `Object.keys` sobre um `Record<Tipo, …>` nunca
 * pode ficar atrás do tipo: acrescentar um valor à união quebra o compilador aqui,
 * onde o `Record` fica incompleto.
 *
 * Uma lista literal mantida à mão aceitaria o valor novo no tipo e o rejeitaria em
 * runtime — o defeito que `VALID_STATUSES` tinha antes de `WORKSPACE_STATUSES`.
 *
 * Existem porque o banco declara estes valores como `pgEnum` e um teste compara os
 * dois conjuntos: comparar com um TIPO é impossível, tipos não existem em runtime.
 */
const CONCEPT_STATUS_SET: Record<ConceptStatus, true> = { confirmed: true, provisional: true };
export const CONCEPT_STATUSES: readonly ConceptStatus[] = Object.keys(CONCEPT_STATUS_SET) as ConceptStatus[];

const CONCEPT_KIND_SET: Record<ConceptKind, true> = { disciplina: true, topico: true, subtopico: true };
export const CONCEPT_KINDS: readonly ConceptKind[] = Object.keys(CONCEPT_KIND_SET) as ConceptKind[];

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

// Numeração de item de edital no início da string: "1.2.3 ", "4 - ", "II – ",
// "a) " etc.
//
// DISCREPÂNCIA vs. o brief original (Task 1): o exemplo exigia `\s+` (espaço)
// depois do separador para reconhecer a numeração, então uma entrada que é
// *só* numeração — "1.2." sem nada depois — não batia e sobrava "1.2" em vez
// de "". Trocada a fronteira final por um lookahead `(?=\s|$)` que aceita
// também o fim da string.
//
// Achado da revisão (fix round 2, "Finding D"): o algarismo romano aqui era
// `[ivxlcdm]+` sem limite nem checagem de validade — cortava palavras comuns
// do português inteiras ("Civil e processual civil" virava "e processual
// civil", "Mil e uma" virava "e uma"), corrompendo a identidade do item
// guardado. `isRomanNumeralWord` (abaixo) decide se o candidato capturado é
// numeração de verdade antes de `stripLeadingNumbering` cortar.
/**
 * Padrão canônico de algarismo romano em notação subtrativa (valores 1-3999).
 * Valida a SEQUÊNCIA, não só o alfabeto — sem isso, "civil", "mil", "dividi",
 * "vivi" (só letras de i/v/x/l/c/d/m, mas em ordem que não forma um numeral
 * válido) passariam como numeração. Limite de 7 caracteres: cobre os incisos e
 * capítulos reais de um edital (até XXXVIII); um numeral válido mais longo que
 * isso não é um caso real neste domínio.
 */
const ROMAN_NUMERAL_PATTERN = /^m{0,4}(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3})$/;

function isRomanNumeralWord(word: string): boolean {
  return word.length > 0 && word.length <= 7 && ROMAN_NUMERAL_PATTERN.test(word);
}

// Candidato a numeração no início da string, capturado sem consumir a
// fronteira final — quem decide se é numeração de verdade é
// `stripLeadingNumbering`, usando `isRomanNumeralWord` no grupo 2.
const LEADING_TOKEN = /^\s*([0-9]+(?:\.[0-9]+)*|([ivxlcdm]+|[a-z]))\s*[.)\-–—]*(?=\s|$)/i;

/**
 * Remove numeração do início de um nome de item de edital — mas só quando é
 * numeração de verdade: dígitos, uma letra avulsa de marcador de lista ("a)",
 * "b."), ou um algarismo romano válido. Ver a nota de `ROMAN_NUMERAL_PATTERN`.
 */
function stripLeadingNumbering(text: string): string {
  const match = text.match(LEADING_TOKEN);
  if (!match) return text;

  const whole = match[0];
  const token = match[1];
  const romanOrLetter = match[2];
  const isDigits = token !== romanOrLetter;
  const isBulletLetter = romanOrLetter !== undefined && romanOrLetter.length === 1;
  const isValidRoman = romanOrLetter !== undefined && isRomanNumeralWord(romanOrLetter);

  if (!isDigits && !isBulletLetter && !isValidRoman) return text;

  return text.slice(whole.length).replace(/^\s+/, '');
}
const TRAILING_PUNCTUATION = /[.,;:]+\s*$/;

export function normalizeConceptName(name: string): string {
  return stripLeadingNumbering(
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase(),
  )
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
// "1.171/94") — o formato normal de número de lei, artigo ou decreto num nome
// de edital. Algarismo romano ("ii", "xviii") é reconhecido por
// `isRomanNumeralWord`, que valida a sequência de verdade — ver a nota em
// `ROMAN_NUMERAL_PATTERN` acima sobre por que checar só o alfabeto não basta.
const NUMERIC_WORD = /^[0-9]+(?:[.\-/][0-9]+)*$/;

function extractNumberingTokens(normalized: string): string[] {
  const tokens: string[] = [];
  for (const word of normalized.split(' ')) {
    if (!word) continue;
    if (NUMERIC_WORD.test(word)) {
      tokens.push(...word.split(/[^0-9]+/).filter(Boolean));
    } else if (isRomanNumeralWord(word)) {
      tokens.push(word);
    }
  }
  return tokens;
}

/**
 * Achado da revisão (fix round 2, "Finding A"): a versão anterior aceitava
 * truncamento entre dois dígitos de QUALQUER tamanho — "137" batia com "37",
 * "5" batia com "15" — porque bastava um ser sufixo do outro. Isso é exatamente
 * o typo mais comum de artigo de edital ("Art. 5" vs "Art. 15"), não uma
 * variante real. O único truncamento real do domínio é o ano abreviado (2
 * dígitos representando os 2 últimos de um ano de 4), então a tolerância fica
 * restrita a esse formato específico: mais nenhum comprimento passa.
 */
function numberingTokensCorrespond(a: string, b: string): boolean {
  if (a === b) return true;
  // Algarismo romano nunca tolera truncamento: "ii" e "iii" são conceitos
  // diferentes, não abreviações um do outro.
  if (!/^[0-9]+$/.test(a) || !/^[0-9]+$/.test(b)) return false;

  const long = a.length >= b.length ? a : b;
  const short = a.length >= b.length ? b : a;
  return long.length === 4 && short.length === 2 && long.endsWith(short);
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

/**
 * Acrescenta `alias` aos aliases de `concept`, se ele ainda não estiver lá (e não for
 * idêntico ao nome canônico — um alias igual ao canônico não informa nada). Sem efeito
 * (devolve `concept` inalterado) para uma string vazia ou já presente — idempotente,
 * então chamar duas vezes com o mesmo alias não duplica nada.
 *
 * Achado C2/I1 da revisão final: `diffSyllabus` já lê aliases via `matchConcept`, mas
 * nada em produção jamais escrevia um — toda entrada nasce com `aliases: []` e ninguém
 * nunca acrescentava. Esta é a metade que faltava: o PRODUTOR de alias, usado tanto por
 * uma renomeação (`renameConcept` abaixo) quanto por uma fusão de conceito aprovada
 * (`concept_merge`, ver `applyApprovalSideEffects` no adaptador local).
 */
export function withAlias(concept: Concept, alias: string): Concept {
  const trimmed = alias.trim();
  if (!trimmed || trimmed === concept.canonicalName || concept.aliases.includes(trimmed)) return concept;
  return { ...concept, aliases: [...concept.aliases, trimmed] };
}

/**
 * Renomeia o nome canônico de um conceito, preservando o nome anterior como alias —
 * o mecanismo do PD-08 (achado C2 da revisão final): "renomeado ≠ removido + adicionado"
 * só é possível quando alguma coisa grava, no momento da renomeação, que o rótulo antigo
 * e o novo são o MESMO conceito. Esse é o único momento em que essa equivalência é
 * conhecida — depois dele, o rótulo antigo já não aparece em lugar nenhum para ser
 * comparado. Sem efeito quando o novo nome é vazio ou idêntico ao atual.
 */
export function renameConcept(concept: Concept, newCanonicalName: string): Concept {
  const trimmed = newCanonicalName.trim();
  if (!trimmed || trimmed === concept.canonicalName) return concept;
  return withAlias({ ...concept, canonicalName: trimmed }, concept.canonicalName);
}
