/**
 * Hidden Word Trail geometry and exact-cover solver (pure; shared by the engine, the content
 * validator and the offline authoring generator).
 *
 * Cells are addressed by index = row * cols + col. A path moves to any of the eight
 * neighbouring cells (orthogonal or diagonal) and never repeats a cell.
 */

export type Cell = [number, number];

export interface Geometry {
  rows: number;
  cols: number;
  /** Flat upper-case letters, length rows * cols. */
  letters: string[];
}

export function geometryFromGrid(grid: string[]): Geometry {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  return { rows, cols, letters: grid.join("").toUpperCase().split("") };
}

export const toIndex = (g: Pick<Geometry, "cols">, [r, c]: Cell) => r * g.cols + c;
export const toCell = (g: Pick<Geometry, "cols">, i: number): Cell => [Math.floor(i / g.cols), i % g.cols];

export function inBounds(g: Pick<Geometry, "rows" | "cols">, i: number): boolean {
  return Number.isInteger(i) && i >= 0 && i < g.rows * g.cols;
}

export function adjacent(g: Pick<Geometry, "cols">, a: number, b: number): boolean {
  if (a === b) return false;
  const [ra, ca] = toCell(g, a);
  const [rb, cb] = toCell(g, b);
  return Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1;
}

export function neighbours(g: Pick<Geometry, "rows" | "cols">, i: number): number[] {
  const [r, c] = toCell(g, i);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < g.rows && cc >= 0 && cc < g.cols) out.push(rr * g.cols + cc);
    }
  return out;
}

export type PathProblem =
  | { code: "empty"; at: -1 }
  | { code: "out-of-bounds"; at: number }
  | { code: "repeated-cell"; at: number }
  | { code: "not-adjacent"; at: number }
  | { code: "uses-solved"; at: number };

/** Checks path geometry. `blocked` holds indices already covered by found answers. */
export function checkPath(g: Geometry, path: readonly number[], blocked?: ReadonlySet<number>): PathProblem | null {
  if (!path.length) return { code: "empty", at: -1 };
  const seen = new Set<number>();
  for (let k = 0; k < path.length; k++) {
    const i = path[k];
    if (!inBounds(g, i)) return { code: "out-of-bounds", at: k };
    if (seen.has(i)) return { code: "repeated-cell", at: k };
    if (k > 0 && !adjacent(g, path[k - 1], i)) return { code: "not-adjacent", at: k };
    if (blocked?.has(i)) return { code: "uses-solved", at: k };
    seen.add(i);
  }
  return null;
}

export const spell = (g: Geometry, path: readonly number[]) => path.map((i) => g.letters[i]).join("");

/** Every path spelling `word` that avoids `blocked` cells. Capped for safety. */
export function enumeratePaths(g: Geometry, word: string, blocked: ReadonlySet<number> = new Set(), cap = 5000): number[][] {
  const out: number[][] = [];
  const W = word.toUpperCase();
  const path: number[] = [];
  const used = new Set<number>();
  const walk = (i: number, k: number) => {
    if (out.length >= cap) return;
    path.push(i);
    used.add(i);
    if (k === W.length - 1) out.push(path.slice());
    else for (const n of neighbours(g, i)) if (!used.has(n) && !blocked.has(n) && g.letters[n] === W[k + 1]) walk(n, k + 1);
    path.pop();
    used.delete(i);
  };
  for (let i = 0; i < g.letters.length; i++) if (!blocked.has(i) && g.letters[i] === W[0]) walk(i, 0);
  return out;
}

export interface CoverResult {
  /** Number of complete partitions found (stops at `limit`). */
  count: number;
  /** One complete assignment word -> path, if any. */
  first: Map<string, number[]> | null;
}

/**
 * Exact cover: can `words` be placed on non-overlapping paths that together cover every
 * cell not in `blocked` exactly once? Words may repeat in the list only if the round lists
 * them twice (not used by authored rounds).
 */
export function exactCover(g: Geometry, words: readonly string[], blocked: ReadonlySet<number> = new Set(), limit = 1): CoverResult {
  const free = g.letters.length - blocked.size;
  const need = words.reduce((s, w) => s + w.length, 0);
  if (need !== free) return { count: 0, first: null };
  const options = words.map((w) => enumeratePaths(g, w, blocked));
  if (options.some((o) => !o.length)) return { count: 0, first: null };
  const taken = new Set(blocked);
  const placed = new Map<string, number[]>();
  const remaining = new Set(words.map((_, i) => i));
  let count = 0;
  let first: Map<string, number[]> | null = null;

  const search = () => {
    if (count >= limit) return;
    if (!remaining.size) {
      count += 1;
      if (!first) first = new Map(placed);
      return;
    }
    // Choose the word with the fewest currently-legal paths (MRV).
    let best = -1;
    let bestOpts: number[][] = [];
    for (const wi of remaining) {
      const legal = options[wi].filter((p) => p.every((i) => !taken.has(i)));
      if (!legal.length) return;
      if (best < 0 || legal.length < bestOpts.length) {
        best = wi;
        bestOpts = legal;
      }
    }
    // Prune: the lowest-index uncovered cell must be coverable by some remaining word.
    let low = -1;
    for (let i = 0; i < g.letters.length; i++)
      if (!taken.has(i)) {
        low = i;
        break;
      }
    if (low >= 0) {
      let coverable = false;
      for (const wi of remaining) if (options[wi].some((p) => p.includes(low) && p.every((i) => !taken.has(i)))) coverable = true;
      if (!coverable) return;
    }
    remaining.delete(best);
    for (const p of bestOpts) {
      for (const i of p) taken.add(i);
      placed.set(words[best], p);
      search();
      placed.delete(words[best]);
      for (const i of p) taken.delete(i);
      if (count >= limit) break;
    }
    remaining.add(best);
  };
  search();
  return { count, first };
}

/** Number of direction changes along a path (authoring metric). */
export function turns(g: Geometry, path: readonly number[]): number {
  let t = 0;
  for (let k = 2; k < path.length; k++) {
    const [r0, c0] = toCell(g, path[k - 2]);
    const [r1, c1] = toCell(g, path[k - 1]);
    const [r2, c2] = toCell(g, path[k]);
    if (r1 - r0 !== r2 - r1 || c1 - c0 !== c2 - c1) t += 1;
  }
  return t;
}
