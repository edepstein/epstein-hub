import type { RoundBundle } from "../types";
import type { Difficulty, RoundStatus } from "@/lib/engine/types";
import { contentHash } from "@/lib/hash";
import { RULES_VERSION, type CrosswordPayload } from "./engine";
import data from "./content/rounds.json";

interface RawRound {
  id: string;
  title: string;
  difficulty: Difficulty;
  status: RoundStatus;
  sourceFixtureId: string | null;
  payload: CrosswordPayload;
}

/** Answers are authored per entry (not checked against a gameplay dictionary), so dictionaryVersion is null. */
export const rounds: RoundBundle<CrosswordPayload>[] = (data.rounds as RawRound[]).map((r) => ({
  meta: {
    id: r.id,
    gameId: "daily-crossword",
    title: r.title,
    difficulty: r.difficulty,
    status: r.status,
    rulesVersion: RULES_VERSION,
    dictionaryVersion: null,
    sourceFixtureId: r.sourceFixtureId,
    contentHash: contentHash(r.payload),
  },
  payload: r.payload,
}));
