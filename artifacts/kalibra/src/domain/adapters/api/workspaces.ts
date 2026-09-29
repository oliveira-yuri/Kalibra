import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useListWorkspaces,
  getListWorkspacesQueryKey,
  getWorkspace,
  useCreateWorkspace,
  patchWorkspace,
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
  /**
   * `useMutation` com a FUNÇÃO gerada, em vez do hook gerado.
   *
   * O `If-Match` é parâmetro de cabeçalho, e o gerador do Orval não o passa pelas
   * variáveis da mutação — só por uma opção fixa no momento de criar o hook, que
   * não serve: a versão muda a cada escrita. A função `patchWorkspace(slug, data,
   * options)` aceita cabeçalho por chamada.
   *
   * Continua sendo o cliente gerado: nenhum `fetch` à mão, nenhum tipo copiado. O
   * que se troca é o açúcar do hook por uma chamada explícita.
   */
  const alterar = useMutation({
    mutationFn: ({ slug, data, versao }: { slug: string; data: Partial<WorkspaceEscrita>; versao: number }) =>
      patchWorkspace(slug, data as never, { headers: { 'If-Match': String(versao) } }),
    ...otimista('A alteração', (atual) => atual),
  });
  const trocarCargo = usePatchCargo({ mutation: otimista('A troca de cargo', (atual) => atual) });

  const addWorkspace = async (workspace: WorkspaceEscrita) => {
    await criar.mutateAsync({ data: workspace as never });
  };

  const updateWorkspace = async (slug: string, updates: Partial<WorkspaceEscrita>) => {
    // A versão que ESTA aba leu, quando a leitura já chegou. É ela que dá sentido
    // ao `If-Match`: o conflito que se quer detectar é entre o que o usuário viu e
    // o que outra aba gravou depois.
    //
    // Quando a lista ainda não chegou — o usuário agiu antes de a tela carregar —
    // não há "o que o usuário viu" para defender, então buscamos a versão atual.
    // É concorrência otimista mais fraca, e de propósito: mais fraca que nada, e
    // honesta sobre não ter base para ser forte.
    const emCache = workspaces.find((w) => w.slug === slug);
    const atual = emCache ?? ((await getWorkspace(slug)) as unknown as WorkspaceDraft);
    await alterar.mutateAsync({ slug, data: updates, versao: atual.version ?? 1 });
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
