import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { inject } from 'vitest';
import { ligarNaApi, desligarDaApi, semearWorkspace, lerWorkspace, listarWorkspaces } from './api-de-teste';

/**
 * A ponte entre os testes de tela e o `api-server` compartilhado.
 *
 * Existe porque, se ela quebrar, os testes de tela falhariam por um motivo que não
 * tem nada a ver com o que eles afirmam — e a saída diria "a tela está errada"
 * quando o errado seria o encanamento.
 */
beforeAll(() => { ligarNaApi('ponte-usuario-a'); });
afterAll(() => { desligarDaApi(); });

describe('a ponte fala com o servidor de verdade', () => {
  it('semeia e relê um workspace', async () => {
    await semearWorkspace({ title: 'Concurso da ponte' });
    const lido = await lerWorkspace('concurso-da-ponte');
    expect(lido?.title).toBe('Concurso da ponte');
    // O status veio computado pelo servidor, não posto pelo teste.
    expect(lido?.status).toBe('sem_edital');
    expect(lido?.nextAction).toBeTruthy();
  });

  it('o isolamento entre arquivos é o do produto: outro usuário não vê', async () => {
    // Sem isto, um servidor compartilhado seria um estado global disfarçado, e
    // dois arquivos de teste rodando em paralelo se atrapalhariam.
    ligarNaApi('ponte-usuario-b');
    try {
      expect(await lerWorkspace('concurso-da-ponte')).toBeNull();
      expect(await listarWorkspaces()).toEqual([]);
    } finally {
      ligarNaApi('ponte-usuario-a');
    }
  });

  it('sobrevive a um AbortSignal do jsdom — o do React Query', async () => {
    // A incompatibilidade que travou o Bloco D: o React Query passa um
    // `AbortSignal` criado pelo jsdom, e o `fetch` do Node recusa. A ponte o
    // descarta.
    //
    // A primeira tentativa de consertar usou `signal instanceof
    // globalThis.AbortSignal` e não funcionou — sob jsdom aquele É o do jsdom, e a
    // checagem sempre passava. Este teste existe para que a correção não volte a
    // ser aquela.
    const controle = new AbortController();
    const r = await globalThis.fetch(`${inject('apiBaseUrl')}/api/workspaces`, {
      signal: controle.signal,
      headers: { 'content-type': 'application/json' },
    });
    expect(r.status).toBe(200);
  });
});
