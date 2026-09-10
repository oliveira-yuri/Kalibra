import { useState, useEffect } from 'react';

export type SourceMode = 'file' | 'text';
export type ImportStatus = 'pending' | 'parsing' | 'completed' | 'error';

export interface Cargo {
  id: string;
  name: string;
  examDate: string;
  period?: string;
}

export interface WorkspaceDraft {
  slug: string;
  title: string;
  institution: string;
  type: string;
  examDate: string; // default date
  cargos?: Cargo[];
  selectedCargoId?: string;
  sourceMode: SourceMode;
  sourceFileName?: string;
  sourceText?: string;
  importStatus: ImportStatus;
  progress: number;
  nextAction: string;
  active: boolean;
}

export interface PendingWorkspaceImport {
  isNew: boolean;
  workspace?: WorkspaceDraft;
  updates?: Partial<WorkspaceDraft>;
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
    if (saved) return JSON.parse(saved);
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

  useEffect(() => {
    setWorkspaces(getWorkspaces(userId));
    const handleStorage = () => setWorkspaces(getWorkspaces(userId));
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [userId]);

  const addWorkspace = (workspace: WorkspaceDraft) => {
    const next = [...workspaces, workspace];
    saveWorkspaces(next, userId);
    setWorkspaces(next);
    window.dispatchEvent(new Event('storage'));
  };

  const updateWorkspace = (slug: string, updates: Partial<WorkspaceDraft>) => {
    const next = workspaces.map(w => w.slug === slug ? { ...w, ...updates } : w);
    saveWorkspaces(next, userId);
    setWorkspaces(next);
    window.dispatchEvent(new Event('storage'));
  };

  return { workspaces, addWorkspace, updateWorkspace };
}
