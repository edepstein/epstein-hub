/**
 * Shared pure-engine contract (docs/08 "Pure engine API").
 *
 * Engines are plain TypeScript: no React, no DOM, no Math.random, no Date.now.
 * Game modules define their own Round/State/Action/Draft/Feedback types and
 * implement this interface. The shared session layer persists the raw action
 * log and rebuilds state by replaying it through `apply`, so any action that
 * the engine accepted once must be accepted again on replay (determinism).
 */

export type Difficulty = "gentle" | "standard" | "expert";
export const DIFFICULTIES: readonly Difficulty[] = ["gentle", "standard", "expert"] as const;
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  gentle: "Gentle",
  standard: "Standard",
  expert: "Expert",
};

/** Lifecycle of authored content. Only `published` may appear as a daily edition. */
export type RoundStatus =
  | "demo" // original pack fixture, regression input, playable as practice
  | "practice" // authored for this build, validated, not editorially reviewed
  | "draft"
  | "validated"
  | "reviewed"
  | "scheduled"
  | "published"
  | "withdrawn";

/** Metadata every round carries regardless of game. */
export interface RoundMeta {
  id: string;
  gameId: string;
  title?: string;
  difficulty: Difficulty;
  status: RoundStatus;
  rulesVersion: string;
  dictionaryVersion: string | null;
  /** Original fixture ID from the build pack when imported, else null. */
  sourceFixtureId: string | null;
  /** Stable hash of the round payload; attempts are pinned to it. */
  contentHash: string;
  /** Europe/London edition date for published dailies; null for practice. */
  editionDate?: string | null;
}

export interface SessionOptions {
  mode: Difficulty;
  locale: "en-GB";
  rulesVersion: string;
  dictionaryVersion: string | null;
  /** Seed for any randomness the engine needs (e.g. shuffles, bag order). */
  seed: number;
}

export interface ScoreLine {
  label: string;
  points: number;
}

export interface ScoreBreakdown {
  lines: ScoreLine[];
  total: number;
}

/** Non-mutating analysis of a draft. */
export interface Analysis<F = unknown> {
  legal: boolean;
  /** Stable machine code, e.g. "too-short", "missing-required", "ok". */
  code: string;
  /** Human, UK English explanation suitable for a live region. */
  message: string;
  score?: ScoreBreakdown;
  feedback?: F;
}

export interface GameEvent {
  type: string;
  message?: string;
}

/** Result of `apply`. When ok=false the returned state MUST be the input state (atomic rejection). */
export interface Transition<S, F = unknown> {
  ok: boolean;
  state: S;
  code: string;
  message: string;
  events: GameEvent[];
  feedback?: F;
  score?: ScoreBreakdown;
}

export type HintTier = number;

export interface HintOffer {
  tier: HintTier;
  /** Short name, e.g. "First letter". */
  label: string;
  /** Says exactly what will be revealed BEFORE the player commits. */
  description: string;
  available: boolean;
  /** Why unavailable, if not available. */
  reason?: string;
  /** Whether taking it counts as a full reveal (vs a nudge). */
  reveal: boolean;
  /** Effect on scoring, stated plainly (e.g. "The revealed word scores 0"). */
  cost?: string;
}

export type Outcome = "playing" | "completed" | "failed" | "revealed" | "abandoned";

export interface ResultSummary {
  outcome: Exclude<Outcome, "playing">;
  headline: string;
  /** e.g. "34 of 56 points" */
  scoreText?: string;
  score?: number;
  maxScore?: number;
  /** 0..1 where meaningful (moves vs optimum, etc.) */
  efficiency?: number | null;
  assistance: { hints: number; reveals: number };
  /** Bullet points explaining what was achieved, assisted and left unexplored. */
  details: string[];
  /** Spoiler-free text suitable for sharing. */
  shareText: string;
  /** Explanation of the solution; shown after completion. May contain answers. */
  explanation?: string[];
}

export type SnapshotCheck<S> = { ok: true; state: S } | { ok: false; reason: string };

export interface GameEngine<R, S, A, P = unknown, F = unknown> {
  readonly gameId: string;
  readonly rulesVersion: string;
  initialise(round: R, options: SessionOptions): S;
  preview(state: S, draft: P): Analysis<F>;
  apply(state: S, action: A): Transition<S, F>;
  /** Hint ladder for the current state. Taking a hint is an action the engine applies. */
  hints(state: S): HintOffer[];
  /** Null while playing. May return a result for a finished game. */
  result(state: S): ResultSummary | null;
  /** Current outcome, used by the library/index. */
  outcome(state: S): Outcome;
  /**
   * Optional extra validation of a rebuilt state (the session layer already
   * rejects snapshots whose actions fail to replay).
   */
  validateSnapshot?(snapshot: unknown): SnapshotCheck<S>;
}

/** Convenience helper for engines: reject atomically. */
export function reject<S, F = unknown>(state: S, code: string, message: string, feedback?: F): Transition<S, F> {
  return { ok: false, state, code, message, events: [{ type: "rejected", message }], feedback };
}

export function accept<S, F = unknown>(
  state: S,
  code: string,
  message: string,
  extra: Partial<Omit<Transition<S, F>, "ok" | "state" | "code" | "message">> = {},
): Transition<S, F> {
  return { ok: true, state, code, message, events: extra.events ?? [{ type: code, message }], feedback: extra.feedback, score: extra.score };
}
