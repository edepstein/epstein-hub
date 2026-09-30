import type { RoundBundle } from "../types";
import type { Difficulty, RoundStatus } from "@/lib/engine/types";
import { contentHash } from "@/lib/hash";
import { MEMBERSHIP_VERSION } from "@/lib/dictionary";
import { RULES_VERSION, type LinksPayload } from "./engine";
import data from "./content/rounds.json";

interface RawRound {
  id: string;
  title: string;
  difficulty: Difficulty;
  status: RoundStatus;
  sourceFixtureId: string | null;
  payload: LinksPayload;
}

export const rounds: RoundBundle<LinksPayload>[] = (data.rounds as RawRound[]).map((r) => ({
  meta: {
    id: r.id,
    gameId: "missing-links",
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
