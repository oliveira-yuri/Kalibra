import { matchConcept, type Concept } from './concept';
import { type Syllabus, type SyllabusItem } from './syllabus';

export type SyllabusDiff = {
  added: SyllabusItem[];
  removed: SyllabusItem[];
  renamed: Array<{ from: SyllabusItem; to: SyllabusItem }>;
  unchanged: SyllabusItem[];
};

/**
 * A identidade de correlação de um item entre duas versões do edital não é
 * `item.id` — cada extração gera ids novos — nem sempre é `item.conceptId` bruto:
 * duas extrações independentes podem atribuir provisórios distintos ao mesmo
 * conteúdo real quando nenhuma delas casa direto com um conceito já `confirmed`
 * (restrição R4 de `shouldLinkDirectly`, ver dedup.ts). `matchConcept` resolve
 * isso contra a biblioteca de conceitos ATUAL — que já inclui os aliases que um
 * usuário ou uma aprovação de fusão podem ter registrado — e é exatamente essa
 * busca por alias que permite "Crase" e "Emprego do acento indicativo de crase"
 * caírem no mesmo conceito mesmo sendo, como texto puro, completamente distintos
 * (a distância de edição entre os dois não passaria de limiar nenhum). Cai de
 * volta em `item.conceptId` quando nada casa — nunca perde a identidade que o
 * item já carregava só porque a biblioteca de conceitos não tem (ou ainda não
 * tem) um alias para ele.
 */
function resolvedConceptId(item: SyllabusItem, concepts: readonly Concept[]): string {
  const match = matchConcept(item.sourceLabel, concepts);
  return match ? match.concept.id : item.conceptId;
}

/**
 * Compara duas versões de um programa de estudo (PD-08): editais são
 * republicados com retificações, e o usuário precisa ver o que mudou antes de
 * aceitar a nova estrutura. A regra que torna isso não-trivial: renomeado não é
 * remoção mais adição — um item cujo rótulo mudou mas cujo conceito é o mesmo
 * (via `conceptId` ou, na falta de coincidência direta, via alias em
 * `concepts`) aparece em `renamed`, preservando o histórico de estudo que um
 * "removido" + "adicionado" perderia. Um item cujo conceito não existia na
 * versão anterior é `added`; um cujo conceito sumiu na versão nova é `removed`
 * (o dado do item continua em `previous`, nunca apagado por este cálculo — ele
 * só sai da lista ativa); um item idêntico (mesmo conceito, mesmo rótulo) é
 * `unchanged`.
 */
export function diffSyllabus(previous: Syllabus, next: Syllabus, concepts: readonly Concept[]): SyllabusDiff {
  const prevByConcept = new Map<string, SyllabusItem>();
  for (const item of previous.items) {
    prevByConcept.set(resolvedConceptId(item, concepts), item);
  }

  const matchedConceptIds = new Set<string>();
  const added: SyllabusItem[] = [];
  const renamed: Array<{ from: SyllabusItem; to: SyllabusItem }> = [];
  const unchanged: SyllabusItem[] = [];

  for (const nextItem of next.items) {
    const conceptId = resolvedConceptId(nextItem, concepts);
    const prevItem = prevByConcept.get(conceptId);

    if (!prevItem) {
      added.push(nextItem);
      continue;
    }

    matchedConceptIds.add(conceptId);
    if (prevItem.sourceLabel === nextItem.sourceLabel) {
      unchanged.push(nextItem);
    } else {
      renamed.push({ from: prevItem, to: nextItem });
    }
  }

  const removed = previous.items.filter(
    (item) => !matchedConceptIds.has(resolvedConceptId(item, concepts)),
  );

  return { added, removed, renamed, unchanged };
}
