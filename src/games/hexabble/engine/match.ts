/**
 * Hexabble match state and actions. Pure and deterministic: no DOM, clock or Math.random.
 * Bag order comes from a serialisable seeded generator state kept inside the match.
 *
 * Migrated from createGame/playMove/pass/exchange/endGame in the adapted reference engine,
 * with the adapted guards (duplicate rack IDs, fractional coordinates, multi-character
 * special faces) and atomic rejection: a rejected action returns the SAME state object.
 */
import type { GameEvent, Transition } from "@/lib/engine/types";
import { analyseMove, type BoardCell, type MoveAnalysis, type ResolvedPlacement, type WordList } from "./analyse";
import { cellKey, type CellKey } from "./geometry";
import { shuffleWithState } from "./rng";
import { RACK_SIZE, TILES, tileById, tileValue } from "./tiles";

export const RULES_VERSION = "hexabble-rules-1.0";
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const MAX_NAME_LENGTH = 24;

export type CheckingMode = "friendly" | "challenge";

export interface PlayerState {
  name: string;
  /** Running score, including the final adjustment once the match is over. */
  score: number;
  /** Tile IDs in display order. */
  rack: string[];
  /** Final unplayed-tile adjustment (0 until the match ends). */
  endAdjust: number;
}

export interface HistoryWord {
  text: string;
  score: number;
  kind: "main" | "cross" | "touch";
  counted: boolean;
  wordMult: number;
}

export type EndCause = "went-out" | "scoreless" | "agreed";

export type HistoryEntry =
  | { type: "play"; player: number; turn: number; score: number; bingo: boolean; words: HistoryWord[]; cells: CellKey[] }
  | { type: "challenge"; player: number; turn: number; score: 0; words: string[]; invalid: string[]; reason: string }
  | { type: "pass"; player: number; turn: number; score: 0 }
  | { type: "exchange"; player: number; turn: number; score: 0; count: number }
  | { type: "end"; cause: EndCause; outPlayer: number | null; reason: string; adjustments: number[] };

export interface MatchState {
  rulesVersion: string;
  mode: CheckingMode;
  /** Seed the bag was first shuffled with (informational). */
  seed: number;
  /** Current generator state; advanced by every shuffle. */
  rngState: number;
  players: PlayerState[];
  /** Draw pile; tiles are drawn from the END (as in the source). */
  bag: string[];
  board: Record<CellKey, BoardCell>;
  current: number;
  turn: number;
  /** Consecutive scoreless turns (passes, exchanges, failed challenges). */
  scoreless: number;
  history: HistoryEntry[];
  lastMove: CellKey[];
  over: boolean;
  endReason: string | null;
  winners: number[];
}

export interface PlacementInput {
  q: number;
  r: number;
  tileId: string;
  /** Face for a Wild/Key tile: exactly one letter A–Z. Ignored for letter and Pivot tiles. */
  assigned?: string | null;
}

export type MatchAction =
  | { type: "play"; placements: PlacementInput[] }
  | { type: "pass" }
  | { type: "exchange"; tileIds: string[] }
  | { type: "end" }
  /** Reorder the current player's rack (does not use the turn). */
  | { type: "arrange"; tileIds: string[] };

export interface MatchFeedback {
  analysis?: MoveAnalysis;
  entry?: HistoryEntry;
}

export type MatchTransition = Transition<MatchState, MatchFeedback>;

export interface NewMatchOptions {
  names: string[];
  mode: CheckingMode;
  seed: number;
}

const clone = <T>(v: T): T => structuredClone(v);

export function cleanName(name: string, index: number): string {
  const n = String(name ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return n || `Player ${index + 1}`;
}

/** Start a match: seeded shuffle of all 108 tiles, then each player draws seven in seat order. */
export function createMatch(opts: NewMatchOptions): MatchState {
  const names = opts.names.slice(0, MAX_PLAYERS);
  if (names.length < MIN_PLAYERS) throw new Error("Hexabble needs two to four players.");
  const seed = opts.seed >>> 0;
  const shuffled = shuffleWithState(
    TILES.map((t) => t.id),
    seed,
  );
  const state: MatchState = {
    rulesVersion: RULES_VERSION,
    mode: opts.mode,
    seed,
    rngState: shuffled.state,
    players: names.map((n, i) => ({ name: cleanName(n, i), score: 0, rack: [], endAdjust: 0 })),
    bag: shuffled.items,
    board: {},
    current: 0,
    turn: 1,
    scoreless: 0,
    history: [],
    lastMove: [],
    over: false,
    endReason: null,
    winners: [],
  };
  state.players.forEach((p) => draw(state, p));
  return state;
}

function draw(state: MatchState, player: PlayerState) {
  while (player.rack.length < RACK_SIZE && state.bag.length) player.rack.push(state.bag.pop()!);
}

export function rackValue(rack: readonly string[]): number {
  return rack.reduce((s, id) => {
    const t = tileById(id);
    return s + (t ? tileValue(t) : 0);
  }, 0);
}

function advance(state: MatchState) {
  state.current = (state.current + 1) % state.players.length;
  state.turn++;
}

/** Ends the match after 2 x players consecutive scoreless turns. Returns true if it ended. */
function checkScoreless(state: MatchState): boolean {
  const limit = 2 * state.players.length;
  if (state.scoreless >= limit) {
    endMatch(
      state,
      null,
      "scoreless",
      `There were ${limit} scoreless turns in a row (passes, exchanges or failed challenges), so the match ended.`,
    );
    return true;
  }
  return false;
}

/**
 * Standard finish: everyone loses their unplayed tile values; a player who went out gains the
 * total of everyone else's unplayed tiles. Idempotent (does nothing once over).
 */
function endMatch(state: MatchState, outIdx: number | null, cause: EndCause, reason: string) {
  if (state.over) return;
  let others = 0;
  state.players.forEach((p, i) => {
    const v = rackValue(p.rack);
    p.endAdjust = -v;
    p.score -= v;
    if (i !== outIdx) others += v;
  });
  if (outIdx !== null) {
    state.players[outIdx].score += others;
    state.players[outIdx].endAdjust += others;
  }
  state.over = true;
  state.endReason = reason;
  const top = Math.max(...state.players.map((p) => p.score));
  state.winners = state.players.map((p, i) => (p.score === top ? i : -1)).filter((i) => i >= 0);
  state.history.push({ type: "end", cause, outPlayer: outIdx, reason, adjustments: state.players.map((p) => p.endAdjust) });
}

function reject(state: MatchState, code: string, message: string, feedback?: MatchFeedback): MatchTransition {
  return { ok: false, state, code, message, events: [], feedback };
}

function accept(state: MatchState, code: string, message: string, events: GameEvent[], feedback?: MatchFeedback): MatchTransition {
  return { ok: true, state, code, message, events, feedback };
}

export type ResolveResult = { ok: true; placements: ResolvedPlacement[] } | { ok: false; code: string; message: string };

/** Validate raw placement records at the boundary and resolve them against the current rack. */
export function resolvePlacements(state: MatchState, placements: unknown): ResolveResult {
  if (!Array.isArray(placements) || !placements.length)
    return { ok: false, code: "no-placements", message: "Place at least one tile." };
  if (placements.some((p) => !p || typeof p !== "object" || Array.isArray(p) || typeof (p as PlacementInput).tileId !== "string"))
    return { ok: false, code: "malformed-placement", message: "Use valid placement records with rack tile IDs." };
  const list = placements as PlacementInput[];
  if (new Set(list.map((p) => p.tileId)).size !== list.length)
    return { ok: false, code: "duplicate-tile", message: "A rack tile can only be used once in a move." };
  if (list.some((p) => !Number.isInteger(p.q) || !Number.isInteger(p.r)))
    return { ok: false, code: "bad-coordinates", message: "Use whole-number board coordinates." };
  if (list.some((p) => p.assigned != null && (typeof p.assigned !== "string" || !/^[A-Za-z]$/.test(p.assigned))))
    return { ok: false, code: "bad-face", message: "A Wild or Key tile must show exactly one letter from A to Z." };
  const rack = state.players[state.current].rack;
  const resolved: ResolvedPlacement[] = [];
  for (const pl of list) {
    const tile = rack.includes(pl.tileId) ? tileById(pl.tileId) : undefined;
    if (!tile) return { ok: false, code: "not-in-rack", message: "That tile is not in your rack." };
    const face = tile.kind === "wild" || tile.kind === "key" ? (pl.assigned ? pl.assigned.toUpperCase() : null) : null;
    resolved.push({ q: pl.q, r: pl.r, tile, assigned: face });
  }
  return { ok: true, placements: resolved };
}

/**
 * Non-mutating analysis of a draft for the current player. Pass `dict` null to withhold
 * dictionary validity (Challenge mode preview).
 */
export function previewMove(state: MatchState, placements: PlacementInput[], dict: WordList | null): MoveAnalysis | { ok: false; code: string; placementError: string } {
  const r = resolvePlacements(state, placements);
  if (!r.ok) return { ok: false, code: r.code, placementError: r.message };
  return analyseMove(state.board, r.placements, dict);
}

export function applyAction(state: MatchState, action: MatchAction, dict: WordList): MatchTransition {
  if (!action || typeof action !== "object") return reject(state, "malformed-action", "That action is not recognised.");
  if (state.over && action.type !== "end") return reject(state, "game-over", "The match is over.");
  switch (action.type) {
    case "play":
      return play(state, action.placements, dict);
    case "pass":
      return pass(state);
    case "exchange":
      return exchange(state, action.tileIds);
    case "end":
      return endAgreed(state);
    case "arrange":
      return arrange(state, action.tileIds);
    default:
      return reject(state, "malformed-action", "That action is not recognised.");
  }
}

function play(state: MatchState, placements: unknown, dict: WordList): MatchTransition {
  const r = resolvePlacements(state, placements);
  if (!r.ok) return reject(state, r.code, r.message);
  const a = analyseMove(state.board, r.placements, dict);
  if (a.placementError) return reject(state, a.code, a.placementError, { analysis: a });
  const cur = state.current;
  if (a.wordErrors.length) {
    if (state.mode === "friendly") return reject(state, "invalid-word", a.wordErrors.join(" "), { analysis: a });
    const next = clone(state);
    const entry: HistoryEntry = {
      type: "challenge",
      player: cur,
      turn: next.turn,
      score: 0,
      words: a.words.map((w) => w.text),
      invalid: a.words.filter((w) => w.valid === false).map((w) => w.text),
      reason: a.wordErrors.join(" "),
    };
    next.history.push(entry);
    next.scoreless++;
    const ended = checkScoreless(next);
    if (!ended) advance(next);
    return accept(
      next,
      "challenged",
      `Challenge upheld: ${a.wordErrors.join(" ")} ${next.players[cur].name} loses this turn and keeps their tiles.`,
      [{ type: "challenged" }, ...(ended ? [{ type: "match-over" }] : [])],
      { analysis: a, entry },
    );
  }
  const next = clone(state);
  const player = next.players[cur];
  for (const p of r.placements) {
    next.board[cellKey(p.q, p.r)] = {
      tileId: p.tile.id,
      letter: p.tile.kind === "letter" ? p.tile.letter : p.tile.kind === "pivot" ? null : p.assigned,
      player: cur,
      turn: next.turn,
    };
  }
  const ids = new Set(r.placements.map((p) => p.tile.id));
  player.rack = player.rack.filter((id) => !ids.has(id));
  player.score += a.score;
  draw(next, player);
  next.scoreless = 0;
  next.lastMove = r.placements.map((p) => cellKey(p.q, p.r));
  const entry: HistoryEntry = {
    type: "play",
    player: cur,
    turn: next.turn,
    score: a.score,
    bingo: a.bingo,
    words: a.words.map((w) => ({ text: w.text, score: w.score, kind: w.kind, counted: w.counted, wordMult: w.wordMult })),
    cells: next.lastMove.slice(),
  };
  next.history.push(entry);
  const events: GameEvent[] = [{ type: "played" }];
  if (!player.rack.length && !next.bag.length) {
    endMatch(next, cur, "went-out", `${player.name} used their last tile and the bag is empty.`);
    events.push({ type: "match-over" });
  } else advance(next);
  const counted = a.words.filter((w) => w.counted).map((w) => `${w.text} (${w.score})`);
  return accept(
    next,
    "played",
    `${player.name} scored ${a.score}: ${counted.join(", ")}${a.bingo ? ", plus 50 for using all seven tiles" : ""}.`,
    events,
    { analysis: a, entry },
  );
}

function pass(state: MatchState): MatchTransition {
  const next = clone(state);
  const cur = next.current;
  const entry: HistoryEntry = { type: "pass", player: cur, turn: next.turn, score: 0 };
  next.history.push(entry);
  next.scoreless++;
  const ended = checkScoreless(next);
  if (!ended) advance(next);
  return accept(next, "passed", `${next.players[cur].name} passed.`, [{ type: "passed" }, ...(ended ? [{ type: "match-over" }] : [])], {
    entry,
  });
}

function exchange(state: MatchState, tileIds: unknown): MatchTransition {
  if (!Array.isArray(tileIds) || !tileIds.length || tileIds.some((t) => typeof t !== "string"))
    return reject(state, "exchange-empty", "Select at least one tile to exchange.");
  if (state.bag.length < RACK_SIZE)
    return reject(state, "bag-too-small", `You can only exchange while the bag holds at least ${RACK_SIZE} tiles.`);
  const ids = new Set(tileIds as string[]);
  const player = state.players[state.current];
  const out = player.rack.filter((id) => ids.has(id));
  if (out.length !== tileIds.length || ids.size !== tileIds.length)
    return reject(state, "exchange-not-in-rack", "Those tiles are not in your rack.");
  const next = clone(state);
  const cur = next.current;
  const p = next.players[cur];
  p.rack = p.rack.filter((id) => !ids.has(id));
  draw(next, p);
  next.bag.push(...out);
  const sh = shuffleWithState(next.bag, next.rngState);
  next.bag = sh.items;
  next.rngState = sh.state;
  const entry: HistoryEntry = { type: "exchange", player: cur, turn: next.turn, score: 0, count: out.length };
  next.history.push(entry);
  next.scoreless++;
  const ended = checkScoreless(next);
  if (!ended) advance(next);
  return accept(
    next,
    "exchanged",
    `${p.name} exchanged ${out.length} tile${out.length === 1 ? "" : "s"}.`,
    [{ type: "exchanged" }, ...(ended ? [{ type: "match-over" }] : [])],
    { entry },
  );
}

function endAgreed(state: MatchState): MatchTransition {
  if (state.over) return reject(state, "game-over", "The match is already over.");
  const next = clone(state);
  endMatch(next, null, "agreed", "The players agreed to end the match.");
  return accept(next, "ended", "The match was ended by agreement.", [{ type: "match-over" }]);
}

function arrange(state: MatchState, tileIds: unknown): MatchTransition {
  const rack = state.players[state.current].rack;
  if (
    !Array.isArray(tileIds) ||
    tileIds.length !== rack.length ||
    new Set(tileIds).size !== rack.length ||
    tileIds.some((id) => typeof id !== "string" || !rack.includes(id))
  )
    return reject(state, "bad-arrangement", "A rack arrangement must list exactly the tiles in your rack.");
  const next = clone(state);
  next.players[next.current].rack = (tileIds as string[]).slice();
  return accept(next, "arranged", "Rack rearranged.", []);
}

/** Every tile ID exactly once across bag, racks and board. Returns problems (empty = ok). */
export function conservationProblems(state: MatchState): string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  const note = (id: string, where: string) => {
    if (!tileById(id)) problems.push(`Unknown tile ${id} in ${where}.`);
    else if (seen.has(id)) problems.push(`Tile ${id} appears in ${seen.get(id)} and ${where}.`);
    else seen.set(id, where);
  };
  state.bag.forEach((id) => note(id, "the bag"));
  state.players.forEach((p, i) => p.rack.forEach((id) => note(id, `player ${i + 1}'s rack`)));
  Object.entries(state.board).forEach(([k, b]) => note(b.tileId, `board cell ${k}`));
  for (const t of TILES) if (!seen.has(t.id)) problems.push(`Tile ${t.id} is missing.`);
  return problems;
}

export function activePlayerName(state: MatchState): string {
  return state.players[state.current].name;
}

/** Final table rows: play score before adjustment, adjustment, final. */
export function finalRows(state: MatchState) {
  return state.players.map((p, i) => ({
    index: i,
    name: p.name,
    playScore: p.score - p.endAdjust,
    adjustment: p.endAdjust,
    final: p.score,
    winner: state.winners.includes(i),
    unplayed: p.rack.slice(),
  }));
}
