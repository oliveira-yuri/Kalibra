import { useStudyState as localUseStudyState } from './adapters/local/studyState';
import { domainConfig } from './config';

if (domainConfig.studyState !== 'local') {
  throw new Error('Adaptador de API de estado de estudo ainda não existe (Fase 3).');
}

export const useStudyState = localUseStudyState;
