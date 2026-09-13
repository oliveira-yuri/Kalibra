import { describe, it, expect } from 'vitest';
import { canTransition, nextActionFor, WORKSPACE_STATUS_LABELS } from './status';

describe('transições de status', () => {
  it('permite sair de sem_edital para aguardando_upload', () => {
    expect(canTransition('sem_edital', 'aguardando_upload')).toBe(true);
  });

  it('permite o caminho feliz completo', () => {
    expect(canTransition('aguardando_upload', 'extraindo_edital')).toBe(true);
    expect(canTransition('extraindo_edital', 'aguardando_revisao_edital')).toBe(true);
    expect(canTransition('aguardando_revisao_edital', 'diagnostico_pendente')).toBe(true);
    expect(canTransition('diagnostico_pendente', 'diagnostico_em_andamento')).toBe(true);
    expect(canTransition('diagnostico_em_andamento', 'plano_quinzenal_pendente')).toBe(true);
    expect(canTransition('plano_quinzenal_pendente', 'estudando')).toBe(true);
  });

  it('recusa pular o diagnóstico obrigatório', () => {
    expect(canTransition('aguardando_revisao_edital', 'estudando')).toBe(false);
    expect(canTransition('diagnostico_pendente', 'estudando')).toBe(false);
  });

  it('permite cair em erro a partir de qualquer estado de processamento', () => {
    expect(canTransition('extraindo_edital', 'erro')).toBe(true);
    expect(canTransition('aguardando_upload', 'erro')).toBe(true);
  });

  it('permite retomar de erro para o upload', () => {
    expect(canTransition('erro', 'aguardando_upload')).toBe(true);
  });

  it('recusa transição para o próprio estado', () => {
    expect(canTransition('estudando', 'estudando')).toBe(false);
  });

  it('permite reabrir o edital estando em estudo', () => {
    expect(canTransition('estudando', 'aguardando_upload')).toBe(true);
  });
});

describe('próximo passo por status', () => {
  it('dá um texto para cada status, sem placeholder', () => {
    const statuses = Object.keys(WORKSPACE_STATUS_LABELS) as Array<keyof typeof WORKSPACE_STATUS_LABELS>;
    expect(statuses).toHaveLength(9);
    for (const status of statuses) {
      const action = nextActionFor(status);
      expect(action.length).toBeGreaterThan(0);
      expect(action).not.toMatch(/TODO|TBD/);
    }
  });

  it('pede o edital quando não há edital', () => {
    expect(nextActionFor('sem_edital')).toBe('Importar edital ou cadastrar manualmente');
  });

  it('pede o diagnóstico quando ele está pendente', () => {
    expect(nextActionFor('diagnostico_pendente')).toBe('Fazer o diagnóstico inicial');
  });
});
