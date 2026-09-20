import { useEffect, useRef, useState } from 'react';
import {
  canDecide,
  pendingCount,
  APPROVAL_TYPES,
  type ApprovalItem,
  type ApprovalType,
  type ApprovalStatus,
} from '@workspace/core';
import { confirmConcept, addConceptAlias } from './concepts';
import { repointSyllabusItemConcept } from './syllabus';

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
    targetConceptId: nullableStr(raw.targetConceptId),
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

/**
 * Efeito colateral de uma decisão aprovada: um `concept_merge` aprovado
 * promove `targetConceptId` a `confirmed` na biblioteca global
 * (`concepts.ts`). Sem isso, nada na aplicação jamais produz um conceito
 * `confirmed`, e a ponte R3/R4 de `shouldLinkDirectly` (`lib/core`) —
 * quatro rodadas de revisão para acertar — fica inatingível em produção.
 * Idempotente: reaplicar sobre um item já aprovado apenas reconfirma o
 * mesmo conceito.
 *
 * Usa `targetConceptId`, não `sourceRef` (achado da revisão): `sourceRef`
 * é proveniência — de onde a proposta veio — e em `question`/`flashcard` o
 * spec o usa exatamente assim, ao lado de `origin`. Usá-lo aqui para dizer
 * o que a decisão muta inverteria um campo documentado, e o erro seria
 * silencioso na direção errada: quem ligar `dedupeEntries.proposedLinks` a
 * `enqueue` erraria ao preencher `sourceRef` com proveniência (a linha do
 * edital, "extração automática") — o nome pede exatamente isso — e
 * `confirmConcept` receberia um id que não bate com nada, o `.map` não
 * acharia ninguém, a lista voltaria inalterada, e nada quebraria de forma
 * visível: sem exceção, sem log, conceito continua provisório, reuso entre
 * workspaces quebrado de novo, suíte verde.
 *
 * Achado I1 da revisão final ("`concept_merge` não faz merge nenhum"): promover o
 * alvo a `confirmed` nunca foi a fusão inteira — o item que gerou a proposta
 * (`payloadAfter.itemId`, gravado por `EditalRevisar.handleConfirm`) continuava
 * apontando para o seu próprio conceito provisório novo, e nenhum alias era
 * registrado. Consequência prática: cada reimportação acrescentava um conceito
 * duplicado à biblioteca global, para sempre, sem caminho de reconciliação. Agora a
 * decisão também reaponta `syllabus_item.conceptId` para o alvo e acrescenta o
 * `sourceLabel` do item como alias do alvo (`addConceptAlias`) — o mesmo mecanismo de
 * produção de alias que uma renomeação usa (C2/PD-08), só que disparado pela decisão
 * de fusão em vez de uma edição manual. `itemId` é lido de `payloadAfter` sem lançar
 * quando ausente (formato antigo, ou tipo que nunca preenche isso) — a promoção do
 * conceito continua acontecendo mesmo sem `itemId`, só o reapontamento é pulado.
 */
export function applyApprovalSideEffects(decided: ApprovalItem, userId?: string): void {
  if (decided.type === 'concept_merge' && decided.status === 'aprovado' && decided.targetConceptId) {
    confirmConcept(decided.targetConceptId, userId);

    const itemId = isRecord(decided.payloadAfter) && typeof decided.payloadAfter.itemId === 'string'
      ? decided.payloadAfter.itemId
      : null;
    if (itemId && decided.workspaceId) {
      const sourceLabel = repointSyllabusItemConcept(decided.workspaceId, itemId, decided.targetConceptId, userId);
      if (sourceLabel) addConceptAlias(decided.targetConceptId, sourceLabel, userId);
    }
  }
}

export function useApprovals(userId?: string) {
  const [items, setItems] = useState<ApprovalItem[]>(() => getApprovals(userId));
  // Ver a mesma nota em concepts.ts/syllabus.ts: duas mutações síncronas no
  // mesmo evento (achado da revisão — "batched writes silently lose all but
  // the last") não podem partir do mesmo `items` obsoleto capturado no
  // closure de quando o handler começou; `itemsRef` é atualizado
  // sincronamente a cada `persist`, então a segunda chamada já enxerga o
  // resultado da primeira.
  const itemsRef = useRef(items);

  useEffect(() => {
    const loaded = getApprovals(userId);
    itemsRef.current = loaded;
    setItems(loaded);

    const handleStorage = () => {
      const reloaded = getApprovals(userId);
      itemsRef.current = reloaded;
      setItems(reloaded);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [userId]);

  // Achado R3 da re-revisão: escrita durável PRIMEIRO, memória depois. Se a escrita
  // lança (cota esgotada), nada em memória pode afirmar um estado que o armazenamento
  // nunca teve — senão o retry do usuário parte dessa mentira e duplica.
  const persist = (next: ApprovalItem[]) => {
    saveApprovals(next, userId);
    itemsRef.current = next;
    setItems(next);
    window.dispatchEvent(new Event('storage'));
  };

  const approve = async (id: string, payloadAfter?: unknown) => {
    // Fix round 1 da Task 14 (achado 2): quando quem chama tem uma versão mais nova do
    // que decidir aprova de fato (ex.: `EditalRevisar` reaprovando a árvore depois de
    // renomear/separar/editar peso), o payload é substituído ANTES da decisão, na MESMA
    // escrita — nunca duas chamadas separadas, que poderiam divergir se uma delas se
    // perdesse. Sem isto, o item aprovado continuava contando a proposta congelada no
    // momento em que a tela abriu, não o que de fato foi gravado no programa.
    const withPayload = payloadAfter === undefined
      ? itemsRef.current
      : itemsRef.current.map((item) => (item.id === id && canDecide(item.status) ? { ...item, payloadAfter } : item));
    const next = applyDecision(withPayload, id, 'aprovado', new Date());
    const decided = next.find((item) => item.id === id);
    if (decided) applyApprovalSideEffects(decided, userId);
    persist(next);
  };

  const reject = async (id: string, reason?: string, payloadAfter?: unknown) => {
    // Fix round 3 (achado B): a mesma substituição de payload que `approve` já faz —
    // rejeitar é tão terminal quanto aprovar, e nada rio abaixo volta a ler o payload de
    // um item decidido. Sem isto, `payloadAfter.workspaceDraft` (que carrega o edital
    // colado inteiro) sobrevivia para sempre num item rejeitado, já que a fila não poda
    // itens decididos.
    const withPayload = payloadAfter === undefined
      ? itemsRef.current
      : itemsRef.current.map((item) => (item.id === id && canDecide(item.status) ? { ...item, payloadAfter } : item));
    persist(applyDecision(withPayload, id, 'rejeitado', new Date(), reason ?? null));
  };

  const enqueue = async (
    item: Omit<ApprovalItem, 'id' | 'status' | 'createdAt' | 'decidedAt' | 'reason'>,
    now: Date,
  ): Promise<string> => {
    const full = buildApprovalItem(item, now);
    persist([...itemsRef.current, full]);
    return full.id;
  };

  return { items, pending: pendingCount(items), approve, reject, enqueue };
}
