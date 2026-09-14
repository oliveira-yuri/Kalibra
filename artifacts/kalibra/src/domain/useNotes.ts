import { useNotes as localUseNotes } from './adapters/local/notes';
import { domainConfig } from './config';

if (domainConfig.notes !== 'local') {
  throw new Error('Adaptador de API de notas ainda não existe (Fase 3).');
}

export const useNotes = localUseNotes;
