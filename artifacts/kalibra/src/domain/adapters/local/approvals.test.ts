import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ApprovalItem, Concept } from '@workspace/core';
import {
  migrateApprovalItem,
  getApprovals,
  saveApprovals,
  buildApprovalItem,
  applyDecision,
  applyApprovalSideEffects,
  useApprovals,
} from './approvals';
import { getConcepts, saveConcepts } from './concepts';

const ITEM: ApprovalItem = {
  id: 'appr-1',
  workspaceId: 'setec-campinas',
  type: 'edital_structure',
  status: 'pendente',
  title: 'Estrutura do edital identificada',
  rationale: 'Extração automática do texto colado',
  sourceRef: null,
  targetConceptId: null,
  confidence: 0.8,
  payloadBefore: null,
  payloadAfter: { entries: [] },
  createdAt: '2026-01-01T00:00:00.000Z',
  decidedAt: null,
  reason: null,
};

describe('migração de item da fila de aprovação', () => {
  it('devolve null para lixo que não é objeto', () => {
    expect(migrateApprovalItem(null)).toBeNull();
    expect(migrateApprovalItem(42)).toBeNull();
    expect(migrateApprovalItem('texto')).toBeNull();
    expect(migrateApprovalItem([])).toBeNull();
  });

  it('devolve null quando falta id', () => {
    expect(migrateApprovalItem({ ...ITEM, id: undefined })).toBeNull();
  });

  it('devolve null quando o tipo não é reconhecido (fase não emite esse tipo ainda)', () => {
    expect(migrateApprovalItem({ ...ITEM, type: 'plano_quinzenal' })).toBeNull();
    expect(migrateApprovalItem({ ...ITEM, type: 42 })).toBeNull();
  });

  it('cai em pendente quando o status é desconhecido ou tem tipo errado', () => {
    expect(migrateApprovalItem({ ...ITEM, status: 'inventado' })?.status).toBe('pendente');
    expect(migrateApprovalItem({ ...ITEM, status: 42 })?.status).toBe('pendente');
  });

  it('preserva um item já no formato atual', () => {
    expect(migrateApprovalItem(ITEM)).toEqual(ITEM);
  });

  it('é idempotente', () => {
    const primeiro = migrateApprovalItem(ITEM);
    expect(migrateApprovalItem(primeiro)).toEqual(primeiro);
  });

  it('descarta objeto com as chaves certas mas tipos de valor errados', () => {
    const migrado = migrateApprovalItem({
      ...ITEM,
      title: 42,
      rationale: true,
      sourceRef: 7,
      targetConceptId: 9,
      confidence: 'alta',
      createdAt: 123,
      decidedAt: 9,
      reason: {},
    });
    expect(migrado).not.toBeNull();
    expect(migrado?.title).toBe('');
    expect(migrado?.rationale).toBe('');
    expect(migrado?.sourceRef).toBeNull();
    expect(migrado?.targetConceptId).toBeNull();
    expect(migrado?.confidence).toBeNull();
    expect(migrado?.createdAt).toBe('');
    expect(migrado?.decidedAt).toBeNull();
    expect(migrado?.reason).toBeNull();
  });

  it('preserva payloadBefore/payloadAfter como estão, sejam quais forem', () => {
    expect(migrateApprovalItem({ ...ITEM, payloadBefore: { a: 1 }, payloadAfter: [1, 2] }))
      .toMatchObject({ payloadBefore: { a: 1 }, payloadAfter: [1, 2] });
  });
});

describe('getApprovals — um item corrompido não pode derrubar os outros', () => {
  const KEY = 'kalibra_approvals:anonymous';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('devolve lista vazia quando não há nada salvo', () => {
    expect(getApprovals()).toEqual([]);
  });

  it('faz o round-trip de salvar e ler', () => {
    saveApprovals([ITEM]);
    expect(getApprovals()).toEqual([ITEM]);
  });

  it('namespacea a chave por usuário', () => {
    saveApprovals([ITEM], 'user-1');
    expect(localStorage.getItem('kalibra_approvals:user-1')).not.toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('mantém os itens válidos quando um registro é lixo irreconhecível', () => {
    localStorage.setItem(KEY, JSON.stringify([ITEM, { lixo: true }, null, 42]));
    expect(() => getApprovals()).not.toThrow();
    expect(getApprovals().map((item) => item.id)).toEqual(['appr-1']);
  });

  it('nunca lança para JSON corrompido e devolve lista vazia', () => {
    localStorage.setItem(KEY, 'não é json{{{');
    expect(() => getApprovals()).not.toThrow();
    expect(getApprovals()).toEqual([]);
  });
});

describe('buildApprovalItem (enqueue)', () => {
  const NOW = new Date('2026-02-01T10:00:00.000Z');
  const INPUT: Omit<ApprovalItem, 'id' | 'status' | 'createdAt' | 'decidedAt' | 'reason'> = {
    workspaceId: 'setec-campinas',
    type: 'concept_merge',
    title: 'Possível fusão de conceitos',
    rationale: 'Similaridade acima do limiar de proposta',
    sourceRef: null,
    targetConceptId: null,
    confidence: 0.75,
    payloadBefore: null,
    payloadAfter: null,
  };

  it('nasce pendente, com createdAt carimbado por `now` e sem decisão', () => {
    const item = buildApprovalItem(INPUT, NOW);
    expect(item.status).toBe('pendente');
    expect(item.createdAt).toBe(NOW.toISOString());
    expect(item.decidedAt).toBeNull();
    expect(item.reason).toBeNull();
    expect(item.id.length).toBeGreaterThan(0);
  });

  it('gera ids diferentes em chamadas diferentes', () => {
    const a = buildApprovalItem(INPUT, NOW);
    const b = buildApprovalItem(INPUT, NOW);
    expect(a.id).not.toBe(b.id);
  });
});

describe('applyDecision', () => {
  const NOW = new Date('2026-02-01T12:00:00.000Z');

  it('aprovar move para aprovado e carimba decidedAt', () => {
    const [decidido] = applyDecision([ITEM], ITEM.id, 'aprovado', NOW);
    expect(decidido.status).toBe('aprovado');
    expect(decidido.decidedAt).toBe(NOW.toISOString());
    expect(decidido.reason).toBeNull();
  });

  it('rejeitar guarda o motivo', () => {
    const [decidido] = applyDecision([ITEM], ITEM.id, 'rejeitado', NOW, 'Conteúdo já coberto por outro item');
    expect(decidido.status).toBe('rejeitado');
    expect(decidido.reason).toBe('Conteúdo já coberto por outro item');
  });

  it('decidir sobre um item já decidido (revisando é o único estado ainda decidível) não muda nada', () => {
    const jaDecidido: ApprovalItem = { ...ITEM, status: 'aprovado', decidedAt: '2025-12-31T00:00:00.000Z' };
    const [resultado] = applyDecision([jaDecidido], jaDecidido.id, 'rejeitado', NOW, 'tentativa tardia');
    expect(resultado).toEqual(jaDecidido);
  });

  it('permite decidir um item em revisando', () => {
    const emRevisao: ApprovalItem = { ...ITEM, status: 'revisando' };
    const [decidido] = applyDecision([emRevisao], emRevisao.id, 'aprovado', NOW);
    expect(decidido.status).toBe('aprovado');
  });

  it('não afeta itens com outro id', () => {
    const outro: ApprovalItem = { ...ITEM, id: 'appr-2' };
    const resultado = applyDecision([ITEM, outro], ITEM.id, 'aprovado', NOW);
    expect(resultado[1]).toEqual(outro);
  });
});

describe('applyApprovalSideEffects — achado 2 da revisão: aprovar concept_merge confirma o conceito', () => {
  const CONCEPT: Concept = {
    id: 'concept-x',
    canonicalName: 'Matemática financeira',
    slug: 'matematica-financeira',
    parentId: null,
    kind: 'topico',
    aliases: [],
    status: 'provisional',
  };

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('promove o conceito referenciado por targetConceptId a confirmed quando o item aprovado é concept_merge', () => {
    saveConcepts([CONCEPT]);
    const decidido: ApprovalItem = {
      ...ITEM, type: 'concept_merge', status: 'aprovado', targetConceptId: 'concept-x',
    };

    applyApprovalSideEffects(decidido);

    expect(getConcepts().find((c) => c.id === 'concept-x')?.status).toBe('confirmed');
  });

  it('não confirma nada quando o tipo é edital_structure', () => {
    saveConcepts([CONCEPT]);
    const decidido: ApprovalItem = {
      ...ITEM, type: 'edital_structure', status: 'aprovado', targetConceptId: 'concept-x',
    };

    applyApprovalSideEffects(decidido);

    expect(getConcepts().find((c) => c.id === 'concept-x')?.status).toBe('provisional');
  });

  it('não confirma nada quando o item foi rejeitado, não aprovado', () => {
    saveConcepts([CONCEPT]);
    const decidido: ApprovalItem = {
      ...ITEM, type: 'concept_merge', status: 'rejeitado', targetConceptId: 'concept-x',
    };

    applyApprovalSideEffects(decidido);

    expect(getConcepts().find((c) => c.id === 'concept-x')?.status).toBe('provisional');
  });

  it('não lança quando targetConceptId é nulo', () => {
    const decidido: ApprovalItem = { ...ITEM, type: 'concept_merge', status: 'aprovado', targetConceptId: null };
    expect(() => applyApprovalSideEffects(decidido)).not.toThrow();
  });

  it('achado B: um targetConceptId que não corresponde a nenhum conceito deixa a loja intacta, deliberadamente', () => {
    saveConcepts([CONCEPT]);
    const decidido: ApprovalItem = {
      ...ITEM, type: 'concept_merge', status: 'aprovado', targetConceptId: 'concept-que-nao-existe',
    };

    applyApprovalSideEffects(decidido);

    // Nada lança, nada é logado como erro — é um no-op legítimo (o alvo pode
    // ter sido removido entre a proposta e a decisão), diferente do caso de
    // achado B em que um `sourceRef` de proveniência seria usado por engano
    // como alvo e o no-op aconteceria por acidente.
    expect(getConcepts()).toEqual([CONCEPT]);
  });
});

describe('useApprovals — duas escritas síncronas no mesmo tick sobrevivem ambas (achado 3 da revisão)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const INPUT: Omit<ApprovalItem, 'id' | 'status' | 'createdAt' | 'decidedAt' | 'reason'> = {
    workspaceId: 'setec-campinas',
    type: 'edital_structure',
    title: 'Proposta',
    rationale: 'motivo',
    sourceRef: null,
    confidence: null,
    payloadBefore: null,
    payloadAfter: null,
  };

  it('duas chamadas de enqueue dentro do mesmo act() persistem os dois itens', () => {
    const { result } = renderHook(() => useApprovals());

    act(() => {
      result.current.enqueue({ ...INPUT, title: 'Primeira' }, new Date('2026-01-01T00:00:00.000Z'));
      result.current.enqueue({ ...INPUT, title: 'Segunda' }, new Date('2026-01-01T00:00:00.000Z'));
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.map((item) => item.title)).toEqual(['Primeira', 'Segunda']);
    expect(getApprovals()).toHaveLength(2);
  });

  it('enqueue seguido de approve no mesmo tick não perde a aprovação', () => {
    const { result } = renderHook(() => useApprovals());
    let id = '';

    act(() => {
      id = result.current.enqueue(INPUT, new Date('2026-01-01T00:00:00.000Z'));
    });

    act(() => {
      result.current.approve(id);
    });

    expect(result.current.items.find((item) => item.id === id)?.status).toBe('aprovado');
  });
});
