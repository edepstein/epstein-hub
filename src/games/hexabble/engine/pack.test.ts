/**
 * Port of all eighteen checks in reference/build-pack-v3/scripts/hexabble-engine.test.cjs
 * (15 engine checks + 3 opening fixtures), against the migrated TypeScript engine.
 */
import { describe, expect, it } from "vitest";
import fixtures from "../content/opening-fixtures.json";
import {
  KEY_LOCATIONS,
  LETTERS,
  TILES,
  allCells,
  analyseMove,
  applyAction,
  cellKey,
  createMatch,
  rackValue,
  type MatchState,
  type ResolvedPlacement,
  type Tile,
} from "./index";
import { boardOf, placements, resolved, rig, setOf } from "../test-support/rig";

const dict = setOf("cat", "aa", "at", "ate", "cats", "a");
const letters = (s: string, coords: [number, number][]): ResolvedPlacement[] =>
  s.split("").map((letter, i) => ({
    q: coords[i][0],
    r: coords[i][1],
    tile: { id: `fixture-${i}`, kind: "letter", letter, value: LETTERS[letter][1] } as Tile,
    assigned: null,
  }));
const snap = (s: MatchState) => JSON.stringify(s);

describe("pack engine checks (hexabble-engine.test.cjs)", () => {
  it("217 unique bounded cells and six key spaces", () => {
    expect(allCells()).toHaveLength(217);
    expect(new Set(allCells().map(([q, r]) => cellKey(q, r))).size).toBe(217);
    expect(KEY_LOCATIONS).toHaveLength(6);
  });

  it("108 unique tiles and seven-tile rack", () => {
    expect(TILES).toHaveLength(108);
    expect(new Set(TILES.map((t) => t.id)).size).toBe(108);
    const g = createMatch({ names: ["A", "B"], mode: "friendly", seed: 5 });
    expect(g.players[0].rack).toHaveLength(7);
    expect(g.bag).toHaveLength(94);
  });

  it("CAT at centre scores 10", () => {
    const a = analyseMove({}, letters("CAT", [[0, 0], [0, 1], [0, 2]]), dict);
    expect(a.ok).toBe(true);
    expect(a.score).toBe(10);
  });

  it("opening must cover centre", () => {
    const a = analyseMove({}, letters("CAT", [[1, 0], [1, 1], [1, 2]]), dict);
    expect(a.placementError).toBeTruthy();
    expect(a.code).toBe("opening-must-cover-centre");
  });

  it("gapped opening rejected", () => {
    const a = analyseMove({}, letters("CAT", [[0, 0], [0, 1], [0, 3]]), dict);
    expect(a.placementError).toBeTruthy();
    expect(a.code).toBe("gap");
  });

  it("occupied cell rejected", () => {
    const a = analyseMove(boardOf([[0, 0, "A"]]), letters("AT", [[0, 0], [0, 1]]), dict);
    expect(a.placementError).toBeTruthy();
    expect(a.code).toBe("occupied");
  });

  it("Wild letter has zero value while the centre doubles the word", () => {
    const p = resolved([
      [0, 0, "*C"],
      [0, 1, "A"],
      [0, 2, "T"],
    ]);
    const a = analyseMove({}, p, dict);
    expect(a.ok).toBe(true);
    expect(a.score).toBe(4);
  });

  it("Friendly invalid word does not mutate turn, rack or board", () => {
    const g = rig({ mode: "friendly", racks: ["AT", "EEE"] });
    const before = snap(g);
    const t = applyAction(g, { type: "play", placements: placements(g, [[0, 0, 0], [0, 1, 1]]) }, new Set());
    expect(t.ok).toBe(false);
    expect(t.code).toBe("invalid-word");
    expect(t.state).toBe(g);
    expect(snap(g)).toBe(before);
  });

  it("Challenge invalid word loses the turn but keeps rack and board", () => {
    const g = rig({ mode: "challenge", racks: ["AT", "EEE"] });
    const rack = g.players[0].rack.slice();
    const t = applyAction(g, { type: "play", placements: placements(g, [[0, 0, 0], [0, 1, 1]]) }, new Set());
    expect(t.ok).toBe(true);
    expect(t.code).toBe("challenged");
    expect(t.state.current).toBe(1);
    expect(t.state.players[0].rack).toEqual(rack);
    expect(Object.keys(t.state.board)).toHaveLength(0);
  });

  it("duplicate rack tile IDs rejected atomically", () => {
    const g = rig({ racks: ["AA", "EEE"] });
    const id = g.players[0].rack[0];
    const before = snap(g);
    const t = applyAction(g, { type: "play", placements: [{ q: 0, r: 0, tileId: id }, { q: 0, r: 1, tileId: id }] }, dict);
    expect(t.ok).toBe(false);
    expect(t.code).toBe("duplicate-tile");
    expect(snap(g)).toBe(before);
  });

  it("fractional coordinate and multi-character assignment rejected", () => {
    const g = rig({ racks: ["AT", "EEE"] });
    const [p0] = placements(g, [[0, 0, 0]]);
    const before = snap(g);
    const t1 = applyAction(g, { type: "play", placements: [{ ...p0, q: 0.5 }] }, dict);
    expect(t1.ok).toBe(false);
    expect(t1.code).toBe("bad-coordinates");
    const t2 = applyAction(g, { type: "play", placements: [{ ...p0, assigned: "AA" }] }, dict);
    expect(t2.ok).toBe(false);
    expect(t2.code).toBe("bad-face");
    expect(snap(g)).toBe(before);
  });

  it("exchange rejects below seven in the bag without mutating", () => {
    const g = createMatch({ names: ["A", "B"], mode: "friendly", seed: 3 });
    const small: MatchState = { ...g, bag: g.bag.slice(0, 6) };
    const before = snap(small);
    const t = applyAction(small, { type: "exchange", tileIds: [small.players[0].rack[0]] }, dict);
    expect(t.ok).toBe(false);
    expect(t.code).toBe("bag-too-small");
    expect(snap(small)).toBe(before);
  });

  it("four consecutive passes end a two-player game", () => {
    let g = createMatch({ names: ["A", "B"], mode: "friendly", seed: 3 });
    for (let i = 0; i < 4; i++) g = applyAction(g, { type: "pass" }, dict).state;
    expect(g.over).toBe(true);
    expect(g.turn).toBe(4);
    expect(g.winners.length).toBeGreaterThanOrEqual(1);
  });

  it("manual end is idempotent and deducts unplayed tiles", () => {
    const g = createMatch({ names: ["A", "B"], mode: "friendly", seed: 9 });
    const values = g.players.map((p) => rackValue(p.rack));
    const ended = applyAction(g, { type: "end" }, dict).state;
    expect(ended.players.map((p) => p.score)).toEqual(values.map((v) => -v));
    const before = snap(ended);
    const again = applyAction(ended, { type: "end" }, dict);
    expect(again.ok).toBe(false);
    expect(snap(again.state)).toBe(before);
  });

  it("malformed placement records are rejected", () => {
    const g = createMatch({ names: ["A", "B"], mode: "friendly", seed: 1 });
    expect(applyAction(g, { type: "play", placements: [null as never] }, dict).ok).toBe(false);
    expect(applyAction(g, { type: "play", placements: [{} as never] }, dict).ok).toBe(false);
  });

  for (const round of fixtures.rounds) {
    it(`${round.id} expected scoring`, () => {
      const p = round.placements.map((pl) => ({ q: pl.q, r: pl.r, tile: pl.tile as Tile, assigned: null }));
      const a = analyseMove({}, p, setOf(...round.acceptedWords));
      expect(a.ok).toBe(round.expected.valid);
      expect(a.score).toBe(round.expected.score);
      expect(a.mainWord?.text).toBe(round.expected.word);
    });
  }
});
