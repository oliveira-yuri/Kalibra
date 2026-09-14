import { useConcepts as localUseConcepts } from './adapters/local/concepts';
import { domainConfig } from './config';

export { migrateConcepts, confirmConcept } from './adapters/local/concepts';

if (domainConfig.concepts !== 'local') {
  throw new Error('Adaptador de API de conceitos ainda não existe (Fase 3).');
}

export const useConcepts = localUseConcepts;
