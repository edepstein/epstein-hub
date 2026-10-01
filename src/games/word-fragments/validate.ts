import { loadFamiliarSync, loadMembershipSync } from "@/lib/dictionary/node";
import { rounds } from "./rounds";
import { checkFragmentsRound } from "./validate-core";

export { acceptedTextAllocations, checkFragmentsRound, rivalBoards } from "./validate-core";

/** Answers the original expert boards deliberately reuse (repeated words are the puzzle); new rounds may not repeat any answer. */
const LEGACY_REPEATS = new Set(["CARPET", "BUTTERFLY", "CUPBOARD", "TEAPOT"]);

export function validateContent(): string[] {
  const membership = loadMembershipSync();
  const familiar = loadFamiliarSync();
  const problems: string[] = [];
  const perDifficulty: Record<string, number> = {};
  const seen = new Set<string>();
  const answers = new Set<string>();
  for (const { meta, payload } of rounds) {
    if (seen.has(meta.id)) problems.push(`${meta.id}: duplicate round id`);
    seen.add(meta.id);
    perDifficulty[meta.difficulty] = (perDifficulty[meta.difficulty] ?? 0) + 1;
    if (meta.status === "demo" && !meta.sourceFixtureId) problems.push(`${meta.id}: demo round without sourceFixtureId`);
    problems.push(...checkFragmentsRound(meta, payload, membership, familiar));
    for (const w of Object.values(payload.acceptedAnswers).flat()) {
      if (answers.has(w) && !LEGACY_REPEATS.has(w)) problems.push(`${meta.id}: answer ${w} repeats an answer in another round`);
      answers.add(w);
    }
  }
  for (const d of ["gentle", "standard", "expert"]) if ((perDifficulty[d] ?? 0) < 14) problems.push(`fewer than 14 rounds at ${d}`);
  const expertDup = rounds.filter((r) => r.meta.difficulty === "expert" && new Set(r.payload.tiles.map((t) => t.text)).size < r.payload.tiles.length).length;
  if (expertDup < 3) problems.push("expert rounds should include duplicate-text fragments");
  return problems;
}
