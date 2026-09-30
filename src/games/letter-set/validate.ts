import { rounds } from "./rounds";
import { loadFamiliarSync, loadMembershipSync } from "@/lib/dictionary/node";
import { fitsSet, scoreWord, usesAllLetters } from "./engine";

/**
 * Letter Set content checks (games/letter-set.md "Content and solver"):
 * seven different A-Z letters including the required one; every target fits the set, has the
 * required letter and minimum length; allLetterTargets equals the computed coverage set; every
 * target has an original definition that does not contain the word; practice targets are in
 * membership and the familiar (size-35) layer; each board has at least one all-letter target;
 * demo fixtures reproduce their stored maximumScore and allLetterAnswers.
 */
export function validateContent(): string[] {
  const problems: string[] = [];
  const membership = loadMembershipSync();
  const familiar = loadFamiliarSync();
  const perDifficulty: Record<string, number> = {};
  const boards = new Set<string>();
  for (const { meta, payload: p } of rounds) {
    const at = (f: string) => `${meta.id}.${f}`;
    perDifficulty[meta.difficulty] = (perDifficulty[meta.difficulty] ?? 0) + 1;
    if (p.letters.length !== 7) problems.push(`${at("letters")}: expected 7 letters`);
    if (new Set(p.letters).size !== p.letters.length) problems.push(`${at("letters")}: letters must be different`);
    if (!p.letters.every((l) => /^[A-Z]$/.test(l))) problems.push(`${at("letters")}: letters must be single A-Z`);
    if (!p.letters.includes(p.required)) problems.push(`${at("required")}: ${p.required} is not one of the letters`);
    const key = `${[...p.letters].sort().join("")}:${p.required}`;
    if (boards.has(key)) problems.push(`${meta.id}: duplicate board ${key}`);
    boards.add(key);
    const words = p.targets.map((t) => t.word);
    if (new Set(words).size !== words.length) problems.push(`${at("targets")}: duplicates`);
    if (meta.status !== "demo" && words.length < 15) problems.push(`${at("targets")}: fewer than 15 everyday targets`);
    p.targets.forEach((t, i) => {
      const w = t.word;
      const f = `targets[${i}]`;
      if (!/^[A-Z]+$/.test(w)) problems.push(`${at(f)}: ${w} must be upper-case A-Z`);
      if (w.length < p.minimumLength) problems.push(`${at(f)}: ${w} shorter than minimum`);
      if (!w.includes(p.required)) problems.push(`${at(f)}: ${w} lacks required ${p.required}`);
      if (!fitsSet(w, p.letters)) problems.push(`${at(f)}: ${w} uses a letter outside the set`);
      if (!t.clue || t.clue.length < 6) problems.push(`${at(f)}.clue: missing definition for ${w}`);
      if (t.clue && t.clue.toUpperCase().includes(w)) problems.push(`${at(f)}.clue: definition of ${w} contains the word`);
      if (/—/.test(t.clue)) problems.push(`${at(f)}.clue: em dash in user-facing copy`);
      if (meta.status !== "demo" && !membership.has(w)) problems.push(`${at(f)}: ${w} not in membership`);
      if (meta.status !== "demo" && !familiar.has(w)) problems.push(`${at(f)}: ${w} not in the familiar (size-35) layer`);
    });
    const computedAll = words.filter((w) => usesAllLetters(w, p.letters));
    if ([...computedAll].sort().join() !== [...p.allLetterTargets].sort().join())
      problems.push(`${at("allLetterTargets")}: stored ${p.allLetterTargets.join("/")}, computed ${computedAll.join("/")}`);
    if (!computedAll.length) problems.push(`${at("allLetterTargets")}: at least one everyday all-letter word is required`);
    if (p.fixtureLexicon) {
      if (p.fixtureMaximumScore != null) {
        const s = p.fixtureLexicon.reduce((acc, w) => acc + scoreWord(w, p.letters), 0);
        if (s !== p.fixtureMaximumScore) problems.push(`${at("fixtureMaximumScore")}: stored ${p.fixtureMaximumScore}, recomputed ${s}`);
      }
      const fixAll = p.fixtureLexicon.filter((w) => usesAllLetters(w, p.letters));
      if (p.fixtureAllLetterAnswers && [...fixAll].sort().join() !== [...p.fixtureAllLetterAnswers].sort().join())
        problems.push(`${at("fixtureAllLetterAnswers")}: stored ${p.fixtureAllLetterAnswers.join("/")}, computed ${fixAll.join("/")}`);
    }
    const title = (meta.title ?? "").toUpperCase();
    if (p.allLetterTargets.some((w) => title.includes(w) || meta.id.toUpperCase().includes(w))) problems.push(`${meta.id}: id/title may spoil the answer`);
    if (meta.status !== "demo" && p.allLetterTargets.includes(p.letters.join(""))) problems.push(`${at("letters")}: display order spells the answer`);
  }
  for (const d of ["gentle", "standard", "expert"]) if (!perDifficulty[d]) problems.push(`no ${d} rounds`);
  return problems;
}
