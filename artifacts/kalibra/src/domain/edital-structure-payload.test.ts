import { describe, it, expect } from 'vitest';
import type { ApprovalItem } from '@workspace/core';
import {
  versionFromPayload, versionNumberFromPayload, nextSyllabusVersion, comparedSyllabusVersion,
} from './edital-structure-payload';

const structure = (
  id: string, workspaceId: string | null, version: unknown, status: ApprovalItem['status'] = 'pendente',
): ApprovalItem => ({
  id,
  workspaceId,
  type: 'edital_structure',
  status,
  title: '',
  rationale: '',
  sourceRef: null,
  targetConceptId: null,
  confidence: null,
  payloadBefore: null,
  payloadAfter: { version },
  createdAt: '2026-09-14T00:00:00.000Z',
  decidedAt: null,
  reason: null,
});

const merge = (id: string, workspaceId: string): ApprovalItem => ({
  ...structure(id, workspaceId, '9'),
  type: 'concept_merge',
});

describe('versionNumberFromPayload', () => {
  it('lê uma versão em texto ou em número', () => {
    expect(versionNumberFromPayload({ version: '3' })).toBe(3);
    expect(versionNumberFromPayload({ version: 3 })).toBe(3);
  });

  it('cai no mesmo fallback de `versionFromPayload` quando não há versão', () => {
    expect(versionFromPayload(null)).toBe('1');
    expect(versionNumberFromPayload(null)).toBe(1);
    expect(versionNumberFromPayload({})).toBe(1);
  });

  it('recusa o que não é inteiro positivo em vez de inventar ordem', () => {
    expect(versionNumberFromPayload({ version: 'abc' })).toBeNull();
    expect(versionNumberFromPayload({ version: '0' })).toBeNull();
    expect(versionNumberFromPayload({ version: '-2' })).toBeNull();
  });
});

describe('nextSyllabusVersion — achados C1 e R2 (a versão é lida da realidade, não contada)', () => {
  it('sem nada real, a primeira importação é a versão 1', () => {
    expect(nextSyllabusVersion([], 'w', false)).toBe(1);
  });

  it('achado R1: um programa já salvo ocupa a versão 1 mesmo sem item nenhum na fila', () => {
    expect(nextSyllabusVersion([], 'w', true)).toBe(2);
  });

  it('achado C1: uma proposta pendente continua ocupando o número dela', () => {
    expect(nextSyllabusVersion([structure('a', 'w', '2')], 'w', true)).toBe(3);
  });

  it('achado R2: chamar de novo sem nada ter virado real devolve o MESMO número', () => {
    // É o que distingue "ler a realidade" de "incrementar um contador": uma tentativa
    // abandonada antes de chegar à fila não queima número nenhum.
    const fila: ApprovalItem[] = [];
    expect(nextSyllabusVersion(fila, 'w', false)).toBe(1);
    expect(nextSyllabusVersion(fila, 'w', false)).toBe(1);
  });

  it('itens decididos também ocupam o número deles', () => {
    const fila = [structure('a', 'w', '1', 'aprovado'), structure('b', 'w', '4', 'rejeitado')];
    expect(nextSyllabusVersion(fila, 'w', true)).toBe(5);
  });

  it('ignora outro workspace e outro tipo de item', () => {
    expect(nextSyllabusVersion([structure('a', 'outro', '9'), merge('b', 'w')], 'w', false)).toBe(1);
  });

  it('um payload sem versão reconhecível não desloca a contagem', () => {
    expect(nextSyllabusVersion([structure('a', 'w', 'abc')], 'w', false)).toBe(1);
  });
});

describe('comparedSyllabusVersion — achado R2 (o rótulo nomeia uma versão que existiu)', () => {
  it('sem programa salvo, não há com o que comparar', () => {
    expect(comparedSyllabusVersion([], 'w', 2, false)).toBeNull();
  });

  it('com programa salvo e nenhuma aprovação registrada, a comparação é com a versão 1', () => {
    // Programa anterior à fila (semeado, ou de uma fase anterior): ele É a versão 1.
    expect(comparedSyllabusVersion([], 'w', 2, true)).toBe(1);
  });

  it('nomeia a maior versão APROVADA, nunca "a atual menos 1"', () => {
    const fila = [
      structure('a', 'w', '1', 'aprovado'),
      structure('b', 'w', '2', 'pendente'), // abandonada: nunca escreveu programa nenhum
      structure('c', 'w', '3', 'pendente'), // a que está sendo revisada agora
    ];
    expect(comparedSyllabusVersion(fila, 'w', 3, true)).toBe(1);
  });

  it('nunca nomeia a própria versão atual', () => {
    const fila = [structure('a', 'w', '2', 'aprovado')];
    expect(comparedSyllabusVersion(fila, 'w', 2, true)).toBe(1);
  });

  it('uma rejeição não conta como versão que escreveu o programa', () => {
    const fila = [structure('a', 'w', '1', 'aprovado'), structure('b', 'w', '2', 'rejeitado')];
    expect(comparedSyllabusVersion(fila, 'w', 3, true)).toBe(1);
  });
});
