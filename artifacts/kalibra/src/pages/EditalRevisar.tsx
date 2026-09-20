import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { AlertCircle, Info } from 'lucide-react';
import { useUser } from '@clerk/react';
import { parseWorkspaceDraft, useWorkspaces } from '@/domain/useWorkspaces';
import type { WorkspaceDraft } from '@/domain/ports';
import {
  clearPendingWorkspaceImport, getPendingWorkspaceImport, stageWorkspaceImport,
} from '@/domain/staging';
import { useSyllabus } from '@/domain/useSyllabus';
import { useConcepts } from '@/domain/useConcepts';
import { useApprovals } from '@/domain/useApprovals';
import { versionFromPayload, comparedSyllabusVersion } from '@/domain/edital-structure-payload';
import {
  nextActionFor, isCommon, hasCommonItems, diffSyllabus, splitItem, linkItemToCargo, unlinkItemFromCargo, slugify, assertTransition, canTransition, canDecide,
  renameConcept,
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

/**
 * As incertezas do PD-06 ("Não encontrado no edital") — fix round 2 (achado B): antes,
 * esta tela só as lia de `pending.extractionOutput.uncertainties`, que não sobrevive a
 * uma revisão retomada da fila (sem `pending`, a lista virava `[]` e o bloco inteiro
 * sumia). Gravadas no mesmo payload da proposta agora, para que retomar da fila mostre
 * exatamente o que a extração não conseguiu achar, o mesmo dado que o humano decidindo
 * precisa ver — não menos, só porque a aba mudou.
 */
function uncertaintiesFromPayload(payload: unknown): string[] {
  if (!isRecord(payload)) return [];
  const uncertainties = payload.uncertainties;
  return Array.isArray(uncertainties) ? uncertainties.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * O rascunho do workspace ainda não criado — fix round 2 (achado A): quando a proposta é
 * de uma importação nova (`pending.isNew`), o workspace em si só é criado em
 * `handleConfirm`. Sem gravar esse rascunho no payload, retomar a revisão numa aba sem o
 * `pending` original (fechada/reiniciada) confirmava a estrutura — Syllabus, conceitos e
 * a própria aprovação — para um workspace que nunca chegava a existir: um `updateWorkspace`
 * sobre um slug ausente da lista é um `.map` que não casa nada, silenciosamente. Usa
 * `parseWorkspaceDraft` (a mesma validação, já testada, de qualquer registro de workspace
 * salvo) em vez de confiar cegamente no formato do payload.
 */
function workspaceDraftFromPayload(payload: unknown): WorkspaceDraft | null {
  if (!isRecord(payload)) return null;
  return parseWorkspaceDraft(payload.workspaceDraft);
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
  const persistedWorkspace = workspaces.find((w) => w.slug === workspaceSlug);
  const syllabusApi = useSyllabus(workspaceSlug, user?.id);
  const conceptsApi = useConcepts(user?.id);
  const approvalsApi = useApprovals(user?.id);

  const [cargoFilter, setCargoFilter] = useState<string | null>(null);
  const [missing, setMissing] = useState<Record<string, string>>({});
  // Fix round 3 (achado A residual): mensagem da recusa de `handleConfirm` quando nem o
  // workspace existe, nem o rascunho para criá-lo pôde ser reconstruído do payload.
  const [confirmError, setConfirmError] = useState<string | null>(null);

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
  type ReviewState = {
    review: DedupResult;
    approvalId: string;
    // Fix round 2 (achado B): as incertezas do PD-06 viajam com a proposta, não mais só
    // com `pending` — sem isto, retomar da fila escondia "Não encontrado no edital".
    uncertainties: string[];
    // Fix round 2 (achado A): o rascunho do workspace ainda não criado, quando esta
    // proposta é de uma importação nova — sem isto, retomar da fila confirmava a
    // estrutura para um workspace que `handleConfirm` nunca chegava a criar.
    workspaceDraft: WorkspaceDraft | null;
  };

  // Busca (1) acima: só LEITURA, nunca escreve — segura de rodar durante o render, como
  // inicializador preguiçoso de `useState`.
  const [reviewState, setReviewState] = useState<ReviewState | null>(() => {
    const queued = approvalsApi.items.find((item) => (
      item.type === 'edital_structure'
      && item.workspaceId === workspaceSlug
      && versionFromPayload(item.payloadAfter) === version
      && canDecide(item.status)
    ));
    if (!queued) return null;
    const resumed = reviewFromPayload(queued.payloadAfter);
    if (!resumed) return null;
    return {
      review: resumed,
      approvalId: queued.id,
      uncertainties: uncertaintiesFromPayload(queued.payloadAfter),
      workspaceDraft: workspaceDraftFromPayload(queued.payloadAfter),
    };
  });

  // Achado I4 da revisão final: buscas (2)/enfileirar acima chamavam `approvalsApi.enqueue`
  // — que grava em armazenamento durável e compartilhado entre abas e dispatcha
  // `storage` síncronamente — direto do inicializador preguiçoso do `useState`, ou
  // seja, DURANTE o render. Isso é um efeito
  // colateral fora do ciclo de efeitos do React (podia atualizar estado de um componente
  // ANCESTRAL de forma síncrona no meio da renderização desta árvore) e faz o app
  // depender de `StrictMode` estar desligado — ligá-lo dispara o render duas vezes e
  // enfileiraria a mesma proposta duas vezes. Movido para um efeito; a guarda de
  // idempotência original (buscar um item `edital_structure` já pendente que bate
  // workspaceId+versão antes de criar outro) continua sendo o que decide se este efeito
  // tem algo a fazer — `enqueuedRef` cobre só a lacuna que a guarda por si só não cobre
  // (duas invocações do efeito ANTES de o estado novo do primeiro `enqueue` se refletir
  // em `approvalsApi.items`, exatamente o que o duplo-disparo do StrictMode faz).
  const enqueuedRef = useRef(false);
  useEffect(() => {
    if (reviewState || enqueuedRef.current) return;
    if (!(pending?.extractionOutput && !pending.extractionApplied)) return;
    enqueuedRef.current = true;

    const freshReview = syllabusApi.previewExtraction(pending.extractionOutput);
    const mergedCount = freshReview.syllabus.items.filter((item) => isCommon(freshReview.syllabus, item.id)).length;
    const uncertainties = pending.extractionOutput.uncertainties ?? [];
    const workspaceDraft = pending?.isNew ? (pending.workspace ?? null) : null;
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
      payloadAfter: { version, review: freshReview, mergedCount, uncertainties, workspaceDraft },
    }, new Date());

    setReviewState({ review: freshReview, approvalId: id, uncertainties, workspaceDraft });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda uma vez por montagem; só precisa enfileirar quando nada foi retomado da fila (checado acima via ref + `reviewState`), nunca de novo a cada mudança de dependência.
  }, []);

  const review = reviewState?.review ?? null;
  const structureApprovalId = reviewState?.approvalId ?? null;
  // O rascunho do workspace nunca criado — de `pending` na mesma aba, ou da fila numa
  // retomada (fix round 2, achado A). `workspaceExists` decide, em `handleConfirm` e
  // `handleDiscard`, se ele ainda precisa ser criado ou se já é real.
  const workspaceDraft = pending?.workspace || reviewState?.workspaceDraft || null;
  const workspaceExists = !!persistedWorkspace;
  const workspace = pending?.workspace || persistedWorkspace || reviewState?.workspaceDraft || undefined;

  // Idempotência de `handleConfirm`: um clique duplo antes da navegação não pode
  // persistir a mesma proposta duas vezes (duplicaria concept_merge na fila). A
  // marca em `pending.extractionApplied` (Task 11) fica só como sinal secundário —
  // `clearPendingWorkspaceImport` já remove o registro inteiro ao final do confirm.
  const confirmedRef = useRef(false);

  // O Syllabus efetivamente exibido: a proposta em revisão quando existe, senão o que
  // já está persistido (edição normal de uma estrutura já confirmada).
  const currentSyllabus = review ? review.syllabus : syllabusApi.syllabus;

  const uncertainFields = reviewState?.uncertainties ?? [];

  // Achado R4 da re-revisão — por que estas duas derivações não podem depender do
  // objeto `Syllabus` inteiro. Editar um peso devolve `{...syllabus, links: [...]}`:
  // objeto NOVO a cada tecla, mas `items` é literalmente o MESMO array, e a topologia
  // das ligações (quem está ligado a quem) é a mesma — só um número dentro de uma
  // ligação mudou. O `useMemo` do fix wave anterior dependia de `review` e de
  // `currentSyllabus`, os dois objetos recriados por tecla: medido, o memo economizava
  // exatamente UMA chamada (a da montagem) e nenhuma durante a digitação — 4 chamadas
  // de `diffSyllabus` depois de 3 teclas, contra 5 sem memo nenhum. As dependências
  // abaixo são só o que uma edição de peso NÃO pode tocar.
  const currentItems = currentSyllabus.items;
  const currentLinks = currentSyllabus.links;
  // A topologia das ligações como chave: `hasCommonItems` conta em quantos cargos cada
  // item está, nunca lê `weight`/`questionCount` — mudar só o peso não pode mudar a
  // resposta. Montar esta chave é O(ligações).
  const linkTopology = useMemo(
    () => JSON.stringify(currentLinks.map((link) => [link.syllabusItemId, link.cargoId])),
    [currentLinks],
  );
  // Um item comum a mais de um cargo é exatamente o que `dedupeEntries` uniu — o spec
  // exige que o usuário entenda isso de cara, não que descubra sozinho (Task 12).
  const anyCommonItem = useMemo(
    () => hasCommonItems({ items: currentItems, links: currentLinks }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `currentLinks` entra pela chave `linkTopology`, de propósito: mudar só o peso de uma ligação não muda a resposta, e re-executar por isso é o achado R4.
    [currentItems, linkTopology],
  );

  // PD-08: comparação entre versões de edital. `syllabusApi.syllabus` continua sendo o
  // "antes" de verdade enquanto não se confirma — nada foi sobrescrito ainda — e
  // `review.syllabus` é o "depois" proposto. `diffSyllabus` compara RÓTULO e CONCEITO:
  // lê só `.items` dos dois lados mais a biblioteca de conceitos (ver `diff.ts`, e o
  // teste que fixa isso em `diff.test.ts`) — `links` não entra no cálculo, então uma
  // edição de peso não pode mudar o resultado e não deve custar os 339 ms medidos para
  // 260 itens.
  const reviewItems = review?.syllabus.items;
  const diff = useMemo(
    () => (review ? diffSyllabus(syllabusApi.syllabus, review.syllabus, syllabusApi.concepts) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `review` inteiro é recriado a cada tecla de peso; `review.syllabus.items` é o único pedaço dele que o diff lê (achado R4).
    [reviewItems, syllabusApi.syllabus, syllabusApi.concepts],
  );

  // Achado R1 da re-revisão: o bloco de comparação do PD-08 era gated em
  // `version !== '1'`. Enquanto `Edital.tsx` passava o literal `2`, isso era inofensivo
  // por acidente; quando a versão passou a ser apurada de verdade, todo workspace já
  // existente sem contador gravado voltava a apurar 1 — e a tela de REIMPORTAÇÃO, cuja
  // única razão de existir é mostrar o que mudou numa retificação, escondia a
  // comparação inteira. O número da versão nunca foi o sinal certo: o sinal é existir
  // um programa salvo com que comparar, e o rótulo tem que nomear uma versão que de
  // fato existiu (achado R2) — nunca `versão da URL − 1`, aritmética que inventa
  // versões assim que qualquer número é pulado.
  const versionNumber = Number.parseInt(version, 10);
  const hasSavedProgramme = syllabusApi.syllabus.items.length > 0;
  const comparedVersion = comparedSyllabusVersion(
    approvalsApi.items, workspaceSlug, Number.isInteger(versionNumber) ? versionNumber : null, hasSavedProgramme,
  );

  const handleConfirm = () => {
    if (confirmedRef.current) return;

    // Achado R5 da re-revisão: "Confirmar estrutura" não pode avançar o workspace
    // quando não há proposta nenhuma para confirmar. Medido: um item `edital_structure`
    // JÁ APROVADO ainda oferecia "Revisar estrutura" na fila (o outro lado deste
    // achado, corrigido em `ApprovalCard.tsx`); o link abria esta tela, a busca de
    // retomada exige `canDecide` e portanto não achava nada, a tela mostrava zero
    // proposta — e "Confirmar estrutura" mesmo assim levava o workspace de
    // `aguardando_revisao_edital` para `diagnostico_pendente`. A recusa do fix round 3
    // não pegava esse caso por estar gated em `review &&`: sem `review`, ela nunca
    // disparava. Sem proposta, confirmar não tem objeto — recusa antes de qualquer
    // escrita, em vez de avançar um estado que ninguém decidiu.
    if (!review) {
      setConfirmError(
        'Não há proposta de estrutura para revisar nesta versão — nada foi alterado. Ela pode já ter sido decidida: abra a fila de aprovação para ver o registro.',
      );
      return;
    }

    // Fix round 3 (achado A residual): "carregar o que precisa, ou recusar completar".
    // O fix round 2 implementou o carregar; faltava o recusar. Quando existe uma
    // proposta para revisar mas o workspace nem existe de verdade (`workspaceExists`)
    // nem tem rascunho reconstruível (`workspaceDraft` — `null` para um item enfileirado
    // no formato anterior ao fix round 2, ou com um rascunho corrompido que
    // `parseWorkspaceDraft` rejeita), não há como completar sem inventar dado. Recusa ANTES
    // de qualquer escrita: nada é gravado, o item continua pendente na fila (decidível
    // de novo caso o dado apareça por outro caminho), e a tela explica o motivo em vez
    // de cair, em silêncio, no `updateWorkspace` de um slug que não existe — exatamente
    // o "no-op silencioso" que o achado A original apontou.
    if (!workspaceDraft && !workspaceExists) {
      setConfirmError(
        'Não foi possível recuperar os dados deste workspace para confirmar a importação. Reimporte o edital para tentar de novo.',
      );
      return;
    }
    setConfirmError(null);
    confirmedRef.current = true;

    // Achado I5 da revisão final: esta sequência inteira (gravar conceitos, Syllabus,
    // a decisão da fila, N `concept_merge`, e por fim o workspace) é feita de escritas
    // NUAS no armazenamento durável — nenhuma delas trata cota esgotada, e a fila
    // guarda cópias inteiras do Syllabus em todo item (nunca podada), então cota
    // esgotada é o regime estacionário esperado, não uma hipótese remota. Sem este
    // `try/catch`, uma falha NO MEIO da sequência deixava uma escrita pela metade
    // (programa salvo, aprovação indecisa, status não avançado) E `confirmedRef` preso
    // em `true` para sempre — um retry vira no-op silencioso porque a guarda do topo
    // devolve cedo. O catch desfaz a trava (`confirmedRef.current = false`) e mostra o
    // erro no mesmo bloco visual que o achado A residual já usa, para que o usuário
    // veja que algo falhou e possa tentar de novo — não uma camada transacional
    // completa (fora de escopo), só a garantia mínima de "nunca fica preso, sempre dá
    // pra tentar de novo".
    try {
      // O texto de "próximo passo" vem sempre de `nextActionFor(status)` — nunca de um
      // texto solto aqui — para que o card nunca mostre uma frase que contradiz o chip
      // de status ao lado dela (ver regressão I2).
      const targetStatus = 'diagnostico_pendente' as const;
      // `workspace` já resolve para o rascunho certo em qualquer um dos três casos
      // (mesma aba com `pending`, retomada da fila, ou edição normal já confirmada) —
      // não precisa mais de um `if (pending?.isNew)` separado aqui (fix round 2).
      const statusBeforeConfirm = workspace?.status ?? targetStatus;
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

      // `review` é garantidamente não-nulo aqui: a recusa do achado R5, no topo desta
      // função, já devolveu cedo quando não há proposta para confirmar.
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
        // `uncertainties` viaja para o registro aprovado por completude (fix round 2,
        // achado B); `workspaceDraft` vira `null` — a partir daqui o workspace É real
        // (gravado logo abaixo), não falta mais criar. Achado I5 da revisão final:
        // `newConcepts` vira `[]` — já foi escrito na biblioteca global na linha acima,
        // então guardar outra cópia inteira dentro do item decidido é só peso morto
        // que a fila nunca poda (o mesmo `review.syllabus` continua inteiro aqui, de
        // propósito: é o que a Task 14/fix round 1 usa para provar que o registro
        // aprovado é a árvore que de fato foi gravada).
        approvalsApi.approve(structureApprovalId, {
          version,
          review: { ...review, newConcepts: [] },
          mergedCount,
          uncertainties: reviewState?.uncertainties ?? [],
          workspaceDraft: null,
        });
      }

      const now = new Date();
      // `enqueue` é chamado uma vez por `proposedLink`, todas no mesmo tick — os hooks
      // de aprovação são ref-sincronizados exatamente para que as N chamadas
      // sobrevivam todas (ver approvals.test.ts e o teste desta tela).
      //
      // Achado R3 da re-revisão: desde que o confirmar virou RETENTÁVEL (achado I5 do
      // fix wave anterior: uma falha no meio desfaz o trinco para o usuário tentar de
      // novo), este laço rodava inteiro de novo a cada tentativa — e `enqueue` carimba
      // um id novo em cada chamada, então o retry duplicava na fila as fusões que a
      // primeira tentativa já tinha gravado. A guarda é por CONTEÚDO, não por um ref
      // de progresso: sobrevive a uma remontagem da tela, que é quando um trinco em
      // memória não existe mais. Uma fusão é a mesma quando aponta para o mesmo
      // conceito-alvo a partir do mesmo item de origem, no mesmo workspace.
      const mergeKey = (conceptId: string | null, itemId: string | null) => `${conceptId}→${itemId}`;
      const alreadyEnqueued = new Set(
        approvalsApi.items
          .filter((item) => item.type === 'concept_merge' && item.workspaceId === workspaceSlug)
          .map((item) => mergeKey(item.targetConceptId, item.sourceRef)),
      );
      review.proposedLinks.forEach((link) => {
        if (alreadyEnqueued.has(mergeKey(link.conceptId, link.itemId))) return;
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

      // Fix round 2 (achado A, crítico): antes, só `pending.isNew && pending.workspace`
      // decidia entre criar e atualizar — e `pending` está vazio numa retomada da fila
      // (aba fechada/reiniciada). O `else` rodava `updateWorkspace` sobre um slug ausente
      // da lista: um `.map` que não casa nada, silenciosamente — a aprovação e o Syllabus
      // ficavam gravados, mas o workspace nunca chegava a existir. `workspaceDraft` agora
      // vem de `pending` OU do payload da fila (achado A); `workspaceExists` decide entre
      // criar e atualizar, não mais só `pending.isNew` — cobre o caso de a criação ainda
      // não ter acontecido, venha o rascunho de onde vier.
      if (workspaceDraft && !workspaceExists) {
        addWorkspace({
          ...workspaceDraft,
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
    } catch (error) {
      console.error('Falha ao confirmar a estrutura do edital.', error);
      confirmedRef.current = false;
      setConfirmError(
        'Não foi possível salvar a estrutura confirmada agora (armazenamento local indisponível ou cheio). Nada foi perdido — tente confirmar de novo.',
      );
    }
  };

  const handleDiscard = () => {
    // Nada foi persistido por `review` — descartar é só esquecer a proposta em memória
    // e limpar a importação pendente. O Syllabus salvo nunca foi tocado. A decisão em
    // si, porém, fica registrada na fila (Task 14): rejeitar o item explicita que um
    // humano olhou a proposta e recusou, em vez de deixá-la pendente para sempre.
    if (structureApprovalId && review) {
      // Fix round 3 (achado B): rejeitar também anula `workspaceDraft` — ele carrega o
      // edital colado inteiro (`sourceBlocks`, um bloco por cargo mais o comum, desde a
      // Fase 1B.5), e uma decisão rejeitada é tão terminal
      // quanto uma aprovada; nada volta a ler esse rascunho depois de decidido. Sem
      // isto, um item rejeitado guardava o texto colado para sempre (a fila não poda
      // itens decididos).
      const mergedCount = review.syllabus.items.filter((item) => isCommon(review.syllabus, item.id)).length;
      // Achado I5 da revisão final: mesma poda de `newConcepts` que `approve` faz — um
      // item rejeitado nunca vai gravar esses conceitos, então mantê-los aqui é só peso
      // morto que a fila nunca poda.
      approvalsApi.reject(structureApprovalId, undefined, {
        version, review: { ...review, newConcepts: [] }, mergedCount, uncertainties: reviewState?.uncertainties ?? [], workspaceDraft: null,
      });
    }
    clearPendingWorkspaceImport(workspaceSlug, user?.id);
    // O mesmo `workspaceDraft`/`workspaceExists` do confirmar (fix round 2, achado A):
    // descartar numa retomada de importação nova, cujo workspace nunca chegou a existir,
    // não pode mandar o usuário para `/edital` de um workspace fantasma — volta ao
    // portal, como já acontecia quando `pending.isNew` vinha preenchido na mesma aba.
    if (workspaceDraft && !workspaceExists) setLocation(`~${import.meta.env.BASE_URL}portal`);
    else setLocation('/edital');
  };

  const handleRename = (itemId: string, label: string) => {
    if (review) {
      // Achado C2/PD-08 da revisão final: renomear um item AINDA EM REVISÃO é o
      // momento em que o rótulo anterior deixa de existir em qualquer lugar — se o
      // conceito que este item aponta nasceu nesta MESMA extração (está em
      // `review.newConcepts`, ainda não escrito na biblioteca global), a renomeação
      // atualiza o nome canônico dele e empilha o anterior como alias
      // (`renameConcept`, `lib/core`), para que uma reimportação futura com a redação
      // NOVA — ou uma versão já persistida do edital com a redação ANTIGA — continue
      // casando com o MESMO conceito em vez de virar "removido" + "adicionado" em
      // `diffSyllabus`. Um item cujo conceito já existia ANTES desta extração (não
      // está em `newConcepts`) só tem o rótulo do item alterado aqui — ver a nota em
      // `useSyllabus.renameItem` para o caminho equivalente sobre um item já
      // confirmado.
      setReviewState((current) => {
        if (!current) return current;
        const item = current.review.syllabus.items.find((candidate) => candidate.id === itemId);
        const newConcepts = item
          ? current.review.newConcepts.map((concept) =>
              (concept.id === item.conceptId ? renameConcept(concept, label) : concept))
          : current.review.newConcepts;
        return {
          ...current,
          review: {
            ...current.review,
            syllabus: renameSyllabusItem(current.review.syllabus, itemId, label),
            newConcepts,
          },
        };
      });
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

  /**
   * Exclui o item de UM cargo — os demais continuam com ele, com peso e quantidade
   * intactos (critério de aceite "alterar um cargo não contamina os demais"). Os dois
   * ramos existem porque as duas fontes de verdade desta tela existem: a proposta em
   * revisão, que ainda não foi gravada em lugar nenhum, e o programa já persistido.
   * Implementar um só deixaria metade dos casos sem a correção.
   */
  const handleRemoveFromCargo = (itemId: string, cargoId: string) => {
    if (review) {
      setReviewState((current) => (current && {
        ...current, review: { ...current.review, syllabus: unlinkItemFromCargo(current.review.syllabus, itemId, cargoId) },
      }));
    } else {
      syllabusApi.unlinkFromCargo(itemId, cargoId);
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

  /** Liga um item existente a mais um cargo — a direção contrária à de `handleSplit` (Fase 1B.5). */
  const handleLinkToCargo = (itemId: string, cargoId: string) => {
    if (review) {
      setReviewState((current) => (current && {
        ...current, review: { ...current.review, syllabus: linkItemToCargo(current.review.syllabus, itemId, cargoId) },
      }));
    } else {
      syllabusApi.linkToCargo(itemId, cargoId);
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
        <p className="text-[13px] text-[#8e98a8]">Você pode renomear, excluir e adicionar tópicos manualmente.</p>
      </header>

      {diff && comparedVersion !== null && (
        <section className="p-5 bg-white dark:bg-[#131821] border border-[#d5dede] dark:border-[#29313d] rounded-sm space-y-4" data-testid="syllabus-diff">
          <h3 className="k-eyebrow">COMPARADO COM A VERSÃO {comparedVersion}</h3>

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

      {anyCommonItem && (
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
        onRemoveFromCargo={handleRemoveFromCargo}
        onAdd={handleAdd}
        onSplit={handleSplit}
        onLinkToCargo={handleLinkToCargo}
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

      {confirmError && (
        <div className="p-4 border border-[#db8f83] bg-[#fff0ee] dark:bg-[#30201f] dark:border-[#ff907d] rounded-[4px] flex gap-3 text-[#c94f45] dark:text-[#ff907d]" data-testid="confirm-error">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p className="text-[12px] font-medium">{confirmError}</p>
        </div>
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
