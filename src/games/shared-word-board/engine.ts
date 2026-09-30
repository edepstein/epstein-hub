/**
 * Shared Word Board pure engine.
 *
 * No React, DOM, Date.now or Math.random. All randomness comes from a serialisable
 * mulberry32 state stored in the match, so every accepted action replays exactly.
 *
 * Every state-changing request goes through `commit`, which is atomic (a rejected request
 * returns the identical state object), idempotent (a repeated action ID returns the original
 * result without changing anything) and version-checked (a request made against an older
 * board version is refused with the "stale-version" conflict code).
 */
import { getRuleSet, premiumAt, rulesHash, type PremiumKind, type RuleSet, type RulesVersion } from "./rules";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export interface Tile {
  id: string;
  /** Upper-case A-Z letter, or null for a blank. */
  letter: string | null;
}

export interface BoardCell {
  tileId: string;
  /** Letter shown on the board (the chosen face for a blank). */
  face: string;
  blank: boolean;
  /** Version at which this tile was committed. */
  placedAt: number;
}

export interface Placement {
  tileId: string;
  row: number;
  column: number;
  /** Required for a blank (the chosen A-Z face); must be omitted or match for a letter tile. */
  face?: string;
}

export interface Player {
  name: string;
}

export type Seat = number;

export interface WordLetter {
  letter: string;
  row: number;
  column: number;
  isNew: boolean;
  blank: boolean;
  base: number;
  letterMultiplier: number;
  /** Premium used by this letter in this word, if newly covered. */
  premium: PremiumKind | null;
  points: number;
}

export interface WordScore {
  word: string;
  direction: "across" | "down";
  letters: WordLetter[];
  letterSum: number;
  wordMultiplier: number;
  score: number;
  /** Human breakdown, e.g. "C 1 + A 1 + T 1 = 3". */
  explanation: string;
}

export type HistoryEntry =
  | { kind: "place"; actionId: string; seat: Seat; version: number; words: WordScore[]; score: number; tiles: { row: number; column: number; face: string; blank: boolean }[]; drawn: number }
  | { kind: "pass"; actionId: string; seat: Seat; version: number }
  | { kind: "exchange"; actionId: string; seat: Seat; version: number; count: number }
  | { kind: "resign"; actionId: string; seat: Seat; version: number }
  | { kind: "hint"; actionId: string; seat: Seat; version: number };

export type EndReason = "went-out" | "passes" | "resigned";

export interface FinalAdjustment {
  seat: Seat;
  /** Value of tiles left on the rack (subtracted). */
  rackPenalty: number;
  /** Tile value received from others (going-out bonus). */
  bonus: number;
  net: number;
  leftover: { letter: string; blank: boolean }[];
}

export interface EndInfo {
  reason: EndReason;
  /** Seat that went out, for "went-out". */
  wentOut?: Seat;
  adjustments: FinalAdjustment[];
  /** Winning seats (several on a tie). */
  winners: Seat[];
  finalScores: number[];
}

export interface MatchState {
  gameId: "shared-word-board";
  rulesVersion: RulesVersion;
  rulesHash: string;
  dictionaryVersion: string;
  players: Player[];
  /** Every physical tile in the match, by id. Never changes. */
  tiles: Record<string, Tile>;
  board: (BoardCell | null)[];
  racks: string[][];
  /** Bag in draw order (front first). Private: never projected to a client. */
  bag: string[];
  /** Serialisable RNG state for exchanges' reshuffles. Private. */
  rng: number;
  scores: number[];
  current: Seat;
  version: number;
  consecutiveInactive: number;
  resigned: boolean[];
  hintsTaken: number[];
  status: "active" | "finished";
  history: HistoryEntry[];
  end: EndInfo | null;
}

export type MoveAction =
  | { type: "place"; seat: Seat; placements: Placement[] }
  | { type: "pass"; seat: Seat }
  | { type: "exchange"; seat: Seat; tileIds: string[] }
  | { type: "resign"; seat: Seat }
  | { type: "hint"; seat: Seat };

export interface CommitRequest {
  actionId: string;
  expectedVersion: number;
  action: MoveAction;
}

export type CommitStatus = "accepted" | "duplicate" | "conflict" | "rejected";

export interface CommitResult {
  status: CommitStatus;
  state: MatchState;
  code: string;
  message: string;
  /** Score breakdown for an accepted (or duplicate) placement. */
  words?: WordScore[];
  score?: number;
}

export interface Analysis {
  legal: boolean;
  code: string;
  message: string;
  words: WordScore[];
  score: number;
  /** Words that failed membership, for a precise reason. */
  invalidWords?: string[];
}

export interface Membership {
  has(word: string): boolean;
}

export interface MatchSetup {
  rulesVersion: RulesVersion;
  dictionaryVersion: string;
  players: Player[];
  seed: number;
  /** Seat that moves first (default 0). */
  firstSeat?: Seat;
  /**
   * Optional explicit deal (used to replay the pack fixture): letters for each seat's opening
   * rack and the bag in draw order. Every tile of the rule set must be accounted for.
   */
  deal?: { racks: string[][]; bag: string[] };
}

/* ------------------------------------------------------------------ */
/* Serialisable RNG (mulberry32)                                        */
/* ------------------------------------------------------------------ */

export function rngNext(state: number): [number, number] {
  const a = (state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

/** Fisher-Yates shuffle driven by the serialisable RNG. Returns [shuffled, newRngState]. */
export function shuffleWith<T>(items: readonly T[], rng: number): [T[], number] {
  const out = items.slice();
  let s = rng >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    const [r, next] = rngNext(s);
    s = next;
    const j = Math.floor(r * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return [out, s];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

export const GAME_ID = "shared-word-board" as const;

export function rulesOf(state: MatchState): RuleSet {
  return getRuleSet(state.rulesVersion);
}

export const cellIndex = (size: number, row: number, column: number) => row * size + column;

export function tileValue(rules: RuleSet, tile: Tile): number {
  return tile.letter === null ? rules.blankScore : (rules.tileScores[tile.letter] ?? 0);
}

export function rackValue(state: MatchState, seat: Seat): number {
  const rules = rulesOf(state);
  return state.racks[seat].reduce((a, id) => a + tileValue(rules, state.tiles[id]), 0);
}

/** Canonical tile universe: letters in A-Z order then blanks; ids t1..tN. */
export function buildTileSet(rules: RuleSet): Tile[] {
  const out: Tile[] = [];
  let n = 1;
  for (const letter of Object.keys(rules.tileDistribution).sort()) {
    for (let i = 0; i < rules.tileDistribution[letter]; i++) out.push({ id: `t${n++}`, letter });
  }
  for (let i = 0; i < rules.blankCount; i++) out.push({ id: `t${n++}`, letter: null });
  return out;
}

export function activeSeats(state: MatchState): Seat[] {
  return state.players.map((_, i) => i).filter((i) => !state.resigned[i]);
}

function nextSeat(state: MatchState, from: Seat): Seat {
  const n = state.players.length;
  for (let k = 1; k <= n; k++) {
    const s = (from + k) % n;
    if (!state.resigned[s]) return s;
  }
  return from;
}

function isBoardEmpty(state: MatchState): boolean {
  return state.board.every((c) => c === null);
}

const LETTER_RE = /^[A-Z]$/;

/* ------------------------------------------------------------------ */
/* Creating a match                                                     */
/* ------------------------------------------------------------------ */

export type CreateResult = { ok: true; state: MatchState } | { ok: false; code: string; message: string };

export function createMatch(setup: MatchSetup): CreateResult {
  const rules = getRuleSet(setup.rulesVersion);
  if (!rules) return { ok: false, code: "unknown-rules", message: "That rules version is not recognised." };
  const n = setup.players.length;
  if (n < rules.minPlayers || n > rules.maxPlayers)
    return { ok: false, code: "player-count", message: `A match needs ${rules.minPlayers} to ${rules.maxPlayers} players.` };
  const names = setup.players.map((p) => p.name.trim());
  if (names.some((nm) => nm.length === 0 || nm.length > 24))
    return { ok: false, code: "player-name", message: "Each player needs a name of 1 to 24 characters." };
  if (new Set(names.map((nm) => nm.toLowerCase())).size !== names.length)
    return { ok: false, code: "player-name-duplicate", message: "Give each player a different name so turns are clear." };
  const firstSeat = setup.firstSeat ?? 0;
  if (!Number.isInteger(firstSeat) || firstSeat < 0 || firstSeat >= n)
    return { ok: false, code: "first-seat", message: "The first player must be one of the players." };

  const tileList = buildTileSet(rules);
  const tiles: Record<string, Tile> = {};
  for (const t of tileList) tiles[t.id] = t;
  let rng = setup.seed >>> 0;
  let racks: string[][];
  let bag: string[];

  if (setup.deal) {
    // Map each letter to the next unused canonical tile of that letter.
    const pool = new Map<string, string[]>();
    for (const t of tileList) {
      const k = t.letter ?? "?";
      if (!pool.has(k)) pool.set(k, []);
      pool.get(k)!.push(t.id);
    }
    const take = (letter: string): string | null => pool.get(letter)?.shift() ?? null;
    if (setup.deal.racks.length !== n) return { ok: false, code: "deal-invalid", message: "The deal must supply one rack per player." };
    racks = [];
    for (const r of setup.deal.racks) {
      if (r.length > rules.rackSize) return { ok: false, code: "deal-invalid", message: "A dealt rack is larger than the rack size." };
      const ids: string[] = [];
      for (const l of r) {
        const id = take(l);
        if (!id) return { ok: false, code: "deal-invalid", message: `The deal uses more ${l} tiles than the rule set contains.` };
        ids.push(id);
      }
      racks.push(ids);
    }
    bag = [];
    for (const l of setup.deal.bag) {
      const id = take(l);
      if (!id) return { ok: false, code: "deal-invalid", message: `The deal uses more ${l} tiles than the rule set contains.` };
      bag.push(id);
    }
    const leftover = [...pool.values()].reduce((a, v) => a + v.length, 0);
    if (leftover !== 0) return { ok: false, code: "deal-invalid", message: "The deal does not account for every tile in the rule set." };
  } else {
    const [shuffled, next] = shuffleWith(
      tileList.map((t) => t.id),
      rng,
    );
    rng = next;
    bag = shuffled;
    racks = Array.from({ length: n }, () => [] as string[]);
    // Deal in turn order starting from the first seat, one full rack at a time.
    for (let k = 0; k < n; k++) {
      const seat = (firstSeat + k) % n;
      racks[seat] = bag.slice(0, rules.rackSize);
      bag = bag.slice(rules.rackSize);
    }
  }

  const state: MatchState = {
    gameId: GAME_ID,
    rulesVersion: rules.version,
    rulesHash: rulesHash(rules),
    dictionaryVersion: setup.dictionaryVersion,
    players: names.map((name) => ({ name })),
    tiles,
    board: Array.from({ length: rules.boardSize * rules.boardSize }, () => null),
    racks,
    bag,
    rng,
    scores: Array.from({ length: n }, () => 0),
    current: firstSeat,
    version: 0,
    consecutiveInactive: 0,
    resigned: Array.from({ length: n }, () => false),
    hintsTaken: Array.from({ length: n }, () => 0),
    status: "active",
    history: [],
    end: null,
  };
  return { ok: true, state };
}

/* ------------------------------------------------------------------ */
/* Placement analysis                                                   */
/* ------------------------------------------------------------------ */

function fail(code: string, message: string, extra: Partial<Analysis> = {}): Analysis {
  return { legal: false, code, message, words: [], score: 0, ...extra };
}

const coord = (r: number, c: number) => `row ${r + 1}, column ${c + 1}`;

/**
 * Non-mutating analysis of a proposed placement for `seat`. Checks rack ownership,
 * geometry, connection, every formed word and derives the exact score with a breakdown.
 */
export function analysePlacement(state: MatchState, seat: Seat, placements: Placement[], words: Membership): Analysis {
  const rules = rulesOf(state);
  const size = rules.boardSize;
  if (state.status !== "active") return fail("match-finished", "The match has finished.");
  if (seat !== state.current) return fail("not-your-turn", `It is ${state.players[state.current].name}'s turn.`);
  if (!Array.isArray(placements) || placements.length === 0) return fail("no-tiles", "Place at least one tile from your rack first.");
  if (placements.length > rules.rackSize) return fail("too-many-tiles", `You can place at most ${rules.rackSize} tiles in a turn.`);

  const rack = new Set(state.racks[seat]);
  const seenTiles = new Set<string>();
  const seenCells = new Set<number>();
  const faces = new Map<number, { face: string; blank: boolean; tileId: string }>();
  for (const p of placements) {
    if (!p || typeof p.tileId !== "string") return fail("tile-not-in-rack", "That tile is not on your rack.");
    if (seenTiles.has(p.tileId)) return fail("duplicate-tile", "The same tile was placed twice. Each physical tile can go on one square only.");
    seenTiles.add(p.tileId);
    if (!rack.has(p.tileId)) return fail("tile-not-in-rack", "That tile is not on your rack.");
    const tile = state.tiles[p.tileId];
    let face: string;
    if (tile.letter === null) {
      if (p.face === undefined || p.face === null || p.face === "") return fail("blank-face-missing", "Choose a letter for the blank tile before submitting.");
      if (typeof p.face !== "string" || !LETTER_RE.test(p.face)) return fail("blank-face-invalid", "A blank must stand for exactly one letter from A to Z.");
      face = p.face;
    } else {
      if (p.face !== undefined && p.face !== tile.letter) return fail("face-mismatch", `That tile is ${tile.letter}; only a blank can stand for another letter.`);
      face = tile.letter;
    }
    if (!Number.isInteger(p.row) || !Number.isInteger(p.column) || p.row < 0 || p.column < 0 || p.row >= size || p.column >= size)
      return fail("off-board", "Every tile must be placed on the board.");
    const idx = cellIndex(size, p.row, p.column);
    if (seenCells.has(idx)) return fail("same-square", `Two tiles were placed on ${coord(p.row, p.column)}.`);
    seenCells.add(idx);
    if (state.board[idx]) return fail("square-occupied", `${coord(p.row, p.column)} already has a tile. Committed tiles cannot be moved or covered.`);
    faces.set(idx, { face, blank: tile.letter === null, tileId: p.tileId });
  }

  const rows = new Set(placements.map((p) => p.row));
  const cols = new Set(placements.map((p) => p.column));
  let direction: "across" | "down" | "single";
  if (placements.length === 1) direction = "single";
  else if (rows.size === 1) direction = "across";
  else if (cols.size === 1) direction = "down";
  else return fail("not-in-line", "New tiles must all be in one row or one column.");

  const at = (r: number, c: number) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return null;
    const idx = cellIndex(size, r, c);
    const n = faces.get(idx);
    if (n) return { face: n.face, blank: n.blank, isNew: true, tileId: n.tileId };
    const b = state.board[idx];
    return b ? { face: b.face, blank: b.blank, isNew: false, tileId: b.tileId } : null;
  };

  // Gaps between new tiles must already be filled.
  if (direction !== "single") {
    const fixed = direction === "across" ? placements[0].row : placements[0].column;
    const along = placements.map((p) => (direction === "across" ? p.column : p.row));
    const lo = Math.min(...along);
    const hi = Math.max(...along);
    for (let k = lo; k <= hi; k++) {
      const cell = direction === "across" ? at(fixed, k) : at(k, fixed);
      if (!cell) {
        const [r, c] = direction === "across" ? [fixed, k] : [k, fixed];
        return fail("gap", `There is a gap at ${coord(r, c)}. New tiles must form one unbroken line with any tiles already between them.`);
      }
    }
  }

  if (isBoardEmpty(state)) {
    const [ar, ac] = rules.anchor;
    if (!placements.some((p) => p.row === ar && p.column === ac))
      return fail("first-move-anchor", `The first move must cover the centre star at ${coord(ar, ac)}.`);
  } else {
    const touches = placements.some((p) =>
      [
        [p.row - 1, p.column],
        [p.row + 1, p.column],
        [p.row, p.column - 1],
        [p.row, p.column + 1],
      ].some(([r, c]) => r >= 0 && c >= 0 && r < size && c < size && state.board[cellIndex(size, r, c)] !== null),
    );
    if (!touches) return fail("not-connected", "New tiles must join the tiles already on the board, sharing an edge (diagonal contact does not count).");
  }

  // Collect every formed word.
  const runFrom = (r: number, c: number, dr: number, dc: number) => {
    let sr = r;
    let sc = c;
    while (at(sr - dr, sc - dc)) {
      sr -= dr;
      sc -= dc;
    }
    const cells: { r: number; c: number; face: string; blank: boolean; isNew: boolean }[] = [];
    let cr = sr;
    let cc = sc;
    let cell = at(cr, cc);
    while (cell) {
      cells.push({ r: cr, c: cc, face: cell.face, blank: cell.blank, isNew: cell.isNew });
      cr += dr;
      cc += dc;
      cell = at(cr, cc);
    }
    return cells;
  };

  const runs: { dir: "across" | "down"; cells: ReturnType<typeof runFrom> }[] = [];
  const p0 = placements[0];
  if (direction === "single") {
    runs.push({ dir: "across", cells: runFrom(p0.row, p0.column, 0, 1) });
    runs.push({ dir: "down", cells: runFrom(p0.row, p0.column, 1, 0) });
  } else {
    const main = direction as "across" | "down";
    runs.push({ dir: main, cells: main === "across" ? runFrom(p0.row, p0.column, 0, 1) : runFrom(p0.row, p0.column, 1, 0) });
    for (const p of placements) {
      const cross = main === "across" ? "down" : "across";
      runs.push({ dir: cross, cells: cross === "down" ? runFrom(p.row, p.column, 1, 0) : runFrom(p.row, p.column, 0, 1) });
    }
  }
  const formed = runs.filter((r) => r.cells.length >= rules.minimumWordLength);
  if (formed.length === 0)
    return fail("no-word", `A move must make a word of at least ${rules.minimumWordLength} letters.`);

  const scored: WordScore[] = formed.map(({ dir, cells }) => {
    let letterSum = 0;
    let wordMultiplier = 1;
    const letters: WordLetter[] = cells.map((cell) => {
      const base = cell.blank ? rules.blankScore : (rules.tileScores[cell.face] ?? 0);
      const premium = cell.isNew ? premiumAt(rules, cell.r, cell.c) : null;
      let letterMultiplier = 1;
      if (premium === "double-letter") letterMultiplier = 2;
      if (premium === "triple-letter") letterMultiplier = 3;
      if (premium === "double-word") wordMultiplier *= 2;
      if (premium === "triple-word") wordMultiplier *= 3;
      const points = base * letterMultiplier;
      letterSum += points;
      return { letter: cell.face, row: cell.r, column: cell.c, isNew: cell.isNew, blank: cell.blank, base, letterMultiplier, premium, points };
    });
    const word = letters.map((l) => l.letter).join("");
    const score = letterSum * wordMultiplier;
    const parts = letters.map((l) => `${l.letter}${l.blank ? " (blank)" : ""} ${l.base}${l.letterMultiplier > 1 ? `×${l.letterMultiplier}` : ""}`);
    const explanation = `${parts.join(" + ")} = ${letterSum}${wordMultiplier > 1 ? `, ×${wordMultiplier} word = ${score}` : ""}`;
    return { word, direction: dir, letters, letterSum, wordMultiplier, score, explanation };
  });

  const invalid = scored.map((w) => w.word).filter((w) => !words.has(w));
  if (invalid.length) {
    const list = [...new Set(invalid)];
    return fail(
      "not-a-word",
      `${list.join(", ")} ${list.length === 1 ? "is" : "are"} not in the agreed word list. Every word the move forms must be accepted.`,
      { words: scored, invalidWords: list },
    );
  }
  const total = scored.reduce((a, w) => a + w.score, 0) + (placements.length === rules.rackSize ? rules.sevenTileBonus : 0);
  const summary = scored.map((w) => `${w.word} ${w.score}`).join(", ");
  return { legal: true, code: "ok", message: `Scores ${total}: ${summary}.`, words: scored, score: total };
}

/* ------------------------------------------------------------------ */
/* Ending                                                               */
/* ------------------------------------------------------------------ */

function finish(state: MatchState, reason: EndReason, wentOut?: Seat): MatchState {
  const rules = rulesOf(state);
  const active = activeSeats(state);
  const adjustments: FinalAdjustment[] = state.players.map((_, seat) => ({
    seat,
    rackPenalty: 0,
    bonus: 0,
    net: 0,
    leftover: state.racks[seat].map((id) => ({ letter: state.tiles[id].letter ?? "?", blank: state.tiles[id].letter === null })),
  }));
  const scores = state.scores.slice();
  let winners: Seat[];
  if (reason === "resigned") {
    // Resignation: no rack adjustments, no invented score; the remaining player wins.
    winners = active;
  } else {
    for (const seat of active) {
      const v = state.racks[seat].reduce((a, id) => a + tileValue(rules, state.tiles[id]), 0);
      adjustments[seat].rackPenalty = v;
    }
    if (reason === "went-out" && wentOut !== undefined) {
      const bonus = active.filter((s) => s !== wentOut).reduce((a, s) => a + adjustments[s].rackPenalty, 0);
      adjustments[wentOut].bonus = bonus;
    }
    for (const a of adjustments) {
      a.net = a.bonus - a.rackPenalty;
      scores[a.seat] += a.net;
    }
    const best = Math.max(...active.map((s) => scores[s]));
    winners = active.filter((s) => scores[s] === best);
  }
  return {
    ...state,
    scores,
    status: "finished",
    end: { reason, wentOut, adjustments, winners, finalScores: scores },
  };
}

/* ------------------------------------------------------------------ */
/* Commit (atomic, idempotent, version-checked)                         */
/* ------------------------------------------------------------------ */

function rejected(state: MatchState, code: string, message: string): CommitResult {
  return { status: "rejected", state, code, message };
}

const ACTION_ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;

export function commit(state: MatchState, request: CommitRequest, words: Membership): CommitResult {
  if (!request || typeof request.actionId !== "string" || !ACTION_ID_RE.test(request.actionId))
    return rejected(state, "bad-action-id", "The move is missing a valid action ID.");
  const prior = state.history.find((h) => h.actionId === request.actionId);
  if (prior) {
    // Idempotent replay: return the original result, change nothing.
    return {
      status: "duplicate",
      state,
      code: "duplicate",
      message: "This move was already recorded; nothing was applied twice.",
      words: prior.kind === "place" ? prior.words : undefined,
      score: prior.kind === "place" ? prior.score : undefined,
    };
  }
  if (!Number.isInteger(request.expectedVersion) || request.expectedVersion !== state.version) {
    return {
      status: "conflict",
      state,
      code: "stale-version",
      message: `The board has changed since this move was prepared (expected version ${request.expectedVersion}, now ${state.version}). Check the latest board and try again.`,
    };
  }
  const action = request.action;
  if (!action || typeof action !== "object") return rejected(state, "bad-action", "The move could not be read.");
  if (state.status !== "active") return rejected(state, "match-finished", "The match has finished.");
  if (action.seat !== state.current) return rejected(state, "not-your-turn", `It is ${state.players[state.current].name}'s turn.`);
  const rules = rulesOf(state);
  const seat = action.seat;
  const version = state.version + 1;

  switch (action.type) {
    case "place": {
      const a = analysePlacement(state, seat, action.placements, words);
      if (!a.legal) return rejected(state, a.code, a.message);
      const size = rules.boardSize;
      const board = state.board.slice();
      const used = new Set<string>();
      const placed: { row: number; column: number; face: string; blank: boolean }[] = [];
      for (const p of action.placements) {
        const tile = state.tiles[p.tileId];
        const face = tile.letter ?? p.face!;
        board[cellIndex(size, p.row, p.column)] = { tileId: p.tileId, face, blank: tile.letter === null, placedAt: version };
        used.add(p.tileId);
        placed.push({ row: p.row, column: p.column, face, blank: tile.letter === null });
      }
      const rackAfter = state.racks[seat].filter((id) => !used.has(id));
      const drawCount = Math.min(rules.rackSize - rackAfter.length, state.bag.length);
      const drawn = state.bag.slice(0, drawCount);
      const racks = state.racks.slice();
      racks[seat] = [...rackAfter, ...drawn];
      const scores = state.scores.slice();
      scores[seat] += a.score;
      let next: MatchState = {
        ...state,
        board,
        racks,
        bag: state.bag.slice(drawCount),
        scores,
        version,
        consecutiveInactive: 0,
        history: [...state.history, { kind: "place", actionId: request.actionId, seat, version, words: a.words, score: a.score, tiles: placed, drawn: drawCount }],
      };
      if (next.bag.length === 0 && next.racks[seat].length === 0) {
        next = finish(next, "went-out", seat);
        return { status: "accepted", state: next, code: "placed-went-out", message: `${state.players[seat].name} scores ${a.score} and goes out. The match is over.`, words: a.words, score: a.score };
      }
      next = { ...next, current: nextSeat(next, seat) };
      return { status: "accepted", state: next, code: "placed", message: `${state.players[seat].name} ${a.message.replace(/^Scores/, "scores")}`, words: a.words, score: a.score };
    }
    case "pass":
    case "exchange": {
      let next: MatchState;
      if (action.type === "exchange") {
        const ids = action.tileIds;
        if (!Array.isArray(ids) || ids.length === 0) return rejected(state, "exchange-empty", "Choose at least one tile to exchange.");
        if (state.bag.length < rules.exchangeAllowedWithBagMinimum)
          return rejected(state, "exchange-bag-low", `Exchanging needs at least ${rules.exchangeAllowedWithBagMinimum} tiles in the bag; there ${state.bag.length === 1 ? "is" : "are"} ${state.bag.length}.`);
        if (new Set(ids).size !== ids.length) return rejected(state, "duplicate-tile", "The same tile was chosen twice.");
        if (ids.length > state.racks[seat].length) return rejected(state, "exchange-too-many", "You cannot exchange more tiles than you hold.");
        if (!ids.every((id) => state.racks[seat].includes(id))) return rejected(state, "tile-not-in-rack", "That tile is not on your rack.");
        const drawn = state.bag.slice(0, ids.length);
        const remaining = state.bag.slice(ids.length);
        const [bag, rng] = shuffleWith([...remaining, ...ids], state.rng);
        const racks = state.racks.slice();
        racks[seat] = [...state.racks[seat].filter((id) => !ids.includes(id)), ...drawn];
        next = {
          ...state,
          racks,
          bag,
          rng,
          version,
          consecutiveInactive: state.consecutiveInactive + 1,
          history: [...state.history, { kind: "exchange", actionId: request.actionId, seat, version, count: ids.length }],
        };
      } else {
        next = {
          ...state,
          version,
          consecutiveInactive: state.consecutiveInactive + 1,
          history: [...state.history, { kind: "pass", actionId: request.actionId, seat, version }],
        };
      }
      const threshold = rules.passOrExchangeRoundsToEnd * activeSeats(next).length;
      const verb = action.type === "pass" ? "passes" : `exchanges ${action.tileIds.length} tile${action.tileIds.length === 1 ? "" : "s"}`;
      if (next.consecutiveInactive >= threshold) {
        next = finish(next, "passes");
        return { status: "accepted", state: next, code: `${action.type}-ended`, message: `${state.players[seat].name} ${verb}. That makes ${threshold} passes or exchanges in a row, so the match is over.` };
      }
      next = { ...next, current: nextSeat(next, seat) };
      return { status: "accepted", state: next, code: action.type === "pass" ? "passed" : "exchanged", message: `${state.players[seat].name} ${verb}.` };
    }
    case "resign": {
      const resigned = state.resigned.slice();
      resigned[seat] = true;
      let next: MatchState = {
        ...state,
        resigned,
        version,
        history: [...state.history, { kind: "resign", actionId: request.actionId, seat, version }],
      };
      if (activeSeats(next).length <= 1) {
        next = finish(next, "resigned");
        return { status: "accepted", state: next, code: "resigned-ended", message: `${state.players[seat].name} resigns. ${next.players[next.end!.winners[0]].name} wins.` };
      }
      // The consecutive pass counter keeps running; its threshold shrinks with fewer players.
      next = { ...next, current: nextSeat(next, seat) };
      const threshold = rules.passOrExchangeRoundsToEnd * activeSeats(next).length;
      if (next.consecutiveInactive >= threshold) {
        next = finish(next, "passes");
        return { status: "accepted", state: next, code: "resign-ended-passes", message: `${state.players[seat].name} resigns, and the run of passes now ends the match.` };
      }
      return { status: "accepted", state: next, code: "resigned", message: `${state.players[seat].name} resigns and leaves the match. Play continues.` };
    }
    case "hint": {
      const hintsTaken = state.hintsTaken.slice();
      hintsTaken[seat] += 1;
      const next: MatchState = {
        ...state,
        hintsTaken,
        version,
        history: [...state.history, { kind: "hint", actionId: request.actionId, seat, version }],
      };
      return { status: "accepted", state: next, code: "hint", message: `${state.players[seat].name} looked at word ideas from their rack. This is noted as assistance.` };
    }
    default:
      return rejected(state, "bad-action", "The move could not be read.");
  }
}

/* ------------------------------------------------------------------ */
/* Hints: words the current rack can make on its own                    */
/* ------------------------------------------------------------------ */

/**
 * Up to `limit` words (longest first, then A-Z) that can be spelt from the rack alone, with
 * blanks as wildcards. It says nothing about where they fit, and never looks at the bag or other
 * racks. Deterministic for a given rack and word list.
 */
export function rackWordIdeas(state: MatchState, seat: Seat, words: Iterable<string>, limit = 8): string[] {
  const rules = rulesOf(state);
  const counts: Record<string, number> = {};
  let blanks = 0;
  for (const id of state.racks[seat]) {
    const l = state.tiles[id].letter;
    if (l === null) blanks++;
    else counts[l] = (counts[l] ?? 0) + 1;
  }
  const max = state.racks[seat].length;
  const found: string[] = [];
  for (const w of words) {
    if (w.length < Math.max(rules.minimumWordLength, 2) || w.length > max) continue;
    const c = { ...counts };
    let b = blanks;
    let ok = true;
    for (const ch of w) {
      if (c[ch]) c[ch]--;
      else if (b > 0) b--;
      else {
        ok = false;
        break;
      }
    }
    if (ok) found.push(w);
  }
  found.sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
  return found.slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Invariants                                                           */
/* ------------------------------------------------------------------ */

/** Every tile is in exactly one place (a rack, the bag or the board). Returns problems. */
export function checkConservation(state: MatchState): string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  const note = (id: string, where: string) => {
    if (!state.tiles[id]) problems.push(`unknown tile ${id} in ${where}`);
    if (seen.has(id)) problems.push(`tile ${id} in both ${seen.get(id)} and ${where}`);
    seen.set(id, where);
  };
  state.racks.forEach((r, i) => r.forEach((id) => note(id, `rack ${i}`)));
  state.bag.forEach((id) => note(id, "bag"));
  state.board.forEach((c, i) => c && note(c.tileId, `board ${i}`));
  const total = Object.keys(state.tiles).length;
  if (seen.size !== total) problems.push(`accounted for ${seen.size} of ${total} tiles`);
  const rules = rulesOf(state);
  state.racks.forEach((r, i) => {
    if (r.length > rules.rackSize) problems.push(`rack ${i} holds ${r.length} tiles`);
  });
  return problems;
}
