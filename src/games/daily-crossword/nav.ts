/** Pure cursor logic for the grid UI (kept out of the component so it can be unit tested). */
import { entriesAt, type CrosswordState, type Entry } from "./engine";
import { stepSpatial, type Direction } from "./grid";

export interface Cursor {
  row: number;
  col: number;
  dir: Direction;
}

export const other = (d: Direction): Direction => (d === "across" ? "down" : "across");

/** The entry under the cursor, falling back to the other direction when needed. */
export function activeEntry(s: CrosswordState, cur: Cursor): Entry | null {
  const at = entriesAt(s, cur.row, cur.col);
  return at[cur.dir] ?? at[other(cur.dir)] ?? null;
}

/** Normalise a cursor so its direction has an entry at that cell. */
export function fixCursor(s: CrosswordState, cur: Cursor): Cursor {
  const at = entriesAt(s, cur.row, cur.col);
  if (at[cur.dir]) return cur;
  return { ...cur, dir: other(cur.dir) };
}

export function startCursor(s: CrosswordState): Cursor {
  const e = s.entries[0];
  return { row: e.cells[0].row, col: e.cells[0].col, dir: e.direction };
}

const indexIn = (e: Entry, cur: Pick<Cursor, "row" | "col">) => e.cells.findIndex((c) => c.row === cur.row && c.col === cur.col);

/** After typing: move to the next cell of the entry (staying on the last cell). */
export function advance(s: CrosswordState, cur: Cursor): Cursor {
  const e = activeEntry(s, cur);
  if (!e) return cur;
  const i = indexIn(e, cur);
  const next = e.cells[Math.min(i + 1, e.cells.length - 1)];
  return { row: next.row, col: next.col, dir: e.direction };
}

export function retreat(s: CrosswordState, cur: Cursor): Cursor {
  const e = activeEntry(s, cur);
  if (!e) return cur;
  const i = indexIn(e, cur);
  const prev = e.cells[Math.max(i - 1, 0)];
  return { row: prev.row, col: prev.col, dir: e.direction };
}

/** Arrow keys move spatially over blocks; the direction follows the arrow's axis when possible. */
export function arrow(s: CrosswordState, cur: Cursor, key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"): Cursor {
  const [dr, dc] = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[key];
  const axis: Direction = dr ? "down" : "across";
  const target = stepSpatial(s.solution, cur.row, cur.col, dr, dc) ?? { row: cur.row, col: cur.col };
  return fixCursor(s, { ...target, dir: axis });
}

export function toggle(s: CrosswordState, cur: Cursor): Cursor {
  const at = entriesAt(s, cur.row, cur.col);
  return at[other(cur.dir)] ? { ...cur, dir: other(cur.dir) } : cur;
}

/** Tab order: across entries by number, then down entries. Lands on the first empty cell. */
export function jumpEntry(s: CrosswordState, cur: Cursor, delta: 1 | -1): Cursor | null {
  const e = activeEntry(s, cur);
  const i = e ? s.entries.indexOf(e) : -1;
  const n = s.entries[i + delta];
  if (!n) return null;
  return focusEntry(s, n);
}

export function focusEntry(s: CrosswordState, e: Entry): Cursor {
  const empty = e.cells.find((c) => !s.fill[c.row][c.col]) ?? e.cells[0];
  return { row: empty.row, col: empty.col, dir: e.direction };
}

export function edge(s: CrosswordState, cur: Cursor, end: "first" | "last"): Cursor {
  const e = activeEntry(s, cur);
  if (!e) return cur;
  const c = end === "first" ? e.cells[0] : e.cells[e.cells.length - 1];
  return { row: c.row, col: c.col, dir: e.direction };
}
