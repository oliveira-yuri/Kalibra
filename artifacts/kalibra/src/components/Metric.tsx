export function Metric({ label, value, note, accent = false }: { label: string; value: string; note: string; accent?: boolean }) {
  return <div className="k-card p-4"><p className="k-eyebrow mb-4">{label}</p><p className={`k-mono text-[25px] font-medium tracking-[-0.06em] ${accent ? 'k-focus' : 'text-[#f0f0e8]'}`}>{value}</p><p className="mt-2 text-[11px] text-[#8e98a8]">{note}</p></div>;
}
