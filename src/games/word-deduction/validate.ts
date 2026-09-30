import { rounds } from "./rounds";
import { loadFamiliarSync, loadMembershipSync } from "@/lib/dictionary/node";
import { scoreGuess, WORD_LENGTH } from "./engine";

/**
 * Word Deduction content checks: five-letter A-Z answers in membership, practice answers in the
 * familiar (size-35) layer and not obvious plurals, distinct answers across the bank, a definition
 * for every answer, hard mode exactly on Expert rounds, no spoiling ids/titles, and demo fixtures'
 * stored feedback reproduced by the two-pass algorithm.
 */
export function validateContent(): string[] {
  const problems: string[] = [];
  const membership = loadMembershipSync();
  const familiar = loadFamiliarSync();
  const perDifficulty: Record<string, number> = {};
  const seen = new Map<string, string>();
  for (const { meta, payload: p } of rounds) {
    const at = (f: string) => `${meta.id}.${f}`;
    perDifficulty[meta.difficulty] = (perDifficulty[meta.difficulty] ?? 0) + 1;
    if (!new RegExp(`^[A-Z]{${WORD_LENGTH}}$`).test(p.answer)) problems.push(`${at("answer")}: must be ${WORD_LENGTH} upper-case letters A-Z`);
    if (!membership.has(p.answer)) problems.push(`${at("answer")}: ${p.answer} is not in gameplay membership`);
    if (meta.status !== "demo" && !familiar.has(p.answer)) problems.push(`${at("answer")}: ${p.answer} is not in the familiar (size-35) layer`);
    if (meta.status !== "demo" && /[^S]S$/.test(p.answer)) problems.push(`${at("answer")}: ${p.answer} looks like a plural; curated answers are base forms`);
    const prev = seen.get(p.answer);
    if (prev) problems.push(`${at("answer")}: duplicates the answer of ${prev}`);
    seen.set(p.answer, meta.id);
    if (!Number.isInteger(p.guessLimit) || p.guessLimit !== 6) problems.push(`${at("guessLimit")}: rounds use six guesses`);
    if (!p.definition || p.definition.length < 8 || !/[.]$/.test(p.definition)) problems.push(`${at("definition")}: needs a short sentence ending in a full stop`);
    if (p.definition.includes("—")) problems.push(`${at("definition")}: no em dashes in player copy`);
    if (p.hardMode !== (meta.difficulty === "expert")) problems.push(`${at("hardMode")}: hard mode must be on for Expert rounds only`);
    if (meta.id.toUpperCase().includes(p.answer) || (meta.title ?? "").toUpperCase().includes(p.answer)) problems.push(`${meta.id}: id/title spoils the answer`);
    for (const t of p.fixtureFeedback ?? []) {
      const got = scoreGuess(t.guess, p.answer).join(",");
      if (got !== t.expectedFeedback.join(",")) problems.push(`${at("fixtureFeedback")}: ${t.guess} expected ${t.expectedFeedback.join(",")} got ${got}`);
    }
    if (meta.status === "demo" && !meta.sourceFixtureId) problems.push(`${at("sourceFixtureId")}: demo rounds keep their fixture id`);
  }
  for (const d of ["gentle", "standard", "expert"]) if ((perDifficulty[d] ?? 0) < 4) problems.push(`fewer than 4 ${d} rounds`);
  return problems;
}
