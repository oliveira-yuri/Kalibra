import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import type { Concept, RawSyllabusEntry, ExtractionOutput, WorkspaceStatus } from '@workspace/core';
import { clerkReactMock, TEST_USER } from '../test/clerk-mock';
import { stageWorkspaceImport } from '@/domain/useWorkspaces';

vi.mock('@clerk/react', () => clerkReactMock);
vi.mock('@clerk/react/internal', () => ({
  publishableKeyFromHost: () => 'pk_test_edital_revisar',
}));
vi.mock('@clerk/themes', () => ({ shadcn: {} }));
vi.mock('@clerk/localizations', () => ({ ptBR: {} }));

const CONCEPTS_KEY = `kalibra_concepts:${TEST_USER.id}`;
const APPROVALS_KEY = `kalibra_approvals:${TEST_USER.id}`;
const SYLLABUS_KEY = `kalibra_syllabus:${TEST_USER.id}:setec-campinas`;
const WORKSPACES_KEY = `kalibra_workspaces:${TEST_USER.id}`;
const PENDING_KEY = `kalibra_pending_edital:${TEST_USER.id}:setec-campinas`;

function seedWorkspaceWithStatus(status: WorkspaceStatus) {
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
  return JSON.parse(window.localStorage.getItem(WORKSPACES_KEY)!)[0].status;
}

const CRASE_PROVISIONAL: Concept = {
  id: 'global-crase', canonicalName: 'Crase', slug: 'crase',
  parentId: null, kind: 'topico', aliases: [], status: 'provisional',
};

const MAT_FINANCEIRA_CONFIRMED: Concept = {
  id: 'global-mat-financeira', canonicalName: 'Matemática financeira', slug: 'matematica-financeira',
  parentId: null, kind: 'topico', aliases: [], status: 'confirmed',
};

const entrada = (over: Partial<RawSyllabusEntry> & { cargoId: string; label: string }): RawSyllabusEntry => ({
  parentLabel: null, weight: null, questionCount: null,
  sourceExcerpt: null, page: null, confidence: 1, ...over,
});

// Score e razão vêm de `dedup.test.ts` (lib/core), fixados por teste de fronteira lá —
// reaproveitados aqui só como fixture conhecida, não redescobertos.
const EXTRACTION_OUTPUT: ExtractionOutput = {
  entries: [
    entrada({ cargoId: 'c1', label: 'Crase' }), // -> score 1, reason 'provisional_concept'
    entrada({ cargoId: 'c1', label: 'Matemática financeira básica' }), // -> score 0.75, reason 'low_score'
  ],
  detectedCargos: ['c1', 'c2'],
  examFormat: null,
  examDurationMinutes: null,
  uncertainties: ['peso das matérias'],
};

function seedPendingImport() {
  stageWorkspaceImport('setec-campinas', {
    isNew: false,
    updates: {},
    extractionOutput: EXTRACTION_OUTPUT,
  }, TEST_USER.id);
}

function readApprovals(): Array<Record<string, unknown>> {
  const raw = window.localStorage.getItem(APPROVALS_KEY);
  return raw ? JSON.parse(raw) : [];
}

describe('EditalRevisar — Task 11 (dedupeEntries finalmente tem um chamador em produção)', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(CONCEPTS_KEY, JSON.stringify([CRASE_PROVISIONAL, MAT_FINANCEIRA_CONFIRMED]));
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital/revisar/1');
  });

  afterEach(() => {
    cleanup();
  });

  const clickConfirm = () => fireEvent.click(screen.getByText('Confirmar estrutura'));

  it('computa a proposta ao montar (a árvore já mostra os dois itens), mas só persiste o Syllabus ao confirmar', async () => {
    seedPendingImport();
    const { default: App } = await import('../App');
    const { container } = render(<App />);

    // A árvore já mostra a proposta — fix round 1 (Finding 2) não pode significar
    // "a tela não mostra nada até confirmar", só que MONTAR não pode GRAVAR.
    expect(container.innerHTML).toContain('Crase');
    expect(container.innerHTML).toContain('Matemática financeira básica');
    expect(window.localStorage.getItem(SYLLABUS_KEY)).toBeNull();

    clickConfirm();
    const syllabus = JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!);
    expect(syllabus.items.map((item: { sourceLabel: string }) => item.sourceLabel).sort()).toEqual(
      ['Crase', 'Matemática financeira básica'].sort(),
    );
  });

  it('salva os conceitos provisórios novos de DedupResult.newConcepts na biblioteca global, só ao confirmar', async () => {
    seedPendingImport();
    const { default: App } = await import('../App');
    render(<App />);

    // Antes de confirmar, a biblioteca global tem só os dois conceitos semeados.
    expect(JSON.parse(window.localStorage.getItem(CONCEPTS_KEY)!)).toHaveLength(2);

    clickConfirm();
    const concepts: Concept[] = JSON.parse(window.localStorage.getItem(CONCEPTS_KEY)!);
    // Os dois conceitos semeados continuam lá, mais dois provisórios novos — um por
    // entrada, já que nenhuma das duas casou com um conceito CONFIRMED (Crase só bate
    // num provisório; Matemática financeira básica fica abaixo do limiar de ligação
    // direta apesar do quase-acerto).
    expect(concepts).toHaveLength(4);
    expect(concepts.filter((c) => c.status === 'provisional')).toHaveLength(3);
  });

  it('cada proposedLink vira um item concept_merge com targetConceptId = conceptId da proposta, NUNCA sourceRef — só ao confirmar', async () => {
    seedPendingImport();
    const { default: App } = await import('../App');
    render(<App />);

    expect(readApprovals()).toHaveLength(0);
    clickConfirm();

    const approvals = readApprovals();
    expect(approvals).toHaveLength(2);
    expect(approvals.every((item) => item.type === 'concept_merge')).toBe(true);

    const targetIds = approvals.map((item) => item.targetConceptId).sort();
    expect(targetIds).toEqual(['global-crase', 'global-mat-financeira']);

    // sourceRef é proveniência (o item do edital que gerou a proposta) — nunca o
    // conceito-alvo. Um approvals.sourceRef igual a um dos targetConceptId seria o
    // bug que a Task 11 existe para não reintroduzir (achado da revisão da fila).
    approvals.forEach((item) => {
      expect(item.sourceRef).not.toBe(item.targetConceptId);
      expect(typeof item.sourceRef).toBe('string');
    });
  });

  it('as duas chamadas de enqueue (uma por proposedLink) sobrevivem no mesmo tick do confirmar — nenhuma se perde', async () => {
    seedPendingImport();
    const { default: App } = await import('../App');
    render(<App />);
    clickConfirm();

    // Duas propostas nesta fixture: se os hooks não fossem ref-sincronizados, a
    // segunda chamada de `enqueue` no mesmo handler reconstruiria a partir do estado
    // obsoleto e sobrescreveria a primeira — ficaria só 1, não 2.
    expect(readApprovals()).toHaveLength(2);
  });

  it('confirmar duas vezes seguidas (clique duplo) não duplica nada — idempotência do confirm', async () => {
    seedPendingImport();
    const { default: App } = await import('../App');
    render(<App />);

    const button = screen.getByText('Confirmar estrutura');
    fireEvent.click(button);
    fireEvent.click(button);

    expect(readApprovals()).toHaveLength(2);
    const syllabus = JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!);
    expect(syllabus.items).toHaveLength(2);
  });

  it('lista output.uncertainties no bloco "Não encontrado no edital", nunca um valor inventado', async () => {
    seedPendingImport();
    const { default: App } = await import('../App');
    const { container } = render(<App />);

    expect(container.innerHTML).toContain('Não encontrado no edital');
    expect(screen.getByText('peso das matérias')).toBeTruthy();
  });

  it('remontar sem confirmar não persiste nada; confirmar na remontagem grava uma única vez (sem duplicar)', async () => {
    seedPendingImport();
    const { default: App } = await import('../App');

    const first = render(<App />);
    expect(window.localStorage.getItem(SYLLABUS_KEY)).toBeNull();
    first.unmount();

    // Remonta a MESMA tela (usuário saiu e voltou sem confirmar nem descartar) — como
    // nada foi persistido na primeira montagem, recomputar a proposta de novo é
    // inofensivo (idempotente): só ao confirmar esta segunda montagem é que algo é
    // escrito, e uma única vez.
    render(<App />);
    expect(window.localStorage.getItem(SYLLABUS_KEY)).toBeNull();
    clickConfirm();

    expect(readApprovals()).toHaveLength(2);
    const syllabus = JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!);
    expect(syllabus.items).toHaveLength(2);
  });

  it('sem importação pendente, não roda dedup nenhum e a árvore reflete o Syllabus já persistido (vazio)', async () => {
    const { default: App } = await import('../App');
    const { container } = render(<App />);

    expect(readApprovals()).toHaveLength(0);
    expect(container.innerHTML).toContain('0 itens mapeados');
  });
});

describe('EditalRevisar — Finding 2 do fix round 1 (nada persiste antes de confirmar)', () => {
  // Fixture do achado: um programa já salvo, com peso e quantidade de questões reais,
  // que a mera abertura da tela de revisão sobrescrevia antes desta correção.
  const EXISTING_SYLLABUS = {
    items: [
      { id: 'existing-item', workspaceId: 'setec-campinas', conceptId: 'existing-concept', parentItemId: null, sourceLabel: 'Materia antiga preservada', sourceExcerpt: null, page: null, confidence: 1, uncertain: false },
    ],
    links: [
      { syllabusItemId: 'existing-item', cargoId: 'c1', weight: 40, questionCount: 12 },
    ],
  };

  function seedReimport() {
    stageWorkspaceImport('setec-campinas', {
      isNew: false,
      updates: {},
      extractionOutput: {
        entries: [entrada({ cargoId: 'c1', label: 'Disciplina nova' })],
        detectedCargos: ['c1'],
        examFormat: null,
        examDurationMinutes: null,
        uncertainties: [],
      },
    }, TEST_USER.id);
  }

  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(SYLLABUS_KEY, JSON.stringify(EXISTING_SYLLABUS));
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital/revisar/2');
  });

  afterEach(() => {
    cleanup();
  });

  it('renderizar a tela sozinha, sem clicar em nada, nunca sobrescreve o programa salvo nem cria conceito', async () => {
    seedReimport();
    const { default: App } = await import('../App');
    render(<App />);

    expect(JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!)).toEqual(EXISTING_SYLLABUS);
    // Nenhuma biblioteca de conceitos foi sequer criada — `previewExtraction` não
    // grava, então `conceptsApi.addConcept` nunca roda antes do confirm.
    expect(window.localStorage.getItem(CONCEPTS_KEY)).toBeNull();
    expect(readApprovals()).toHaveLength(0);
  });

  it('clicar em Descartar não persiste nada — o programa salvo continua intacto', async () => {
    seedReimport();
    const { default: App } = await import('../App');
    render(<App />);

    fireEvent.click(screen.getByText('Descartar'));

    expect(JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!)).toEqual(EXISTING_SYLLABUS);
    expect(window.localStorage.getItem(CONCEPTS_KEY)).toBeNull();
  });

  it('a árvore exibe a proposta em revisão (não a antiga) mesmo sem nada persistido', async () => {
    seedReimport();
    const { default: App } = await import('../App');
    const { container } = render(<App />);

    // "Materia antiga preservada" ainda aparece na SEÇÃO DE DIFF (Task 13, "− 1
    // removido") — o que a árvore de EDIÇÃO não pode mostrar é o item antigo como se
    // ainda estivesse ativo. Só a árvore (fora do bloco de diff) é o que este teste
    // cobre.
    const tree = container.querySelector('[data-testid^="row-syllabus-item-"]')!.closest('section')!;
    expect(tree.innerHTML).toContain('Disciplina nova');
    expect(tree.innerHTML).not.toContain('Materia antiga preservada');
  });

  it('confirmar grava a proposta por cima do programa antigo — só então', async () => {
    seedReimport();
    const { default: App } = await import('../App');
    render(<App />);

    fireEvent.click(screen.getByText('Confirmar estrutura'));

    const stored = JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!);
    expect(stored.items.map((item: { sourceLabel: string }) => item.sourceLabel)).toEqual(['Disciplina nova']);
  });
});

describe('EditalRevisar — Task 12 (deduplicação visível e reversível)', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital/revisar/1');
  });

  afterEach(() => {
    cleanup();
  });

  it('quando um item foi unido entre cargos, mostra o aviso explicando a união', async () => {
    // Mesmo rótulo em c1 e c2 — dedupeEntries une num item só, comum aos dois cargos.
    stageWorkspaceImport('setec-campinas', {
      isNew: false,
      updates: {},
      extractionOutput: {
        entries: [
          entrada({ cargoId: 'c1', label: 'Matemática básica' }),
          entrada({ cargoId: 'c2', label: 'Matemática básica' }),
        ],
        detectedCargos: ['c1', 'c2'],
        examFormat: null,
        examDurationMinutes: null,
        uncertainties: [],
      },
    }, TEST_USER.id);

    const { default: App } = await import('../App');
    const { container, getByTestId } = render(<App />);

    expect(container.innerHTML).toContain('unidos e aparecem uma vez só');
    expect(getByTestId(/^chip-common-/).textContent).toContain('2 cargos');
  });

  it('sem nenhum item comum, o aviso de união não aparece', async () => {
    seedPendingImport(); // fixture desta suíte: dois itens distintos, no mesmo cargo.
    const { default: App } = await import('../App');
    const { container } = render(<App />);

    expect(container.innerHTML).not.toContain('unidos e aparecem uma vez só');
  });
});

describe('EditalRevisar — Task 13 (comparação entre versões, renomeado preserva histórico)', () => {
  const CRASE_CONFIRMED_WITH_ALIAS: Concept = {
    id: 'concept-crase', canonicalName: 'Crase', slug: 'crase',
    parentId: null, kind: 'topico', aliases: ['Emprego do acento indicativo de crase'], status: 'confirmed',
  };
  const PENAL_CONFIRMED: Concept = {
    id: 'concept-penal', canonicalName: 'Direito Penal', slug: 'direito-penal',
    parentId: null, kind: 'disciplina', aliases: [], status: 'confirmed',
  };

  const VERSAO_1_SYLLABUS = {
    items: [
      { id: 'v1-crase', workspaceId: 'setec-campinas', conceptId: 'concept-crase', parentItemId: null, sourceLabel: 'Crase', sourceExcerpt: null, page: null, confidence: 1, uncertain: false },
      { id: 'v1-penal', workspaceId: 'setec-campinas', conceptId: 'concept-penal', parentItemId: null, sourceLabel: 'Direito Penal', sourceExcerpt: null, page: null, confidence: 1, uncertain: false },
    ],
    links: [
      { syllabusItemId: 'v1-crase', cargoId: 'c1', weight: null, questionCount: null },
      { syllabusItemId: 'v1-penal', cargoId: 'c1', weight: null, questionCount: null },
    ],
  };

  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(CONCEPTS_KEY, JSON.stringify([CRASE_CONFIRMED_WITH_ALIAS, PENAL_CONFIRMED]));
    window.localStorage.setItem(SYLLABUS_KEY, JSON.stringify(VERSAO_1_SYLLABUS));
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital/revisar/2');
  });

  afterEach(() => {
    cleanup();
  });

  it('mostra renomeado (não removido+adicionado) para um item cujo rótulo mudou mas o conceito é o mesmo, via alias', async () => {
    stageWorkspaceImport('setec-campinas', {
      isNew: false,
      updates: {},
      extractionOutput: {
        entries: [
          // "Direito Penal" não aparece mais -> removido. "Emprego..." liga ao
          // mesmo conceito de "Crase" pelo alias -> renomeado. "Nova disciplina"
          // não existia -> adicionado.
          entrada({ cargoId: 'c1', label: 'Emprego do acento indicativo de crase' }),
          entrada({ cargoId: 'c1', label: 'Nova disciplina' }),
        ],
        detectedCargos: ['c1'],
        examFormat: null,
        examDurationMinutes: null,
        uncertainties: [],
      },
    }, TEST_USER.id);

    const { default: App } = await import('../App');
    const { container } = render(<App />);

    const diffSection = container.querySelector('[data-testid="syllabus-diff"]')!;
    expect(diffSection).toBeTruthy();
    expect(diffSection.innerHTML).toContain('~ 1 renomeado');
    expect(diffSection.innerHTML).toContain('"Crase" → "Emprego do acento indicativo de crase"');
    expect(diffSection.innerHTML).toContain('+ 1 adicionado');
    expect(diffSection.innerHTML).toContain('Nova disciplina');
    expect(diffSection.innerHTML).toContain('− 1 removido');
    expect(diffSection.innerHTML).toContain('Direito Penal');
    // O renomeado não pode aparecer duplicado como removido+adicionado.
    expect(diffSection.innerHTML).not.toContain('Crase</li>');
  });

  it('item removido ganha aviso coral de histórico, e o dado permanece no localStorage (não é apagado)', async () => {
    stageWorkspaceImport('setec-campinas', {
      isNew: false,
      updates: {},
      extractionOutput: {
        entries: [entrada({ cargoId: 'c1', label: 'Emprego do acento indicativo de crase' })],
        detectedCargos: ['c1'],
        examFormat: null,
        examDurationMinutes: null,
        uncertainties: [],
      },
    }, TEST_USER.id);

    const { default: App } = await import('../App');
    render(<App />);

    expect(screen.getByText(/pode ter histórico de estudo/)).toBeTruthy();
    // `diffSyllabus` é só leitura, e (fix round 1, Finding 2) nada é persistido antes
    // de confirmar — "Direito Penal" sai da lista ativa só na PROPOSTA em memória; o
    // programa realmente salvo continua sendo a versão 1, intocada, com os dois itens.
    const stored = JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!);
    expect(stored).toEqual(VERSAO_1_SYLLABUS);
  });

  it('sem versão anterior para comparar, não desenha a seção de diff', async () => {
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital/revisar/1');
    const { default: App } = await import('../App');
    const { container } = render(<App />);
    expect(container.querySelector('[data-testid="syllabus-diff"]')).toBeNull();
  });
});

describe('EditalRevisar — fix round 2 (confirmar não pode crashar nem deixar escrita pela metade)', () => {
  // Os quatro status sem aresta para "diagnostico_pendente" no grafo de lib/core —
  // exatamente os que o achado apontou. `assertTransition` sem guarda, DEPOIS das três
  // escritas, deixava Syllabus e conceitos gravados, a fila enfileirada, mas o status
  // preso e a importação pendente nunca limpa — sem chance de um segundo clique
  // corrigir, porque `confirmedRef` já estava marcado.
  const STATUSES_SEM_ARESTA: WorkspaceStatus[] = ['sem_edital', 'aguardando_upload', 'extraindo_edital', 'erro'];

  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    // Mesma biblioteca da fixture da Task 11 — é o que faz as duas entradas de
    // EXTRACTION_OUTPUT gerarem `proposedLinks` de verdade (sem candidato nenhum na
    // biblioteca, `bestConceptCandidate` nunca encontra nada para propor).
    window.localStorage.setItem(CONCEPTS_KEY, JSON.stringify([CRASE_PROVISIONAL, MAT_FINANCEIRA_CONFIRMED]));
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital/revisar/1');
  });

  afterEach(() => {
    cleanup();
  });

  // Depois do confirmar, `handleConfirm` navega para `/edital` — que monta `Edital.tsx`
  // de novo, e o efeito de autocura do Finding 1 (fix round 1) vê exatamente a forma
  // que ele foi desenhado para reconhecer: `extraindo_edital` sem nenhuma extração de
  // verdade em andamento nesta sessão. Ele avança esse UM caso especificamente para
  // "erro" — não é uma escrita pela metade nem um bug novo, é a composição correta de
  // dois mecanismos já aceitos: o confirmar corretamente recusa "diagnostico_pendente"
  // (sem aresta válida) e deixa o status como estava; a autocura então reconhece esse
  // "como estava" como o mesmo problema que ela já resolve. Os outros três status
  // (nenhum é `extraindo_edital`) não disparam a autocura e permanecem exatamente como
  // estavam.
  const EXPECTED_FINAL_STATUS: Partial<Record<WorkspaceStatus, WorkspaceStatus>> = {
    extraindo_edital: 'erro',
  };

  describe.each(STATUSES_SEM_ARESTA)('confirmar a partir de "%s" (sem aresta para diagnostico_pendente)', (status) => {
    it('não lança e persiste a proposta inteira (nada pela metade) — o botão continua funcionando', async () => {
      seedWorkspaceWithStatus(status);
      seedPendingImport();
      const { default: App } = await import('../App');
      render(<App />);

      expect(() => fireEvent.click(screen.getByText('Confirmar estrutura'))).not.toThrow();

      // Tudo o que a proposta implica foi escrito — não uma escrita pela metade.
      const syllabus = JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!);
      expect(syllabus.items.map((item: { sourceLabel: string }) => item.sourceLabel).sort()).toEqual(
        ['Crase', 'Matemática financeira básica'].sort(),
      );
      // 2 seeded + 2 provisórios novos (nenhuma das duas entradas casa direto com um
      // conceito CONFIRMED — a mesma fixture da Task 11).
      expect(JSON.parse(window.localStorage.getItem(CONCEPTS_KEY)!)).toHaveLength(4);
      expect(readApprovals()).toHaveLength(2);

      // A importação pendente foi limpa — o botão "continua funcionando" significa
      // exatamente isto: a ação de confirmar chegou ao fim, não travou pela metade.
      expect(window.sessionStorage.getItem(PENDING_KEY)).toBeNull();

      // Sem aresta válida, `handleConfirm` nunca escreve "diagnostico_pendente"
      // fingido — o status fica como estava, ou (só para `extraindo_edital`) segue o
      // caminho de autocura já testado em `Edital.test.tsx`.
      expect(readWorkspaceStatus()).toBe(EXPECTED_FINAL_STATUS[status] ?? status);
    });
  });

  it('confirmar a partir de um status COM aresta válida (ex.: aguardando_revisao_edital) ainda avança o status normalmente', async () => {
    seedWorkspaceWithStatus('aguardando_revisao_edital');
    seedPendingImport();
    const { default: App } = await import('../App');
    render(<App />);

    fireEvent.click(screen.getByText('Confirmar estrutura'));

    expect(readWorkspaceStatus()).toBe('diagnostico_pendente');
    expect(readApprovals()).toHaveLength(2);
  });
});
