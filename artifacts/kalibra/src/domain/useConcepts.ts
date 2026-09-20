import { useConcepts as localUseConcepts } from './adapters/local/concepts';
import { domainConfig } from './config';
import type { ConceptsPort } from './ports';

if (domainConfig.concepts !== 'local') {
  throw new Error('Adaptador de API de conceitos ainda não existe (Fase 3).');
}

// Tipado com o membro da porta: o compilador prova que o adaptador local a satisfaz.
export const useConcepts: ConceptsPort['useConcepts'] = localUseConcepts;
