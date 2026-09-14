function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * O payload de um item de aprovação é `unknown` de propósito (ver
 * `ApprovalItem` em `lib/core`) — quem enfileira decide a forma. Um objeto
 * vira uma lista de campos; qualquer outra coisa (string, número, array no
 * topo) vira uma linha só.
 */
function PayloadFields({ payload }: { payload: unknown }) {
  if (payload === null || payload === undefined) {
    return <p className="text-[11px] leading-5">—</p>;
  }
  if (isRecord(payload)) {
    const entries = Object.entries(payload);
    if (entries.length === 0) return <p className="text-[11px] leading-5">—</p>;
    return (
      <dl className="space-y-1">
        {entries.map(([key, value]) => (
          <div key={key} className="flex gap-2 text-[11px] leading-5">
            <dt className="k-mono shrink-0 opacity-70">{key}</dt>
            <dd className="min-w-0 break-words">{formatValue(value)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return <p className="text-[11px] leading-5">{formatValue(payload)}</p>;
}

/**
 * Duas colunas — antes / proposta — com os mesmos pares de cor de
 * `k-option-wrong`/`k-option-correct` na tela de questões. `before` é
 * `null` quando o item é uma proposta nova, não uma alteração; nesse caso
 * não existe "antes" para mostrar, então a coluna nem é desenhada — uma
 * coluna vazia ao lado só sugeriria uma alteração que não existe.
 */
export function ApprovalDiff({ before, after }: { before: unknown; after: unknown }) {
  const hasBefore = before !== null && before !== undefined;
  return (
    <div className={`grid gap-3 ${hasBefore ? 'md:grid-cols-2' : ''}`} data-testid="approval-diff">
      {hasBefore && (
        <div className="k-card-soft p-3 bg-[#fff0ee] text-[#c94f45] dark:bg-[#30201f] dark:text-[#ff907d]">
          <p className="k-eyebrow mb-2">antes</p>
          <PayloadFields payload={before} />
        </div>
      )}
      <div className="k-card-soft p-3 bg-[#edf8ef] text-[#23824d] dark:bg-[#172c26] dark:text-[#80d8a5]">
        <p className="k-eyebrow mb-2">proposta</p>
        <PayloadFields payload={after} />
      </div>
    </div>
  );
}
