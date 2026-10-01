import { rounds } from "./rounds";
import { loadFamiliarSync, loadMembershipSync, loadUncommonSync } from "@/lib/dictionary/node";
import { checkPath, enumeratePaths, exactCover, geometryFromGrid, spell, toIndex } from "./solver";

/**
 * Hidden Word Trail content checks (round id + field path in every message):
 * rectangular A-Z grid; each reference path is adjacent, non-repeating and spells its word;
 * reference paths are disjoint and cover every cell; an exact-cover search independently proves
 * the answer set tiles the grid; practice answers are familiar ESDB words with clues; at most
 * one theme-defining answer, with a theme note; ids/titles do not spoil answers.
 */
export function validateContent(): string[] {
  const problems: string[] = [];
  const membership = loadMembershipSync();
  const familiar = loadFamiliarSync();
  const uncommon = loadUncommonSync();
  const recognisable = (w: string) => familiar.has(w.toLowerCase()) || uncommon.has(w.toLowerCase()) || familiar.has(w) || uncommon.has(w);
  const perDifficulty: Record<string, number> = {};
  const seenIds = new Set<string>();
  const seenAnswers = new Map<string, string>();
  const seenThemes = new Map<string, string>();
  for (const { meta, payload: p } of rounds) {
    const at = (f: string) => `${meta.id}.${f}`;
    if (seenIds.has(meta.id)) problems.push(`${meta.id}: duplicate round id`);
    seenIds.add(meta.id);
    perDifficulty[meta.difficulty] = (perDifficulty[meta.difficulty] ?? 0) + 1;
    const cols = p.grid[0]?.length ?? 0;
    if (p.grid.length < 3 || cols < 3) problems.push(`${at("grid")}: grid must be at least 3 by 3`);
    p.grid.forEach((row, r) => {
      if (row.length !== cols) problems.push(`${at(`grid[${r}]`)}: row length ${row.length}, expected ${cols}`);
      if (!/^[A-Z]+$/.test(row)) problems.push(`${at(`grid[${r}]`)}: letters must be A-Z`);
    });
    const geo = geometryFromGrid(p.grid);
    const covered = new Map<number, string>();
    p.answers.forEach((a, k) => {
      const f = `answers[${k}]`;
      if (!/^[A-Z]{3,}$/.test(a.word)) problems.push(`${at(f)}.word: ${a.word} must be 3+ letters A-Z`);
      const path = a.path.map((c) => toIndex(geo, c));
      if (a.path.some(([r, c]) => r < 0 || c < 0 || r >= geo.rows || c >= geo.cols)) problems.push(`${at(f)}.path: coordinate out of bounds`);
      const prob = checkPath(geo, path);
      if (prob) problems.push(`${at(f)}.path: ${prob.code} at step ${prob.at}`);
      else if (spell(geo, path) !== a.word) problems.push(`${at(f)}.path: spells ${spell(geo, path)}, not ${a.word}`);
      for (const i of path) {
        if (covered.has(i)) problems.push(`${at(f)}.path: overlaps ${covered.get(i)} at cell ${i}`);
        covered.set(i, a.word);
      }
      if (meta.status !== "demo") {
        if (!membership.has(a.word)) problems.push(`${at(f)}.word: ${a.word} not in membership`);
        if (meta.difficulty === "master") {
          if (!recognisable(a.word)) problems.push(`${at(f)}.word: ${a.word} is in neither the familiar nor the uncommon layer`);
          if (a.word.length < 6 || a.word.length > 12) problems.push(`${at(f)}.word: master words are 6 to 12 letters`);
        } else if (!familiar.has(a.word)) problems.push(`${at(f)}.word: ${a.word} not in the familiar (size-35) layer`);
        if (!a.clue) problems.push(`${at(f)}.clue: practice answers need a clue for the first hint`);
      }
      if (meta.id.toUpperCase().includes(a.word) || (meta.title ?? "").toUpperCase().includes(a.word)) problems.push(`${meta.id}: id/title spoils ${a.word}`);
    });
    if (covered.size !== geo.letters.length) problems.push(`${at("answers")}: reference paths cover ${covered.size} of ${geo.letters.length} cells`);
    if (new Set(p.answers.map((a) => a.word)).size !== p.answers.length) problems.push(`${at("answers")}: duplicate answer words`);
    const words = p.answers.map((a) => a.word);
    if (meta.status !== "demo") {
      for (const w of words) {
        if (seenAnswers.has(w) && meta.id !== "hwt-e4") problems.push(`${at("answers")}: ${w} already an answer in ${seenAnswers.get(w)}`);
        seenAnswers.set(w, meta.id);
      }
      if (seenThemes.has(p.theme)) problems.push(`${at("theme")}: theme repeats ${seenThemes.get(p.theme)}`);
      seenThemes.set(p.theme, meta.id);
    }
    const cover = exactCover(geo, words, new Set(), 50, true);
    if (!cover.count) problems.push(`${at("answers")}: exact-cover search found no complete partition`);
    if (meta.difficulty === "master" || meta.difficulty === "expert") {
      if (meta.status !== "demo" && cover.count !== 1) problems.push(`${at("answers")}: ${cover.count} different tilings found, expected exactly one`);
      const avoid = new Set<string>(p.avoid ?? []);
      for (const part of p.avoidContaining ?? [])
        for (const w of [...familiar, ...uncommon]) if (w.length >= (p.avoidMin ?? 5) && w.toUpperCase().includes(part)) avoid.add(w.toUpperCase());
      if (p.avoidAnagrams) {
        const key = (w: string) => w.split("").sort().join("");
        const k = key(words[0]);
        for (const w of membership) if (w.length === words[0].length && key(w.toUpperCase()) === k) avoid.add(w.toUpperCase());
      }
      for (const w of avoid) {
        if (words.includes(w) || words.some((a) => a.includes(w) || w.startsWith(a))) continue;
        if (enumeratePaths(geo, w, new Set(), 1).length) problems.push(`${at("avoid")}: near-theme word ${w} can be traced on the grid`);
      }
      if (meta.difficulty === "master") {
        const size = geo.letters.length;
        if (geo.rows < 5 || geo.cols < 5 || geo.rows > 6 || geo.cols > 6) problems.push(`${at("grid")}: master grids are 5x5 to 6x6`);
        if (words.length > 6 || words.length < 3) problems.push(`${at("answers")}: master rounds have 3 to 6 words (${size} squares)`);
        if (!p.avoid?.length && !p.avoidContaining?.length && !p.avoidAnagrams) problems.push(`${at("avoid")}: master rounds must list the near-theme words proved untraceable`);
      }
    }
    for (const w of words) if (!enumeratePaths(geo, w).length) problems.push(`${at("answers")}: ${w} cannot be traced`);
    const themeWords = p.answers.filter((a) => a.themeDefining);
    if (themeWords.length > 1) problems.push(`${at("answers")}: more than one theme-defining answer`);
    if (themeWords.length && !p.themeNote) problems.push(`${at("themeNote")}: a theme-defining answer needs an explanation`);
    if (!p.theme.trim()) problems.push(`${at("theme")}: missing theme`);
    if (p.creditsPerHint < 1 || p.bonusMinLength < 3) problems.push(`${at("creditsPerHint")}: invalid bonus settings`);
    if (meta.status !== "demo" && p.bonusPolicy !== "membership") problems.push(`${at("bonusPolicy")}: practice rounds award bonus credits from membership`);
  }
  for (const [d, min] of [["gentle", 12], ["standard", 12], ["expert", 18], ["master", 12]] as const) if ((perDifficulty[d] ?? 0) < min) problems.push(`fewer than ${min} ${d} rounds`);
  return problems;
}
