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
  const [pos, setPos] = useState({ left: -9999, top: 0 });

  useLayoutEffect(() => {
    const el = box.current!;
    const { rect } = pop;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = rect.right + 8;
    if (left + w > innerWidth - 8) left = rect.left - w - 8;
    setPos({ left: Math.max(8, left), top: Math.max(8, Math.min(rect.top - 6, innerHeight - h - 8)) });
  }, [pop, asking]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key);
    };
  }, [onClose]);

  return (
    <div
      ref={box}
      role="dialog"
      aria-label={`Đặt trạng thái: ${label}`}
      style={pos}
      className="fixed z-50 w-64 rounded-xl border border-stone-200 bg-white p-1.5 shadow-[0_18px_40px_-16px_rgba(28,25,23,0.35)]"
    >
      <p className="px-2 pt-1 pb-2 text-[11px] leading-snug text-stone-500">{label}</p>

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
            className="min-w-0 flex-1 rounded-lg border border-sky-200 bg-sky-50/60 px-2.5 py-1.5 text-[13px] outline-none placeholder:text-stone-400 focus:border-sky-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-sky-600 px-2.5 text-[12px] font-semibold text-white transition hover:bg-sky-700 active:translate-y-px"
          >
            Áp dụng
          </button>
        </form>
      )}

      <div className="my-1 h-px bg-stone-100" />
      <button
        type="button"
        onClick={() => onApply(null)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
      >
        <Eraser size={13} aria-hidden /> Xóa
      </button>
    </div>
  );
}

function Option({ dot, active, onClick, children }: { dot: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] font-medium transition hover:bg-stone-100 active:translate-y-px ${active ? 'bg-stone-100' : ''}`}
    >
      <span className={`size-2.5 rounded-full ${dot}`} aria-hidden />
      {children}
    </button>
  );
}
