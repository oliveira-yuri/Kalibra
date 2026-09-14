import { useCallback, useRef, useState } from 'react';
import {
  expandBlocks,
  validateExtractionOutput,
  type CargoTextBlock,
  type ExtractionOutput,
  type ExtractionProgress,
  type RawSyllabusEntry,
} from '@workspace/core';

export type ExtractionSourceMode = 'file' | 'text';

export type ExtractionInput = {
  sourceMode: ExtractionSourceMode;
  /** Blocos do edital: `cargoId: null` é o conteúdo comum a todos os cargos. */
  blocks: CargoTextBlock[];
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
 * Analisa UM bloco de texto em linhas rotuladas. Sem nenhuma noção de cargo: uma
 * linha em CAIXA ALTA ou com numeração de primeiro nível vira disciplina, as demais
 * viram tópico da última disciplina vista, e uma linha antes de qualquer disciplina
 * é descartada (é assim que um texto sem estrutura produz zero entradas e alcança o
 * erro `structure`).
 */
function parseBlockLines(text: string): Array<{ label: string; parentLabel: string | null }> {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const parsed: Array<{ label: string; parentLabel: string | null }> = [];
  let currentDiscipline: string | null = null;

  for (const line of lines) {
    const isDiscipline = isUpperCaseLine(line) || isFirstLevelHeading(line);
    if (isDiscipline) {
      currentDiscipline = line;
    } else if (currentDiscipline === null) {
      continue;
    }
    parsed.push({ label: line, parentLabel: isDiscipline ? null : currentDiscipline });
  }

  return parsed;
}

/**
 * Converte blocos em `RawSyllabusEntry[]`. `expandBlocks` (`lib/core`) decide a quem
 * cada bloco pertence; aqui só se analisa o texto resultante.
 *
 * Antes da Fase 1B.5 esta função recebia UM texto e o distribuía para todos os cargos
 * num laço — então todo tópico nascia comum a todos, e a deduplicação multi-cargo,
 * construída e testada, nunca tinha duas entradas diferentes para distinguir.
 */
function entriesFromBlocks(blocks: readonly CargoTextBlock[], cargoIds: string[]): RawSyllabusEntry[] {
  // Sem cargoIds, nenhuma entrada teria a quem pertencer — um edital bem formado não
  // pode virar erro de `structure` só porque o chamador não informou cargos ainda.
  const cargos = cargoIds.length > 0 ? cargoIds : ['c1'];
  const entries: RawSyllabusEntry[] = [];

  for (const pair of expandBlocks(blocks, cargos)) {
    for (const line of parseBlockLines(pair.text)) {
      entries.push({
        cargoId: pair.cargoId,
        label: line.label,
        parentLabel: line.parentLabel,
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

      // Cada bloco conta UMA vez. Contar o resultado expandido faria um edital curto
      // passar do limiar só por ter muitos cargos — o bloco comum contado N vezes.
      const words = input.blocks.reduce((total, block) => total + wordCount(block.text), 0);

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
        : entriesFromBlocks(input.blocks, input.cargoIds);

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
