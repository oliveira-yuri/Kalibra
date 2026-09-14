import { useEffect, useRef, useState } from 'react';
import {
  renameConcept as renameConceptPure, withAlias,
  type Concept, type ConceptKind, type ConceptStatus,
} from '@workspace/core';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

const VALID_CONCEPT_KINDS: readonly ConceptKind[] = ['disciplina', 'topico', 'subtopico'];
const VALID_CONCEPT_STATUSES: readonly ConceptStatus[] = ['confirmed', 'provisional'];

function isValidConcept(value: unknown): value is Concept {
  return isRecord(value)
    && typeof value.id === 'string' && value.id.length > 0
    && typeof value.canonicalName === 'string'
    && typeof value.slug === 'string'
    && isNullableString(value.parentId)
    && typeof value.kind === 'string' && (VALID_CONCEPT_KINDS as readonly string[]).includes(value.kind)
    && Array.isArray(value.aliases) && value.aliases.every((alias) => typeof alias === 'string')
    && typeof value.status === 'string' && (VALID_CONCEPT_STATUSES as readonly string[]).includes(value.status);
}

/**
 * Converte a lista de conceitos salva para o formato atual. Nunca lança;
 * cada conceito é isolado num try/catch dentro do `.map` — a mesma defesa
 * em profundidade de `workspaces.ts` — e um item malformado é descartado
 * sem derrubar os demais.
 *
 * Um conceito é global por usuário, não por edital: "Porcentagem e juros
 * simples" é o mesmo conceito não importa quantos editais o citem — é
 * exatamente essa identidade estável que permite uma nota escrita para um
 * edital reaparecer noutro e o estado de repetição espaçada ser
 * compartilhado. Por isso `raw` aqui é a lista inteira (array no nível
 * raiz), não um campo dentro de um registro por workspace.
 */
export function migrateConcepts(raw: unknown): Concept[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((concept) => {
      try {
        return isValidConcept(concept) ? concept : null;
      } catch (error) {
        console.error('Conceito corrompido, descartado.', error);
        return null;
      }
    })
    .filter((concept): concept is Concept => concept !== null);
}

const STORAGE_PREFIX = 'kalibra_concepts';
const storageKeyFor = (userId?: string) => `${STORAGE_PREFIX}:${userId || 'anonymous'}`;

export function getConcepts(userId?: string): Concept[] {
  try {
    const saved = localStorage.getItem(storageKeyFor(userId));
    if (saved) {
      return migrateConcepts(JSON.parse(saved));
    }
  } catch (error) {
    console.error('Não foi possível carregar a biblioteca de conceitos local.', error);
  }
  return [];
}

export function saveConcepts(concepts: Concept[], userId?: string) {
  localStorage.setItem(storageKeyFor(userId), JSON.stringify(concepts));
}

/**
 * Promove um conceito a `confirmed`. Hoje o único chamador é uma decisão de
 * aprovação `concept_merge` (ver `applyApprovalSideEffects` em
 * `approvals.ts`) — sem isso, a ponte R3/R4 de `shouldLinkDirectly`
 * (`lib/core`) nunca teria efeito na aplicação rodando: todo conceito nasce
 * `provisional` (`useSyllabus.addItem`) e `shouldLinkDirectly` só liga
 * direto a um conceito já `confirmed`.
 *
 * Escrita fora de um hook montado de propósito: `applyApprovalSideEffects`
 * é uma função pura chamada de dentro de `useApprovals.approve`, sem acesso
 * a uma instância de `useConcepts` para atualizar. Por isso esta função
 * dispatcha `storage` ela mesma (achado da revisão — "confirmConcept writes
 * storage without dispatching storage, so the next write reverts it"): sem
 * isso, o `ref` de qualquer `useConcepts`/`useSyllabus` montado ficava
 * obsoleto e a próxima escrita (`addConcept`, `addItem`) reconstruía a
 * lista a partir do estado antigo, revertendo a confirmação em silêncio —
 * exatamente a classe de escrita perdida que o achado 3 da rodada anterior
 * existia para matar, reentrando pelo único mutador do módulo que não é
 * hook.
 */
export function confirmConcept(conceptId: string, userId?: string): Concept[] {
  const next = getConcepts(userId).map((concept) =>
    (concept.id === conceptId ? { ...concept, status: 'confirmed' as const } : concept));
  saveConcepts(next, userId);
  window.dispatchEvent(new Event('storage'));
  return next;
}

/**
 * Acrescenta um alias a um conceito da biblioteca global. Mesmo padrão de escrita fora
 * de hook que `confirmConcept` já usa (mesma justificativa: `applyApprovalSideEffects`
 * roda de dentro de `useApprovals.approve`, sem uma instância de `useConcepts` para
 * atualizar) — dispatcha `storage` ela mesma para que qualquer hook montado não
 * reverta esta escrita na próxima chamada.
 *
 * Achado I1 da revisão final: aprovar uma fusão de conceito (`concept_merge`) promovia
 * o alvo a `confirmed` mas nunca registrava, em lugar nenhum, que o rótulo do item que
 * gerou a proposta é OUTRO NOME do mesmo conceito — sem isto, uma reimportação futura
 * com a mesma redação nunca encontra esse conceito de novo (C2/PD-08).
 */
export function addConceptAlias(conceptId: string, alias: string, userId?: string): Concept[] {
  const next = getConcepts(userId).map((concept) =>
    (concept.id === conceptId ? withAlias(concept, alias) : concept));
  saveConcepts(next, userId);
  window.dispatchEvent(new Event('storage'));
  return next;
}

export function useConcepts(userId?: string) {
  const [concepts, setConcepts] = useState<Concept[]>(() => getConcepts(userId));
  // Espelha o estado mais recente fora do ciclo de render: duas mutações
  // síncronas no mesmo evento (achado da revisão — "batched writes silently
  // lose all but the last") não podem partir do mesmo `concepts` obsoleto
  // capturado no closure de quando o handler começou.
  const conceptsRef = useRef(concepts);

  useEffect(() => {
    const loaded = getConcepts(userId);
    conceptsRef.current = loaded;
    setConcepts(loaded);

    const handleStorage = () => {
      const reloaded = getConcepts(userId);
      conceptsRef.current = reloaded;
      setConcepts(reloaded);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [userId]);

  const persist = (next: Concept[]) => {
    conceptsRef.current = next;
    saveConcepts(next, userId);
    setConcepts(next);
    window.dispatchEvent(new Event('storage'));
  };

  const addConcept = (concept: Concept) => {
    persist([...conceptsRef.current, concept]);
  };

  const confirm = (conceptId: string) => {
    persist(conceptsRef.current.map((concept) =>
      (concept.id === conceptId ? { ...concept, status: 'confirmed' as const } : concept)));
  };

  /**
   * Renomeia o nome canônico de um conceito já persistido, preservando o rótulo
   * anterior como alias (`renameConcept`, `lib/core`) — o mecanismo do PD-08 usado por
   * `useSyllabus.renameItem` quando um item CONFIRMADO é renomeado (achado C2 da
   * revisão final).
   */
  const renameConcept = (conceptId: string, newCanonicalName: string) => {
    persist(conceptsRef.current.map((concept) =>
      (concept.id === conceptId ? renameConceptPure(concept, newCanonicalName) : concept)));
  };

  return { concepts, addConcept, confirmConcept: confirm, renameConcept };
}
