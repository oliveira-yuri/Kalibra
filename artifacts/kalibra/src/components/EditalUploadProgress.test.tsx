import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import type { ExtractionErrorKind, ExtractionProgress } from '@workspace/core';
import { EditalUploadProgress } from './EditalUploadProgress';

// Texto literal do PD-07, não reimportado de `EXTRACTION_ERROR_MESSAGES` — achado
// menor do fix round 1: comparar o render contra a MESMA constante que o componente
// usa é uma tautologia (os dois lados derivam juntos; o copy podia se afastar do spec
// com a suíte inteira verde). Fixado aqui do mesmo jeito que `extraction.test.ts`
// (lib/core) fixa a constante em si contra o spec.
const EXPECTED_ERROR_COPY: Record<ExtractionErrorKind, { message: string; action: string }> = {
  scanned: {
    message: 'Este PDF é uma imagem, não texto. Não é possível extrair o conteúdo automaticamente.',
    action: 'Colar o texto manualmente',
  },
  corrupted: {
    message: 'Não foi possível abrir o arquivo.',
    action: 'Enviar outro arquivo',
  },
  short: {
    message: 'O conteúdo enviado tem poucas palavras. Verifique se é o edital completo.',
    action: 'Enviar mesmo assim',
  },
  structure: {
    message: 'O conteúdo foi extraído, mas não conseguimos identificar a estrutura.',
    action: 'Montar manualmente',
  },
};

const ERROR_KINDS: ExtractionErrorKind[] = ['scanned', 'corrupted', 'short', 'structure'];

function progressFor(partial: Partial<ExtractionProgress>): ExtractionProgress {
  return { stage: 'enviando', wordCount: null, errorKind: null, ...partial };
}

afterEach(() => {
  cleanup();
});

describe('EditalUploadProgress — Task 10 (dirigido pelo adaptador, nunca simulado)', () => {
  it('renderiza os quatro passos nomeados em qualquer estágio', () => {
    render(<EditalUploadProgress progress={progressFor({ stage: 'enviando' })} onReady={vi.fn()} onAction={vi.fn()} />);
    expect(screen.getByText('Arquivo enviado')).toBeTruthy();
    expect(screen.getByText('Texto extraído')).toBeTruthy();
    expect(screen.getByText('Identificando matérias e tópicos…')).toBeTruthy();
    expect(screen.getByText('Pronto para revisão')).toBeTruthy();
  });

  it('estágio "enviando": nenhum passo concluído, sem contagem de palavras e sem bloco de erro', () => {
    const { container } = render(<EditalUploadProgress progress={progressFor({ stage: 'enviando' })} onReady={vi.fn()} onAction={vi.fn()} />);
    expect(container.innerHTML).not.toContain('palavras');
    expect(container.querySelector('[data-testid="button-extraction-error-action"]')).toBeNull();
  });

  it('estágio "extraindo": mostra a contagem de palavras quando disponível', () => {
    render(<EditalUploadProgress progress={progressFor({ stage: 'extraindo', wordCount: 12480 })} onReady={vi.fn()} onAction={vi.fn()} />);
    expect(screen.getByText('12.480 palavras')).toBeTruthy();
  });

  it('estágio "identificando": ainda não chegou a "pronto", sem bloco de erro', () => {
    const { container } = render(<EditalUploadProgress progress={progressFor({ stage: 'identificando', wordCount: 500 })} onReady={vi.fn()} onAction={vi.fn()} />);
    expect(container.querySelector('[data-testid="button-extraction-error-action"]')).toBeNull();
    expect(screen.getByText('Identificando matérias e tópicos…')).toBeTruthy();
  });

  describe('estágio "pronto"', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('chama onReady após a pausa curta, e não antes', () => {
      const onReady = vi.fn();
      render(<EditalUploadProgress progress={progressFor({ stage: 'pronto', wordCount: 500 })} onReady={onReady} onAction={vi.fn()} />);

      expect(onReady).not.toHaveBeenCalled();
      vi.advanceTimersByTime(599);
      expect(onReady).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onReady).toHaveBeenCalledTimes(1);
    });
  });

  describe.each(ERROR_KINDS)('estágio "erro" — tipo %s', (kind) => {
    it('mostra a mensagem e a ação do PD-07 correspondentes, e aciona onAction com o tipo certo', () => {
      const onAction = vi.fn();
      render(<EditalUploadProgress progress={progressFor({ stage: 'erro', errorKind: kind })} onReady={vi.fn()} onAction={onAction} />);

      const expected = EXPECTED_ERROR_COPY[kind];
      expect(screen.getByText(expected.message)).toBeTruthy();
      const button = screen.getByTestId('button-extraction-error-action');
      expect(button.textContent).toContain(expected.action);

      fireEvent.click(button);
      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onAction).toHaveBeenCalledWith(kind);
    });
  });

  it('nunca chama onReady quando o estágio é "erro"', () => {
    vi.useFakeTimers();
    const onReady = vi.fn();
    render(<EditalUploadProgress progress={progressFor({ stage: 'erro', errorKind: 'short' })} onReady={onReady} onAction={vi.fn()} />);
    vi.advanceTimersByTime(5000);
    expect(onReady).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
