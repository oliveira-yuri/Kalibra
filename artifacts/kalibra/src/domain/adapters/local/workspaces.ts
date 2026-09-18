import { useState, useEffect, useRef } from 'react';
import { getApprovals } from './approvals';
import { getSyllabus } from './syllabus';
import { nextSyllabusVersion } from '../../edital-structure-payload';
import {
  emptyAvailability,
  hasEdital,
  WORKSPACE_STATUSES,
  type WeeklyAvailability,
  type WorkspaceStatus,
  type ExtractionOutput,
  type CargoTextBlock,
} from '@workspace/core';
import type {
  SourceMode, ImportStatus, Cargo, WorkspaceDraft, PendingWorkspaceImport,
} from '../../ports/workspaces';

// Os cinco tipos acima moravam NESTE arquivo ate a Fase 1A. Foram para a porta para
// que o contrato deixe de ser definido pelo adaptador local — ver ports/workspaces.ts.
export type { SourceMode, ImportStatus, Cargo, WorkspaceDraft, PendingWorkspaceImport };

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

function isValidBlock(value: unknown): value is CargoTextBlock {
  if (typeof value !== 'object' || value === null) return false;
  const block = value as Record<string, unknown>;
  const cargoOk = block.cargoId === null || typeof block.cargoId === 'string';
  return cargoOk && typeof block.text === 'string';
}

/**
 * Blocos do edital a partir de um registro cru. Migração total e idempotente:
 * - já tem `sourceBlocks` válidos → preserva (só os elementos válidos);
 * - só tem `sourceText` → vira UM bloco comum, que é o que aquele texto de fato era:
 *   um conteúdo aplicado a todos os cargos;
 * - não tem nada → lista vazia.
 *
 * Um elemento inválido é descartado sozinho, sem derrubar o registro: a Fase 1A
 * aprendeu isso da pior forma, quando um `cargos: [null]` fazia `.map` abortar o array
 * inteiro e o fallback devolvia dados de demonstração no lugar do histórico real.
 */
function blocksFrom(raw: Record<string, unknown>): CargoTextBlock[] {
  if (Array.isArray(raw.sourceBlocks)) {
    return raw.sourceBlocks.filter(isValidBlock).map((block) => ({ cargoId: block.cargoId, text: block.text }));
  }
  const legacy = str(raw.sourceText, undefined);
  return legacy ? [{ cargoId: null, text: legacy }] : [];
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
    sourceBlocks: blocksFrom(raw),
    importStatus,
    progress: typeof raw.progress === 'number' ? raw.progress : 0,
    nextAction: str(raw.nextAction, ''),
    active: typeof raw.active === 'boolean' ? raw.active : true,
  };
}

const STORAGE_KEY = 'kalibra_workspaces';
const storageKeyFor = (userId?: string) => `${STORAGE_KEY}:${userId || 'anonymous'}`;
const pendingKeyFor = (slug: string, userId?: string) => `kalibra_pending_edital:${userId || 'anonymous'}:${slug}`;
/**
 * A próxima versão de edital deste workspace, lida da REALIDADE durável — a fila de
 * aprovação (quais versões já foram encenadas como proposta) e o programa salvo (que
 * só existe se alguma versão foi confirmada). Ver `nextSyllabusVersion` em
 * `domain/edital-structure-payload.ts` para o porquê de não haver mais contador
 * próprio: um contador incrementado no início da extração e nunca liberado inflava a
 * cada tentativa abandonada, e a tela passava a anunciar comparação com versões que
 * nunca existiram (achado R2 da re-revisão). Esta função é o ponto onde as telas
 * (`NovoWorkspace`, `Edital`) descobrem o número, sem tocar armazenamento elas mesmas.
 */
export function nextSyllabusVersionFor(slug: string, userId?: string): number {
  return nextSyllabusVersion(getApprovals(userId), slug, getSyllabus(slug, userId).items.length > 0);
}

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
    sourceBlocks: [],
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
    sourceBlocks: [],
    importStatus: 'completed' as const
  }
];

/**
 * Achado I6 da revisão final: antes, "chave ausente", "valor não é um array" e "JSON
 * corrompido" caíam todos no MESMO fallback (`defaultPrograms`) — um usuário com uma
 * chave danificada via os dois concursos fictícios de demonstração aparecerem do nada,
 * e a primeira escrita (`addWorkspace`/`updateWorkspace`) persistia essa lista
 * fabricada POR CIMA do registro original recuperável, enquanto `kalibra_syllabus`,
 * `kalibra_concepts` e `kalibra_approvals` sobreviviam órfãos (indexados por slugs que
 * não existem mais em `kalibra_workspaces`). Só "chave genuinamente ausente" é
 * primeiro-uso de verdade; um valor presente mas ilegível é corrupção, e o único jeito
 * seguro de tratar corrupção é devolver uma lista vazia — nunca inventar dado que a
 * próxima escrita torna permanente.
 */
export function getWorkspaces(userId?: string): WorkspaceDraft[] {
  const key = storageKeyFor(userId);
  let saved: string | null;
  try {
    saved = localStorage.getItem(key);
  } catch (error) {
    // O próprio acesso ao armazenamento falhou (ex.: bloqueado pelo navegador) — não há
    // como distinguir "vazio" de "corrompido" aqui; semear a demonstração é o único
    // comportamento que não deixa a tela quebrada.
    console.error('Não foi possível acessar os workspaces locais.', error);
    return defaultPrograms;
  }

  if (saved === null) return defaultPrograms;

  try {
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      console.error('Registro de workspaces corrompido (formato inesperado) — tratado como vazio, não substituído por dados de demonstração.');
      return [];
    }
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
  } catch (error) {
    console.error('Registro de workspaces corrompido (JSON inválido) — tratado como vazio, não substituído por dados de demonstração.', error);
    return [];
  }
}

/**
 * Diz se o valor bruto salvo hoje é ilegível — presente, mas nem JSON válido nem um
 * array. Exatamente o caso que `getWorkspaces` trata como lista vazia.
 */
function isUnreadable(raw: string): boolean {
  try {
    return !Array.isArray(JSON.parse(raw));
  } catch {
    return true;
  }
}

/**
 * Achado R6 da re-revisão — a metade que continuava aberta. `getWorkspaces` já parou
 * de ressuscitar a demonstração sobre uma chave corrompida (devolve `[]`, e a leitura
 * deixa o valor bruto byte a byte intacto), mas a PRIMEIRA escrita seguinte gravava
 * por cima assim mesmo: medido com um registro recuperável — um objeto JSON válido
 * `{"0": {slug, title, …}}`, o formato que um `JSON.parse`/`JSON.stringify` errado em
 * algum lugar produz — o `addWorkspace` seguinte reescrevia a chave e o registro
 * original do usuário simplesmente sumia.
 *
 * Antes de destruir, preserva: o valor ilegível é copiado, sem nenhuma
 * transformação, para uma chave de backup ao lado. Nunca sobrescreve um backup já
 * existente — a primeira corrupção é a que tem o dado mais próximo do original, e uma
 * segunda passagem não pode enterrar a primeira.
 */
function preserveUnreadableWorkspaces(userId?: string) {
  const key = storageKeyFor(userId);
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || !isUnreadable(raw)) return;
    const backupKey = `${key}:corrompido`;
    if (localStorage.getItem(backupKey) !== null) return;
    localStorage.setItem(backupKey, raw);
  } catch (error) {
    // Preservar falhou (armazenamento cheio/bloqueado). Deixar de gravar aqui
    // travaria o app inteiro para sempre; o registro fica sem backup e isso é
    // registrado como limite conhecido, não escondido.
    console.error('Não foi possível preservar o registro de workspaces ilegível antes de sobrescrevê-lo.', error);
  }
}

export function saveWorkspaces(workspaces: WorkspaceDraft[], userId?: string) {
  preserveUnreadableWorkspaces(userId);
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

  // Achado R3 da re-revisão: a escrita durável vem PRIMEIRO. Quando `saveWorkspaces`
  // lança (cota esgotada — o regime esperado), atualizar o ref antes deixaria a
  // memória afirmando um estado que o armazenamento nunca teve, e o retry do usuário
  // partiria dessa mentira (duplicando o que já estava no ref). Lançando antes de
  // qualquer mutação, memória e armazenamento nunca divergem.
  const persist = (next: WorkspaceDraft[]) => {
    saveWorkspaces(next, userId);
    workspacesRef.current = next;
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
