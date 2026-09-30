/**
 * TEST-ONLY helpers for building exact Hexabble positions. Never imported by production code.
 *
 * Token grammar: an upper-case letter is that letter tile; "*" a Wild, "#" a Key, ">" a Pivot.
 * Board tokens for Wild/Key carry their face after the symbol, e.g. "*E" or "#A".
 */
import {
  RULES_VERSION,
  TILES,
  cellKey,
  type BoardCell,
  type CheckingMode,
  type MatchState,
  type ResolvedPlacement,
  type Tile,
  tileById,
} from "../engine";

export const setOf = (...words: string[]) => new Set(words.map((w) => w.toUpperCase()));

function pickTile(token: string, used: Set<string>): Tile {
  const sym = token[0];
  const t = TILES.find((x) => {
    if (used.has(x.id)) return false;
    if (sym === "*") return x.kind === "wild";
    if (sym === "#") return x.kind === "key";
    if (sym === ">") return x.kind === "pivot";
    return x.kind === "letter" && x.letter === sym;
  });
  if (!t) throw new Error(`No tile left for ${token}`);
  used.add(t.id);
  return t;
}

export interface RigOptions {
  mode?: CheckingMode;
  /** One token string per player, e.g. ["CAT", "QZ*"]. */
  racks: string[];
  board?: { at: [number, number]; tok: string; player?: number }[];
  /** Tokens to put at the END of the bag (drawn first), in draw order. */
  bagTop?: string;
  /** Leave everything else out of the bag (rules-only rig; breaks conservation). */
  emptyBag?: boolean;
  /** Keep only this many tiles in the bag (taken from the rest), for exchange-threshold tests. */
  bagSize?: number;
  names?: string[];
}

export function rig(o: RigOptions): MatchState {
  const used = new Set<string>();
  const board: Record<string, BoardCell> = {};
  for (const b of o.board ?? []) {
    const t = pickTile(b.tok, used);
    const letter = t.kind === "letter" ? t.letter : t.kind === "pivot" ? null : b.tok[1];
    board[cellKey(b.at[0], b.at[1])] = { tileId: t.id, letter, player: b.player ?? 0, turn: 1 };
  }
  const racks = o.racks.map((s) => [...s].map((tok) => pickTile(tok, used).id));
  const top = [...(o.bagTop ?? "")].map((tok) => pickTile(tok, used).id);
  let rest = o.emptyBag ? [] : TILES.filter((t) => !used.has(t.id)).map((t) => t.id);
  if (o.bagSize !== undefined) rest = rest.slice(0, Math.max(0, o.bagSize - top.length));
  const bag = [...rest, ...top.reverse()];
  return {
    rulesVersion: RULES_VERSION,
    mode: o.mode ?? "friendly",
    seed: 1,
    rngState: 1,
    players: racks.map((rack, i) => ({ name: o.names?.[i] ?? `P${i + 1}`, score: 0, rack, endAdjust: 0 })),
    bag,
    board,
    current: 0,
    turn: 1,
    scoreless: 0,
    history: [],
    lastMove: [],
    over: false,
    endReason: null,
    winners: [],
  };
}

/** Place the current player's rack tiles by index: [q, r, rackIndex, face?]. */
export function placements(state: MatchState, spec: [number, number, number, string?][]) {
  const rack = state.players[state.current].rack;
  return spec.map(([q, r, i, face]) => ({ q, r, tileId: rack[i], assigned: face ?? null }));
}

/** Resolved placements with fresh catalogue tiles, for direct analyseMove calls. */
export function resolved(spec: [number, number, string][]): ResolvedPlacement[] {
  const used = new Set<string>();
  return spec.map(([q, r, tok]) => {
    const tile = pickTile(tok, used);
    const assigned = tile.kind === "wild" || tile.kind === "key" ? (tok[1] ?? null) : null;
    return { q, r, tile, assigned };
  });
}

/** A board (for analyseMove) from tokens, using tiles distinct from `resolved` picks is not required. */
export function boardOf(cells: [number, number, string][]): Record<string, BoardCell> {
  const used = new Set<string>();
  const board: Record<string, BoardCell> = {};
  // Take tiles from the END of the catalogue so they do not collide with `resolved` picks in intent.
  for (const [q, r, tok] of cells) {
    const sym = tok[0];
    const t = [...TILES].reverse().find((x) => {
      if (used.has(x.id)) return false;
      if (sym === "*") return x.kind === "wild";
      if (sym === "#") return x.kind === "key";
      if (sym === ">") return x.kind === "pivot";
      return x.kind === "letter" && x.letter === sym;
    });
    if (!t) throw new Error(`No tile for ${tok}`);
    used.add(t.id);
    board[cellKey(q, r)] = { tileId: t.id, letter: t.kind === "letter" ? t.letter : t.kind === "pivot" ? null : tok[1], player: 0, turn: 1 };
  }
  return board;
}

export function lettersOnBoard(state: MatchState): string {
  return Object.values(state.board)
    .map((b) => b.letter ?? `(${tileById(b.tileId)?.kind})`)
    .join("");
}
