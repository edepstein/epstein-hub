/**
 * Pinned rule sets for Shared Word Board.
 *
 * Two rule sets exist side by side and are NEVER interchangeable (pack docs/07):
 *  - "1.0": the uniform fixture rules. 9x9, seven-tile racks, one point per letter, no blanks,
 *    no premium squares. Its tile set is exactly the 32 letters of the pack fixture (both opening
 *    racks plus the fixture bag), so the pack's three-turn fixture replays exactly.
 *  - "1.1-candidate": the pack's proposed premium/tile configuration (91 letters + 2 blanks,
 *    letter values, four double-word and four triple-letter squares). Balance review pending.
 *
 * A match records its rules version and the hash of the rule set; a saved match is only ever
 * replayed under the identical rule set.
 */
import { contentHash } from "@/lib/hash";
import config11 from "./content/config-1.1-candidate.json";
import fixture from "./content/fixture-1.0.json";

export type RulesVersion = "1.0" | "1.1-candidate";
export const RULES_VERSIONS: readonly RulesVersion[] = ["1.0", "1.1-candidate"] as const;

export type PremiumKind = "double-word" | "triple-word" | "double-letter" | "triple-letter";

export interface PremiumCell {
  row: number;
  column: number;
  kind: PremiumKind;
}

export interface RuleSet {
  version: RulesVersion;
  label: string;
  boardSize: number;
  /** [row, column], zero-based. */
  anchor: [number, number];
  rackSize: number;
  minimumWordLength: number;
  /** Letter -> number of tiles of that letter. */
  tileDistribution: Record<string, number>;
  blankCount: number;
  tileScores: Record<string, number>;
  blankScore: number;
  premiumCells: PremiumCell[];
  sevenTileBonus: number;
  /**
   * The pack's six-turn pass/exchange threshold is written for two players. It is generalised as
   * three full rounds of consecutive passes/exchanges: 3 x active players (6 for two players).
   */
  passOrExchangeRoundsToEnd: number;
  exchangeAllowedWithBagMinimum: number;
  minPlayers: number;
  maxPlayers: number;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function fixtureDistribution(): Record<string, number> {
  const cfg = fixture.rounds[0].configuration;
  const all = [...cfg.initialRacks.p1, ...cfg.initialRacks.p2, ...cfg.initialBagDrawOrder];
  const out: Record<string, number> = {};
  for (const l of all) out[l] = (out[l] ?? 0) + 1;
  return out;
}

export const RULES_1_0: RuleSet = Object.freeze({
  version: "1.0",
  label: "1.0 · uniform fixture rules (short match, 32 tiles)",
  boardSize: fixture.rounds[0].configuration.boardSize,
  anchor: fixture.rounds[0].configuration.anchor as [number, number],
  rackSize: fixture.rounds[0].configuration.rackSize,
  minimumWordLength: fixture.rounds[0].configuration.minimumWordLength,
  tileDistribution: fixtureDistribution(),
  blankCount: fixture.rounds[0].configuration.blankTiles,
  tileScores: fixture.rounds[0].configuration.tileScores as Record<string, number>,
  blankScore: 0,
  premiumCells: [],
  sevenTileBonus: 0,
  passOrExchangeRoundsToEnd: fixture.rounds[0].configuration.passOrExchangeEndThreshold / 2,
  exchangeAllowedWithBagMinimum: fixture.rounds[0].configuration.exchangeAllowedWithBagMinimum,
  minPlayers: 2,
  maxPlayers: 4,
}) as RuleSet;

export const RULES_1_1_CANDIDATE: RuleSet = Object.freeze({
  version: "1.1-candidate",
  label: "1.1 candidate · proposed premiums and letter values (not yet balanced)",
  boardSize: config11.boardSize,
  anchor: config11.anchor as [number, number],
  rackSize: config11.rackSize,
  minimumWordLength: config11.minimumWordLength,
  tileDistribution: config11.tileDistribution as Record<string, number>,
  blankCount: config11.blankCount,
  tileScores: config11.tileScores as Record<string, number>,
  blankScore: config11.blankScore,
  premiumCells: config11.premiumCells as PremiumCell[],
  sevenTileBonus: config11.sevenTileBonus,
  passOrExchangeRoundsToEnd: config11.passOrExchangeEndThreshold / 2,
  exchangeAllowedWithBagMinimum: config11.exchangeAllowedWithBagMinimum,
  minPlayers: 2,
  maxPlayers: 4,
}) as RuleSet;

export const RULE_SETS: Record<RulesVersion, RuleSet> = {
  "1.0": RULES_1_0,
  "1.1-candidate": RULES_1_1_CANDIDATE,
};

export function isRulesVersion(v: unknown): v is RulesVersion {
  return v === "1.0" || v === "1.1-candidate";
}

export function getRuleSet(version: RulesVersion): RuleSet {
  return RULE_SETS[version];
}

/** Hash pinned into every match so a changed rule set can never silently reinterpret a save. */
export function rulesHash(rules: RuleSet): string {
  return contentHash(rules);
}

export function totalTiles(rules: RuleSet): number {
  return Object.values(rules.tileDistribution).reduce((a, b) => a + b, 0) + rules.blankCount;
}

export function premiumAt(rules: RuleSet, row: number, column: number): PremiumKind | null {
  return rules.premiumCells.find((p) => p.row === row && p.column === column)?.kind ?? null;
}

export const PREMIUM_LABEL: Record<PremiumKind, { short: string; long: string }> = {
  "double-word": { short: "2W", long: "double word" },
  "triple-word": { short: "3W", long: "triple word" },
  "double-letter": { short: "2L", long: "double letter" },
  "triple-letter": { short: "3L", long: "triple letter" },
};

export { LETTERS };
