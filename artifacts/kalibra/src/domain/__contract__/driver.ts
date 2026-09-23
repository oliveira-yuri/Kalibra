import type {
  ApprovalItem,
  Concept,
  DedupResult,
  ExtractionOutput,
  Syllabus,
  SyllabusItemCargo,
} from '@workspace/core';
import type { Cargo, WorkspaceDraft } from '../ports';

/**
 * A porta como um CENÁRIO a enxerga.
 *
 * As quatro portas do domínio expõem hooks (`useWorkspaces`, `useSyllabus`,
 * `useConcepts`, `useApprovals`). Um cenário não pode chamá-los: exigiria uma
 * árvore React dentro do próprio cenário, e um adaptador de API atendido por
 * `fetch` não tem hook para renderizar. O `Driver` é a mesma superfície sem essa
 * exigência.
 *
 * **Toda operação é assíncrona, inclusive as que o local resolve na hora.** Não é
 * cerimônia: um cenário que pudesse ler um valor sem `await` estaria autorizado a
 * depender de imediatismo, e quebraria inteiro contra HTTP. `lentidao.test.ts`
 * prova que nenhum depende.
 */
export interface Driver {
  // ---- workspaces + cargos ----
  criarWorkspace(w: WorkspaceDraft): Promise<void>;
  atualizarWorkspace(slug: string, updates: Partial<WorkspaceDraft>): Promise<void>;
  /**
   * O workspace de `slug`, ou `null`. **Nunca a lista inteira**, de propósito:
   * o adaptador local devolve dois workspaces fictícios de demonstração quando a
   * chave de armazenamento está ausente, e nenhum adaptador de API fará isso. Um
   * cenário que pudesse pedir a lista acabaria afirmando sobre ela.
   */
  lerWorkspace(slug: string): Promise<WorkspaceDraft | null>;
  cargoPadrao(examDate: string): Promise<Cargo>;
  proximaVersaoDeEdital(slug: string): Promise<number>;

  // ---- syllabus ----
  lerSyllabus(slug: string): Promise<Syllabus>;
  salvarSyllabus(slug: string, next: Syllabus): Promise<void>;
  adicionarItem(slug: string, parentItemId: string | null, label: string, cargoIds: string[]): Promise<void>;
  renomearItem(slug: string, itemId: string, label: string): Promise<void>;
  removerItem(slug: string, itemId: string): Promise<void>;
  ligarACargo(slug: string, itemId: string, cargoId: string): Promise<void>;
  desligarDeCargo(slug: string, itemId: string, cargoId: string): Promise<void>;
  separarDeCargo(slug: string, itemId: string, cargoId: string): Promise<void>;
  atualizarLigacao(
    slug: string,
    itemId: string,
    cargoId: string,
    patch: Partial<Pick<SyllabusItemCargo, 'weight' | 'questionCount'>>,
  ): Promise<void>;
  /** COMPUTA a proposta. Não grava — é isso que o cenário de não-mutação afirma. */
  preverExtracao(slug: string, output: ExtractionOutput): Promise<DedupResult>;

  // ---- conceitos ----
  lerConceitos(): Promise<Concept[]>;
  adicionarConceito(c: Concept): Promise<void>;
  confirmarConceito(conceptId: string): Promise<void>;
  renomearConceito(conceptId: string, novoNome: string): Promise<void>;

  // ---- aprovações ----
  /**
   * A fila inteira. `pending`, que a porta também expõe, **não entra no Driver**
   * de propósito: é contagem derivada de `items`, e um cenário que afirmasse
   * sobre ela estaria afirmando contagem total — o que este harness proíbe em
   * toda parte. Quem precisar do número filtra por status.
   *
   * O `Driver` é um SUBCONJUNTO das portas, não uma bijeção: toda operação daqui
   * corresponde a uma de porta, mas nem toda operação de porta precisa estar
   * aqui. A guarda estrutural verifica só essa direção, que é a que importa —
   * é por ela que o contrato ganharia vocabulário próprio.
   */
  lerAprovacoes(): Promise<ApprovalItem[]>;
  enfileirar(
    item: Omit<ApprovalItem, 'id' | 'status' | 'createdAt' | 'decidedAt' | 'reason'>,
    now: Date,
  ): Promise<string>;
  aprovar(id: string, payloadAfter?: unknown): Promise<void>;
  rejeitar(id: string, reason?: string, payloadAfter?: unknown): Promise<void>;

  /**
   * **A primitiva central do harness.** Esquece tudo que está em memória e volta a
   * perguntar ao sistema.
   *
   * É o que permite afirmar durabilidade sem olhar armazenamento: em vez de espiar
   * `localStorage` — que só o local tem —, o cenário para de olhar, olha de novo, e
   * afirma sobre o que o sistema responde. No local isso é remontar o hook; na API,
   * refazer a requisição. A pergunta é a mesma nos dois: *o que o sistema diz depois
   * que eu deixei de estar olhando?*
   */
  recarregar(): Promise<void>;
}

/** Um mundo isolado: driver mais o que for preciso para desmontá-lo. */
export type MundoDeTeste = { driver: Driver; encerrar(): Promise<void> };

/**
 * Cria um mundo **limpo**. O runner chama uma vez por cenário.
 *
 * Como o isolamento é obtido é problema de cada adaptador — usuário novo no local,
 * transação ou banco próprio na API — e de propósito não aparece aqui. Um cenário
 * que soubesse limpar o mundo saberia como o mundo é guardado.
 */
export type FabricaDeDriver = () => Promise<MundoDeTeste>;
