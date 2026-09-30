import { rounds } from "./rounds";
import { fitsMultiset } from "@/lib/text";
import { loadFamiliarSync, loadMembershipSync } from "@/lib/dictionary/node";
import { scoreWord } from "./engine";

/**
 * Letter Wheel content checks: rack shape, required letter, every target/nine-letter answer
 * fits the rack, includes the centre, is accepted by membership, and practice targets are
 * familiar (SCOWL size 35). Demo fixtures must reproduce their stored maximumScore.
 */
export function validateContent(): string[] {
  const problems: string[] = [];
  const membership = loadMembershipSync();
  const familiar = loadFamiliarSync();
  const perDifficulty: Record<string, number> = {};
  for (const { meta, payload: p } of rounds) {
    const at = (f: string) => `${meta.id}.${f}`;
    perDifficulty[meta.difficulty] = (perDifficulty[meta.difficulty] ?? 0) + 1;
    if (p.letters.length !== 9) problems.push(`${at("letters")}: expected 9 letters`);
    if (!p.letters.every((l) => /^[A-Z]$/.test(l))) problems.push(`${at("letters")}: letters must be single A-Z`);
    if (p.requiredIndex < 0 || p.requiredIndex >= p.letters.length) problems.push(`${at("requiredIndex")}: out of range`);
    const req = p.letters[p.requiredIndex];
    if (p.targets.length < 8) problems.push(`${at("targets")}: fewer than 8 everyday targets`);
    if (new Set(p.targets).size !== p.targets.length) problems.push(`${at("targets")}: duplicates`);
    if (!p.nineLetterAnswers.length) problems.push(`${at("nineLetterAnswers")}: a nine-letter target is required`);
    for (const w of [...p.targets, ...p.nineLetterAnswers]) {
      if (w.length < p.minimumLength) problems.push(`${at("targets")}: ${w} shorter than minimum`);
      if (!w.includes(req)) problems.push(`${at("targets")}: ${w} lacks required ${req}`);
      if (!fitsMultiset(w, p.letters)) problems.push(`${at("targets")}: ${w} does not fit the rack`);
      if (meta.status !== "demo" && !membership.has(w)) problems.push(`${at("targets")}: ${w} not in membership`);
      if (meta.status !== "demo" && !familiar.has(w)) problems.push(`${at("targets")}: ${w} not in the familiar (size-35) layer`);
    }
    for (const w of p.nineLetterAnswers) if (w.length !== 9) problems.push(`${at("nineLetterAnswers")}: ${w} is not nine letters`);
    // Never display the nine-letter answer in reading order.
    if (meta.status !== "demo" && p.nineLetterAnswers.includes(p.letters.join(""))) problems.push(`${at("letters")}: display order spells the answer`);
    if (p.fixtureLexicon && p.fixtureMaximumScore != null) {
      const s = p.fixtureLexicon.reduce((acc, w) => acc + scoreWord(w), 0);
      if (s !== p.fixtureMaximumScore) problems.push(`${at("fixtureMaximumScore")}: stored ${p.fixtureMaximumScore}, recomputed ${s}`);
    }
    if (/[A-Z]{9}/.test(meta.title ?? "") || p.nineLetterAnswers.some((n) => meta.id.toUpperCase().includes(n))) problems.push(`${meta.id}: id/title may spoil the answer`);
  }
  for (const d of ["gentle", "standard", "expert"]) if (!perDifficulty[d]) problems.push(`no ${d} rounds`);
  return problems;
}
