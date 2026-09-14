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

/**
 * O workspace criado em modo Texto não vai direto para `kalibra_workspaces` — fica
 * em `kalibra_pending_edital` (staging) até `EditalRevisar` confirmar a estrutura
 * (Task 10/11). `handleSubmit` grava esse staging de forma SÍNCRONA, então dá para
 * ler `workspace.sourceBlocks`/`workspace.cargos` logo depois do clique em "Criar
 * Workspace", sem precisar rodar a extração inteira.
 */
function readPending(slug: string): {
  workspace: { cargos: Array<{ id: string; name: string }>; sourceBlocks: Array<{ cargoId: string | null; text: string }> };
} {
  const raw = window.sessionStorage.getItem(`kalibra_pending_edital:${TEST_USER.id}:${slug}`);
  if (!raw) throw new Error(`Nenhuma importação pendente para o slug "${slug}".`);
  return JSON.parse(raw);
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

describe('NovoWorkspace — Task 6 (blocos do edital por cargo)', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/portal/novo-workspace');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('com dois cargos, a criação oferece blocos comum e por cargo', async () => {
    const { default: App } = await import('../App');
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Auditor Fiscal'), { target: { value: 'Título Dois Cargos' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: FGV'), { target: { value: 'Banca Y' } });
    fireEvent.change(screen.getByTestId('input-cargo-nome-0'), { target: { value: 'Cargo Um' } });

    // O segundo cargo nasce com id `c${Date.now()}` (CargoFields.add) — sem o relógio
    // congelado o id seria imprevisível e não daria para checar `bloco-aba-c2` direto.
    vi.useFakeTimers();
    vi.setSystemTime(2);
    fireEvent.click(screen.getByTestId('button-adicionar-cargo'));
    vi.useRealTimers();
    fireEvent.change(screen.getByTestId('input-cargo-nome-1'), { target: { value: 'Cargo Dois' } });

    fireEvent.click(screen.getByText('Colar Texto'));

    expect(screen.getByTestId('bloco-aba-comum')).toBeTruthy();
    expect(screen.getByTestId('bloco-aba-c2')).toBeTruthy();
  });
});

describe('NovoWorkspace — rodada de correção 1', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/portal/novo-workspace');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('achado I1: o texto colado chega a sourceBlocks no rascunho staged, não em [] (NovoWorkspace.tsx:124)', async () => {
    const { default: App } = await import('../App');
    const { container } = render(<App />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Auditor Fiscal'), { target: { value: 'Sourceblocks Persistidos' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: FGV'), { target: { value: 'Banca P' } });
    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2027-03-01' } });
    fireEvent.change(screen.getByTestId('input-cargo-nome-0'), { target: { value: 'Cargo Solo' } });

    fireEvent.click(screen.getByText('Colar Texto'));
    fireEvent.change(screen.getByTestId('bloco-textarea'), {
      target: { value: 'DIREITO ADMINISTRATIVO\nPrincípios' },
    });
    fireEvent.click(screen.getByText('Criar Workspace'));

    const pending = readPending('sourceblocks-persistidos');
    expect(pending.workspace.sourceBlocks).toEqual([
      { cargoId: null, text: 'DIREITO ADMINISTRATIVO\nPrincípios' },
    ]);
  });

  it('achado I2: cargo sem nome não ganha aba — o conteúdo digitado no comum chega à extração, não some em silêncio', async () => {
    const { default: App } = await import('../App');
    const { container } = render(<App />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Auditor Fiscal'), { target: { value: 'Cargo Sem Nome I2' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: FGV'), { target: { value: 'Banca Z' } });
    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2027-03-01' } });
    fireEvent.change(screen.getByTestId('input-cargo-nome-0'), { target: { value: 'Cargo Um' } });

    // Segundo cargo adicionado e deixado SEM nome de propósito — é exatamente o
    // achado I2. Antes do fix, `EditalSourceBlocks` recebia `cargos` (cru, com a
    // linha sem nome) e mostrava uma aba `c2` onde dava para digitar; a extração,
    // porém, só recebia `finalCargos` (só os nomeados) — o texto digitado ali
    // nunca era extraído nem mostrado em lugar nenhum.
    fireEvent.click(screen.getByTestId('button-adicionar-cargo'));

    fireEvent.click(screen.getByText('Colar Texto'));

    // Com só um cargo de fato indo para a extração (o nomeado), não pode existir
    // NENHUMA aba — nem "comum" — e o campo colapsa para o textarea único, o mesmo
    // padrão de um workspace de cargo só.
    expect(container.querySelectorAll('[data-testid^="bloco-aba-"]')).toHaveLength(0);

    fireEvent.change(screen.getByTestId('bloco-textarea'), {
      target: { value: 'CONTEUDO SO DO CARGO UM' },
    });
    fireEvent.click(screen.getByText('Criar Workspace'));

    const pending = readPending('cargo-sem-nome-i2');
    // O cargo sem nome nunca chega a existir de verdade (regressão I3 do fix round
    // anterior) — só o nomeado é criado.
    expect(pending.workspace.cargos).toHaveLength(1);
    expect(pending.workspace.cargos[0].name).toBe('Cargo Um');
    // E o conteúdo que o usuário digitou está lá — não foi descartado em silêncio.
    expect(pending.workspace.sourceBlocks).toEqual([
      { cargoId: null, text: 'CONTEUDO SO DO CARGO UM' },
    ]);
  });

  it('achado I3: remover um cargo depois de digitar conteúdo não deixa um bloco órfão em sourceBlocks', async () => {
    const { default: App } = await import('../App');
    const { container } = render(<App />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Auditor Fiscal'), { target: { value: 'Remocao De Cargo I3' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: FGV'), { target: { value: 'Banca X' } });
    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2027-03-01' } });
    fireEvent.change(screen.getByTestId('input-cargo-nome-0'), { target: { value: 'Cargo Um' } });

    // Mesmo truque do relógio congelado do teste da Task 6, para o segundo cargo
    // nascer com id previsível `c2`.
    vi.useFakeTimers();
    vi.setSystemTime(2);
    fireEvent.click(screen.getByTestId('button-adicionar-cargo'));
    vi.useRealTimers();
    fireEvent.change(screen.getByTestId('input-cargo-nome-1'), { target: { value: 'Cargo Dois' } });

    fireEvent.click(screen.getByText('Colar Texto'));

    // Digita no bloco comum (aba ativa por padrão) e no bloco específico de c2.
    fireEvent.change(screen.getByTestId('bloco-textarea'), { target: { value: 'CONTEUDO COMUM' } });
    fireEvent.click(screen.getByTestId('bloco-aba-c2'));
    fireEvent.change(screen.getByTestId('bloco-textarea'), { target: { value: 'CONTEUDO C2' } });

    // Remove o segundo cargo DEPOIS de já ter digitado conteúdo para ele.
    fireEvent.click(screen.getByTestId('button-remover-cargo-1'));

    fireEvent.click(screen.getByText('Criar Workspace'));

    const pending = readPending('remocao-de-cargo-i3');
    expect(pending.workspace.cargos).toHaveLength(1);
    expect(pending.workspace.cargos[0].id).toBe('c1');
    // O bloco de c2 não pode sobreviver à remoção do cargo: sem isto ele ficava
    // preso para sempre em `sourceBlocks`, nunca extraído nem mostrado a ninguém.
    expect(pending.workspace.sourceBlocks).toEqual([
      { cargoId: null, text: 'CONTEUDO COMUM' },
    ]);
  });
});

describe('NovoWorkspace — revisão final de branch (achados I-1 e M-5)', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/portal/novo-workspace');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  /** Preenche título/instituição/data e três cargos nomeados, com ids previsíveis c1/c2/c3. */
  function tresCargos(titulo: string, container: HTMLElement) {
    fireEvent.change(screen.getByPlaceholderText('Ex: Auditor Fiscal'), { target: { value: titulo } });
    fireEvent.change(screen.getByPlaceholderText('Ex: FGV'), { target: { value: 'Banca I1' } });
    fireEvent.change(container.querySelectorAll('input[type="date"]')[0], { target: { value: '2027-03-01' } });
    fireEvent.change(screen.getByTestId('input-cargo-nome-0'), { target: { value: 'Cargo Um' } });

    // Mesmo truque de relógio congelado dos testes da Task 6: o id de um cargo novo é
    // `c${Date.now()}` (CargoFields.add), então 2 e 3 dão `c2` e `c3`.
    vi.useFakeTimers();
    vi.setSystemTime(2);
    fireEvent.click(screen.getByTestId('button-adicionar-cargo'));
    vi.setSystemTime(3);
    fireEvent.click(screen.getByTestId('button-adicionar-cargo'));
    vi.useRealTimers();
    fireEvent.change(screen.getByTestId('input-cargo-nome-1'), { target: { value: 'Cargo Dois' } });
    fireEvent.change(screen.getByTestId('input-cargo-nome-2'), { target: { value: 'Cargo Tres' } });
  }

  it('achado I-1: digitar DEPOIS de remover o cargo da aba aberta não perde o texto no submit', async () => {
    const { default: App } = await import('../App');
    const { container } = render(<App />);
    tresCargos('Editor Fantasma I1', container);

    fireEvent.click(screen.getByText('Colar Texto'));
    fireEvent.change(screen.getByTestId('bloco-textarea'), { target: { value: 'LINGUA PORTUGUESA' } });
    fireEvent.click(screen.getByTestId('bloco-aba-c2'));
    fireEvent.change(screen.getByTestId('bloco-textarea'), { target: { value: 'INFORMATICA' } });

    // O cargo da aba ABERTA é removido. A partir daqui nenhum caractere pode entrar
    // num destino que o submit vai podar.
    fireEvent.click(screen.getByTestId('button-remover-cargo-1'));
    expect(screen.queryByTestId('bloco-aba-c2')).toBeNull();
    expect(screen.getByTestId('bloco-textarea').getAttribute('data-cargo')).toBe('comum');

    fireEvent.change(screen.getByTestId('bloco-textarea'), {
      target: { value: 'LINGUA PORTUGUESA -- Topico novo digitado depois' },
    });
    fireEvent.click(screen.getByText('Criar Workspace'));

    const pending = readPending('editor-fantasma-i1');
    expect(pending.workspace.cargos.map((cargo) => cargo.id)).toEqual(['c1', 'c3']);
    // O que foi digitado depois da remoção está no rascunho — antes do fix ele ia
    // para o bloco do cargo morto e a poda do submit o descartava em silêncio.
    expect(pending.workspace.sourceBlocks).toEqual([
      { cargoId: null, text: 'LINGUA PORTUGUESA -- Topico novo digitado depois' },
    ]);
  });

  it('achado I-1 (variante): apagar o NOME do cargo da aba aberta também devolve o campo ao bloco comum', async () => {
    const { default: App } = await import('../App');
    const { container } = render(<App />);
    tresCargos('Editor Fantasma Sem Nome', container);

    fireEvent.click(screen.getByText('Colar Texto'));
    fireEvent.click(screen.getByTestId('bloco-aba-c2'));
    fireEvent.change(screen.getByTestId('bloco-textarea'), { target: { value: 'INFORMATICA' } });

    fireEvent.change(screen.getByTestId('input-cargo-nome-1'), { target: { value: '' } });

    expect(screen.queryByTestId('bloco-aba-c2')).toBeNull();
    expect(screen.getByTestId('bloco-textarea').getAttribute('data-cargo')).toBe('comum');

    fireEvent.change(screen.getByTestId('bloco-textarea'), { target: { value: 'CONTEUDO COMUM' } });
    fireEvent.click(screen.getByText('Criar Workspace'));

    const pending = readPending('editor-fantasma-sem-nome');
    expect(pending.workspace.sourceBlocks).toEqual([{ cargoId: null, text: 'CONTEUDO COMUM' }]);
  });

  it('achado M-5: o campo de colar edital continua monoespaçado e alto, como antes do componente compartilhado', async () => {
    const { default: App } = await import('../App');
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Auditor Fiscal'), { target: { value: 'Aparencia M5' } });
    fireEvent.click(screen.getByText('Colar Texto'));

    const classe = screen.getByTestId('bloco-textarea').className;
    expect(classe).toContain('font-mono');
    expect(classe).toContain('min-h-[200px]');
    expect(classe).toContain('text-[11px]');
    expect(classe).toContain('leading-relaxed');
    expect(classe).toContain('k-input');
  });
});
