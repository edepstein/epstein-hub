import type { RoundBundle } from "../types";
import type { Difficulty, RoundStatus } from "@/lib/engine/types";
import { contentHash } from "@/lib/hash";
import { MEMBERSHIP_VERSION } from "@/lib/dictionary";
import { RULES_VERSION, type LadderPayload } from "./engine";
import data from "./content/rounds.json";

interface RawRound {
  id: string;
  title: string;
  difficulty: Difficulty;
  status: RoundStatus;
  sourceFixtureId: string | null;
  payload: LadderPayload;
}

export const rounds: RoundBundle<LadderPayload>[] = (data.rounds as unknown as RawRound[]).map((r) => ({
  meta: {
    id: r.id,
    gameId: "word-ladder",
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
