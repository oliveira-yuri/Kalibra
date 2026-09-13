import { Plus, X } from 'lucide-react';
import type { Cargo } from '@/domain/useWorkspaces';

export function CargoFields({ cargos, onChange }: { cargos: Cargo[]; onChange: (cargos: Cargo[]) => void }) {
  const update = (index: number, patch: Partial<Cargo>) =>
    onChange(cargos.map((cargo, i) => i === index ? { ...cargo, ...patch } : cargo));

  const add = () =>
    onChange([...cargos, { id: `c${Date.now()}`, name: '', examDate: '', period: '' }]);

  const remove = (index: number) =>
    onChange(cargos.filter((_, i) => i !== index));

  return (
    <div className="space-y-2" data-testid="fields-cargos">
      {cargos.map((cargo, index) => (
        <div key={cargo.id} className="k-option grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_130px_90px_auto]">
          <input
            className="k-input"
            placeholder="Nome do cargo"
            value={cargo.name}
            onChange={(event) => update(index, { name: event.target.value })}
            data-testid={`input-cargo-nome-${index}`}
          />
          <input
            type="date"
            className="k-input"
            value={cargo.examDate}
            onChange={(event) => update(index, { examDate: event.target.value })}
            data-testid={`input-cargo-data-${index}`}
          />
          <input
            className="k-input"
            placeholder="Período"
            value={cargo.period ?? ''}
            onChange={(event) => update(index, { period: event.target.value })}
            data-testid={`input-cargo-periodo-${index}`}
          />
          <button
            type="button"
            className="k-button k-button-quiet k-icon-button k-coral"
            onClick={() => remove(index)}
            disabled={cargos.length === 1}
            aria-label={`Remover cargo ${index + 1}`}
            data-testid={`button-remover-cargo-${index}`}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="k-button k-button-quiet text-[11px]" onClick={add} data-testid="button-adicionar-cargo">
        <Plus size={14} /> Adicionar cargo
      </button>
    </div>
  );
}
