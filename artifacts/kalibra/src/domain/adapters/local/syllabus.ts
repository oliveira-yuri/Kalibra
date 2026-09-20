import { useEffect, useRef, useState } from 'react';
import {
  emptySyllabus,
  splitItem,
  linkItemToCargo,
  unlinkItemFromCargo,
  slugify,
  dedupeEntries,
  type Syllabus,
  type SyllabusItem,
  type SyllabusItemCargo,
  type Concept,
  type ExtractionOutput,
  type DedupResult,
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

/**
 * Reaponta o `conceptId` de um item para o conceito-alvo de uma fusão aprovada —
 * achado I1 da revisão final: aprovar um `concept_merge` promovia o conceito-alvo a
 * `confirmed` (`applyApprovalSideEffects`, `approvals.ts`) mas nunca fazia a fusão em
 * si — o item que gerou a proposta continuava apontando para o seu próprio conceito
 * provisório novo, então cada reimportação acrescentava um conceito duplicado à
 * biblioteca global, para sempre. Devolve o `sourceLabel` do item (para virar alias do
 * conceito-alvo, ver `addConceptAlias` em `concepts.ts`) ou `null` quando o item não
 * existe mais neste programa. Escrita fora de hook, mesmo padrão de `confirmConcept`.
 */
export function repointSyllabusItemConcept(
  workspaceSlug: string, itemId: string, conceptId: string, userId?: string,
): string | null {
  const syllabus = getSyllabus(workspaceSlug, userId);
  const item = syllabus.items.find((candidate) => candidate.id === itemId);
  if (!item) return null;

  const next: Syllabus = {
    ...syllabus,
    items: syllabus.items.map((candidate) =>
      (candidate.id === itemId ? { ...candidate, conceptId } : candidate)),
  };
  saveSyllabus(next, workspaceSlug, userId);
  window.dispatchEvent(new Event('storage'));
  return item.sourceLabel;
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

  // Achado R3 da re-revisão: escrita durável PRIMEIRO, memória depois. Se a escrita
  // lança (cota esgotada), nada em memória pode afirmar um estado que o armazenamento
  // nunca teve — senão o retry do usuário parte dessa mentira e duplica.
  const persist = (next: Syllabus) => {
    saveSyllabus(next, workspaceSlug, userId);
    syllabusRef.current = next;
    setSyllabus(next);
    window.dispatchEvent(new Event('storage'));
  };

  const save = async (next: Syllabus) => persist(next);

  /**
   * Renomear é o momento natural em que um rótulo anterior vira alias do conceito
   * (achado C2/PD-08 da revisão final: "renomeado ≠ removido + adicionado" exige que
   * ALGUMA escrita registre essa equivalência — antes desta correção, nada em produção
   * jamais gravava um alias, então uma reimportação com o rótulo novo não tinha como
   * casar de volta com este conceito). O conceito é global (`concepts.ts`), então esta
   * renomeação já vale para qualquer outro workspace que o reutilize.
   */
  const renameItem = async (itemId: string, label: string) => {
    const item = syllabusRef.current.items.find((candidate) => candidate.id === itemId);
    if (item) conceptsApi.renameConcept(item.conceptId, label);
    persist({
      ...syllabusRef.current,
      items: syllabusRef.current.items.map((candidate) =>
        (candidate.id === itemId ? { ...candidate, sourceLabel: label } : candidate)),
    });
  };

  const removeItem = async (itemId: string) => {
    persist({
      items: syllabusRef.current.items
        .filter((item) => item.id !== itemId)
        .map((item) => (item.parentItemId === itemId ? { ...item, parentItemId: null } : item)),
      links: syllabusRef.current.links.filter((link) => link.syllabusItemId !== itemId),
    });
  };

  /** Escreve o conceito na biblioteca global (`concepts.ts`) e o item/ligações no workspace. */
  const addItem = async (parentItemId: string | null, label: string, cargoIds: string[]) => {
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

  const splitFromCargo = async (itemId: string, cargoId: string) => {
    persist(splitItem(syllabusRef.current, itemId, cargoId, makeId));
  };

  /** Liga um item existente a mais um cargo — a direção contrária à de `splitFromCargo` (Fase 1B.5). */
  const linkToCargo = async (itemId: string, cargoId: string) => {
    persist(linkItemToCargo(syllabusRef.current, itemId, cargoId));
  };

  /**
   * Exclui o item DAQUELE cargo — os outros cargos ficam com o item, o peso e a
   * quantidade de questões intactos. É o que "Excluir" faz quando o filtro está num
   * cargo só; `removeItem` (acima) continua sendo a exclusão de tudo. A regra de
   * subtópicos e a de "sem ligação nenhuma deixa de existir" vivem em `lib/core`.
   */
  const unlinkFromCargo = async (itemId: string, cargoId: string) => {
    persist(unlinkItemFromCargo(syllabusRef.current, itemId, cargoId));
  };

  /** Peso e quantidade de questões vivem na ligação item-cargo (o mesmo tópico vale diferente para cargos diferentes) — nunca no item. */
  const updateLink = async (
    itemId: string,
    cargoId: string,
    patch: Partial<Pick<SyllabusItemCargo, 'weight' | 'questionCount'>>,
  ) => {
    persist({
      ...syllabusRef.current,
      links: syllabusRef.current.links.map((link) =>
        (link.syllabusItemId === itemId && link.cargoId === cargoId ? { ...link, ...patch } : link)),
    });
  };

  /**
   * O único chamador de `dedupeEntries` (`@workspace/core`) em produção — a função
   * roda há muito só sob teste. Constrói a PROPOSTA de `Syllabus` a partir das entradas
   * brutas da extração, contra a biblioteca de conceitos JÁ carregada
   * (`conceptsApi.concepts`) — e só isso. `proposedLinks`, `newConcepts` e `merged`
   * voltam para quem chamou decidir o que fazer com eles.
   *
   * Achado da revisão (fix round 1, "Finding 2" — crítico): a versão anterior desta
   * função também gravava — `conceptsApi.addConcept` para cada `newConcepts` e
   * `persist(result.syllabus)` — só de ser CHAMADA, e `EditalRevisar` chamava no
   * mount. Abrir a tela de revisão sozinha, sem clicar em nada, já sobrescrevia
   * qualquer programa de estudo salvo antes de qualquer aprovação — o oposto exato do
   * que o spec exige ("`syllabus_item` só nasce na aprovação"). Esta função agora é
   * pura: não toca `localStorage`, não muda `conceptsRef`/`syllabusRef`. Quem decide
   * gravar o resultado (conceitos novos, Syllabus, itens de aprovação) é a ação de
   * confirmar da tela — nunca o simples ato de exibi-la. Ver `EditalRevisar.handleConfirm`.
   */
  const previewExtraction = (output: ExtractionOutput): DedupResult =>
    dedupeEntries(workspaceSlug, output.entries, conceptsApi.concepts, makeId);

  return {
    syllabus,
    concepts: conceptsApi.concepts,
    save,
    renameItem,
    removeItem,
    addItem,
    splitFromCargo,
    linkToCargo,
    unlinkFromCargo,
    updateLink,
    previewExtraction,
  };
}
