import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { replayFixture, FIXTURE } from "./fixture";
import { LETTERS, RULE_SETS, totalTiles } from "./rules";
import fixtureCopy from "./content/fixture-1.0.json";
import configCopy from "./content/config-1.1-candidate.json";

/**
 * Shared Word Board content checks:
 *  - the module's copies of the pack fixture/config match the pack originals;
 *  - the three-turn fixture replays exactly under rules 1.0 (scores, words, draws, racks, totals);
 *  - each pinned rule set is internally consistent (tile totals, scores, premiums, anchor).
 */
export function validateContent(): string[] {
  const problems: string[] = [];
  const pack = (name: string) => join(process.cwd(), "reference/build-pack-v3/content", name);
  for (const [name, copy] of [
    ["shared-word-board.json", fixtureCopy],
    ["shared-word-board-config.json", configCopy],
  ] as const) {
    if (existsSync(pack(name)) && JSON.stringify(JSON.parse(readFileSync(pack(name), "utf8"))) !== JSON.stringify(copy))
      problems.push(`content copy of ${name} differs from the pack original`);
  }
  if (FIXTURE.rulesVersion !== "1.0") problems.push(`fixture ${FIXTURE.id}.rulesVersion: expected 1.0`);
  for (const p of replayFixture().problems) problems.push(`fixture ${FIXTURE.id}.${p}`);

  for (const rules of Object.values(RULE_SETS)) {
    const at = (f: string) => `rules ${rules.version}.${f}`;
    const [ar, ac] = rules.anchor;
    if (ar < 0 || ac < 0 || ar >= rules.boardSize || ac >= rules.boardSize) problems.push(`${at("anchor")}: off the board`);
    for (const l of LETTERS) if (!(rules.tileScores[l] >= 0)) problems.push(`${at("tileScores")}: ${l} has no score`);
    for (const l of Object.keys(rules.tileDistribution)) if (!LETTERS.includes(l)) problems.push(`${at("tileDistribution")}: ${l} is not A-Z`);
    const seen = new Set<string>();
    rules.premiumCells.forEach((p, i) => {
      if (p.row < 0 || p.column < 0 || p.row >= rules.boardSize || p.column >= rules.boardSize) problems.push(`${at(`premiumCells[${i}]`)}: off the board`);
      const k = `${p.row},${p.column}`;
      if (seen.has(k)) problems.push(`${at(`premiumCells[${i}]`)}: duplicate square`);
      seen.add(k);
    });
    if (totalTiles(rules) < rules.rackSize * rules.maxPlayers) problems.push(`${at("tileDistribution")}: too few tiles to deal ${rules.maxPlayers} racks`);
  }
  if (totalTiles(RULE_SETS["1.1-candidate"]) !== configCopy.totalTiles)
    problems.push(`rules 1.1-candidate.totalTiles: config says ${configCopy.totalTiles}, distribution sums to ${totalTiles(RULE_SETS["1.1-candidate"])}`);
  return problems;
}
