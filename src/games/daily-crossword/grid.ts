/**
 * Pure crossword geometry: entry derivation from the grid, conventional numbering and
 * navigation helpers. No React, no DOM.
 */

export type Direction = "across" | "down";

export interface Cell {
  row: number;
  col: number;
}

export interface Run {
  direction: Direction;
  row: number;
  col: number;
  length: number;
}

export const key = (r: number, c: number) => `${r},${c}`;

export const isWhite = (grid: readonly string[], r: number, c: number) =>
  r >= 0 && r < grid.length && c >= 0 && c < grid[0].length && grid[r][c] !== "#";

/** Every maximal run of two or more white cells. One-letter runs are never entries. */
export function deriveRuns(grid: readonly string[]): Run[] {
  const out: Run[] = [];
  const R = grid.length;
  const C = grid[0]?.length ?? 0;
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      if (!isWhite(grid, r, c)) continue;
      if (!isWhite(grid, r, c - 1) && isWhite(grid, r, c + 1)) {
        let n = 0;
        while (isWhite(grid, r, c + n)) n++;
        out.push({ direction: "across", row: r, col: c, length: n });
      }
      if (!isWhite(grid, r - 1, c) && isWhite(grid, r + 1, c)) {
        let n = 0;
        while (isWhite(grid, r + n, c)) n++;
        out.push({ direction: "down", row: r, col: c, length: n });
      }
    }
  }
  return out;
}

/** Conventional numbering: row-major, one number per cell that starts any entry. */
export function numberGrid(grid: readonly string[]): Map<string, number> {
  const nums = new Map<string, number>();
  let n = 0;
  for (const run of deriveRuns(grid)) {
    const k = key(run.row, run.col);
    if (!nums.has(k)) nums.set(k, ++n);
  }
  return nums;
}

export function runCells(run: Pick<Run, "direction" | "row" | "col" | "length">): Cell[] {
  return Array.from({ length: run.length }, (_, i) =>
    run.direction === "across" ? { row: run.row, col: run.col + i } : { row: run.row + i, col: run.col },
  );
}

/** White cells are connected orthogonally into a single region. */
export function isConnected(grid: readonly string[]): boolean {
  const whites: Cell[] = [];
  grid.forEach((row, r) => [...row].forEach((ch, c) => ch !== "#" && whites.push({ row: r, col: c })));
  if (!whites.length) return false;
  const seen = new Set<string>([key(whites[0].row, whites[0].col)]);
  const stack = [whites[0]];
  while (stack.length) {
    const { row, col } = stack.pop()!;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const r = row + dr;
      const c = col + dc;
      if (isWhite(grid, r, c) && !seen.has(key(r, c))) {
        seen.add(key(r, c));
        stack.push({ row: r, col: c });
      }
    }
  }
  return seen.size === whites.length;
}

/** 180-degree rotational symmetry of the block pattern. */
export function isSymmetric(grid: readonly string[]): boolean {
  const R = grid.length;
  const C = grid[0].length;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if ((grid[r][c] === "#") !== (grid[R - 1 - r][C - 1 - c] === "#")) return false;
  return true;
}

/** Next white cell from (r,c) stepping by (dr,dc), skipping blocks; null at the edge. */
export function stepSpatial(grid: readonly string[], r: number, c: number, dr: number, dc: number): Cell | null {
  let y = r + dr;
  let x = c + dc;
  while (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
    if (grid[y][x] !== "#") return { row: y, col: x };
    y += dr;
    x += dc;
  }
  return null;
}
