import { useExtraction as localUseExtraction } from './adapters/local/extraction';
import { domainConfig } from './config';

export type { ExtractionInput, ExtractionSourceMode } from './adapters/local/extraction';
export type {
  ExtractionErrorKind, ExtractionStage, ExtractionProgress, ExtractionOutput,
} from '@workspace/core';
export { EXTRACTION_ERROR_MESSAGES, validateExtractionOutput } from '@workspace/core';

if (domainConfig.extraction !== 'local') {
  throw new Error('Adaptador de API de extração ainda não existe (Fase 3).');
}

export const useExtraction = localUseExtraction;
