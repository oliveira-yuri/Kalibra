import { describe, it, expect } from 'vitest';
import { canTransition, nextActionFor, WORKSPACE_STATUS_LABELS, WORKSPACE_STATUSES, type WorkspaceStatus, initialStatus, assertTransition } from './status';

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

describe('WORKSPACE_STATUSES — regressão I4 (não pode ser uma lista mantida à mão)', () => {
  it('contém exatamente as chaves de WORKSPACE_STATUS_LABELS, na mesma ordem', () => {
    expect(WORKSPACE_STATUSES).toEqual(Object.keys(WORKSPACE_STATUS_LABELS));
  });

  it('cobre todo o union WorkspaceStatus, sem faltar nem sobrar nenhum membro', () => {
    // Lista fixa aqui de propósito: é a única fonte de verdade "escrita à mão" que
    // sobra no sistema, e existe só para travar o teste se alguém reintroduzir uma
    // lista manual solta em algum outro lugar sem atualizar `WorkspaceStatus`.
    const uniao: WorkspaceStatus[] = [
      'sem_edital',
      'aguardando_upload',
      'extraindo_edital',
      'aguardando_revisao_edital',
      'diagnostico_pendente',
      'diagnostico_em_andamento',
      'plano_quinzenal_pendente',
      'estudando',
      'erro',
    ];
    expect(new Set(WORKSPACE_STATUSES)).toEqual(new Set(uniao));
    expect(WORKSPACE_STATUSES).toHaveLength(uniao.length);
  });

  it('não tem duplicatas', () => {
    expect(new Set(WORKSPACE_STATUSES).size).toBe(WORKSPACE_STATUSES.length);
  });
});

describe('estado inicial', () => {
  it('workspace com edital começa aguardando upload', () => {
    expect(initialStatus(true)).toBe('aguardando_upload');
  });

  it('workspace sem edital começa sem edital', () => {
    expect(initialStatus(false)).toBe('sem_edital');
  });

  it('o caminho real da criação com edital é válido de ponta a ponta', () => {
    const caminho = [
      initialStatus(true),
      'extraindo_edital',
      'aguardando_revisao_edital',
      'diagnostico_pendente',
    ] as const;
    for (let i = 0; i < caminho.length - 1; i += 1) {
      expect(canTransition(caminho[i], caminho[i + 1])).toBe(true);
    }
  });

  it('o caminho real da criação sem edital é válido', () => {
    expect(canTransition(initialStatus(false), 'aguardando_upload')).toBe(true);
  });
});

describe('transição obrigatória', () => {
  it('não lança para transição válida', () => {
    expect(() => assertTransition('aguardando_upload', 'extraindo_edital')).not.toThrow();
  });

  it('lança com mensagem em português para transição inválida', () => {
    expect(() => assertTransition('sem_edital', 'estudando')).toThrow(
      'Transição inválida de "sem edital" para "estudando".',
    );
  });

  it('lança ao tentar pular o diagnóstico obrigatório', () => {
    expect(() => assertTransition('aguardando_revisao_edital', 'estudando')).toThrow();
  });
});
