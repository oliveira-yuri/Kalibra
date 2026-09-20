import type { Concept } from '@workspace/core';

/**
 * A biblioteca global de conceitos do usuário — global por usuário, reutilizada
 * entre workspaces (§4.2 do spec do produto).
 *
 * Não há tipo próprio a declarar: `Concept` vive em `@workspace/core`, que já é o
 * lugar certo. Esta porta é só o contrato de operações.
 */
export interface ConceptsPort {
  useConcepts(userId?: string): {
    concepts: Concept[];
    addConcept(concept: Concept): void;
    confirmConcept(conceptId: string): void;
    renameConcept(conceptId: string, newCanonicalName: string): void;
  };
}
