import { describe, it, expect } from 'vitest';
import { WORKSPACE_STATUSES } from './status';
import {
  IMPORT_STATUSES,
  importStatusFor,
  statusFromImport,
} from './import-status';

describe('importStatus é derivado do status, nunca guardado', () => {
  it('todo WorkspaceStatus tem tradução — a função é total', () => {
    // A garantia real é o `Record<WorkspaceStatus, ImportStatus>`, que o
    // compilador recusa se ficar incompleto. Este teste pega o caso que o
    // compilador não pega: um `as` ou um `switch` com `default` que aceitasse o
    // status novo em silêncio.
    expect(WORKSPACE_STATUSES.length).toBeGreaterThan(0);
    for (const status of WORKSPACE_STATUSES) {
      expect(IMPORT_STATUSES).toContain(importStatusFor(status));
    }
  });

  it('ida e volta a partir da importação preserva o valor', () => {
    // Não é bijeção — nove status viram quatro importStatus. O que tem de valer é
    // esta direção: se a importação diz `parsing`, o status que ela implica tem de
    // voltar a dizer `parsing`. Sem isso, gravar por um caminho e ler pelo outro
    // mudaria o valor sem ninguém tocar em nada.
    expect(IMPORT_STATUSES.length).toBe(4);
    for (const importStatus of IMPORT_STATUSES) {
      expect(importStatusFor(statusFromImport(importStatus))).toBe(importStatus);
    }
  });

  it('completed leva a diagnóstico pendente, nunca a estudando', () => {
    // `completed` diz que a EXTRAÇÃO terminou, não que o aluno está estudando. O
    // caminho até `estudando` passa por diagnóstico e plano quinzenal; encurtá-lo
    // aqui faria a interface anunciar um progresso que não aconteceu.
    expect(statusFromImport('completed')).toBe('diagnostico_pendente');
  });

  it('um workspace sem edital relata importação pendente, não concluída', () => {
    expect(importStatusFor('sem_edital')).toBe('pending');
    expect(importStatusFor('aguardando_upload')).toBe('pending');
  });

  it('erro é o único status que relata falha de importação', () => {
    const queRelatamErro = WORKSPACE_STATUSES.filter((s) => importStatusFor(s) === 'error');
    expect(queRelatamErro).toEqual(['erro']);
  });
});
