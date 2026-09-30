import { readIndex } from "./storage";

export interface SiblingRound {
  id: string;
  title?: string;
  difficulty: string;
}

/**
 * Choose the next unseen practice round, preferring the same difficulty.
 * Returns null with exhausted=true when every round has been attempted.
 */
export function nextPracticeRound(
  gameId: string,
  currentId: string | null,
  siblings: SiblingRound[],
  difficulty?: string,
): { next: SiblingRound | null; exhausted: boolean } {
  const played = new Set(readIndex().filter((e) => e.gameId === gameId).map((e) => e.roundId));
  if (currentId) played.add(currentId);
  const unseen = siblings.filter((s) => !played.has(s.id));
  const same = difficulty ? unseen.filter((s) => s.difficulty === difficulty) : [];
  const next = same[0] ?? unseen[0] ?? null;
  return { next, exhausted: next === null };
}
