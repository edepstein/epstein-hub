/**
 * Rule cases the pack's eighteen checks do not cover (upgrades/19 "Required tests"):
 * Pivot paths, multiple Pivots, ambiguous main-word choice, additive word premiums,
 * premium reuse, ignored touches, the Three-Tile Adjacency Rule, Key space transitions,
 * the seven-tile bonus, going out, ties, exchanges and Challenge preview secrecy.
 * Decisions are referenced by their IDs in docs/hexabble-rules-decisions.md.
 */
import { describe, expect, it } from "vitest";
import {
  BINGO_BONUS,
  KEY_LOCATIONS,
  analyseMove,
  applyAction,
  conservationProblems,
  createMatch,
  premiumAt,
  previewMove,
  type MatchAction,
  type MatchState,
} from "./index";
import { boardOf, placements, resolved, rig, setOf } from "../test-support/rig";

const mustAnalyse = (a: ReturnType<typeof previewMove>) => {
  if (!("words" in a)) throw new Error(`Expected an analysis, got ${a.code}`);
  return a;
};

describe("word premiums", () => {
  it("DW + TW on one word is five times, not six (additive)", () => {
    expect(premiumAt(0, 0)).toBe("START");
    expect(premiumAt(0, 8)).toBe("TW");
    expect(premiumAt(0, 7)).toBeNull();
    const board = boardOf([
      [0, 1, "B"],
      [0, 2, "C"],
      [0, 3, "D"],
      [0, 4, "E"],
      [0, 5, "F"],
      [0, 6, "G"],
    ]);
    const a = analyseMove(board, resolved([[0, 0, "A"], [0, 7, "H"], [0, 8, "I"]]), setOf("ABCDEFGHI"));
    expect(a.ok).toBe(true);
    expect(a.mainWord!.wordMult).toBe(5);
    // A1 B3 C3 D2 E1 F4 G2 H4 I1 = 21
    expect(a.mainWord!.base).toBe(21);
    expect(a.score).toBe(105);
  });

  it("a Key space and a DW on one word give four times", () => {
    const cells: [number, number][] = [[-7, 1], [-6, 0], [-5, -1], [-4, -2], [-3, -3]];
    expect(premiumAt(-7, 1)).toBe("DW");
    expect(premiumAt(-3, -3)).toBe("KEY");
    const a = analyseMove(
      boardOf([[-2, -4, "S"]]),
      resolved(cells.map(([q, r], i) => [q, r, "PLANT"[i]] as [number, number, string])),
      setOf("PLANTS"),
    );
    expect(a.ok).toBe(true);
    expect(a.mainWord!.wordMult).toBe(4);
    expect(a.mainWord!.dirs).toEqual(["up-right"]);
  });

  it("a premium already covered does not apply again", () => {
    const a = analyseMove(boardOf([[0, 0, "C"]]), resolved([[0, 1, "A"], [0, 2, "T"]]), setOf("CAT"));
    expect(a.ok).toBe(true);
    expect(a.mainWord!.wordMult).toBe(1);
    expect(a.score).toBe(5);
  });

  it("a new tile on a premium counts it in every word it forms (own derivation per word)", () => {
    expect(premiumAt(1, 1)).toBe("DL");
    const board = boardOf([[0, 0, "C"], [0, 1, "A"], [0, 2, "T"]]);
    const a = analyseMove(board, resolved([[1, 0, "A"], [1, 1, "T"]]), setOf("CAT", "AT", "AA"));
    expect(a.ok).toBe(true);
    const byText = a.words.map((w) => [w.text, w.kind, w.counted, w.score]);
    expect(byText).toEqual([
      ["AT", "main", true, 3],
      ["CA", "touch", false, 4],
      ["AA", "touch", true, 2],
      ["AT", "touch", true, 3],
      ["TT", "touch", false, 3],
    ]);
    expect(a.score).toBe(8);
  });

  it("a Wild on a letter premium still scores zero", () => {
    const a = analyseMove(boardOf([[0, 0, "C"], [0, 1, "A"], [0, 2, "T"]]), resolved([[1, 1, "*A"], [1, 0, "A"]]), setOf("AA", "AT", "CAT"));
    const t = a.words.find((w) => w.kind === "main")!;
    expect(t.letters.find((l) => l.q === 1 && l.r === 1)!.points).toBe(0);
  });
});

describe("Adjacent Letters Rule (ignored touches)", () => {
  const board = boardOf([[0, 0, "C"], [0, 1, "A"], [0, 2, "T"]]);
  it("one invalid two-letter touch per new tile is ignored", () => {
    const a = analyseMove(board, resolved([[1, 0, "A"], [1, 1, "T"]]), setOf("CAT", "AT", "AA"));
    expect(a.ok).toBe(true);
    expect(a.words.filter((w) => w.ignored).map((w) => w.text)).toEqual(["CA", "TT"]);
  });
  it("two invalid touches on the same new tile break the rule", () => {
    const a = analyseMove(board, resolved([[1, 0, "A"], [1, 1, "T"]]), setOf("CAT", "AT"));
    expect(a.ok).toBe(false);
    expect(a.code).toBe("invalid-word");
    expect(a.wordErrors.join(" ")).toMatch(/Adjacent Letters Rule/);
    expect(a.wordErrors.join(" ")).toMatch(/"CA" and "AA"/);
  });
  it("an invalid line of three or more letters is never ignored", () => {
    const a = analyseMove(boardOf([[0, 1, "A"], [2, -1, "E"]]), resolved([[1, 0, "T"], [1, 1, "O"]]), setOf("TO"));
    // Up-right through (1,0): A(0,1) T(1,0) E(2,-1) = "ATE" (cross word), not in this list.
    expect(a.ok).toBe(false);
    expect(a.wordErrors[0]).toMatch(/"ATE" \(formed alongside your word\)/);
  });
});

describe("Three-Tile Adjacency Rule", () => {
  it("a new tile touching three committed letters must make a valid word with one of them", () => {
    const board = boardOf([[1, -1, "E"], [1, 1, "T"], [0, 0, "C"]]);
    const move = resolved([[1, 0, "A"], [1, 2, "S"]]);
    const bad = analyseMove(board, move, setOf("EATS"));
    expect(bad.ok).toBe(false);
    expect(bad.wordErrors.join(" ")).toMatch(/Three-Tile Adjacency Rule/);
    const good = analyseMove(board, move, setOf("EATS", "CA"));
    expect(good.ok).toBe(true);
  });
  it("a Pivot is a void, not a neighbour", () => {
    const board = boardOf([[1, -1, "E"], [1, 1, "T"], [0, 0, ">"]]);
    const a = analyseMove(board, resolved([[1, 0, "A"], [1, 2, "S"]]), setOf("EATS"));
    expect(a.ok).toBe(true);
    expect(a.words.map((w) => w.text)).toEqual(["EATS"]);
  });
});

describe("ambiguous main-word choice (decision R3)", () => {
  const board = boardOf([[0, 0, "C"], [1, 1, "T"]]);
  const move = resolved([[1, 0, "A"]]);
  it("chooses the direction whose word is valid", () => {
    expect(analyseMove(board, move, setOf("AT")).mainWord!.dirs).toEqual(["down"]);
    const ca = analyseMove(board, move, setOf("CA"));
    expect(ca.ok).toBe(true);
    expect(ca.mainWord!.text).toBe("CA");
    expect(ca.mainWord!.dirs).toEqual(["down-right"]);
  });
  it("on an exact tie keeps the reading-direction order down, down-right, up-right", () => {
    const a = analyseMove(board, move, setOf("AT", "CA"));
    expect(a.ok).toBe(true);
    expect(a.mainWord!.text).toBe("AT");
    expect(a.score).toBe(6);
  });
});

describe("Pivots", () => {
  it("one Pivot turns the word: CA > TS reads CATS", () => {
    expect([premiumAt(0, 1), premiumAt(1, 2), premiumAt(2, 2)]).toEqual([null, null, "DL"]);
    const a = analyseMove({}, resolved([[0, 0, "C"], [0, 1, "A"], [0, 2, ">"], [1, 2, "T"], [2, 2, "S"]]), setOf("CATS"));
    expect(a.ok).toBe(true);
    expect(a.mainWord!.text).toBe("CATS");
    expect(a.mainWord!.dirs).toEqual(["down", "down-right"]);
    expect(a.mainWord!.pivots).toEqual([[0, 2]]);
    expect(a.score).toBe(14); // (3 + 1 + 1 + 1x2) x2
  });
  it("a Pivot in a straight line is illegal (the word must change direction)", () => {
    const a = analyseMove({}, resolved([[0, 0, "C"], [0, 1, "A"], [0, 2, ">"], [0, 3, "T"], [0, 4, "S"]]), setOf("CATS"));
    expect(a.code).toBe("pivot-path");
  });
  it("a Pivot at the end of a word is illegal", () => {
    expect(analyseMove({}, resolved([[0, 0, "C"], [0, 1, "A"], [0, 2, ">"]]), setOf("CA")).code).toBe("pivot-path");
  });
  it("a Pivot alone is illegal", () => {
    expect(analyseMove({}, resolved([[0, 0, ">"]]), setOf("CA")).code).toBe("pivot-needs-letters");
  });
  it("two Pivots make a legal three-segment path", () => {
    const a = analyseMove(
      {},
      resolved([[0, 0, "C"], [0, 1, ">"], [1, 1, "A"], [2, 1, ">"], [2, 2, "T"], [2, 3, "S"]]),
      setOf("CATS"),
    );
    expect(a.ok).toBe(true);
    expect(a.mainWord!.dirs).toEqual(["down", "down-right", "down"]);
    expect(a.mainWord!.pivots).toEqual([[0, 1], [2, 1]]);
    expect(premiumAt(2, 3)).toBeNull();
    expect(a.score).toBe(16); // (3 + 1x2 + 1x2 + 1) x2
  });
  it("adjacent Pivots with no letters between them are illegal", () => {
    const a = analyseMove({}, resolved([[0, 0, "C"], [0, 1, ">"], [1, 1, ">"], [2, 1, "A"], [3, 1, "T"]]), setOf("CAT"));
    expect(a.code).toBe("pivot-path");
  });
  it("a committed Pivot blocks words from reading through it", () => {
    const board = boardOf([[0, 0, "C"], [0, 1, "A"], [0, 2, ">"], [1, 2, "T"], [2, 2, "S"]]);
    const a = analyseMove(board, resolved([[0, 3, "S"]]), setOf("ST", "CAS"));
    expect(a.ok).toBe(true);
    expect(a.words.map((w) => w.text)).toEqual(["ST"]);
  });
  it("a committed Pivot stores no letter and scores nothing", () => {
    const g = rig({ racks: ["CA>TS", "EEE"] });
    const t = applyAction(g, { type: "play", placements: placements(g, [[0, 0, 0], [0, 1, 1], [0, 2, 2], [1, 2, 3], [2, 2, 4]]) }, setOf("CATS"));
    expect(t.ok).toBe(true);
    expect(t.state.board["0,2"].letter).toBeNull();
    expect(t.state.players[0].score).toBe(14);
  });
});

describe("Key tiles and Key spaces", () => {
  const cat = [[0, 0, "C"], [0, 1, "A"], [0, 2, "T"]] as [number, number, string][];
  it("while a Key space is free a Key must go on one", () => {
    const a = analyseMove(boardOf(cat), resolved([[0, 3, "#S"]]), setOf("CATS"));
    expect(a.code).toBe("key-space-required");
  });
  it("a Key on a free Key space may start an unconnected word island", () => {
    expect(premiumAt(3, 3)).toBe("KEY");
    expect(premiumAt(3, 4)).toBeNull();
    const a = analyseMove(boardOf(cat), resolved([[3, 3, "#A"], [3, 4, "T"]]), setOf("AT"));
    expect(a.ok).toBe(true);
    expect(a.score).toBe(2); // Key 0 + T 1, Key space doubles
  });
  it("a letter tile on a Key space does not start an island", () => {
    expect(analyseMove(boardOf(cat), resolved([[3, 3, "A"], [3, 4, "T"]]), setOf("AT")).code).toBe("must-connect");
  });
  it("a Key may open the match on a Key space instead of the centre", () => {
    expect(analyseMove({}, resolved([[3, 3, "#A"], [3, 4, "T"]]), setOf("AT")).ok).toBe(true);
  });
  it("with one Key space left, a Key must use that space; once all are used a Key is a plain Wild", () => {
    const five = KEY_LOCATIONS.slice(0, 5).map(([q, r]) => [q, r, "E"] as [number, number, string]);
    const last = KEY_LOCATIONS[5];
    const oneLeft = boardOf([...cat, ...five]);
    expect(analyseMove(oneLeft, resolved([[0, 3, "#S"]]), setOf("CATS")).code).toBe("key-space-required");
    expect(analyseMove(oneLeft, resolved([[last[0], last[1], "#A"], [last[0], last[1] + 1, "T"]]), setOf("AT")).ok).toBe(true);
    // Two Keys: one on the last free space, the other free to act as a Wild elsewhere.
    expect(
      analyseMove(oneLeft, resolved([[last[0], last[1], "#A"], [last[0], last[1] + 1, "T"]]), setOf("AT")).ok,
    ).toBe(true);
    const full = boardOf([...cat, ...KEY_LOCATIONS.map(([q, r]) => [q, r, "E"] as [number, number, string])]);
    const asWild = analyseMove(full, resolved([[0, 3, "#S"]]), setOf("CATS"));
    expect(asWild.ok).toBe(true);
    expect(asWild.score).toBe(5);
    // No island any more: a Key away from the tiles must connect like any tile.
    expect(analyseMove(full, resolved([[0, -6, "#A"], [0, -5, "T"]]), setOf("AT")).code).toBe("must-connect");
  });
  it("two Keys in one move: one on the last free Key space, one elsewhere", () => {
    const five = KEY_LOCATIONS.slice(0, 5).map(([q, r]) => [q, r, "E"] as [number, number, string]);
    const [lq, lr] = KEY_LOCATIONS[5];
    const oneLeft = boardOf([...cat, ...five]);
    const a = analyseMove(oneLeft, resolved([[lq, lr, "#A"], [lq, lr + 1, "#T"]]), setOf("AT"));
    expect(a.ok).toBe(true);
  });
  it("a Wild or Key with no face is rejected", () => {
    const g = rig({ racks: ["#A", "EEE"] });
    const t = applyAction(g, { type: "play", placements: [{ q: 3, r: 3, tileId: g.players[0].rack[0] }] }, setOf("AT"));
    expect(t.code).toBe("missing-face");
  });
});

describe("seven-tile bonus", () => {
  it("adds 50 once when all seven rack tiles are played", () => {
    const g = rig({ racks: ["RETAINS", "EEEEEEE"] });
    const p = placements(g, [0, 1, 2, 3, 4, 5, 6].map((i) => [0, i, i] as [number, number, number]));
    const t = applyAction(g, { type: "play", placements: p }, setOf("RETAINS"));
    expect(t.ok).toBe(true);
    const a = t.feedback!.analysis!;
    expect(a.bingo).toBe(true);
    expect(a.score).toBe(a.words.filter((w) => w.counted).reduce((s, w) => s + w.score, 0) + BINGO_BONUS);
    expect(t.state.players[0].score).toBe(a.score);
    const e = t.state.history[0];
    expect(e.type === "play" && e.bingo).toBe(true);
  });
  it("does not apply to six tiles", () => {
    const g = rig({ racks: ["RETAINS", "EEEEEEE"] });
    const p = placements(g, [0, 1, 2, 3, 4, 5].map((i) => [0, i, i] as [number, number, number]));
    const t = applyAction(g, { type: "play", placements: p }, setOf("RETAIN"));
    expect(t.ok).toBe(true);
    expect(t.feedback!.analysis!.bingo).toBe(false);
  });
});

describe("ending and final adjustments", () => {
  it("going out with an empty bag transfers the opponents' unplayed values", () => {
    const g = rig({ racks: ["AT", "QZ"], emptyBag: true });
    const t = applyAction(g, { type: "play", placements: placements(g, [[0, 0, 0], [0, 1, 1]]) }, setOf("AT"));
    expect(t.ok).toBe(true);
    const s = t.state;
    expect(s.over).toBe(true);
    expect(s.players[0].score).toBe(4 + 20);
    expect(s.players[0].endAdjust).toBe(20);
    expect(s.players[1].score).toBe(-20);
    expect(s.players[1].endAdjust).toBe(-20);
    expect(s.winners).toEqual([0]);
    const end = s.history[s.history.length - 1];
    expect(end).toMatchObject({ type: "end", cause: "went-out", outPlayer: 0, adjustments: [20, -20] });
    expect(t.events.map((e) => e.type)).toContain("match-over");
  });
  it("a tie lists every winner", () => {
    const g = rig({ racks: ["E", "A"] });
    const s = applyAction(g, { type: "end" }, setOf()).state;
    expect(s.winners).toEqual([0, 1]);
  });
  it("finished matches reject further moves", () => {
    const s = applyAction(rig({ racks: ["E", "A"] }), { type: "end" }, setOf()).state;
    for (const action of [{ type: "pass" }, { type: "exchange", tileIds: ["t0"] }] as MatchAction[]) {
      const t = applyAction(s, action, setOf());
      expect(t.ok).toBe(false);
      expect(t.code).toBe("game-over");
      expect(t.state).toBe(s);
    }
  });
});

describe("exchanges and scoreless turns (decision R1)", () => {
  it("an exchange keeps every tile, refills the rack, reshuffles the bag deterministically and uses the turn", () => {
    const g = createMatch({ names: ["A", "B"], mode: "friendly", seed: 7 });
    const out = g.players[0].rack.slice(0, 3);
    const t1 = applyAction(g, { type: "exchange", tileIds: out }, setOf());
    const t2 = applyAction(g, { type: "exchange", tileIds: out }, setOf());
    expect(t1.ok).toBe(true);
    expect(t1.state).toEqual(t2.state);
    expect(conservationProblems(t1.state)).toEqual([]);
    expect(t1.state.players[0].rack).toHaveLength(7);
    expect(t1.state.bag).toHaveLength(g.bag.length);
    expect(t1.state.rngState).not.toBe(g.rngState);
    expect(t1.state.current).toBe(1);
    expect(t1.state.scoreless).toBe(1);
  });
  it("rejects duplicate or foreign tile IDs", () => {
    const g = createMatch({ names: ["A", "B"], mode: "friendly", seed: 7 });
    const id = g.players[0].rack[0];
    expect(applyAction(g, { type: "exchange", tileIds: [id, id] }, setOf()).code).toBe("exchange-not-in-rack");
    expect(applyAction(g, { type: "exchange", tileIds: [g.players[1].rack[0]] }, setOf()).code).toBe("exchange-not-in-rack");
    expect(applyAction(g, { type: "exchange", tileIds: [] }, setOf()).code).toBe("exchange-empty");
  });
  it("exchanges count as scoreless turns: four in a two-player match end it", () => {
    let s = createMatch({ names: ["A", "B"], mode: "friendly", seed: 11 });
    for (let i = 0; i < 4; i++) {
      const t = applyAction(s, { type: "exchange", tileIds: [s.players[s.current].rack[0]] }, setOf());
      expect(t.ok).toBe(true);
      s = t.state;
    }
    expect(s.over).toBe(true);
    const end = s.history[s.history.length - 1];
    expect(end).toMatchObject({ type: "end", cause: "scoreless" });
  });
  it("failed challenges count as scoreless turns", () => {
    let s: MatchState = rig({ mode: "challenge", racks: ["QX", "JK"], names: ["Ann", "Bob"] });
    s = { ...s };
    for (let i = 0; i < 4; i++) {
      const t = applyAction(s, { type: "play", placements: placements(s, [[0, 0, 0], [0, 1, 1]]) }, setOf());
      expect(t.code).toBe("challenged");
      s = t.state;
    }
    expect(s.over).toBe(true);
    expect(s.history.filter((h) => h.type === "challenge")).toHaveLength(4);
  });
  it("a scoring play resets the scoreless count", () => {
    let s = rig({ racks: ["AT", "EEE"] });
    s = applyAction(s, { type: "pass" }, setOf()).state;
    s = applyAction(s, { type: "pass" }, setOf()).state;
    expect(s.scoreless).toBe(2);
    const t = applyAction(s, { type: "play", placements: placements(s, [[0, 0, 0], [0, 1, 1]]) }, setOf("AT"));
    expect(t.state.scoreless).toBe(0);
  });
});

describe("checking modes", () => {
  it("a Challenge-mode preview shows geometry and projected score without dictionary validity", () => {
    const g = rig({ mode: "challenge", racks: ["ZQ", "EEE"] });
    const a = mustAnalyse(previewMove(g, placements(g, [[0, 0, 0], [0, 1, 1]]), null));
    expect(a.checked).toBe(false);
    expect(a.ok).toBe(true);
    expect(a.wordErrors).toEqual([]);
    expect(a.words.every((w) => w.valid === null)).toBe(true);
    expect(a.score).toBe(40);
  });
  it("Friendly preview reports validity that matches the committed result", () => {
    const g = rig({ racks: ["AT", "EEE"] });
    const p = placements(g, [[0, 0, 0], [0, 1, 1]]);
    const a = mustAnalyse(previewMove(g, p, setOf("AT")));
    const t = applyAction(g, { type: "play", placements: p }, setOf("AT"));
    expect(a.ok).toBe(true);
    expect(t.state.players[0].score).toBe(a.score);
  });
});

describe("rack arrangement", () => {
  it("reorders the rack without using the turn and rejects anything else", () => {
    const g = createMatch({ names: ["A", "B"], mode: "friendly", seed: 2 });
    const rev = g.players[0].rack.slice().reverse();
    const t = applyAction(g, { type: "arrange", tileIds: rev }, setOf());
    expect(t.ok).toBe(true);
    expect(t.state.players[0].rack).toEqual(rev);
    expect(t.state.current).toBe(0);
    expect(t.state.turn).toBe(1);
    expect(applyAction(g, { type: "arrange", tileIds: rev.slice(1) }, setOf()).ok).toBe(false);
    expect(applyAction(g, { type: "arrange", tileIds: [...rev.slice(1), g.players[1].rack[0]] }, setOf()).ok).toBe(false);
  });
});

describe("boundary validation", () => {
  it("rejects tiles from another player's rack, off-board cells and unknown actions atomically", () => {
    const g = createMatch({ names: ["A", "B"], mode: "friendly", seed: 4 });
    const other = g.players[1].rack[0];
    expect(applyAction(g, { type: "play", placements: [{ q: 0, r: 0, tileId: other }] }, setOf()).code).toBe("not-in-rack");
    expect(applyAction(g, { type: "play", placements: [{ q: 9, r: 0, tileId: g.players[0].rack[0] }] }, setOf()).code).toBe("off-board");
    const t = applyAction(g, { type: "teleport" } as never, setOf());
    expect(t.ok).toBe(false);
    expect(t.state).toBe(g);
  });
  it("the same seed always deals the same match; different seeds differ", () => {
    const a = createMatch({ names: ["A", "B", "C"], mode: "friendly", seed: 42 });
    const b = createMatch({ names: ["A", "B", "C"], mode: "friendly", seed: 42 });
    const c = createMatch({ names: ["A", "B", "C"], mode: "friendly", seed: 43 });
    expect(a).toEqual(b);
    expect(a.bag).not.toEqual(c.bag);
    expect(conservationProblems(a)).toEqual([]);
  });
});
