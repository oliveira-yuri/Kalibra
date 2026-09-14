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

function pendingStructureItem(id: string, version: string, workspaceId = 'setec-campinas'): ApprovalItem {
  return {
    id,
    workspaceId,
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

describe('Aprovacoes — o link da estrutura sempre aponta para o workspace DONO do item (fix round 1, achado 3)', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    // A fila não filtra por workspace (é um inbox entre workspaces) — visitar
    // /aprovacoes a partir de "setec-campinas" ainda lista um item que pertence a
    // "outro-workspace".
    window.localStorage.setItem(storageKey(), JSON.stringify([
      pendingStructureItem('appr-outro', '1', 'outro-workspace'),
    ]));
    // Visita a fila a partir de um workspace DIFERENTE do dono do item.
    window.history.replaceState({}, '', '/workspace/setec-campinas/aprovacoes');
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('o href de "Revisar estrutura" resolve para o workspace do item, não para o workspace atual', async () => {
    const { default: App } = await import('../App');
    render(<App />);

    const link = screen.getByTestId('link-review-structure-appr-outro') as HTMLAnchorElement;
    // Sem o fix, o href relativo resolveria contra a base do Router aninhado do
    // workspace ATUAL (setec-campinas) — exatamente o achado 3: clicar levaria para
    // dentro do workspace errado, mostrando (ou tentando mostrar) a estrutura de um
    // workspace que não é o dono da proposta.
    expect(link.getAttribute('href')).toBe('/workspace/outro-workspace/edital/revisar/1');
    expect(link.getAttribute('href')).not.toContain('setec-campinas');
  });
});

describe('Aprovacoes — achado R5 da re-revisão (um item decidido não convida para a tela de revisão)', () => {
  const decidedStructureItem = (id: string, status: 'aprovado' | 'rejeitado'): ApprovalItem => ({
    ...pendingStructureItem(id, '1'),
    status,
    decidedAt: '2026-09-02T00:00:00.000Z',
  });

  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/workspace/setec-campinas/aprovacoes');
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('um edital_structure APROVADO não renderiza mais "Revisar estrutura"', async () => {
    // Medido na re-revisão: o link continuava lá. A tela do outro lado só retoma
    // propostas que `canDecide` autoriza, então abria vazia — e "Confirmar estrutura"
    // ainda avançava o status do workspace. `decidableInline` fechava a caixa de
    // seleção e os botões inline, mas nunca o link, que era o caminho real para o dano.
    window.localStorage.setItem(storageKey(), JSON.stringify([decidedStructureItem('appr-decidido', 'aprovado')]));
    const { default: App } = await import('../App');
    render(<App />);

    expect(screen.getByTestId('card-approval-appr-decidido')).toBeTruthy();
    expect(screen.queryByTestId('link-review-structure-appr-decidido')).toBeNull();
  });

  it('um edital_structure REJEITADO também não renderiza o link — decidido é terminal nos dois sentidos', async () => {
    window.localStorage.setItem(storageKey(), JSON.stringify([decidedStructureItem('appr-rejeitado', 'rejeitado')]));
    const { default: App } = await import('../App');
    render(<App />);

    expect(screen.queryByTestId('link-review-structure-appr-rejeitado')).toBeNull();
  });

  it('um item ainda PENDENTE continua oferecendo o link — a correção não fecha o caminho legítimo', async () => {
    window.localStorage.setItem(storageKey(), JSON.stringify([pendingStructureItem('appr-pendente', '1')]));
    const { default: App } = await import('../App');
    render(<App />);

    expect(screen.getByTestId('link-review-structure-appr-pendente')).toBeTruthy();
  });
});
