import { useSyllabus as localUseSyllabus } from './adapters/local/syllabus';
import { domainConfig } from './config';

export type { SyllabusRecord } from './adapters/local/syllabus';
export { migrateSyllabus } from './adapters/local/syllabus';

if (domainConfig.syllabus !== 'local') {
  throw new Error('Adaptador de API de programa de estudo ainda não existe (Fase 3).');
}

export const useSyllabus = localUseSyllabus;
