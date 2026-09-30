import type { RoundBundle } from "../types";

/**
 * Shared Word Board is a match game: players start a fresh seeded match at
 * /play/shared-word-board/match rather than choosing authored rounds, so no round bundles are
 * listed here. The pack's deterministic three-turn fixture (content/fixture-1.0.json, rules 1.0)
 * is kept as regression data: it is replayed exactly by the engine tests and by validate.ts.
 */
export const rounds: RoundBundle[] = [];
