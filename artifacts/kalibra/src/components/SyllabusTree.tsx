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
  onRemoveFromCargo,
  onAdd,
  onSplit,
  onLinkToCargo,
  onWeightChange,
  onQuestionCountChange,
}: {
  syllabus: Syllabus;
  /** `null` = "todos os cargos": peso e quantidade ficam consolidados e somente leitura — o modelo os separa por cargo exatamente para não perder essa distinção. */
  cargoId: string | null;
  /** Cargos do workspace, só para rotular "Separar de <cargo>" e "Aplicar a <cargo>" no menu do item. */
  cargos: Cargo[];
  onRename(itemId: string, label: string): void;
  /** Exclui o item de TODOS os cargos. Só é oferecido quando não há a que restringir. */
  onRemove(itemId: string): void;
  /**
   * Exclui o item de UM cargo, deixando os demais intactos — Fase 1B.5. Enquanto todo
   * item era comum a todos os cargos, "excluir daqui" e "excluir de tudo" eram a mesma
   * operação; agora não são, e o menu precisa das duas.
   */
  onRemoveFromCargo(itemId: string, cargoId: string): void;
  onAdd(parentItemId: string | null): void;
  onSplit(itemId: string, cargoId: string): void;
  /** Liga o item a mais um cargo (a direção contrária à de `onSplit`) — Fase 1B.5. */
  onLinkToCargo(itemId: string, cargoId: string): void;
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
    // A largura fixa abaixo é o mesmo valor arbitrário que AvailabilityFields já usa
    // para um campo numérico ("Sessão máxima") — fix round 1 (achado menor): dois
    // valores novos foram trocados por este, já existente, em vez de introduzir token
    // novo. Nota do fix round 2: o valor antigo não pode nem aparecer em comentário —
    // o scanner do Tailwind lê texto puro do arquivo, não só `className`, e gerava
    // regra morta no CSS de build a partir da citação em prosa.
    if (cargoId === null) {
      const weight = consolidatedWeight(syllabus, item.id);
      const questions = consolidatedQuestions(syllabus, item.id);
      return (
        <div className="flex items-center gap-1 shrink-0">
          <input type="number" className="k-input w-[90px] text-right" value={weight ?? ''} placeholder="%" disabled data-testid={`input-peso-${item.id}`} />
          <input type="number" className="k-input w-[90px] text-right" value={questions || ''} placeholder="qtd" disabled data-testid={`input-questoes-${item.id}`} />
        </div>
      );
    }
    const link = linkFor(syllabus, item.id, cargoId);
    return (
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number"
          className="k-input w-[90px] text-right"
          value={link?.weight ?? ''}
          placeholder="%"
          onChange={(event) => onWeightChange(item.id, cargoId, parseNumberOrNull(event.target.value))}
          data-testid={`input-peso-${item.id}`}
        />
        <input
          type="number"
          className="k-input w-[90px] text-right"
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
    // `cargoId !== null` é "estou vendo um cargo só"; `common` é "o item tem mais de
    // uma ligação". Só os dois juntos fazem a exclusão por cargo existir: com o item
    // num cargo só, tirar aquela ligação É excluir o item, e o rótulo simples é o
    // honesto.
    const porCargo = cargoId !== null && common;
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
        {cargos
          .filter((cargo) => !cargosFor(syllabus, item.id).includes(cargo.id))
          .map((cargo) => (
            <button
              key={cargo.id}
              className="k-button k-button-quiet justify-start text-[10px]"
              onClick={() => { onLinkToCargo(item.id, cargo.id); setOpenMenu(null); }}
              data-testid={`button-link-${item.id}-${cargo.id}`}
            >
              Aplicar a {cargoName(cargo.id)}
            </button>
          ))}
        {/*
          Excluir precisa dizer QUAL das duas coisas vai fazer. Com o filtro num cargo
          e o item pertencendo a mais de um, exclui só daquele cargo — os outros ficam
          com o conteúdo, o peso e a quantidade (critério "alterar um cargo não
          contamina os demais"). Sem filtro, ou com o item pertencendo a um cargo só,
          exclui o item inteiro, como sempre fez. Um rótulo só para os dois casos era a
          armadilha: o usuário filtrava por um cargo e apagava o conteúdo de todos.
        */}
        <button
          className="k-button k-button-quiet justify-start text-[10px] text-[#c94f45] dark:text-[#ff907d]"
          onClick={() => {
            if (porCargo) onRemoveFromCargo(item.id, cargoId);
            else onRemove(item.id);
            setOpenMenu(null);
          }}
          data-testid={`button-remove-${item.id}`}
        >
          {porCargo ? `Excluir de ${cargoName(cargoId)}` : (common ? 'Excluir de todos os cargos' : 'Excluir')}
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
          {common && (
            <span className="k-chip" data-testid={`chip-common-${item.id}`}>
              {itemCargos.length === cargos.length && cargos.length > 0 ? 'comum a todos' : `${itemCargos.length} cargos`}
            </span>
          )}
          {!common && cargos.length > 1 && itemCargos.length === 1 && (
            <span className="k-chip" data-testid={`chip-escopo-${item.id}`}>só {cargoName(itemCargos[0])}</span>
          )}
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
