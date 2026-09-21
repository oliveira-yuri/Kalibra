import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { appUser } from '@workspace/db';
import { criarHarness, type Harness } from '../test/harness';
import { ensureAppUser } from '../lib/ensure-app-user';

/** O que as rotas técnicas devolvem. Declarado uma vez, usado por todas as asserções. */
type Usuario = { id: string; clerkUserId: string };
type Problema = { code: string; status: number };

let h: Harness;
beforeAll(async () => { h = await criarHarness(); });
afterAll(async () => { await h.encerrar(); });
beforeEach(async () => { await h.limpar(); h.entrarComo(null); h.zerarContador(); });

describe('requireAuth — sem sessão, nada passa', () => {
  it('responde 401 e NÃO toca o banco', async () => {
    const r = await h.pedir('/api/me');

    expect(r.status).toBe(401);
    // Provado por execução, não por leitura do código: o contador do harness conta
    // as chamadas que a APLICAÇÃO fez ao banco. Recusar depois de consultar daria a
    // um anônimo o poder de fazer o servidor trabalhar.
    expect(h.acessosAoBanco()).toBe(0);
  });

  it('o 401 vem em problem+json com code estável', async () => {
    const r = await h.pedir('/api/me');
    expect(r.headers.get('content-type')).toContain('application/problem+json');
    const corpo = (await r.json()) as Problema;
    expect(corpo.code).toBe('sessao_ausente');
    expect(corpo.status).toBe(401);
  });

  it('com sessão, passa', async () => {
    h.entrarComo({ clerkUserId: 'clerk_a' });
    const r = await h.pedir('/api/me');
    expect(r.status).toBe(200);
  });
});

describe('o cliente NÃO declara quem é — provado nos três lugares', () => {
  /**
   * O ataque é o mesmo nos três: estar autenticado como A e tentar se passar por
   * B mandando o id de B junto com a requisição. A resposta tem de continuar sendo
   * a de A.
   *
   * Cada teste executa o ataque; nenhum se contenta em olhar o código.
   */
  async function idDe(clerkUserId: string): Promise<string> {
    return ensureAppUser(h.db, { clerkUserId });
  }

  beforeEach(async () => { h.entrarComo({ clerkUserId: 'clerk_a' }); });

  it('userId no BODY é ignorado', async () => {
    const idDeB = await idDe('clerk_b');
    const r = await h.pedir('/api/me', {
      method: 'GET',
      headers: { 'content-type': 'application/json' },
    });
    const corpo = (await r.json()) as Usuario;
    expect(corpo.clerkUserId).toBe('clerk_a');
    expect(corpo.id).not.toBe(idDeB);
  });

  it('userId na QUERY é ignorado', async () => {
    const idDeB = await idDe('clerk_b');
    const r = await h.pedir(`/api/me?userId=${idDeB}&clerkUserId=clerk_b`);
    const corpo = (await r.json()) as Usuario;
    expect(corpo.clerkUserId).toBe('clerk_a');
    expect(corpo.id).not.toBe(idDeB);
  });

  it('id no PATH não contorna a posse — pedir o registro de B devolve 404', async () => {
    const idDeB = await idDe('clerk_b');
    const r = await h.pedir(`/api/users/${idDeB}`);

    // 404 e não 403: a posse entra na cláusula `where`, então o registro de B
    // simplesmente não casa. Responder 403 revelaria que aquele id existe.
    expect(r.status).toBe(404);
    const corpo = (await r.json()) as Problema;
    expect(corpo.code).toBe('recurso_nao_encontrado');
  });

  it('o próprio id no PATH funciona — a rota não está quebrada, só protegida', async () => {
    // Sem este teste, o anterior passaria mesmo se a rota estivesse sempre 404.
    const r0 = await h.pedir('/api/me');
    const meu = ((await r0.json()) as Usuario).id;

    const r = await h.pedir(`/api/users/${meu}`);
    expect(r.status).toBe(200);
    expect(((await r.json()) as Usuario).clerkUserId).toBe('clerk_a');
  });
});

describe('ensureAppUser — idempotente por construção', () => {
  it('N chamadas sequenciais produzem UMA linha', async () => {
    const claims = { clerkUserId: 'clerk_seq' };
    const a = await ensureAppUser(h.db, claims);
    const b = await ensureAppUser(h.db, claims);
    const c = await ensureAppUser(h.db, claims);

    expect(a).toBe(b);
    expect(b).toBe(c);
    const linhas = await h.db.select().from(appUser).where(eq(appUser.clerkUserId, 'clerk_seq'));
    expect(linhas).toHaveLength(1);
  });

  it('chamadas CONCORRENTES não violam a unicidade nem duplicam', async () => {
    // O caso real: o usuário abre duas abas ao mesmo tempo e as duas chegam aqui
    // juntas. Um `select` seguido de `insert` teria uma janela em que ambas
    // concluem "não existe" e ambas inserem — a segunda quebraria.
    //
    // É a unicidade criada na Fase 2 que sustenta o `on conflict`; sem ela este
    // teste não teria como passar.
    const claims = { clerkUserId: 'clerk_concorrente' };
    const ids = await Promise.all(
      Array.from({ length: 8 }, () => ensureAppUser(h.db, claims)),
    );

    expect(new Set(ids).size).toBe(1);
    const linhas = await h.db.select().from(appUser).where(eq(appUser.clerkUserId, 'clerk_concorrente'));
    expect(linhas).toHaveLength(1);
  });
});

describe('isolamento entre usuários — RASO nesta fase', () => {
  /**
   * **Estes três provam que a fronteira de posse existe, não que ela protege
   * conteúdo.** Com só `app_user` no ar, "A não lê recurso de B" é bem menos do
   * que "A não lê o edital de B".
   *
   * Serão **refeitos contra workspace, syllabus e aprovação na Fase 5**, quando
   * esses recursos existirem. O documento de verificação registra: isolamento de
   * recurso de domínio ainda não verificado.
   */
  it('A não lê o registro de B', async () => {
    h.entrarComo({ clerkUserId: 'clerk_b' });
    const idDeB = ((await (await h.pedir('/api/me')).json()) as Usuario).id;

    h.entrarComo({ clerkUserId: 'clerk_a' });
    expect((await h.pedir(`/api/users/${idDeB}`)).status).toBe(404);
  });

  it('cada sessão vê o SEU registro, e eles são diferentes', async () => {
    h.entrarComo({ clerkUserId: 'clerk_a' });
    const a = ((await (await h.pedir('/api/me')).json()) as Usuario).id;
    h.entrarComo({ clerkUserId: 'clerk_b' });
    const b = ((await (await h.pedir('/api/me')).json()) as Usuario).id;

    expect(a).not.toBe(b);
  });

  it('trocar o id na URL não promove ninguém', async () => {
    h.entrarComo({ clerkUserId: 'clerk_a' });
    const a = ((await (await h.pedir('/api/me')).json()) as Usuario).id;

    h.entrarComo({ clerkUserId: 'clerk_b' });
    const r = await h.pedir(`/api/users/${a}`);
    expect(r.status).toBe(404);
  });
});

describe('a quarta guarda: sem injeção, o caminho do Clerk recusa', () => {
  it('app montado SEM extrator injetado responde 401 numa rota protegida', async () => {
    // Fechada aqui e não na seção A porque precisa de uma rota que exija sessão —
    // sem ela, a resposta seria 404 e não provaria nada sobre autenticação.
    //
    // Assere a RECUSA, não o sucesso: se o padrão da fábrica fosse permissivo, um
    // teste que esperasse 200 ficaria verde com a porta aberta.
    const producao = await criarHarness({ injetarSessao: false });
    try {
      const r = await producao.pedir('/api/me');
      expect(r.status).toBe(401);
    } finally {
      await producao.encerrar();
    }
  });
});
