import { useQueryClient } from '@tanstack/react-query';
import {
  useListWorkspaces,
  getListWorkspacesQueryKey,
  useCreateWorkspace,
  usePatchWorkspace,
  usePatchCargo,
} from '@workspace/api-client-react';
import { toast } from '@/hooks/use-toast';
import { parseWorkspaceDraft } from '../local/workspaces';
import type { WorkspaceDraft, WorkspaceEscrita } from '../../ports';

/**
 * Workspaces pela API.
 *
 * **Tudo passa pelos hooks gerados pelo Orval** — nenhum `fetch` à mão, nenhum
 * tipo copiado. O `openapi.yaml` é a fonte; o que está aqui é ligação, não
 * contrato.
 *
 * A sessão viaja no cookie, sozinha: o `custom-fetch` não usa token, e o proxy
 * `/api` do Vite garante mesma origem (ver `vite.config.ts`). Nenhum código daqui
 * lê, guarda ou repassa token — é invariante do §3.5.
 */

/** A chave da lista. Uma só: todas as mutações invalidam a mesma leitura. */
const chaveDaLista = () => getListWorkspacesQueryKey();

/**
 * Avisa que uma escrita não valeu.
 *
 * **Toda reversão é visível.** Uma escrita que falha, reverte o cache e não diz
 * nada é a família de defeito que apareceu três vezes na Fase 1B.5 — o app aceita
 * e descarta em silêncio, e o usuário só descobre quando o dado não está lá.
 *
 * O texto vem do cliente, nunca do servidor (§3.6): mensagem de produto é decisão
 * de interface, e deixar o servidor escolhê-la é o caminho mais curto para um
 * detalhe interno aparecer na tela.
 */
function avisarQueReverteu(oQue: string): void {
  toast({
    variant: 'destructive',
    title: 'Não foi possível salvar',
    description: `${oQue} não foi salvo. Tente de novo.`,
  });
}

export function useWorkspaces() {
  const queryClient = useQueryClient();
  const { data } = useListWorkspaces();
  const workspaces = (data ?? []) as unknown as WorkspaceDraft[];

  /**
   * O ciclo otimista, igual nas três mutações: aplica na hora, guarda o anterior,
   * reverte **e avisa** se falhar, e invalida ao terminar.
   */
  const otimista = (descricao: string, aplicar: (atual: WorkspaceDraft[]) => WorkspaceDraft[]) => ({
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: chaveDaLista() });
      const anterior = queryClient.getQueryData<WorkspaceDraft[]>(chaveDaLista());
      queryClient.setQueryData<WorkspaceDraft[]>(chaveDaLista(), (atual) => aplicar(atual ?? []));
      return { anterior };
    },
    onError: (_erro: unknown, _variaveis: unknown, contexto?: { anterior?: WorkspaceDraft[] }) => {
      if (contexto?.anterior !== undefined) {
        queryClient.setQueryData(chaveDaLista(), contexto.anterior);
      }
      avisarQueReverteu(descricao);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: chaveDaLista() }),
  });

  const criar = useCreateWorkspace({ mutation: otimista('O workspace', (atual) => atual) });
  const alterar = usePatchWorkspace({ mutation: otimista('A alteração', (atual) => atual) });
  const trocarCargo = usePatchCargo({ mutation: otimista('A troca de cargo', (atual) => atual) });

  const addWorkspace = async (workspace: WorkspaceEscrita) => {
    await criar.mutateAsync({ data: workspace as never });
  };

  const updateWorkspace = async (slug: string, updates: Partial<WorkspaceEscrita>) => {
    const atual = workspaces.find((w) => w.slug === slug);
    if (!atual) throw new Error(`workspace "${slug}" não está carregado`);
    await alterar.mutateAsync({
      slug,
      data: updates as never,
      // A versão que ESTA aba leu. O servidor recusa com 412 se já mudou — é o
      // caso das duas abas abertas, e sem isso a segunda escrita apagaria a
      // primeira sem nada indicar a perda.
      headers: { 'If-Match': String(atual.version) },
    } as never);
  };

  const selectCargo = async (slug: string, cargoId: string) => {
    // Operação, não escrita de campo: `selectedCargoId` é derivado de qual cargo
    // está marcado. O servidor desmarca os outros na mesma transação.
    await trocarCargo.mutateAsync({ slug, cargoId, data: { isSelected: true } } as never);
  };

  return { workspaces, addWorkspace, updateWorkspace, selectCargo };
}

/**
 * Validação de registro de origem não confiável — **pura, e por isso compartilhada**.
 *
 * `EditalRevisar` a usa sobre o `workspaceDraft` de um item da fila de aprovação,
 * que pode estar corrompido ou num formato anterior. Não lê armazenamento nem
 * rede: é a mesma função nos dois adaptadores, e duplicá-la só criaria duas
 * definições de "registro válido".
 */
export { parseWorkspaceDraft };

/**
 * Ainda delegado ao adaptador local, **de propósito e com prazo**.
 *
 * Esta função apura a próxima versão do edital a partir da fila de aprovação e do
 * programa salvo — dois módulos que só migram nas Fases 8 e 9. Enquanto eles
 * forem locais, a resposta certa vem de lá; apontá-la para um endpoint que lê
 * tabelas vazias devolveria um número errado com cara de certo.
 */
export { nextSyllabusVersionFor } from '../local/workspaces';
