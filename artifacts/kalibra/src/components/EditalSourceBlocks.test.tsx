import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { EditalSourceBlocks } from './EditalSourceBlocks';

const CARGOS = [
  { id: 'c1', name: 'Analista', examDate: '2026-06-01' },
  { id: 'c2', name: 'Técnico', examDate: '2026-06-01' },
];

afterEach(() => {
  cleanup();
});

describe('EditalSourceBlocks', () => {
  it('mostra uma aba para o conteúdo comum e uma para cada cargo', () => {
    render(<EditalSourceBlocks cargos={CARGOS} blocks={[]} onChange={() => {}} />);
    expect(screen.getByTestId('bloco-aba-comum')).toBeTruthy();
    expect(screen.getByTestId('bloco-aba-c1').textContent).toContain('Analista');
    expect(screen.getByTestId('bloco-aba-c2').textContent).toContain('Técnico');
  });

  it('começa no bloco comum', () => {
    render(<EditalSourceBlocks cargos={CARGOS} blocks={[]} onChange={() => {}} />);
    expect(screen.getByTestId('bloco-textarea').getAttribute('data-cargo')).toBe('comum');
  });

  it('digitar no bloco comum emite um bloco com cargoId null', () => {
    const onChange = vi.fn();
    render(<EditalSourceBlocks cargos={CARGOS} blocks={[]} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('bloco-textarea'), { target: { value: 'PORTUGUÊS' } });
    expect(onChange).toHaveBeenCalledWith([{ cargoId: null, text: 'PORTUGUÊS' }]);
  });

  it('digitar no bloco de um cargo NÃO altera o texto dos outros blocos', () => {
    const onChange = vi.fn();
    render(
      <EditalSourceBlocks
        cargos={CARGOS}
        blocks={[{ cargoId: null, text: 'COMUM' }, { cargoId: 'c1', text: 'DO ANALISTA' }]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId('bloco-aba-c2'));
    fireEvent.change(screen.getByTestId('bloco-textarea'), { target: { value: 'DO TÉCNICO' } });

    expect(onChange).toHaveBeenCalledWith([
      { cargoId: null, text: 'COMUM' },
      { cargoId: 'c1', text: 'DO ANALISTA' },
      { cargoId: 'c2', text: 'DO TÉCNICO' },
    ]);
  });

  it('trocar de aba mostra o texto daquele bloco', () => {
    render(
      <EditalSourceBlocks
        cargos={CARGOS}
        blocks={[{ cargoId: null, text: 'COMUM' }, { cargoId: 'c1', text: 'DO ANALISTA' }]}
        onChange={() => {}}
      />,
    );
    expect((screen.getByTestId('bloco-textarea') as HTMLTextAreaElement).value).toBe('COMUM');
    fireEvent.click(screen.getByTestId('bloco-aba-c1'));
    expect((screen.getByTestId('bloco-textarea') as HTMLTextAreaElement).value).toBe('DO ANALISTA');
  });

  it('uma aba com conteúdo é marcada como preenchida', () => {
    render(
      <EditalSourceBlocks
        cargos={CARGOS}
        blocks={[{ cargoId: 'c1', text: 'DO ANALISTA' }]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByTestId('bloco-aba-c1').getAttribute('data-preenchido')).toBe('true');
    expect(screen.getByTestId('bloco-aba-c2').getAttribute('data-preenchido')).toBe('false');
  });

  it('com um cargo só, a distinção comum/específico não faz sentido e as abas somem', () => {
    render(<EditalSourceBlocks cargos={[CARGOS[0]]} blocks={[]} onChange={() => {}} />);
    expect(screen.queryByTestId('bloco-aba-comum')).toBeNull();
    expect(screen.getByTestId('bloco-textarea')).toBeTruthy();
  });
});
