export type Status = 'free' | 'busy' | 'reason';
export type Cell = { s: Status; r?: string };
export type Member = { id: string; name: string; order: number };

export const DEFAULT_REASON = 'Có việc riêng';
export const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // slot starts 06..21
export const PERIODS = [
  { name: 'Sáng', from: 6, to: 12 },
  { name: 'Chiều', from: 12, to: 17 },
  { name: 'Tối', from: 17, to: 22 },
];

export const pad = (n: number) => String(n).padStart(2, '0');
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const cellKey = (memberId: string, day: string, hour: number) => `${memberId}_${day}_${hour}`;
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7)); // Monday
export const weekDays = (start: Date) => Array.from({ length: 7 }, (_, i) => addDays(start, i));
export const sameDay = (a: Date, b: Date) => dateKey(a) === dateKey(b);
export const dayName = (d: Date) => (d.getDay() === 0 ? 'Chủ nhật' : `Thứ ${d.getDay() + 1}`);
export const dm = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
export const hh = (h: number) => `${pad(h)}:00`;

export const weekLabel = (start: Date, today = new Date()) => {
  const end = addDays(start, 6);
  const now = weekDays(start).some((d) => sameDay(d, today));
  return `Tuần ${dm(start)} - ${dm(end)}/${end.getFullYear()}${now ? ' (Hôm nay)' : ''}`;
};

export const freeCount = (members: Member[], cells: Record<string, Cell>, day: string, h: number) =>
  members.filter((m) => cells[cellKey(m.id, day, h)]?.s === 'free').length;

export type Range = { day: Date; from: number; to: number; count: number };

/** Consecutive hours of one day that share the same free headcount, merged. Hours with nobody free are dropped. */
export function freeRanges(days: Date[], members: Member[], cells: Record<string, Cell>): Range[] {
  const out: Range[] = [];
  for (const day of days) {
    const k = dateKey(day);
    let cur: Range | null = null;
    for (const h of HOURS) {
      const c = freeCount(members, cells, k, h);
      if (cur && c === cur.count) {
        cur.to = h + 1;
        continue;
      }
      cur = c > 0 ? { day, from: h, to: h + 1, count: c } : null;
      if (cur) out.push(cur);
    }
  }
  return out;
}

export const bestRanges = (ranges: Range[]) => {
  const max = Math.max(0, ...ranges.map((r) => r.count));
  return ranges.filter((r) => r.count === max);
};

/** Most people first, then longest, then earliest. */
export const topRanges = (ranges: Range[], n = 5) =>
  [...ranges]
    .sort(
      (a, b) =>
        b.count - a.count || b.to - b.from - (a.to - a.from) || a.day.getTime() - b.day.getTime() || a.from - b.from,
    )
    .slice(0, n);

export const fmtRange = (r: Range) => `${dayName(r.day)} (${dm(r.day)}) ${hh(r.from)}–${hh(r.to)}`;
