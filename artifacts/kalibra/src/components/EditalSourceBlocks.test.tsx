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

/**
 * Achado I-1 da revisão final de branch: a aba ativa nunca era validada contra a lista
 * de cargos. Removendo (ou desnomeando) o cargo da aba aberta, nenhuma aba ficava
 * acesa e o textarea continuava mostrando — e ACEITANDO — o texto de um cargo que já
 * não existia; o submit depois podava esse bloco em silêncio.
 *
 * Três cargos de propósito: com dois, remover um deixa o componente com um cargo só e
 * as abas somem por outro motivo (`multiplos === false`), o que esconderia o defeito.
 */
const TRES_CARGOS = [
  { id: 'c1', name: 'Analista', examDate: '2026-06-01' },
  { id: 'c2', name: 'Técnico', examDate: '2026-06-01' },
  { id: 'c3', name: 'Auxiliar', examDate: '2026-06-01' },
];

const BLOCOS_TRES = [
  { cargoId: null, text: 'COMUM' },
  { cargoId: 'c2', text: 'DO TÉCNICO' },
];

describe('EditalSourceBlocks — achado I-1 (aba de cargo que deixou de existir)', () => {
  it('a aba ativa some junto com o cargo: o campo volta para o bloco comum', () => {
    const { rerender } = render(
      <EditalSourceBlocks cargos={TRES_CARGOS} blocks={BLOCOS_TRES} onChange={() => {}} />,
    );
    fireEvent.click(screen.getByTestId('bloco-aba-c2'));
    expect(screen.getByTestId('bloco-textarea').getAttribute('data-cargo')).toBe('c2');

    // O cargo da aba aberta é removido do formulário.
    rerender(
      <EditalSourceBlocks
        cargos={[TRES_CARGOS[0], TRES_CARGOS[2]]}
        blocks={BLOCOS_TRES}
        onChange={() => {}}
      />,
    );

    expect(screen.queryByTestId('bloco-aba-c2')).toBeNull();
    expect(screen.getByTestId('bloco-textarea').getAttribute('data-cargo')).toBe('comum');
    expect((screen.getByTestId('bloco-textarea') as HTMLTextAreaElement).value).toBe('COMUM');
  });

  it('digitar depois da remoção entra no bloco comum — nunca num cargo que o submit vai podar', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <EditalSourceBlocks cargos={TRES_CARGOS} blocks={BLOCOS_TRES} onChange={onChange} />,
    );
    fireEvent.click(screen.getByTestId('bloco-aba-c2'));
    rerender(
      <EditalSourceBlocks
        cargos={[TRES_CARGOS[0], TRES_CARGOS[2]]}
        blocks={BLOCOS_TRES}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('bloco-textarea'), { target: { value: 'COMUM MAIS ISTO' } });

    const emitido = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(emitido).toContainEqual({ cargoId: null, text: 'COMUM MAIS ISTO' });
    // O bloco do cargo morto não é reescrito nem ressuscitado por esta digitação.
    expect(emitido.filter((bloco: { cargoId: string | null }) => bloco.cargoId === 'c2'))
      .toEqual([{ cargoId: 'c2', text: 'DO TÉCNICO' }]);
  });

  it('a aba acesa depois da remoção é a do bloco comum — nenhuma aba fica órfã', () => {
    const { rerender } = render(
      <EditalSourceBlocks cargos={TRES_CARGOS} blocks={BLOCOS_TRES} onChange={() => {}} />,
    );
    fireEvent.click(screen.getByTestId('bloco-aba-c2'));
    rerender(
      <EditalSourceBlocks
        cargos={[TRES_CARGOS[0], TRES_CARGOS[2]]}
        blocks={BLOCOS_TRES}
        onChange={() => {}}
      />,
    );
    // `shadow-sm` só aparece na classe da aba ativa (ABA_ATIVA).
    expect(screen.getByTestId('bloco-aba-comum').className).toContain('shadow-sm');
    expect(screen.getByTestId('bloco-aba-c1').className).not.toContain('shadow-sm');
    expect(screen.getByTestId('bloco-aba-c3').className).not.toContain('shadow-sm');
  });

  it('apagar só o NOME do cargo tem o mesmo efeito: quem monta o componente decide quem existe', () => {
    // A tela de criação passa só os cargos NOMEADOS; um cargo que perde o nome
    // simplesmente some desta lista — o mesmo caminho da remoção.
    const { rerender } = render(
      <EditalSourceBlocks cargos={TRES_CARGOS} blocks={BLOCOS_TRES} onChange={() => {}} />,
    );
    fireEvent.click(screen.getByTestId('bloco-aba-c2'));
    rerender(
      <EditalSourceBlocks
        cargos={[TRES_CARGOS[0], TRES_CARGOS[2]]}
        blocks={BLOCOS_TRES}
        onChange={() => {}}
      />,
    );
    expect(screen.getByTestId('bloco-textarea').getAttribute('data-cargo')).toBe('comum');
  });
});

describe('EditalSourceBlocks — aparência do campo pertence a quem monta (achado M-5)', () => {
  it('usa as medidas padrão do modal de reimportação quando nada é passado', () => {
    render(<EditalSourceBlocks cargos={CARGOS} blocks={[]} onChange={() => {}} />);
    const classe = screen.getByTestId('bloco-textarea').className;
    expect(classe).toContain('k-input');
    expect(classe).toContain('min-h-[150px]');
    expect(classe).toContain('text-[12px]');
  });

  it('aceita outras medidas sem perder `k-input`', () => {
    render(
      <EditalSourceBlocks
        cargos={CARGOS}
        blocks={[]}
        onChange={() => {}}
        textareaClassName="min-h-[200px] resize-y font-mono text-[11px] leading-relaxed"
      />,
    );
    const classe = screen.getByTestId('bloco-textarea').className;
    expect(classe).toContain('k-input');
    expect(classe).toContain('font-mono');
    expect(classe).toContain('min-h-[200px]');
  });
});
