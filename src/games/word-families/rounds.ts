import type { RoundBundle } from "../types";
import type { Difficulty, RoundStatus } from "@/lib/engine/types";
import { contentHash } from "@/lib/hash";
import type { GroupRule } from "./candidates";
import { RULES_VERSION, type FamiliesPayload, type RedHerring } from "./engine";
import data from "./content/rounds.json";

export interface RawFamiliesRound {
  id: string;
  title: string;
  difficulty: Difficulty;
  status: RoundStatus;
  sourceFixtureId: string | null;
  mistakeBudget: number;
  continueAfterBudget: boolean;
  /** Pack fixtures keep their authored display order; practice rounds interleave groups. */
  displayOrder?: string[];
  groups: { label: string; terms: string[]; explanation: string; rule?: GroupRule }[];
  explanation: string;
  redHerrings: RedHerring[];
  fixtureHints?: unknown[];
}

/** Authored order that never shows a group together: one term from each group in turn. */
function interleave(groups: RawFamiliesRound["groups"]): string[] {
  const out: string[] = [];
  const size = Math.max(...groups.map((g) => g.terms.length));
  for (let i = 0; i < size; i++) for (let g = 0; g < groups.length; g++) if (groups[(g + i) % groups.length].terms[i]) out.push(groups[(g + i) % groups.length].terms[i]);
  return out;
}

/**
 * Convert authored labels into persistent term identifiers (t01, t02, ...) that are
 * independent of the displayed text, so normalisation can never merge two tiles.
 */
export function toPayload(r: RawFamiliesRound): FamiliesPayload {
  const order = r.displayOrder ?? interleave(r.groups);
  const terms = order.map((label, i) => ({ id: `t${String(i + 1).padStart(2, "0")}`, label }));
  const idOf = (label: string) => terms.find((t) => t.label === label)?.id ?? `missing:${label}`;
  return {
    terms,
    groups: r.groups.map((g, i) => ({ id: `g${i + 1}`, label: g.label, termIds: g.terms.map(idOf), explanation: g.explanation })),
    mistakeBudget: r.mistakeBudget,
    continueAfterBudget: r.continueAfterBudget,
    explanation: r.explanation,
    redHerrings: r.redHerrings,
    ...(r.fixtureHints ? { fixtureHints: r.fixtureHints } : {}),
  };
}

export const rawRounds = data.rounds as RawFamiliesRound[];

export const rounds: RoundBundle<FamiliesPayload>[] = rawRounds.map((r) => {
  const payload = toPayload(r);
  return {
    meta: {
      id: r.id,
      gameId: "word-families",
      title: r.title,
      difficulty: r.difficulty,
      status: r.status,
      rulesVersion: RULES_VERSION,
      // Tiles are authored terms (FULL STOP is one tile), not dictionary-validated input.
      dictionaryVersion: null,
      sourceFixtureId: r.sourceFixtureId,
      contentHash: contentHash(payload),
    },
    payload,
  };
});
