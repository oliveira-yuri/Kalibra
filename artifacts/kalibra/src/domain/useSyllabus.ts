import { useSyllabus as localUseSyllabus } from './adapters/local/syllabus';
import { domainConfig } from './config';
import type { SyllabusPort } from './ports';

if (domainConfig.syllabus !== 'local') {
  throw new Error('Adaptador de API de programa de estudo ainda não existe (Fase 3).');
}

// Tipado com o membro da porta: o compilador prova que o adaptador local a satisfaz.
export const useSyllabus: SyllabusPort['useSyllabus'] = localUseSyllabus;
