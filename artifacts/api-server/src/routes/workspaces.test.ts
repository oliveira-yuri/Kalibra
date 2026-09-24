import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { criarHarness, type Harness } from '../test/harness';

/**
 * As rotas de workspace, exercitadas por HTTP contra o app real.
 *
 * O que estes testes defendem não é "o endpoint responde": é que **posse, versão e
 * derivados** se comportam quando alguém tenta o contrário. Cada asserção de
 * sucesso tem, ao lado, a asserção de recusa que lhe dá sentido — sozinho, um
 * teste que espera 200 fica verde com a porta aberta.
 */

type Workspace = {
  slug: string;
  title: string;
  version: number;
  nextAction: string;
  importStatus: string;
  selectedCargoId: string | null;
  cargos: { id: string; name: string; position: number }[];
  status: string;
};
type Problema = { code: string; status: number };

let h: Harness;
beforeAll(async () => { h = await criarHarness(); });
afterAll(async () => { await h.encerrar(); });
beforeEach(async () => { await h.limpar(); h.entrarComo(null); h.zerarContador(); });

const json = (corpo: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(corpo),
});

async function criar(titulo: string, extra: Record<string, unknown> = {}) {
  const r = await h.pedir('/api/workspaces', json({ title: titulo, ...extra }));
  return { status: r.status, corpo: (await r.json()) as Workspace & Problema };
}

describe('GET /workspaces — só os do usuário da sessão', () => {
  it('sem sessão responde 401 e NÃO toca o banco', async () => {
    const r = await h.pedir('/api/workspaces');
    expect(r.status).toBe(401);
    // Provado por contagem de acessos, não por leitura do código: recusar depois
    // de consultar daria a um anônimo o poder de fazer o servidor trabalhar.
    expect(h.acessosAoBanco()).toBe(0);
  });

  it('usuário novo vê lista vazia — não herda os workspaces de ninguém', async () => {
    h.entrarComo({ clerkUserId: 'clerk_a' });
    const r = await h.pedir('/api/workspaces');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual([]);
  });

  it('cada usuário vê só os seus', async () => {
    h.entrarComo({ clerkUserId: 'clerk_a' });
    await criar('Concurso de A');
    h.entrarComo({ clerkUserId: 'clerk_b' });
    await criar('Concurso de B');

    const deB = (await (await h.pedir('/api/workspaces')).json()) as Workspace[];
    expect(deB.map((w) => w.title)).toEqual(['Concurso de B']);

    h.entrarComo({ clerkUserId: 'clerk_a' });
    const deA = (await (await h.pedir('/api/workspaces')).json()) as Workspace[];
    expect(deA.map((w) => w.title)).toEqual(['Concurso de A']);
  });
});

describe('GET /workspaces/{slug} — posse na cláusula, 404 e não 403', () => {
  it('o próprio workspace volta com os derivados computados', async () => {
    h.entrarComo({ clerkUserId: 'clerk_a' });
    const criado = await criar('Concurso de teste');

    const r = await h.pedir(`/api/workspaces/${criado.corpo.slug}`);
    expect(r.status).toBe(200);
    const w = (await r.json()) as Workspace;
    // Nenhum dos três foi enviado na criação: todos são computados.
    expect(w.nextAction.length).toBeGreaterThan(0);
    expect(w.importStatus).toBe('pending');
    expect(w.version).toBe(1);
  });

  it('o workspace de outro usuário responde 404, nunca 403', async () => {
    h.entrarComo({ clerkUserId: 'clerk_a' });
    const criado = await criar('Concurso de A');

    h.entrarComo({ clerkUserId: 'clerk_b' });
    const r = await h.pedir(`/api/workspaces/${criado.corpo.slug}`);

    // 403 confirmaria que aquele slug existe para alguém. 404 não diz nada.
    expect(r.status).toBe(404);
    expect(((await r.json()) as Problema).code).toBe('workspace_nao_encontrado');
  });
});

describe('POST /workspaces', () => {
  it('cria e deriva o slug do título', async () => {
    h.entrarComo({ clerkUserId: 'clerk_a' });
    const { status, corpo } = await criar('Concurso SETEC Campinas');
    expect(status).toBe(201);
    expect(corpo.slug).toBe('concurso-setec-campinas');
  });

  it('o status inicial é decidido por lib/core, não pelo cliente', async () => {
    h.entrarComo({ clerkUserId: 'clerk_a' });
    const semEdital = await criar('Sem edital');
    const comEdital = await criar('Com edital', { sourceMode: 'text' });

    expect(semEdital.corpo.status).toBe('sem_edital');
    expect(comEdital.corpo.status).toBe('aguardando_upload');
  });

  it('slug duplicado do MESMO usuário responde 409', async () => {
    h.entrarComo({ clerkUserId: 'clerk_a' });
    await criar('Concurso repetido');
    const segundo = await criar('Concurso repetido');

    expect(segundo.status).toBe(409);
    expect(segundo.corpo.code).toBe('slug_em_uso');
  });

  it('o MESMO slug para OUTRO usuário é aceito', async () => {
    // Sem esta, uma unicidade global passaria no teste anterior e quebraria o
    // produto: dois usuários não podem disputar o nome de um concurso público.
    h.entrarComo({ clerkUserId: 'clerk_a' });
    await criar('Concurso repetido');

    h.entrarComo({ clerkUserId: 'clerk_b' });
    const deB = await criar('Concurso repetido');
    expect(deB.status).toBe(201);
    expect(deB.corpo.slug).toBe('concurso-repetido');
  });

  it('o primeiro cargo nasce selecionado', async () => {
    h.entrarComo({ clerkUserId: 'clerk_a' });
    const { corpo } = await criar('Com cargos', {
      cargos: [{ name: 'Cargo A' }, { name: 'Cargo B' }],
    });
    expect(corpo.cargos).toHaveLength(2);
    expect(corpo.selectedCargoId).toBe(corpo.cargos[0].id);
  });

  it('progress também é recusado — descartar em silêncio não é recusar', async () => {
    // Achado do harness de contrato: `progress` não estava na lista, e o Zod o
    // descartava por ser chave desconhecida. Do lado do servidor descartar e
    // recusar parecem iguais; do lado do cliente são opostos.
    h.entrarComo({ clerkUserId: 'clerk_a' });
    const r = await h.pedir('/api/workspaces', json({ title: 'X', progress: 42 }));
    expect(r.status).toBe(400);
    expect(((await r.json()) as Problema).code).toBe('campo_derivado');
  });

  it('campo derivado enviado pelo cliente é RECUSADO, não ignorado', async () => {
    h.entrarComo({ clerkUserId: 'clerk_a' });
    const r = await h.pedir('/api/workspaces', json({ title: 'X', version: 7 }));

    // Ignorar em silêncio faria o cliente acreditar que escreveu.
    expect(r.status).toBe(400);
    expect(((await r.json()) as Problema).code).toBe('campo_derivado');
  });
});

describe('PATCH /workspaces/{slug} — If-Match', () => {
  async function umWorkspace() {
    h.entrarComo({ clerkUserId: 'clerk_a' });
    const { corpo } = await criar('Para editar');
    return corpo;
  }

  const patch = (corpo: unknown, ifMatch?: string): RequestInit => ({
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(ifMatch === undefined ? {} : { 'if-match': ifMatch }),
    },
    body: JSON.stringify(corpo),
  });

  it('sem If-Match responde 428', async () => {
    const w = await umWorkspace();
    const r = await h.pedir(`/api/workspaces/${w.slug}`, patch({ title: 'Novo' }));
    expect(r.status).toBe(428);
    expect(((await r.json()) as Problema).code).toBe('precondition_required');
  });

  it('com versão velha responde 412', async () => {
    const w = await umWorkspace();
    const r = await h.pedir(`/api/workspaces/${w.slug}`, patch({ title: 'Novo' }, '99'));
    expect(r.status).toBe(412);
    expect(((await r.json()) as Problema).code).toBe('precondition_failed');
  });

  it('com a versão certa altera e devolve a versão NOVA', async () => {
    const w = await umWorkspace();
    const r = await h.pedir(`/api/workspaces/${w.slug}`, patch({ title: 'Novo' }, String(w.version)));

    expect(r.status).toBe(200);
    const depois = (await r.json()) as Workspace;
    expect(depois.title).toBe('Novo');
    // Devolver a nova versão poupa o cliente de uma segunda leitura.
    expect(depois.version).toBe(w.version + 1);
  });

  it('DUAS ABAS com a mesma versão: a segunda falha', async () => {
    // O caso real que o mecanismo existe para cobrir. Sem ele, a segunda escrita
    // apagaria a primeira sem nada indicar que houve perda.
    const w = await umWorkspace();
    const versaoLidaPelasDuas = String(w.version);

    const primeira = await h.pedir(`/api/workspaces/${w.slug}`, patch({ title: 'Da aba 1' }, versaoLidaPelasDuas));
    expect(primeira.status).toBe(200);

    const segunda = await h.pedir(`/api/workspaces/${w.slug}`, patch({ title: 'Da aba 2' }, versaoLidaPelasDuas));
    expect(segunda.status).toBe(412);

    // E o que ficou gravado é o da primeira — a segunda não passou nem parcialmente.
    const atual = (await (await h.pedir(`/api/workspaces/${w.slug}`)).json()) as Workspace;
    expect(atual.title).toBe('Da aba 1');
  });

  it('DUAS REQUISIÇÕES CONCORRENTES com a mesma versão: exatamente uma vence', async () => {
    // O teste das duas abas acima é SEQUENCIAL, e a conferência em código já dá
    // conta dele. Este é o caso que só a comparação de versão dentro do `where`
    // resolve: as duas requisições leem a versão 1, as duas passam pela
    // conferência em código, e as duas chegam ao `update`. Sem a versão na
    // cláusula, a segunda sobrescreve a primeira em silêncio.
    const w = await umWorkspace();
    const versao = String(w.version);

    const [a, b] = await Promise.all([
      h.pedir(`/api/workspaces/${w.slug}`, patch({ title: 'Concorrente A' }, versao)),
      h.pedir(`/api/workspaces/${w.slug}`, patch({ title: 'Concorrente B' }, versao)),
    ]);

    const codigos = [a.status, b.status].sort();
    expect(codigos).toEqual([200, 412]);

    // E a versão avançou UMA vez só — duas escritas aceitas a teriam levado a 3.
    const atual = (await (await h.pedir(`/api/workspaces/${w.slug}`)).json()) as Workspace;
    expect(atual.version).toBe(w.version + 1);
  });

  it('campo derivado no PATCH é recusado', async () => {
    const w = await umWorkspace();
    const r = await h.pedir(
      `/api/workspaces/${w.slug}`,
      patch({ nextAction: 'Fazer outra coisa' }, String(w.version)),
    );
    expect(r.status).toBe(400);
    expect(((await r.json()) as Problema).code).toBe('campo_derivado');
  });

  it('não altera o workspace de outro usuário', async () => {
    const w = await umWorkspace();
    h.entrarComo({ clerkUserId: 'clerk_b' });
    const r = await h.pedir(`/api/workspaces/${w.slug}`, patch({ title: 'Invadido' }, String(w.version)));
    expect(r.status).toBe(404);
  });
});
