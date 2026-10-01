import { z } from "zod";
import type { GameEngine, Outcome, RoundMeta, SessionOptions } from "@/lib/engine/types";

/**
 * Versioned attempt envelope persisted for public puzzle play.
 * Only raw actions (plus a separate draft) are trusted; derived state is rebuilt
 * by replaying actions through the pure engine, never read back from storage.
 */
export const ATTEMPT_SCHEMA_VERSION = 1;

export const storedActionSchema = z.object({
  id: z.string().min(1),
  at: z.string(),
  action: z.unknown(),
});
export type StoredAction = z.infer<typeof storedActionSchema>;

export const attemptSchema = z.object({
  schemaVersion: z.literal(ATTEMPT_SCHEMA_VERSION),
  attemptId: z.string().min(1),
  gameId: z.string().min(1),
  roundId: z.string().min(1),
  contentHash: z.string().min(1),
  rulesVersion: z.string().min(1),
  dictionaryVersion: z.string().nullable(),
  mode: z.enum(["gentle", "standard", "expert", "master"]),
  seed: z.number().int(),
  practice: z.boolean(),
  revision: z.number().int().nonnegative(),
  actions: z.array(storedActionSchema),
  draft: z.unknown().optional(),
  outcome: z.enum(["playing", "completed", "failed", "revealed", "abandoned"]),
  assisted: z.boolean(),
  summary: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type StoredAttempt = z.infer<typeof attemptSchema>;

export type RestoreResult<S> =
  | { status: "restored"; state: S; attempt: StoredAttempt }
  | { status: "corrupt"; reason: string }
  | { status: "version-mismatch"; reason: string; attempt: StoredAttempt };

export function sessionOptionsFor(round: RoundMeta, seed: number): SessionOptions {
  return {
    mode: round.difficulty,
    locale: "en-GB",
    rulesVersion: round.rulesVersion,
    dictionaryVersion: round.dictionaryVersion,
    seed,
  };
}

/** Validate a raw stored value and rebuild engine state by replaying its actions. */
export function restoreAttempt<R, S, A>(
  engine: GameEngine<R, S, A>,
  round: R,
  meta: RoundMeta,
  raw: unknown,
): RestoreResult<S> {
  const parsed = attemptSchema.safeParse(raw);
  if (!parsed.success) return { status: "corrupt", reason: "The saved attempt is not in a recognised format." };
  const attempt = parsed.data;
  if (attempt.gameId !== meta.gameId || attempt.roundId !== meta.id) {
    return { status: "corrupt", reason: "The saved attempt belongs to a different puzzle." };
  }
  if (
    attempt.contentHash !== meta.contentHash ||
    attempt.rulesVersion !== meta.rulesVersion ||
    attempt.dictionaryVersion !== meta.dictionaryVersion
  ) {
    return {
      status: "version-mismatch",
      reason: "This puzzle or its rules have been corrected since you saved. Your original attempt is kept.",
      attempt,
    };
  }
  let state = engine.initialise(round, sessionOptionsFor(meta, attempt.seed));
  const seen = new Set<string>();
  for (const stored of attempt.actions) {
    if (seen.has(stored.id)) continue; // idempotent replay
    seen.add(stored.id);
    const t = engine.apply(state, stored.action as A);
    if (!t.ok) {
      return { status: "corrupt", reason: `A saved move could not be replayed (${t.code}).` };
    }
    state = t.state;
  }
  if (engine.validateSnapshot) {
    const check = engine.validateSnapshot(state);
    if (!check.ok) return { status: "corrupt", reason: check.reason };
  }
  return { status: "restored", state, attempt };
}

export function newAttempt(meta: RoundMeta, attemptId: string, seed: number, practice: boolean, now: string): StoredAttempt {
  return {
    schemaVersion: ATTEMPT_SCHEMA_VERSION,
    attemptId,
    gameId: meta.gameId,
    roundId: meta.id,
    contentHash: meta.contentHash,
    rulesVersion: meta.rulesVersion,
    dictionaryVersion: meta.dictionaryVersion,
    mode: meta.difficulty,
    seed,
    practice,
    revision: 0,
    actions: [],
    outcome: "playing",
    assisted: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function withAction(attempt: StoredAttempt, action: StoredAction, outcome: Outcome, assisted: boolean, summary?: string): StoredAttempt {
  if (attempt.actions.some((a) => a.id === action.id)) return attempt; // idempotent commit
  return {
    ...attempt,
    actions: [...attempt.actions, action],
    revision: attempt.revision + 1,
    outcome,
    assisted: attempt.assisted || assisted,
    summary: summary ?? attempt.summary,
    updatedAt: action.at,
  };
}
