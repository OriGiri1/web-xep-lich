// Self-check for the range logic. Run: npm run check
import assert from 'node:assert/strict';
import { bestRanges, cellKey, fmtRange, freeRanges, startOfWeek, topRanges, weekLabel, type Cell } from './schedule.ts';

const members = [1, 2, 3].map((i) => ({ id: `m${i}`, name: `N${i}`, order: i }));
const sat = new Date(2026, 10, 28);
const cells: Record<string, Cell> = {};
for (const h of [18, 19, 20]) for (const m of members) cells[cellKey(m.id, '2026-11-28', h)] = { s: 'free' };
cells[cellKey('m1', '2026-11-28', 21)] = { s: 'free' };
cells[cellKey('m2', '2026-11-28', 21)] = { s: 'busy' };

const ranges = freeRanges([sat], members, cells);
assert.deepEqual(ranges.map((r) => [r.from, r.to, r.count]), [[18, 21, 3], [21, 22, 1]]);
assert.equal(fmtRange(bestRanges(ranges)[0]), 'Thứ 7 (28/11) 18:00–21:00');
assert.equal(topRanges(ranges)[0].count, 3);
assert.deepEqual(bestRanges([]), []);
assert.equal(startOfWeek(sat).getDate(), 23);
assert.equal(weekLabel(new Date(2026, 10, 23), new Date(2026, 10, 25)), 'Tuần 23/11 - 29/11/2026 (Hôm nay)');
console.log('schedule.check: ok');
