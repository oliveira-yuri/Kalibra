import { useState, useEffect, useRef } from 'react';
import {
  emptyAvailability,
  hasEdital,
  WORKSPACE_STATUSES,
  type WeeklyAvailability,
  type WorkspaceStatus,
  type ExtractionOutput,
} from '@workspace/core';

export type SourceMode = 'file' | 'text' | 'none';
export type ImportStatus = 'pending' | 'parsing' | 'completed' | 'error';

export interface Cargo {
  id: string;
  name: string;
  examDate: string;
  period?: string;
}

/**
 * Cargo sintético usado sempre que um workspace precisa existir sem nenhum cargo
 * nomeado — seja migrando um registro antigo sem `cargos`, seja criando um workspace
 * novo em que ninguém preencheu a seção Cargos. `WorkspaceDraft.cargos` é obrigatório
 * (não-opcional) e não pode ficar vazio: um array vazio deixaria `selectedCargoId`
 * apontando para nada. Centralizado aqui para que `migrateWorkspace` e `NovoWorkspace`
 * nunca possam divergir sobre o que "sem cargo" significa (ver regressão I3).
 */
export function defaultCargo(examDate: string): Cargo {
  return { id: 'c1', name: 'Cargo único', examDate };
}

export interface WorkspaceDraft {
  slug: string;
  title: string;
  institution: string;
  type: string;
  examDate: string; // default date
  cargos: Cargo[];
  selectedCargoId: string;
  availability: WeeklyAvailability;
  status: WorkspaceStatus;
  sourceMode: SourceMode;
  sourceFileName?: string;
  sourceText?: string;
  importStatus: ImportStatus;
  progress: number;
  nextAction: string;
  active: boolean;
}

const STATUS_FROM_IMPORT: Record<ImportStatus, WorkspaceStatus> = {
  pending: 'aguardando_revisao_edital',
  parsing: 'extraindo_edital',
  // 'completed' aqui significa apenas "a extração do edital terminou" — o diagnóstico
  // inicial ainda não rodou, então o próximo estado é diagnostico_pendente, nunca
  // estudando (que só é alcançável depois do fluxo de diagnóstico + plano quinzenal).
  completed: 'diagnostico_pendente',
  error: 'erro',
};

const VALID_IMPORT_STATUSES: readonly ImportStatus[] = ['pending', 'parsing', 'completed', 'error'];
const VALID_SOURCE_MODES: readonly SourceMode[] = ['file', 'text', 'none'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// `WORKSPACE_STATUSES` (lib/core) é derivado de `WORKSPACE_STATUS_LABELS`, então é
// exaustivo por construção — ao contrário de uma lista mantida à mão aqui, ele não pode
// ficar desatualizado quando um status novo é adicionado ao union (ver regressão I4).
function isValidStatus(value: unknown): value is WorkspaceStatus {
  return typeof value === 'string' && (WORKSPACE_STATUSES as readonly string[]).includes(value);
}

function isValidImportStatus(value: unknown): value is ImportStatus {
  return typeof value === 'string' && (VALID_IMPORT_STATUSES as readonly string[]).includes(value);
}

function isValidSourceMode(value: unknown): value is SourceMode {
  return typeof value === 'string' && (VALID_SOURCE_MODES as readonly string[]).includes(value);
}

/** Valida um item de `cargos` sem nunca acessar propriedade de algo que não seja um objeto. */
function isValidCargo(value: unknown): value is Cargo {
  return isRecord(value)
    && typeof value.id === 'string' && value.id.length > 0
    && typeof value.name === 'string' && value.name.length > 0
    && typeof value.examDate === 'string';
}

function isValidAvailability(value: unknown): value is WeeklyAvailability {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.days)) return false;
  if (typeof value.maxSessionMinutes !== 'number') return false;
  return value.days.every(
    (day) => isRecord(day) && typeof day.weekday === 'number' && typeof day.minutes === 'number',
  );
}

/**
 * Devolve `value` quando ele é genuinamente uma string; senão devolve `fallback`.
 * `(value as string) ?? fallback` só protege contra null/undefined — um número ou
 * objeto salvo num campo de texto passaria direto, tipado como `string` sem nunca ter
 * sido validado. Isso importa em particular para `nextAction`, que Portal.tsx renderiza
 * diretamente: um objeto ali derruba o render com "Objects are not valid as a React
 * child", fora do try/catch que isola registros corrompidos em `getWorkspaces`.
 */
function str(value: unknown, fallback: string): string;
function str(value: unknown, fallback: undefined): string | undefined;
function str(value: unknown, fallback: string | undefined): string | undefined {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Converte um registro salvo em qualquer formato anterior para o formato atual.
 * Devolve null quando o registro não tem o mínimo para ser um workspace.
 *
 * Nunca lança: todo campo é validado antes de ser indexado (ver `isValidCargo`,
 * `isValidAvailability`, `isValidStatus` etc.), então um item malformado dentro de um
 * array (ex.: `cargos: [null]`) é descartado, não desreferenciado.
 */
export function migrateWorkspace(raw: unknown): WorkspaceDraft | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.slug !== 'string' || !raw.slug) return null;
  if (typeof raw.title !== 'string' || !raw.title) return null;

  const importStatus = isValidImportStatus(raw.importStatus) ? raw.importStatus : 'pending';
  const validCargos = Array.isArray(raw.cargos) ? raw.cargos.filter(isValidCargo) : [];
  const cargos = validCargos.length > 0
    ? validCargos
    : [defaultCargo(str(raw.examDate, ''))];

  const derivedStatus = isValidStatus(raw.status) ? raw.status : (STATUS_FROM_IMPORT[importStatus] ?? 'sem_edital');
  // Registros antigos guardavam `hasEdital` como campo à parte de `status`, e os dois
  // podiam divergir. O campo não existe mais no formato atual, mas um `hasEdital: false`
  // explícito herdado de um registro antigo não é descartado em silêncio: se o status
  // derivado implicaria um edital, ele é corrigido para `sem_edital` — a informação do
  // campo antigo é absorvida pelo status canônico, não perdida.
  const status = raw.hasEdital === false && hasEdital(derivedStatus) ? 'sem_edital' : derivedStatus;

  return {
    slug: raw.slug,
    title: raw.title,
    institution: str(raw.institution, ''),
    type: str(raw.type, 'Concurso Público'),
    examDate: str(raw.examDate, ''),
    cargos,
    selectedCargoId: str(raw.selectedCargoId, cargos[0].id),
    availability: isValidAvailability(raw.availability) ? raw.availability : emptyAvailability(),
    status,
    sourceMode: isValidSourceMode(raw.sourceMode) ? raw.sourceMode : 'text',
    sourceFileName: str(raw.sourceFileName, undefined),
    sourceText: str(raw.sourceText, undefined),
    importStatus,
    progress: typeof raw.progress === 'number' ? raw.progress : 0,
    nextAction: str(raw.nextAction, ''),
    active: typeof raw.active === 'boolean' ? raw.active : true,
  };
}

export interface PendingWorkspaceImport {
  isNew: boolean;
  workspace?: WorkspaceDraft;
  updates?: Partial<WorkspaceDraft>;
  /**
   * A saída bruta da extração (Task 10), levada até a tela de revisão para que ela
   * rode `dedupeEntries` (Task 11) — nunca aplicada aqui, só transportada. `undefined`
   * enquanto a extração ainda não chegou a "pronto".
   */
  extractionOutput?: ExtractionOutput;
  /**
   * Marca que `dedupeEntries` já rodou sobre `extractionOutput` (Task 11) —
   * sem isto, reabrir a mesma tela de revisão (mesmo import, sem confirmar
   * nem descartar) rodaria a deduplicação de novo a cada montagem e
   * duplicaria itens/conceitos/aprovações. `extractionOutput` continua
   * presente mesmo depois de aplicado: é o único lugar que guarda as
   * incertezas do PD-06 para o bloco "Não encontrado no edital".
   */
  extractionApplied?: boolean;
  /**
   * Id do item `edital_structure` que representa esta proposta na fila de aprovação
   * (Task 14) — gravado assim que `EditalRevisar` enfileira a proposta pela primeira
   * vez. Sem isto, remontar a mesma tela de revisão sem confirmar nem descartar
   * (usuário saiu e voltou) enfileiraria um segundo item idêntico a cada montagem.
   */
  approvalItemId?: string;
}

const STORAGE_KEY = 'kalibra_workspaces';
const storageKeyFor = (userId?: string) => `${STORAGE_KEY}:${userId || 'anonymous'}`;
const pendingKeyFor = (slug: string, userId?: string) => `kalibra_pending_edital:${userId || 'anonymous'}:${slug}`;

export function stageWorkspaceImport(slug: string, pending: PendingWorkspaceImport, userId?: string) {
  sessionStorage.setItem(pendingKeyFor(slug, userId), JSON.stringify(pending));
}

export function getPendingWorkspaceImport(slug: string, userId?: string): PendingWorkspaceImport | null {
  const saved = sessionStorage.getItem(pendingKeyFor(slug, userId));
  return saved ? JSON.parse(saved) : null;
}

export function clearPendingWorkspaceImport(slug: string, userId?: string) {
  sessionStorage.removeItem(pendingKeyFor(slug, userId));
}

const defaultPrograms: WorkspaceDraft[] = [
  {
    slug: 'setec-campinas',
    title: 'Concurso SETEC Campinas',
    type: 'Concurso Público',
    institution: 'SETEC',
    examDate: '2026-01-17',
    cargos: [
      { id: 'c1', name: 'Analista Técnico (Informática)', examDate: '2027-01-17', period: 'A' },
      { id: 'c2', name: 'Agente de Suporte Técnico', examDate: '2027-01-17', period: 'B' }
    ],
    selectedCargoId: 'c1',
    availability: emptyAvailability(),
    status: 'estudando' as const,
    progress: 47.2,
    nextAction: 'Resolver 8 questões de porcentagem',
    active: true,
    sourceMode: 'text' as const,
    importStatus: 'completed' as const
  },
  {
    slug: 'bb-escriturario',
    title: 'Banco do Brasil - Escriturário',
    type: 'Concurso Público',
    institution: 'Banco do Brasil',
    examDate: '2026-06-01',
    cargos: [{ id: 'c1', name: 'Cargo único', examDate: '2026-06-01' }],
    selectedCargoId: 'c1',
    availability: emptyAvailability(),
    status: 'estudando' as const,
    progress: 12.5,
    nextAction: 'Leitura inicial: Sistema Financeiro',
    active: false,
    sourceMode: 'text' as const,
    importStatus: 'completed' as const
  }
];

export function getWorkspaces(userId?: string): WorkspaceDraft[] {
  try {
    const saved = localStorage.getItem(storageKeyFor(userId));
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            // Defesa em profundidade: migrateWorkspace já valida cada campo e não deveria
            // lançar, mas um registro futuro/desconhecido não pode derrubar o array inteiro
            // — isolamos cada item para que só ELE seja descartado se algo inesperado ocorrer.
            try {
              return migrateWorkspace(item);
            } catch (error) {
              console.error('Registro de workspace corrompido, descartado.', error);
              return null;
            }
          })
          .filter((workspace): workspace is WorkspaceDraft => workspace !== null);
      }
    }
  } catch (error) {
    console.error('Não foi possível carregar os workspaces locais.', error);
  }
  return defaultPrograms;
}

export function saveWorkspaces(workspaces: WorkspaceDraft[], userId?: string) {
  localStorage.setItem(storageKeyFor(userId), JSON.stringify(workspaces));
}

export function useWorkspaces(userId?: string) {
  const [workspaces, setWorkspaces] = useState<WorkspaceDraft[]>(() => getWorkspaces(userId));
  // Achado C da revisão da fila de aprovação (fix round 2): `addWorkspace`/
  // `updateWorkspace` construíam a próxima lista a partir de `workspaces`
  // capturado no closure do render — exatamente o padrão que os achados 1/3
  // daquela revisão mostraram perder escrita quando duas mutações acontecem
  // no mesmo evento, antes de qualquer re-render. `workspacesRef` é
  // atualizado sincronamente dentro de `persist`, então a segunda chamada já
  // enxerga o resultado da primeira.
  const workspacesRef = useRef(workspaces);

  useEffect(() => {
    const loaded = getWorkspaces(userId);
    workspacesRef.current = loaded;
    setWorkspaces(loaded);

    const handleStorage = () => {
      const reloaded = getWorkspaces(userId);
      workspacesRef.current = reloaded;
      setWorkspaces(reloaded);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [userId]);

  const persist = (next: WorkspaceDraft[]) => {
    workspacesRef.current = next;
    saveWorkspaces(next, userId);
    setWorkspaces(next);
    window.dispatchEvent(new Event('storage'));
  };

  const addWorkspace = (workspace: WorkspaceDraft) => {
    persist([...workspacesRef.current, workspace]);
  };

  const updateWorkspace = (slug: string, updates: Partial<WorkspaceDraft>) => {
    persist(workspacesRef.current.map(w => w.slug === slug ? { ...w, ...updates } : w));
  };

  return { workspaces, addWorkspace, updateWorkspace };
}
