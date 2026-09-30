/**
 * Versioned local save for a pass-and-play match.
 *
 * Only the setup (players, seed, pinned rules/dictionary) and the raw committed requests are
 * trusted. The board, racks, bag and scores are rebuilt by replaying every request through the
 * pure engine; a save whose requests no longer replay is reported as corrupt, and a save made
 * under a different rule set or word list is never reinterpreted.
 */
import { z } from "zod";
import { commit, createMatch, type CommitRequest, type MatchState, type Membership, type Placement } from "./engine";
import { getRuleSet, isRulesVersion, rulesHash, type RulesVersion } from "./rules";

export const MATCH_SCHEMA_VERSION = 1;

const placementSchema = z.object({
  tileId: z.string().min(1).max(20),
  row: z.number().int(),
  column: z.number().int(),
  face: z.string().max(1).optional(),
});

export const draftSchema = z.object({
  seat: z.number().int().nonnegative(),
  version: z.number().int().nonnegative(),
  placements: z.array(placementSchema).max(7),
  rackOrder: z.array(z.string().min(1).max(20)).max(7),
});
export type MatchDraft = z.infer<typeof draftSchema>;

const storedRequestSchema = z.object({
  actionId: z.string().min(1).max(80),
  expectedVersion: z.number().int().nonnegative(),
  action: z.unknown(),
  at: z.string(),
});
export type StoredRequest = z.infer<typeof storedRequestSchema>;

export const matchEnvelopeSchema = z.object({
  schemaVersion: z.literal(MATCH_SCHEMA_VERSION),
  gameId: z.literal("shared-word-board"),
  matchId: z.string().min(1).max(80),
  rulesVersion: z.string(),
  rulesHash: z.string().min(1),
  dictionaryVersion: z.string().min(1),
  setup: z.object({
    players: z.array(z.object({ name: z.string().min(1).max(24) })).min(2).max(4),
    seed: z.number().int(),
    firstSeat: z.number().int().nonnegative(),
  }),
  actions: z.array(storedRequestSchema),
  draft: draftSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MatchEnvelope = z.infer<typeof matchEnvelopeSchema>;

export function newEnvelope(opts: {
  matchId: string;
  rulesVersion: RulesVersion;
  dictionaryVersion: string;
  players: { name: string }[];
  seed: number;
  firstSeat?: number;
  now: string;
}): MatchEnvelope {
  return {
    schemaVersion: MATCH_SCHEMA_VERSION,
    gameId: "shared-word-board",
    matchId: opts.matchId,
    rulesVersion: opts.rulesVersion,
    rulesHash: rulesHash(getRuleSet(opts.rulesVersion)),
    dictionaryVersion: opts.dictionaryVersion,
    setup: { players: opts.players.map((p) => ({ name: p.name.trim() })), seed: opts.seed >>> 0, firstSeat: opts.firstSeat ?? 0 },
    actions: [],
    createdAt: opts.now,
    updatedAt: opts.now,
  };
}

/** Append an accepted request; a repeated action ID leaves the envelope unchanged. */
export function withRequest(env: MatchEnvelope, req: CommitRequest, at: string): MatchEnvelope {
  if (env.actions.some((a) => a.actionId === req.actionId)) return env;
  return { ...env, actions: [...env.actions, { actionId: req.actionId, expectedVersion: req.expectedVersion, action: req.action, at }], draft: undefined, updatedAt: at };
}

export function withDraft(env: MatchEnvelope, draft: MatchDraft | undefined): MatchEnvelope {
  return { ...env, draft };
}

export type RestoreMatchResult =
  | { status: "restored"; state: MatchState; envelope: MatchEnvelope }
  | { status: "corrupt"; reason: string }
  | { status: "version-mismatch"; reason: string };

/**
 * Validate a raw stored value and rebuild the match by replaying its requests.
 * `dictionaryVersion` is the word list version currently loaded; a save pinned to another is refused.
 */
export function restoreMatch(raw: unknown, words: Membership, dictionaryVersion: string): RestoreMatchResult {
  const parsed = matchEnvelopeSchema.safeParse(raw);
  if (!parsed.success) return { status: "corrupt", reason: "The saved match is not in a recognised format." };
  const env = parsed.data;
  if (!isRulesVersion(env.rulesVersion))
    return { status: "version-mismatch", reason: `The saved match uses rules version ${env.rulesVersion}, which this site no longer plays.` };
  if (env.rulesHash !== rulesHash(getRuleSet(env.rulesVersion)))
    return { status: "version-mismatch", reason: "The saved match was played under a different version of its rules, so it cannot be replayed." };
  if (env.dictionaryVersion !== dictionaryVersion)
    return { status: "version-mismatch", reason: "The saved match used a different word list version, so it cannot be replayed." };
  const created = createMatch({
    rulesVersion: env.rulesVersion,
    dictionaryVersion: env.dictionaryVersion,
    players: env.setup.players,
    seed: env.setup.seed,
    firstSeat: env.setup.firstSeat,
  });
  if (!created.ok) return { status: "corrupt", reason: `The saved match setup is invalid (${created.code}).` };
  let state = created.state;
  const seen = new Set<string>();
  for (const req of env.actions) {
    if (seen.has(req.actionId)) return { status: "corrupt", reason: "The saved match repeats a move." };
    seen.add(req.actionId);
    const r = commit(state, { actionId: req.actionId, expectedVersion: req.expectedVersion, action: req.action as CommitRequest["action"] }, words);
    if (r.status !== "accepted") return { status: "corrupt", reason: `A saved move could not be replayed (${r.code}).` };
    state = r.state;
  }
  return { status: "restored", state, envelope: env };
}

/** A draft is restored only if it still fits: same seat and version, tiles on the rack, squares empty. */
export function compatibleDraft(state: MatchState, draft: MatchDraft | undefined): MatchDraft | undefined {
  if (!draft || state.status !== "active") return undefined;
  if (draft.seat !== state.current || draft.version !== state.version) return undefined;
  const rack = state.racks[draft.seat];
  const size = getRuleSet(state.rulesVersion).boardSize;
  const ids = new Set<string>();
  for (const p of draft.placements as Placement[]) {
    if (!rack.includes(p.tileId) || ids.has(p.tileId)) return undefined;
    ids.add(p.tileId);
    if (p.row < 0 || p.column < 0 || p.row >= size || p.column >= size) return undefined;
    if (state.board[p.row * size + p.column]) return undefined;
  }
  const order = draft.rackOrder.filter((id) => rack.includes(id));
  const complete = order.length === rack.length && new Set(order).size === rack.length;
  return { ...draft, rackOrder: complete ? order : rack.slice() };
}
