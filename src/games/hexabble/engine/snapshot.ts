/**
 * Versioned, validated match snapshot for device-local persistence.
 *
 * Unlike puzzle attempts (action replay), a Hexabble match is stored as its full state because
 * the bag order is the product of a seeded shuffle plus later exchanges; every field is checked
 * on the way back in. Nothing from storage is trusted: shape (zod) plus integrity (tile
 * conservation, cell legality, player indices, score/history consistency, draft legality).
 */
import { z } from "zod";
import { parseCellKey } from "./geometry";
import { MAX_NAME_LENGTH, MAX_PLAYERS, MIN_PLAYERS, RULES_VERSION, conservationProblems, type MatchState } from "./match";
import { RACK_SIZE, tileById } from "./tiles";

export const SNAPSHOT_SCHEMA_VERSION = 1;

const uint32 = z.number().int().min(0).max(0xffffffff);
const int = z.number().int();
const nat = z.number().int().min(0);
const tileId = z.string().regex(/^t\d{1,3}$/);
const letter = z.string().regex(/^[A-Z]$/);

const boardCellSchema = z.object({ tileId, letter: letter.nullable(), player: nat, turn: z.number().int().min(1) }).strict();

const historyWordSchema = z
  .object({ text: z.string(), score: int, kind: z.enum(["main", "cross", "touch"]), counted: z.boolean(), wordMult: z.number().int().min(1) })
  .strict();

const historySchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("play"),
      player: nat,
      turn: z.number().int().min(1),
      score: int,
      bingo: z.boolean(),
      words: z.array(historyWordSchema),
      cells: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      type: z.literal("challenge"),
      player: nat,
      turn: z.number().int().min(1),
      score: z.literal(0),
      words: z.array(z.string()),
      invalid: z.array(z.string()),
      reason: z.string(),
    })
    .strict(),
  z.object({ type: z.literal("pass"), player: nat, turn: z.number().int().min(1), score: z.literal(0) }).strict(),
  z.object({ type: z.literal("exchange"), player: nat, turn: z.number().int().min(1), score: z.literal(0), count: z.number().int().min(1).max(RACK_SIZE) }).strict(),
  z
    .object({
      type: z.literal("end"),
      cause: z.enum(["went-out", "scoreless", "agreed"]),
      outPlayer: nat.nullable(),
      reason: z.string(),
      adjustments: z.array(int),
    })
    .strict(),
]);

const playerSchema = z
  .object({ name: z.string().min(1).max(MAX_NAME_LENGTH), score: int, rack: z.array(tileId).max(RACK_SIZE), endAdjust: int })
  .strict();

export const matchStateSchema = z
  .object({
    rulesVersion: z.string(),
    mode: z.enum(["friendly", "challenge"]),
    seed: uint32,
    rngState: uint32,
    players: z.array(playerSchema).min(MIN_PLAYERS).max(MAX_PLAYERS),
    bag: z.array(tileId),
    board: z.record(z.string(), boardCellSchema),
    current: nat,
    turn: z.number().int().min(1),
    scoreless: nat,
    history: z.array(historySchema),
    lastMove: z.array(z.string()),
    over: z.boolean(),
    endReason: z.string().nullable(),
    winners: z.array(nat),
  })
  .strict();

export const draftPlacementSchema = z.object({ q: int, r: int, tileId, assigned: letter.nullable() }).strict();
export const draftSchema = z.object({ placements: z.array(draftPlacementSchema).max(RACK_SIZE), selected: tileId.nullable() }).strict();
export type MatchDraft = z.infer<typeof draftSchema>;
export const EMPTY_DRAFT: MatchDraft = { placements: [], selected: null };

export const snapshotSchema = z
  .object({
    schemaVersion: z.literal(SNAPSHOT_SCHEMA_VERSION),
    gameId: z.literal("hexabble"),
    rulesVersion: z.string(),
    dictionaryVersion: z.string().min(1),
    matchId: z.string().min(1).max(120),
    createdAt: z.string(),
    updatedAt: z.string(),
    /** Hide the next player's rack behind a handover screen. */
    privacy: z.boolean(),
    /** A handover screen is currently showing (the rack is hidden). */
    handover: z.boolean(),
    state: matchStateSchema,
    draft: draftSchema,
  })
  .strict();
export type MatchSnapshot = z.infer<typeof snapshotSchema>;

export function buildSnapshot(args: {
  state: MatchState;
  draft: MatchDraft;
  matchId: string;
  createdAt: string;
  updatedAt: string;
  privacy: boolean;
  handover: boolean;
  dictionaryVersion: string;
}): MatchSnapshot {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    gameId: "hexabble",
    rulesVersion: args.state.rulesVersion,
    dictionaryVersion: args.dictionaryVersion,
    matchId: args.matchId,
    createdAt: args.createdAt,
    updatedAt: args.updatedAt,
    privacy: args.privacy,
    handover: args.state.over ? false : args.handover,
    state: args.state,
    draft: args.state.over ? { placements: [], selected: null } : args.draft,
  };
}

export type SnapshotCheck =
  | { ok: true; snapshot: MatchSnapshot }
  | { ok: false; code: "unknown-version" | "rules-version" | "malformed" | "integrity"; reason: string };

const bad = (code: "malformed" | "integrity", reason: string): SnapshotCheck => ({ ok: false, code, reason });

/** Validate an untrusted value read from storage. */
export function validateSnapshot(raw: unknown): SnapshotCheck {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return bad("malformed", "The saved match is not in a recognised format.");
  const v = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (v !== SNAPSHOT_SCHEMA_VERSION)
    return { ok: false, code: "unknown-version", reason: `The saved match uses an unknown save format (version ${String(v)}).` };
  const rv = (raw as { rulesVersion?: unknown }).rulesVersion;
  if (rv !== RULES_VERSION)
    return { ok: false, code: "rules-version", reason: `The saved match was played under different rules (${String(rv)}), so it cannot continue safely.` };
  const parsed = snapshotSchema.safeParse(raw);
  if (!parsed.success) return bad("malformed", "The saved match is incomplete or has fields in an unexpected format.");
  const snap = parsed.data;
  const problem = integrityProblem(snap);
  if (problem) return bad("integrity", problem);
  return { ok: true, snapshot: snap };
}

function integrityProblem(snap: MatchSnapshot): string | null {
  const s = snap.state as MatchState;
  const n = s.players.length;
  if (s.rulesVersion !== snap.rulesVersion) return "The match and save disagree about the rules version.";
  if (s.current >= n) return "The saved active player does not exist.";
  const cons = conservationProblems(s);
  if (cons.length) return `Tiles are missing or duplicated (${cons[0]})`;
  for (const [k, b] of Object.entries(s.board)) {
    if (!parseCellKey(k)) return `The saved board has an invalid cell (${k}).`;
    const t = tileById(b.tileId)!;
    if (t.kind === "pivot" ? b.letter !== null : t.kind === "letter" ? b.letter !== t.letter : b.letter === null)
      return `The tile on ${k} shows the wrong face.`;
    if (b.player >= n) return `The tile on ${k} belongs to a player who does not exist.`;
    if (b.turn > s.turn) return `The tile on ${k} was placed in a future turn.`;
  }
  for (const k of s.lastMove) if (!s.board[k]) return "The last move refers to an empty cell.";
  if (!s.over && s.bag.length > 0 && s.players.some((p) => p.rack.length !== RACK_SIZE))
    return "A rack is short of tiles while the bag still has tiles.";
  const playPoints = new Array(n).fill(0);
  for (const h of s.history) {
    if (h.type === "end") {
      if (h.adjustments.length !== n || (h.outPlayer !== null && h.outPlayer >= n)) return "The saved final adjustments do not match the players.";
      continue;
    }
    if (h.player >= n) return "The saved history names a player who does not exist.";
    if (h.type === "play") {
      if (h.cells.some((k) => !parseCellKey(k))) return "The saved history refers to an invalid cell.";
      playPoints[h.player] += h.score;
    }
  }
  const ends = s.history.filter((h) => h.type === "end");
  if (s.over) {
    if (ends.length !== 1 || s.history[s.history.length - 1].type !== "end") return "The finished match has no single final entry.";
    if (!s.endReason) return "The finished match has no end reason.";
    if (!s.winners.length || s.winners.some((w) => w >= n) || new Set(s.winners).size !== s.winners.length)
      return "The saved winners are not valid players.";
    const top = Math.max(...s.players.map((p) => p.score));
    const expected = s.players.map((p, i) => (p.score === top ? i : -1)).filter((i) => i >= 0);
    if (expected.join() !== s.winners.join()) return "The saved winners do not match the final scores.";
  } else {
    if (ends.length || s.endReason !== null || s.winners.length) return "An unfinished match has a final result.";
    if (s.players.some((p) => p.endAdjust !== 0)) return "An unfinished match has final adjustments.";
    if (s.scoreless >= 2 * n) return "The scoreless-turn count should already have ended the match.";
  }
  for (let i = 0; i < n; i++) {
    if (s.players[i].score !== playPoints[i] + s.players[i].endAdjust) return `${s.players[i].name}'s score does not match the move history.`;
  }
  // Draft
  const d = snap.draft;
  if (s.over && (d.placements.length || d.selected || snap.handover)) return "A finished match cannot have tiles in progress.";
  const rack = s.players[s.current].rack;
  const ids = new Set<string>();
  const cells = new Set<string>();
  for (const p of d.placements) {
    const k = `${p.q},${p.r}`;
    if (!parseCellKey(k)) return "The unsubmitted tiles include an invalid cell.";
    if (s.board[k] || cells.has(k)) return "The unsubmitted tiles overlap placed tiles.";
    if (!rack.includes(p.tileId) || ids.has(p.tileId)) return "The unsubmitted tiles are not in the active player's rack.";
    const t = tileById(p.tileId)!;
    const needs = t.kind === "wild" || t.kind === "key";
    if (needs !== (p.assigned !== null)) return "An unsubmitted special tile has an invalid face.";
    ids.add(p.tileId);
    cells.add(k);
  }
  if (d.selected !== null && (!rack.includes(d.selected) || ids.has(d.selected))) return "The selected tile is not available.";
  return null;
}
