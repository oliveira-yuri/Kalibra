import { useState } from 'react';
import { useUser } from '@clerk/react';
import { ShieldAlert } from 'lucide-react';
import { ApprovalCard } from '@/components/ApprovalCard';
import { useApprovals, canDecide, APPROVAL_TYPES, type ApprovalType } from '@/domain/useApprovals';

const TYPE_LABEL: Record<ApprovalType, string> = {
  edital_structure: 'estrutura do edital',
  concept_merge: 'fusão de conceito',
};

type TypeFilter = 'todos' | ApprovalType;

export function Aprovacoes() {
  const { user } = useUser();
  const { items, pending, approve, reject } = useApprovals(user?.id);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('todos');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = items.filter((item) => typeFilter === 'todos' || item.type === typeFilter);

  const toggleCollapse = (id: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allCollapsed = filtered.length > 0 && filtered.every((item) => collapsedIds.has(item.id));
  const toggleCollapseAll = () => {
    setCollapsedIds(allCollapsed ? new Set() : new Set(filtered.map((item) => item.id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Recalculado a cada render a partir de `items`, não guardado à parte: um item que
  // deixou de poder ser decidido (aprovado/rejeitado por aqui ou por outra aba) sai da
  // seleção sozinho, sem precisar de um efeito para "limpar" o Set depois do fato.
  const selectableSelectedIds = items
    .filter((item) => selectedIds.has(item.id) && canDecide(item.status))
    .map((item) => item.id);

  // Chamadas síncronas em sequência, no mesmo handler — não um `.map` construído a
  // partir de `items` (estado de render) — para herdar a garantia já testada em
  // `approvals.test.ts` ("duas chamadas de enqueue no mesmo act() persistem as duas"):
  // cada `approve` lê `itemsRef.current`, já atualizado pela chamada anterior, então
  // nenhuma das N aprovações se perde.
  const approveSelected = () => {
    selectableSelectedIds.forEach((id) => approve(id));
    setSelectedIds(new Set());
  };

  // Uma decisão individual também tira o item da seleção — aprovar/rejeitar pelo botão
  // do próprio cartão não deveria deixar o item marcado para uma aprovação em lote que
  // `canDecide` já recusaria.
  const approveOne = (id: string) => {
    approve(id);
    setSelectedIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const rejectOne = (id: string) => {
    reject(id);
    setSelectedIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  return (
    <div className="k-page-enter space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="k-eyebrow mb-2">fila de aprovação · decisão humana</p>
          <h2 className="text-[27px] font-semibold tracking-[-.05em]">Nada vira conteúdo oficial sem você decidir.</h2>
          <p className="mt-2 max-w-[650px] text-[12px] leading-5 k-muted">
            Estrutura extraída do edital e conceitos fundidos pela IA esperam aqui até que você aprove ou rejeite — nunca entram sozinhos no seu ciclo.
          </p>
        </div>
        <span className="k-chip k-chip-active">{pending} aguardando decisão</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className={`k-chip cursor-pointer ${typeFilter === 'todos' ? 'k-chip-active' : ''}`}
          onClick={() => setTypeFilter('todos')}
          data-testid="filter-approval-type-todos"
        >
          todos
        </button>
        {APPROVAL_TYPES.map((type) => (
          <button
            key={type}
            className={`k-chip cursor-pointer ${typeFilter === type ? 'k-chip-active' : ''}`}
            onClick={() => setTypeFilter(type)}
            data-testid={`filter-approval-type-${type}`}
          >
            {TYPE_LABEL[type]}
          </button>
        ))}
        {filtered.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <button
              className="k-button k-button-quiet text-[11px]"
              onClick={approveSelected}
              disabled={selectableSelectedIds.length === 0}
              data-testid="button-approve-selected"
            >
              Aprovar selecionados
            </button>
            <button className="k-button k-button-quiet text-[11px]" onClick={toggleCollapseAll} data-testid="button-collapse-all">
              {allCollapsed ? 'expandir todos' : 'recolher todos'}
            </button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="k-card flex flex-col items-center gap-2 p-12 text-center">
          <ShieldAlert size={20} className="text-[#68788b]" />
          <p className="text-[13px] font-medium">Nenhuma proposta aguardando decisão</p>
          <p className="text-[11px] k-muted max-w-[420px]">
            Nada extraído do edital ou fundido pela IA passa a valer sem você aprovar. Questões do diagnóstico inicial são a exceção: não entram nesta fila
            — travar o primeiro passo do aluno numa aprovação item a item não faria sentido — mas continuam rastreáveis fora dela.
          </p>
        </div>
      ) : (
        <div className="k-stagger space-y-3">
          {filtered.map((item) => (
            <ApprovalCard
              key={item.id}
              item={item}
              collapsed={collapsedIds.has(item.id)}
              onToggleCollapse={() => toggleCollapse(item.id)}
              onApprove={approveOne}
              onReject={rejectOne}
              selected={selectedIds.has(item.id)}
              onToggleSelect={() => toggleSelect(item.id)}
            />
          ))}
        </div>
      )}

      <div className="k-card-soft flex items-start gap-3 p-4">
        <ShieldAlert size={15} className="k-coral mt-0.5" />
        <p className="text-[11px] leading-5 k-muted">
          Questões geradas para o diagnóstico inicial não passam por esta fila — aprovar uma a uma bloquearia o primeiro passo do aluno — e continuam
          rastreáveis fora dela.
        </p>
      </div>
    </div>
  );
}
