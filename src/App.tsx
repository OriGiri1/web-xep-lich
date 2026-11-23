import { ArrowLeft, ArrowRight, Check, Copy, Loader2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { InlineEdit } from './components/InlineEdit';
import { MonthView } from './components/MonthView';
import { WeekGrid } from './components/WeekGrid';
import { bestRanges, dateKey, dayName, dm, fmtRange, freeRanges, sameDay, startOfWeek, topRanges, weekDays, weekLabel } from './lib/schedule';
import { store, useBoard, type BoardState } from './services/scheduleStore';

type View = 'day' | 'week' | 'month';
const VIEWS = [
  ['day', 'Ngày'],
  ['week', 'Tuần'],
  ['month', 'Tháng'],
] as const;

export default function App() {
  const board = useBoard();
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [focusDay, setFocusDay] = useState<string | null>(() => dateKey(new Date()));
  const [toast, setToast] = useState<string | null>(null);

  const weekTime = startOfWeek(anchor).getTime();
  const dayTime = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()).getTime();
  // Month view keeps the anchor's week so "Chốt kèo" still summarises a week.
  const days = useMemo(() => (view === 'day' ? [new Date(dayTime)] : weekDays(new Date(weekTime))), [view, dayTime, weekTime]);
  const ranges = useMemo(() => (board ? freeRanges(days, board.members, board.cells) : []), [days, board]);
  const best = bestRanges(ranges);
  const N = board?.members.length ?? 0;
  const onFocused = useCallback(() => setFocusDay(null), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  if (!board) return <div className="grid h-full place-items-center text-sm text-stone-500">Đang tải lịch…</div>;

  const today = new Date();
  const dayLabel = `${dayName(anchor)} ${dm(anchor)}/${anchor.getFullYear()}`;
  const label =
    view === 'day'
      ? `${dayLabel}${sameDay(anchor, today) ? ' (Hôm nay)' : ''}`
      : view === 'week'
        ? weekLabel(days[0])
        : `Tháng ${anchor.getMonth() + 1}/${anchor.getFullYear()}${
            anchor.getMonth() === today.getMonth() && anchor.getFullYear() === today.getFullYear() ? ' (Hôm nay)' : ''
          }`;
  const span = view === 'day' ? 'ngày' : 'tuần';

  const shift = (dir: 1 | -1) =>
    setAnchor((a) =>
      view === 'month'
        ? new Date(a.getFullYear(), a.getMonth() + dir, 1)
        : new Date(a.getFullYear(), a.getMonth(), a.getDate() + (view === 'day' ? 1 : 7) * dir),
    );

  const pickView = (v: View) => {
    setView(v);
    setFocusDay(dateKey(anchor));
  };

  const copySummary = async () => {
    const top = topRanges(ranges);
    const text = [
      `${board.title} · ${view === 'day' ? dayLabel : weekLabel(days[0], new Date(0))}`,
      '',
      ...(top.length
        ? [
            `Chốt: ${fmtRange(top[0])} (${top[0].count}/${N} người rảnh)`,
            '',
            'Các khung giờ rảnh nhiều nhất:',
            ...top.map((r, i) => `${i + 1}. ${fmtRange(r)}: ${r.count}/${N} người rảnh`),
          ]
        : [`Chưa có ai đánh dấu rảnh trong ${span} này.`]),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setToast(top.length ? 'Đã copy lịch chốt vào clipboard' : `Đã copy (${span} này chưa có giờ rảnh)`);
    } catch {
      setToast('Không copy được: trình duyệt chặn clipboard');
    }
  };

  return (
    <div className="flex min-h-dvh flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="min-w-0 text-[22px] font-semibold sm:text-[26px] tracking-[-0.02em] text-stone-950">
              <InlineEdit
                value={board.title}
                label="Tên nhóm"
                onSave={store.setTitle}
                className="-ml-1.5 px-1.5 min-h-11 sm:min-h-0"
                inputClassName="-ml-1.5 w-[min(28rem,80vw)] px-1.5 min-h-11 sm:min-h-0"
              />
            </h1>
            <SyncPill board={board} />
          </div>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-stone-500">
            <span className="sm:hidden">Chạm một ô để đổi lần lượt Rảnh → Bận → Lí do → trống. Chạm bút chì để sửa lí do, chạm tên để đổi tên.</span>
            <span className="hidden sm:inline">
              Kéo dọc trong cột của bạn để chọn nhiều giờ, thả chuột rồi chọn Rảnh, Bận hoặc Lí do. Bấm một ô để đổi lần lượt Rảnh → Bận → Lí do → trống.
              Bấm vào tên để sửa.
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Chế độ xem" className="relative grid grid-cols-3 rounded-lg border border-stone-200 bg-white p-0.5">
            <span
              aria-hidden
              className="absolute inset-y-0.5 left-0.5 w-[calc((100%-4px)/3)] rounded-md bg-stone-900 shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              style={{ transform: `translateX(${VIEWS.findIndex(([v]) => v === view) * 100}%)` }}
            />
            {VIEWS.map(([v, text]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => pickView(v)}
                className={`relative rounded-md px-4 py-1.5 text-[13px] min-h-11 sm:min-h-0 font-medium transition-colors duration-300 ${
                  view === v ? 'text-white' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {text}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={copySummary}
            className="flex items-center gap-2 rounded-lg bg-emerald-700 px-3.5 py-2 min-h-11 sm:min-h-0 text-[13px] font-semibold text-white shadow-sm transition hover:bg-emerald-800 active:translate-y-px"
          >
            <Copy size={14} aria-hidden /> Chốt kèo &amp; Copy
          </button>
        </div>
      </header>

      <nav aria-label="Chuyển thời gian" className="flex items-center gap-2">
        <NavButton onClick={() => shift(-1)}>
          <ArrowLeft size={14} aria-hidden /> Trước
        </NavButton>
        <div className="min-w-0 flex-1 text-center text-[14px] font-semibold tabular-nums text-stone-800" aria-live="polite">
          <span key={label} className="inline-block animate-rise-in">
            {label}
          </span>
        </div>
        <NavButton onClick={() => shift(1)}>
          Sau <ArrowRight size={14} aria-hidden />
        </NavButton>
      </nav>

      {view !== 'month' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-2 text-[13px]">
          <span className="flex items-center gap-1.5 font-semibold text-emerald-900">
            <Sparkles size={14} aria-hidden /> Khung giờ đẹp nhất {span}:
          </span>
          {best.length ? (
            best.slice(0, 4).map((r) => (
              <span key={`${r.day.getTime()}-${r.from}-${r.count}`} className="animate-fade-in rounded-md bg-white px-2 py-0.5 font-medium text-emerald-900 ring-1 ring-emerald-200 tabular-nums">
                {fmtRange(r)} <span className="text-emerald-600">({r.count}/{N})</span>
              </span>
            ))
          ) : (
            <span className="text-emerald-800/70">chưa có ai đánh dấu Rảnh</span>
          )}
          {best.length > 4 && <span className="text-emerald-700">+{best.length - 4} khung khác</span>}
        </div>
      )}

      {/* Fills the rest of the screen, but never shorter than ~one screen: on short windows the page scrolls
          instead of squeezing the grid (which used to push the cell menu off-screen). Content is absolute so
          the grid's own height never stretches the page. */}
      <main className="relative min-h-[min(640px,calc(100dvh-1.5rem))] flex-1 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
        <div key={view} className="absolute inset-0 animate-fade-in">
          {view === 'month' ? (
            <MonthView
              month={anchor}
              members={board.members}
              cells={board.cells}
              onPick={(d) => {
                setAnchor(d);
                setView('week');
                setFocusDay(dateKey(d));
              }}
            />
          ) : (
            <WeekGrid days={days} members={board.members} cells={board.cells} store={store} focusDay={focusDay} onFocused={onFocused} />
          )}
        </div>
      </main>

      {toast && (
        <div key={toast} role="status" className="animate-rise-in fixed bottom-5 left-1/2 z-50 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-2 rounded-lg bg-stone-900 px-4 py-2.5 text-[13px] font-medium text-white shadow-lg">
          <Check size={14} className="text-emerald-400" aria-hidden /> {toast}
        </div>
      )}
    </div>
  );
}

function SyncPill({ board }: { board: BoardState }) {
  const [cls, text] = board.local
    ? ['border-amber-200 bg-amber-50 text-amber-800', 'Chế độ cục bộ (chưa cấu hình Firebase)']
    : board.pending
      ? ['border-stone-200 bg-stone-50 text-stone-600', 'Đang đồng bộ...']
      : ['border-emerald-200 bg-emerald-50 text-emerald-800', 'Đã đồng bộ trực tuyến'];
  return (
    <span role="status" className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${cls}`}>
      {board.pending ? (
        <Loader2 size={12} className="animate-spin" aria-hidden />
      ) : (
        <span className={`size-1.5 rounded-full ${board.local ? 'bg-amber-500' : 'bg-emerald-500'}`} aria-hidden />
      )}
      {text}
    </span>
  );
}

function NavButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 min-h-11 sm:min-h-0 text-[13px] font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950 active:translate-y-px"
    >
      {children}
    </button>
  );
}
