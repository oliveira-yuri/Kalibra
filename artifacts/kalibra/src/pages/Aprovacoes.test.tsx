import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { clerkReactMock, TEST_USER } from '../test/clerk-mock';
import type { ApprovalItem } from '@workspace/core';

vi.mock('@clerk/react', () => clerkReactMock);
vi.mock('@clerk/react/internal', () => ({
  publishableKeyFromHost: () => 'pk_test_aprovacoes',
}));
vi.mock('@clerk/themes', () => ({ shadcn: {} }));
vi.mock('@clerk/localizations', () => ({ ptBR: {} }));

function storageKey(): string {
  return `kalibra_approvals:${TEST_USER.id}`;
}

function readStoredApprovals(): ApprovalItem[] {
  const raw = window.localStorage.getItem(storageKey());
  return raw ? JSON.parse(raw) : [];
}

function pendingItem(id: string, title: string): ApprovalItem {
  return {
    id,
    workspaceId: 'setec-campinas',
    type: 'concept_merge',
    status: 'pendente',
    title,
    rationale: 'motivo',
    sourceRef: null,
    targetConceptId: null,
    confidence: 0.9,
    payloadBefore: null,
    payloadAfter: { canonicalName: title },
    createdAt: '2026-09-01T00:00:00.000Z',
    decidedAt: null,
    reason: null,
  };
}

describe('Aprovacoes — aprovação em lote', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(storageKey(), JSON.stringify([
      pendingItem('appr-1', 'Primeira'),
      pendingItem('appr-2', 'Segunda'),
      pendingItem('appr-3', 'Terceira'),
    ]));
    window.history.replaceState({}, '', '/workspace/setec-campinas/aprovacoes');
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('selecionar três itens e clicar em "Aprovar selecionados" persiste os três, não só o último', async () => {
    const { default: App } = await import('../App');
    render(<App />);

    // O botão nasce desabilitado: nada está selecionado ainda.
    expect((screen.getByTestId('button-approve-selected') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByTestId('checkbox-select-appr-1'));
    fireEvent.click(screen.getByTestId('checkbox-select-appr-2'));
    fireEvent.click(screen.getByTestId('checkbox-select-appr-3'));

    expect((screen.getByTestId('button-approve-selected') as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByTestId('button-approve-selected'));

    const stored = readStoredApprovals();
    expect(stored.filter((item) => item.status === 'aprovado').map((item) => item.id).sort()).toEqual([
      'appr-1', 'appr-2', 'appr-3',
    ]);
  });

  it('depois da aprovação em lote a seleção não sobrevive: os itens decididos somem da lista de seleção', async () => {
    const { default: App } = await import('../App');
    render(<App />);

    fireEvent.click(screen.getByTestId('checkbox-select-appr-1'));
    fireEvent.click(screen.getByTestId('checkbox-select-appr-2'));
    fireEvent.click(screen.getByTestId('button-approve-selected'));

    // Item decidido é terminal (`canDecide`) — o cartão nem oferece mais a caixa de
    // seleção para ele, então não há como reaprovar por engano numa segunda rodada.
    expect(screen.queryByTestId('checkbox-select-appr-1')).toBeNull();
    expect(screen.queryByTestId('checkbox-select-appr-2')).toBeNull();
    expect((screen.getByTestId('button-approve-selected') as HTMLButtonElement).disabled).toBe(true);

    // O terceiro item, nunca selecionado, continua pendente e selecionável.
    expect((screen.getByTestId('checkbox-select-appr-3') as HTMLInputElement).checked).toBe(false);
  });
});

function pendingStructureItem(id: string, version: string): ApprovalItem {
  return {
    id,
    workspaceId: 'setec-campinas',
    type: 'edital_structure',
    status: 'pendente',
    title: `Estrutura extraída do edital · versão ${version}`,
    rationale: '2 itens mapeados a partir do edital.',
    sourceRef: null,
    targetConceptId: null,
    confidence: null,
    payloadBefore: null,
    payloadAfter: { version, syllabus: { items: [], links: [] }, mergedCount: 0 },
    createdAt: '2026-09-01T00:00:00.000Z',
    decidedAt: null,
    reason: null,
  };
}

describe('Aprovacoes — edital_structure só decide na tela dedicada (Task 14)', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(storageKey(), JSON.stringify([pendingStructureItem('appr-struct', '1')]));
    window.history.replaceState({}, '', '/workspace/setec-campinas/aprovacoes');
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('não oferece aprovar/rejeitar nem caixa de seleção inline — só o link para a revisão', async () => {
    // Aprovar por aqui gravaria a decisão na fila sem nunca escrever o programa
    // (a persistência mora só em `EditalRevisar.handleConfirm`) — por isso o cartão
    // não pode oferecer essa decisão inline para este tipo.
    const { default: App } = await import('../App');
    render(<App />);

    expect(screen.getByTestId('link-review-structure-appr-struct')).toBeTruthy();
    expect(screen.queryByTestId('button-approve-appr-struct')).toBeNull();
    expect(screen.queryByTestId('button-reject-appr-struct')).toBeNull();
    expect(screen.queryByTestId('checkbox-select-appr-struct')).toBeNull();
  });
});
