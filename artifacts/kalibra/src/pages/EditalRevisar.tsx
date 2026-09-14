import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { AlertCircle, Info } from 'lucide-react';
import { useUser } from '@clerk/react';
import { clearPendingWorkspaceImport, getPendingWorkspaceImport, stageWorkspaceImport, useWorkspaces } from '@/domain/useWorkspaces';
import { useSyllabus } from '@/domain/useSyllabus';
import { useApprovals } from '@/domain/useApprovals';
import {
  nextActionFor, isCommon, diffSyllabus,
  type ProposedConceptLink, type Syllabus, type SyllabusItem,
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

export function EditalRevisar({ workspaceSlug }: { workspaceSlug: string }) {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const params = useParams();
  const version = params.version || '1';
  const { workspaces, addWorkspace, updateWorkspace } = useWorkspaces(user?.id);
  const [pending] = useState(() => getPendingWorkspaceImport(workspaceSlug, user?.id));
  const workspace = pending?.workspace || workspaces.find((w) => w.slug === workspaceSlug);
  const syllabusApi = useSyllabus(workspaceSlug, user?.id);
  const approvalsApi = useApprovals(user?.id);

  const [cargoFilter, setCargoFilter] = useState<string | null>(null);
  const [missing, setMissing] = useState<Record<string, string>>({});
  // Capturado só quando esta montagem de fato aplica uma extração nova (abaixo) — é o
  // "antes" do PD-08. `null` quando não há o que comparar (primeira versão, ou a tela
  // foi aberta sem uma importação pendente de verdade).
  const [previousSyllabus, setPreviousSyllabus] = useState<Syllabus | null>(null);

  // Roda `dedupeEntries` (Task 11) exatamente uma vez por importação pendente — a
  // guarda dupla (`appliedRef` nesta montagem + `extractionApplied` persistido) existe
  // porque só o ref não sobrevive a uma remontagem (usuário sai e volta à mesma tela
  // sem confirmar nem descartar), o que rodaria a deduplicação de novo e duplicaria
  // itens, conceitos provisórios e aprovações.
  const appliedRef = useRef(false);
  useEffect(() => {
    if (appliedRef.current) return;
    appliedRef.current = true;
    if (!pending?.extractionOutput || pending.extractionApplied) return;

    // Snapshot de ANTES de `applyExtraction` sobrescrever o Syllabus persistido —
    // o fechamento deste efeito (deps `[]`) vê o `syllabusApi.syllabus` carregado na
    // montagem, isto é, a versão anterior de verdade (Task 13).
    setPreviousSyllabus(syllabusApi.syllabus);
    const result = syllabusApi.applyExtraction(pending.extractionOutput);
    const now = new Date();
    // `enqueue` é chamado uma vez por `proposedLink`, todas no mesmo tick —
    // os hooks de aprovação são ref-sincronizados exatamente para que as N
    // chamadas sobrevivam todas (ver approvals.test.ts e o teste desta tela).
    result.proposedLinks.forEach((link) => {
      approvalsApi.enqueue({
        workspaceId: workspaceSlug,
        type: 'concept_merge',
        title: `Fundir item extraído com "${link.conceptId}"`,
        rationale: rationaleFor(link),
        // Proveniência (de onde a proposta veio): o item do edital que a gerou.
        sourceRef: link.itemId,
        // O que a decisão muta: o conceito que a ligação propõe confirmar —
        // NUNCA `sourceRef` (achado da revisão da fila de aprovação: usar
        // proveniência aqui faria `confirmConcept` receber um id que não bate
        // com nada, e a aprovação "aplicaria" em silêncio, sem efeito).
        targetConceptId: link.conceptId,
        confidence: link.score,
        payloadBefore: { status: 'provisional' },
        payloadAfter: { conceptId: link.conceptId, itemId: link.itemId, score: link.score },
      }, now);
    });
    stageWorkspaceImport(workspaceSlug, { ...pending, extractionApplied: true }, user?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda uma única vez, sobre o `pending` congelado na montagem.
  }, []);

  const uncertainFields = pending?.extractionOutput?.uncertainties ?? [];
  // Um item comum a mais de um cargo é exatamente o que `dedupeEntries` uniu — o spec
  // exige que o usuário entenda isso de cara, não que descubra sozinho (Task 12).
  const hasCommonItems = syllabusApi.syllabus.items.some((item) => isCommon(syllabusApi.syllabus, item.id));
  // PD-08: comparação entre versões de edital. Só existe algo a comparar quando esta
  // montagem realmente aplicou uma extração nova — sem isso, "versão 2" aberta sem
  // reimportar não tem "antes" nenhum para diffar contra.
  const diff = previousSyllabus
    ? diffSyllabus(previousSyllabus, syllabusApi.syllabus, syllabusApi.concepts)
    : null;

  const handleConfirm = () => {
    // O texto de "próximo passo" vem sempre de `nextActionFor(status)` — nunca de um
    // texto solto aqui — para que o card nunca mostre uma frase que contradiz o chip de
    // status ao lado dela (ver regressão I2).
    const status = 'diagnostico_pendente' as const;
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
    clearPendingWorkspaceImport(workspaceSlug, user?.id);
    if (pending?.isNew) setLocation(`~${import.meta.env.BASE_URL}portal`);
    else setLocation('/edital');
  };

  const handleAdd = (parentItemId: string | null) => {
    const label = window.prompt(parentItemId ? 'Nome do novo tópico' : 'Nome da nova matéria');
    if (!label?.trim()) return;
    const cargoIds = cargoFilter ? [cargoFilter] : (workspace?.cargos.map((cargo) => cargo.id) ?? []);
    syllabusApi.addItem(parentItemId, label.trim(), cargoIds);
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
          <span className="k-chip">versão {version} · {syllabusApi.syllabus.items.length} itens mapeados</span>
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
                  <li key={addedItem.id}>{subjectPrefixedLabel(syllabusApi.syllabus, addedItem)}</li>
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
                    {subjectPrefixedLabel(previousSyllabus!, removedItem)}
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
        syllabus={syllabusApi.syllabus}
        cargoId={cargoFilter}
        cargos={workspace?.cargos ?? []}
        onRename={syllabusApi.renameItem}
        onRemove={syllabusApi.removeItem}
        onAdd={handleAdd}
        onSplit={syllabusApi.splitFromCargo}
        onWeightChange={(itemId, cargoId, weight) => syllabusApi.updateLink(itemId, cargoId, { weight })}
        onQuestionCountChange={(itemId, cargoId, questionCount) => syllabusApi.updateLink(itemId, cargoId, { questionCount })}
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
