import { Check, GitMerge, ListChecks, X } from 'lucide-react';
import { Link } from 'wouter';
import { canDecide, type ApprovalItem, type ApprovalType } from '@/domain/useApprovals';
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

/** `edital_structure` carrega a árvore inteira do edital — a versão vem do
 * próprio payload quando presente; sem ela, a revisão abre na versão 1. */
function versionFrom(payload: unknown): string {
  if (isRecord(payload)) {
    const version = payload.version;
    if (typeof version === 'string' && version) return version;
    if (typeof version === 'number') return String(version);
  }
  return '1';
}

export function ApprovalCard({
  item,
  collapsed,
  onToggleCollapse,
  onApprove,
  onReject,
}: {
  item: ApprovalItem;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const decided = !canDecide(item.status);
  const TypeIcon = TYPE_ICON[item.type];

  return (
    <article className="k-card p-5" data-testid={`card-approval-${item.id}`}>
      <div className="flex flex-col justify-between gap-4 md:flex-row">
        <div className="flex min-w-0 gap-4">
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
                      <p className="text-[11px] leading-5 k-muted">Estrutura extraída do edital — revise a árvore completa antes de confirmar.</p>
                      <Link
                        href={`/edital/revisar/${versionFrom(item.payloadAfter)}`}
                        className="k-button k-button-quiet self-start whitespace-nowrap"
                        data-testid={`link-review-structure-${item.id}`}
                      >
                        Revisar estrutura
                      </Link>
                    </div>
                  ) : (
                    <ApprovalDiff before={item.payloadBefore} after={item.payloadAfter} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        {!decided && (
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
