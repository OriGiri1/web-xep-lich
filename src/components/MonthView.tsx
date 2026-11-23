import { HOURS, addDays, bestRanges, dateKey, freeCount, freeRanges, hh, sameDay, startOfWeek, type Cell, type Member } from '../lib/schedule';

const HEAD = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

type Props = { month: Date; members: Member[]; cells: Record<string, Cell>; onPick: (d: Date) => void };

export function MonthView({ month, members, cells, onPick }: Props) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const weeks = Math.floor(Math.round((last.getTime() - start.getTime()) / 864e5) / 7) + 1;
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
  const N = members.length;
  const today = new Date();

  return (
    <div className="flex h-full flex-col overflow-auto p-3">
      <div className="grid grid-cols-7 gap-px pb-2">
        {HEAD.map((h) => (
          <div key={h} className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
            {h}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 gap-1.5" style={{ gridAutoRows: 'minmax(112px, 1fr)' }}>
        {days.map((d) => {
          const k = dateKey(d);
          const hours = HOURS.map((h) => freeCount(members, cells, k, h));
          const max = Math.max(0, ...hours);
          const best = bestRanges(freeRanges([d], members, cells))[0];
          const inMonth = d.getMonth() === month.getMonth();
          const isToday = sameDay(d, today);
          return (
            <button
              key={k}
              type="button"
              onClick={() => onPick(d)}
              aria-label={`${d.getDate()}/${d.getMonth() + 1}: nhiều nhất ${max}/${N} người rảnh. Mở tuần này`}
              className={`group flex flex-col rounded-lg border p-2.5 text-left transition hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-[0_8px_20px_-14px_rgba(28,25,23,0.5)] active:translate-y-0 ${
                inMonth ? 'border-stone-200 bg-white' : 'border-transparent bg-stone-100/60 opacity-60'
              } ${isToday ? 'ring-2 ring-stone-900 ring-offset-1 ring-offset-paper' : ''}`}
            >
              <div className="flex items-baseline justify-between">
                <span className={`text-[15px] font-semibold tabular-nums ${inMonth ? 'text-stone-900' : 'text-stone-500'}`}>{d.getDate()}</span>
                {max > 0 && (
                  <span className="rounded-full bg-emerald-50 px-1.5 text-[11px] font-semibold tabular-nums text-emerald-700">
                    {max}/{N}
                  </span>
                )}
              </div>
              <div className="mt-auto">
                <div className="mb-1.5 h-4 truncate text-[11px] text-stone-500">{best ? `${hh(best.from)}–${hh(best.to)}` : ''}</div>
                <div className="flex h-5 items-end gap-px" aria-hidden>
                  {hours.map((c, i) => (
                    <span
                      key={i}
                      className="flex-1 rounded-[2px]"
                      style={{
                        height: c ? `${30 + (70 * c) / N}%` : '18%',
                        background: c ? `rgb(5 150 105 / ${0.25 + (0.75 * c) / N})` : 'var(--color-stone-200)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
