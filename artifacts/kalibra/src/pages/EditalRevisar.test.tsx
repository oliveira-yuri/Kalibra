import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
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
        sourceMode: 'text', importStatus: 'pending', progress: 0, nextAction: '', active: true,
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
        sourceMode: 'text', importStatus: 'pending', progress: 0, nextAction: '', active: true,
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
