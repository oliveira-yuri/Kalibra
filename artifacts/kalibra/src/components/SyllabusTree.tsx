import { useState, type ReactElement } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import { cargosFor, isCommon, type Syllabus, type SyllabusItem } from '@workspace/core';
import type { Cargo } from '@/domain/useWorkspaces';
import { SourceExcerpt } from './SourceExcerpt';

const UNCERTAIN_CHIP = 'k-chip border-[#db8f83] text-[#c94f45] dark:border-[#ff907d] dark:text-[#ff907d]';

function linkFor(syllabus: Syllabus, itemId: string, cargoId: string) {
  return syllabus.links.find((link) => link.syllabusItemId === itemId && link.cargoId === cargoId);
}

/**
 * Peso não é aditivo entre cargos (é porcentagem do total daquele cargo) — o
 * consolidado de "todos os cargos" é o maior valor informado, não a soma.
 * `null` só quando nenhum cargo tem peso registrado para o item.
 */
function consolidatedWeight(syllabus: Syllabus, itemId: string): number | null {
  const weights = syllabus.links
    .filter((link) => link.syllabusItemId === itemId)
    .map((link) => link.weight)
    .filter((weight): weight is number => weight !== null);
  return weights.length === 0 ? null : Math.max(...weights);
}

function consolidatedQuestions(syllabus: Syllabus, itemId: string): number {
  const counts = syllabus.links.filter((link) => link.syllabusItemId === itemId).map((link) => link.questionCount ?? 0);
  return counts.length === 0 ? 0 : Math.max(...counts);
}

function parseNumberOrNull(raw: string): number | null {
  return raw.trim() === '' ? null : Number(raw);
}

/**
 * A árvore de revisão do edital (PD-06). Mantém o layout de `EditalRevisar` já
 * existente (matéria em negrito, tópicos indentados com borda à esquerda, menu de três
 * pontos) e passa a desenhar dados reais: peso/quantidade por cargo (Task 11), trecho-
 * fonte colapsável, o chip coral de incerteza e — Task 12 — a deduplicação visível: um
 * item ligado a mais de um cargo ganha o chip "N cargos" e "Separar de <cargo>" no menu,
 * a resposta do spec para "a IA deduplicou errado".
 */
export function SyllabusTree({
  syllabus,
  cargoId,
  cargos,
  onRename,
  onRemove,
  onAdd,
  onSplit,
  onWeightChange,
  onQuestionCountChange,
}: {
  syllabus: Syllabus;
  /** `null` = "todos os cargos": peso e quantidade ficam consolidados e somente leitura — o modelo os separa por cargo exatamente para não perder essa distinção. */
  cargoId: string | null;
  /** Cargos do workspace, só para rotular "Separar de <cargo>" no menu de um item comum. */
  cargos: Cargo[];
  onRename(itemId: string, label: string): void;
  onRemove(itemId: string): void;
  onAdd(parentItemId: string | null): void;
  onSplit(itemId: string, cargoId: string): void;
  onWeightChange(itemId: string, cargoId: string, weight: number | null): void;
  onQuestionCountChange(itemId: string, cargoId: string, questionCount: number | null): void;
}): ReactElement {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const visible = cargoId === null
    ? syllabus.items
    : syllabus.items.filter((item) => cargosFor(syllabus, item.id).includes(cargoId));
  const visibleIds = new Set(visible.map((item) => item.id));
  const topLevel = visible.filter((item) => item.parentItemId === null || !visibleIds.has(item.parentItemId));
  const childrenOf = (parentId: string) => visible.filter((item) => item.parentItemId === parentId);

  const renderFields = (item: SyllabusItem) => {
    if (cargoId === null) {
      const weight = consolidatedWeight(syllabus, item.id);
      const questions = consolidatedQuestions(syllabus, item.id);
      return (
        <div className="flex items-center gap-1 shrink-0">
          <input className="k-input w-[56px] text-right" value={weight ?? ''} placeholder="%" disabled data-testid={`input-peso-${item.id}`} />
          <input className="k-input w-[48px] text-right" value={questions || ''} placeholder="qtd" disabled data-testid={`input-questoes-${item.id}`} />
        </div>
      );
    }
    const link = linkFor(syllabus, item.id, cargoId);
    return (
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number"
          className="k-input w-[56px] text-right"
          value={link?.weight ?? ''}
          placeholder="%"
          onChange={(event) => onWeightChange(item.id, cargoId, parseNumberOrNull(event.target.value))}
          data-testid={`input-peso-${item.id}`}
        />
        <input
          type="number"
          className="k-input w-[48px] text-right"
          value={link?.questionCount ?? ''}
          placeholder="qtd"
          onChange={(event) => onQuestionCountChange(item.id, cargoId, parseNumberOrNull(event.target.value))}
          data-testid={`input-questoes-${item.id}`}
        />
      </div>
    );
  };

  const cargoName = (id: string) => cargos.find((cargo) => cargo.id === id)?.name || id;

  const renderMenu = (item: SyllabusItem) => {
    if (openMenu !== item.id) return null;
    const common = isCommon(syllabus, item.id);
    return (
      <div className="absolute right-2 top-8 z-10 flex w-44 flex-col border border-[#d5dede] bg-white p-1 shadow-lg dark:border-[#394452] dark:bg-[#161b23]">
        <button
          className="k-button k-button-quiet justify-start text-[10px]"
          onClick={() => {
            const label = window.prompt('Renomear', item.sourceLabel);
            if (label?.trim()) onRename(item.id, label.trim());
            setOpenMenu(null);
          }}
          data-testid={`button-rename-${item.id}`}
        >
          Renomear
        </button>
        {common && cargosFor(syllabus, item.id).map((linkedCargoId) => (
          <button
            key={linkedCargoId}
            className="k-button k-button-quiet justify-start text-[10px]"
            onClick={() => { onSplit(item.id, linkedCargoId); setOpenMenu(null); }}
            data-testid={`button-split-${item.id}-${linkedCargoId}`}
          >
            Separar de {cargoName(linkedCargoId)}
          </button>
        ))}
        <button
          className="k-button k-button-quiet justify-start text-[10px] text-[#c94f45] dark:text-[#ff907d]"
          onClick={() => { onRemove(item.id); setOpenMenu(null); }}
          data-testid={`button-remove-${item.id}`}
        >
          Excluir
        </button>
      </div>
    );
  };

  const renderRow = (item: SyllabusItem, topLevelRow: boolean) => {
    const itemCargos = cargosFor(syllabus, item.id);
    const common = itemCargos.length > 1;
    return (
    <div
      key={item.id}
      className={topLevelRow ? '' : 'relative flex flex-col group hover:bg-[#f1f4f2] dark:hover:bg-[#1a2029] p-1.5 px-3 rounded-sm transition-colors'}
      data-testid={`row-syllabus-item-${item.id}`}
    >
      <div className="relative flex items-center justify-between">
        <div className={topLevelRow ? 'flex items-center gap-2 font-semibold text-[14px]' : 'flex items-center gap-2 text-[13px]'}>
          {topLevelRow && <span className="text-[#8e98a8]">▾</span>}
          <span>{item.sourceLabel}</span>
          {item.uncertain && <span className={UNCERTAIN_CHIP} data-testid={`chip-uncertain-${item.id}`}>incerto</span>}
          {common && <span className="k-chip" data-testid={`chip-common-${item.id}`}>{itemCargos.length} cargos</span>}
        </div>
        <div className="flex items-center gap-2">
          {renderFields(item)}
          <button
            className="opacity-40 group-hover:opacity-100 k-icon-button !w-6 !h-6"
            onClick={() => setOpenMenu(openMenu === item.id ? null : item.id)}
            aria-label={`Ações para ${item.sourceLabel}`}
            data-testid={`button-item-menu-${item.id}`}
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
        {renderMenu(item)}
      </div>
      <SourceExcerpt excerpt={item.sourceExcerpt} page={item.page} />
      {topLevelRow && (
        <div className="pl-6 mt-2 space-y-1 border-l-2 border-[#f1f4f2] dark:border-[#1a2029] ml-2">
          {childrenOf(item.id).map((child) => renderRow(child, false))}
          <button
            className="flex items-center gap-2 p-1.5 px-3 text-[12px] text-[#8e98a8] hover:text-[#16232b] dark:hover:text-[#f0f0e8] font-medium"
            onClick={() => onAdd(item.id)}
            data-testid={`button-add-topic-${item.id}`}
          >
            <Plus size={14} /> adicionar tópico
          </button>
        </div>
      )}
    </div>
    );
  };

  return (
    <section className="bg-white dark:bg-[#131821] border border-[#d5dede] dark:border-[#29313d] rounded-sm p-1">
      <div className="space-y-1">
        {topLevel.map((item) => (
          <div className="p-3" key={item.id}>
            {renderRow(item, true)}
          </div>
        ))}
      </div>
      <div className="p-3 pt-0">
        <button
          className="flex items-center gap-2 p-1.5 px-3 text-[12px] text-[#8e98a8] hover:text-[#16232b] dark:hover:text-[#f0f0e8] font-medium"
          onClick={() => onAdd(null)}
          data-testid="button-add-subject"
        >
          <Plus size={14} /> adicionar matéria
        </button>
      </div>
    </section>
  );
}
