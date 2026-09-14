import { useState, type ReactElement } from 'react';

/**
 * Trecho do edital que originou um item da árvore (PD-06) — colapsado por padrão para
 * a tela de revisão não virar um paredão de texto; um botão discreto (`k-button-quiet`)
 * abre. `null` quando o item não tem trecho registrado (ex.: adicionado manualmente).
 */
export function SourceExcerpt({ excerpt, page }: { excerpt: string | null; page: number | null }): ReactElement | null {
  const [open, setOpen] = useState(false);

  if (!excerpt) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        className="k-button k-button-quiet !px-0 text-[10px]"
        onClick={() => setOpen((current) => !current)}
        data-testid="button-toggle-source-excerpt"
      >
        {open ? 'ocultar trecho-fonte' : 'ver trecho-fonte'}{page !== null ? ` · p. ${page}` : ''}
      </button>
      {open && (
        <div className="k-card-soft mt-1 p-2 k-mono text-[11px] leading-5 whitespace-pre-wrap break-words" data-testid="source-excerpt-content">
          {excerpt}
        </div>
      )}
    </div>
  );
}
