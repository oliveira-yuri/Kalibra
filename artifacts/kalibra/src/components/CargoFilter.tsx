import type { ReactElement } from 'react';
import type { Cargo } from '@/domain/useWorkspaces';

/**
 * Linha de `k-chip` para filtrar por cargo — o mesmo padrão que `Erros` já usa para
 * filtro (chip ativo em `k-chip-active`), com "todos os cargos" fixo à esquerda.
 * Nasce na Task 11 (peso/quantidade por cargo); Task 13 (diff) e Task 15 só consomem.
 */
export function CargoFilter({
  cargos,
  selected,
  onSelect,
}: {
  cargos: Cargo[];
  selected: string | null;
  onSelect(cargoId: string | null): void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="cargo-filter">
      <button
        type="button"
        className={`k-chip cursor-pointer ${selected === null ? 'k-chip-active' : ''}`}
        onClick={() => onSelect(null)}
        data-testid="cargo-filter-todos"
      >
        todos os cargos
      </button>
      {cargos.map((cargo) => (
        <button
          key={cargo.id}
          type="button"
          className={`k-chip cursor-pointer ${selected === cargo.id ? 'k-chip-active' : ''}`}
          onClick={() => onSelect(cargo.id)}
          data-testid={`cargo-filter-${cargo.id}`}
        >
          {cargo.name || cargo.id}
        </button>
      ))}
    </div>
  );
}
