import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { SourceExcerpt } from './SourceExcerpt';

afterEach(() => {
  cleanup();
});

describe('SourceExcerpt', () => {
  it('não renderiza nada quando não há trecho', () => {
    const { container } = render(<SourceExcerpt excerpt={null} page={3} />);
    expect(container.innerHTML).toBe('');
  });

  it('começa colapsado e abre ao clicar no botão discreto', () => {
    render(<SourceExcerpt excerpt="Art. 37 da Constituição..." page={12} />);
    expect(screen.queryByTestId('source-excerpt-content')).toBeNull();

    fireEvent.click(screen.getByTestId('button-toggle-source-excerpt'));
    expect(screen.getByTestId('source-excerpt-content').textContent).toContain('Art. 37 da Constituição...');
  });

  it('mostra a página quando informada, e omite quando null', () => {
    render(<SourceExcerpt excerpt="trecho" page={5} />);
    expect(screen.getByTestId('button-toggle-source-excerpt').textContent).toContain('p. 5');

    cleanup();
    render(<SourceExcerpt excerpt="trecho" page={null} />);
    expect(screen.getByTestId('button-toggle-source-excerpt').textContent).not.toContain('p.');
  });
});
