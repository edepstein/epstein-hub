import type { RoundBundle } from "../types";
import type { Difficulty, RoundStatus } from "@/lib/engine/types";
import { contentHash } from "@/lib/hash";
import { RULES_VERSION, type ClueCard, type CluePairsPayload } from "./engine";
import data from "./content/rounds.json";

export interface RawCluePairsRound {
  id: string;
  title: string;
  difficulty: Difficulty;
  status: RoundStatus;
  sourceFixtureId: string | null;
  cards: ClueCard[];
  explanation: string;
  fixtureHints?: string[];
}

export const rawRounds = data.rounds as RawCluePairsRound[];

export const rounds: RoundBundle<CluePairsPayload>[] = rawRounds.map((r) => {
  const payload: CluePairsPayload = {
    cards: r.cards,
    explanation: r.explanation,
    ...(r.fixtureHints ? { fixtureHints: r.fixtureHints } : {}),
  };
  return {
    meta: {
      id: r.id,
      gameId: "clue-pairs",
      title: r.title,
      difficulty: r.difficulty,
      status: r.status,
      rulesVersion: RULES_VERSION,
      // Answers are checked against the authored accepted list only, not the word list.
      dictionaryVersion: null,
      sourceFixtureId: r.sourceFixtureId,
      contentHash: contentHash(payload),
    },
    payload,
  };
});
