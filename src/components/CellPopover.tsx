import { Eraser } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_REASON, type Cell } from '../lib/schedule';

export type Pop = {
  member: string;
  rows: number[];
  rect: DOMRect;
  mode: 'menu' | 'reason'; // menu: after a drag. reason: straight to the text input.
  reason: string;
};

type Props = { pop: Pop; label: string; onApply: (c: Cell | null) => void; onClose: () => void };

export function CellPopover({ pop, label, onApply, onClose }: Props) {
  const [asking, setAsking] = useState(pop.mode === 'reason');
  const [text, setText] = useState(pop.reason);
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width?: number }>({ left: -9999, top: 0 });

  // Phones get a bottom sheet pinned to the visible viewport instead of a menu beside the cell:
  // the on-screen keyboard resizes and scrolls the page, which must move the sheet, not close it.
  const [sheet] = useState(() => matchMedia('(max-width: 639px)').matches);

  useLayoutEffect(() => {
    const place = () => {
      const el = box.current;
      if (!el) return;
      // visualViewport excludes browser chrome and the on-screen keyboard.
      const vv = visualViewport;
      const vw = vv?.width ?? innerWidth;
      const vh = vv?.height ?? innerHeight;
      const ox = vv?.offsetLeft ?? 0;
      const oy = vv?.offsetTop ?? 0;
      const h = el.offsetHeight;
      if (sheet) return setPos({ left: ox + 8, top: oy + vh - h - 8, width: vw - 16 });
      const { rect } = pop;
      const w = el.offsetWidth;
      let left = rect.right + 8;
      if (left + w > vw - 8) left = rect.left - w - 8;
      // Prefer opening downward from the cell; flip above it when there is no room below.
      let top = rect.top - 6;
      if (top + h > vh - 8) top = rect.bottom - h + 6;
      setPos({ left: Math.max(8, Math.min(left, vw - w - 8)), top: Math.max(8, Math.min(top, vh - h - 8)) });
    };
    place();
    if (!sheet || !visualViewport) return;
    visualViewport.addEventListener('resize', place);
    visualViewport.addEventListener('scroll', place);
    return () => {
      visualViewport?.removeEventListener('resize', place);
      visualViewport?.removeEventListener('scroll', place);
    };
  }, [pop, asking, sheet]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    if (sheet)
      return () => {
        window.removeEventListener('pointerdown', down);
        window.removeEventListener('keydown', key);
      };
    // Anchored menu: any scroll (grid or page) or resize moves the cell away from it.
    const away = (e: Event) => !box.current?.contains(e.target as Node) && onClose();
    // Listen from the next frame: a drag's last auto-scroll step still dispatches its scroll event
    // one frame after release, and must not close the menu it just opened.
    const raf = requestAnimationFrame(() => {
      window.addEventListener('scroll', away, true);
      window.addEventListener('resize', onClose);
    });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key);
      window.removeEventListener('scroll', away, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose, sheet]);

  return (
    <>
    {sheet && <div aria-hidden className="animate-fade-in fixed inset-0 z-40 bg-stone-900/25" />}
    <div
      ref={box}
      role="dialog"
      aria-label={`Đặt trạng thái: ${label}`}
      style={pos}
      className={`fixed z-50 rounded-xl border border-stone-200 bg-white p-1.5 shadow-[0_18px_40px_-16px_rgba(28,25,23,0.35)] ${
        sheet ? 'animate-rise-in p-2' : 'animate-pop-in w-64 origin-top'
      }`}
    >
      <p className="px-2 pt-1 pb-2 text-[12px] sm:text-[11px] leading-snug text-stone-500">{label}</p>

      {pop.mode === 'menu' && (
        <div className="grid gap-0.5">
          <Option dot="bg-emerald-500" onClick={() => onApply({ s: 'free' })}>
            Rảnh
          </Option>
          <Option dot="bg-rose-500" onClick={() => onApply({ s: 'busy' })}>
            Bận
          </Option>
          <Option dot="bg-sky-500" active={asking} onClick={() => setAsking(true)}>
            Lí do cụ thể
          </Option>
        </div>
      )}

      {asking && (
        <form
          className="flex gap-1.5 p-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            onApply({ s: 'reason', r: text.trim() || DEFAULT_REASON });
          }}
        >
          <input
            autoFocus
            aria-label="Lí do cụ thể"
            value={text}
            maxLength={80}
            placeholder="VD: Về quê, Đi học"
            onChange={(e) => setText(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="min-w-0 flex-1 rounded-lg border border-sky-200 bg-sky-50/60 px-2.5 py-1.5 text-[16px] outline-none min-h-11 sm:min-h-0 sm:text-[13px] placeholder:text-stone-400 focus:border-sky-500"
          />
          <button
            type="submit"
            className="min-h-11 sm:min-h-0 rounded-lg bg-sky-600 px-3 text-[13px] sm:px-2.5 sm:text-[12px] font-semibold text-white transition hover:bg-sky-700 active:translate-y-px"
          >
            Áp dụng
          </button>
        </form>
      )}

      <div className="my-1 h-px bg-stone-100" />
      <button
        type="button"
        onClick={() => onApply(null)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-stone-500 min-h-11 sm:min-h-0 sm:text-[12px] transition hover:bg-stone-100 hover:text-stone-800"
      >
        <Eraser size={13} aria-hidden /> Xóa
      </button>
    </div>
    </>
  );
}

function Option({ dot, active, onClick, children }: { dot: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[15px] font-medium min-h-11 sm:min-h-0 sm:text-[13px] transition hover:bg-stone-100 active:translate-y-px ${active ? 'bg-stone-100' : ''}`}
    >
      <span className={`size-2.5 rounded-full ${dot}`} aria-hidden />
      {children}
    </button>
  );
}
