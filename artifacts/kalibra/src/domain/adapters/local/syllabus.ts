import { useEffect, useRef, useState } from 'react';
import {
  emptySyllabus,
  splitItem,
  slugify,
  type Syllabus,
  type SyllabusItem,
  type SyllabusItemCargo,
  type Concept,
} from '@workspace/core';
import { useConcepts } from './concepts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

/** Valida um `SyllabusItem` isolado, sem nunca acessar propriedade de algo que não seja objeto. */
function isValidSyllabusItem(value: unknown): value is SyllabusItem {
  return isRecord(value)
    && typeof value.id === 'string' && value.id.length > 0
    && typeof value.workspaceId === 'string' && value.workspaceId.length > 0
    && typeof value.conceptId === 'string' && value.conceptId.length > 0
    && isNullableString(value.parentItemId)
    && typeof value.sourceLabel === 'string'
    && isNullableString(value.sourceExcerpt)
    && isNullableNumber(value.page)
    && typeof value.confidence === 'number'
    && typeof value.uncertain === 'boolean';
}

/**
 * Valida uma ligação item-cargo isolada. Não exige que `syllabusItemId`
 * aponte para um item que ainda existe em `items` — uma ligação órfã (cargo
 * removido, item removido) tem forma válida e não deve derrubar a leitura;
 * quem consome `Syllabus` já filtra por `itemsForCargo` etc.
 */
function isValidLink(value: unknown): value is SyllabusItemCargo {
  return isRecord(value)
    && typeof value.syllabusItemId === 'string' && value.syllabusItemId.length > 0
    && typeof value.cargoId === 'string' && value.cargoId.length > 0
    && isNullableNumber(value.weight)
    && isNullableNumber(value.questionCount);
}

/**
 * Converte um registro salvo em qualquer formato anterior para o formato
 * atual. Nunca lança; devolve null só quando o registro nem sequer é um
 * objeto — ao contrário de um workspace (que precisa de pelo menos um
 * cargo), um programa de estudo vazio (`{ items: [], links: [] }`) é um
 * estado válido, então `items`/`links` de formato errado ou ausente vira
 * lista vazia em vez de reprovar o registro inteiro.
 *
 * Cada item de `items` e `links` é isolado num try/catch dentro do `map` —
 * defesa em profundidade, a mesma lição da Fase 1A (workspaces.ts): um
 * registro corrompido não pode derrubar os demais.
 *
 * Não migra conceitos: um `Concept` é global por usuário, não por
 * workspace, e vive em `concepts.ts` sob sua própria chave
 * (`kalibra_concepts:<userId>`) — ver a nota lá para o porquê.
 */
export function migrateSyllabus(raw: unknown): Syllabus | null {
  if (!isRecord(raw)) return null;

  const items = Array.isArray(raw.items)
    ? raw.items
        .map((item) => {
          try {
            return isValidSyllabusItem(item) ? item : null;
          } catch (error) {
            console.error('Item de programa de estudo corrompido, descartado.', error);
            return null;
          }
        })
        .filter((item): item is SyllabusItem => item !== null)
    : [];

  const links = Array.isArray(raw.links)
    ? raw.links
        .map((link) => {
          try {
            return isValidLink(link) ? link : null;
          } catch (error) {
            console.error('Ligação de cargo corrompida, descartada.', error);
            return null;
          }
        })
        .filter((link): link is SyllabusItemCargo => link !== null)
    : [];

  return { items, links };
}

const STORAGE_PREFIX = 'kalibra_syllabus';
const storageKeyFor = (workspaceSlug: string, userId?: string) =>
  `${STORAGE_PREFIX}:${userId || 'anonymous'}:${workspaceSlug}`;

export function getSyllabus(workspaceSlug: string, userId?: string): Syllabus {
  try {
    const saved = localStorage.getItem(storageKeyFor(workspaceSlug, userId));
    if (saved) {
      const syllabus = migrateSyllabus(JSON.parse(saved));
      if (syllabus) return syllabus;
    }
  } catch (error) {
    console.error('Não foi possível carregar o programa de estudo local.', error);
  }
  return emptySyllabus();
}

export function saveSyllabus(syllabus: Syllabus, workspaceSlug: string, userId?: string) {
  localStorage.setItem(storageKeyFor(workspaceSlug, userId), JSON.stringify(syllabus));
}

function makeId(seed: string): string {
  return `${seed}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useSyllabus(workspaceSlug: string, userId?: string) {
  const conceptsApi = useConcepts(userId);

  const [syllabus, setSyllabus] = useState<Syllabus>(() => getSyllabus(workspaceSlug, userId));
  // Ver a mesma nota em concepts.ts: duas mutações síncronas no mesmo evento
  // não podem partir do `syllabus` obsoleto capturado no closure do render.
  const syllabusRef = useRef(syllabus);

  useEffect(() => {
    const loaded = getSyllabus(workspaceSlug, userId);
    syllabusRef.current = loaded;
    setSyllabus(loaded);

    const handleStorage = () => {
      const reloaded = getSyllabus(workspaceSlug, userId);
      syllabusRef.current = reloaded;
      setSyllabus(reloaded);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [workspaceSlug, userId]);

  const persist = (next: Syllabus) => {
    syllabusRef.current = next;
    saveSyllabus(next, workspaceSlug, userId);
    setSyllabus(next);
    window.dispatchEvent(new Event('storage'));
  };

  const save = (next: Syllabus) => persist(next);

  const renameItem = (itemId: string, label: string) => {
    persist({
      ...syllabusRef.current,
      items: syllabusRef.current.items.map((item) =>
        (item.id === itemId ? { ...item, sourceLabel: label } : item)),
    });
  };

  const removeItem = (itemId: string) => {
    persist({
      items: syllabusRef.current.items
        .filter((item) => item.id !== itemId)
        .map((item) => (item.parentItemId === itemId ? { ...item, parentItemId: null } : item)),
      links: syllabusRef.current.links.filter((link) => link.syllabusItemId !== itemId),
    });
  };

  /** Escreve o conceito na biblioteca global (`concepts.ts`) e o item/ligações no workspace. */
  const addItem = (parentItemId: string | null, label: string, cargoIds: string[]) => {
    const itemId = makeId('item');
    const conceptId = makeId('concept');

    const concept: Concept = {
      id: conceptId,
      canonicalName: label,
      slug: slugify(label),
      parentId: null,
      kind: parentItemId ? 'topico' : 'disciplina',
      aliases: [],
      status: 'provisional',
    };

    const item: SyllabusItem = {
      id: itemId,
      workspaceId: workspaceSlug,
      conceptId,
      parentItemId,
      sourceLabel: label,
      sourceExcerpt: null,
      page: null,
      confidence: 1,
      uncertain: false,
    };

    const links: SyllabusItemCargo[] = cargoIds.map((cargoId) => ({
      syllabusItemId: itemId,
      cargoId,
      weight: null,
      questionCount: null,
    }));

    conceptsApi.addConcept(concept);
    persist({
      items: [...syllabusRef.current.items, item],
      links: [...syllabusRef.current.links, ...links],
    });
  };

  const splitFromCargo = (itemId: string, cargoId: string) => {
    persist(splitItem(syllabusRef.current, itemId, cargoId, makeId));
  };

  return {
    syllabus,
    concepts: conceptsApi.concepts,
    save,
    renameItem,
    removeItem,
    addItem,
    splitFromCargo,
  };
}
