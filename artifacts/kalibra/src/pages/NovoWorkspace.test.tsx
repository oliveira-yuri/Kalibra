import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { clerkReactMock, TEST_USER } from '../test/clerk-mock';

vi.mock('@clerk/react', () => clerkReactMock);
vi.mock('@clerk/react/internal', () => ({
  publishableKeyFromHost: () => 'pk_test_novo_workspace',
}));
vi.mock('@clerk/themes', () => ({ shadcn: {} }));
vi.mock('@clerk/localizations', () => ({ ptBR: {} }));

function readStoredWorkspaces(): Array<{ slug: string; title: string; cargos: Array<{ id: string; name: string }>; selectedCargoId: string }> {
  const raw = window.localStorage.getItem(`kalibra_workspaces:${TEST_USER.id}`);
  return raw ? JSON.parse(raw) : [];
}

describe('NovoWorkspace — regressão I3 (nunca criar um workspace sem nenhum cargo)', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/portal/novo-workspace');
  });

  afterEach(() => {
    cleanup();
  });

  it('sintetiza "Cargo único" quando ninguém preenche a seção Cargos', async () => {
    const { default: App } = await import('../App');
    const { container } = render(<App />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Auditor Fiscal'), { target: { value: 'Analista Judiciário' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: FGV'), { target: { value: 'TRT' } });

    // O primeiro input type="date" é a data da prova do workspace; o segundo pertence
    // à linha (em branco, por padrão) de CargoFields.
    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBeGreaterThanOrEqual(1);
    fireEvent.change(dateInputs[0], { target: { value: '2027-03-01' } });

    // "Ainda não tenho" evita a exigência de arquivo/texto do edital e cai direto no
    // addWorkspace síncrono — sem isso o teste precisaria simular o upload fake.
    fireEvent.click(screen.getByText('Ainda não tenho'));
    fireEvent.click(screen.getByText('Criar Workspace'));

    const stored = readStoredWorkspaces();
    const criado = stored.find((w) => w.title === 'Analista Judiciário');
    expect(criado).toBeDefined();
    expect(criado?.cargos).toHaveLength(1);
    expect(criado?.cargos[0].name).toBe('Cargo único');
    expect(criado?.selectedCargoId).toBe(criado?.cargos[0].id);
  });

  it('mantém os cargos nomeados quando o usuário preenche a seção Cargos', async () => {
    const { default: App } = await import('../App');
    const { container } = render(<App />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Auditor Fiscal'), { target: { value: 'Perito Criminal' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: FGV'), { target: { value: 'Polícia Científica' } });
    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2027-03-01' } });
    fireEvent.change(screen.getByTestId('input-cargo-nome-0'), { target: { value: 'Perito Criminal Nível I' } });

    fireEvent.click(screen.getByText('Ainda não tenho'));
    fireEvent.click(screen.getByText('Criar Workspace'));

    const stored = readStoredWorkspaces();
    const criado = stored.find((w) => w.title === 'Perito Criminal');
    expect(criado?.cargos).toHaveLength(1);
    expect(criado?.cargos[0].name).toBe('Perito Criminal Nível I');
  });
});

describe('NovoWorkspace — regressão M3 (erros de disponibilidade não podem ficar presos)', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/portal/novo-workspace');
  });

  afterEach(() => {
    cleanup();
  });

  it('some com o erro de disponibilidade antigo quando um novo erro de campo obrigatório aparece', async () => {
    const { default: App } = await import('../App');
    const { container } = render(<App />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Auditor Fiscal'), { target: { value: 'Título X' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: FGV'), { target: { value: 'Instituição X' } });
    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2027-03-01' } });

    // Dispara um problema de disponibilidade: sessão máxima (50, o padrão) maior que a
    // disponibilidade de domingo (30 min).
    fireEvent.change(screen.getByTestId('input-disponibilidade-0'), { target: { value: '30' } });
    fireEvent.click(screen.getByText('Ainda não tenho'));
    fireEvent.click(screen.getByText('Criar Workspace'));
    expect(container.innerHTML).toContain('A sessão máxima é maior que a disponibilidade de domingo.');

    // Agora limpa o título (campo obrigatório) — o erro de disponibilidade antigo não
    // pode continuar visível ao lado do novo erro de campo obrigatório.
    fireEvent.change(screen.getByPlaceholderText('Ex: Auditor Fiscal'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Criar Workspace'));

    expect(container.innerHTML).toContain('Preencha os campos obrigatórios');
    expect(container.innerHTML).not.toContain('A sessão máxima é maior que a disponibilidade de domingo.');
  });
});
