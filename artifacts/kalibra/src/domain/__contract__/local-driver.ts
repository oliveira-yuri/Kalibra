import { renderHook, act, type RenderHookResult } from '@testing-library/react';
import { useWorkspaces, defaultCargo, nextSyllabusVersionFor } from '../adapters/local/workspaces';
import { useSyllabus } from '../adapters/local/syllabus';
import { useConcepts } from '../adapters/local/concepts';
import { useApprovals } from '../adapters/local/approvals';
import type { Driver, MundoDeTeste } from './driver';

/**
 * `Driver` sobre o adaptador local. **O único arquivo do harness que sabe que o
 * local é React** — nenhum cenário importa daqui.
 *
 * O driver não decide nada: cada operação é uma chamada ao hook correspondente,
 * embrulhada em `act`. Se alguma delas precisar de lógica própria — filtrar,
 * reordenar, reconciliar — é sinal de que o contrato está errado, não o driver, e
 * a resposta é mudar o `Driver`, nunca compensar aqui. Um driver que calcula vira
 * uma segunda implementação do domínio, e aí o harness compara o adaptador contra
 * si mesmo.
 *
 * **O isolamento é o `userId`, não uma limpeza de armazenamento.** Os hooks são
 * indexados por usuário, então um id novo já é um mundo vazio. `localStorage.clear()`
 * seria pior que redundante: `local.test.ts` e `lentidao.test.ts` rodam no mesmo
 * pacote, e um limparia o mundo do outro no meio da execução — falha intermitente
 * e dependente de ordem, o tipo mais caro de diagnosticar, numa fase cujo objetivo
 * é justamente não depender de ordem.
 *
 * O contador é determinístico de propósito: uma falha de contrato precisa
 * reproduzir para ser depurável quando o driver de API chegar.
 */
let proximoUsuario = 0;

type Montagem = {
  workspaces: RenderHookResult<ReturnType<typeof useWorkspaces>, unknown>;
  concepts: RenderHookResult<ReturnType<typeof useConcepts>, unknown>;
  approvals: RenderHookResult<ReturnType<typeof useApprovals>, unknown>;
  /**
   * Um `useSyllabus` por workspace visitado. São montados sob demanda porque o
   * hook recebe o slug e React não permite chamar um número variável de hooks
   * numa mesma árvore — cada workspace ganha a sua.
   */
  syllabus: Map<string, RenderHookResult<ReturnType<typeof useSyllabus>, unknown>>;
};

export const criarDriverLocal = async (): Promise<MundoDeTeste> => {
  const userId = `contrato-${++proximoUsuario}`;

  const montar = (): Montagem => ({
    workspaces: renderHook(() => useWorkspaces(userId)),
    concepts: renderHook(() => useConcepts(userId)),
    approvals: renderHook(() => useApprovals(userId)),
    syllabus: new Map(),
  });

  let m = montar();

  /**
   * Desmonta só o que ESTE mundo montou.
   *
   * `cleanup()` do testing-library desmontaria toda árvore renderizada no
   * processo, inclusive as de outro mundo — a mesma família de erro que o
   * `localStorage.clear()` global.
   */
  const desmontar = (alvo: Montagem) => {
    act(() => {
      alvo.workspaces.unmount();
      alvo.concepts.unmount();
      alvo.approvals.unmount();
      for (const s of alvo.syllabus.values()) s.unmount();
    });
  };

  /**
   * O `useSyllabus` daquele workspace, montando-o na primeira visita.
   *
   * **Precisa ser chamado FORA de `act`.** Montar por dentro faz o `renderHook`
   * ser batelado junto com a mutação, e `result.current` ainda é `null` quando a
   * operação tenta lê-lo. Foi assim que os quatro primeiros cenários de syllabus
   * falharam — com `Cannot read properties of null`, que parece defeito do
   * cenário e é mecânica de React.
   *
   * Por isso toda operação de syllabus resolve `syl(slug)` antes de entrar no
   * `act`, e só lê `.current` lá dentro.
   */
  const syl = (slug: string) => {
    let r = m.syllabus.get(slug);
    if (!r) {
      r = renderHook(() => useSyllabus(slug, userId));
      m.syllabus.set(slug, r);
    }
    return r.result;
  };

  /** Monta o hook do workspace, depois executa a mutação dentro de `act`. */
  const agirNoSyllabus = <T>(
    slug: string,
    f: (api: ReturnType<typeof useSyllabus>) => Promise<T> | T,
  ): Promise<T> => {
    const alvo = syl(slug);
    return agir(() => f(alvo.current));
  };

  /**
   * Executa a mutação dentro de `act` e devolve o que o hook devolveu.
   *
   * As mutações do adaptador local são `async` mas resolvem sincronamente; o `act`
   * é o que garante que os re-renders disparados por elas terminem antes de a
   * próxima operação ler o estado.
   */
  const agir = async <T>(f: () => Promise<T> | T): Promise<T> => {
    let saida!: T;
    await act(async () => { saida = await f(); });
    return saida;
  };

  const d: Driver = {
    // ---- workspaces + cargos ----
    criarWorkspace: (w) => agir(() => m.workspaces.result.current.addWorkspace(w)),
    atualizarWorkspace: (slug, updates) =>
      agir(() => m.workspaces.result.current.updateWorkspace(slug, updates)),
    lerWorkspace: async (slug) =>
      m.workspaces.result.current.workspaces.find((w) => w.slug === slug) ?? null,
    cargoPadrao: async (examDate) => defaultCargo(examDate),
    proximaVersaoDeEdital: async (slug) => nextSyllabusVersionFor(slug, userId),

    // ---- syllabus ----
    lerSyllabus: async (slug) => syl(slug).current.syllabus,
    salvarSyllabus: (slug, next) => agirNoSyllabus(slug, (api) => api.save(next)),
    adicionarItem: (slug, parentItemId, label, cargoIds) =>
      agirNoSyllabus(slug, (api) => api.addItem(parentItemId, label, cargoIds)),
    renomearItem: (slug, itemId, label) =>
      agirNoSyllabus(slug, (api) => api.renameItem(itemId, label)),
    removerItem: (slug, itemId) => agirNoSyllabus(slug, (api) => api.removeItem(itemId)),
    ligarACargo: (slug, itemId, cargoId) =>
      agirNoSyllabus(slug, (api) => api.linkToCargo(itemId, cargoId)),
    desligarDeCargo: (slug, itemId, cargoId) =>
      agirNoSyllabus(slug, (api) => api.unlinkFromCargo(itemId, cargoId)),
    separarDeCargo: (slug, itemId, cargoId) =>
      agirNoSyllabus(slug, (api) => api.splitFromCargo(itemId, cargoId)),
    atualizarLigacao: (slug, itemId, cargoId, patch) =>
      agirNoSyllabus(slug, (api) => api.updateLink(itemId, cargoId, patch)),
    preverExtracao: async (slug, output) => syl(slug).current.previewExtraction(output),

    // ---- conceitos ----
    lerConceitos: async () => m.concepts.result.current.concepts,
    adicionarConceito: (c) => agir(() => m.concepts.result.current.addConcept(c)),
    confirmarConceito: (conceptId) =>
      agir(() => m.concepts.result.current.confirmConcept(conceptId)),
    renomearConceito: (conceptId, novoNome) =>
      agir(() => m.concepts.result.current.renameConcept(conceptId, novoNome)),

    // ---- aprovações ----
    lerAprovacoes: async () => m.approvals.result.current.items,
    enfileirar: (item, now) => agir(() => m.approvals.result.current.enqueue(item, now)),
    aprovar: (id, payloadAfter) =>
      agir(() => m.approvals.result.current.approve(id, payloadAfter)),
    rejeitar: (id, reason, payloadAfter) =>
      agir(() => m.approvals.result.current.reject(id, reason, payloadAfter)),

    async recarregar() {
      const anterior = m;
      m = montar();
      desmontar(anterior);
    },
  };

  return {
    driver: d,
    async encerrar() { desmontar(m); },
  };
};
