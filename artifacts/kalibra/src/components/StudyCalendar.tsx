import { CalendarDays } from 'lucide-react';
import type { PlanItem } from '@/types';

export function StudyCalendar({ plan }: { plan: PlanItem[] }) {
  return <section className="k-card p-5" data-testid="section-study-calendar">
    <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
      <div>
        <p className="k-eyebrow mb-2">plano da semana · atualizado pelo diagnóstico</p>
        <h3 className="text-[18px] font-semibold tracking-[-.04em]">O que estudar em cada dia</h3>
        <p className="mt-2 max-w-[620px] text-[12px] leading-5 text-[#8e98a8]">Aprovações recalibram os próximos blocos sem apagar o histórico do que já foi estudado.</p>
      </div>
      <span className="k-chip">{plan.length} blocos planejados</span>
    </div>
    <div className="k-plan-grid">
      {plan.map((item) => <article key={item.id} className={`k-plan-item k-plan-${item.tone}`} data-testid={`plan-item-${item.id}`}>
        <div className="flex items-start justify-between gap-3">
          <div><p className="k-eyebrow">{item.weekday}</p><p className="k-mono mt-1 text-[17px] font-medium">{item.date}</p></div>
          <span className="k-plan-dot" />
        </div>
        <p className="mt-5 text-[12px] font-semibold leading-5">{item.label}</p>
        <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-[#8e98a8]"><span>{item.subject}</span><span className="k-mono">{item.duration}</span></div>
        <span className="k-plan-kind mt-3 inline-flex">{item.kind}</span>
      </article>)}
    </div>
    <div className="k-card-soft mt-4 flex items-start gap-3 p-4"><CalendarDays size={15} className="k-focus mt-0.5 shrink-0" /><p className="text-[11px] leading-5 text-[#aeb8c5]">O calendário é uma proposta de ciclo. Nada muda automaticamente sem sua aprovação.</p></div>
  </section>;
}
