import { useTheme as localUseTheme } from './adapters/local/theme';
import { domainConfig } from './config';

if (domainConfig.theme !== 'local') {
  throw new Error('Adaptador de API de tema ainda não existe (Fase 3).');
}

export const useTheme = localUseTheme;
