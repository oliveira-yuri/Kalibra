import { type RawSyllabusEntry } from './dedup';

export type ExtractionErrorKind = 'scanned' | 'corrupted' | 'short' | 'structure';

export type ExtractionStage = 'enviando' | 'extraindo' | 'identificando' | 'pronto' | 'erro';

export type ExtractionProgress = {
  stage: ExtractionStage;
  wordCount: number | null;
  errorKind: ExtractionErrorKind | null;
};

export type ExtractionOutput = {
  entries: RawSyllabusEntry[];
  detectedCargos: string[];
  examFormat: string | null;
  examDurationMinutes: number | null;
  uncertainties: string[];
};

/**
 * As quatro mensagens de erro do PD-07 — texto de produto, não improviso.
 * `scanned` e `corrupted` ficam disponíveis na API desde já; só a Fase 4 (que
 * lê arquivo de verdade) consegue disparar essas duas — o produtor simulado
 * desta fase só alcança `short` e `structure`.
 */
export const EXTRACTION_ERROR_MESSAGES: Record<ExtractionErrorKind, { message: string; action: string }> = {
  scanned: {
    message: 'Este PDF é uma imagem, não texto. Não é possível extrair o conteúdo automaticamente.',
    action: 'Colar o texto manualmente',
  },
  corrupted: {
    message: 'Não foi possível abrir o arquivo.',
    action: 'Enviar outro arquivo',
  },
  short: {
    message: 'O conteúdo enviado tem poucas palavras. Verifique se é o edital completo.',
    action: 'Enviar mesmo assim',
  },
  structure: {
    message: 'O conteúdo foi extraído, mas não conseguimos identificar a estrutura.',
    action: 'Montar manualmente',
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Migra um item de `entries` isolado. Segue a mesma disciplina de
 * `migrateWorkspace`: nunca lança, e devolve null só quando o item nem
 * sequer tem o mínimo (`cargoId` e `label`) para ser reconhecido.
 */
function migrateRawEntry(raw: unknown): RawSyllabusEntry | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.cargoId !== 'string' || !raw.cargoId) return null;
  if (typeof raw.label !== 'string' || !raw.label) return null;

  const confidence = typeof raw.confidence === 'number' ? clampConfidence(raw.confidence) : 0;

  return {
    cargoId: raw.cargoId,
    label: raw.label,
    parentLabel: toNullableString(raw.parentLabel),
    weight: toNullableNumber(raw.weight),
    questionCount: toNullableNumber(raw.questionCount),
    sourceExcerpt: toNullableString(raw.sourceExcerpt),
    page: toNullableNumber(raw.page),
    confidence,
  };
}

/**
 * Valida a saída de uma extração (simulada hoje, de IA na Fase 4) sem nunca
 * lançar. Segue a mesma disciplina de `migrateWorkspace`: total, idempotente,
 * descarta o que não reconhece em vez de propagar lixo, e devolve `null` só
 * quando a entrada inteira é irreconhecível — uma entrada malformada dentro
 * de `entries` não derruba as demais (defesa em profundidade, ver
 * `migrateRawEntry`).
 */
export function validateExtractionOutput(output: unknown): ExtractionOutput | null {
  if (!isRecord(output)) return null;
  if (!Array.isArray(output.entries)) return null;

  const entries: RawSyllabusEntry[] = [];
  for (const raw of output.entries) {
    try {
      const migrated = migrateRawEntry(raw);
      if (migrated) entries.push(migrated);
    } catch {
      // Defesa em profundidade: um item inesperado não pode derrubar a extração inteira.
    }
  }

  const detectedCargos = Array.isArray(output.detectedCargos)
    ? output.detectedCargos.filter((item): item is string => typeof item === 'string')
    : [];

  const uncertainties = Array.isArray(output.uncertainties)
    ? output.uncertainties.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    entries,
    detectedCargos,
    examFormat: toNullableString(output.examFormat),
    examDurationMinutes: toNullableNumber(output.examDurationMinutes),
    uncertainties,
  };
}
