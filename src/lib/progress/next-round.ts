import { readIndex, readSeen } from "./storage";

export interface SiblingRound {
  id: string;
  title?: string;
  difficulty: string;
}

/** Round ids this player has already played (any move made), from the seen registry and the library index. */
export function playedRoundIds(gameId: string): Set<string> {
  const played = new Set(Object.keys(readSeen(gameId)));
  for (const e of readIndex()) if (e.gameId === gameId) played.add(e.roundId);
  return played;
}

/**
 * Choose the next round the player has NOT played, preferring the same difficulty.
 * Returns null with exhausted=true when every round has been played.
 */
export function nextPracticeRound(
  gameId: string,
  currentId: string | null,
  siblings: SiblingRound[],
  difficulty?: string,
): { next: SiblingRound | null; exhausted: boolean } {
  const played = playedRoundIds(gameId);
  if (currentId) played.add(currentId);
  const unseen = siblings.filter((s) => !played.has(s.id));
  const same = difficulty ? unseen.filter((s) => s.difficulty === difficulty) : [];
  const next = same[0] ?? unseen[0] ?? null;
  return { next, exhausted: next === null };
}

/** The played round that was played longest ago: the least repetitive thing to replay once everything is played. */
export function oldestPlayedRound(gameId: string, siblings: SiblingRound[]): SiblingRound | null {
  const seen = readSeen(gameId);
  const ranked = siblings.filter((s) => seen[s.id]).sort((a, b) => seen[a.id].localeCompare(seen[b.id]));
  return ranked[0] ?? siblings[0] ?? null;
}

export interface GameChoice {
  gameId: string;
  rounds: SiblingRound[];
}

/**
 * Pick a game and round for "Surprise me": only games with rounds the player has not played, and
 * of those the game played least recently (never-played games first), so the same game does not
 * come up twice in a row.
 */
export function pickFreshRound(games: GameChoice[], lastGameId?: string | null): { gameId: string; round: SiblingRound } | null {
  const candidates = games
    .map((g) => {
      const played = playedRoundIds(g.gameId);
      const unseen = g.rounds.filter((r) => !played.has(r.id));
      const seen = readSeen(g.gameId);
      const last = Object.values(seen).sort().at(-1) ?? "";
      return { gameId: g.gameId, unseen, last };
    })
    .filter((c) => c.unseen.length > 0);
  if (candidates.length === 0) return null;
  const others = candidates.filter((c) => c.gameId !== lastGameId);
  const pool = others.length ? others : candidates;
  pool.sort((a, b) => a.last.localeCompare(b.last));
  const top = pool.filter((c) => c.last === pool[0].last);
  const chosen = top[Math.floor(Math.random() * top.length)];
  return { gameId: chosen.gameId, round: chosen.unseen[Math.floor(Math.random() * chosen.unseen.length)] };
}
