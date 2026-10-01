import { rounds as allRounds } from "./rounds";
import type { RoundBundle } from "../types";
import type { CrosswordPayload } from "./engine";
import { deriveRuns, isConnected, isSymmetric, key, runCells } from "./grid";
import { verifyClue, enumerationLengths } from "../cryptic-workshop/construction";
import { loadMembershipSync } from "@/lib/dictionary/node";

/**
 * Grid validator. For every round: rectangular A-Z/# grid; the authored entries cover exactly
 * the derived runs (no one-letter entries, no missing or invented entries); every answer
 * equals the grid letters it covers, so every crossing agrees; every white cell is in an
 * entry; the white cells are connected; enumerations total the answer length; every answer
 * is a real word (ESDB membership); clues are present and never contain their answer.
 * Practice (non-demo) grids also follow the house style: 180-degree symmetry, entries of at
 * least three letters, at least half of each entry's letters checked, no repeated answers.
 * Cryptic grids run the Cryptic Workshop construction checker on every clue.
 */
export function validateRounds(rounds: RoundBundle<CrosswordPayload>[]): string[] {
  const problems: string[] = [];
  const membership = loadMembershipSync();
  const per: Record<string, Set<string>> = {};
  for (const { meta, payload: p } of rounds) {
    const at = (f: string) => `${meta.id}.${f}`;
    (per[meta.difficulty] ??= new Set()).add(p.style);
    const R = p.grid.length;
    const C = p.grid[0]?.length ?? 0;
    if (!R || !C) {
      problems.push(`${at("grid")}: empty`);
      continue;
    }
    if (p.grid.some((row) => row.length !== C)) problems.push(`${at("grid")}: rows must all have ${C} cells`);
    if (p.grid.some((row) => !/^[A-Z#]+$/.test(row))) problems.push(`${at("grid")}: cells must be A-Z or #`);
    const runs = deriveRuns(p.grid);
    const used = new Set<string>();
    const covered = new Set<string>();
    p.entries.forEach((e, i) => {
      const where = at(`entries[${i}]`);
      const run = runs.find((r) => r.direction === e.direction && r.row === e.row && r.col === e.col);
      if (!run) {
        problems.push(`${where}: ${e.direction} entry at row ${e.row}, col ${e.col} is not a run in the grid`);
        return;
      }
      if (used.has(`${e.direction}${e.row},${e.col}`)) problems.push(`${where}: duplicate entry for the same run`);
      used.add(`${e.direction}${e.row},${e.col}`);
      if (run.length !== e.answer.length) problems.push(`${where}: answer ${e.answer} has ${e.answer.length} letters but the run has ${run.length}`);
      const letters = runCells(run).map((c) => p.grid[c.row]?.[c.col] ?? "").join("");
      if (letters !== e.answer) problems.push(`${where}: answer ${e.answer} disagrees with grid letters ${letters}`);
      runCells(run).forEach((c) => covered.add(key(c.row, c.col)));
      const lens = enumerationLengths(e.enumeration);
      if (lens.some((n) => !Number.isInteger(n) || n < 1) || lens.reduce((a, b) => a + b, 0) !== e.answer.length) problems.push(`${where}.enumeration: "${e.enumeration}" does not total ${e.answer.length}`);
      if (lens.length === 1 && !membership.has(e.answer)) problems.push(`${where}: ${e.answer} is not in the word list`);
      if (!e.clue?.trim()) problems.push(`${where}.clue: missing`);
      if (/\(\d/.test(e.clue)) problems.push(`${where}.clue: must not include the enumeration`);
      if (e.clue.toUpperCase().replace(/[^A-Z ]/g, " ").split(/\s+/).includes(e.answer)) problems.push(`${where}.clue: contains its own answer`);
      if (p.style === "cryptic") {
        if (!e.cryptic) problems.push(`${where}: cryptic grids need a parse for every clue`);
        else problems.push(...verifyClue({ text: e.clue, answer: e.answer, enumeration: e.enumeration, ...e.cryptic }, where).problems);
      } else if (e.cryptic) problems.push(`${where}: quick grids must not carry cryptic parses`);
    });
    for (const r of runs) if (!used.has(`${r.direction}${r.row},${r.col}`)) problems.push(`${meta.id}: no entry for the ${r.direction} run at row ${r.row}, col ${r.col}`);
    p.grid.forEach((row, r) => [...row].forEach((ch, c) => ch !== "#" && !covered.has(key(r, c)) && problems.push(`${meta.id}: white cell row ${r}, col ${c} is in no entry`)));
    if (!isConnected(p.grid)) problems.push(`${meta.id}: white cells are not connected`);
    if (meta.status !== "demo") {
      if (!isSymmetric(p.grid)) problems.push(`${meta.id}: block pattern is not rotationally symmetric`);
      for (const e of p.entries) {
        if (e.answer.length < 3) problems.push(`${meta.id}: ${e.id} is shorter than three letters`);
        const cells = runCells({ ...e, length: e.answer.length });
        const checked = cells.filter((c) => p.entries.some((o) => o !== e && runCells({ ...o, length: o.answer.length }).some((x) => x.row === c.row && x.col === c.col))).length;
        if (checked * 2 < cells.length - 1) problems.push(`${meta.id}: ${e.id} has only ${checked} of ${cells.length} letters checked`);
      }
      const answers = p.entries.map((e) => e.answer);
      if (new Set(answers).size !== answers.length) problems.push(`${meta.id}: repeated answers`);
      if (answers.some((a) => (meta.title ?? "").toUpperCase().includes(a) || meta.id.toUpperCase().includes(a))) problems.push(`${meta.id}: id/title spoils an answer`);
    }
  }
  for (const d of ["gentle", "standard", "expert"]) {
    const n = rounds.filter((r) => r.meta.difficulty === d && r.meta.status !== "demo").length;
    if (n < 3) problems.push(`only ${n} authored ${d} grids; at least 3 required`);
    if (!per[d]?.has("quick") || !per[d]?.has("cryptic")) problems.push(`${d} needs both a quick and a cryptic grid`);
  }
  return problems;
}

export function validateContent(): string[] {
  return validateRounds(allRounds);
}
