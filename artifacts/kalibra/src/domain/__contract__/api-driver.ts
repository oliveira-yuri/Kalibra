import { criarHarness } from '@workspace/api-server/src/test/harness';
import type { Driver, MundoDeTeste } from './driver';
import type { Modulo } from './cenarios';

/**
 * `Driver` sobre a API real.
 *
 * Sobe o `api-server` de verdade sobre PGlite, numa porta efêmera, e fala HTTP com
 * ele — o mesmo harness que a Fase 3 construiu. **Sessão injetada, nunca Clerk
 * real:** esta fase não valida token contra o Clerk, e nenhum segredo entra aqui.
 *
 * É o segundo lado da comparação que a Fase 4 preparou. Até aqui os cenários só
 * tinham o adaptador local para rodar contra; a partir de agora, um cenário que
 * passe num e falhe no outro significa **contrato quebrado** — e a divergência
 * aparece como teste vermelho em vez de bug de dado meses depois.
 */

/** Os módulos que já têm endpoint. Cresce uma fase por vez. */
export const MODULOS_MIGRADOS: readonly Modulo[] = ['workspaces', 'cargos'];

/**
 * Lançado pelas operações cujo módulo ainda não migrou.
 *
 * Não é falha de contrato, é ausência de endpoint — e precisa ser distinguível de
 * uma, senão a Fase 6 leria quinze vermelhos e não saberia qual deles importa.
 */
export class NaoMigradoNestaFase extends Error {
  constructor(operacao: string) {
    super(`A operação "${operacao}" pertence a um módulo que ainda não migrou para a API.`);
    this.name = 'NaoMigradoNestaFase';
  }
}

const aindaNao = (operacao: string) => (): never => {
  throw new NaoMigradoNestaFase(operacao);
};

let proximoUsuario = 0;

export const criarDriverApi = async (): Promise<MundoDeTeste> => {
  const h = await criarHarness();
  // Um usuário novo por mundo, como no driver local: é assim que dois cenários
  // não se enxergam sem depender de limpeza global.
  h.entrarComo({ clerkUserId: `contrato-api-${++proximoUsuario}` });

  const pedirJson = async (caminho: string, init?: RequestInit) => {
    const r = await h.pedir(caminho, init);
    const texto = await r.text();
    return { status: r.status, corpo: texto ? (JSON.parse(texto) as unknown) : null };
  };

  const comCorpo = (metodo: string, corpo: unknown, ifMatch?: string): RequestInit => ({
    method: metodo,
    headers: {
      'content-type': 'application/json',
      ...(ifMatch === undefined ? {} : { 'if-match': ifMatch }),
    },
    body: JSON.stringify(corpo),
  });

  /** O corpo, ou um erro que carrega o status — para a falha dizer o que aconteceu. */
  function exigirOk(resposta: { status: number; corpo: unknown }, o_que: string): unknown {
    if (resposta.status >= 400) {
      throw new Error(`${o_que}: a API respondeu ${resposta.status} — ${JSON.stringify(resposta.corpo)}`);
    }
    return resposta.corpo;
  }

  type CorpoDeWorkspace = { slug: string; version: number; cargos: { id: string }[] };

  const lerBruto = async (slug: string): Promise<CorpoDeWorkspace | null> => {
    const r = await pedirJson(`/api/workspaces/${slug}`);
    return r.status === 404 ? null : (r.corpo as CorpoDeWorkspace);
  };

  const d: Driver = {
    // ---- workspaces + cargos ----
    async criarWorkspace(w) {
      exigirOk(await pedirJson('/api/workspaces', comCorpo('POST', w)), 'criar workspace');
    },
    async atualizarWorkspace(slug, updates) {
      const atual = await lerBruto(slug);
      if (!atual) throw new Error(`atualizar workspace: "${slug}" não existe`);
      exigirOk(
        await pedirJson(`/api/workspaces/${slug}`, comCorpo('PATCH', updates, String(atual.version))),
        'atualizar workspace',
      );
    },
    lerWorkspace: async (slug) => (await lerBruto(slug)) as never,
    cargoPadrao: aindaNao('cargoPadrao'),
    proximaVersaoDeEdital: aindaNao('proximaVersaoDeEdital'),

    // ---- syllabus (Fase 8) ----
    lerSyllabus: aindaNao('lerSyllabus'),
    salvarSyllabus: aindaNao('salvarSyllabus'),
    adicionarItem: aindaNao('adicionarItem'),
    renomearItem: aindaNao('renomearItem'),
    removerItem: aindaNao('removerItem'),
    ligarACargo: aindaNao('ligarACargo'),
    desligarDeCargo: aindaNao('desligarDeCargo'),
    separarDeCargo: aindaNao('separarDeCargo'),
    atualizarLigacao: aindaNao('atualizarLigacao'),
    preverExtracao: aindaNao('preverExtracao'),

    // ---- conceitos (Fase 7) ----
    lerConceitos: aindaNao('lerConceitos'),
    adicionarConceito: aindaNao('adicionarConceito'),
    confirmarConceito: aindaNao('confirmarConceito'),
    renomearConceito: aindaNao('renomearConceito'),

    // ---- aprovações (Fase 9) ----
    lerAprovacoes: aindaNao('lerAprovacoes'),
    enfileirar: aindaNao('enfileirar'),
    aprovar: aindaNao('aprovar'),
    rejeitar: aindaNao('rejeitar'),

    /**
     * **No-op, e isso não é uma fraqueza.**
     *
     * No driver local `recarregar` remonta os hooks porque há estado em memória a
     * descartar. Aqui toda leitura já é uma requisição nova ao servidor: a
     * pergunta "o que o sistema diz depois que eu deixei de olhar" é respondida
     * por ele a cada chamada. A garantia é a mesma, obtida de outro jeito.
     *
     * Se um dia o driver passar a cachear — por exemplo usando os hooks gerados
     * em vez de `fetch` —, é aqui que o cache tem de ser descartado.
     */
    async recarregar() {},
  };

  return { driver: d, encerrar: h.encerrar };
};
