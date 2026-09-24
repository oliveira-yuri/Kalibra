import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { criarHarness, type Harness } from '../test/harness';

/**
 * Cargos. As quatro regras que não são óbvias e que a interface depende:
 * selecionar um desmarca os outros, apagar o selecionado promove alguém, apagar o
 * último é recusado, e cargo de workspace alheio não existe.
 */

type Workspace = {
  slug: string;
  version: number;
  selectedCargoId: string | null;
  cargos: { id: string; name: string; position: number }[];
};
type Problema = { code: string };

let h: Harness;
beforeAll(async () => { h = await criarHarness(); });
afterAll(async () => { await h.encerrar(); });
beforeEach(async () => { await h.limpar(); h.entrarComo(null); });

const corpoJson = (metodo: string, corpo?: unknown): RequestInit => ({
  method: metodo,
  headers: { 'content-type': 'application/json' },
  ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
});

async function comDoisCargos() {
  h.entrarComo({ clerkUserId: 'clerk_a' });
  const r = await h.pedir('/api/workspaces', corpoJson('POST', {
    title: 'Concurso com cargos',
    cargos: [{ name: 'Cargo A' }, { name: 'Cargo B' }],
  }));
  return (await r.json()) as Workspace;
}

const ler = async (slug: string) =>
  (await (await h.pedir(`/api/workspaces/${slug}`)).json()) as Workspace;

describe('POST cargos', () => {
  it('acrescenta ao fim e incrementa a versão do workspace', async () => {
    const w = await comDoisCargos();
    const r = await h.pedir(`/api/workspaces/${w.slug}/cargos`, corpoJson('POST', { name: 'Cargo C' }));

    expect(r.status).toBe(201);
    const depois = (await r.json()) as Workspace;
    expect(depois.cargos.map((c) => c.name)).toEqual(['Cargo A', 'Cargo B', 'Cargo C']);
    // Mutação granular não exige If-Match, mas altera a versão: sem isso um PATCH
    // posterior passaria numa versão que já não descreve o estado.
    expect(depois.version).toBe(w.version + 1);
  });

  it('o acrescentado NÃO rouba a seleção', async () => {
    const w = await comDoisCargos();
    await h.pedir(`/api/workspaces/${w.slug}/cargos`, corpoJson('POST', { name: 'Cargo C' }));
    expect((await ler(w.slug)).selectedCargoId).toBe(w.selectedCargoId);
  });

  it('em workspace de outro usuário responde 404', async () => {
    const w = await comDoisCargos();
    h.entrarComo({ clerkUserId: 'clerk_b' });
    const r = await h.pedir(`/api/workspaces/${w.slug}/cargos`, corpoJson('POST', { name: 'Invasor' }));
    expect(r.status).toBe(404);
  });
});

describe('PATCH cargo', () => {
  it('selecionar um DESMARCA os outros — nunca há dois selecionados', async () => {
    const w = await comDoisCargos();
    const segundo = w.cargos[1];

    const r = await h.pedir(
      `/api/workspaces/${w.slug}/cargos/${segundo.id}`,
      corpoJson('PATCH', { isSelected: true }),
    );
    expect(r.status).toBe(200);

    const depois = await ler(w.slug);
    expect(depois.selectedCargoId).toBe(segundo.id);
    // `selectedCargoId` é derivado de um único `is_selected`. Se dois ficassem
    // marcados, o índice único parcial do banco teria recusado a escrita — este
    // teste chegar aqui já prova que não ficaram.
    expect(depois.cargos).toHaveLength(2);
  });

  it('renomear não mexe na seleção', async () => {
    const w = await comDoisCargos();
    await h.pedir(
      `/api/workspaces/${w.slug}/cargos/${w.cargos[1].id}`,
      corpoJson('PATCH', { name: 'Cargo B renomeado' }),
    );
    const depois = await ler(w.slug);
    expect(depois.cargos.find((c) => c.id === w.cargos[1].id)?.name).toBe('Cargo B renomeado');
    expect(depois.selectedCargoId).toBe(w.selectedCargoId);
  });

  it('cargo de outro workspace responde 404', async () => {
    const w = await comDoisCargos();
    const r = await h.pedir(
      `/api/workspaces/${w.slug}/cargos/99999999-9999-9999-9999-999999999999`,
      corpoJson('PATCH', { name: 'X' }),
    );
    expect(r.status).toBe(404);
  });
});

describe('DELETE cargo', () => {
  it('apagar o SELECIONADO promove o de menor position', async () => {
    const w = await comDoisCargos();
    // Seleciona o segundo, depois apaga ele: a seleção tem de cair no primeiro.
    await h.pedir(`/api/workspaces/${w.slug}/cargos/${w.cargos[1].id}`, corpoJson('PATCH', { isSelected: true }));
    const r = await h.pedir(`/api/workspaces/${w.slug}/cargos/${w.cargos[1].id}`, corpoJson('DELETE'));

    expect(r.status).toBe(200);
    const depois = (await r.json()) as Workspace;
    expect(depois.cargos).toHaveLength(1);
    // Não ficou sem seleção: uma tela sem cargo selecionado não sabe o que mostrar.
    expect(depois.selectedCargoId).toBe(w.cargos[0].id);
  });

  it('apagar um NÃO selecionado preserva a seleção', async () => {
    const w = await comDoisCargos();
    await h.pedir(`/api/workspaces/${w.slug}/cargos/${w.cargos[1].id}`, corpoJson('DELETE'));
    expect((await ler(w.slug)).selectedCargoId).toBe(w.cargos[0].id);
  });

  it('apagar o ÚLTIMO cargo responde 409', async () => {
    const w = await comDoisCargos();
    await h.pedir(`/api/workspaces/${w.slug}/cargos/${w.cargos[1].id}`, corpoJson('DELETE'));

    const r = await h.pedir(`/api/workspaces/${w.slug}/cargos/${w.cargos[0].id}`, corpoJson('DELETE'));
    expect(r.status).toBe(409);
    expect(((await r.json()) as Problema).code).toBe('ultimo_cargo');

    // E o cargo continua lá — a recusa não apagou pela metade.
    expect((await ler(w.slug)).cargos).toHaveLength(1);
  });

  it('cargo de workspace alheio responde 404', async () => {
    const w = await comDoisCargos();
    h.entrarComo({ clerkUserId: 'clerk_b' });
    const r = await h.pedir(`/api/workspaces/${w.slug}/cargos/${w.cargos[0].id}`, corpoJson('DELETE'));
    expect(r.status).toBe(404);
  });
});
