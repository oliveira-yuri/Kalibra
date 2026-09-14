import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import type { WorkspaceStatus } from '@workspace/core';
import { clerkReactMock, TEST_USER } from '../test/clerk-mock';

vi.mock('@clerk/react', () => clerkReactMock);
vi.mock('@clerk/react/internal', () => ({
  publishableKeyFromHost: () => 'pk_test_edital',
}));
vi.mock('@clerk/themes', () => ({ shadcn: {} }));
vi.mock('@clerk/localizations', () => ({ ptBR: {} }));

const WORKSPACES_KEY = `kalibra_workspaces:${TEST_USER.id}`;

function seedWorkspace(status: WorkspaceStatus) {
  window.localStorage.setItem(WORKSPACES_KEY, JSON.stringify([{
    slug: 'setec-campinas',
    title: 'Concurso SETEC Campinas',
    institution: 'SETEC',
    type: 'Concurso Público',
    examDate: '2027-01-17',
    cargos: [{ id: 'c1', name: 'Analista Técnico (Informática)', examDate: '2027-01-17', period: 'A' }],
    selectedCargoId: 'c1',
    availability: { days: [], maxSessionMinutes: 50 },
    status,
    sourceMode: 'text',
    importStatus: 'completed',
    progress: 0,
    nextAction: 'texto qualquer',
    active: true,
  }]));
}

function readWorkspaceStatus(): WorkspaceStatus {
  const stored = JSON.parse(window.localStorage.getItem(WORKSPACES_KEY)!);
  return stored[0].status;
}

function openReimportModalWithText() {
  fireEvent.click(screen.getByTestId('button-import-syllabus'));
  fireEvent.click(screen.getByText('Texto'));
  fireEvent.change(screen.getByPlaceholderText('Cole o conteúdo programático atualizado...'), {
    target: { value: 'DIREITO CONSTITUCIONAL\nPrincípios fundamentais' },
  });
}

describe('Edital — Finding 1 do fix round 1 (reimportar não pode travar nem crashar)', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital');
  });

  afterEach(() => {
    cleanup();
  });

  describe.each<WorkspaceStatus>(['estudando', 'sem_edital', 'aguardando_revisao_edital', 'diagnostico_pendente', 'erro'])(
    'a partir de "%s" (transição válida para aguardando_upload)',
    (status) => {
      it('reimportar não mostra erro e começa a processar', async () => {
        seedWorkspace(status);
        const { default: App } = await import('../App');
        render(<App />);

        openReimportModalWithText();
        fireEvent.click(screen.getByText('Salvar nova versão'));

        expect(screen.queryByText(/Não é possível reimportar agora/)).toBeNull();
        expect(screen.getByText('Processando edital')).toBeTruthy();
        expect(readWorkspaceStatus()).toBe('extraindo_edital');
      });
    },
  );

  describe.each<WorkspaceStatus>(['diagnostico_em_andamento', 'plano_quinzenal_pendente'])(
    'a partir de "%s" (transição INVÁLIDA para aguardando_upload)',
    (status) => {
      it('bloqueia com uma mensagem de erro em vez de crashar, e não muda o status', async () => {
        seedWorkspace(status);
        const { default: App } = await import('../App');
        render(<App />);

        openReimportModalWithText();

        // Não pode lançar: o clique síncrono chamaria assertTransition sem guarda
        // antes deste fix e o erro escapava do handler, sem mensagem nenhuma.
        expect(() => fireEvent.click(screen.getByText('Salvar nova versão'))).not.toThrow();

        expect(screen.getByText(/Não é possível reimportar agora/)).toBeTruthy();
        expect(screen.queryByText('Processando edital')).toBeNull();
        expect(readWorkspaceStatus()).toBe(status);
      });
    },
  );

  it('workspace preso em "extraindo_edital" de uma sessão anterior se autocura para "erro" ao abrir a tela — nunca fica travado', async () => {
    // Simula exatamente o cenário do achado: uma extração anterior nunca terminou
    // (aba fechada, sem cleanup de desmontagem) e o workspace ficou nesse status para
    // sempre, sem nenhuma aresta de saída no grafo de `lib/core`.
    seedWorkspace('extraindo_edital');
    const { default: App } = await import('../App');
    render(<App />);

    expect(readWorkspaceStatus()).toBe('erro');
  });

  it('depois da autocura, reimportar funciona normalmente (erro -> aguardando_upload é uma aresta válida)', async () => {
    seedWorkspace('extraindo_edital');
    const { default: App } = await import('../App');
    render(<App />);

    expect(readWorkspaceStatus()).toBe('erro');

    openReimportModalWithText();
    fireEvent.click(screen.getByText('Salvar nova versão'));

    expect(screen.queryByText(/Não é possível reimportar agora/)).toBeNull();
    expect(readWorkspaceStatus()).toBe('extraindo_edital');
  });

  it('sair da tela no meio de uma extração recupera o status para "erro" (nunca fica em extraindo_edital para sempre)', async () => {
    seedWorkspace('estudando');
    const { default: App } = await import('../App');
    const view = render(<App />);

    openReimportModalWithText();
    fireEvent.click(screen.getByText('Salvar nova versão'));
    expect(readWorkspaceStatus()).toBe('extraindo_edital');

    // O usuário navega para longe (desmonta a tela) antes da extração terminar — sem
    // o cleanup do Finding 1, nada jamais tiraria o workspace de "extraindo_edital".
    view.unmount();

    expect(readWorkspaceStatus()).toBe('erro');
  });
});
