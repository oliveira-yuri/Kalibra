import { describe, it, expect } from 'vitest';
import { migrateWorkspace } from './workspaces';

const ANTIGO = {
  slug: 'setec-campinas',
  title: 'Concurso SETEC Campinas',
  type: 'Concurso Público',
  institution: 'SETEC',
  examDate: '2026-01-17',
  cargos: [{ id: 'c1', name: 'Analista Técnico (Informática)', examDate: '2027-01-17', period: 'A' }],
  selectedCargoId: 'c1',
  progress: 47.2,
  nextAction: 'Resolver 8 questões de porcentagem',
  active: true,
  sourceMode: 'text',
  importStatus: 'completed',
};

describe('migração de workspace', () => {
  it('preserva os campos que já existiam', () => {
    const migrado = migrateWorkspace(ANTIGO);
    expect(migrado?.slug).toBe('setec-campinas');
    expect(migrado?.title).toBe('Concurso SETEC Campinas');
    expect(migrado?.institution).toBe('SETEC');
    expect(migrado?.cargos).toHaveLength(1);
    expect(migrado?.selectedCargoId).toBe('c1');
  });

  it('traduz importStatus completed para um status real', () => {
    expect(migrateWorkspace(ANTIGO)?.status).toBe('estudando');
  });

  it('traduz importStatus pending para aguardando revisão', () => {
    expect(migrateWorkspace({ ...ANTIGO, importStatus: 'pending' })?.status).toBe('aguardando_revisao_edital');
  });

  it('traduz importStatus error para erro', () => {
    expect(migrateWorkspace({ ...ANTIGO, importStatus: 'error' })?.status).toBe('erro');
  });

  it('dá disponibilidade vazia a quem não tinha', () => {
    const migrado = migrateWorkspace(ANTIGO);
    expect(migrado?.availability.days).toHaveLength(7);
    expect(migrado?.availability.maxSessionMinutes).toBe(50);
  });

  it('marca hasEdital a partir da origem antiga', () => {
    expect(migrateWorkspace(ANTIGO)?.hasEdital).toBe(true);
    expect(migrateWorkspace({ ...ANTIGO, sourceMode: undefined, importStatus: 'pending' })?.hasEdital).toBe(false);
  });

  it('dá um cargo padrão a quem não tinha nenhum', () => {
    const migrado = migrateWorkspace({ ...ANTIGO, cargos: undefined, selectedCargoId: undefined });
    expect(migrado?.cargos).toHaveLength(1);
    expect(migrado?.cargos[0].name).toBe('Cargo único');
    expect(migrado?.selectedCargoId).toBe(migrado?.cargos[0].id);
  });

  it('não altera um registro já no formato novo', () => {
    const novo = migrateWorkspace(ANTIGO)!;
    expect(migrateWorkspace(novo)).toEqual(novo);
  });

  it('devolve null para lixo', () => {
    expect(migrateWorkspace(null)).toBeNull();
    expect(migrateWorkspace({})).toBeNull();
    expect(migrateWorkspace({ slug: 'x' })).toBeNull();
    expect(migrateWorkspace('string')).toBeNull();
  });
});
