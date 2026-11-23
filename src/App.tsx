import { ArrowLeft, ArrowRight, Check, Copy, Loader2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { InlineEdit } from './components/InlineEdit';
import { MonthView } from './components/MonthView';
import { WeekGrid } from './components/WeekGrid';
import { bestRanges, dateKey, fmtRange, freeRanges, startOfWeek, topRanges, weekDays, weekLabel } from './lib/schedule';
import { store, useBoard, type BoardState } from './services/scheduleStore';

type View = 'week' | 'month';

export default function App() {
  const board = useBoard();
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [focusDay, setFocusDay] = useState<string | null>(() => dateKey(new Date()));
  const [toast, setToast] = useState<string | null>(null);

  const weekTime = startOfWeek(anchor).getTime();
  const days = useMemo(() => weekDays(new Date(weekTime)), [weekTime]);
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
  const label =
    view === 'week'
      ? weekLabel(days[0])
      : `Tháng ${anchor.getMonth() + 1}/${anchor.getFullYear()}${
          anchor.getMonth() === today.getMonth() && anchor.getFullYear() === today.getFullYear() ? ' (Hôm nay)' : ''
        }`;

  const shift = (dir: 1 | -1) =>
    setAnchor((a) =>
      view === 'week' ? new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7 * dir) : new Date(a.getFullYear(), a.getMonth() + dir, 1),
    );

  const copySummary = async () => {
    const top = topRanges(ranges);
    const text = [
      `${board.title} · ${weekLabel(days[0], new Date(0))}`,
      '',
      ...(top.length
        ? [
            `Chốt: ${fmtRange(top[0])} (${top[0].count}/${N} người rảnh)`,
            '',
            'Các khung giờ rảnh nhiều nhất:',
            ...top.map((r, i) => `${i + 1}. ${fmtRange(r)}: ${r.count}/${N} người rảnh`),
          ]
        : ['Chưa có ai đánh dấu rảnh trong tuần này.']),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setToast(top.length ? 'Đã copy lịch chốt vào clipboard' : 'Đã copy (tuần này chưa có giờ rảnh)');
    } catch {
      setToast('Không copy được: trình duyệt chặn clipboard');
    }
  };

  return (
    <div className="flex h-dvh flex-col gap-3 px-4 py-4 lg:px-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="min-w-0 text-[26px] font-semibold tracking-[-0.02em] text-stone-950">
              <InlineEdit
                value={board.title}
                label="Tên nhóm"
                onSave={store.setTitle}
                className="-ml-1.5 px-1.5"
                inputClassName="-ml-1.5 w-[min(28rem,80vw)] px-1.5"
              />
            </h1>
            <SyncPill board={board} />
          </div>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-stone-500">
            Kéo dọc trong cột của bạn để chọn nhiều giờ, thả chuột rồi chọn Rảnh, Bận hoặc Lí do. Bấm một ô để đổi lần lượt Rảnh → Bận → Lí do → trống.
            Bấm vào tên để sửa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Chế độ xem" className="flex rounded-lg border border-stone-200 bg-white p-0.5">
            {(
              [
                ['week', 'Lịch theo tuần'],
                ['month', 'Toàn bộ tháng'],
              ] as const
            ).map(([v, text]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                  view === v ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                {text}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={copySummary}
            className="flex items-center gap-2 rounded-lg bg-emerald-700 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-emerald-800 active:translate-y-px"
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
          {label}
        </div>
        <NavButton onClick={() => shift(1)}>
          Sau <ArrowRight size={14} aria-hidden />
        </NavButton>
      </nav>

      {view === 'week' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-2 text-[13px]">
          <span className="flex items-center gap-1.5 font-semibold text-emerald-900">
            <Sparkles size={14} aria-hidden /> Khung giờ đẹp nhất tuần:
          </span>
          {best.length ? (
            best.slice(0, 4).map((r) => (
              <span key={`${r.day.getTime()}-${r.from}`} className="rounded-md bg-white px-2 py-0.5 font-medium text-emerald-900 ring-1 ring-emerald-200 tabular-nums">
                {fmtRange(r)} <span className="text-emerald-600">({r.count}/{N})</span>
              </span>
            ))
          ) : (
            <span className="text-emerald-800/70">chưa có ai đánh dấu Rảnh</span>
          )}
          {best.length > 4 && <span className="text-emerald-700">+{best.length - 4} khung khác</span>}
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
        {view === 'week' ? (
          <WeekGrid days={days} members={board.members} cells={board.cells} store={store} focusDay={focusDay} onFocused={onFocused} />
        ) : (
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
        )}
      </main>

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-stone-900 px-4 py-2.5 text-[13px] font-medium text-white shadow-lg">
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
      className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950 active:translate-y-px"
    >
      {children}
    </button>
  );
}
