import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import type { Concept, RawSyllabusEntry, ExtractionOutput } from '@workspace/core';
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

  it('roda dedupeEntries sobre a saída da extração e persiste o Syllabus resultante', async () => {
    seedPendingImport();
    const { default: App } = await import('../App');
    render(<App />);

    const syllabus = JSON.parse(window.localStorage.getItem(SYLLABUS_KEY)!);
    expect(syllabus.items.map((item: { sourceLabel: string }) => item.sourceLabel).sort()).toEqual(
      ['Crase', 'Matemática financeira básica'].sort(),
    );
  });

  it('salva os conceitos provisórios novos de DedupResult.newConcepts na biblioteca global', async () => {
    seedPendingImport();
    const { default: App } = await import('../App');
    render(<App />);

    const concepts: Concept[] = JSON.parse(window.localStorage.getItem(CONCEPTS_KEY)!);
    // Os dois conceitos semeados continuam lá, mais dois provisórios novos — um por
    // entrada, já que nenhuma das duas casou com um conceito CONFIRMED (Crase só bate
    // num provisório; Matemática financeira básica fica abaixo do limiar de ligação
    // direta apesar do quase-acerto).
    expect(concepts).toHaveLength(4);
    expect(concepts.filter((c) => c.status === 'provisional')).toHaveLength(3);
  });

  it('cada proposedLink vira um item concept_merge com targetConceptId = conceptId da proposta, NUNCA sourceRef', async () => {
    seedPendingImport();
    const { default: App } = await import('../App');
    render(<App />);

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

  it('as duas chamadas de enqueue (uma por proposedLink) sobrevivem no mesmo tick — nenhuma se perde', async () => {
    seedPendingImport();
    const { default: App } = await import('../App');
    render(<App />);

    // Duas propostas nesta fixture: se os hooks não fossem ref-sincronizados, a
    // segunda chamada de `enqueue` no mesmo efeito reconstruiria a partir do estado
    // obsoleto e sobrescreveria a primeira — ficaria só 1, não 2.
    expect(readApprovals()).toHaveLength(2);
  });

  it('lista output.uncertainties no bloco "Não encontrado no edital", nunca um valor inventado', async () => {
    seedPendingImport();
    const { default: App } = await import('../App');
    const { container } = render(<App />);

    expect(container.innerHTML).toContain('Não encontrado no edital');
    expect(screen.getByText('peso das matérias')).toBeTruthy();
  });

  it('não roda a deduplicação de novo ao remontar a mesma tela (extractionApplied evita duplicar)', async () => {
    seedPendingImport();
    const { default: App } = await import('../App');

    const first = render(<App />);
    expect(readApprovals()).toHaveLength(2);
    first.unmount();

    // Remonta a MESMA tela (usuário saiu e voltou sem confirmar nem descartar) — a
    // importação pendente na sessionStorage ainda existe, com `extractionOutput`
    // preservado (para as incertezas continuarem visíveis) mas `extractionApplied`
    // marcado — sem essa marca, dedupeEntries rodaria de novo e duplicaria tudo.
    render(<App />);
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
