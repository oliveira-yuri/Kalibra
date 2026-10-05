import { describe, it, expect } from 'vitest';
import { WORKSPACE_STATUSES, emptyAvailability, nextActionFor } from '@workspace/core';
import type { WorkspaceStatus } from '@workspace/core';
import { paraCorpoDeWorkspace } from './workspace-dto';

/**
 * Linha de `workspace` como o banco a devolve. Escrita à mão e não lida do banco
 * de propósito: estes testes são sobre a DERIVAÇÃO, e subir PGlite aqui só
 * tornaria mais lento o que já é pura função.
 */
function umaLinha(p: Partial<Parameters<typeof paraCorpoDeWorkspace>[0]> = {}) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    userId: '22222222-2222-2222-2222-222222222222',
    slug: 'concurso-teste',
    title: 'Concurso de teste',
    institution: 'Banca X',
    type: 'Concurso Público',
    examDate: '2027-03-01',
    availability: emptyAvailability(),
    status: 'sem_edital' as WorkspaceStatus,
    sourceMode: 'none' as const,
    sourceFileName: null,
    active: true,
    version: 1,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...p,
  };
}

function umCargo(p: Partial<Parameters<typeof paraCorpoDeWorkspace>[1][number]> = {}) {
  return {
    id: '33333333-3333-3333-3333-333333333333',
    workspaceId: '11111111-1111-1111-1111-111111111111',
    name: 'Cargo A',
    examDate: '2027-03-01',
    period: null,
    position: 0,
    isSelected: false,
    ...p,
  };
}

describe('nextAction é computado, nunca lido do banco', () => {
  it('todo WorkspaceStatus produz um nextAction não vazio', () => {
    // Exaustivo sobre `WORKSPACE_STATUSES`, que é exaustivo por construção. Um
    // status novo sem ação chegaria à interface como um card sem instrução —
    // defeito visível para o usuário e invisível para um teste por amostragem.
    expect(WORKSPACE_STATUSES.length).toBeGreaterThan(0);
    for (const status of WORKSPACE_STATUSES) {
      const corpo = paraCorpoDeWorkspace(umaLinha({ status }), []);
      expect(corpo.nextAction.length).toBeGreaterThan(0);
    }
  });

  it('é exatamente o que lib/core diz — não uma segunda tabela', () => {
    for (const status of WORKSPACE_STATUSES) {
      expect(paraCorpoDeWorkspace(umaLinha({ status }), []).nextAction)
        .toBe(nextActionFor(status));
    }
  });
});

describe('selectedCargoId vem de cargo.is_selected', () => {
  it('sem nenhum cargo selecionado é null', () => {
    const corpo = paraCorpoDeWorkspace(umaLinha(), [umCargo(), umCargo({ id: 'outro' })]);
    expect(corpo.selectedCargoId).toBeNull();
  });

  it('com um selecionado, é o id dele', () => {
    const corpo = paraCorpoDeWorkspace(umaLinha(), [
      umCargo({ id: 'c-a' }),
      umCargo({ id: 'c-b', isSelected: true }),
    ]);
    expect(corpo.selectedCargoId).toBe('c-b');
  });

  it('não é a posição nem o primeiro da lista', () => {
    // Sem esta, uma implementação que devolvesse `cargos[0].id` passaria no teste
    // anterior sempre que o selecionado fosse o primeiro.
    const corpo = paraCorpoDeWorkspace(umaLinha(), [
      umCargo({ id: 'c-primeiro', position: 0 }),
      umCargo({ id: 'c-segundo', position: 1, isSelected: true }),
    ]);
    expect(corpo.selectedCargoId).toBe('c-segundo');
  });
});

describe('importStatus é derivado do status', () => {
  it('sem edital relata pendente; estudando relata concluído', () => {
    expect(paraCorpoDeWorkspace(umaLinha({ status: 'sem_edital' }), []).importStatus)
      .toBe('pending');
    expect(paraCorpoDeWorkspace(umaLinha({ status: 'estudando' }), []).importStatus)
      .toBe('completed');
  });
});

describe('a resposta não inventa nem vaza campo', () => {
  it('não devolve progress', () => {
    // Devolver 0 pareceria medição. Quem decide o que mostrar sem diagnóstico é a
    // tela, e essa escolha tem de ficar visível no diff dela.
    const corpo = paraCorpoDeWorkspace(umaLinha(), []);
    expect(corpo).not.toHaveProperty('progress');
  });

  it('não devolve userId nem os ids internos do workspace', () => {
    // O cliente endereça workspace por `slug`. Expor `user_id` daria ao cliente um
    // identificador de posse que ele não deve conhecer nem precisar.
    const corpo = paraCorpoDeWorkspace(umaLinha(), []);
    expect(corpo).not.toHaveProperty('userId');
    expect(corpo).not.toHaveProperty('id');
  });

  it('os cargos saem ordenados por position, não pela ordem recebida', () => {
    const corpo = paraCorpoDeWorkspace(umaLinha(), [
      umCargo({ id: 'c-terceiro', position: 2 }),
      umCargo({ id: 'c-primeiro', position: 0 }),
      umCargo({ id: 'c-segundo', position: 1 }),
    ]);
    expect(corpo.cargos.map((c) => c.id)).toEqual(['c-primeiro', 'c-segundo', 'c-terceiro']);
  });

  it('os cargos não vazam workspaceId nem isSelected', () => {
    // `isSelected` já viaja como `selectedCargoId`; mandar os dois criaria duas
    // fontes para o mesmo fato, que é como elas começam a divergir.
    const corpo = paraCorpoDeWorkspace(umaLinha(), [umCargo({ isSelected: true })]);
    expect(corpo.cargos[0]).not.toHaveProperty('workspaceId');
    expect(corpo.cargos[0]).not.toHaveProperty('isSelected');
  });
});
