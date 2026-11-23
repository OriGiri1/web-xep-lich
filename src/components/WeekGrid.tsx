import { Pencil, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { DEFAULT_REASON, HOURS, PERIODS, cellKey, dateKey, dayName, dm, freeCount, hh, sameDay, type Cell, type Member } from '../lib/schedule';
import type { ScheduleStore } from '../services/scheduleStore';
import { CellPopover, type Pop } from './CellPopover';
import { InlineEdit } from './InlineEdit';

// Column widths live in index.css (--w-*) so they can shrink on phones.
const PER_DAY = HOURS.length;

const TONE: Record<Cell['s'], string> = {
  free: 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200/80',
  busy: 'bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-200/80',
  reason: 'bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-200/80',
};
const LABEL: Record<Cell['s'], string> = { free: 'Rảnh', busy: 'Bận', reason: '' };

type Props = {
  days: Date[];
  members: Member[];
  cells: Record<string, Cell>;
  store: ScheduleStore;
  focusDay: string | null;
  onFocused: () => void;
};

export function WeekGrid({ days, members, cells, store, focusDay, onFocused }: Props) {
  const rows = useMemo(
    () => days.flatMap((d, di) => HOURS.map((h, hi) => ({ d, key: dateKey(d), h, hi, row: di * PER_DAY + hi }))),
    [days],
  );
  const scroller = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLTableSectionElement>(null);
  const drag = useRef<{ member: string; start: number; end: number; moved: boolean } | null>(null);
  const ptr = useRef<number | null>(null); // last pointer clientY during a drag, read by the auto-scroll loop
  const [sel, setSel] = useState<{ member: string; a: number; b: number } | null>(null);
  const [pop, setPop] = useState<Pop | null>(null);
  const [newMember, setNewMember] = useState<string | null>(null);

  const N = members.length;
  const keyOf = (m: string, r: number) => cellKey(m, rows[r].key, rows[r].h);
  const counts = useMemo(() => rows.map((r) => freeCount(members, cells, r.key, r.h)), [rows, members, cells]);
  const peak = Math.max(0, ...counts);
  const today = new Date();

  const closePop = useCallback(() => {
    setPop(null);
    if (!drag.current) setSel(null); // a new drag that closed the popover keeps its own selection
  }, []);

  const openPop = (member: string, list: number[], mode: Pop['mode'], reason: string) => {
    const el = document.querySelector(`[data-cell="${member}:${list[list.length - 1]}"]`);
    if (!el) return;
    setSel({ member, a: list[0], b: list[list.length - 1] });
    setPop({ member, rows: list, rect: el.getBoundingClientRect(), mode, reason });
  };

  // Click order: empty → Rảnh → Bận → Lí do (opens input) → empty.
  const cycle = (member: string, row: number) => {
    const k = keyOf(member, row);
    const s = cells[k]?.s;
    if (!s) store.setCells([k], { s: 'free' });
    else if (s === 'free') store.setCells([k], { s: 'busy' });
    else if (s === 'busy') {
      store.setCells([k], { s: 'reason', r: DEFAULT_REASON });
      openPop(member, [row], 'reason', DEFAULT_REASON);
    } else store.setCells([k], null);
  };

  // Grid body in viewport coords: below the sticky header, above the scrollbar, clipped to the window.
  const bounds = () => {
    const el = scroller.current!;
    const r = el.getBoundingClientRect();
    return { top: Math.max(r.top + (head.current?.offsetHeight ?? 0), 0), bottom: Math.min(r.top + el.clientHeight, innerHeight) };
  };

  // Moves the drag end to the row at height y, clamped to the visible grid. Selections may span days.
  const track = (y: number) => {
    const d = drag.current;
    const cell = document.querySelector(`[data-cell="${d?.member}:${d?.start}"]`);
    if (!d || !cell) return;
    const c = cell.getBoundingClientRect();
    const b = bounds();
    // Probe in the drag's own column: the sticky day/period cells span many rows and would report the wrong one.
    const tr = document.elementFromPoint(c.left + c.width / 2, Math.min(Math.max(y, b.top + 1), b.bottom - 1))?.closest<HTMLElement>('tr[data-row]');
    if (!tr) return;
    const r = Number(tr.dataset.row);
    if (r === d.end) return;
    d.end = r;
    d.moved = true;
    setSel({ member: d.member, a: d.start, b: r });
  };

  // While dragging near (or past) the top/bottom edge, scroll the grid at a capped, readable speed.
  const autoScroll = () => {
    let last = performance.now();
    let acc = 0;
    const own = drag.current; // the loop ends with its own drag, so a fast re-drag never runs two loops
    const tick = (now: number) => {
      const d = drag.current;
      const el = scroller.current;
      if (!d || d !== own || !el) return;
      const dt = Math.min(now - last, 50) / 1000;
      last = now;
      const y = ptr.current;
      if (y !== null) {
        const b = bounds();
        const EDGE = 40;
        const into = y < b.top + EDGE ? y - (b.top + EDGE) : y > b.bottom - EDGE ? y - (b.bottom - EDGE) : 0;
        const speed = Math.sign(into) * Math.min(Math.abs(into) * 5, 260); // px/s, ~8 rows/s at most
        acc += speed * dt;
        const step = Math.trunc(acc);
        if (step) {
          acc -= step;
          const before = el.scrollTop;
          el.scrollTop += step;
          if (el.scrollTop === before) scrollBy(0, step); // grid at its end (or not scrollable, e.g. day view): move the page

          track(y);
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const onCellDown = (e: RPointerEvent, member: string, row: number) => {
    if (e.button !== 0) return;
    e.preventDefault(); // no text selection, no focus jump
    setPop(null);
    drag.current = { member, start: row, end: row, moved: false };
    ptr.current = e.clientY;
    setSel({ member, a: row, b: row });
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') autoScroll(); // touch drags pan the grid natively
  };

  // Re-bound every render so the handlers see current cells.
  useEffect(() => {
    // Only the row under the pointer matters; the column stays the one the drag started in.
    const move = (e: PointerEvent) => {
      // Chrome fires synthetic zero-movement moves when content scrolls under the pointer, with a stale y.
      if (!drag.current || (e.movementX === 0 && e.movementY === 0)) return;
      ptr.current = e.clientY;
      track(e.clientY);
    };
    const up = () => {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      ptr.current = null;
      if (!d.moved) {
        setSel(null);
        cycle(d.member, d.start);
        return;
      }
      const lo = Math.min(d.start, d.end);
      const hi = Math.max(d.start, d.end);
      const list = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
      const el = document.querySelector(`[data-cell="${d.member}:${d.end}"]`);
      if (!el) return setSel(null);
      setPop({ member: d.member, rows: list, rect: el.getBoundingClientRect(), mode: 'menu', reason: '' });
    };
    const cancel = () => {
      drag.current = null;
      ptr.current = null;
      setSel(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  });

  useEffect(() => {
    if (!focusDay) return;
    const tr = scroller.current?.querySelector<HTMLElement>(`tr[data-day="${focusDay}"]`);
    if (tr && scroller.current) scroller.current.scrollTop = tr.offsetTop - (head.current?.offsetHeight ?? 0);
    onFocused();
  }, [focusDay, rows, onFocused]);

  const popLabel = (p: Pop) => {
    const name = members.find((m) => m.id === p.member)?.name ?? '';
    const a = rows[p.rows[0]];
    const b = rows[p.rows[p.rows.length - 1]];
    const span =
      a.key === b.key
        ? `${dayName(a.d)} (${dm(a.d)}) ${hh(a.h)}–${hh(b.h + 1)}`
        : `${dayName(a.d)} (${dm(a.d)}) ${hh(a.h)} → ${dayName(b.d)} (${dm(b.d)}) ${hh(b.h + 1)}`;
    return `${name} · ${span}${p.rows.length > 1 ? ` · ${p.rows.length} khung giờ` : ''}`;
  };

  const th = 'sticky top-0 h-12 sm:h-11 border-b border-stone-200 bg-stone-50 px-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500';
  const selLo = sel ? Math.min(sel.a, sel.b) : -1;
  const selHi = sel ? Math.max(sel.a, sel.b) : -1;

  return (
    <div ref={scroller} className="relative h-full overflow-auto select-none">
      <table className="w-max min-w-full border-separate border-spacing-0 text-[13px]">
        <thead ref={head}>
          <tr>
            <th scope="col" style={{ left: 0, width: 'var(--w-day)', minWidth: 'var(--w-day)' }} className={`${th} z-40`}>
              Ngày
            </th>
            <th scope="col" colSpan={2} style={{ left: 'var(--w-day)', minWidth: 'calc(var(--w-period) + var(--w-time))' }} className={`${th} z-40 border-r`}>
              Khung giờ
            </th>
            {members.map((m) => (
              <th key={m.id} scope="col" style={{ minWidth: 'var(--w-member)' }} className={`${th} z-30 border-l border-l-stone-100 normal-case tracking-normal`}>
                <InlineEdit
                  value={m.name}
                  label="Tên thành viên"
                  startEditing={m.id === newMember}
                  onSave={(v) => store.renameMember(m.id, v)}
                  className="block w-full px-1.5 py-1 text-[13px] font-semibold text-stone-800 min-h-11 sm:min-h-0"
                  inputClassName="w-full px-1.5 py-1 text-[16px] font-semibold text-stone-900 min-h-11 sm:min-h-0 sm:text-[13px]"
                />
              </th>
            ))}
            <th scope="col" style={{ width: 'var(--w-add)', minWidth: 'var(--w-add)' }} className={`${th} z-30 border-l border-l-stone-100 px-1`}>
              <button
                type="button"
                aria-label="Thêm người"
                title="Thêm người"
                onClick={() => setNewMember(store.addMember(`Người ${N + 1}`))}
                className="grid size-11 place-items-center sm:size-8 rounded-lg border border-dashed border-stone-300 text-stone-500 transition hover:border-stone-900 hover:bg-white hover:text-stone-900 active:translate-y-px"
              >
                <Plus size={15} aria-hidden />
              </button>
            </th>
            <th scope="col" style={{ right: 0, width: 'var(--w-free)', minWidth: 'var(--w-free)' }} className={`${th} z-40 border-l text-center`}>
              Rảnh
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const period = PERIODS.find((p) => p.from === r.h);
            const isToday = sameDay(r.d, today);
            const line =
              r.hi === 0 ? 'border-t-2 border-t-stone-300' : period ? 'border-t border-t-stone-300/80' : 'border-t border-t-stone-100';
            const n = counts[r.row];
            const isPeak = n > 0 && n === peak;
            return (
              <tr key={r.row} data-row={r.row} data-day={r.hi === 0 ? r.key : undefined} className="group">
                {r.hi === 0 && (
                  <td rowSpan={PER_DAY} style={{ left: 0 }} className={`sticky z-20 border-t-2 border-t-stone-300 bg-white align-top ${isToday ? 'bg-amber-50/70' : ''}`}>
                    <div className="sticky top-12 sm:top-11 px-1.5 py-2.5 sm:px-3">
                      <div className="text-[13px] font-semibold text-stone-900">{dayName(r.d)}</div>
                      <div className="text-[12px] text-stone-500">{dm(r.d)}</div>
                      {isToday && <div className="mt-1.5 inline-block rounded-full bg-stone-900 px-1 py-px text-[9px] whitespace-nowrap sm:px-1.5 sm:text-[10px] font-semibold text-white">Hôm nay</div>}
                    </div>
                  </td>
                )}
                {period && (
                  <td rowSpan={period.to - period.from} style={{ left: 'var(--w-day)', width: 'var(--w-period)' }} className={`sticky z-20 border-l border-l-stone-100 bg-stone-50 align-top ${line}`}>
                    <div className="sticky top-12 sm:top-11 flex justify-center py-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 [writing-mode:vertical-rl] rotate-180">{period.name}</span>
                    </div>
                  </td>
                )}
                <td style={{ left: 'calc(var(--w-day) + var(--w-period))', width: 'var(--w-time)' }} className={`sticky z-20 border-r border-r-stone-200 bg-white px-1.5 whitespace-nowrap sm:px-2.5 group-hover:bg-stone-50 ${line}`}>
                  <span className="font-medium text-stone-800">{hh(r.h)}</span>
                  <span className="hidden text-stone-400 sm:inline">–{hh(r.h + 1)}</span>
                </td>
                {members.map((m) => {
                  const c = cells[keyOf(m.id, r.row)];
                  const selected = sel?.member === m.id && r.row >= selLo && r.row <= selHi;
                  const status = c ? (c.s === 'reason' ? c.r || DEFAULT_REASON : LABEL[c.s]) : 'Trống';
                  return (
                    <td key={m.id} data-cell={`${m.id}:${r.row}`} onPointerDown={(e) => onCellDown(e, m.id, r.row)} className={`group/cell relative border-l border-l-stone-100 p-[2px] ${line}`}>
                      <button
                        type="button"
                        aria-label={`${m.name}, ${dayName(r.d)} ${dm(r.d)}, ${hh(r.h)}–${hh(r.h + 1)}: ${status}`}
                        title={c?.s === 'reason' ? c.r : undefined}
                        onClick={(e) => e.detail === 0 && cycle(m.id, r.row)}
                        className={`flex h-11 w-full items-center rounded-[5px] px-1.5 text-[12px] sm:h-6 sm:text-[11px] font-medium transition-colors ${
                          c ? TONE[c.s] : 'text-transparent hover:bg-stone-100'
                        } ${selected ? 'outline-2 -outline-offset-1 outline-stone-900' : ''} ${selected && !c ? 'bg-stone-200/70' : ''}`}
                      >
                        <span className={`truncate ${c?.s === 'reason' ? 'pr-4' : ''}`}>{c ? status : ''}</span>
                      </button>
                      {c?.s === 'reason' && (
                        <button
                          type="button"
                          aria-label={`Sửa lí do: ${c.r}`}
                          title="Sửa lí do"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => openPop(m.id, [r.row], 'reason', c.r ?? '')}
                          className="absolute top-1/2 right-0.5 grid size-11 -translate-y-1/2 sm:right-1 sm:size-5 place-items-center rounded text-sky-700 opacity-50 transition hover:bg-sky-200 hover:opacity-100 focus-visible:opacity-100 group-hover/cell:opacity-100"
                        >
                          <Pencil size={11} aria-hidden />
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className={`border-l border-l-stone-100 bg-stone-50/40 ${line}`} />
                <td
                  style={{
                    right: 0,
                    backgroundImage: n && !isPeak ? `linear-gradient(rgb(16 185 129 / ${0.06 + (0.3 * n) / N}), rgb(16 185 129 / ${0.06 + (0.3 * n) / N}))` : undefined,
                  }}
                  className={`sticky z-20 border-l border-l-stone-200 text-center tabular-nums ${line} ${
                    isPeak ? 'bg-emerald-600 font-semibold text-white' : n ? 'bg-white font-medium text-emerald-900' : 'bg-white text-stone-300'
                  }`}
                >
                  {n}/{N}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {pop && (
        <CellPopover
          key={`${pop.member}:${pop.rows.join(',')}:${pop.mode}`}
          pop={pop}
          label={popLabel(pop)}
          onClose={closePop}
          onApply={(cell) => {
            store.setCells(pop.rows.map((r) => keyOf(pop.member, r)), cell);
            closePop();
          }}
        />
      )}
    </div>
  );
}
