import { inject } from 'vitest';
import { setBaseUrl } from '@workspace/api-client-react';
import { CABECALHO_DE_USUARIO } from '@workspace/api-server/src/test/servidor-compartilhado';

/**
 * A ponte entre um arquivo de teste de tela e o `api-server` compartilhado.
 *
 * Cada arquivo chama `ligarNaApi(<id único>)` uma vez. A partir daí, tudo que o
 * adaptador de API fizer sai para o servidor de verdade, em nome daquele usuário —
 * e **nenhum arquivo enxerga o dado de outro**, porque a API filtra por `user_id`
 * na cláusula `where`. O isolamento é o do produto, não um truque de teste.
 *
 * A sessão viaja num cabeçalho, e não por `setAuthTokenGetter`: aquele anexaria
 * `Authorization: Bearer`, e o §3.5 proíbe o frontend de carregar token. Aqui o
 * cabeçalho é posto por um embrulho de `fetch` que só existe dentro do teste.
 */

let usuarioAtual: string | null = null;
let proximoMundo = 0;
const fetchOriginal = globalThis.fetch;

/**
 * Liga o arquivo à API **num mundo novo**.
 *
 * Chamada em `beforeEach`, e não uma vez por arquivo: cada teste ganha um usuário
 * inédito, e portanto um estado vazio. É o mesmo desenho do harness de contrato —
 * um mundo por cenário — e pela mesma razão: se um teste enxergasse o que o
 * anterior deixou, o conjunto passaria a depender da ordem.
 *
 * Substitui o `localStorage.clear()` que os testes faziam. Não há equivalente aqui
 * porque não há o que limpar: o mundo já nasce vazio.
 */
export function ligarNaApi(prefixo: string): void {
  usuarioAtual = `${prefixo}-${++proximoMundo}`;
  setBaseUrl(inject('apiBaseUrl'));

  globalThis.fetch = ((entrada: RequestInfo | URL, init?: RequestInit) => {
    const cabecalhos = new Headers(init?.headers);
    if (usuarioAtual) cabecalhos.set(CABECALHO_DE_USUARIO, usuarioAtual);

    // **O `signal` do jsdom é descartado, e isso custou tempo para achar.**
    //
    // O React Query passa um `AbortSignal` criado pelo jsdom; o `fetch` do Node,
    // que é quem de fato executa, recusa: "Expected signal to be an instance of
    // AbortSignal". A requisição falhava, o React Query tentava de novo com recuo
    // exponencial, e a consulta ficava PENDENTE para sempre — a tela nunca
    // recebia o workspace e o teste dizia "não achei o filtro de cargo", que é o
    // sintoma mais distante possível da causa.
    //
    // Perder o cancelamento dentro do teste é aceitável: o que se exercita aqui é
    // o que a tela faz com a resposta, não o que ela faz ao desistir dela.
    const { signal, ...resto } = init ?? {};
    const sinalCompativel = signal instanceof globalThis.AbortSignal ? { signal } : {};

    return fetchOriginal(entrada, { ...resto, ...sinalCompativel, headers: cabecalhos });
  }) as typeof fetch;
}

export function desligarDaApi(): void {
  globalThis.fetch = fetchOriginal;
  usuarioAtual = null;
  setBaseUrl(null);
}

type Json = Record<string, unknown>;

async function chamar(metodo: string, caminho: string, corpo?: unknown): Promise<Json> {
  const r = await globalThis.fetch(`${inject('apiBaseUrl')}${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json' },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  });
  const texto = await r.text();
  const analisado = texto ? (JSON.parse(texto) as Json) : {};
  if (r.status >= 400) {
    throw new Error(`${metodo} ${caminho} respondeu ${r.status}: ${texto}`);
  }
  return analisado;
}

/**
 * Semeia um workspace **pela API**, como o produto o criaria.
 *
 * Substitui a escrita direta em `localStorage` que os testes faziam. A diferença
 * importa: escrever no armazenamento montava um estado que o produto talvez nunca
 * produzisse. Criar pela API só consegue montar estados alcançáveis — e derivados
 * como `status` passam a vir de onde vêm em produção.
 */
export async function semearWorkspace(dados: Json): Promise<Json> {
  const { status, ...criacao } = dados;
  const criado = await chamar('POST', '/api/workspaces', criacao);

  // `status` não entra na criação: `WorkspaceCreate` não o aceita, porque o estado
  // inicial é decisão de `lib/core` a partir de haver edital ou não. Um teste que
  // precise de um estado adiante o alcança por `PATCH`, que é o caminho que o
  // produto usa — e assim o arranjo do teste não consegue montar um estado
  // inalcançável, coisa que a escrita direta no armazenamento montava à vontade.
  if (typeof status === 'string') {
    return chamarComVersao('PATCH', `/api/workspaces/${String(criado.slug)}`, { status }, Number(criado.version));
  }
  return criado;
}

async function chamarComVersao(metodo: string, caminho: string, corpo: unknown, versao: number): Promise<Json> {
  const r = await globalThis.fetch(`${inject('apiBaseUrl')}${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', 'if-match': String(versao) },
    body: JSON.stringify(corpo),
  });
  const texto = await r.text();
  if (r.status >= 400) throw new Error(`${metodo} ${caminho} respondeu ${r.status}: ${texto}`);
  return JSON.parse(texto) as Json;
}

/** Lê um workspace pela API — para asserções que antes liam o armazenamento. */
export async function lerWorkspace(slug: string): Promise<Json | null> {
  const r = await globalThis.fetch(`${inject('apiBaseUrl')}/api/workspaces/${slug}`, {
    headers: { 'content-type': 'application/json' },
  });
  return r.status === 404 ? null : ((await r.json()) as Json);
}

export async function listarWorkspaces(): Promise<Json[]> {
  const r = await globalThis.fetch(`${inject('apiBaseUrl')}/api/workspaces`, {
    headers: { 'content-type': 'application/json' },
  });
  return (await r.json()) as Json[];
}
