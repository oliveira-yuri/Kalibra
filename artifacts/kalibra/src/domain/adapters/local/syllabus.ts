import { useEffect, useState } from 'react';
import {
  emptySyllabus,
  splitItem,
  slugify,
  type Syllabus,
  type SyllabusItem,
  type SyllabusItemCargo,
  type Concept,
  type ConceptKind,
  type ConceptStatus,
} from '@workspace/core';

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

/**
 * Migra a lista de conceitos guardada junto do programa de estudo. Segue a
 * mesma disciplina de `migrateSyllabus`: nunca lança, item malformado é
 * descartado sem derrubar os demais.
 */
function migrateConcepts(raw: unknown): Concept[] {
  if (!isRecord(raw) || !Array.isArray(raw.concepts)) return [];
  return raw.concepts
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

export type SyllabusRecord = {
  syllabus: Syllabus;
  concepts: Concept[];
};

function emptyRecord(): SyllabusRecord {
  return { syllabus: emptySyllabus(), concepts: [] };
}

const STORAGE_PREFIX = 'kalibra_syllabus';
const storageKeyFor = (workspaceSlug: string, userId?: string) =>
  `${STORAGE_PREFIX}:${userId || 'anonymous'}:${workspaceSlug}`;

/**
 * A forma persistida é achatada — `items`/`links` no nível raiz, junto de
 * `concepts` — porque `migrateSyllabus` opera sobre esse mesmo nível (é o
 * formato que ela documenta aceitar). Aninhar `{ syllabus: {...} }` faria
 * `migrateSyllabus` procurar `items`/`links` no lugar errado.
 */
export function getSyllabusRecord(workspaceSlug: string, userId?: string): SyllabusRecord {
  try {
    const saved = localStorage.getItem(storageKeyFor(workspaceSlug, userId));
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      const syllabus = migrateSyllabus(parsed);
      if (syllabus) {
        return { syllabus, concepts: migrateConcepts(parsed) };
      }
    }
  } catch (error) {
    console.error('Não foi possível carregar o programa de estudo local.', error);
  }
  return emptyRecord();
}

export function saveSyllabusRecord(record: SyllabusRecord, workspaceSlug: string, userId?: string) {
  const flat = { items: record.syllabus.items, links: record.syllabus.links, concepts: record.concepts };
  localStorage.setItem(storageKeyFor(workspaceSlug, userId), JSON.stringify(flat));
}

function makeId(seed: string): string {
  return `${seed}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useSyllabus(workspaceSlug: string, userId?: string) {
  const [record, setRecord] = useState<SyllabusRecord>(() => getSyllabusRecord(workspaceSlug, userId));

  useEffect(() => {
    setRecord(getSyllabusRecord(workspaceSlug, userId));
  }, [workspaceSlug, userId]);

  const persist = (next: SyllabusRecord) => {
    saveSyllabusRecord(next, workspaceSlug, userId);
    setRecord(next);
  };

  const save = (syllabus: Syllabus) => persist({ ...record, syllabus });

  const renameItem = (itemId: string, label: string) => {
    persist({
      ...record,
      syllabus: {
        ...record.syllabus,
        items: record.syllabus.items.map((item) =>
          item.id === itemId ? { ...item, sourceLabel: label } : item),
      },
    });
  };

  const removeItem = (itemId: string) => {
    persist({
      ...record,
      syllabus: {
        items: record.syllabus.items
          .filter((item) => item.id !== itemId)
          .map((item) => (item.parentItemId === itemId ? { ...item, parentItemId: null } : item)),
        links: record.syllabus.links.filter((link) => link.syllabusItemId !== itemId),
      },
    });
  };

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

    persist({
      syllabus: {
        items: [...record.syllabus.items, item],
        links: [...record.syllabus.links, ...links],
      },
      concepts: [...record.concepts, concept],
    });
  };

  const splitFromCargo = (itemId: string, cargoId: string) => {
    persist({ ...record, syllabus: splitItem(record.syllabus, itemId, cargoId, makeId) });
  };

  return {
    syllabus: record.syllabus,
    concepts: record.concepts,
    save,
    renameItem,
    removeItem,
    addItem,
    splitFromCargo,
  };
}
