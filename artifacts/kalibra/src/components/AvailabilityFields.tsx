import {
  WEEKDAY_LABELS, minutesFor, totalWeeklyMinutes,
  type Weekday, type WeeklyAvailability,
} from '@workspace/core';

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export function AvailabilityFields({ value, onChange }: { value: WeeklyAvailability; onChange: (value: WeeklyAvailability) => void }) {
  const setMinutes = (weekday: Weekday, minutes: number) =>
    onChange({
      ...value,
      days: WEEKDAYS.map((day) => ({ weekday: day, minutes: day === weekday ? minutes : minutesFor(value, day) })),
    });

  const total = totalWeeklyMinutes(value);

  return (
    <div className="space-y-3" data-testid="fields-disponibilidade">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="k-option p-3">
            <p className="k-eyebrow mb-2">{WEEKDAY_LABELS[weekday]}</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={15}
                className="k-input"
                value={minutesFor(value, weekday)}
                onChange={(event) => setMinutes(weekday, Number(event.target.value) || 0)}
                data-testid={`input-disponibilidade-${weekday}`}
              />
              <span className="k-mono text-[10px] k-muted">min</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 border-t border-[#d5dede] pt-3 dark:border-[#242a34] sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-[11px] k-muted">
          Sessão máxima
          <input
            type="number"
            min={5}
            step={5}
            className="k-input w-[90px]"
            value={value.maxSessionMinutes}
            onChange={(event) => onChange({ ...value, maxSessionMinutes: Number(event.target.value) || 0 })}
            data-testid="input-sessao-maxima"
          />
          <span className="k-mono text-[10px]">min</span>
        </label>
        <span className="k-mono text-[11px] k-muted">
          total semanal <span className="k-focus">{Math.floor(total / 60)}h {String(total % 60).padStart(2, '0')}</span>
        </span>
      </div>
    </div>
  );
}
