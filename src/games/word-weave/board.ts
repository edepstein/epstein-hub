/** Word Weave geometry: lanes from coordinates, numbering, crossings, maximal runs (pure). */

export type Direction = "across" | "down";

export interface LaneSpec {
  id: string;
  direction: Direction;
  row: number;
  col: number;
  length: number;
  clue: string;
}

export interface Lane extends LaneSpec {
  /** Standard crossword number of the lane's first square. */
  number: number;
  /** Cell indices (row * cols + col) in reading order. */
  cells: number[];
  label: string;
}

export interface WeaveBoard {
  rows: number;
  cols: number;
  lanes: Lane[];
  /** Active cell indices, sorted. */
  active: number[];
  /** cell -> lane ids through it */
  lanesAt: Map<number, string[]>;
}

export const idx = (cols: number, r: number, c: number) => r * cols + c;

export function laneCells(cols: number, l: Pick<LaneSpec, "direction" | "row" | "col" | "length">): number[] {
  return Array.from({ length: l.length }, (_, i) => (l.direction === "across" ? idx(cols, l.row, l.col + i) : idx(cols, l.row + i, l.col)));
}

export function buildBoard(rows: number, cols: number, specs: LaneSpec[]): WeaveBoard {
  const lanesAt = new Map<number, string[]>();
  for (const l of specs) for (const c of laneCells(cols, l)) lanesAt.set(c, [...(lanesAt.get(c) ?? []), l.id]);
  const starts = [...new Set(specs.map((l) => idx(cols, l.row, l.col)))].sort((a, b) => a - b);
  const numberAt = new Map(starts.map((s, i) => [s, i + 1]));
  const lanes: Lane[] = specs
    .map((l) => {
      const number = numberAt.get(idx(cols, l.row, l.col))!;
      return { ...l, number, cells: laneCells(cols, l), label: `${number} ${l.direction === "across" ? "Across" : "Down"}` };
    })
    .sort((a, b) => (a.direction === b.direction ? a.number - b.number : a.direction === "across" ? -1 : 1));
  return { rows, cols, lanes, active: [...lanesAt.keys()].sort((a, b) => a - b), lanesAt };
}

/** Every maximal horizontal/vertical run of 2+ active cells, as "direction:startCell:length". */
export function maximalRuns(b: Pick<WeaveBoard, "rows" | "cols" | "active">): string[] {
  const on = new Set(b.active);
  const out: string[] = [];
  for (const dir of ["across", "down"] as const) {
    const outer = dir === "across" ? b.rows : b.cols;
    const inner = dir === "across" ? b.cols : b.rows;
    for (let o = 0; o < outer; o++) {
      let start = -1;
      for (let i = 0; i <= inner; i++) {
        const cell = i < inner ? (dir === "across" ? idx(b.cols, o, i) : idx(b.cols, i, o)) : -1;
        if (cell >= 0 && on.has(cell)) {
          if (start < 0) start = i;
        } else if (start >= 0) {
          const len = i - start;
          if (len >= 2) out.push(`${dir}:${dir === "across" ? idx(b.cols, o, start) : idx(b.cols, start, o)}:${len}`);
          start = -1;
        }
      }
    }
  }
  return out.sort();
}

/** True when the lanes form one connected network through shared cells. */
export function connected(b: WeaveBoard): boolean {
  if (!b.lanes.length) return false;
  const seen = new Set([b.lanes[0].id]);
  const stack = [b.lanes[0]];
  while (stack.length) {
    const l = stack.pop()!;
    for (const c of l.cells)
      for (const other of b.lanesAt.get(c) ?? [])
        if (!seen.has(other)) {
          seen.add(other);
          stack.push(b.lanes.find((x) => x.id === other)!);
        }
  }
  return seen.size === b.lanes.length;
}
