/**
 * Tile catalogue, copied exactly from the preserved engine's LETTERS and SPECIAL_COUNTS.
 * 108 uniquely identified tiles: 98 letters, 4 Wilds, 2 Keys, 4 Pivots. IDs t0..t107 follow
 * the source generation order so snapshots and fixtures stay comparable.
 */

export type TileKind = "letter" | "wild" | "key" | "pivot";

export interface Tile {
  readonly id: string;
  readonly kind: TileKind;
  /** Printed letter for letter tiles; null for specials. */
  readonly letter: string | null;
  readonly value: number;
}

/** letter: [count, value] */
export const LETTERS: Readonly<Record<string, readonly [number, number]>> = {
  A: [9, 1], B: [2, 3], C: [2, 3], D: [4, 2], E: [12, 1], F: [2, 4], G: [3, 2], H: [2, 4],
  I: [9, 1], J: [1, 8], K: [1, 5], L: [4, 1], M: [2, 3], N: [6, 1], O: [8, 1], P: [2, 3],
  Q: [1, 10], R: [6, 1], S: [4, 1], T: [6, 1], U: [4, 1], V: [2, 4], W: [2, 4], X: [1, 8],
  Y: [2, 4], Z: [1, 10],
};
export const SPECIAL_COUNTS: Readonly<Record<"wild" | "key" | "pivot", number>> = { wild: 4, key: 2, pivot: 4 };
export const RACK_SIZE = 7;
export const BINGO_BONUS = 50;

function makeTiles(): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;
  for (const [ch, [n, v]] of Object.entries(LETTERS))
    for (let i = 0; i < n; i++) tiles.push(Object.freeze({ id: `t${id++}`, kind: "letter", letter: ch, value: v }));
  for (const [kind, n] of Object.entries(SPECIAL_COUNTS) as ["wild" | "key" | "pivot", number][])
    for (let i = 0; i < n; i++) tiles.push(Object.freeze({ id: `t${id++}`, kind, letter: null, value: 0 }));
  return tiles;
}

export const TILES: readonly Tile[] = Object.freeze(makeTiles());
export const TILE_COUNT = TILES.length;
const BY_ID = new Map(TILES.map((t) => [t.id, t]));

export function tileById(id: string): Tile | undefined {
  return BY_ID.get(id);
}

/** Letter tiles score their value; Wild, Key and Pivot tiles score zero. */
export const tileValue = (t: Tile): number => (t.kind === "letter" ? t.value : 0);

/** Wild and Key tiles need a chosen face letter when placed. */
export const needsFace = (t: Tile) => t.kind === "wild" || t.kind === "key";

export function tileLabel(t: Tile): string {
  if (t.kind === "letter") return `${t.letter}, ${t.value} point${t.value === 1 ? "" : "s"}`;
  if (t.kind === "wild") return "Wild tile, any letter, 0 points";
  if (t.kind === "key") return "Key tile, any letter, 0 points";
  return "Pivot tile, turns a word, 0 points";
}
