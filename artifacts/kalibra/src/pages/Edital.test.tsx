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
  // `bloco-textarea` (não mais placeholder) porque o textarea único virou
  // `EditalSourceBlocks` (Task 6) — com um cargo só ele não mostra abas, então o
  // testid do textarea continua sendo o único jeito estável de achar o campo.
  fireEvent.change(screen.getByTestId('bloco-textarea'), {
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

describe('Edital — Task 15 (a lista vem do programa salvo, não de @/data)', () => {
  const SYLLABUS_KEY = `kalibra_syllabus:${TEST_USER.id}:setec-campinas`;

  function seedTwoCargoWorkspace() {
    window.localStorage.setItem(WORKSPACES_KEY, JSON.stringify([{
      slug: 'setec-campinas',
      title: 'Concurso SETEC Campinas',
      institution: 'SETEC',
      type: 'Concurso Público',
      examDate: '2027-01-17',
      cargos: [
        { id: 'c1', name: 'Analista Técnico (Informática)', examDate: '2027-01-17', period: 'A' },
        { id: 'c2', name: 'Agente de Suporte Técnico', examDate: '2027-01-17', period: 'B' },
      ],
      selectedCargoId: 'c1',
      availability: { days: [], maxSessionMinutes: 50 },
      status: 'diagnostico_pendente',
      sourceMode: 'text',
      importStatus: 'completed',
      progress: 0,
      nextAction: 'texto qualquer',
      active: true,
    }]));
  }

  function seedSyllabus() {
    window.localStorage.setItem(SYLLABUS_KEY, JSON.stringify({
      items: [
        { id: 'mat', workspaceId: 'setec-campinas', conceptId: 'c-mat', parentItemId: null, sourceLabel: 'Matemática', sourceExcerpt: null, page: null, confidence: 1, uncertain: false },
        { id: 'razao', workspaceId: 'setec-campinas', conceptId: 'c-razao', parentItemId: 'mat', sourceLabel: 'Razão e proporção', sourceExcerpt: null, page: null, confidence: 1, uncertain: false },
        { id: 'etica', workspaceId: 'setec-campinas', conceptId: 'c-etica', parentItemId: null, sourceLabel: 'Ética no serviço público', sourceExcerpt: null, page: null, confidence: 1, uncertain: false },
      ],
      links: [
        { syllabusItemId: 'razao', cargoId: 'c1', weight: 20, questionCount: 5 },
        { syllabusItemId: 'etica', cargoId: 'c1', weight: 10, questionCount: 2 },
        { syllabusItemId: 'etica', cargoId: 'c2', weight: 15, questionCount: 3 },
      ],
    }));
  }

  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital');
  });

  afterEach(() => {
    cleanup();
  });

  it('sem programa salvo, mostra estado vazio honesto — nunca a lista mocada de @/data', async () => {
    seedWorkspace('diagnostico_pendente');
    const { default: App } = await import('../App');
    const { container } = render(<App />);

    expect(container.innerHTML).toContain('0 tópicos mapeados');
    expect(screen.getByTestId('edital-topics-empty')).toBeTruthy();
    // Nomes que só existem no mock de @/data — nunca podem aparecer.
    expect(container.innerHTML).not.toContain('Razão, proporção e regra de três');
    expect(container.innerHTML).not.toContain('Lei de Acesso à Informação');
  });

  it('com um programa salvo, a tabela mostra os tópicos reais (folhas), com a matéria do pai', async () => {
    seedTwoCargoWorkspace();
    seedSyllabus();
    const { default: App } = await import('../App');
    const { container } = render(<App />);

    expect(container.innerHTML).toContain('2 tópicos mapeados');
    // "Razão e proporção" é folha de "Matemática" — a matéria mostrada é a do pai.
    const row = screen.getByTestId('row-topic-razao');
    expect(row.textContent).toContain('Matemática');
    expect(row.textContent).toContain('Razão e proporção');
    // "Matemática" (o pai, que tem filho) nunca vira uma linha própria da tabela.
    expect(screen.queryByTestId('row-topic-mat')).toBeNull();
  });

  it('prioridade e acerto nunca mostram zero fabricado — estado honesto até o diagnóstico', async () => {
    seedTwoCargoWorkspace();
    seedSyllabus();
    const { default: App } = await import('../App');
    render(<App />);

    const row = screen.getByTestId('row-topic-razao');
    expect(row.textContent).toContain('sem dados até o diagnóstico');
    expect(row.textContent).not.toMatch(/\d+%/);
    expect(row.textContent).toContain('não iniciado');
  });

  it('um tópico comum a dois cargos ganha o chip de contagem e o aviso de deduplicação', async () => {
    seedTwoCargoWorkspace();
    seedSyllabus();
    const { default: App } = await import('../App');
    const { container } = render(<App />);

    expect(screen.getByTestId('chip-common-etica').textContent).toContain('2 cargos');
    expect(container.innerHTML).toContain('comum a mais de um cargo');
    // "Razão e proporção" só está em c1 — não ganha o chip.
    expect(screen.queryByTestId('chip-common-razao')).toBeNull();
  });

  it('o filtro de cargo restringe a lista e mostra o total de questões diretas do cargo', async () => {
    seedTwoCargoWorkspace();
    seedSyllabus();
    const { default: App } = await import('../App');
    render(<App />);

    fireEvent.click(screen.getByTestId('cargo-filter-c2'));

    // Só "Ética" está ligada a c2 — "Razão e proporção" (só c1) some da lista.
    expect(screen.getByTestId('row-topic-etica')).toBeTruthy();
    expect(screen.queryByTestId('row-topic-razao')).toBeNull();
    expect(screen.getByText(/3 questões/)).toBeTruthy();
  });
});

describe('Edital — Task 6 (blocos do edital por cargo na reimportação)', () => {
  function seedTwoCargoWorkspace() {
    window.localStorage.setItem(WORKSPACES_KEY, JSON.stringify([{
      slug: 'setec-campinas',
      title: 'Concurso SETEC Campinas',
      institution: 'SETEC',
      type: 'Concurso Público',
      examDate: '2027-01-17',
      cargos: [
        { id: 'c1', name: 'Analista Técnico (Informática)', examDate: '2027-01-17', period: 'A' },
        { id: 'c2', name: 'Agente de Suporte Técnico', examDate: '2027-01-17', period: 'B' },
      ],
      selectedCargoId: 'c1',
      availability: { days: [], maxSessionMinutes: 50 },
      status: 'diagnostico_pendente',
      sourceMode: 'text',
      importStatus: 'completed',
      progress: 0,
      nextAction: 'texto qualquer',
      active: true,
    }]));
  }

  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital');
  });

  afterEach(() => {
    cleanup();
  });

  it('a reimportação oferece blocos por cargo quando o workspace tem mais de um', async () => {
    seedTwoCargoWorkspace();
    const { default: App } = await import('../App');
    render(<App />);

    fireEvent.click(screen.getByTestId('button-import-syllabus'));
    fireEvent.click(screen.getByText('Texto'));

    expect(screen.getByTestId('bloco-aba-comum')).toBeTruthy();
  });
});
