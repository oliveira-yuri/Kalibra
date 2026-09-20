import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
import type { Concept, RawSyllabusEntry, ExtractionOutput, WorkspaceStatus } from '@workspace/core';
import { clerkReactMock, TEST_USER } from '../test/clerk-mock';
import { nextSyllabusVersionFor } from '@/domain/useWorkspaces';
import { stageWorkspaceImport } from '@/domain/staging';

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

function seedWorkspaceDoisCargos(status: WorkspaceStatus = 'aguardando_revisao_edital') {
  window.localStorage.setItem(WORKSPACES_KEY, JSON.stringify([{
    slug: 'setec-campinas',
    title: 'Concurso SETEC Campinas',
    institution: 'SETEC',
    type: 'Concurso Público',
    examDate: '2027-01-17',
    cargos: [
      { id: 'c1', name: 'Analista', examDate: '2027-01-17', period: 'A' },
      { id: 'c2', name: 'Técnico', examDate: '2027-01-17', period: 'A' },
    ],
    selectedCargoId: 'c1',
    availability: { days: [], maxSessionMinutes: 50 },
    status,
    sourceMode: 'text',
    sourceBlocks: [],
    importStatus: 'completed',
    progress: 0,
    nextAction: 'texto qualquer',
    active: true,
  }]));
}

/**
 * A saída que blocos por cargo produzem: "LÍNGUA PORTUGUESA" veio do bloco comum
 * (uma entrada por cargo, que `dedupeEntries` une num item com duas ligações) e
 * "INFORMÁTICA" veio do bloco específico do c2 (uma entrada só).
 */
function seedImportDoisCargos() {
  stageWorkspaceImport('setec-campinas', {
    isNew: false,
    updates: {},
    extractionOutput: {
      entries: [
        entrada({ cargoId: 'c1', label: 'LÍNGUA PORTUGUESA' }),
        entrada({ cargoId: 'c2', label: 'LÍNGUA PORTUGUESA' }),
        entrada({ cargoId: 'c2', label: 'INFORMÁTICA' }),
      ],
      detectedCargos: ['c1', 'c2'],
      examFormat: null,
      examDurationMinutes: null,
      uncertainties: [],
    },
  }, TEST_USER.id);
}

/** A linha da árvore que contém aquele rótulo — os ids de item são gerados. */
function rowOf(label: string): HTMLElement {
  return screen.getByText(label).closest('[data-testid^="row-syllabus-item-"]') as HTMLElement;
}

function itemIdOf(label: string): string {
  return rowOf(label).getAttribute('data-testid')!.replace('row-syllabus-item-', '');
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

    // Task 14: montar já enfileirou o item `edital_structure` da proposta — só os
    // `concept_merge` (proveniência dos `proposedLinks`) esperam o confirmar.
    expect(readApprovals()).toHaveLength(1);
    clickConfirm();

    const approvals = readApprovals();
    const conceptMerges = approvals.filter((item) => item.type === 'concept_merge');
    expect(approvals).toHaveLength(3);
    expect(conceptMerges).toHaveLength(2);

    const targetIds = conceptMerges.map((item) => item.targetConceptId).sort();
    expect(targetIds).toEqual(['global-crase', 'global-mat-financeira']);

    // sourceRef é proveniência (o item do edital que gerou a proposta) — nunca o
    // conceito-alvo. Um approvals.sourceRef igual a um dos targetConceptId seria o
    // bug que a Task 11 existe para não reintroduzir (achado da revisão da fila).
    conceptMerges.forEach((item) => {
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
    // obsoleto e sobrescreveria a primeira — ficaria só 1, não 2. O terceiro item
    // (fora desta contagem) é o `edital_structure` enfileirado na montagem (Task 14).
    const approvals = readApprovals();
    expect(approvals.filter((item) => item.type === 'concept_merge')).toHaveLength(2);
    expect(approvals).toHaveLength(3);
  });

  it('confirmar duas vezes seguidas (clique duplo) não duplica nada — idempotência do confirm', async () => {
    seedPendingImport();
    const { default: App } = await import('../App');
    render(<App />);

    const button = screen.getByText('Confirmar estrutura');
    fireEvent.click(button);
    fireEvent.click(button);

    // 1 edital_structure (montagem, Task 14) + 2 concept_merge (confirmar, uma vez só).
    expect(readApprovals()).toHaveLength(3);
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

    // A remontagem reaproveita o MESMO item `edital_structure` da primeira montagem
    // (idempotência via `pending.approvalItemId`, Task 14) — não duplica.
    const approvals = readApprovals();
    expect(approvals).toHaveLength(3);
    expect(approvals.filter((item) => item.type === 'edital_structure')).toHaveLength(1);
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
    // Task 14: montar UMA proposta para revisar enfileira o item `edital_structure`
    // que a representa — isso não é "gravar no programa" (PD-06), é registrar que
    // existe uma decisão pendente. Continua pendente, sem confirmar nada ainda.
    const approvals = readApprovals();
    expect(approvals).toHaveLength(1);
    expect(approvals[0].type).toBe('edital_structure');
    expect(approvals[0].status).toBe('pendente');
    expect(approvals[0].payloadBefore).toEqual(EXISTING_SYLLABUS);
  });

  it('clicar em Descartar não persiste nada — o programa salvo continua intacto, e a fila registra a rejeição', async () => {
    seedReimport();
    const { default: App } = await import('../App');
    render(<App />);

    fireEvent.click(screen.getByText('Descartar'));

    expect(JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!)).toEqual(EXISTING_SYLLABUS);
    expect(window.localStorage.getItem(CONCEPTS_KEY)).toBeNull();
    // A decisão de descartar fica registrada na fila (Task 14) — não é um silêncio
    // que deixa o item pendente para sempre.
    const approvals = readApprovals();
    expect(approvals).toHaveLength(1);
    expect(approvals[0].status).toBe('rejeitado');
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

    // Task 14: "Confirmar estrutura" aprova o item da fila — a decisão fica
    // registrada, não só o efeito dela no programa.
    const approvals = readApprovals();
    const structureItem = approvals.find((item) => item.type === 'edital_structure');
    expect(structureItem?.status).toBe('aprovado');
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
    // setec-campinas só tem 2 cargos (c1, c2) e o item está ligado aos dois — o chip
    // agora lê "comum a todos" (Fase 1B.5), não mais a contagem "2 cargos".
    expect(getByTestId(/^chip-common-/).textContent).toContain('comum a todos');
  });

  it('sem nenhum item comum, o aviso de união não aparece', async () => {
    seedPendingImport(); // fixture desta suíte: dois itens distintos, no mesmo cargo.
    const { default: App } = await import('../App');
    const { container } = render(<App />);

    expect(container.innerHTML).not.toContain('unidos e aparecem uma vez só');
  });
});

describe('EditalRevisar — Fase 1B.5, Task 7 (aplicar item a mais um cargo — os dois caminhos do handler)', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital/revisar/1');
  });

  afterEach(() => {
    cleanup();
  });

  const PERSISTED_SYLLABUS = {
    items: [
      { id: 'item-persistido', workspaceId: 'setec-campinas', conceptId: 'concept-persistido', parentItemId: null, sourceLabel: 'Direito Administrativo', sourceExcerpt: null, page: null, confidence: 1, uncertain: false },
    ],
    links: [
      { syllabusItemId: 'item-persistido', cargoId: 'c1', weight: 20, questionCount: 5 },
    ],
  };

  it('caminho persistido (sem proposta em revisão): aplicar a um cargo grava direto no programa já salvo', async () => {
    // Sem stageWorkspaceImport nenhum: `pending` fica null, o efeito de enfileirar não
    // roda, e `review` continua null — a árvore mostra `syllabusApi.syllabus` (o mesmo
    // caminho já coberto pelo teste "sem importação pendente..." da Task 11).
    window.localStorage.setItem(SYLLABUS_KEY, JSON.stringify(PERSISTED_SYLLABUS));

    const { default: App } = await import('../App');
    render(<App />);

    const row = screen.getByText('Direito Administrativo').closest('[data-testid^="row-syllabus-item-"]') as HTMLElement;
    fireEvent.click(within(row).getByTestId(/^button-item-menu-/));
    fireEvent.click(within(row).getByTestId('button-link-item-persistido-c2'));

    const stored = JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!);
    const links = stored.links.filter((link: { syllabusItemId: string }) => link.syllabusItemId === 'item-persistido');
    expect(links).toHaveLength(2);
    // A ligação com c1 (já existente, com peso) não pode ser tocada.
    expect(links.find((link: { cargoId: string }) => link.cargoId === 'c1').weight).toBe(20);
    // A ligação nova com c2 nasce com peso e quantidade nulos.
    expect(links.find((link: { cargoId: string }) => link.cargoId === 'c2').weight).toBeNull();
  });

  it('caminho da proposta em revisão: aplicar a um cargo muda a proposta em memória e só grava ao confirmar', async () => {
    stageWorkspaceImport('setec-campinas', {
      isNew: false,
      updates: {},
      extractionOutput: {
        entries: [entrada({ cargoId: 'c1', label: 'Direito Constitucional' })],
        detectedCargos: ['c1', 'c2'],
        examFormat: null,
        examDurationMinutes: null,
        uncertainties: [],
      },
    }, TEST_USER.id);

    const { default: App } = await import('../App');
    render(<App />);

    const row = () => screen.getByText('Direito Constitucional').closest('[data-testid^="row-syllabus-item-"]') as HTMLElement;
    fireEvent.click(within(row()).getByTestId(/^button-item-menu-/));
    fireEvent.click(within(row()).getByTestId(/^button-link-.*-c2$/));

    // Antes de confirmar, nada foi persistido — mesma regra do Finding 2 do fix round 1
    // (`review` é a fonte de verdade em memória até "Confirmar estrutura").
    expect(window.localStorage.getItem(SYLLABUS_KEY)).toBeNull();

    fireEvent.click(screen.getByText('Confirmar estrutura'));

    const stored = JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!);
    const item = stored.items.find((entry: { sourceLabel: string }) => entry.sourceLabel === 'Direito Constitucional');
    const links = stored.links.filter((link: { syllabusItemId: string }) => link.syllabusItemId === item.id);
    expect(links.map((link: { cargoId: string }) => link.cargoId).sort()).toEqual(['c1', 'c2']);
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

describe('EditalRevisar — Task 14 (aprovação da estrutura fecha o ciclo)', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital/revisar/1');
  });

  afterEach(() => {
    cleanup();
  });

  it('primeira importação (workspace novo): payloadBefore é null — não existe programa anterior', async () => {
    stageWorkspaceImport('setec-campinas', {
      isNew: true,
      workspace: {
        slug: 'setec-campinas', title: 'Concurso SETEC Campinas', institution: 'SETEC', type: 'Concurso Público',
        examDate: '2027-01-17', cargos: [{ id: 'c1', name: 'Analista', examDate: '2027-01-17' }],
        selectedCargoId: 'c1', availability: { days: [], maxSessionMinutes: 50 }, status: 'aguardando_revisao_edital',
        sourceMode: 'text', sourceBlocks: [], importStatus: 'pending', progress: 0, nextAction: '', active: true,
      },
      extractionOutput: {
        entries: [entrada({ cargoId: 'c1', label: 'Crase' })],
        detectedCargos: ['c1'], examFormat: null, examDurationMinutes: null, uncertainties: [],
      },
    }, TEST_USER.id);

    const { default: App } = await import('../App');
    render(<App />);

    const approvals = readApprovals();
    expect(approvals).toHaveLength(1);
    expect(approvals[0].type).toBe('edital_structure');
    expect(approvals[0].payloadBefore).toBeNull();
    expect((approvals[0].payloadAfter as { version: string }).version).toBe('1');
  });

  it('reimportação (workspace já existe): payloadBefore é o programa hoje persistido', async () => {
    const existing = {
      items: [{ id: 'old', workspaceId: 'setec-campinas', conceptId: 'c-old', parentItemId: null, sourceLabel: 'Matéria antiga', sourceExcerpt: null, page: null, confidence: 1, uncertain: false }],
      links: [{ syllabusItemId: 'old', cargoId: 'c1', weight: null, questionCount: null }],
    };
    window.localStorage.setItem(SYLLABUS_KEY, JSON.stringify(existing));
    seedPendingImport();

    const { default: App } = await import('../App');
    render(<App />);

    const approvals = readApprovals();
    expect(approvals).toHaveLength(1);
    expect(approvals[0].payloadBefore).toEqual(existing);
  });

  it('a proposta com item comum a dois cargos enfileira mergedCount > 0 em payloadAfter', async () => {
    stageWorkspaceImport('setec-campinas', {
      isNew: false,
      updates: {},
      extractionOutput: {
        entries: [
          entrada({ cargoId: 'c1', label: 'Matemática básica' }),
          entrada({ cargoId: 'c2', label: 'Matemática básica' }),
        ],
        detectedCargos: ['c1', 'c2'], examFormat: null, examDurationMinutes: null, uncertainties: [],
      },
    }, TEST_USER.id);

    const { default: App } = await import('../App');
    render(<App />);

    const approvals = readApprovals();
    const payloadAfter = approvals[0].payloadAfter as { mergedCount: number };
    expect(payloadAfter.mergedCount).toBe(1);
  });

  it('remontar sem decidir reaproveita o MESMO id de aprovação — não enfileira dois itens', async () => {
    seedPendingImport();
    const { default: App } = await import('../App');

    const first = render(<App />);
    const idAfterFirstMount = readApprovals()[0].id;
    first.unmount();

    render(<App />);
    const approvals = readApprovals();
    expect(approvals).toHaveLength(1);
    expect(approvals[0].id).toBe(idAfterFirstMount);
  });

  it('fix round 1 (achado 1): perder o sessionStorage (fechar a aba, reiniciar o navegador) não deixa o item pendente para sempre', async () => {
    seedPendingImport();
    const { default: App } = await import('../App');

    const first = render(<App />);
    const queuedId = readApprovals()[0].id;
    first.unmount();

    // Simula fechar a aba / reiniciar o navegador: o `sessionStorage` da importação
    // pendente desaparece por completo — mas o item `edital_structure` na fila
    // (`localStorage`, durável, entre abas) sobrevive, e é dele que a proposta agora
    // é reconstruída.
    window.sessionStorage.clear();

    const { container } = render(<App />);
    expect(container.innerHTML).toContain('Crase');
    expect(container.innerHTML).toContain('Matemática financeira básica');

    // Sem o fix, `structureApprovalId` nasceria `null` aqui (nenhum `pending` para
    // enfileirar de novo, e a busca antiga dependia de `pending.approvalItemId`) e
    // tanto Confirmar quanto Descartar virariam no-op sobre o item — ele ficaria
    // pendente para sempre, com o "aguardando decisão" da fila permanentemente errado.
    fireEvent.click(screen.getByText('Confirmar estrutura'));

    const syllabus = JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!);
    expect(syllabus.items.map((item: { sourceLabel: string }) => item.sourceLabel).sort()).toEqual(
      ['Crase', 'Matemática financeira básica'].sort(),
    );
    const decided = readApprovals().find((item) => item.id === queuedId);
    expect(decided?.status).toBe('aprovado');
  });

  it('fix round 1 (achado 2): o item aprovado registra a árvore EDITADA (renomear + separar), não a proposta congelada no enfileiramento', async () => {
    // Fixture com um item comum a dois cargos (mesma da task acima) — só um item comum
    // pode ser separado ("Separar de <cargo>" só aparece no menu quando `isCommon`).
    stageWorkspaceImport('setec-campinas', {
      isNew: false,
      updates: {},
      extractionOutput: {
        entries: [
          entrada({ cargoId: 'c1', label: 'Matemática básica' }),
          entrada({ cargoId: 'c2', label: 'Matemática básica' }),
        ],
        detectedCargos: ['c1', 'c2'], examFormat: null, examDurationMinutes: null, uncertainties: [],
      },
    }, TEST_USER.id);

    const { default: App } = await import('../App');
    render(<App />);

    const queuedId = readApprovals()[0].id;
    const enqueuedPayload = readApprovals()[0].payloadAfter as { review: { syllabus: { items: unknown[] } } };
    // Um item só, comum aos dois cargos — a fixture que a dedup une.
    expect(enqueuedPayload.review.syllabus.items).toHaveLength(1);

    // Edita a proposta antes de confirmar: renomeia o item comum e depois o separa de
    // um dos cargos (split cria uma cópia nova) — as duas transformações que o achado
    // 2 apontou como capazes de desalinhar o registro da fila do que de fato é gravado.
    vi.spyOn(window, 'prompt').mockReturnValue('RENOMEADO');
    const row = () => screen.getByText(/Matemática básica|RENOMEADO/).closest('[data-testid^="row-syllabus-item-"]') as HTMLElement;

    fireEvent.click(within(row()).getByTestId(/^button-item-menu-/));
    fireEvent.click(within(row()).getByTestId(/^button-rename-/));

    fireEvent.click(within(row()).getByTestId(/^button-item-menu-/));
    fireEvent.click(within(row()).getByText(/Separar de Analista/));

    fireEvent.click(screen.getByText('Confirmar estrutura'));

    const syllabus = JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!);
    // O split virou 2 itens (renomeados os dois, cópia herda o rótulo do momento do
    // split) — bem diferente do único item "Matemática básica" que foi enfileirado.
    expect(syllabus.items).toHaveLength(2);
    expect(syllabus.items.every((item: { sourceLabel: string }) => item.sourceLabel === 'RENOMEADO')).toBe(true);

    // A propriedade a estabelecer: o que foi gravado e o `payloadAfter` do item
    // aprovado são a MESMA árvore — nunca mais a proposta original congelada.
    const approved = readApprovals().find((item) => item.id === queuedId)!;
    expect(approved.status).toBe('aprovado');
    const approvedPayload = approved.payloadAfter as { review: { syllabus: unknown } };
    expect(approvedPayload.review.syllabus).toEqual(syllabus);
  });

  // "novo-concurso" nunca aparece em `defaultPrograms` (só `setec-campinas` e
  // `bb-escriturario`) — de propósito, para que `workspaces.find(...)` nunca ache um
  // registro de coincidência e a busca do rascunho na fila seja o que de fato importa.
  const NOVO_WORKSPACE_KEY = 'novo-concurso';
  const NOVO_SYLLABUS_KEY = `kalibra_syllabus:${TEST_USER.id}:${NOVO_WORKSPACE_KEY}`;

  function stageNovaImportacao(uncertainties: string[] = []) {
    window.history.replaceState({}, '', `/workspace/${NOVO_WORKSPACE_KEY}/edital/revisar/1`);
    stageWorkspaceImport(NOVO_WORKSPACE_KEY, {
      isNew: true,
      workspace: {
        slug: NOVO_WORKSPACE_KEY, title: 'Concurso Novo', institution: 'Banca X', type: 'Concurso Público',
        examDate: '2027-05-10',
        cargos: [{ id: 'c1', name: 'Analista', examDate: '2027-05-10' }, { id: 'c2', name: 'Técnico', examDate: '2027-05-10' }],
        selectedCargoId: 'c1', availability: { days: [], maxSessionMinutes: 50 }, status: 'aguardando_revisao_edital',
        sourceMode: 'text', sourceBlocks: [], importStatus: 'pending', progress: 0, nextAction: '', active: true,
      },
      extractionOutput: {
        entries: [entrada({ cargoId: 'c1', label: 'Crase' })],
        detectedCargos: ['c1'], examFormat: null, examDurationMinutes: null, uncertainties,
      },
    }, TEST_USER.id);
  }

  it('fix round 2 (achado A, crítico): retomar uma importação NOVA sem sessionStorage cria o workspace ao confirmar, não deixa dado órfão', async () => {
    stageNovaImportacao();
    const { default: App } = await import('../App');

    const first = render(<App />);
    first.unmount();
    // Fecha a aba: sessionStorage some — o rascunho do workspace só sobrevive porque
    // viajou no payload do item da fila (achado A).
    window.sessionStorage.clear();

    render(<App />);
    fireEvent.click(screen.getByText('Confirmar estrutura'));

    const workspacesStored: Array<{ slug: string; status: string }> = JSON.parse(window.localStorage.getItem(WORKSPACES_KEY) ?? '[]');
    const created = workspacesStored.find((w) => w.slug === NOVO_WORKSPACE_KEY);
    // A propriedade pedida: ou o workspace existe depois, ou nada foi escrito. Aqui ele
    // deve existir — sem o fix, `updateWorkspace` sobre um slug ausente é um `.map`
    // que não casa nada, e a linha abaixo falharia com `undefined`.
    expect(created).toBeTruthy();
    expect(created?.status).toBe('diagnostico_pendente');

    const syllabus = JSON.parse(window.localStorage.getItem(NOVO_SYLLABUS_KEY)!);
    expect(syllabus.items).toHaveLength(1);

    const approved = readApprovals().find((item) => item.workspaceId === NOVO_WORKSPACE_KEY);
    expect(approved?.status).toBe('aprovado');
  });

  it('fix round 2 (achado A): descartar uma importação NOVA retomada sem sessionStorage não cria o workspace nem escreve nada', async () => {
    stageNovaImportacao();
    const { default: App } = await import('../App');

    const first = render(<App />);
    first.unmount();
    window.sessionStorage.clear();

    render(<App />);
    fireEvent.click(screen.getByText('Descartar'));

    expect(window.localStorage.getItem(WORKSPACES_KEY)).toBeNull();
    expect(window.localStorage.getItem(NOVO_SYLLABUS_KEY)).toBeNull();
    const rejected = readApprovals().find((item) => item.workspaceId === NOVO_WORKSPACE_KEY);
    expect(rejected?.status).toBe('rejeitado');
    // Sem o achado A, `pending?.isNew` (vazio numa retomada) mandaria para `/edital` de
    // um workspace que nunca existiu — volta ao portal porque `workspaceDraft` (vindo
    // da fila) e `!workspaceExists` identificam a mesma situação sem depender de `pending`.
    expect(window.location.pathname).toContain('/portal');
  });

  it('fix round 2 (achado B): retomar sem sessionStorage ainda mostra "Não encontrado no edital" e o filtro de cargo', async () => {
    stageNovaImportacao(['peso das matérias']);
    const { default: App } = await import('../App');

    const first = render(<App />);
    first.unmount();
    window.sessionStorage.clear();

    const { container } = render(<App />);

    // Achado B: sem carregar as incertezas do payload, este bloco (PD-06) sumia numa
    // retomada — exatamente o único dado que o humano decidindo precisa ver.
    expect(container.innerHTML).toContain('Não encontrado no edital');
    expect(screen.getByText('peso das matérias')).toBeTruthy();
    // O filtro de cargo também dependia de `workspace`, que sem o achado A resolvia
    // `undefined` numa retomada — reaparece porque `workspace` agora vem do rascunho.
    expect(screen.getByTestId('cargo-filter-c1')).toBeTruthy();
    expect(screen.getByTestId('cargo-filter-c2')).toBeTruthy();
  });

  // Simula um item enfileirado ANTES do fix round 2 existir — `review` presente
  // (assim a tela reconstrói a proposta normalmente), mas sem `workspaceDraft` nenhum,
  // ou com um que `parseWorkspaceDraft` rejeita. Semeado direto na fila, sem nunca passar
  // por `stageWorkspaceImport` — não há `pending` nenhum em nenhum momento, a mesma
  // situação de uma retomada fria de um item assim.
  function seedLegacyStructureItem(payloadAfterOverrides: Record<string, unknown>) {
    const review = {
      syllabus: {
        items: [{ id: 'item-1', workspaceId: NOVO_WORKSPACE_KEY, conceptId: 'concept-1', parentItemId: null, sourceLabel: 'Crase', sourceExcerpt: null, page: null, confidence: 1, uncertain: false }],
        links: [{ syllabusItemId: 'item-1', cargoId: 'c1', weight: null, questionCount: null }],
      },
      merged: [],
      newConcepts: [],
      proposedLinks: [],
    };
    window.localStorage.setItem(APPROVALS_KEY, JSON.stringify([{
      id: 'appr-legacy',
      workspaceId: NOVO_WORKSPACE_KEY,
      type: 'edital_structure',
      status: 'pendente',
      title: 'Estrutura extraída do edital · versão 1',
      rationale: '1 item mapeado a partir do edital.',
      sourceRef: null,
      targetConceptId: null,
      confidence: null,
      payloadBefore: null,
      payloadAfter: { version: '1', review, mergedCount: 0, ...payloadAfterOverrides },
      createdAt: '2026-09-01T00:00:00.000Z',
      decidedAt: null,
      reason: null,
    }]));
  }

  it('fix round 3 (achado A residual): sem rascunho no payload (formato anterior ao fix round 2), Confirmar recusa em vez de gravar workspace órfão', async () => {
    window.history.replaceState({}, '', `/workspace/${NOVO_WORKSPACE_KEY}/edital/revisar/1`);
    seedLegacyStructureItem({}); // nenhuma chave `workspaceDraft` — exatamente o formato antigo.

    const { default: App } = await import('../App');
    render(<App />);

    fireEvent.click(screen.getByText('Confirmar estrutura'));

    // A propriedade continua "ou o workspace existe depois, ou nada foi escrito" — aqui
    // é o "nada foi escrito", porque não há como reconstruir o rascunho.
    expect(window.localStorage.getItem(WORKSPACES_KEY)).toBeNull();
    expect(window.localStorage.getItem(NOVO_SYLLABUS_KEY)).toBeNull();
    const item = readApprovals().find((candidate) => candidate.id === 'appr-legacy');
    expect(item?.status).toBe('pendente');
    expect(screen.getByTestId('confirm-error')).toBeTruthy();
  });

  it('fix round 3 (achado A residual): rascunho corrompido (rejeitado por parseWorkspaceDraft) também recusa em vez de gravar', async () => {
    window.history.replaceState({}, '', `/workspace/${NOVO_WORKSPACE_KEY}/edital/revisar/1`);
    // Sem `slug`: `parseWorkspaceDraft` devolve null para isto.
    seedLegacyStructureItem({ workspaceDraft: { title: 'sem slug' } });

    const { default: App } = await import('../App');
    render(<App />);

    fireEvent.click(screen.getByText('Confirmar estrutura'));

    expect(window.localStorage.getItem(WORKSPACES_KEY)).toBeNull();
    expect(window.localStorage.getItem(NOVO_SYLLABUS_KEY)).toBeNull();
    const item = readApprovals().find((candidate) => candidate.id === 'appr-legacy');
    expect(item?.status).toBe('pendente');
    expect(screen.getByTestId('confirm-error')).toBeTruthy();
  });

  it('fix round 3 (achado B): descartar também anula o rascunho do workspace no payload', async () => {
    stageNovaImportacao();
    const { default: App } = await import('../App');
    render(<App />);

    const queuedId = readApprovals()[0].id;
    const beforeDiscard = readApprovals()[0].payloadAfter as { workspaceDraft: unknown };
    expect(beforeDiscard.workspaceDraft).not.toBeNull();

    fireEvent.click(screen.getByText('Descartar'));

    const rejected = readApprovals().find((item) => item.id === queuedId)!;
    expect(rejected.status).toBe('rejeitado');
    // O edital colado inteiro (`sourceText`) não pode sobreviver para sempre num item
    // decidido — a fila nunca poda itens rejeitados.
    const afterDiscard = rejected.payloadAfter as { workspaceDraft: unknown };
    expect(afterDiscard.workspaceDraft).toBeNull();
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
      // 1 edital_structure (montagem, Task 14, aprovado no confirmar) + 2 concept_merge.
      const approvals = readApprovals();
      expect(approvals).toHaveLength(3);
      expect(approvals.find((item) => item.type === 'edital_structure')?.status).toBe('aprovado');

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
    expect(readApprovals()).toHaveLength(3);
  });
});

describe('EditalRevisar — achado C1 da revisão final (uma reimportação abandonada não pode sequestrar a próxima)', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  const extractionWith = (label: string): ExtractionOutput => ({
    entries: [entrada({ cargoId: 'c1', label })],
    detectedCargos: ['c1'],
    examFormat: null,
    examDurationMinutes: null,
    uncertainties: [],
  });

  it('jornada 1 — reimportar (workspace já existente): abandonar uma reimportação e reimportar de novo confirma a árvore da SEGUNDA tentativa, não a da primeira', async () => {
    seedWorkspaceWithStatus('estudando');
    window.localStorage.setItem(SYLLABUS_KEY, JSON.stringify({
      items: [{ id: 'orig-1', workspaceId: 'setec-campinas', conceptId: 'concept-orig', parentItemId: null, sourceLabel: 'Programa original', sourceExcerpt: null, page: null, confidence: 1, uncertain: false }],
      links: [{ syllabusItemId: 'orig-1', cargoId: 'c1', weight: null, questionCount: null }],
    }));

    // Primeira tentativa de reimportação — abandonada sem decidir (o usuário navega
    // para outro lugar; nem "Confirmar" nem "Descartar" são clicados).
    const primeiraVersao = nextSyllabusVersionFor('setec-campinas', TEST_USER.id);
    stageWorkspaceImport('setec-campinas', { isNew: false, updates: {}, extractionOutput: extractionWith('Importação abandonada') }, TEST_USER.id);
    window.history.replaceState({}, '', `/workspace/setec-campinas/edital/revisar/${primeiraVersao}`);
    const { default: App } = await import('../App');
    const abandonada = render(<App />);
    // `getAllByText`: o workspace já tem programa salvo, então esta reimportação JÁ
    // mostra a comparação do PD-08 (achado R1) — o rótulo aparece na árvore e de novo
    // na lista de "adicionado".
    expect(screen.getAllByText('Importação abandonada').length).toBeGreaterThan(0);
    abandonada.unmount();

    // Segunda tentativa — desta vez de verdade. Antes do achado C1, a URL seria
    // sempre o mesmo literal `/edital/revisar/2`, e o item ANTERIOR (ainda pendente
    // na fila) seria retomado em vez desta proposta nova.
    const segundaVersao = nextSyllabusVersionFor('setec-campinas', TEST_USER.id);
    expect(segundaVersao).not.toBe(primeiraVersao);
    stageWorkspaceImport('setec-campinas', { isNew: false, updates: {}, extractionOutput: extractionWith('Importação real') }, TEST_USER.id);
    window.history.replaceState({}, '', `/workspace/setec-campinas/edital/revisar/${segundaVersao}`);
    render(<App />);

    // `getAllByText`, não `getByText`: com `version !== '1'` a seção de diff também
    // lista o rótulo (como "adicionado") ao lado da árvore — duas ocorrências
    // legítimas do mesmo texto, não uma ambiguidade.
    expect(screen.getAllByText('Importação real').length).toBeGreaterThan(0);
    expect(screen.queryByText('Importação abandonada')).toBeNull();

    fireEvent.click(screen.getByText('Confirmar estrutura'));

    const syllabus = JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!);
    const labels = syllabus.items.map((item: { sourceLabel: string }) => item.sourceLabel);
    expect(labels).toContain('Importação real');
    expect(labels).not.toContain('Importação abandonada');

    // O item abandonado continua pendente — "Confirmar" na segunda tela nunca o
    // decidiu por engano.
    const approvals = readApprovals();
    const abandonadoItem = approvals.find((item) => (item.payloadAfter as { version: string }).version === String(primeiraVersao));
    expect(abandonadoItem?.status).toBe('pendente');
  });

  it('jornada 2 — primeira importação (workspace ainda não criado): abandonar e recriar com o MESMO título não resgata o rascunho nem a árvore abandonados', async () => {
    const SLUG = 'novo-concurso-c1';
    const SYLLABUS_NOVO_KEY = `kalibra_syllabus:${TEST_USER.id}:${SLUG}`;

    const draftDe = (title: string) => ({
      slug: SLUG, title, institution: 'Banca', type: 'Concurso Público', examDate: '2027-05-10',
      cargos: [{ id: 'c1', name: 'Analista', examDate: '2027-05-10' }],
      selectedCargoId: 'c1', availability: { days: [], maxSessionMinutes: 50 }, status: 'aguardando_revisao_edital' as const,
      sourceMode: 'text' as const, sourceBlocks: [], importStatus: 'pending' as const, progress: 0, nextAction: '', active: true,
    });

    // Primeira tentativa — mesmo título, workspace nunca chega a ser criado (só
    // `handleConfirm` cria; abandonar antes disso não cria nada).
    const primeiraVersao = nextSyllabusVersionFor(SLUG, TEST_USER.id);
    stageWorkspaceImport(SLUG, {
      isNew: true, workspace: draftDe('Concurso Repetido'), extractionOutput: extractionWith('Rascunho abandonado'),
    }, TEST_USER.id);
    window.history.replaceState({}, '', `/workspace/${SLUG}/edital/revisar/${primeiraVersao}`);
    const { default: App } = await import('../App');
    const abandonada = render(<App />);
    expect(screen.getByText('Rascunho abandonado')).toBeTruthy();
    abandonada.unmount();

    // Segunda tentativa — MESMO título (`uniqueSlug` devolveria o mesmo slug, já que
    // o workspace da primeira tentativa nunca chegou a existir de verdade).
    const segundaVersao = nextSyllabusVersionFor(SLUG, TEST_USER.id);
    expect(segundaVersao).not.toBe(primeiraVersao);
    stageWorkspaceImport(SLUG, {
      isNew: true, workspace: draftDe('Concurso Repetido'), extractionOutput: extractionWith('Rascunho de verdade'),
    }, TEST_USER.id);
    window.history.replaceState({}, '', `/workspace/${SLUG}/edital/revisar/${segundaVersao}`);
    render(<App />);

    // Mesma nota da jornada 1: a seção de diff também lista o rótulo, então duas
    // ocorrências legítimas — `getAllByText`, não `getByText`.
    expect(screen.getAllByText('Rascunho de verdade').length).toBeGreaterThan(0);
    expect(screen.queryByText('Rascunho abandonado')).toBeNull();

    fireEvent.click(screen.getByText('Confirmar estrutura'));

    const syllabus = JSON.parse(window.localStorage.getItem(SYLLABUS_NOVO_KEY)!);
    const labels = syllabus.items.map((item: { sourceLabel: string }) => item.sourceLabel);
    expect(labels).toContain('Rascunho de verdade');
    expect(labels).not.toContain('Rascunho abandonado');

    const workspaces: Array<{ slug: string }> = JSON.parse(window.localStorage.getItem(WORKSPACES_KEY) ?? '[]');
    expect(workspaces.filter((w) => w.slug === SLUG)).toHaveLength(1);
  });
});

describe('EditalRevisar — achados C2/I1 da revisão final (PD-08: renomear em revisão produz o alias que o diff precisa)', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('exemplo completo do PD-08: importar, renomear em revisão, reimportar com a redação antiga, e o diff mostra RENOMEADO — nunca removido+adicionado', async () => {
    seedWorkspaceWithStatus('aguardando_revisao_edital');

    // Importação 1 — "Crase".
    stageWorkspaceImport('setec-campinas', {
      isNew: false,
      updates: {},
      extractionOutput: {
        entries: [entrada({ cargoId: 'c1', label: 'Crase' })],
        detectedCargos: ['c1'], examFormat: null, examDurationMinutes: null, uncertainties: [],
      },
    }, TEST_USER.id);
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital/revisar/1');
    const { default: App } = await import('../App');
    const primeira = render(<App />);

    // Renomeia AINDA EM REVISÃO, antes de confirmar — o momento em que "Crase" deixa
    // de ser o rótulo atual do conceito recém-criado por esta mesma extração.
    vi.spyOn(window, 'prompt').mockReturnValue('Emprego do acento indicativo de crase');
    const row = () => screen.getByText(/^Crase$/).closest('[data-testid^="row-syllabus-item-"]') as HTMLElement;
    fireEvent.click(within(row()).getByTestId(/^button-item-menu-/));
    fireEvent.click(within(row()).getByTestId(/^button-rename-/));
    expect(screen.getByText('Emprego do acento indicativo de crase')).toBeTruthy();

    fireEvent.click(screen.getByText('Confirmar estrutura'));
    primeira.unmount();

    const conceitos = JSON.parse(window.localStorage.getItem(CONCEPTS_KEY)!);
    expect(conceitos).toHaveLength(1);
    expect(conceitos[0].canonicalName).toBe('Emprego do acento indicativo de crase');
    // A propriedade central do achado: o rótulo ANTERIOR ("Crase") virou alias — sem
    // isto, uma reimportação com a redação antiga nunca casa de volta com este conceito.
    expect(conceitos[0].aliases).toEqual(['Crase']);

    // Importação 2 — a redação bruta volta a ser "Crase" (ex.: o mesmo edital colado de
    // novo, ou uma retificação que reverteu a redação). Sem o alias do passo acima,
    // isto criaria um conceito NOVO e o diff mostraria removido+adicionado — o próprio
    // bug que C2 descreve.
    stageWorkspaceImport('setec-campinas', {
      isNew: false,
      updates: {},
      extractionOutput: {
        entries: [entrada({ cargoId: 'c1', label: 'Crase' })],
        detectedCargos: ['c1'], examFormat: null, examDurationMinutes: null, uncertainties: [],
      },
    }, TEST_USER.id);
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital/revisar/2');
    render(<App />);

    const diffSection = screen.getByTestId('syllabus-diff');
    expect(diffSection.innerHTML).toContain('~ 1 renomeado');
    expect(diffSection.innerHTML).toContain('"Emprego do acento indicativo de crase" → "Crase"');
    expect(diffSection.innerHTML).toContain('+ 0 adicionado');
    expect(diffSection.innerHTML).toContain('− 0 removido');
  });
});

describe('EditalRevisar — achado R5 da re-revisão (confirmar sem proposta recusa em vez de avançar o status)', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => cleanup());

  it('abrir a versão de um item JÁ APROVADO não tem o que confirmar — o status do workspace não anda', async () => {
    // A outra metade do achado: o link da fila foi fechado para itens decididos
    // (`ApprovalCard`), mas a URL continua alcançável (histórico, favorito, link
    // colado). A tela abre sem proposta — `canDecide` recusa retomar um item decidido
    // — e antes desta correção "Confirmar estrutura" ainda levava o workspace de
    // `aguardando_revisao_edital` para `diagnostico_pendente`, sem nada para confirmar.
    seedWorkspaceWithStatus('aguardando_revisao_edital');
    window.localStorage.setItem(APPROVALS_KEY, JSON.stringify([{
      id: 'appr-aprovado', workspaceId: 'setec-campinas', type: 'edital_structure', status: 'aprovado',
      title: 'Estrutura extraída do edital · versão 1', rationale: '', sourceRef: null,
      targetConceptId: null, confidence: null, payloadBefore: null,
      payloadAfter: { version: '1', review: null, mergedCount: 0, uncertainties: [], workspaceDraft: null },
      createdAt: '2026-09-01T00:00:00.000Z', decidedAt: '2026-09-01T01:00:00.000Z', reason: null,
    }]));
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital/revisar/1');

    const { default: App } = await import('../App');
    render(<App />);

    fireEvent.click(screen.getByText('Confirmar estrutura'));

    // A mensagem tem que ser a da recusa POR NÃO HAVER PROPOSTA — não a genérica de
    // "armazenamento indisponível" que o try/catch mostraria se a função tivesse
    // seguido em frente e explodido no meio do caminho.
    expect(screen.getByTestId('confirm-error').textContent).toContain('Não há proposta de estrutura para revisar');
    expect(readWorkspaceStatus()).toBe('aguardando_revisao_edital');
    // E nada foi gravado a reboque do avanço fantasma.
    expect(window.localStorage.getItem(SYLLABUS_KEY)).toBeNull();
    expect(readApprovals().find((item) => item.id === 'appr-aprovado')?.status).toBe('aprovado');
  });
});

describe('critérios de aceite da Fase 1B.5', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(CONCEPTS_KEY, JSON.stringify([]));
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital/revisar/1');
    seedWorkspaceDoisCargos();
    seedImportDoisCargos();
  });

  afterEach(() => { cleanup(); });

  const renderApp = async () => {
    const { default: App } = await import('../App');
    return render(<App />);
  };

  it('conteúdo específico de um cargo não aparece no outro cargo', async () => {
    await renderApp();

    fireEvent.click(screen.getByTestId('cargo-filter-c1'));
    expect(screen.queryByText('INFORMÁTICA')).toBeNull();
    expect(screen.getByText('LÍNGUA PORTUGUESA')).toBeTruthy();

    fireEvent.click(screen.getByTestId('cargo-filter-c2'));
    expect(screen.getByText('INFORMÁTICA')).toBeTruthy();
  });

  it('conteúdo comum aparece UMA vez, marcado como comum a todos', async () => {
    await renderApp();

    expect(screen.getAllByText('LÍNGUA PORTUGUESA')).toHaveLength(1);
    expect(screen.getByTestId(`chip-common-${itemIdOf('LÍNGUA PORTUGUESA')}`).textContent).toContain('comum a todos');
  });

  it('conteúdo específico é marcado com o nome do cargo, não fica sem marca', async () => {
    await renderApp();
    expect(screen.getByTestId(`chip-escopo-${itemIdOf('INFORMÁTICA')}`).textContent).toContain('só Técnico');
  });

  it('editar o peso de um cargo não altera o peso do outro', async () => {
    await renderApp();
    const itemId = itemIdOf('LÍNGUA PORTUGUESA');

    fireEvent.click(screen.getByTestId('cargo-filter-c1'));
    fireEvent.change(screen.getByTestId(`input-peso-${itemId}`), { target: { value: '30' } });
    expect((screen.getByTestId(`input-peso-${itemId}`) as HTMLInputElement).value).toBe('30');

    fireEvent.click(screen.getByTestId('cargo-filter-c2'));
    expect((screen.getByTestId(`input-peso-${itemId}`) as HTMLInputElement).value).toBe('');

    fireEvent.click(screen.getByTestId('cargo-filter-c1'));
    expect((screen.getByTestId(`input-peso-${itemId}`) as HTMLInputElement).value).toBe('30');
  });

  it('aplicar um item a outro cargo não altera o peso já informado no primeiro', async () => {
    await renderApp();
    const itemId = itemIdOf('INFORMÁTICA');

    fireEvent.click(screen.getByTestId('cargo-filter-c2'));
    fireEvent.change(screen.getByTestId(`input-peso-${itemId}`), { target: { value: '40' } });

    fireEvent.click(screen.getByTestId('cargo-filter-todos'));
    fireEvent.click(within(rowOf('INFORMÁTICA')).getByLabelText('Ações para INFORMÁTICA'));
    fireEvent.click(screen.getByTestId(`button-link-${itemId}-c1`));

    fireEvent.click(screen.getByTestId('cargo-filter-c2'));
    expect((screen.getByTestId(`input-peso-${itemId}`) as HTMLInputElement).value).toBe('40');

    fireEvent.click(screen.getByTestId('cargo-filter-c1'));
    expect((screen.getByTestId(`input-peso-${itemId}`) as HTMLInputElement).value).toBe('');
  });

  it('separar um item de um cargo não remove o conteúdo do outro cargo', async () => {
    await renderApp();
    const itemId = itemIdOf('LÍNGUA PORTUGUESA');

    fireEvent.click(within(rowOf('LÍNGUA PORTUGUESA')).getByLabelText('Ações para LÍNGUA PORTUGUESA'));
    fireEvent.click(screen.getByTestId(`button-split-${itemId}-c2`));

    fireEvent.click(screen.getByTestId('cargo-filter-c1'));
    expect(screen.getByText('LÍNGUA PORTUGUESA')).toBeTruthy();

    fireEvent.click(screen.getByTestId('cargo-filter-c2'));
    expect(screen.getByText('LÍNGUA PORTUGUESA')).toBeTruthy();
  });

  it('confirmar grava a topologia revisada: um item comum com duas ligações, um item só do c2', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('Confirmar estrutura'));

    const syllabus = JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!);
    const idComum = syllabus.items.find((item: { sourceLabel: string }) => item.sourceLabel === 'LÍNGUA PORTUGUESA').id;
    const idEspecifico = syllabus.items.find((item: { sourceLabel: string }) => item.sourceLabel === 'INFORMÁTICA').id;

    expect(syllabus.links.filter((link: { syllabusItemId: string }) => link.syllabusItemId === idComum)
      .map((link: { cargoId: string }) => link.cargoId).sort()).toEqual(['c1', 'c2']);
    expect(syllabus.links.filter((link: { syllabusItemId: string }) => link.syllabusItemId === idEspecifico)
      .map((link: { cargoId: string }) => link.cargoId)).toEqual(['c2']);
  });
});

describe('EditalRevisar — achado R3 da re-revisão (o retry do confirmar é idempotente)', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(CONCEPTS_KEY, JSON.stringify([CRASE_PROVISIONAL, MAT_FINANCEIRA_CONFIRMED]));
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital/revisar/1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  /**
   * Faz a N-ésima escrita durável falhar (cota esgotada é o regime esperado: a fila
   * guarda cópias inteiras do Syllabus em todo item e nunca poda itens decididos), e
   * volta ao normal depois — é assim que o usuário vive um retry de verdade.
   */
  function falharNaEscrita(n: number) {
    // `Storage.prototype`, não `window.localStorage`: no jsdom o objeto de
    // armazenamento é um Proxy, e uma propriedade própria definida sobre ele não
    // intercepta chamada nenhuma — o espião passaria despercebido e o teste "passaria"
    // sem nunca ter provocado a falha que ele existe para provocar.
    const real = Storage.prototype.setItem;
    let escritas = 0;
    return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      // Só o armazenamento durável: `sessionStorage` (a importação pendente) divide o
      // mesmo protótipo e não é o que este teste está derrubando.
      if (this !== window.localStorage) {
        real.call(this, key, value);
        return;
      }
      escritas += 1;
      if (escritas === n) throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      real.call(this, key, value);
    });
  }

  it('falhar no meio e confirmar de novo não duplica conceito nenhum na biblioteca global', async () => {
    seedWorkspaceWithStatus('aguardando_revisao_edital');
    seedPendingImport();
    const { default: App } = await import('../App');
    render(<App />);

    const stub = falharNaEscrita(3);
    fireEvent.click(screen.getByText('Confirmar estrutura'));
    // A falha é visível e o trinco foi desfeito (achado I5 do fix wave anterior).
    expect(screen.getByTestId('confirm-error')).toBeTruthy();
    stub.mockRestore();

    fireEvent.click(screen.getByText('Confirmar estrutura'));

    const conceitos: Array<{ id: string }> = JSON.parse(window.localStorage.getItem(CONCEPTS_KEY)!);
    // 2 semeados + os 2 provisórios desta extração. Medido antes da correção: 5
    // entradas, com ids REPETIDOS — uma corrupção da biblioteca global que o
    // trinco-morto anterior, por pior que fosse, não conseguia produzir.
    expect(new Set(conceitos.map((concept) => concept.id)).size).toBe(conceitos.length);
    expect(conceitos).toHaveLength(4);
  });

  it('falhar no meio e confirmar de novo não duplica as fusões (concept_merge) na fila', async () => {
    seedWorkspaceWithStatus('aguardando_revisao_edital');
    seedPendingImport();
    const { default: App } = await import('../App');
    render(<App />);

    // A 6ª escrita cai já dentro do laço de `concept_merge` — o primeiro já foi
    // enfileirado e persistido quando o segundo falha.
    const stub = falharNaEscrita(6);
    fireEvent.click(screen.getByText('Confirmar estrutura'));
    expect(screen.getByTestId('confirm-error')).toBeTruthy();
    stub.mockRestore();

    fireEvent.click(screen.getByText('Confirmar estrutura'));

    const approvals = readApprovals();
    const merges = approvals.filter((item) => item.type === 'concept_merge');
    expect(merges).toHaveLength(2);
    // Uma fusão por (conceito-alvo, item de origem) — nunca duas do mesmo par.
    const pares = merges.map((item) => `${item.targetConceptId}/${item.sourceRef}`);
    expect(new Set(pares).size).toBe(2);
    expect(approvals.filter((item) => item.type === 'edital_structure')).toHaveLength(1);
  });

  it('o retry completa de verdade: o programa é gravado e o status avança', async () => {
    seedWorkspaceWithStatus('aguardando_revisao_edital');
    seedPendingImport();
    const { default: App } = await import('../App');
    render(<App />);

    const stub = falharNaEscrita(3);
    fireEvent.click(screen.getByText('Confirmar estrutura'));
    stub.mockRestore();
    fireEvent.click(screen.getByText('Confirmar estrutura'));

    const syllabus = JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!);
    expect(syllabus.items.map((item: { sourceLabel: string }) => item.sourceLabel).sort()).toEqual(
      ['Crase', 'Matemática financeira básica'].sort(),
    );
    expect(readWorkspaceStatus()).toBe('diagnostico_pendente');
    expect(window.sessionStorage.getItem(PENDING_KEY)).toBeNull();
  });
});

/**
 * Achado I-2 da revisão final de branch: "Excluir" apagava o item de TODOS os cargos
 * mesmo com o filtro num cargo só, sem confirmação — violando o critério de aceite
 * "alterar um cargo não contamina os demais". Os dois caminhos da tela são cobertos
 * aqui: a PROPOSTA em revisão (estado `review`, nada persistido ainda) e o PROGRAMA já
 * salvo (`syllabusApi`, grava na hora). Corrigir um só deixaria metade dos casos morta.
 */
describe('EditalRevisar — achado I-2 (excluir com filtro de cargo não contamina os outros cargos)', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital/revisar/1');
  });

  afterEach(() => {
    cleanup();
  });

  const abrirMenuDe = (label: string) => {
    const id = itemIdOf(label);
    fireEvent.click(screen.getByTestId(`button-item-menu-${id}`));
    return id;
  };

  describe('na proposta em revisão (estado `review`)', () => {
    it('exclui o item só do cargo filtrado — o outro cargo continua com ele', async () => {
      seedWorkspaceDoisCargos();
      seedImportDoisCargos();
      const { default: App } = await import('../App');
      render(<App />);

      // LÍNGUA PORTUGUESA é comum a c1 e c2; INFORMÁTICA é só do c2.
      fireEvent.click(screen.getByTestId('cargo-filter-c1'));
      const id = abrirMenuDe('LÍNGUA PORTUGUESA');
      expect(screen.getByTestId(`button-remove-${id}`).textContent).toBe('Excluir de Analista');
      fireEvent.click(screen.getByTestId(`button-remove-${id}`));

      // Some da visão do Analista...
      expect(screen.queryByText('LÍNGUA PORTUGUESA')).toBeNull();
      // ...e continua na visão do Técnico.
      fireEvent.click(screen.getByTestId('cargo-filter-c2'));
      expect(screen.getByText('LÍNGUA PORTUGUESA')).toBeTruthy();
    });

    it('o peso e a quantidade de questões do outro cargo ficam intactos', async () => {
      seedWorkspaceDoisCargos();
      seedImportDoisCargos();
      const { default: App } = await import('../App');
      render(<App />);

      // O Técnico informa peso 30 e 7 questões para LÍNGUA PORTUGUESA.
      fireEvent.click(screen.getByTestId('cargo-filter-c2'));
      const id = itemIdOf('LÍNGUA PORTUGUESA');
      fireEvent.change(screen.getByTestId(`input-peso-${id}`), { target: { value: '30' } });
      fireEvent.change(screen.getByTestId(`input-questoes-${id}`), { target: { value: '7' } });

      // O Analista exclui o mesmo item da visão dele.
      fireEvent.click(screen.getByTestId('cargo-filter-c1'));
      abrirMenuDe('LÍNGUA PORTUGUESA');
      fireEvent.click(screen.getByTestId(`button-remove-${id}`));

      fireEvent.click(screen.getByTestId('cargo-filter-c2'));
      expect((screen.getByTestId(`input-peso-${id}`) as HTMLInputElement).value).toBe('30');
      expect((screen.getByTestId(`input-questoes-${id}`) as HTMLInputElement).value).toBe('7');
    });

    it('confirmar grava a topologia sem a ligação excluída — e sem perder o item', async () => {
      seedWorkspaceDoisCargos();
      seedImportDoisCargos();
      const { default: App } = await import('../App');
      render(<App />);

      fireEvent.click(screen.getByTestId('cargo-filter-c1'));
      const id = abrirMenuDe('LÍNGUA PORTUGUESA');
      fireEvent.click(screen.getByTestId(`button-remove-${id}`));
      fireEvent.click(screen.getByTestId('cargo-filter-todos'));
      fireEvent.click(screen.getByText('Confirmar estrutura'));

      const stored = JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!);
      const item = stored.items.find((candidate: { sourceLabel: string }) => candidate.sourceLabel === 'LÍNGUA PORTUGUESA');
      expect(item).toBeTruthy();
      expect(stored.links
        .filter((link: { syllabusItemId: string }) => link.syllabusItemId === item.id)
        .map((link: { cargoId: string }) => link.cargoId)).toEqual(['c2']);
    });

    it('com "todos os cargos" selecionado, excluir continua apagando o item inteiro', async () => {
      seedWorkspaceDoisCargos();
      seedImportDoisCargos();
      const { default: App } = await import('../App');
      render(<App />);

      const id = abrirMenuDe('LÍNGUA PORTUGUESA');
      expect(screen.getByTestId(`button-remove-${id}`).textContent).toBe('Excluir de todos os cargos');
      fireEvent.click(screen.getByTestId(`button-remove-${id}`));

      expect(screen.queryByText('LÍNGUA PORTUGUESA')).toBeNull();
      fireEvent.click(screen.getByTestId('cargo-filter-c2'));
      expect(screen.queryByText('LÍNGUA PORTUGUESA')).toBeNull();
    });
  });

  describe('no programa já persistido (`syllabusApi`)', () => {
    // "Crase" comum aos dois cargos, com peso e quantidade DIFERENTES por cargo — o
    // dado do relato do achado. "Informática" é só do Técnico.
    const SALVO = {
      items: [
        { id: 'i1a', workspaceId: 'setec-campinas', conceptId: 'k-crase', parentItemId: null, sourceLabel: 'Crase', sourceExcerpt: null, page: null, confidence: 1, uncertain: false },
        { id: 'i2a', workspaceId: 'setec-campinas', conceptId: 'k-info', parentItemId: null, sourceLabel: 'Informatica', sourceExcerpt: null, page: null, confidence: 1, uncertain: false },
      ],
      links: [
        { syllabusItemId: 'i1a', cargoId: 'c1', weight: 5, questionCount: 2 },
        { syllabusItemId: 'i1a', cargoId: 'c2', weight: 6, questionCount: 3 },
        { syllabusItemId: 'i2a', cargoId: 'c2', weight: 20, questionCount: 5 },
      ],
    };

    const lerSalvo = () => JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!);

    it('exclui a ligação daquele cargo e deixa a do outro intocada, peso e questões inclusive', async () => {
      seedWorkspaceDoisCargos('aguardando_revisao_edital');
      window.localStorage.setItem(SYLLABUS_KEY, JSON.stringify(SALVO));
      const { default: App } = await import('../App');
      render(<App />);

      fireEvent.click(screen.getByTestId('cargo-filter-c1'));
      fireEvent.click(screen.getByTestId('button-item-menu-i1a'));
      expect(screen.getByTestId('button-remove-i1a').textContent).toBe('Excluir de Analista');
      fireEvent.click(screen.getByTestId('button-remove-i1a'));

      const stored = lerSalvo();
      expect(stored.items.map((item: { id: string }) => item.id).sort()).toEqual(['i1a', 'i2a']);
      expect(stored.links).toContainEqual({ syllabusItemId: 'i1a', cargoId: 'c2', weight: 6, questionCount: 3 });
      expect(stored.links.filter((link: { syllabusItemId: string; cargoId: string }) =>
        link.syllabusItemId === 'i1a' && link.cargoId === 'c1')).toEqual([]);
    });

    it('"Crase" continua visível para o Técnico depois de o Analista excluí-la', async () => {
      seedWorkspaceDoisCargos('aguardando_revisao_edital');
      window.localStorage.setItem(SYLLABUS_KEY, JSON.stringify(SALVO));
      const { default: App } = await import('../App');
      render(<App />);

      fireEvent.click(screen.getByTestId('cargo-filter-c1'));
      fireEvent.click(screen.getByTestId('button-item-menu-i1a'));
      fireEvent.click(screen.getByTestId('button-remove-i1a'));

      fireEvent.click(screen.getByTestId('cargo-filter-c2'));
      expect(screen.getByText('Crase')).toBeTruthy();
    });

    it('item de um cargo só: excluir apaga o item inteiro, como sempre fez', async () => {
      seedWorkspaceDoisCargos('aguardando_revisao_edital');
      window.localStorage.setItem(SYLLABUS_KEY, JSON.stringify(SALVO));
      const { default: App } = await import('../App');
      render(<App />);

      fireEvent.click(screen.getByTestId('cargo-filter-c2'));
      fireEvent.click(screen.getByTestId('button-item-menu-i2a'));
      expect(screen.getByTestId('button-remove-i2a').textContent).toBe('Excluir');
      fireEvent.click(screen.getByTestId('button-remove-i2a'));

      const stored = lerSalvo();
      expect(stored.items.map((item: { id: string }) => item.id)).toEqual(['i1a']);
      expect(stored.links.filter((link: { syllabusItemId: string }) => link.syllabusItemId === 'i2a')).toEqual([]);
    });
  });
});
