import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { clerkReactMock } from '../test/clerk-mock';

vi.mock('@clerk/react', () => clerkReactMock);
vi.mock('@clerk/react/internal', () => ({
  publishableKeyFromHost: () => 'pk_test_snapshot',
}));
vi.mock('@clerk/themes', () => ({ shadcn: {} }));
vi.mock('@clerk/localizations', () => ({ ptBR: {} }));

// Data e hora reais tornariam o snapshot instável.
vi.mock('../lib/date-utils', () => ({
  getDaysRemaining: () => 'D−129',
  formatShortDate: () => '17 jan 2027',
  getCurrentDateFormatted: () => 'sexta, 12 set',
  getCurrentTimeFormatted: () => '16:20 BRT',
}));

const ROTAS = [
  '/portal',
  '/portal/novo-workspace',
  '/workspace/setec-campinas',
  '/workspace/setec-campinas/edital',
  '/workspace/setec-campinas/edital/revisar/1',
  '/workspace/setec-campinas/estudo',
  '/workspace/setec-campinas/notas',
  '/workspace/setec-campinas/revisao',
  '/workspace/setec-campinas/questoes',
  '/workspace/setec-campinas/erros',
  '/workspace/setec-campinas/recomendacoes',
  '/workspace/setec-campinas/diagnostico',
];

describe('telas do Kalibra', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    document.documentElement.className = '';
  });

  it.each(ROTAS)('renderiza %s de forma estável', async (rota) => {
    window.history.replaceState({}, '', rota);
    const { default: App } = await import('../App');
    const { container } = render(<App />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});
