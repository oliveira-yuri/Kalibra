import { useEffect, useState } from 'react';
import {
  canDecide,
  pendingCount,
  APPROVAL_TYPES,
  type ApprovalItem,
  type ApprovalType,
  type ApprovalStatus,
} from '@workspace/core';

const APPROVAL_STATUSES: readonly ApprovalStatus[] = ['pendente', 'revisando', 'aprovado', 'rejeitado'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableStr(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function nullableNum(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function isValidType(value: unknown): value is ApprovalType {
  return typeof value === 'string' && (APPROVAL_TYPES as readonly string[]).includes(value);
}

function isValidStatus(value: unknown): value is ApprovalStatus {
  return typeof value === 'string' && (APPROVAL_STATUSES as readonly string[]).includes(value);
}

/**
 * Converte um registro salvo em qualquer formato anterior para o formato
 * atual. Nunca lança; devolve null quando falta o mínimo para reconhecer o
 * item: `id` (identidade) e `type` (sem ele não há como saber que forma o
 * item deveria ter — ao contrário de `status`, que tem um fallback seguro).
 * `payloadBefore`/`payloadAfter` são `unknown` de propósito — o conteúdo é
 * decidido por quem enfileira, não por este módulo.
 */
export function migrateApprovalItem(raw: unknown): ApprovalItem | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || !raw.id) return null;
  if (!isValidType(raw.type)) return null;

  return {
    id: raw.id,
    workspaceId: nullableStr(raw.workspaceId),
    type: raw.type,
    status: isValidStatus(raw.status) ? raw.status : 'pendente',
    title: str(raw.title, ''),
    rationale: str(raw.rationale, ''),
    sourceRef: nullableStr(raw.sourceRef),
    confidence: nullableNum(raw.confidence),
    payloadBefore: raw.payloadBefore ?? null,
    payloadAfter: raw.payloadAfter ?? null,
    createdAt: str(raw.createdAt, ''),
    decidedAt: nullableStr(raw.decidedAt),
    reason: nullableStr(raw.reason),
  };
}

const STORAGE_PREFIX = 'kalibra_approvals';
const storageKeyFor = (userId?: string) => `${STORAGE_PREFIX}:${userId || 'anonymous'}`;

/**
 * Nunca lança: um item corrompido é isolado num try/catch dentro do `map` —
 * defesa em profundidade, a mesma lição da Fase 1A (workspaces.ts) — e
 * descartado sem derrubar os demais.
 */
export function getApprovals(userId?: string): ApprovalItem[] {
  try {
    const saved = localStorage.getItem(storageKeyFor(userId));
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            try {
              return migrateApprovalItem(item);
            } catch (error) {
              console.error('Item da fila de aprovação corrompido, descartado.', error);
              return null;
            }
          })
          .filter((item): item is ApprovalItem => item !== null);
      }
    }
  } catch (error) {
    console.error('Não foi possível carregar a fila de aprovação local.', error);
  }
  return [];
}

export function saveApprovals(items: ApprovalItem[], userId?: string) {
  localStorage.setItem(storageKeyFor(userId), JSON.stringify(items));
}

function makeApprovalId(now: Date): string {
  return `appr-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Monta o item completo a partir do que o chamador enfileira. Pura e
 * testável sem hook: `now` vem de fora porque `lib/core` não lê relógio, e
 * o adaptador local é quem tem autoridade para carimbar a hora real.
 */
export function buildApprovalItem(
  input: Omit<ApprovalItem, 'id' | 'status' | 'createdAt' | 'decidedAt' | 'reason'>,
  now: Date,
): ApprovalItem {
  return {
    ...input,
    id: makeApprovalId(now),
    status: 'pendente',
    createdAt: now.toISOString(),
    decidedAt: null,
    reason: null,
  };
}

/**
 * Aplica uma decisão a um item da lista, se e só se `canDecide` autorizar —
 * decidir um item já decidido (aprovado/rejeitado) não muda nada, em vez de
 * sobrescrever silenciosamente uma decisão anterior.
 */
export function applyDecision(
  items: readonly ApprovalItem[],
  id: string,
  status: 'aprovado' | 'rejeitado',
  now: Date,
  reason: string | null = null,
): ApprovalItem[] {
  return items.map((item) => {
    if (item.id !== id || !canDecide(item.status)) return item;
    return { ...item, status, decidedAt: now.toISOString(), reason: status === 'rejeitado' ? reason : null };
  });
}

export function useApprovals(userId?: string) {
  const [items, setItems] = useState<ApprovalItem[]>(() => getApprovals(userId));

  useEffect(() => {
    setItems(getApprovals(userId));
    const handleStorage = () => setItems(getApprovals(userId));
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [userId]);

  const persist = (next: ApprovalItem[]) => {
    saveApprovals(next, userId);
    setItems(next);
    window.dispatchEvent(new Event('storage'));
  };

  const approve = (id: string) => {
    persist(applyDecision(items, id, 'aprovado', new Date()));
  };

  const reject = (id: string, reason?: string) => {
    persist(applyDecision(items, id, 'rejeitado', new Date(), reason ?? null));
  };

  const enqueue = (
    item: Omit<ApprovalItem, 'id' | 'status' | 'createdAt' | 'decidedAt' | 'reason'>,
    now: Date,
  ): string => {
    const full = buildApprovalItem(item, now);
    persist([...items, full]);
    return full.id;
  };

  return { items, pending: pendingCount(items), approve, reject, enqueue };
}
