import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';
import type { Concept, ExtractionOutput, RawSyllabusEntry } from '@workspace/core';
import { clerkReactMock, TEST_USER } from '../test/clerk-mock';
import { stageWorkspaceImport } from '@/domain/staging';

vi.mock('@clerk/react', () => clerkReactMock);
vi.mock('@clerk/react/internal', () => ({
  publishableKeyFromHost: () => 'pk_test_edital_revisar_derivacoes',
}));
vi.mock('@clerk/themes', () => ({ shadcn: {} }));
vi.mock('@clerk/localizations', () => ({ ptBR: {} }));

/**
 * Achado R4 da re-revisão: o fix wave anterior declarou `diffSyllabus` memoizado, e
 * MEDIDO ele continuava rodando uma vez por tecla — o `useMemo` economizava
 * exatamente a chamada da montagem e nada mais, porque a primeira dependência
 * (`review`) é um objeto novo a cada tecla. Um teste que só verifica "existe um
 * useMemo" não teria pego isso. Este conta CHAMADAS: `@workspace/core` é
 * reexportado inteiro de verdade, com `diffSyllabus` envolvido num contador que
 * delega para a implementação real.
 */
const perf = vi.hoisted(() => ({ diffCalls: 0, commonCalls: 0 }));

vi.mock('@workspace/core', async () => {
  const real = await vi.importActual<typeof import('@workspace/core')>('@workspace/core');
  return {
    ...real,
    diffSyllabus: (...args: Parameters<typeof real.diffSyllabus>) => {
      perf.diffCalls += 1;
      return real.diffSyllabus(...args);
    },
    // `hasCommonItems` tem UM chamador (esta tela), então contá-lo isola a derivação —
    // ao contrário de `isCommon`, que `SyllabusTree` também chama por linha renderizada.
    hasCommonItems: (...args: Parameters<typeof real.hasCommonItems>) => {
      perf.commonCalls += 1;
      return real.hasCommonItems(...args);
    },
  };
});

const CONCEPTS_KEY = `kalibra_concepts:${TEST_USER.id}`;
const APPROVALS_KEY = `kalibra_approvals:${TEST_USER.id}`;
const SYLLABUS_KEY = `kalibra_syllabus:${TEST_USER.id}:setec-campinas`;
const WORKSPACES_KEY = `kalibra_workspaces:${TEST_USER.id}`;

const entrada = (over: Partial<RawSyllabusEntry> & { cargoId: string; label: string }): RawSyllabusEntry => ({
  parentLabel: null, weight: null, questionCount: null,
  sourceExcerpt: null, page: null, confidence: 1, ...over,
});

const extractionWith = (...labels: string[]): ExtractionOutput => ({
  entries: labels.map((label) => entrada({ cargoId: 'c1', label })),
  detectedCargos: ['c1'],
  examFormat: null,
  examDurationMinutes: null,
  uncertainties: [],
});

const PENAL_CONFIRMED: Concept = {
  id: 'concept-penal', canonicalName: 'Direito Penal', slug: 'direito-penal',
  parentId: null, kind: 'disciplina', aliases: [], status: 'confirmed',
};

/** O programa da versão 1, já salvo — é ele o "antes" de qualquer comparação PD-08. */
const PROGRAMA_SALVO = {
  items: [
    { id: 'v1-penal', workspaceId: 'setec-campinas', conceptId: 'concept-penal', parentItemId: null, sourceLabel: 'Direito Penal', sourceExcerpt: null, page: null, confidence: 1, uncertain: false },
  ],
  links: [{ syllabusItemId: 'v1-penal', cargoId: 'c1', weight: null, questionCount: null }],
};

function seedWorkspace() {
  window.localStorage.setItem(WORKSPACES_KEY, JSON.stringify([{
    slug: 'setec-campinas',
    title: 'Concurso SETEC Campinas',
    institution: 'SETEC',
    type: 'Concurso Público',
    examDate: '2027-01-17',
    cargos: [{ id: 'c1', name: 'Analista Técnico (Informática)', examDate: '2027-01-17' }],
    selectedCargoId: 'c1',
    availability: { days: [], maxSessionMinutes: 50 },
    status: 'aguardando_revisao_edital',
    sourceMode: 'text',
    importStatus: 'completed',
    progress: 0,
    nextAction: 'texto qualquer',
    active: true,
  }]));
}

function approvedStructureItem(version: string) {
  return {
    id: `appr-v${version}`, workspaceId: 'setec-campinas', type: 'edital_structure', status: 'aprovado',
    title: `Estrutura extraída do edital · versão ${version}`, rationale: '', sourceRef: null,
    targetConceptId: null, confidence: null, payloadBefore: null,
    payloadAfter: { version, review: null, mergedCount: 0, uncertainties: [], workspaceDraft: null },
    createdAt: '2026-09-14T00:00:00.000Z', decidedAt: '2026-09-14T00:10:00.000Z', reason: null,
  };
}

describe('EditalRevisar — achado R1 da re-revisão (a comparação do PD-08 não pode depender do NÚMERO da versão)', () => {
  beforeEach(() => {
    cleanup();
    perf.diffCalls = 0;
    perf.commonCalls = 0;
    window.localStorage.clear();
    window.sessionStorage.clear();
    seedWorkspace();
    window.localStorage.setItem(CONCEPTS_KEY, JSON.stringify([PENAL_CONFIRMED]));
    window.localStorage.setItem(SYLLABUS_KEY, JSON.stringify(PROGRAMA_SALVO));
  });

  afterEach(() => cleanup());

  it('reimportar num workspace com programa salvo mostra a comparação MESMO que a versão apurada seja 1', async () => {
    // O caso exato medido na re-revisão: um workspace que já existia antes do fix wave
    // anterior não tem contador nenhum gravado, então a reimportação apurava a versão 1
    // — e o gate `version !== '1'` escondia a comparação inteira, na tela cuja única
    // razão de existir é mostrar o que uma retificação mudou.
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital/revisar/1');
    stageWorkspaceImport('setec-campinas', {
      isNew: false, updates: {}, extractionOutput: extractionWith('Direito Constitucional'),
    }, TEST_USER.id);

    const { default: App } = await import('../App');
    render(<App />);
    // Fase 1B: o efeito que enfileira a proposta agora AGUARDA `enqueue`, entao
    // `setReviewState` cai num microtask depois do render. No navegador e
    // impercetivel; aqui precisa de um flush antes de asserir.
    await act(async () => {});

    const diffSection = screen.getByTestId('syllabus-diff');
    expect(diffSection.innerHTML).toContain('+ 1 adicionado');
    expect(diffSection.innerHTML).toContain('Direito Constitucional');
    expect(diffSection.innerHTML).toContain('− 1 removido');
    expect(diffSection.innerHTML).toContain('Direito Penal');
  });

  it('sem programa salvo não há o que comparar — a seção não aparece, seja qual for o número da versão', async () => {
    window.localStorage.removeItem(SYLLABUS_KEY);
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital/revisar/7');
    stageWorkspaceImport('setec-campinas', {
      isNew: false, updates: {}, extractionOutput: extractionWith('Direito Constitucional'),
    }, TEST_USER.id);

    const { default: App } = await import('../App');
    const { container } = render(<App />);
    // Fase 1B: o efeito que enfileira a proposta agora AGUARDA `enqueue`, entao
    // `setReviewState` cai num microtask depois do render. No navegador e
    // impercetivel; aqui precisa de um flush antes de asserir.
    await act(async () => {});

    expect(container.querySelector('[data-testid="syllabus-diff"]')).toBeNull();
  });

  it('achado R2: o rótulo nomeia a última versão APROVADA, nunca "a da URL menos 1"', async () => {
    // A versão 1 é a que de fato escreveu o programa salvo; a 2 foi uma tentativa
    // abandonada que nunca virou nada. Esta é a 3. "Versão da URL − 1" anunciaria
    // comparação com a 2 — uma versão que nunca existiu.
    window.localStorage.setItem(APPROVALS_KEY, JSON.stringify([approvedStructureItem('1')]));
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital/revisar/3');
    stageWorkspaceImport('setec-campinas', {
      isNew: false, updates: {}, extractionOutput: extractionWith('Direito Constitucional'),
    }, TEST_USER.id);

    const { default: App } = await import('../App');
    render(<App />);
    await act(async () => {});

    const diffSection = screen.getByTestId('syllabus-diff');
    expect(diffSection.innerHTML).toContain('COMPARADO COM A VERSÃO 1');
    expect(diffSection.innerHTML).not.toContain('COMPARADO COM A VERSÃO 2');
  });
});

describe('EditalRevisar — achado R4 da re-revisão (digitar um peso não pode recalcular o diff)', () => {
  beforeEach(() => {
    cleanup();
    perf.diffCalls = 0;
    perf.commonCalls = 0;
    window.localStorage.clear();
    window.sessionStorage.clear();
    seedWorkspace();
    window.localStorage.setItem(CONCEPTS_KEY, JSON.stringify([PENAL_CONFIRMED]));
    window.localStorage.setItem(SYLLABUS_KEY, JSON.stringify(PROGRAMA_SALVO));
    window.history.replaceState({}, '', '/workspace/setec-campinas/edital/revisar/2');
  });

  afterEach(() => cleanup());

  async function montarComCargoSelecionado() {
    stageWorkspaceImport('setec-campinas', {
      isNew: false, updates: {}, extractionOutput: extractionWith('Direito Constitucional'),
    }, TEST_USER.id);
    const { default: App } = await import('../App');
    const view = render(<App />);
    // Fase 1B: o efeito que enfileira a proposta agora AGUARDA `enqueue`, entao
    // `setReviewState` cai num microtask depois do render. No navegador e
    // impercetivel; aqui precisa de um flush antes de asserir.
    await act(async () => {});
    // Sem cargo selecionado o campo de peso nasce `disabled` — digitar nele não dispara
    // nada, e um teste assim não provaria coisa alguma. O cargo é selecionado ANTES de
    // zerar o contador.
    fireEvent.click(screen.getByTestId('cargo-filter-c1'));
    return view;
  }

  it('três teclas num campo de peso não disparam nenhuma chamada nova de diffSyllabus', async () => {
    const { container } = await montarComCargoSelecionado();

    const pesoInput = container.querySelector('[data-testid^="input-peso-"]') as HTMLInputElement;
    expect(pesoInput).toBeTruthy();
    expect(pesoInput.disabled).toBe(false);

    const antesDeDigitar = perf.diffCalls;
    const comunsAntesDeDigitar = perf.commonCalls;
    expect(antesDeDigitar).toBeGreaterThan(0); // a montagem calculou o diff, como deve
    expect(comunsAntesDeDigitar).toBeGreaterThan(0);

    fireEvent.change(pesoInput, { target: { value: '1' } });
    fireEvent.change(pesoInput, { target: { value: '12' } });
    fireEvent.change(pesoInput, { target: { value: '123' } });

    // O peso mudou de verdade (o teste está exercitando um campo editável)...
    expect((container.querySelector('[data-testid^="input-peso-"]') as HTMLInputElement).value).toBe('123');
    // ...e nenhuma tecla recalculou o diff. Antes: 1 chamada por tecla.
    expect(perf.diffCalls).toBe(antesDeDigitar);
    // A derivação de "tem item comum" tinha a mesma forma e o mesmo defeito.
    expect(perf.commonCalls).toBe(comunsAntesDeDigitar);
  });

  it('uma edição que MUDA o diff (renomear um item) continua recalculando — a memoização não pode congelar a tela', async () => {
    const { container } = await montarComCargoSelecionado();
    const antes = perf.diffCalls;

    vi.spyOn(window, 'prompt').mockReturnValue('Direito Constitucional renomeado');
    const row = container.querySelector('[data-testid^="row-syllabus-item-"]') as HTMLElement;
    fireEvent.click(row.querySelector('[data-testid^="button-item-menu-"]') as HTMLElement);
    fireEvent.click(row.querySelector('[data-testid^="button-rename-"]') as HTMLElement);

    expect(perf.diffCalls).toBeGreaterThan(antes);
    expect(screen.getByTestId('syllabus-diff').innerHTML).toContain('Direito Constitucional renomeado');
  });
});
