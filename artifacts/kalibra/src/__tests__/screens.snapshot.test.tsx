import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { clerkReactMock, TEST_USER } from '../test/clerk-mock';
import { emptyAvailability } from '@workspace/core';

vi.mock('@clerk/react', () => clerkReactMock);
vi.mock('@clerk/react/internal', () => ({
  publishableKeyFromHost: () => 'pk_test_snapshot',
}));
vi.mock('@clerk/themes', () => ({ shadcn: {} }));
vi.mock('@clerk/localizations', () => ({ ptBR: {} }));

// Data e hora reais tornariam o snapshot instável. `getDaysRemaining` fica com a
// implementação real: com o relógio congelado (vi.setSystemTime abaixo) ela é
// determinística, e mocá-la escondia a regressão I1 (Portal e barra lateral
// calculando a contagem regressiva de dois jeitos diferentes) — ver date-utils.test.ts.
vi.mock('../lib/date-utils', async () => {
  const real = await vi.importActual<typeof import('../lib/date-utils')>('../lib/date-utils');
  return {
    ...real,
    formatShortDate: () => '17 jan 2027',
    getCurrentDateFormatted: () => 'sexta, 12 set',
    getCurrentTimeFormatted: () => '16:20 BRT',
  };
});

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
  '/workspace/setec-campinas/aprovacoes',
  '/',
  '/sign-in',
  '/sign-up',
  '/rota-inexistente',
];

describe('telas do Kalibra', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    document.documentElement.className = '';
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 13, 12, 0));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it.each(ROTAS)('renderiza %s de forma estável', async (rota) => {
    window.history.replaceState({}, '', rota);
    const { default: App } = await import('../App');
    const { container } = render(<App />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('nao usa sinal duplo para prova de cargo cuja data ja passou', async () => {
    // bb-escriturario (fixture padrão) tem examDate 2026-06-01, no passado em relação ao
    // relógio congelado em 2026-09-13 — regressão coberta: sem a convenção de três vias
    // (D−n / HOJE / D+n), essa data renderizava "D−-104" (sinal duplo).
    window.history.replaceState({}, '', '/portal');
    const { default: App } = await import('../App');
    const { container } = render(<App />);
    expect(container.innerHTML).not.toMatch(/D−-\d/);
    expect(container.innerHTML).toContain('D+104');
  });

  it('deriva o próximo passo do status quando nextAction está vazio', async () => {
    // Nenhuma fixture de defaultPrograms cobre isso (ambas carregam nextAction de texto
    // livre) — este teste semeia um workspace direto no localStorage, no mesmo formato que
    // useWorkspaces espera, sem tocar defaultPrograms.
    window.localStorage.setItem(`kalibra_workspaces:${TEST_USER.id}`, JSON.stringify([{
      slug: 'sem-proximo-passo',
      title: 'Workspace sem texto livre',
      institution: 'Instituição X',
      type: 'Concurso Público',
      examDate: '2027-01-01',
      cargos: [{ id: 'c1', name: 'Cargo único', examDate: '2027-01-01' }],
      selectedCargoId: 'c1',
      availability: emptyAvailability(),
      status: 'diagnostico_pendente',
      hasEdital: true,
      sourceMode: 'text',
      importStatus: 'completed',
      progress: 0,
      nextAction: '',
      active: true,
    }]));
    window.history.replaceState({}, '', '/portal');
    const { default: App } = await import('../App');
    const { container } = render(<App />);
    expect(container.innerHTML).toContain('Fazer o diagnóstico inicial');
  });

  it('renderiza /aprovacoes com itens pendentes de forma estável', async () => {
    // Nada hoje enfileira um item de verdade (achado 1 do brief da Task 9 — a fila
    // nasce vazia em produção); sem semear o localStorage aqui, o snapshot só provaria
    // o estado vazio e nunca exercitaria o cartão, o diff ou os botões de decisão.
    window.localStorage.setItem(`kalibra_approvals:${TEST_USER.id}`, JSON.stringify([
      {
        id: 'appr-1',
        workspaceId: 'setec-campinas',
        type: 'concept_merge',
        status: 'pendente',
        title: 'Fundir "Lei nº 14.133/2021" com "Nova Lei de Licitações"',
        rationale: 'As duas entradas do edital citam o mesmo diploma legal com nomes diferentes.',
        sourceRef: 'edital · item 3.2.1',
        targetConceptId: 'concept-licitacoes',
        confidence: 0.91,
        payloadBefore: { canonicalName: 'Nova Lei de Licitações', status: 'provisional' },
        payloadAfter: { canonicalName: 'Lei nº 14.133/2021', status: 'confirmed' },
        createdAt: '2026-09-01T00:00:00.000Z',
        decidedAt: null,
        reason: null,
      },
      {
        id: 'appr-2',
        workspaceId: 'setec-campinas',
        type: 'edital_structure',
        status: 'pendente',
        title: 'Estrutura do edital identificada — versão 2',
        rationale: 'Extração automática do texto colado na atualização do edital.',
        sourceRef: null,
        targetConceptId: null,
        confidence: 0.8,
        payloadBefore: null,
        payloadAfter: { version: '2', entries: [] },
        createdAt: '2026-09-02T00:00:00.000Z',
        decidedAt: null,
        reason: null,
      },
    ]));
    window.history.replaceState({}, '', '/workspace/setec-campinas/aprovacoes');
    const { default: App } = await import('../App');
    const { container } = render(<App />);
    expect(container.innerHTML).toContain('button-approve-appr-1');
    expect(container.innerHTML).toContain('approval-diff');
    expect(container.innerHTML).toContain('link-review-structure-appr-2');
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe('tema padrão', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    document.documentElement.className = '';
  });

  it('abre em dark quando não há preferência salva', async () => {
    window.history.replaceState({}, '', '/portal');
    const { default: App } = await import('../App');
    render(<App />);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('respeita a preferência salva pelo usuário', async () => {
    window.localStorage.setItem('kalibra-theme', 'light');
    window.history.replaceState({}, '', '/portal');
    const { default: App } = await import('../App');
    render(<App />);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
