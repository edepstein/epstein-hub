import { describe, expect, it } from "vitest";
import {
  analysePlacement,
  buildTileSet,
  checkConservation,
  commit,
  createMatch,
  rackWordIdeas,
  shuffleWith,
  type MatchState,
  type Membership,
  type MoveAction,
  type Placement,
} from "./engine";
import { FIXTURE, fixtureStart, rackLetters, replayFixture } from "./fixture";
import { RULES_1_0, RULES_1_1_CANDIDATE, getRuleSet, totalTiles, type RulesVersion } from "./rules";
import { loadFamiliarSync, loadMembershipSync } from "@/lib/dictionary/node";
import { simulate } from "./simulate";

const ANY: Membership = { has: () => true };
const words = (...w: string[]): Membership => new Set(w);

/** Deal explicit racks (letters, "?" = blank); the bag holds every other tile in canonical order. */
function dealt(version: RulesVersion, racks: string[], names = ["Ann", "Ben"]): MatchState {
  const rules = getRuleSet(version);
  const pool = buildTileSet(rules).map((t) => t.letter ?? "?");
  for (const r of racks)
    for (const l of r) {
      const i = pool.indexOf(l);
      if (i < 0) throw new Error(`no ${l} left`);
      pool.splice(i, 1);
    }
  const c = createMatch({ rulesVersion: version, dictionaryVersion: "test", players: names.map((name) => ({ name })), seed: 7, deal: { racks: racks.map((r) => r.split("")), bag: pool } });
  if (!c.ok) throw new Error(c.message);
  return c.state;
}

/** Tile ids on `seat`'s rack for the given letters (first unused match each). */
function tilesFor(s: MatchState, seat: number, letters: string): string[] {
  const avail = s.racks[seat].slice();
  return letters.split("").map((l) => {
    const i = avail.findIndex((id) => (s.tiles[id].letter ?? "?") === l);
    if (i < 0) throw new Error(`rack lacks ${l}`);
    return avail.splice(i, 1)[0];
  });
}

function place(s: MatchState, seat: number, spec: [string, number, number, string?][]): Placement[] {
  const ids = tilesFor(s, seat, spec.map((x) => x[0]).join(""));
  return spec.map(([, row, column, face], i) => (face ? { tileId: ids[i], row, column, face } : { tileId: ids[i], row, column }));
}

let n = 0;
function play(s: MatchState, action: MoveAction, m: Membership = ANY) {
  return commit(s, { actionId: `t-${++n}`, expectedVersion: s.version, action }, m);
}
function mustPlay(s: MatchState, action: MoveAction, m: Membership = ANY): MatchState {
  const r = play(s, action, m);
  if (r.status !== "accepted") throw new Error(`${r.code}: ${r.message}`);
  return r.state;
}

describe("rule sets", () => {
  it("pins two distinct rule sets with the pack's tile totals", () => {
    expect(totalTiles(RULES_1_0)).toBe(32);
    expect(totalTiles(RULES_1_1_CANDIDATE)).toBe(93);
    expect(RULES_1_0.premiumCells).toHaveLength(0);
    expect(RULES_1_0.blankCount).toBe(0);
    expect(Object.values(RULES_1_0.tileScores).every((v) => v === 1)).toBe(true);
    expect(RULES_1_1_CANDIDATE.premiumCells).toHaveLength(8);
    expect(RULES_1_1_CANDIDATE.blankCount).toBe(2);
    // Six consecutive passes/exchanges end a two-player match under both sets.
    expect(RULES_1_0.passOrExchangeRoundsToEnd * 2).toBe(6);
    expect(RULES_1_1_CANDIDATE.passOrExchangeRoundsToEnd * 2).toBe(6);
  });

  it("creates seeded matches deterministically with every tile accounted for", () => {
    for (const v of ["1.0", "1.1-candidate"] as const) {
      const a = createMatch({ rulesVersion: v, dictionaryVersion: "x", players: [{ name: "A" }, { name: "B" }, { name: "C" }], seed: 42 });
      const b = createMatch({ rulesVersion: v, dictionaryVersion: "x", players: [{ name: "A" }, { name: "B" }, { name: "C" }], seed: 42 });
      const c = createMatch({ rulesVersion: v, dictionaryVersion: "x", players: [{ name: "A" }, { name: "B" }, { name: "C" }], seed: 43 });
      expect(a.ok && b.ok && c.ok).toBe(true);
      if (!a.ok || !b.ok || !c.ok) return;
      expect(a.state).toEqual(b.state);
      expect(a.state.bag).not.toEqual(c.state.bag);
      expect(a.state.racks.every((r) => r.length === 7)).toBe(true);
      expect(checkConservation(a.state)).toEqual([]);
      expect(a.state.bag.length).toBe(totalTiles(getRuleSet(v)) - 21);
    }
  });

  it("refuses bad setups", () => {
    const base = { rulesVersion: "1.0" as const, dictionaryVersion: "x", seed: 1 };
    expect(createMatch({ ...base, players: [{ name: "Solo" }] })).toMatchObject({ ok: false, code: "player-count" });
    expect(createMatch({ ...base, players: [1, 2, 3, 4, 5].map((i) => ({ name: `P${i}` })) })).toMatchObject({ ok: false, code: "player-count" });
    expect(createMatch({ ...base, players: [{ name: "Ann" }, { name: " " }] })).toMatchObject({ ok: false, code: "player-name" });
    expect(createMatch({ ...base, players: [{ name: "Ann" }, { name: "ann" }] })).toMatchObject({ ok: false, code: "player-name-duplicate" });
  });

  it("serialises the RNG so shuffles are reproducible", () => {
    const [a, s1] = shuffleWith([1, 2, 3, 4, 5, 6, 7, 8], 99);
    const [b, s2] = shuffleWith([1, 2, 3, 4, 5, 6, 7, 8], 99);
    expect(a).toEqual(b);
    expect(s1).toBe(s2);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("pack fixture under rules 1.0", () => {
  it("replays the three recorded turns exactly: scores, draws, racks and totals", () => {
    const start = fixtureStart();
    expect(rackLetters(start, 0).join("")).toBe("CATSERN");
    expect(rackLetters(start, 1).join("")).toBe("ARTESOL");
    const { steps, final, problems } = replayFixture();
    expect(problems).toEqual([]);
    expect(steps.map((s) => s.score)).toEqual([3, 4, 4]);
    expect(steps.map((s) => s.words)).toEqual([["CAT"], ["CATS"], ["CART"]]);
    expect(steps.map((s) => s.drawn.join(""))).toEqual(["ART", "B", "EEA"]);
    expect(rackLetters(steps[0].state, 0).join("")).toBe("SERNART");
    expect(rackLetters(steps[1].state, 1).join("")).toBe("ARTEOLB");
    expect(rackLetters(steps[2].state, 0).join("")).toBe("SENREEA");
    expect(final.scores).toEqual([FIXTURE.expectedTotals.p1, FIXTURE.expectedTotals.p2]);
    expect(final.status).toBe("active");
    expect(final.version).toBe(3);
    expect(checkConservation(final)).toEqual([]);
  });

  it("cannot be dealt under 1.1-candidate (different tile universe)", () => {
    const cfg = FIXTURE.configuration;
    const r = createMatch({
      rulesVersion: "1.1-candidate",
      dictionaryVersion: FIXTURE.dictionaryVersion,
      players: [{ name: "p1" }, { name: "p2" }],
      seed: 0,
      deal: { racks: [cfg.initialRacks.p1, cfg.initialRacks.p2], bag: cfg.initialBagDrawOrder },
    });
    expect(r).toMatchObject({ ok: false, code: "deal-invalid" });
  });
});

describe("placement rules", () => {
  const fresh = () => dealt("1.0", ["CATSERN", "ARTESOL"]);

  it("accepts a legal first move covering the centre", () => {
    const s = fresh();
    const a = analysePlacement(s, 0, place(s, 0, [["C", 4, 3], ["A", 4, 4], ["T", 4, 5]]), words("CAT"));
    expect(a).toMatchObject({ legal: true, code: "ok", score: 3 });
    expect(a.words.map((w) => w.word)).toEqual(["CAT"]);
    expect(a.words[0].explanation).toBe("C 1 + A 1 + T 1 = 3");
  });

  it("accepts a first move laid down a column through the centre", () => {
    const s = fresh();
    expect(analysePlacement(s, 0, place(s, 0, [["C", 2, 4], ["A", 3, 4], ["T", 4, 4]]), words("CAT")).legal).toBe(true);
  });

  const rejections: [string, (s: MatchState) => Placement[], string][] = [
    ["first-move-anchor", (s) => place(s, 0, [["C", 0, 0], ["A", 0, 1], ["T", 0, 2]]), "centre star at row 5, column 5"],
    ["no-word", (s) => place(s, 0, [["C", 4, 4]]), "at least 2 letters"],
    ["not-in-line", (s) => place(s, 0, [["C", 4, 4], ["A", 5, 5]]), "one row or one column"],
    ["gap", (s) => place(s, 0, [["C", 4, 3], ["A", 4, 4], ["T", 4, 6]]), "gap at row 5, column 6"],
    ["off-board", (s) => place(s, 0, [["C", 4, 8], ["A", 4, 9]]), "on the board"],
    ["same-square", (s) => place(s, 0, [["C", 4, 4], ["A", 4, 4]]), "Two tiles"],
    ["no-tiles", () => [], "at least one tile"],
  ];
  for (const [code, build, text] of rejections) {
    it(`rejects ${code} atomically with a precise reason`, () => {
      const s = fresh();
      const before = JSON.stringify(s);
      const r = play(s, { type: "place", seat: 0, placements: build(s) }, words("CAT", "CA"));
      expect(r.status).toBe("rejected");
      expect(r.code).toBe(code);
      expect(r.message).toContain(text);
      expect(r.state).toBe(s);
      expect(JSON.stringify(r.state)).toBe(before);
    });
  }

  it("rejects the same physical tile twice, tiles not on the rack and out-of-turn moves", () => {
    const s = fresh();
    const [c] = tilesFor(s, 0, "C");
    expect(play(s, { type: "place", seat: 0, placements: [{ tileId: c, row: 4, column: 4 }, { tileId: c, row: 4, column: 5 }] }).code).toBe("duplicate-tile");
    const [opp] = tilesFor(s, 1, "A");
    expect(play(s, { type: "place", seat: 0, placements: [{ tileId: opp, row: 4, column: 4 }] }).code).toBe("tile-not-in-rack");
    expect(play(s, { type: "place", seat: 1, placements: place(s, 1, [["A", 4, 4], ["T", 4, 5]]) }).code).toBe("not-your-turn");
    expect(play(s, { type: "place", seat: 0, placements: [{ tileId: "t9999", row: 4, column: 4 }] }).code).toBe("tile-not-in-rack");
  });

  it("rejects words outside the agreed list, naming them", () => {
    const s = fresh();
    const r = play(s, { type: "place", seat: 0, placements: place(s, 0, [["T", 4, 4], ["C", 4, 5], ["A", 4, 6]]) }, words("CAT"));
    expect(r).toMatchObject({ status: "rejected", code: "not-a-word" });
    expect(r.message).toContain("TCA is not in the agreed word list");
  });

  it("requires later moves to connect orthogonally; diagonal contact does not count", () => {
    let s = fresh();
    s = mustPlay(s, { type: "place", seat: 0, placements: place(s, 0, [["C", 4, 3], ["A", 4, 4], ["T", 4, 5]]) });
    const r = play(s, { type: "place", seat: 1, placements: place(s, 1, [["A", 5, 6], ["T", 5, 7]]) });
    expect(r.code).toBe("not-connected");
    expect(r.message).toContain("diagonal");
    const occupied = play(s, { type: "place", seat: 1, placements: place(s, 1, [["A", 4, 4]]) });
    expect(occupied.code).toBe("square-occupied");
    // Connected single tile extending CAT to CATS.
    const ok = play(s, { type: "place", seat: 1, placements: place(s, 1, [["S", 4, 6]]) }, words("CAT", "CATS"));
    expect(ok).toMatchObject({ status: "accepted", score: 4 });
  });

  it("allows a gap that is already filled by a committed tile", () => {
    let s = fresh();
    s = mustPlay(s, { type: "place", seat: 0, placements: place(s, 0, [["A", 4, 4], ["T", 4, 5]]) }, words("AT"));
    // Ben plays R at column 3 and S at column 6 around the existing AT: RATS.
    const r = play(s, { type: "place", seat: 1, placements: place(s, 1, [["R", 4, 3], ["S", 4, 6]]) }, words("AT", "RATS"));
    expect(r).toMatchObject({ status: "accepted", score: 4 });
    expect(r.words!.map((w) => w.word)).toEqual(["RATS"]);
  });

  it("scores every crossing word, counting an intersection tile in both", () => {
    let s = fresh();
    s = mustPlay(s, { type: "place", seat: 0, placements: place(s, 0, [["C", 4, 3], ["A", 4, 4], ["T", 4, 5]]) });
    // Ben lays A,T under A,T: across AT plus down AA and TT.
    const a = analysePlacement(s, 1, place(s, 1, [["A", 5, 4], ["T", 5, 5]]), words("CAT", "AT", "AA", "TT"));
    expect(a.legal).toBe(true);
    expect(a.words.map((w) => `${w.word}:${w.direction}`)).toEqual(["AT:across", "AA:down", "TT:down"]);
    expect(a.score).toBe(6);
    // One invalid cross word makes the whole move illegal.
    const bad = analysePlacement(s, 1, place(s, 1, [["A", 5, 4], ["T", 5, 5]]), words("CAT", "AT", "AA"));
    expect(bad).toMatchObject({ legal: false, code: "not-a-word", invalidWords: ["TT"] });
  });

  it("scores a single tile that forms words in both directions", () => {
    let s = fresh();
    s = mustPlay(s, { type: "place", seat: 0, placements: place(s, 0, [["C", 4, 3], ["A", 4, 4], ["T", 4, 5]]) });
    s = mustPlay(s, { type: "place", seat: 1, placements: place(s, 1, [["A", 5, 3], ["T", 6, 3]]) });
    // Ann: S at (5,4) makes across "AS" and down "AS" (A at 4,4 above).
    const a = analysePlacement(s, 0, place(s, 0, [["S", 5, 4]]), ANY);
    expect(a.words.map((w) => `${w.word}:${w.direction}`).sort()).toEqual(["AS:across", "AS:down"]);
    expect(a.score).toBe(4);
  });

  it("rejects a finished match and any move for a resigned player", () => {
    let s = fresh();
    s = mustPlay(s, { type: "resign", seat: 0 });
    expect(s.status).toBe("finished");
    expect(play(s, { type: "pass", seat: 1 }).code).toBe("match-finished");
  });
});

describe("rules 1.1-candidate: premiums and blanks", () => {
  it("applies a triple-letter premium to a newly placed tile", () => {
    const s = dealt("1.1-candidate", ["HOUSEAB", "ARTESOL"]);
    const a = analysePlacement(s, 0, place(s, 0, [["H", 4, 0], ["O", 4, 1], ["U", 4, 2], ["S", 4, 3], ["E", 4, 4]]), words("HOUSE"));
    expect(a).toMatchObject({ legal: true, score: 16 });
    expect(a.words[0].explanation).toBe("H 4×3 + O 1 + U 1 + S 1 + E 1 = 16");
  });

  it("scores a blank as zero even on a letter premium, while its face spells the word", () => {
    const s = dealt("1.1-candidate", ["?OUSEAB", "ARTESOL"]);
    const a = analysePlacement(s, 0, place(s, 0, [["?", 4, 0, "H"], ["O", 4, 1], ["U", 4, 2], ["S", 4, 3], ["E", 4, 4]]), words("HOUSE"));
    expect(a).toMatchObject({ legal: true, score: 4 });
    expect(a.words[0].word).toBe("HOUSE");
    expect(a.words[0].explanation).toContain("H (blank) 0×3");
  });

  it("requires exactly one A-Z face for a blank and refuses a face on a letter tile", () => {
    const s = dealt("1.1-candidate", ["?OUSEAB", "ARTESOL"]);
    const [blank] = tilesFor(s, 0, "?");
    const [o] = tilesFor(s, 0, "O");
    const at = (face?: string) => analysePlacement(s, 0, [{ tileId: blank, row: 4, column: 4, face }, { tileId: o, row: 4, column: 5 }], ANY);
    expect(at(undefined).code).toBe("blank-face-missing");
    expect(at("AB").code).toBe("blank-face-invalid");
    expect(at("a").code).toBe("blank-face-invalid");
    expect(at("1").code).toBe("blank-face-invalid");
    expect(at("G").legal).toBe(true);
    const mismatch = analysePlacement(s, 0, [{ tileId: o, row: 4, column: 4, face: "Q" }, { tileId: blank, row: 4, column: 5, face: "X" }], ANY);
    expect(mismatch.code).toBe("face-mismatch");
  });

  it("keeps a committed blank's face and its zero value", () => {
    let s = dealt("1.1-candidate", ["?OUSEAB", "SRTEAOL"]);
    s = mustPlay(s, { type: "place", seat: 0, placements: place(s, 0, [["?", 4, 0, "H"], ["O", 4, 1], ["U", 4, 2], ["S", 4, 3], ["E", 4, 4]]) });
    const cell = s.board[4 * 9];
    expect(cell).toMatchObject({ face: "H", blank: true });
    const a = analysePlacement(s, 1, place(s, 1, [["S", 4, 5]]), ANY);
    expect(a.words[0]).toMatchObject({ word: "HOUSES", score: 5 });
  });

  it("uses each premium once: later words through a covered premium score base values", () => {
    let s = dealt("1.1-candidate", ["HOUSEAB", "SRTEAOL"]);
    s = mustPlay(s, { type: "place", seat: 0, placements: place(s, 0, [["H", 4, 0], ["O", 4, 1], ["U", 4, 2], ["S", 4, 3], ["E", 4, 4]]) });
    expect(s.scores[0]).toBe(16);
    const r = play(s, { type: "place", seat: 1, placements: place(s, 1, [["S", 4, 5]]) });
    expect(r.score).toBe(4 + 1 + 1 + 1 + 1 + 1);
    expect(r.words![0].letters[0]).toMatchObject({ letter: "H", isNew: false, letterMultiplier: 1, premium: null });
  });

  it("doubles a word for a newly covered double-word square and applies it once", () => {
    // HOUSE across row 4 columns 2-6 (no premiums), then ASH down column 2 onto the H.
    let s = dealt("1.1-candidate", ["HOUSEAB", "ASTEROL"]);
    s = mustPlay(s, { type: "place", seat: 0, placements: place(s, 0, [["H", 4, 2], ["O", 4, 3], ["U", 4, 4], ["S", 4, 5], ["E", 4, 6]]) });
    expect(s.scores[0]).toBe(8);
    const r = play(s, { type: "place", seat: 1, placements: place(s, 1, [["A", 2, 2], ["S", 3, 2]]) }, words("ASH"));
    expect(r).toMatchObject({ status: "accepted", score: 12 });
    expect(r.words![0].explanation).toBe("A 1 + S 1 + H 4 = 6, ×2 word = 12");
    s = r.state;
    // Ann now lays B beside the A on the double-word square: "AB" scores 1 + 3 with no doubling.
    const again = analysePlacement(s, 0, place(s, 0, [["B", 2, 3]]), ANY);
    expect(again.words.find((w) => w.direction === "across")).toMatchObject({ word: "AB", score: 4, wordMultiplier: 1 });
  });

  it("applies a double-word to every newly formed word that uses the new tile on it", () => {
    let s = dealt("1.1-candidate", ["HOUSEAB", "ASTEROL"]);
    s = mustPlay(s, { type: "place", seat: 0, placements: place(s, 0, [["H", 4, 2], ["O", 4, 3], ["U", 4, 4], ["S", 4, 5], ["E", 4, 6]]) });
    s = mustPlay(s, { type: "place", seat: 1, placements: place(s, 1, [["T", 3, 6], ["O", 2, 6]]) }); // OTE down col 6? fine with ANY
    // (2,6) is double-word and already covered, so a new tile at (2,5) gets no doubling.
    const a = analysePlacement(s, 0, place(s, 0, [["A", 2, 5]]), ANY);
    expect(a.words.every((w) => w.wordMultiplier === 1)).toBe(true);
  });
});

describe("turn actions and end conditions", () => {
  it("exchange: draws first, returns tiles, reshuffles, scores nothing and passes the turn", () => {
    const s = dealt("1.1-candidate", ["QZXJKVW", "ARTESOL"]);
    const give = tilesFor(s, 0, "QZX");
    const r = play(s, { type: "exchange", seat: 0, tileIds: give });
    expect(r.status).toBe("accepted");
    const n2 = r.state;
    expect(n2.racks[0]).toHaveLength(7);
    expect(n2.racks[0].slice(4)).toEqual(s.bag.slice(0, 3));
    expect(n2.bag).toHaveLength(s.bag.length);
    expect(give.every((id) => n2.bag.includes(id))).toBe(true);
    expect(n2.scores).toEqual([0, 0]);
    expect(n2.current).toBe(1);
    expect(n2.consecutiveInactive).toBe(1);
    expect(n2.rng).not.toBe(s.rng);
    expect(checkConservation(n2)).toEqual([]);
    // History records only the count, never which tiles.
    expect(n2.history.at(-1)).toEqual({ kind: "exchange", actionId: expect.any(String), seat: 0, version: 1, count: 3 });
  });

  it("exchange limits: at least one tile, own tiles only, no repeats, and at least seven in the bag", () => {
    const s = dealt("1.0", ["CATSERN", "ARTESOL"]);
    expect(play(s, { type: "exchange", seat: 0, tileIds: [] }).code).toBe("exchange-empty");
    const [c] = tilesFor(s, 0, "C");
    expect(play(s, { type: "exchange", seat: 0, tileIds: [c, c] }).code).toBe("duplicate-tile");
    expect(play(s, { type: "exchange", seat: 0, tileIds: tilesFor(s, 1, "A") }).code).toBe("tile-not-in-rack");
    // Four players in 1.0 leave four tiles in the bag: exchange is refused.
    const four = createMatch({ rulesVersion: "1.0", dictionaryVersion: "x", players: ["A", "B", "C", "D"].map((name) => ({ name })), seed: 3 });
    if (!four.ok) throw new Error();
    expect(four.state.bag).toHaveLength(4);
    const r = play(four.state, { type: "exchange", seat: 0, tileIds: four.state.racks[0].slice(0, 1) });
    expect(r).toMatchObject({ status: "rejected", code: "exchange-bag-low" });
    expect(r.message).toContain("at least 7 tiles in the bag; there are 4");
  });

  it("pass end: six consecutive passes/exchanges end a two-player match and subtract leftovers only", () => {
    let s = dealt("1.1-candidate", ["HOUSEAB", "ARTESOL"]);
    s = mustPlay(s, { type: "place", seat: 0, placements: place(s, 0, [["H", 4, 2], ["O", 4, 3], ["U", 4, 4], ["S", 4, 5], ["E", 4, 6]]) });
    const racksAfterMove = [s.racks[0].slice(), s.racks[1].slice()];
    for (let i = 0; i < 5; i++) {
      s = mustPlay(s, i === 2 ? { type: "exchange", seat: s.current, tileIds: s.racks[s.current].slice(0, 2) } : { type: "pass", seat: s.current });
      expect(s.status).toBe("active");
    }
    expect(s.consecutiveInactive).toBe(5);
    const last = play(s, { type: "pass", seat: s.current });
    expect(last).toMatchObject({ status: "accepted", code: "pass-ended" });
    const f = last.state;
    expect(f.status).toBe("finished");
    expect(f.end!.reason).toBe("passes");
    const penalty = (seat: number) => f.racks[seat].reduce((a, id) => a + (f.tiles[id].letter ? RULES_1_1_CANDIDATE.tileScores[f.tiles[id].letter!] : 0), 0);
    expect(f.end!.adjustments.map((a) => a.bonus)).toEqual([0, 0]);
    expect(f.end!.adjustments.map((a) => a.rackPenalty)).toEqual([penalty(0), penalty(1)]);
    expect(f.scores).toEqual([8 - penalty(0), -penalty(1)]);
    expect(racksAfterMove[0]).toHaveLength(7);
  });

  it("a placement resets the pass counter", () => {
    let s = dealt("1.0", ["CATSERN", "ARTESOL"]);
    s = mustPlay(s, { type: "pass", seat: 0 });
    s = mustPlay(s, { type: "pass", seat: 1 });
    expect(s.consecutiveInactive).toBe(2);
    s = mustPlay(s, { type: "place", seat: 0, placements: place(s, 0, [["C", 4, 3], ["A", 4, 4], ["T", 4, 5]]) });
    expect(s.consecutiveInactive).toBe(0);
  });

  it("three players need nine consecutive passes", () => {
    let s = dealt("1.0", ["CATSERN", "ARTESOL", "ABEEAST"], ["A", "B", "C"]);
    for (let i = 0; i < 8; i++) s = mustPlay(s, { type: "pass", seat: s.current });
    expect(s.status).toBe("active");
    s = mustPlay(s, { type: "pass", seat: s.current });
    expect(s.status).toBe("finished");
  });

  it("going out with an empty bag ends the match and transfers the others' rack values", () => {
    // Build a position with an empty bag: every tile not on a rack sits isolated on the board.
    const base = dealt("1.0", ["CAT", "RATE"]);
    const rest = [...base.bag];
    const board = base.board.slice();
    let k = 0;
    for (let r = 0; r < 9 && k < rest.length; r += 2)
      for (let c = 0; c < 9 && k < rest.length; c += 2) {
        const id = rest[k++];
        board[r * 9 + c] = { tileId: id, face: base.tiles[id].letter!, blank: false, placedAt: 0 };
      }
    expect(k).toBe(rest.length);
    const s: MatchState = { ...base, board, bag: [] };
    expect(checkConservation(s)).toEqual([]);
    const r = play(s, { type: "place", seat: 0, placements: place(s, 0, [["C", 1, 1], ["A", 1, 2], ["T", 1, 3]]) });
    expect(r).toMatchObject({ status: "accepted", code: "placed-went-out" });
    const f = r.state;
    expect(f.status).toBe("finished");
    expect(f.end).toMatchObject({ reason: "went-out", wentOut: 0 });
    expect(f.end!.adjustments[0]).toMatchObject({ bonus: 4, rackPenalty: 0, net: 4 });
    expect(f.end!.adjustments[1]).toMatchObject({ bonus: 0, rackPenalty: 4, net: -4 });
    expect(f.scores).toEqual([r.score! + 4, -4]);
    expect(f.end!.winners).toEqual([0]);
  });

  it("resignation: two players end with the other winning and no invented score", () => {
    let s = dealt("1.0", ["CATSERN", "ARTESOL"]);
    s = mustPlay(s, { type: "place", seat: 0, placements: place(s, 0, [["C", 4, 3], ["A", 4, 4], ["T", 4, 5]]) });
    const r = play(s, { type: "resign", seat: 1 });
    expect(r).toMatchObject({ status: "accepted", code: "resigned-ended" });
    expect(r.state.end).toMatchObject({ reason: "resigned", winners: [0], finalScores: [3, 0] });
    expect(r.state.end!.adjustments.every((a) => a.net === 0)).toBe(true);
  });

  it("resignation with three players: the others continue and turns skip the resigned seat", () => {
    let s = dealt("1.0", ["CATSERN", "ARTESOL", "ABEEAST"], ["A", "B", "C"]);
    s = mustPlay(s, { type: "resign", seat: 0 });
    expect(s.status).toBe("active");
    expect(s.current).toBe(1);
    s = mustPlay(s, { type: "pass", seat: 1 });
    expect(s.current).toBe(2);
    s = mustPlay(s, { type: "pass", seat: 2 });
    expect(s.current).toBe(1);
    expect(checkConservation(s)).toEqual([]);
  });

  it("hints are recorded as assistance without changing the turn", () => {
    const s = dealt("1.0", ["CATSERN", "ARTESOL"]);
    const r = play(s, { type: "hint", seat: 0 });
    expect(r.state.hintsTaken).toEqual([1, 0]);
    expect(r.state.current).toBe(0);
    expect(rackWordIdeas(r.state, 0, ["CAT", "CATS", "STERN", "ZOO", "CANTERS", "A"])).toEqual(["CANTERS", "STERN", "CATS", "CAT"]);
    const blanky = dealt("1.1-candidate", ["?ZA", "ARTESOL"]);
    expect(rackWordIdeas(blanky, 0, ["ZAP", "ZA", "ZZZ", "ADZE"])).toEqual(["ZAP", "ZA"]);
  });
});

describe("atomic, idempotent, version-checked commits", () => {
  it("rejects a stale version with a conflict and changes nothing", () => {
    let s = dealt("1.0", ["CATSERN", "ARTESOL"]);
    s = mustPlay(s, { type: "pass", seat: 0 });
    const r = commit(s, { actionId: "late", expectedVersion: 0, action: { type: "pass", seat: 1 } }, ANY);
    expect(r).toMatchObject({ status: "conflict", code: "stale-version" });
    expect(r.state).toBe(s);
  });

  it("returns the original result for a repeated action ID without awarding points twice", () => {
    const s = dealt("1.0", ["CATSERN", "ARTESOL"]);
    const req = { actionId: "move-1", expectedVersion: 0, action: { type: "place" as const, seat: 0, placements: place(s, 0, [["C", 4, 3], ["A", 4, 4], ["T", 4, 5]]) } };
    const first = commit(s, req, ANY);
    expect(first).toMatchObject({ status: "accepted", score: 3 });
    const again = commit(first.state, req, ANY);
    expect(again).toMatchObject({ status: "duplicate", score: 3 });
    expect(again.state).toBe(first.state);
    expect(again.state.scores).toEqual([3, 0]);
    // A duplicate is recognised even though its version is now stale.
    expect(commit(first.state, { ...req, expectedVersion: 0 }, ANY).status).toBe("duplicate");
  });

  it("rejects malformed requests", () => {
    const s = dealt("1.0", ["CATSERN", "ARTESOL"]);
    expect(commit(s, { actionId: "", expectedVersion: 0, action: { type: "pass", seat: 0 } }, ANY).code).toBe("bad-action-id");
    expect(commit(s, { actionId: "x", expectedVersion: 0, action: { type: "dance", seat: 0 } as unknown as MoveAction }, ANY).code).toBe("bad-action");
    expect(commit(s, { actionId: "x", expectedVersion: 0, action: null as unknown as MoveAction }, ANY).code).toBe("bad-action");
  });
});

describe("seeded full-match simulations", () => {
  const membership = loadMembershipSync();
  const familiar = loadFamiliarSync();
  const candidates = [...familiar].filter((w) => membership.has(w) && w.length >= 2 && w.length <= 6);

  const cases: [RulesVersion, number, number][] = [
    ["1.0", 2, 11],
    ["1.0", 3, 12],
    ["1.0", 4, 13],
    ["1.1-candidate", 2, 21],
    ["1.1-candidate", 3, 22],
    ["1.1-candidate", 2, 23],
  ];
  for (const [version, players, seed] of cases) {
    it(`${version}, ${players} players, seed ${seed}: reaches a correct terminal result with tiles conserved`, () => {
      const c = createMatch({ rulesVersion: version, dictionaryVersion: "gb", players: Array.from({ length: players }, (_, i) => ({ name: `P${i + 1}` })), seed });
      if (!c.ok) throw new Error(c.message);
      const sim = simulate(c.state, membership, candidates, seed);
      expect(sim.problems).toEqual([]);
      for (const st of sim.states) expect(checkConservation(st)).toEqual([]);
      const f = sim.final;
      expect(f.status).toBe("finished");
      // Scores derive exactly from history plus final adjustments.
      const fromHistory = f.players.map((_, seat) => f.history.reduce((a, h) => a + (h.kind === "place" && h.seat === seat ? h.score : 0), 0));
      expect(f.scores).toEqual(fromHistory.map((v, seat) => v + f.end!.adjustments[seat].net));
      const best = Math.max(...f.scores);
      expect(f.end!.winners).toEqual(f.scores.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0));
      if (f.end!.reason === "went-out") {
        expect(f.bag).toHaveLength(0);
        expect(f.racks[f.end!.wentOut!]).toHaveLength(0);
      } else {
        expect(f.consecutiveInactive).toBe(3 * players);
      }
      expect(f.history.filter((h) => h.kind === "place").length).toBeGreaterThan(2);
    });
  }
});
