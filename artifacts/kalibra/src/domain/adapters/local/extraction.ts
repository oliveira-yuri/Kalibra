import { useCallback, useRef, useState } from 'react';
import {
  validateExtractionOutput,
  type ExtractionOutput,
  type ExtractionProgress,
  type RawSyllabusEntry,
} from '@workspace/core';

export type ExtractionSourceMode = 'file' | 'text';

export type ExtractionInput = {
  sourceMode: ExtractionSourceMode;
  text: string;
  cargoIds: string[];
};

const STAGE_DELAY_MS = {
  enviando: 400,
  extraindo: 900,
  identificando: 900,
} as const;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Uma linha conta como cabeçalho de disciplina quando está toda em CAIXA ALTA. */
function isUpperCaseLine(line: string): boolean {
  const letters = line.replace(/[^\p{L}]/gu, '');
  return letters.length > 0 && letters === letters.toUpperCase();
}

/** Numeração de primeiro nível: "1. ...", "1) ..." — não "1.2 ..." (isso é subitem). */
function isFirstLevelHeading(line: string): boolean {
  return /^\s*\d+[.)]\s+\S/.test(line);
}

/**
 * Deriva `RawSyllabusEntry[]` de texto colado, deterministicamente: uma linha
 * em CAIXA ALTA ou com numeração de primeiro nível vira disciplina; as
 * demais viram tópico da última disciplina vista. Uma linha antes de
 * qualquer disciplina identificada é descartada — é assim que um texto sem
 * estrutura nenhuma (sem títulos reconhecíveis) produz zero entradas e
 * alcança o erro `structure`.
 *
 * Sem regra de negócio além disso: normalização e deduplicação de verdade
 * vivem em `lib/core` (`dedupeEntries`) e são chamadas por quem consome este
 * output, não reimplementadas aqui. Este é o único arquivo desta fase que a
 * Fase 4 (extração por IA) vai substituir — mantido pequeno de propósito.
 */
function extractEntriesFromText(text: string, cargoIds: string[]): RawSyllabusEntry[] {
  // Sem cargoIds, nenhuma entrada teria a quem pertencer — um edital bem
  // formado não pode virar erro de `structure` só porque o chamador não
  // informou cargos ainda. `demoFileEntries` já se defende assim; consistente.
  const cargos = cargoIds.length > 0 ? cargoIds : ['c1'];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const entries: RawSyllabusEntry[] = [];
  let currentDiscipline: string | null = null;

  for (const line of lines) {
    const isDiscipline = isUpperCaseLine(line) || isFirstLevelHeading(line);
    if (isDiscipline) {
      currentDiscipline = line;
    } else if (currentDiscipline === null) {
      continue;
    }

    for (const cargoId of cargos) {
      entries.push({
        cargoId,
        label: line,
        parentLabel: isDiscipline ? null : currentDiscipline,
        weight: null,
        questionCount: null,
        sourceExcerpt: null,
        page: null,
        confidence: 0.75,
      });
    }
  }

  return entries;
}

/** `sourceMode === 'file'` não tem texto real por trás (ainda), então a estrutura é fixa. */
function demoFileEntries(cargoIds: string[]): RawSyllabusEntry[] {
  const cargos = cargoIds.length > 0 ? cargoIds : ['c1'];
  const entries: RawSyllabusEntry[] = [];
  for (const cargoId of cargos) {
    entries.push(
      { cargoId, label: 'Língua Portuguesa', parentLabel: null, weight: 25, questionCount: 10, sourceExcerpt: null, page: null, confidence: 0.7 },
      { cargoId, label: 'Interpretação de texto', parentLabel: 'Língua Portuguesa', weight: null, questionCount: 5, sourceExcerpt: null, page: null, confidence: 0.7 },
      { cargoId, label: 'Raciocínio Lógico', parentLabel: null, weight: 25, questionCount: 10, sourceExcerpt: null, page: null, confidence: 0.7 },
    );
  }
  return entries;
}

const MIN_WORDS = 50;

/**
 * Produtor simulado do contrato de extração (`lib/core/src/syllabus/extraction.ts`).
 * Percorre os quatro estágios com atrasos curtos, como `EditalUploadProgress`
 * já fazia — mas devolve uma `ExtractionOutput` de verdade, derivada
 * deterministicamente do texto colado.
 *
 * Os quatro tipos de erro ficam declarados na API (`ExtractionErrorKind`),
 * mas só `short` (texto com menos de 50 palavras) e `structure` (texto sem
 * nenhuma disciplina reconhecível) são alcançáveis aqui — `scanned` e
 * `corrupted` dependem de ler um arquivo de verdade, o que só a Fase 4 faz.
 */
export function useExtraction(workspaceSlug: string) {
  const [progress, setProgress] = useState<ExtractionProgress>({
    stage: 'enviando',
    wordCount: null,
    errorKind: null,
  });
  const [output, setOutput] = useState<ExtractionOutput | null>(null);
  const cancelledRef = useRef(false);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const start = useCallback((input: ExtractionInput) => {
    cancelledRef.current = false;
    setOutput(null);
    setProgress({ stage: 'enviando', wordCount: null, errorKind: null });

    void (async () => {
      await delay(STAGE_DELAY_MS.enviando);
      if (cancelledRef.current) return;

      const words = wordCount(input.text);

      if (input.sourceMode === 'text' && words < MIN_WORDS) {
        setProgress({ stage: 'erro', wordCount: words, errorKind: 'short' });
        return;
      }

      setProgress({ stage: 'extraindo', wordCount: words, errorKind: null });
      await delay(STAGE_DELAY_MS.extraindo);
      if (cancelledRef.current) return;

      setProgress({ stage: 'identificando', wordCount: words, errorKind: null });
      await delay(STAGE_DELAY_MS.identificando);
      if (cancelledRef.current) return;

      const entries = input.sourceMode === 'file'
        ? demoFileEntries(input.cargoIds)
        : extractEntriesFromText(input.text, input.cargoIds);

      const validated = validateExtractionOutput({
        entries,
        detectedCargos: input.cargoIds,
        examFormat: null,
        examDurationMinutes: null,
        uncertainties: [],
      });

      if (!validated || validated.entries.length === 0) {
        setProgress({ stage: 'erro', wordCount: words, errorKind: 'structure' });
        return;
      }

      setOutput(validated);
      setProgress({ stage: 'pronto', wordCount: words, errorKind: null });
    })();
  }, [workspaceSlug]);

  return { progress, start, cancel, output };
}
