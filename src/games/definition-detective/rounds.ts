import type { RoundBundle } from "../types";
import type { Difficulty, RoundStatus } from "@/lib/engine/types";
import { contentHash } from "@/lib/hash";
import { RULES_VERSION, type DetectivePayload } from "./engine";
import data from "./content/rounds.json";

interface RawRound {
  id: string;
  title: string;
  difficulty: Difficulty;
  status: RoundStatus;
  sourceFixtureId: string | null;
  payload: DetectivePayload;
}

/** Definitions are authored per round; no word-list membership is involved, so dictionaryVersion is null. */
export const rounds: RoundBundle<DetectivePayload>[] = (data.rounds as RawRound[]).map((r) => ({
  meta: {
    id: r.id,
    gameId: "definition-detective",
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
