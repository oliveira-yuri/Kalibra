import type {
  Concept, DedupResult, ExtractionOutput, Syllabus, SyllabusItemCargo,
} from '@workspace/core';

/**
 * O programa de estudo de um workspace. Tipos vêm de `@workspace/core`.
 *
 * `previewExtraction` só COMPUTA a proposta (roda `dedupeEntries`); não grava nada.
 * Quem chama decide o que fazer com `newConcepts`, `proposedLinks` e `merged` — a
 * separação que o achado crítico do fix round 1 da Task 14 estabeleceu.
 */
export interface SyllabusPort {
  useSyllabus(workspaceSlug: string, userId?: string): {
    syllabus: Syllabus;
    concepts: Concept[];
    save(next: Syllabus): void;
    renameItem(itemId: string, label: string): void;
    removeItem(itemId: string): void;
    addItem(parentItemId: string | null, label: string, cargoIds: string[]): void;
    splitFromCargo(itemId: string, cargoId: string): void;
    linkToCargo(itemId: string, cargoId: string): void;
    unlinkFromCargo(itemId: string, cargoId: string): void;
    updateLink(
      itemId: string,
      cargoId: string,
      patch: Partial<Pick<SyllabusItemCargo, 'weight' | 'questionCount'>>,
    ): void;
    previewExtraction(output: ExtractionOutput): DedupResult;
  };
}
