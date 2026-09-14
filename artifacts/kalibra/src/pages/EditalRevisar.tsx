import { useRef, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { AlertCircle, Info } from 'lucide-react';
import { useUser } from '@clerk/react';
import { clearPendingWorkspaceImport, getPendingWorkspaceImport, stageWorkspaceImport, useWorkspaces } from '@/domain/useWorkspaces';
import { useSyllabus } from '@/domain/useSyllabus';
import { useConcepts } from '@/domain/useConcepts';
import { useApprovals } from '@/domain/useApprovals';
import {
  nextActionFor, isCommon, diffSyllabus, splitItem, slugify, assertTransition, canTransition, canDecide,
  type ProposedConceptLink, type DedupResult, type Syllabus, type SyllabusItem,
  type SyllabusItemCargo, type Concept,
} from '@workspace/core';
import { SyllabusTree } from '@/components/SyllabusTree';
import { CargoFilter } from '@/components/CargoFilter';

/** Texto de rationale do PD-06 para uma proposta de fusão de conceito vinda da extração. */
function rationaleFor(link: ProposedConceptLink): string {
  const reason = link.reason === 'provisional_concept'
    ? 'o candidato mais próximo ainda é um conceito provisório'
    : 'o nome bateu, mas abaixo do limiar de ligação automática';
  return `A extração encontrou um item parecido com um conceito já existente (score ${link.score.toFixed(2)}) — ${reason}.`;
}

/** "Matéria · Tópico" quando o item tem pai; só o rótulo quando é uma matéria (PD-08). */
function subjectPrefixedLabel(syllabus: Syllabus, item: SyllabusItem): string {
  if (!item.parentItemId) return item.sourceLabel;
  const parent = syllabus.items.find((candidate) => candidate.id === item.parentItemId);
  return parent ? `${parent.sourceLabel} · ${item.sourceLabel}` : item.sourceLabel;
}

function makeReviewId(seed: string): string {
  return `${seed}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Versão de um payload de aprovação `edital_structure` — usada tanto para gravar quanto
 * para casar um item já enfileirado com a versão da URL atual (fix round 1 da Task 14). */
function versionFromPayload(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const version = payload.version;
  if (typeof version === 'string' && version) return version;
  if (typeof version === 'number') return String(version);
  return null;
}

/**
 * Reconstrói a proposta a partir do que está gravado na fila — fix round 1 da Task 14
 * (achados 1 e 2): a fila, persistida de forma durável e compartilhada entre abas, passa
 * a ser a ÚNICA fonte da proposta em revisão, nunca mais o armazenamento por aba usado
 * antes (perdido ao fechar a aba, reiniciar o navegador, ou abrir "Revisar estrutura" da
 * fila numa aba nova — o registro sumia por completo, e o item ficava pendente para
 * sempre, sem forma de decidir). Nunca lança: um
 * payload de formato desconhecido ou corrompido devolve `null`, tratado como "sem
 * proposta para revisar" em vez de derrubar a tela.
 */
function reviewFromPayload(payload: unknown): DedupResult | null {
  if (!isRecord(payload)) return null;
  const review = payload.review;
  if (!isRecord(review)) return null;
  const syllabus = review.syllabus;
  if (!isRecord(syllabus) || !Array.isArray(syllabus.items) || !Array.isArray(syllabus.links)) return null;
  if (!Array.isArray(review.merged) || !Array.isArray(review.newConcepts) || !Array.isArray(review.proposedLinks)) return null;
  return {
    syllabus: syllabus as unknown as Syllabus,
    merged: review.merged as unknown as DedupResult['merged'],
    newConcepts: review.newConcepts as unknown as Concept[],
    proposedLinks: review.proposedLinks as unknown as ProposedConceptLink[],
  };
}

// As quatro transformações puras abaixo espelham `useSyllabus.{renameItem,removeItem,
// addItem}`, mas DEVOLVEM em vez de persistir. Existem porque, enquanto uma extração
// ainda não foi confirmada, nada pode ser gravado (spec: "syllabus_item só nasce na
// aprovação") — mas o usuário ainda precisa poder editar a PROPOSTA antes de aprová-la.
// `splitItem` já é pura em lib/core; reaproveitada direto.

function renameSyllabusItem(syllabus: Syllabus, itemId: string, label: string): Syllabus {
  return {
    ...syllabus,
    items: syllabus.items.map((item) => (item.id === itemId ? { ...item, sourceLabel: label } : item)),
  };
}

function removeSyllabusItem(syllabus: Syllabus, itemId: string): Syllabus {
  return {
    items: syllabus.items
      .filter((item) => item.id !== itemId)
      .map((item) => (item.parentItemId === itemId ? { ...item, parentItemId: null } : item)),
    links: syllabus.links.filter((link) => link.syllabusItemId !== itemId),
  };
}

function updateSyllabusLink(
  syllabus: Syllabus,
  itemId: string,
  cargoId: string,
  patch: Partial<Pick<SyllabusItemCargo, 'weight' | 'questionCount'>>,
): Syllabus {
  return {
    ...syllabus,
    links: syllabus.links.map((link) =>
      (link.syllabusItemId === itemId && link.cargoId === cargoId ? { ...link, ...patch } : link)),
  };
}

function addSyllabusItemPure(
  syllabus: Syllabus,
  workspaceSlug: string,
  parentItemId: string | null,
  label: string,
  cargoIds: string[],
): { syllabus: Syllabus; concept: Concept } {
  const itemId = makeReviewId('item');
  const conceptId = makeReviewId('concept');

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
    syllabusItemId: itemId, cargoId, weight: null, questionCount: null,
  }));

  return {
    syllabus: { items: [...syllabus.items, item], links: [...syllabus.links, ...links] },
    concept,
  };
}

export function EditalRevisar({ workspaceSlug }: { workspaceSlug: string }) {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const params = useParams();
  const version = params.version || '1';
  const { workspaces, addWorkspace, updateWorkspace } = useWorkspaces(user?.id);
  const [pending] = useState(() => getPendingWorkspaceImport(workspaceSlug, user?.id));
  const workspace = pending?.workspace || workspaces.find((w) => w.slug === workspaceSlug);
  const syllabusApi = useSyllabus(workspaceSlug, user?.id);
  const conceptsApi = useConcepts(user?.id);
  const approvalsApi = useApprovals(user?.id);

  const [cargoFilter, setCargoFilter] = useState<string | null>(null);
  const [missing, setMissing] = useState<Record<string, string>>({});

  // Fix round 1 da Task 14 (achados 1 e 2 — "a fila é a fonte de verdade da própria
  // revisão"): a PROPOSTA em revisão e o item que a representa na fila nascem juntos,
  // num único inicializador preguiçoso, para nunca chamar `enqueue` duas vezes. Ordem
  // de busca:
  //   1. Já existe um item `edital_structure` PENDENTE desta versão neste workspace na
  //      fila (durável, compartilhada entre abas)? A proposta é `payloadAfter.review`
  //      DELE — nunca recomputada por `previewExtraction` (que geraria ids de conceito
  //      novos via `makeReviewId`/`Math.random` a cada montagem, desalinhando a tela do
  //      que está gravado). É o que permite decidir mesmo depois de fechar a aba,
  //      reiniciar o navegador, ou abrir "Revisar estrutura" da fila numa aba nova —
  //      nenhum desses casos tem o registro por aba de quando a extração terminou.
  //   2. Senão, se a extração acabou de terminar nesta aba (`pending.extractionOutput`,
  //      ainda não aplicada), a proposta nasce agora de `previewExtraction` — pura,
  //      não persiste nada — e É ENFILEIRADA agora, uma vez.
  //   3. Senão, não há proposta para revisar (`null`): edição normal de uma estrutura
  //      já confirmada antes.
  const [reviewState, setReviewState] = useState<{ review: DedupResult; approvalId: string } | null>(() => {
    const queued = approvalsApi.items.find((item) => (
      item.type === 'edital_structure'
      && item.workspaceId === workspaceSlug
      && versionFromPayload(item.payloadAfter) === version
      && canDecide(item.status)
    ));
    if (queued) {
      const resumed = reviewFromPayload(queued.payloadAfter);
      if (resumed) return { review: resumed, approvalId: queued.id };
    }

    if (!(pending?.extractionOutput && !pending.extractionApplied)) return null;

    const freshReview = syllabusApi.previewExtraction(pending.extractionOutput);
    const mergedCount = freshReview.syllabus.items.filter((item) => isCommon(freshReview.syllabus, item.id)).length;
    const id = approvalsApi.enqueue({
      workspaceId: workspaceSlug,
      type: 'edital_structure',
      title: `Estrutura extraída do edital · versão ${version}`,
      rationale: mergedCount > 0
        ? `${freshReview.syllabus.items.length} itens mapeados a partir do edital, ${mergedCount} deles comuns a mais de um cargo e unidos pela deduplicação.`
        : `${freshReview.syllabus.items.length} itens mapeados a partir do edital.`,
      sourceRef: null,
      targetConceptId: null,
      confidence: null,
      // `payloadBefore` é o programa hoje persistido — `null` só na primeira
      // importação (`pending.isNew`), quando não existe programa nenhum ainda.
      payloadBefore: pending?.isNew ? null : syllabusApi.syllabus,
      payloadAfter: { version, review: freshReview, mergedCount },
    }, new Date());

    return { review: freshReview, approvalId: id };
  });

  const review = reviewState?.review ?? null;
  const structureApprovalId = reviewState?.approvalId ?? null;

  // Idempotência de `handleConfirm`: um clique duplo antes da navegação não pode
  // persistir a mesma proposta duas vezes (duplicaria concept_merge na fila). A
  // marca em `pending.extractionApplied` (Task 11) fica só como sinal secundário —
  // `clearPendingWorkspaceImport` já remove o registro inteiro ao final do confirm.
  const confirmedRef = useRef(false);

  // O Syllabus efetivamente exibido: a proposta em revisão quando existe, senão o que
  // já está persistido (edição normal de uma estrutura já confirmada).
  const currentSyllabus = review ? review.syllabus : syllabusApi.syllabus;

  const uncertainFields = pending?.extractionOutput?.uncertainties ?? [];
  // Um item comum a mais de um cargo é exatamente o que `dedupeEntries` uniu — o spec
  // exige que o usuário entenda isso de cara, não que descubra sozinho (Task 12).
  const hasCommonItems = currentSyllabus.items.some((item) => isCommon(currentSyllabus, item.id));
  // PD-08: comparação entre versões de edital. `syllabusApi.syllabus` continua sendo o
  // "antes" de verdade enquanto não se confirma — nada foi sobrescrito ainda — e
  // `review.syllabus` é o "depois" proposto.
  const diff = review
    ? diffSyllabus(syllabusApi.syllabus, review.syllabus, syllabusApi.concepts)
    : null;

  const handleConfirm = () => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;

    // O texto de "próximo passo" vem sempre de `nextActionFor(status)` — nunca de um
    // texto solto aqui — para que o card nunca mostre uma frase que contradiz o chip de
    // status ao lado dela (ver regressão I2).
    const targetStatus = 'diagnostico_pendente' as const;
    const statusBeforeConfirm = pending?.isNew ? (pending.workspace?.status ?? targetStatus) : (workspace?.status ?? targetStatus);
    // Fix round 2 (crítico, corrige o achado menor do round 1): QUATRO dos nove status
    // não têm aresta para "diagnostico_pendente" — `sem_edital`, `aguardando_upload`,
    // `extraindo_edital` e `erro` (o comentário anterior dizia o contrário; estava
    // errado, `sem_edital` não é um caso coberto). Chamar `assertTransition` sobre uma
    // entrada vinda de estado persistido, dentro de um handler de clique sem nada para
    // pegar o throw, é exatamente o anti-padrão do Finding 1 — e aqui era pior, porque
    // o assert vinha DEPOIS das três escritas: uma entrada inválida deixava o Syllabus
    // e os conceitos gravados, a fila enfileirada, mas o status preso e a importação
    // pendente nunca limpa — um "torn write" do qual nem um segundo clique escapa
    // (`confirmedRef` já estaria marcado). A checagem com `canTransition` roda ANTES de
    // qualquer persistência: ou tudo acontece, ou nada acontece. Quando a aresta não é
    // válida, a proposta ainda é confirmada (é o que o botão promete) — só o status não
    // avança, e continua sendo o que já era.
    const canAdvanceStatus = statusBeforeConfirm === targetStatus || canTransition(statusBeforeConfirm, targetStatus);
    if (statusBeforeConfirm !== targetStatus && canAdvanceStatus) assertTransition(statusBeforeConfirm, targetStatus);
    const status = canAdvanceStatus ? targetStatus : statusBeforeConfirm;

    if (review) {
      // Só agora — na aprovação, nunca antes — "syllabus_item nasce": os conceitos
      // provisórios novos entram na biblioteca global, o Syllabus proposto vira o
      // Syllabus do workspace, e cada `proposedLink` vira um item `concept_merge` na
      // fila. As três escritas ficam juntas porque descrevem UMA decisão do usuário.
      review.newConcepts.forEach((concept) => conceptsApi.addConcept(concept));
      syllabusApi.save(review.syllabus);
      // Fix round 1 da Task 14 (achado 2): o registro aprovado passa a ser exatamente
      // a árvore que acabou de ser gravada acima — `review` já reflete qualquer edição
      // feita nesta tela (renomear, excluir, separar, mudar peso/questões, adicionar).
      // `approve(id, payload)` grava esse payload novo E decide o item numa única
      // escrita (`useApprovals.approve`), então o registro na fila e a gravação do
      // programa nunca podem divergir — são o MESMO objeto `review`, não duas cópias
      // que uma edição poderia desalinhar.
      if (structureApprovalId) {
        const mergedCount = review.syllabus.items.filter((item) => isCommon(review.syllabus, item.id)).length;
        approvalsApi.approve(structureApprovalId, { version, review, mergedCount });
      }

      const now = new Date();
      // `enqueue` é chamado uma vez por `proposedLink`, todas no mesmo tick — os hooks
      // de aprovação são ref-sincronizados exatamente para que as N chamadas
      // sobrevivam todas (ver approvals.test.ts e o teste desta tela).
      review.proposedLinks.forEach((link) => {
        approvalsApi.enqueue({
          workspaceId: workspaceSlug,
          type: 'concept_merge',
          title: `Fundir item extraído com "${link.conceptId}"`,
          rationale: rationaleFor(link),
          // Proveniência (de onde a proposta veio): o item do edital que a gerou.
          sourceRef: link.itemId,
          // O que a decisão muta: o conceito que a ligação propõe confirmar — NUNCA
          // `sourceRef` (achado da revisão da fila de aprovação: usar proveniência
          // aqui faria `confirmConcept` receber um id que não bate com nada, e a
          // aprovação "aplicaria" em silêncio, sem efeito).
          targetConceptId: link.conceptId,
          confidence: link.score,
          payloadBefore: { status: 'provisional' },
          payloadAfter: { conceptId: link.conceptId, itemId: link.itemId, score: link.score },
        }, now);
      });

      if (pending) stageWorkspaceImport(workspaceSlug, { ...pending, extractionApplied: true }, user?.id);
    }

    if (pending?.isNew && pending.workspace) {
      addWorkspace({
        ...pending.workspace,
        importStatus: 'completed',
        status,
        nextAction: nextActionFor(status),
      });
    } else {
      updateWorkspace(workspaceSlug, {
        ...(pending?.updates || {}),
        importStatus: 'completed',
        status,
        nextAction: nextActionFor(status),
      });
    }
    clearPendingWorkspaceImport(workspaceSlug, user?.id);
    setLocation('/edital');
  };

  const handleDiscard = () => {
    // Nada foi persistido por `review` — descartar é só esquecer a proposta em memória
    // e limpar a importação pendente. O Syllabus salvo nunca foi tocado. A decisão em
    // si, porém, fica registrada na fila (Task 14): rejeitar o item explicita que um
    // humano olhou a proposta e recusou, em vez de deixá-la pendente para sempre.
    if (structureApprovalId) approvalsApi.reject(structureApprovalId);
    clearPendingWorkspaceImport(workspaceSlug, user?.id);
    if (pending?.isNew) setLocation(`~${import.meta.env.BASE_URL}portal`);
    else setLocation('/edital');
  };

  const handleRename = (itemId: string, label: string) => {
    if (review) {
      setReviewState((current) => (current && {
        ...current, review: { ...current.review, syllabus: renameSyllabusItem(current.review.syllabus, itemId, label) },
      }));
    } else {
      syllabusApi.renameItem(itemId, label);
    }
  };

  const handleRemove = (itemId: string) => {
    if (review) {
      setReviewState((current) => (current && {
        ...current, review: { ...current.review, syllabus: removeSyllabusItem(current.review.syllabus, itemId) },
      }));
    } else {
      syllabusApi.removeItem(itemId);
    }
  };

  const handleSplit = (itemId: string, cargoId: string) => {
    if (review) {
      setReviewState((current) => (current && {
        ...current, review: { ...current.review, syllabus: splitItem(current.review.syllabus, itemId, cargoId, makeReviewId) },
      }));
    } else {
      syllabusApi.splitFromCargo(itemId, cargoId);
    }
  };

  const handleWeightChange = (itemId: string, cargoId: string, weight: number | null) => {
    if (review) {
      setReviewState((current) => (current && {
        ...current, review: { ...current.review, syllabus: updateSyllabusLink(current.review.syllabus, itemId, cargoId, { weight }) },
      }));
    } else {
      syllabusApi.updateLink(itemId, cargoId, { weight });
    }
  };

  const handleQuestionCountChange = (itemId: string, cargoId: string, questionCount: number | null) => {
    if (review) {
      setReviewState((current) => (current && {
        ...current, review: { ...current.review, syllabus: updateSyllabusLink(current.review.syllabus, itemId, cargoId, { questionCount }) },
      }));
    } else {
      syllabusApi.updateLink(itemId, cargoId, { questionCount });
    }
  };

  const handleAdd = (parentItemId: string | null) => {
    const label = window.prompt(parentItemId ? 'Nome do novo tópico' : 'Nome da nova matéria');
    if (!label?.trim()) return;
    const cargoIds = cargoFilter ? [cargoFilter] : (workspace?.cargos.map((cargo) => cargo.id) ?? []);
    if (review) {
      const { syllabus, concept } = addSyllabusItemPure(review.syllabus, workspaceSlug, parentItemId, label.trim(), cargoIds);
      setReviewState((current) => (current && {
        ...current, review: { ...current.review, syllabus, newConcepts: [...current.review.newConcepts, concept] },
      }));
    } else {
      syllabusApi.addItem(parentItemId, label.trim(), cargoIds);
    }
  };

  const fillMissing = (field: string) => {
    const value = window.prompt(`Preencher ${field}`);
    if (value?.trim()) setMissing((current) => ({ ...current, [field]: value.trim() }));
  };

  return (
    <div className="max-w-[800px] mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <p className="k-eyebrow">ESTRUTURA EXTRAÍDA DO EDITAL</p>
          <span className="k-chip">versão {version} · {currentSyllabus.items.length} itens mapeados</span>
        </div>
        <h1 className="text-[24px] font-semibold">Revise antes de confirmar.</h1>
        <p className="text-[13px] text-[#8e98a8]">Você pode renomear, mover, excluir e adicionar tópicos manualmente.</p>
      </header>

      {version !== '1' && diff && (
        <section className="p-5 bg-white dark:bg-[#131821] border border-[#d5dede] dark:border-[#29313d] rounded-sm space-y-4" data-testid="syllabus-diff">
          <h3 className="k-eyebrow">COMPARADO COM A VERSÃO {Number(version) - 1}</h3>

          <div>
            <div className="flex items-center gap-2 mb-2 text-[#6b8d00] dark:text-[#8ed9ae]">
              <span className="k-mono font-bold">+ {diff.added.length} adicionado{diff.added.length === 1 ? '' : 's'}</span>
            </div>
            {diff.added.length > 0 && (
              <ul className="pl-6 space-y-1 text-[12px] text-[#52616c] dark:text-[#aeb8c5]">
                {diff.added.map((addedItem) => (
                  <li key={addedItem.id}>{subjectPrefixedLabel(currentSyllabus, addedItem)}</li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2 text-[#c94f45] dark:text-[#ff907d]">
              <span className="k-mono font-bold">− {diff.removed.length} removido{diff.removed.length === 1 ? '' : 's'}</span>
            </div>
            {diff.removed.length > 0 && (
              <ul className="pl-6 space-y-1 text-[12px] text-[#52616c] dark:text-[#aeb8c5]">
                {diff.removed.map((removedItem) => (
                  <li key={removedItem.id}>
                    {subjectPrefixedLabel(syllabusApi.syllabus, removedItem)}
                    <div className="flex items-center gap-1 mt-1 text-[#c94f45] dark:text-[#ff907d] font-medium text-[10px]">
                      <AlertCircle size={12} /> pode ter histórico de estudo — o dado não é apagado, só sai da lista ativa
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2 text-[#6f7b85] dark:text-[#8e98a8]">
              <span className="k-mono font-bold">~ {diff.renamed.length} renomeado{diff.renamed.length === 1 ? '' : 's'}</span>
            </div>
            {diff.renamed.length > 0 && (
              <ul className="pl-6 space-y-1 text-[12px] text-[#52616c] dark:text-[#aeb8c5]">
                {diff.renamed.map(({ from, to }) => (
                  <li key={to.id}>"{from.sourceLabel}" → "{to.sourceLabel}"</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {workspace && workspace.cargos.length > 0 && (
        <div className="space-y-2">
          <p className="k-eyebrow">peso e questões editam para</p>
          <CargoFilter cargos={workspace.cargos} selected={cargoFilter} onSelect={setCargoFilter} />
        </div>
      )}

      {hasCommonItems && (
        <div className="k-card-soft p-4 flex items-start gap-3">
          <Info size={15} className="k-muted shrink-0 mt-0.5" />
          <p className="text-[12px] leading-5 k-muted">
            Conteúdos repetidos entre cargos foram unidos e aparecem uma vez só nesta lista — se a união não fizer sentido, use "Separar de &lt;cargo&gt;" no menu do item.
          </p>
        </div>
      )}

      <SyllabusTree
        syllabus={currentSyllabus}
        cargoId={cargoFilter}
        cargos={workspace?.cargos ?? []}
        onRename={handleRename}
        onRemove={handleRemove}
        onAdd={handleAdd}
        onSplit={handleSplit}
        onWeightChange={handleWeightChange}
        onQuestionCountChange={handleQuestionCountChange}
      />

      {uncertainFields.length > 0 && (
        <section className="p-5 bg-[#fff0ee] dark:bg-[#30201f] border border-[#db8f83] dark:border-[#ff907d] rounded-sm">
          <div className="flex items-center gap-2 font-semibold text-[#c94f45] dark:text-[#ff907d] mb-3">
            <AlertCircle size={16} />
            Não encontrado no edital
          </div>
          <ul className="pl-6 list-disc space-y-1 text-[13px] text-[#c94f45] dark:text-[#ff907d]">
            {uncertainFields.map((field) => (
              <li key={field}>
                {field}
                {missing[field] ? (
                  <span className="ml-2 font-medium text-[#16232b] dark:text-[#f0f0e8]">— {missing[field]}</span>
                ) : (
                  <button className="ml-2 text-[11px] underline" onClick={() => fillMissing(field)}>preencher</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex justify-end gap-3 pt-6">
        <button className="k-button k-button-quiet text-[#c94f45] dark:text-[#ff907d]" onClick={handleDiscard}>
          Descartar
        </button>
        <button className="k-button k-button-primary px-8" onClick={handleConfirm}>
          Confirmar estrutura
        </button>
      </div>
    </div>
  );
}
