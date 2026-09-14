import { Check, GitMerge, ListChecks, X } from 'lucide-react';
import { Link } from 'wouter';
import { canDecide, type ApprovalItem, type ApprovalType } from '@/domain/useApprovals';
import { versionFromPayload } from '@/domain/edital-structure-payload';
import { ApprovalDiff } from './ApprovalDiff';

const TYPE_LABEL: Record<ApprovalType, string> = {
  edital_structure: 'estrutura do edital',
  concept_merge: 'fusão de conceito',
};

const TYPE_ICON: Record<ApprovalType, typeof ListChecks> = {
  edital_structure: ListChecks,
  concept_merge: GitMerge,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Quantos itens da proposta são comuns a mais de um cargo (Task 14) — `null`
 * quando o payload não traz a contagem (item de um formato anterior). */
function mergedCountFrom(payload: unknown): number | null {
  if (isRecord(payload) && typeof payload.mergedCount === 'number') return payload.mergedCount;
  return null;
}

/**
 * Link para a revisão desta estrutura, sempre no workspace DONO do item — nunca relativo
 * ao workspace em que o usuário está agora (achado da revisão do fix round 1 da Task 14:
 * a fila lista itens de todos os workspaces sem filtrar por `workspaceId`, e um href
 * relativo como `/edital/revisar/2` resolve contra a base do `WouterRouter` aninhado do
 * workspace ATUAL — `WorkspaceApp.tsx` — não a do dono da proposta; abrir a fila a partir
 * do workspace A e clicar num item do workspace B navegava para dentro de A). `~` escapa
 * esse Router aninhado (mesma convenção já usada em `EditalRevisar.tsx`), voltando à raiz
 * do app para montar o caminho absoluto do workspace certo.
 */
function reviewHrefFor(item: ApprovalItem): string {
  const version = versionFromPayload(item.payloadAfter);
  if (!item.workspaceId) return `/edital/revisar/${version}`;
  return `~${import.meta.env.BASE_URL}workspace/${item.workspaceId}/edital/revisar/${version}`;
}

export function ApprovalCard({
  item,
  collapsed,
  onToggleCollapse,
  onApprove,
  onReject,
  selected,
  onToggleSelect,
}: {
  item: ApprovalItem;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const decided = !canDecide(item.status);
  // `edital_structure` só pode ser decidido em `/edital/revisar/<versao>` — aprovar
  // por aqui gravaria a decisão na fila sem nunca escrever o programa de estudo
  // (Task 14: a persistência mora inteira em `EditalRevisar.handleConfirm`). Em vez
  // de expor um botão que "aprova" sem gravar nada, o cartão nem oferece a decisão
  // inline para este tipo — só o link para a tela onde a decisão de verdade acontece.
  const decidableInline = item.type !== 'edital_structure';
  const TypeIcon = TYPE_ICON[item.type];

  return (
    <article className="k-card p-5" data-testid={`card-approval-${item.id}`}>
      <div className="flex flex-col justify-between gap-4 md:flex-row">
        <div className="flex min-w-0 gap-4">
          {/* Item já decidido é terminal (`canDecide`) — não pode entrar numa aprovação em
              lote, então nem oferece a caixa de seleção. */}
          {!decided && decidableInline && (
            <input
              type="checkbox"
              className="mt-2 h-4 w-4 shrink-0"
              checked={selected}
              onChange={onToggleSelect}
              aria-label={`Selecionar "${item.title}" para aprovação em lote`}
              data-testid={`checkbox-select-${item.id}`}
            />
          )}
          <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-[#eef5d8] text-[#5f7900] dark:bg-[#202b20] dark:text-[#d5f35b]">
            {decided ? (item.status === 'aprovado' ? <Check size={16} /> : <X size={16} />) : <TypeIcon size={16} />}
          </span>
          <div className="min-w-0">
            <button
              className="flex items-center gap-2 text-left"
              onClick={onToggleCollapse}
              data-testid={`button-toggle-${item.id}`}
              aria-expanded={!collapsed}
            >
              <span className="k-mono k-muted text-[11px]">{collapsed ? '▸' : '▾'}</span>
              <p className="text-[14px] font-semibold">{item.title}</p>
            </button>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="k-chip">{TYPE_LABEL[item.type]}</span>
              {item.confidence !== null && (
                <span className="k-mono k-muted text-[10px]">confiança · {Math.round(item.confidence * 100)}%</span>
              )}
              {decided && (
                <span className={`k-chip ${item.status === 'aprovado' ? 'border-[#42604b] text-[#8ed9ae]' : 'border-[#75433e] text-[#ff907d]'}`}>
                  {item.status}
                </span>
              )}
            </div>
            {!collapsed && (
              <>
                {item.rationale && <p className="mt-3 max-w-[700px] text-[12px] leading-5 k-muted">{item.rationale}</p>}
                {item.sourceRef && <p className="k-mono mt-2 text-[10px] k-muted">fonte · {item.sourceRef}</p>}
                <div className="mt-3">
                  {item.type === 'edital_structure' ? (
                    <div className="k-card-soft flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[11px] leading-5 k-muted">
                        Estrutura extraída do edital — revise a árvore completa antes de confirmar.
                        {(() => {
                          const mergedCount = mergedCountFrom(item.payloadAfter);
                          if (!mergedCount) return null;
                          // "vem" no plural é "vêm" (circunflexo), nunca "vemm" — daí a
                          // palavra inteira trocada por condição, não um sufixo colado.
                          const verb = mergedCount === 1 ? 'já vem' : 'já vêm';
                          return ` ${mergedCount} ${mergedCount === 1 ? 'item é comum' : 'itens são comuns'} a mais de um cargo e ${verb} unido${mergedCount === 1 ? '' : 's'} na proposta.`;
                        })()}
                      </p>
                      {/* Achado R5 da re-revisão: um item JÁ DECIDIDO não pode convidar
                          para uma tela de revisão. Medido: um `edital_structure`
                          "aprovado" ainda renderizava este link; a tela do outro lado
                          só retoma propostas que `canDecide` autoriza, então abria sem
                          nada para revisar — e "Confirmar estrutura" ainda avançava o
                          status do workspace. `decidableInline` (acima) fechava só a
                          caixa de seleção e os botões inline; o link ficava de fora, e
                          era ele o caminho real para o dano. Decidido é terminal: o
                          cartão continua mostrando a decisão, sem oferecer uma ação que
                          não existe mais. */}
                      {!decided && (
                        <Link
                          href={reviewHrefFor(item)}
                          className="k-button k-button-quiet self-start whitespace-nowrap"
                          data-testid={`link-review-structure-${item.id}`}
                        >
                          Revisar estrutura
                        </Link>
                      )}
                    </div>
                  ) : (
                    <ApprovalDiff before={item.payloadBefore} after={item.payloadAfter} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        {!decided && decidableInline && (
          <div className="flex shrink-0 gap-2 self-start">
            <button className="k-button k-button-primary whitespace-nowrap" onClick={() => onApprove(item.id)} data-testid={`button-approve-${item.id}`}>
              <Check size={14} /> Aprovar
            </button>
            <button className="k-button k-button-quiet k-coral whitespace-nowrap" onClick={() => onReject(item.id)} data-testid={`button-reject-${item.id}`}>
              <X size={14} /> Rejeitar
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
