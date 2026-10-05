import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * O adaptador de API, com foco no que dá errado.
 *
 * **A reversão tem de ser VISÍVEL.** Uma escrita que falha, volta o cache ao
 * estado anterior e não diz nada é exatamente a família de defeito que apareceu
 * três vezes na Fase 1B.5: o app aceita, descarta em silêncio, e o usuário só
 * descobre que perdeu quando o dado não está lá. Reverter sem avisar não é
 * segurança — é perda silenciosa com um nome melhor.
 */

const avisos: { variant?: string; title?: string; description?: string }[] = [];
vi.mock('@/hooks/use-toast', () => ({
  toast: (p: { variant?: string; title?: string; description?: string }) => { avisos.push(p); },
  useToast: () => ({ toast: () => {} }),
}));

const respostas: { lista: unknown; falharEscrita: boolean } = { lista: [], falharEscrita: false };

const fetchOriginal = globalThis.fetch;

function envolver({ children }: { children: ReactNode }) {
  // `retry: false` para a falha chegar ao `onError` na primeira tentativa: sem
  // isso o teste esperaria as tentativas padrão do React Query.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  avisos.length = 0;
  respostas.lista = [];
  respostas.falharEscrita = false;

  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
    const metodo = (init?.method ?? 'GET').toUpperCase();

    if (metodo === 'GET') {
      return new Response(JSON.stringify(respostas.lista), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    if (respostas.falharEscrita) {
      return new Response(
        JSON.stringify({ type: 'x', title: 'x', status: 500, code: 'erro_interno' }),
        { status: 500, headers: { 'content-type': 'application/problem+json' } },
      );
    }
    return new Response(JSON.stringify({ slug: 'w', version: 2 }), {
      status: url.includes('cargos') ? 200 : 201,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
});

afterEach(() => { globalThis.fetch = fetchOriginal; });

const { useWorkspaces } = await import('./workspaces');

const UM_WORKSPACE = {
  slug: 'w', title: 'Antes', institution: '', type: 'Concurso Público',
  examDate: '2027-03-01', cargos: [{ id: 'c1', name: 'Cargo A', examDate: '2027-03-01' }],
  selectedCargoId: 'c1', availability: { days: [], maxSessionMinutes: 50 },
  status: 'sem_edital', sourceMode: 'none', sourceBlocks: [],
  importStatus: 'pending', progress: 0, nextAction: 'x', active: true, version: 1,
};

describe('escrita que falha reverte E AVISA', () => {
  it('a reversão dispara o toast que o app já tem', async () => {
    respostas.lista = [UM_WORKSPACE];
    respostas.falharEscrita = true;

    const { result } = renderHook(() => useWorkspaces(), { wrapper: envolver });
    await waitFor(() => { expect(result.current.workspaces).toHaveLength(1); });

    await act(async () => {
      await result.current.updateWorkspace('w', { title: 'Depois' }).catch(() => {});
    });

    // Não basta o cache voltar: o usuário precisa VER que não salvou.
    await waitFor(() => { expect(avisos.length).toBeGreaterThan(0); });
    expect(avisos[0].variant).toBe('destructive');
    expect(avisos[0].description).toMatch(/não foi salvo/i);
  });

  it('o aviso NÃO aparece quando a escrita dá certo', async () => {
    // Sem esta, um adaptador que avisasse sempre passaria no teste anterior — e a
    // interface gritaria erro em toda escrita bem-sucedida.
    respostas.lista = [UM_WORKSPACE];
    respostas.falharEscrita = false;

    const { result } = renderHook(() => useWorkspaces(), { wrapper: envolver });
    await waitFor(() => { expect(result.current.workspaces).toHaveLength(1); });

    await act(async () => { await result.current.updateWorkspace('w', { title: 'Depois' }); });
    expect(avisos).toHaveLength(0);
  });

  it('o texto do aviso é do CLIENTE, não do servidor', async () => {
    // O corpo de erro traz `code: erro_interno`. O que o usuário lê é escolhido
    // aqui (§3.6): mensagem vinda do servidor é o caminho mais curto para um
    // detalhe interno chegar à tela.
    respostas.lista = [UM_WORKSPACE];
    respostas.falharEscrita = true;

    const { result } = renderHook(() => useWorkspaces(), { wrapper: envolver });
    await waitFor(() => { expect(result.current.workspaces).toHaveLength(1); });
    await act(async () => {
      await result.current.updateWorkspace('w', { title: 'Depois' }).catch(() => {});
    });

    await waitFor(() => { expect(avisos.length).toBeGreaterThan(0); });
    expect(JSON.stringify(avisos[0])).not.toMatch(/erro_interno|500/);
  });
});

describe('o cliente não carrega token', () => {
  it('nenhuma requisição leva Authorization — a sessão vai no cookie', async () => {
    const cabecalhos: (HeadersInit | undefined)[] = [];
    const anterior = globalThis.fetch;
    globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
      cabecalhos.push(init?.headers);
      return anterior(entrada, init);
    }) as typeof fetch;

    respostas.lista = [UM_WORKSPACE];
    const { result } = renderHook(() => useWorkspaces(), { wrapper: envolver });
    await waitFor(() => { expect(result.current.workspaces).toHaveLength(1); });
    await act(async () => { await result.current.updateWorkspace('w', { title: 'Depois' }); });

    expect(cabecalhos.length).toBeGreaterThan(0);
    for (const h of cabecalhos) {
      expect(JSON.stringify(h ?? {}).toLowerCase()).not.toContain('authorization');
    }
  });
});
