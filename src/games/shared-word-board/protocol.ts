/**
 * Server-authoritative turn protocol and hidden-rack projection, as pure functions.
 *
 * No backend exists yet, so the site only offers local pass-and-play. These functions are the
 * contract a future server must implement: a client sends { matchId, version, actionId, move };
 * the server commits atomically and returns a redacted view for that seat. Nothing here ever
 * exposes another seat's rack letters, the bag order or the RNG state.
 */
import { commit, type CommitRequest, type CommitStatus, type EndInfo, type HistoryEntry, type MatchState, type Membership, type Seat, type Tile, type WordScore } from "./engine";
import { getRuleSet } from "./rules";

export interface PublicCell {
  face: string;
  blank: boolean;
  placedAt: number;
}

export type PublicHistoryEntry =
  | { kind: "place"; seat: Seat; version: number; words: { word: string; score: number; explanation: string }[]; score: number; tiles: { row: number; column: number; face: string; blank: boolean }[] }
  | { kind: "pass" | "resign" | "hint"; seat: Seat; version: number }
  | { kind: "exchange"; seat: Seat; version: number; count: number };

export interface PublicPlayer {
  seat: Seat;
  name: string;
  score: number;
  rackCount: number;
  resigned: boolean;
  hintsTaken: number;
}

export interface PublicView {
  gameId: "shared-word-board";
  rulesVersion: string;
  dictionaryVersion: string;
  version: number;
  status: "active" | "finished";
  viewer: Seat;
  current: Seat;
  boardSize: number;
  board: (PublicCell | null)[];
  bagCount: number;
  consecutiveInactive: number;
  players: PublicPlayer[];
  /** The viewer's own rack, in stored order. */
  ownRack: Tile[];
  history: PublicHistoryEntry[];
  /** Present only once the match is over (leftover racks are then disclosed for the adjustment). */
  end: EndInfo | null;
}

function publicEntry(h: HistoryEntry): PublicHistoryEntry {
  switch (h.kind) {
    case "place":
      return { kind: "place", seat: h.seat, version: h.version, score: h.score, tiles: h.tiles.map((t) => ({ ...t })), words: h.words.map((w: WordScore) => ({ word: w.word, score: w.score, explanation: w.explanation })) };
    case "exchange":
      return { kind: "exchange", seat: h.seat, version: h.version, count: h.count };
    default:
      return { kind: h.kind, seat: h.seat, version: h.version };
  }
}

/** Redacted view for one seat: own rack only; others' rack counts; bag count, never its order. */
export function publicView(state: MatchState, viewer: Seat): PublicView {
  const rules = getRuleSet(state.rulesVersion);
  return {
    gameId: state.gameId,
    rulesVersion: state.rulesVersion,
    dictionaryVersion: state.dictionaryVersion,
    version: state.version,
    status: state.status,
    viewer,
    current: state.current,
    boardSize: rules.boardSize,
    board: state.board.map((c) => (c ? { face: c.face, blank: c.blank, placedAt: c.placedAt } : null)),
    bagCount: state.bag.length,
    consecutiveInactive: state.consecutiveInactive,
    players: state.players.map((p, seat) => ({
      seat,
      name: p.name,
      score: state.scores[seat],
      rackCount: state.racks[seat].length,
      resigned: state.resigned[seat],
      hintsTaken: state.hintsTaken[seat],
    })),
    ownRack: viewer >= 0 && viewer < state.players.length ? state.racks[viewer].map((id) => ({ ...state.tiles[id] })) : [],
    history: state.history.map(publicEntry),
    end: state.status === "finished" && state.end ? JSON.parse(JSON.stringify(state.end)) : null,
  };
}

export interface TurnRequest extends CommitRequest {
  matchId: string;
  /** Authenticated seat of the requester (the server derives this from the session, never the body). */
  seat: Seat;
}

export interface TurnResponse {
  status: CommitStatus | "forbidden" | "wrong-match";
  code: string;
  message: string;
  score?: number;
  /** Always the authoritative, redacted state for the requester (for reconciliation on conflict). */
  view: PublicView;
}

/**
 * Handle one turn request exactly as a server would: check match membership and that the move is
 * made by the authenticated seat, then commit atomically. Returns the next authoritative state
 * (kept server side) and a redacted response for the requester.
 */
export function handleTurn(
  state: MatchState,
  matchId: string,
  request: TurnRequest,
  words: Membership,
): { state: MatchState; response: TurnResponse } {
  const seatOk = Number.isInteger(request.seat) && request.seat >= 0 && request.seat < state.players.length;
  if (request.matchId !== matchId) {
    return { state, response: { status: "wrong-match", code: "wrong-match", message: "That move is for a different match.", view: publicView(state, seatOk ? request.seat : -1) } };
  }
  if (!seatOk) {
    return { state, response: { status: "forbidden", code: "not-a-member", message: "You are not a player in this match.", view: publicView(state, -1) } };
  }
  if (request.action && request.action.seat !== request.seat) {
    return { state, response: { status: "forbidden", code: "forged-seat", message: "A move can only be made for your own seat.", view: publicView(state, request.seat) } };
  }
  const result = commit(state, { actionId: request.actionId, expectedVersion: request.expectedVersion, action: request.action }, words);
  return {
    state: result.state,
    response: { status: result.status, code: result.code, message: result.message, score: result.score, view: publicView(result.state, request.seat) },
  };
}
