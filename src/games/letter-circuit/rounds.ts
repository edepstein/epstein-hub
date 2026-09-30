import type { RoundBundle } from "../types";
import type { Difficulty, RoundStatus } from "@/lib/engine/types";
import { contentHash } from "@/lib/hash";
import { MEMBERSHIP_VERSION } from "@/lib/dictionary";
import { RULES_VERSION, type CircuitPayload } from "./engine";
import data from "./content/rounds.json";

interface RawRound {
  id: string;
  title: string;
  difficulty: Difficulty;
  status: RoundStatus;
  sourceFixtureId: string | null;
  payload: CircuitPayload;
}

export const rounds: RoundBundle<CircuitPayload>[] = (data.rounds as RawRound[]).map((r) => ({
  meta: {
    id: r.id,
    gameId: "letter-circuit",
    title: r.title,
    difficulty: r.difficulty,
    status: r.status,
    rulesVersion: RULES_VERSION,
    dictionaryVersion: MEMBERSHIP_VERSION,
    sourceFixtureId: r.sourceFixtureId,
    contentHash: contentHash(r.payload),
  },
  payload: r.payload,
}));
