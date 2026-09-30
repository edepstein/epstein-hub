/**
 * Move analysis: geometry, word extraction, adjacency rules and scoring.
 *
 * A line-by-line migration of `analyzeMove` from the adapted reference engine. Rule
 * semantics are unchanged; the differences are types, stable error codes, UK English
 * messages, a per-letter score derivation for the UI, and `valid: null` (instead of an
 * implicit `true`) when no word list is supplied, so a Challenge-mode preview can show
 * geometry and projected scores without revealing dictionary validity.
 */
import {
  DIRS,
  DIR_NAMES,
  KEY_LOCATIONS,
  LETTER_MULT,
  NEIGHBOURS,
  RADIUS,
  WORD_MULT,
  cellKey,
  inBoard,
  premiumAt,
  type CellKey,
  type DirName,
  type Premium,
  type Vec,
} from "./geometry";
import { BINGO_BONUS, RACK_SIZE, tileById, tileValue, type Tile } from "./tiles";

/** A committed board occupant. `letter` is null only for Pivots. */
export interface BoardCell {
  tileId: string;
  letter: string | null;
  player: number;
  turn: number;
}
export type Board = Readonly<Record<CellKey, BoardCell>>;

export interface ResolvedPlacement {
  q: number;
  r: number;
  tile: Tile;
  /** Chosen face for Wild/Key tiles (upper-case A–Z); null otherwise. */
  assigned: string | null;
}

export interface WordList {
  has(word: string): boolean;
}

export type WordKind = "main" | "cross" | "touch";

export interface LetterScore {
  q: number;
  r: number;
  letter: string;
  value: number;
  isNew: boolean;
  premium: Premium | null;
  /** 1, 2 or 3 (only for newly covered DL/TL). */
  letterMult: number;
  points: number;
}

export interface AnalysedWord {
  kind: WordKind;
  text: string;
  cells: [number, number][];
  dirs: DirName[];
  /** Pivot cells the main word turns at. */
  pivots: [number, number][];
  letters: LetterScore[];
  /** Sum of letter points before the word multiplier. */
  base: number;
  /** Additive word multiplier (1 when none). */
  wordMult: number;
  score: number;
  /** true/false when checked against a word list; null when unchecked (Challenge preview). */
  valid: boolean | null;
  /** Whether the word's points count towards this move. */
  counted: boolean;
  /** An invalid two-letter touch that is ignored under the Adjacent Letters Rule. */
  ignored: boolean;
}

export type PlacementCode =
  | "no-placements"
  | "off-board"
  | "occupied"
  | "missing-face"
  | "key-space-required"
  | "pivot-needs-letters"
  | "single-tile-no-word"
  | "opening-too-short"
  | "not-in-line"
  | "gap"
  | "pivot-path"
  | "opening-must-cover-centre"
  | "must-connect";

export interface MoveAnalysis {
  ok: boolean;
  /** "ok", a PlacementCode, or "invalid-word". */
  code: string;
  placementError: string | null;
  wordErrors: string[];
  words: AnalysedWord[];
  mainWord: AnalysedWord | null;
  score: number;
  bingo: boolean;
  /** Whether a word list was consulted. */
  checked: boolean;
}

export const PLACEMENT_MESSAGES: Record<PlacementCode, string> = {
  "no-placements": "Place at least one tile on the board.",
  "off-board": "Tiles must be placed on the board.",
  occupied: "That space is already taken.",
  "missing-face": "Choose a letter for your Wild or Key tile.",
  "key-space-required":
    "While a Key space is free, a Key tile must be placed on one. A Key works as an ordinary Wild only once every Key space is used.",
  "pivot-needs-letters": "A Pivot tile must sit between letters of your word.",
  "single-tile-no-word": "A single tile must form a word with a tile already on the board.",
  "opening-too-short": "The first word needs at least two letters and must cover the centre start space.",
  "not-in-line":
    "All tiles in a turn must be in one straight line: down, down-right or up-right. A Pivot tile lets the word change direction.",
  gap: "Your tiles must form one continuous word with no gaps.",
  "pivot-path":
    "A Pivot tile must sit between two letters of your word, where the word turns to a different reading direction (down, down-right or up-right), and every tile must be part of that word.",
  "opening-must-cover-centre":
    "The first word must cover the centre start space, or start on a free Key space using a Key tile.",
  "must-connect":
    "Your word must join onto tiles already on the board, unless it covers the free centre start space or starts on a free Key space with a Key tile.",
};

interface CellView {
  isNew: boolean;
  pivot: boolean;
  letter: string | null;
  value: number;
}

interface Candidate {
  segs: { d: Vec; cells: [number, number][] }[];
  pivots: [number, number][];
}

interface Evaluated {
  placementCode: PlacementCode | null;
  placementError: string | null;
  wordErrors: string[];
  words: AnalysedWord[];
  score: number;
  bingo: boolean;
}

const dirName = (d: Vec): DirName => DIR_NAMES[DIRS.indexOf(d)];

function fail(code: PlacementCode, checked: boolean): MoveAnalysis {
  return {
    ok: false,
    code,
    placementError: PLACEMENT_MESSAGES[code],
    wordErrors: [],
    words: [],
    mainWord: null,
    score: 0,
    bingo: false,
    checked,
  };
}

/**
 * Analyse a proposed move against a board. `dict` null skips dictionary checks (preview in
 * Challenge mode); every word is then treated as provisionally valid for geometry and score.
 */
export function analyseMove(board: Board, placements: readonly ResolvedPlacement[], dict: WordList | null): MoveAnalysis {
  const checked = !!dict;
  if (!placements || !placements.length) return fail("no-placements", checked);

  const newMap = new Map<CellKey, ResolvedPlacement>();
  for (const p of placements) {
    if (!inBoard(p.q, p.r)) return fail("off-board", checked);
    const k = cellKey(p.q, p.r);
    if (board[k] || newMap.has(k)) return fail("occupied", checked);
    if ((p.tile.kind === "wild" || p.tile.kind === "key") && !p.assigned) return fail("missing-face", checked);
    newMap.set(k, p);
  }
  const letterOf = (p: ResolvedPlacement) => (p.tile.kind === "letter" ? p.tile.letter : p.assigned);
  const cellAt = (q: number, r: number): CellView | null => {
    const k = cellKey(q, r);
    const p = newMap.get(k);
    if (p) {
      const pivot = p.tile.kind === "pivot";
      return { isNew: true, pivot, letter: pivot ? null : letterOf(p), value: tileValue(p.tile) };
    }
    const b = board[k];
    if (b) {
      const t = tileById(b.tileId);
      const pivot = t?.kind === "pivot";
      return { isNew: false, pivot, letter: b.letter, value: t ? tileValue(t) : 0 };
    }
    return null;
  };
  const isLetter = (q: number, r: number) => {
    if (!inBoard(q, r)) return false;
    const c = cellAt(q, r);
    return !!c && !c.pivot;
  };
  const runThrough = (q: number, r: number, d: Vec): [number, number][] => {
    let sq = q;
    let sr = r;
    while (isLetter(sq - d[0], sr - d[1])) {
      sq -= d[0];
      sr -= d[1];
    }
    const cells: [number, number][] = [];
    let cq = sq;
    let cr = sr;
    while (isLetter(cq, cr)) {
      cells.push([cq, cr]);
      cq += d[0];
      cr += d[1];
    }
    return cells;
  };

  const letters = placements.filter((p) => p.tile.kind !== "pivot");
  const pivots = placements.filter((p) => p.tile.kind === "pivot");
  const keyTiles = placements.filter((p) => p.tile.kind === "key");

  // Key tile rule: while a Key space is free, every Key tile must sit on one.
  const freeKeys = KEY_LOCATIONS.filter(([q, r]) => !board[cellKey(q, r)]);
  const keysOnLoc = keyTiles.filter((p) => premiumAt(p.q, p.r) === "KEY");
  if (keyTiles.length > keysOnLoc.length && freeKeys.length > keysOnLoc.length) return fail("key-space-required", checked);
  if (!letters.length) return fail("pivot-needs-letters", checked);

  // ----- candidate main-word paths -----
  const candidates: Candidate[] = [];
  if (!pivots.length) {
    if (letters.length === 1) {
      const p = letters[0];
      DIRS.forEach((d) => {
        const run = runThrough(p.q, p.r, d);
        if (run.length >= 2) candidates.push({ segs: [{ d, cells: run }], pivots: [] });
      });
      if (!candidates.length) {
        return fail(Object.keys(board).length ? "single-tile-no-word" : "opening-too-short", checked);
      }
    } else {
      const a = letters[0];
      const b = letters[1];
      const dq = b.q - a.q;
      const dr = b.r - a.r;
      const d = DIRS.find(
        (D) => letters.every((p) => (p.q - a.q) * D[1] - (p.r - a.r) * D[0] === 0) && dq * D[1] - dr * D[0] === 0,
      );
      if (!d) return fail("not-in-line", checked);
      const run = runThrough(a.q, a.r, d);
      const rs = new Set(run.map(([q, r]) => cellKey(q, r)));
      if (!letters.every((p) => rs.has(cellKey(p.q, p.r)))) return fail("gap", checked);
      candidates.push({ segs: [{ d, cells: run }], pivots: [] });
    }
  } else {
    for (const perm of permutations(pivots)) {
      for (const ds of dirSequences(perm.length + 1)) {
        const c = buildPivotPath(perm, ds);
        if (c) candidates.push(c);
      }
    }
    if (!candidates.length) return fail("pivot-path", checked);
  }

  function buildPivotPath(perm: ResolvedPlacement[], ds: number[]): Candidate | null {
    const segs: Candidate["segs"] = [];
    const d0 = DIRS[ds[0]];
    let cells: [number, number][] = [];
    let q = perm[0].q - d0[0];
    let r = perm[0].r - d0[1];
    while (isLetter(q, r)) {
      cells.unshift([q, r]);
      q -= d0[0];
      r -= d0[1];
    }
    if (!cells.length) return null;
    segs.push({ d: d0, cells });
    for (let i = 0; i < perm.length - 1; i++) {
      const d = DIRS[ds[i + 1]];
      cells = [];
      q = perm[i].q;
      r = perm[i].r;
      let reached = false;
      for (let s = 0; s < 2 * RADIUS + 2; s++) {
        q += d[0];
        r += d[1];
        if (q === perm[i + 1].q && r === perm[i + 1].r) {
          reached = true;
          break;
        }
        if (!isLetter(q, r)) return null;
        cells.push([q, r]);
      }
      if (!reached || !cells.length) return null;
      segs.push({ d, cells });
    }
    const dl = DIRS[ds[ds.length - 1]];
    const last = perm[perm.length - 1];
    cells = [];
    q = last.q + dl[0];
    r = last.r + dl[1];
    while (isLetter(q, r)) {
      cells.push([q, r]);
      q += dl[0];
      r += dl[1];
    }
    if (!cells.length) return null;
    segs.push({ d: dl, cells });
    const seen = new Set<string>();
    for (const s of segs)
      for (const [cq, cr] of s.cells) {
        const k = cellKey(cq, cr);
        if (seen.has(k)) return null;
        seen.add(k);
      }
    if (!letters.every((p) => seen.has(cellKey(p.q, p.r)))) return null;
    return { segs, pivots: perm.map((p) => [p.q, p.r]) };
  }

  const scoreWord = (cells: [number, number][]) => {
    let sum = 0;
    let wm = 0;
    const lettersOut: LetterScore[] = [];
    for (const [q, r] of cells) {
      const c = cellAt(q, r)!;
      let v = c.value;
      let lm = 1;
      const pr = premiumAt(q, r);
      if (c.isNew && pr) {
        if (LETTER_MULT[pr]) {
          lm = LETTER_MULT[pr]!;
          v *= lm;
        }
        if (WORD_MULT[pr]) wm += WORD_MULT[pr]!; // additive: DW + TW = 5x
      }
      sum += v;
      lettersOut.push({ q, r, letter: c.letter ?? "", value: c.value, isNew: c.isNew, premium: c.isNew ? pr : null, letterMult: lm, points: v });
    }
    const wordMult = wm || 1;
    return { base: sum, score: sum * wordMult, wordMult, letters: lettersOut };
  };
  const textOf = (cells: [number, number][]) => cells.map(([q, r]) => cellAt(q, r)!.letter).join("");
  const validity = (t: string): boolean | null => (dict ? dict.has(t.toUpperCase()) : null);
  const okWord = (w: AnalysedWord) => w.valid !== false;

  const boardHasLetters = Object.values(board).some((b) => b.letter !== null);
  const coversStart = letters.some((p) => p.q === 0 && p.r === 0);
  const keyStart = keysOnLoc.length > 0;
  const bingo = placements.length === RACK_SIZE;
  const startFree = !board[cellKey(0, 0)];

  function makeWord(kind: WordKind, cells: [number, number][], dirs: DirName[], pv: [number, number][]): AnalysedWord {
    const text = textOf(cells);
    return { kind, text, cells, dirs, pivots: pv, ...scoreWord(cells), valid: validity(text), counted: false, ignored: false };
  }

  function evaluate(c: Candidate): Evaluated {
    const out: Evaluated = { placementCode: null, placementError: null, wordErrors: [], words: [], score: 0, bingo };
    const mainCells = ([] as [number, number][]).concat(...c.segs.map((s) => s.cells));
    const main = makeWord("main", mainCells, c.segs.map((s) => dirName(s.d)), c.pivots);
    out.words.push(main);
    const seen = new Set<string>();
    for (const s of c.segs) {
      for (const [q, r] of s.cells) {
        if (!cellAt(q, r)!.isNew) continue;
        for (const D of DIRS) {
          if (D === s.d) continue;
          const run = runThrough(q, r, D);
          if (run.length < 2) continue;
          const k = run.map(([a, b]) => cellKey(a, b)).join("|");
          if (seen.has(k)) continue;
          seen.add(k);
          out.words.push(makeWord(run.length >= 3 ? "cross" : "touch", run, [dirName(D)], []));
        }
      }
    }
    // Connection (geometry only).
    const hasExisting = (w: AnalysedWord) => w.cells.some(([q, r]) => !cellAt(q, r)!.isNew);
    const mainConnects = hasExisting(main);
    const sideConnects = out.words.some((w) => w.kind !== "main" && hasExisting(w));
    if (!mainConnects && !sideConnects && !(coversStart && startFree) && !keyStart) {
      out.placementCode = !boardHasLetters ? "opening-must-cover-centre" : "must-connect";
      out.placementError = PLACEMENT_MESSAGES[out.placementCode];
      return out;
    }
    // Validity and the Adjacent Letters Rule.
    const ignoredPerTile = new Map<string, string[]>();
    for (const w of out.words) {
      if (w.kind === "main") {
        w.counted = true;
        if (!okWord(w)) out.wordErrors.push(`"${w.text}" is not in the word list.`);
      } else if (w.kind === "cross") {
        w.counted = true;
        if (!okWord(w)) out.wordErrors.push(`"${w.text}" (formed alongside your word) is not in the word list.`);
      } else {
        w.counted = okWord(w);
        if (!okWord(w)) {
          w.ignored = true;
          for (const [q, r] of w.cells)
            if (cellAt(q, r)!.isNew) {
              const k = cellKey(q, r);
              ignoredPerTile.set(k, [...(ignoredPerTile.get(k) ?? []), w.text]);
            }
        }
      }
    }
    for (const [k, list] of ignoredPerTile) {
      if (list.length >= 2) {
        const [q, r] = k.split(",").map(Number);
        const t = cellAt(q, r)!.letter;
        out.wordErrors.push(
          `Your ${t} touches letters forming "${list.join('" and "')}". At least one of these must be a valid word (Adjacent Letters Rule).`,
        );
      }
    }
    // Three-Tile Adjacency Rule: counts committed neighbouring letters (Pivots are voids).
    for (const p of letters) {
      let n = 0;
      for (const [dq, dr] of NEIGHBOURS) {
        const b = board[cellKey(p.q + dq, p.r + dr)];
        if (b && b.letter !== null) n++;
      }
      if (n >= 3) {
        const ok = out.words.some((w) => w.kind !== "main" && okWord(w) && w.cells.some(([q, r]) => q === p.q && r === p.r));
        if (!ok)
          out.wordErrors.push(
            `Your ${letterOf(p)} touches three tiles, so it must also form a valid word with one of them (Three-Tile Adjacency Rule).`,
          );
      }
    }
    if (!mainConnects && !(coversStart && startFree) && !keyStart) {
      if (!out.words.some((w) => w.kind !== "main" && okWord(w) && hasExisting(w)))
        out.wordErrors.push("Your word only touches the existing tiles through invalid words, so it does not connect.");
    }
    out.score = out.words.filter((w) => w.counted).reduce((s, w) => s + w.score, 0) + (bingo ? BINGO_BONUS : 0);
    return out;
  }

  const evaluated = candidates.map(evaluate);
  const rank = (e: Evaluated) => (e.placementError ? 0 : e.wordErrors.length ? 1 : 2);
  // Array.prototype.sort is stable: ties keep direction/permutation order, as in the source.
  evaluated.sort((x, y) => rank(y) - rank(x) || y.score - x.score);
  const best = evaluated[0];
  const ok = !best.placementError && !best.wordErrors.length;
  return {
    ok,
    code: best.placementCode ?? (best.wordErrors.length ? "invalid-word" : "ok"),
    placementError: best.placementError,
    wordErrors: best.wordErrors,
    words: best.words,
    mainWord: best.words[0] ?? null,
    score: best.score,
    bingo: best.bingo,
    checked,
  };
}

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr.slice()];
  const out: T[][] = [];
  arr.forEach((x, i) => {
    permutations(arr.slice(0, i).concat(arr.slice(i + 1))).forEach((p) => out.push([x].concat(p)));
  });
  return out;
}

/** Direction index sequences of length n where consecutive directions differ. */
function dirSequences(n: number): number[][] {
  const out: number[][] = [];
  const rec = (seq: number[]) => {
    if (seq.length === n) {
      out.push(seq.slice());
      return;
    }
    for (let d = 0; d < 3; d++)
      if (!seq.length || seq[seq.length - 1] !== d) {
        seq.push(d);
        rec(seq);
        seq.pop();
      }
  };
  rec([]);
  return out;
}
