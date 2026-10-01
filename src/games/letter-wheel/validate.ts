import { rounds } from "./rounds";
import { fitsMultiset } from "@/lib/text";
import { loadFamiliarSync, loadMembershipSync, loadUncommonSync } from "@/lib/dictionary/node";
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
  const uncommon = loadUncommonSync();
  const racks = new Set<string>();
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
      if (meta.status !== "demo" && meta.difficulty !== "master" && !familiar.has(w)) problems.push(`${at("targets")}: ${w} not in the familiar (size-35) layer`);
      if (meta.difficulty === "master" && !familiar.has(w) && !uncommon.has(w)) problems.push(`${at("targets")}: ${w} is in neither the familiar nor the uncommon layer`);
    }
    for (const w of p.nineLetterAnswers) if (w.length !== 9) problems.push(`${at("nineLetterAnswers")}: ${w} is not nine letters`);
    // Never display the nine-letter answer in reading order.
    if (meta.status !== "demo" && p.nineLetterAnswers.includes(p.letters.join(""))) problems.push(`${at("letters")}: display order spells the answer`);
    const rackKey = [...p.letters].sort().join("");
    if (racks.has(rackKey) && meta.id !== "lw-e3") problems.push(`${meta.id}: duplicate rack ${rackKey}`);
    racks.add(rackKey);
    if (meta.difficulty === "master") {
      if (p.wordLabel !== "target") problems.push(`${at("wordLabel")}: Master rounds must say "target" words`);
      if (p.targets.length < 40 || p.targets.length > 90) problems.push(`${at("targets")}: Master needs 40 to 90 target words, has ${p.targets.length}`);
      if (!["J", "K", "V", "W", "Y", "Z", "X", "F", "H"].includes(req)) problems.push(`${at("requiredIndex")}: Master centre letter ${req} is not awkward`);
      if (p.targets.filter((w) => w.length === 9).length !== p.nineLetterAnswers.length) problems.push(`${at("nineLetterAnswers")}: must list every nine-letter target`);
      const rare = p.targets.filter((w) => !familiar.has(w) && w.length >= 4);
      const clued = Object.keys(p.clues ?? {});
      if (clued.length < 4) problems.push(`${at("clues")}: Master needs at least 4 definitions of rarer targets`);
      for (const w of rare.filter((x) => !/S$/.test(x) && !/ED$|ING$/.test(x)))
        if (!(p.clues ?? {})[w] && !p.targets.includes(w.slice(0, -1)) && !p.targets.includes(w.slice(0, -2)) && !p.targets.includes(w.slice(0, -3)))
          problems.push(`${at("clues")}: rarer target ${w} has no definition`);
    }
    for (const [w, c] of Object.entries(p.clues ?? {})) {
      if (!p.targets.includes(w)) problems.push(`${at("clues")}: ${w} is not a target`);
      if (c.toUpperCase().includes(w)) problems.push(`${at("clues")}: definition of ${w} contains the word`);
      if (c.includes("—")) problems.push(`${at("clues")}: em dash in definition of ${w}`);
    }
    if (p.fixtureLexicon && p.fixtureMaximumScore != null) {
      const s = p.fixtureLexicon.reduce((acc, w) => acc + scoreWord(w), 0);
      if (s !== p.fixtureMaximumScore) problems.push(`${at("fixtureMaximumScore")}: stored ${p.fixtureMaximumScore}, recomputed ${s}`);
    }
    if (/[A-Z]{9}/.test(meta.title ?? "") || p.nineLetterAnswers.some((n) => meta.id.toUpperCase().includes(n))) problems.push(`${meta.id}: id/title may spoil the answer`);
  }
  for (const d of ["gentle", "standard", "expert"]) if (!perDifficulty[d]) problems.push(`no ${d} rounds`);
  if ((perDifficulty.expert ?? 0) < 22) problems.push("fewer than 22 expert rounds");
  if ((perDifficulty.master ?? 0) < 14) problems.push("fewer than 14 master rounds");
  return problems;
}
