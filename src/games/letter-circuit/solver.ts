/**
 * Letter Circuit board rules and breadth-first par search (pure; shared by engine, validator
 * and the offline authoring generator).
 */

export type Sides = string[][];

export interface Board {
  sides: Sides;
  /** letter -> side index */
  sideOf: Map<string, number>;
  /** letter -> bit index (0..11) in the coverage mask */
  bitOf: Map<string, number>;
  letters: string[];
  fullMask: number;
}

export function makeBoard(sides: Sides): Board {
  const sideOf = new Map<string, number>();
  const bitOf = new Map<string, number>();
  const letters: string[] = [];
  sides.forEach((side, s) =>
    side.forEach((l) => {
      const L = l.toUpperCase();
      sideOf.set(L, s);
      bitOf.set(L, letters.length);
      letters.push(L);
    }),
  );
  return { sides: sides.map((s) => s.map((l) => l.toUpperCase())), sideOf, bitOf, letters, fullMask: (1 << letters.length) - 1 };
}

export type WordProblem =
  | { code: "letter-not-on-board"; letter: string }
  | { code: "same-side"; a: string; b: string; side: number };

/** Board legality only (letters present, consecutive letters from different sides). */
export function boardProblem(board: Board, word: string): WordProblem | null {
  for (let i = 0; i < word.length; i++) {
    const s = board.sideOf.get(word[i]);
    if (s === undefined) return { code: "letter-not-on-board", letter: word[i] };
    if (i > 0 && board.sideOf.get(word[i - 1]) === s) return { code: "same-side", a: word[i - 1], b: word[i], side: s };
  }
  return null;
}

export function maskOf(board: Board, word: string): number {
  let m = 0;
  for (const ch of word) m |= 1 << board.bitOf.get(ch)!;
  return m;
}

export const popcount = (m: number) => {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
};

export interface WordEntry {
  word: string;
  first: string;
  last: string;
  mask: number;
}

/** Every word from `words` that is legal on the board with at least `minLength` letters. */
export function playableWords(board: Board, words: Iterable<string>, minLength = 3): WordEntry[] {
  const out: WordEntry[] = [];
  for (const w of words) {
    if (w.length < minLength || boardProblem(board, w)) continue;
    out.push({ word: w, first: w[0], last: w[w.length - 1], mask: maskOf(board, w) });
  }
  return out.sort((a, b) => a.word.localeCompare(b.word));
}

export interface ParSearch {
  /** Minimum number of further words to cover every letter, or null if impossible. */
  words: number | null;
  /** One shortest continuation (fewest words, then fewest letters among those found first). */
  chain: string[];
  /** How many distinct (endpoint, mask) states were explored. */
  explored: number;
}

/**
 * Breadth-first search over (last letter, coverage mask). From `start` (null = empty chain,
 * any first word allowed) finds the fewest further words that complete coverage. BFS by word
 * count is exact: every word costs one, and a state is only expanded once, at its minimum depth.
 */
export function searchPar(board: Board, entries: readonly WordEntry[], start: { last: string | null; mask: number } = { last: null, mask: 0 }): ParSearch {
  if (start.mask === board.fullMask) return { words: 0, chain: [], explored: 0 };
  const byFirst = new Map<string, WordEntry[]>();
  for (const e of entries) {
    const list = byFirst.get(e.first) ?? [];
    list.push(e);
    byFirst.set(e.first, list);
  }
  // Within each start letter, try longer-coverage words first so the reconstructed chain is natural.
  for (const list of byFirst.values()) list.sort((a, b) => popcount(b.mask) - popcount(a.mask) || a.word.length - b.word.length || a.word.localeCompare(b.word));
  const key = (last: string, mask: number) => `${last}:${mask}`;
  const prev = new Map<string, { from: string | null; word: string }>();
  let frontier: { last: string; mask: number }[] = [];
  const firstWords = start.last == null ? entries : (byFirst.get(start.last) ?? []);
  for (const e of firstWords) {
    const m = start.mask | e.mask;
    const k = key(e.last, m);
    if (prev.has(k)) continue;
    prev.set(k, { from: null, word: e.word });
    frontier.push({ last: e.last, mask: m });
  }
  let depth = 1;
  const rebuild = (k: string) => {
    const chain: string[] = [];
    let cur: string | null = k;
    while (cur) {
      const p: { from: string | null; word: string } = prev.get(cur)!;
      chain.unshift(p.word);
      cur = p.from;
    }
    return chain;
  };
  while (frontier.length) {
    // Check completion at this depth (deterministic: first in insertion order).
    for (const st of frontier) if (st.mask === board.fullMask) return { words: depth, chain: rebuild(key(st.last, st.mask)), explored: prev.size };
    const next: { last: string; mask: number }[] = [];
    for (const st of frontier) {
      const from = key(st.last, st.mask);
      for (const e of byFirst.get(st.last) ?? []) {
        const m = st.mask | e.mask;
        const k = key(e.last, m);
        if (prev.has(k)) continue;
        prev.set(k, { from, word: e.word });
        next.push({ last: e.last, mask: m });
      }
    }
    frontier = next;
    depth += 1;
    if (depth > 30) break;
  }
  return { words: null, chain: [], explored: prev.size };
}

/** Count distinct complete chains of exactly `n` words (authoring metric; capped). */
export function countChains(board: Board, entries: readonly WordEntry[], n: number, cap = 5000): number {
  const byFirst = new Map<string, WordEntry[]>();
  for (const e of entries) byFirst.set(e.first, [...(byFirst.get(e.first) ?? []), e]);
  let count = 0;
  const go = (last: string | null, mask: number, k: number) => {
    if (count >= cap) return;
    if (k === n) {
      if (mask === board.fullMask) count++;
      return;
    }
    for (const e of last == null ? entries : (byFirst.get(last) ?? [])) go(e.last, mask | e.mask, k + 1);
  };
  go(null, 0, 0);
  return count;
}
