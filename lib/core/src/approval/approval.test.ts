import { describe, it, expect } from 'vitest';
import { canDecide, pendingCount, groupByType, APPROVAL_TYPES, type ApprovalItem } from './approval';

function makeItem(overrides: Partial<ApprovalItem> = {}): ApprovalItem {
  return {
    id: 'a1',
    workspaceId: null,
    type: 'edital_structure',
    status: 'pendente',
    title: 'título',
    rationale: 'motivo',
    sourceRef: null,
    confidence: null,
    payloadBefore: null,
    payloadAfter: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    decidedAt: null,
    reason: null,
    ...overrides,
  };
}

describe('canDecide', () => {
  it('é true para pendente e revisando', () => {
    expect(canDecide('pendente')).toBe(true);
    expect(canDecide('revisando')).toBe(true);
  });

  it('é false para aprovado e rejeitado (estados terminais)', () => {
    expect(canDecide('aprovado')).toBe(false);
    expect(canDecide('rejeitado')).toBe(false);
  });
});

describe('pendingCount', () => {
  it('conta só o que ainda pode ser decidido', () => {
    const items = [
      makeItem({ id: 'a', status: 'pendente' }),
      makeItem({ id: 'b', status: 'revisando' }),
      makeItem({ id: 'c', status: 'aprovado' }),
      makeItem({ id: 'd', status: 'rejeitado' }),
    ];
    expect(pendingCount(items)).toBe(2);
  });

  it('devolve 0 para uma lista vazia', () => {
    expect(pendingCount([])).toBe(0);
  });
});

describe('groupByType', () => {
  it('agrupa itens pelo tipo, preservando ordem de chegada dentro de cada grupo', () => {
    const items = [
      makeItem({ id: 'a', type: 'edital_structure' }),
      makeItem({ id: 'b', type: 'concept_merge' }),
      makeItem({ id: 'c', type: 'edital_structure' }),
    ];
    const grouped = groupByType(items);
    expect(grouped.edital_structure.map((item) => item.id)).toEqual(['a', 'c']);
    expect(grouped.concept_merge.map((item) => item.id)).toEqual(['b']);
  });

  it('inclui todos os tipos declarados mesmo sem nenhum item', () => {
    const grouped = groupByType([]);
    for (const type of APPROVAL_TYPES) {
      expect(grouped[type]).toEqual([]);
    }
  });

  it('só declara os dois tipos que esta fase emite', () => {
    expect(APPROVAL_TYPES).toEqual(['edital_structure', 'concept_merge']);
  });
});
