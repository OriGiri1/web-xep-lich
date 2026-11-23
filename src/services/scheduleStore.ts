import { collection, doc, onSnapshot, setDoc, writeBatch, type Firestore } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { BOARD_ID, db } from '../lib/firebase';
import type { Cell, Member } from '../lib/schedule';

export type BoardState = {
  title: string;
  members: Member[];
  cells: Record<string, Cell>;
  pending: boolean; // local writes not yet acknowledged by the server
  local: boolean; // running without Firebase
};

export interface ScheduleStore {
  subscribe(cb: (s: BoardState) => void): () => void;
  setTitle(title: string): void;
  addMember(name: string): string;
  renameMember(id: string, name: string): void;
  /** cell = null clears the slots. */
  setCells(keys: string[], cell: Cell | null): void;
}

type MemberMap = Record<string, { name: string; order: number }>;

const DEFAULT_TITLE = 'Lịch Hẹn Nhóm';
// Fixed ids so two tabs seeding an empty board at once write the same thing.
const seedMembers = (): MemberMap => Object.fromEntries([1, 2, 3, 4].map((i) => [`m${i}`, { name: `Người ${i}`, order: i }]));
const toList = (m: MemberMap = {}): Member[] =>
  Object.entries(m)
    .map(([id, v]) => ({ id, name: v.name, order: v.order }))
    .sort((a, b) => a.order - b.order);
const newId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const clean = (c: Cell): Cell => (c.s === 'reason' ? { s: c.s, r: c.r ?? '' } : { s: c.s });

function firestoreStore(db: Firestore): ScheduleStore {
  const board = doc(db, 'boards', BOARD_ID);
  const cellsCol = collection(board, 'cells');
  const fail = (e: unknown) => console.error('[Firestore]', e);

  return {
    subscribe(cb) {
      let title = DEFAULT_TITLE;
      let members: MemberMap = {};
      let cells: Record<string, Cell> = {};
      let boardPending = false;
      let cellsPending = false;
      const emit = () =>
        cb({ title, members: toList(members), cells, pending: boardPending || cellsPending, local: false });

      const offBoard = onSnapshot(
        board,
        { includeMetadataChanges: true },
        (s) => {
          if (!s.exists()) {
            if (!s.metadata.fromCache) setDoc(board, { title: DEFAULT_TITLE, members: seedMembers() }, { merge: true }).catch(fail);
          } else {
            const d = s.data();
            title = d.title ?? DEFAULT_TITLE;
            members = d.members ?? {};
          }
          boardPending = s.metadata.hasPendingWrites;
          emit();
        },
        fail,
      );
      const offCells = onSnapshot(
        cellsCol,
        { includeMetadataChanges: true },
        (s) => {
          const next: Record<string, Cell> = {};
          s.forEach((d) => {
            next[d.id] = d.data() as Cell;
          });
          cells = next;
          cellsPending = s.metadata.hasPendingWrites;
          emit();
        },
        fail,
      );
      return () => {
        offBoard();
        offCells();
      };
    },
    setTitle: (title) => void setDoc(board, { title }, { merge: true }).catch(fail),
    addMember(name) {
      const id = newId();
      setDoc(board, { members: { [id]: { name, order: Date.now() } } }, { merge: true }).catch(fail);
      return id;
    },
    renameMember: (id, name) => void setDoc(board, { members: { [id]: { name } } }, { merge: true }).catch(fail),
    setCells(keys, cell) {
      const batch = writeBatch(db); // drag covers at most 112 slots, under the 500-write batch limit
      for (const k of keys) (cell ? batch.set(doc(cellsCol, k), clean(cell)) : batch.delete(doc(cellsCol, k)));
      batch.commit().catch(fail);
    },
  };
}

function localStore(): ScheduleStore {
  type Data = { title: string; members: MemberMap; cells: Record<string, Cell> };
  const KEY = `lich-hen-nhom:${BOARD_ID}`;
  const load = (): Data => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* private mode or corrupt value: start fresh */
    }
    return { title: DEFAULT_TITLE, members: seedMembers(), cells: {} };
  };
  let data = load();
  const subs = new Set<(s: BoardState) => void>();
  const emit = () => {
    const s = { title: data.title, members: toList(data.members), cells: data.cells, pending: false, local: true };
    subs.forEach((f) => f(s));
  };
  const write = (next: Data) => {
    data = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* storage full or blocked: keep in memory */
    }
    emit();
  };
  // Other tabs of the same browser.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      data = load();
      emit();
    }
  });

  return {
    subscribe(cb) {
      subs.add(cb);
      emit();
      return () => void subs.delete(cb);
    },
    setTitle: (title) => write({ ...data, title }),
    addMember(name) {
      const id = newId();
      write({ ...data, members: { ...data.members, [id]: { name, order: Date.now() } } });
      return id;
    },
    renameMember: (id, name) => write({ ...data, members: { ...data.members, [id]: { ...data.members[id], name } } }),
    setCells(keys, cell) {
      const cells = { ...data.cells };
      for (const k of keys) {
        if (cell) cells[k] = clean(cell);
        else delete cells[k];
      }
      write({ ...data, cells });
    },
  };
}

export const store: ScheduleStore = db ? firestoreStore(db) : localStore();

export function useBoard() {
  const [state, setState] = useState<BoardState | null>(null);
  useEffect(() => store.subscribe(setState), []);
  return state;
}
