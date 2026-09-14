import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { Cargo } from '@/domain/useWorkspaces';
import { CargoFilter } from './CargoFilter';

const CARGOS: Cargo[] = [
  { id: 'c1', name: 'Analista', examDate: '2027-01-01' },
  { id: 'c2', name: 'Técnico', examDate: '2027-01-01' },
];

afterEach(() => {
  cleanup();
});

describe('CargoFilter — mesmo padrão de k-chip que a tela Erros usa para filtro', () => {
  it('marca "todos os cargos" como ativo quando selected é null', () => {
    const { getByTestId } = render(<CargoFilter cargos={CARGOS} selected={null} onSelect={vi.fn()} />);
    expect(getByTestId('cargo-filter-todos').className).toContain('k-chip-active');
    expect(getByTestId('cargo-filter-c1').className).not.toContain('k-chip-active');
  });

  it('marca o cargo selecionado como ativo, não "todos os cargos"', () => {
    const { getByTestId } = render(<CargoFilter cargos={CARGOS} selected="c2" onSelect={vi.fn()} />);
    expect(getByTestId('cargo-filter-c2').className).toContain('k-chip-active');
    expect(getByTestId('cargo-filter-todos').className).not.toContain('k-chip-active');
  });

  it('chama onSelect com o id do cargo clicado, e com null para "todos os cargos"', () => {
    const onSelect = vi.fn();
    const { getByTestId } = render(<CargoFilter cargos={CARGOS} selected="c1" onSelect={onSelect} />);

    fireEvent.click(getByTestId('cargo-filter-c2'));
    expect(onSelect).toHaveBeenCalledWith('c2');

    fireEvent.click(getByTestId('cargo-filter-todos'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
