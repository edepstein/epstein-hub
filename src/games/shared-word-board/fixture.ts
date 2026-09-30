/**
 * Replays the pack's deterministic three-turn fixture under rules 1.0 with its finite fixture
 * lexicon. Used by engine tests and the content validator; it is never replayed under 1.1.
 */
import fixture from "./content/fixture-1.0.json";
import { commit, createMatch, type MatchState, type Placement } from "./engine";

export const FIXTURE = fixture.rounds[0];
export const FIXTURE_DICTIONARY_VERSION = FIXTURE.dictionaryVersion;
export const FIXTURE_WORDS: ReadonlySet<string> = new Set(FIXTURE.configuration.dictionary);

const seatOf = (p: string) => (p === "p1" ? 0 : 1);

export function fixtureStart(): MatchState {
  const cfg = FIXTURE.configuration;
  if (FIXTURE.rulesVersion !== "1.0") throw new Error("Fixture is not pinned to rules 1.0");
  const created = createMatch({
    rulesVersion: "1.0",
    dictionaryVersion: FIXTURE.dictionaryVersion,
    players: [{ name: "p1" }, { name: "p2" }],
    seed: 0,
    firstSeat: seatOf(cfg.firstPlayer),
    deal: { racks: [cfg.initialRacks.p1, cfg.initialRacks.p2], bag: cfg.initialBagDrawOrder },
  });
  if (!created.ok) throw new Error(created.message);
  return created.state;
}

export const rackLetters = (s: MatchState, seat: number) => s.racks[seat].map((id) => s.tiles[id].letter ?? "?");

export interface FixtureStep {
  state: MatchState;
  turn: (typeof FIXTURE.turns)[number];
  code: string;
  score: number | undefined;
  words: string[];
  drawn: string[];
}

/** Replay every fixture turn; each letter maps to the first matching tile on the rack. */
export function replayFixture(): { steps: FixtureStep[]; final: MatchState; problems: string[] } {
  let state = fixtureStart();
  const steps: FixtureStep[] = [];
  const problems: string[] = [];
  FIXTURE.turns.forEach((turn, i) => {
    const seat = seatOf(turn.player);
    const available = state.racks[seat].slice();
    const placements: Placement[] = turn.tiles.map((t) => {
      const idx = available.findIndex((id) => state.tiles[id].letter === t.letter);
      const tileId = idx >= 0 ? available.splice(idx, 1)[0] : `missing-${t.letter}`;
      return { tileId, row: t.row, column: t.column };
    });
    const before = state.racks[seat].length - placements.length;
    const r = commit(state, { actionId: `fixture-${i + 1}`, expectedVersion: state.version, action: { type: "place", seat, placements } }, FIXTURE_WORDS);
    if (r.status !== "accepted") {
      problems.push(`turns[${i}]: rejected (${r.code}: ${r.message})`);
      return;
    }
    const drawn = r.state.racks[seat].slice(before).map((id) => r.state.tiles[id].letter ?? "?");
    steps.push({ state: r.state, turn, code: r.code, score: r.score, words: (r.words ?? []).map((w) => w.word), drawn });
    if (r.score !== turn.expectedScore) problems.push(`turns[${i}].expectedScore: recorded ${turn.expectedScore}, derived ${r.score}`);
    const words = (r.words ?? []).map((w) => w.word).sort();
    if (JSON.stringify(words) !== JSON.stringify([...turn.formedWords].sort()))
      problems.push(`turns[${i}].formedWords: recorded ${turn.formedWords.join(",")}, derived ${words.join(",")}`);
    if (drawn.join("") !== turn.expectedDraw.join("")) problems.push(`turns[${i}].expectedDraw: recorded ${turn.expectedDraw.join("")}, derived ${drawn.join("")}`);
    const rack = rackLetters(r.state, seat).join("");
    if (rack !== turn.expectedNextRack.join("")) problems.push(`turns[${i}].expectedNextRack: recorded ${turn.expectedNextRack.join("")}, derived ${rack}`);
    state = r.state;
  });
  const totals = FIXTURE.expectedTotals as Record<string, number>;
  if (state.scores[0] !== totals.p1 || state.scores[1] !== totals.p2)
    problems.push(`expectedTotals: recorded p1 ${totals.p1} p2 ${totals.p2}, derived p1 ${state.scores[0]} p2 ${state.scores[1]}`);
  return { steps, final: state, problems };
}
