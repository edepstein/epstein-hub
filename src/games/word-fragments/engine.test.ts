import { describe, expect, it } from "vitest";
import { sessionOptionsFor } from "@/lib/progress/attempt";
import { loadFamiliarSync, loadMembershipSync } from "@/lib/dictionary/node";
import {
  createWordFragmentsEngine,
  HINT_COMPLETE_LANE,
  HINT_FIRST_TILE,
  HINT_LANE,
  HINT_REVEAL,
  laneText,
  trayTiles,
  type FragAction,
  type FragPayload,
  type FragState,
} from "./engine";
import { rounds } from "./rounds";
import { acceptedTextAllocations, checkFragmentsRound, validateContent } from "./validate";

const engine = createWordFragmentsEngine();
const bundle = (id: string) => rounds.find((r) => r.meta.id === id)!;
const init = (p: FragPayload, seed = 1) => engine.initialise(p, sessionOptionsFor(bundle("wf-demo-1").meta, seed));
const start = (id: string) => init(bundle(id).payload);
function play(s: FragState, actions: FragAction[]) {
  for (const a of actions) {
    const t = engine.apply(s, a);
    expect(t.ok, `${JSON.stringify(a)}: ${t.message}`).toBe(true);
    s = t.state;
  }
  return s;
}
const place = (tile: string, lane: string, index?: number): FragAction => ({ type: "place", tile, lane, index });
/** Place the stored example allocation. */
const solveActions = (p: FragPayload) => Object.entries(p.allocations[0]).flatMap(([lane, ids]) => ids.map((id) => place(id, lane)));
const idsByText = (s: FragState, text: string) => Object.keys(s.tiles).filter((id) => s.tiles[id] === text);

describe("Word Fragments rules", () => {
  it("builds BANKNOTE, RAINBOW, SUNFLOWER and BOOKMARK, BUTTERFLY, SEASHELL", () => {
    for (const id of ["wf-demo-1", "wf-demo-2"]) {
      let s = start(id);
      s = play(s, solveActions(bundle(id).payload));
      expect(trayTiles(s)).toEqual([]);
      s = play(s, [{ type: "submit" }]);
      expect(engine.outcome(s)).toBe("completed");
      expect(engine.result(s)!.score).toBe(100);
    }
    const s = play(start("wf-demo-1"), solveActions(bundle("wf-demo-1").payload));
    expect(["a", "b", "c"].map((l) => laneText(s, l))).toEqual(["BANKNOTE", "RAINBOW", "SUNFLOWER"]);
  });

  it("each tile is used once: placing t1 again moves it rather than copying it", () => {
    let s = play(start("wf-demo-1"), [place("t1", "a")]);
    s = play(s, [place("t1", "c")]);
    expect(s.placed.a).toEqual([]);
    expect(s.placed.c).toEqual(["t1"]);
    expect(Object.values(s.placed).flat().filter((id) => id === "t1")).toHaveLength(1);
  });

  it("rejects overfilling a lane and keeps the board", () => {
    const s = play(start("wf-demo-1"), [place("t1", "b"), place("t4", "b")]);
    const t = engine.apply(s, place("t2", "b"));
    expect(t.ok).toBe(false);
    expect(t.code).toBe("too-long");
    expect(t.state).toBe(s);
  });

  it("submit requires every fragment used and every lane correct, without pinpointing", () => {
    let s = play(start("wf-demo-1"), [place("t1", "a"), place("t2", "a")]);
    expect(engine.apply(s, { type: "submit" }).code).toBe("tiles-left");
    // Wrong but complete board: SUN+FLOW+ER swapped with RAIN+BOW lengths differ → wrong-length
    s = play(start("wf-demo-1"), [place("t2", "a"), place("t1", "a"), place("t3", "b"), place("t4", "b"), place("t5", "c"), place("t6", "c"), place("t7", "c")]);
    const t = engine.apply(s, { type: "submit" });
    expect(t.code).toBe("not-yet");
    expect(t.message).not.toMatch(/answer 1|NOTEBANK/);
  });

  it("identical-looking tiles are distinct and interchangeable", () => {
    const s0 = start("wf-e1");
    const keys = idsByText(s0, "KEY");
    expect(keys).toHaveLength(4);
    const opens = ["MON", "DON", "TUR", "HOC"];
    const lanes = ["a", "b", "c", "d"];
    // Use the KEY tiles in reverse order compared with the example allocation.
    const actions: FragAction[] = lanes.flatMap((l, i) => [place(idsByText(s0, opens[i])[0], l), place(keys[3 - i], l)]);
    const s = play(s0, [...actions, { type: "submit" }]);
    expect(engine.outcome(s)).toBe("completed");
  });

  it("exchanging positions inside a lane and between lanes, then undo restores the previous allocation", () => {
    let s = play(start("wf-demo-1"), [place("t2", "a"), place("t1", "a", 0)]);
    expect(laneText(s, "a")).toBe("BANKNOTE");
    s = play(s, [place("t1", "b")]);
    expect(laneText(s, "a")).toBe("NOTE");
    s = play(s, [{ type: "undo" }]);
    expect(laneText(s, "a")).toBe("BANKNOTE");
    s = play(s, [{ type: "remove", tile: "t1" }, { type: "undo" }]);
    expect(laneText(s, "a")).toBe("BANKNOTE");
  });

  it("lane checks count as assistance and undo still works after checking", () => {
    let s = play(start("wf-demo-1"), [place("t1", "a"), place("t2", "a"), { type: "check-lane", lane: "a" }]);
    expect(s.laneChecks).toBe(1);
    s = play(s, [{ type: "undo" }]);
    expect(laneText(s, "a")).toBe("BANK");
    s = play(s, [place("t2", "a"), ...solveActions(bundle("wf-demo-1").payload).slice(2), { type: "submit" }]);
    const r = engine.result(s)!;
    expect(r.score).toBe(100);
    expect(r.assistance.hints).toBe(1);
    expect(r.headline).toContain("help");
  });

  it("hints: lane, first fragment (stated source), complete-and-lock (visible moves), reveal", () => {
    let s = start("wf-s1");
    expect(engine.apply(s, { type: "hint", tier: HINT_FIRST_TILE }).code).toBe("hint-unavailable");
    let t = engine.apply(s, { type: "hint", tier: HINT_LANE });
    expect(t.message).toContain("answer 1");
    s = t.state;
    // Put CAR in lane a first, so the first-fragment hint must move GAR there visibly.
    s = play(s, [place(idsByText(s, "CAR")[0], "a")]);
    t = engine.apply(s, { type: "hint", tier: HINT_FIRST_TILE });
    expect(t.message).toContain("GAR starts answer 1");
    s = t.state;
    expect(laneText(s, "a")).toBe("GARCAR".slice(0, 3) + "CAR");
    t = engine.apply(s, { type: "hint", tier: HINT_COMPLETE_LANE });
    expect(t.message).toContain("GAR + DEN = GARDEN");
    s = t.state;
    expect(s.locked).toEqual(["a"]);
    expect(laneText(s, "a")).toBe("GARDEN");
    expect(Object.values(s.placed).flat()).toHaveLength(new Set(Object.values(s.placed).flat()).size);
    expect(engine.apply(s, place(idsByText(s, "GAR")[0], "b")).code).toBe("tile-locked");
    expect(engine.apply(s, place(idsByText(s, "CAR")[0], "a")).code).toBe("lane-locked");
    s = play(s, [{ type: "hint", tier: HINT_REVEAL }]);
    expect(engine.outcome(s)).toBe("revealed");
    expect(["a", "b", "c"].map((l) => laneText(s, l))).toEqual(["GARDEN", "CARPET", "BASKET"]);
    expect(engine.result(s)!.score).toBe(0);
    expect(engine.apply(s, { type: "submit" }).code).toBe("finished");
  });

  it("restores exactly by replaying actions, including the seeded tray order", () => {
    const actions: FragAction[] = [place("t3", "a"), place("t5", "b", 0), { type: "undo" }, { type: "hint", tier: HINT_LANE }, { type: "check-lane", lane: "a" }];
    const a = play(init(bundle("wf-s3").payload, 42), actions);
    const b = play(init(bundle("wf-s3").payload, 42), actions);
    expect(b).toEqual(a);
    expect(trayTiles(a)).toHaveLength(Object.keys(a.tiles).length - 1);
  });
});

describe("Word Fragments content and solver", () => {
  const membership = loadMembershipSync();
  const familiar = loadFamiliarSync();
  it("all rounds validate and play to completion from their example allocation", () => {
    expect(validateContent()).toEqual([]);
    for (const r of rounds) {
      const s = play(init(r.payload), [...solveActions(r.payload), { type: "submit" }]);
      expect(engine.outcome(s), r.meta.id).toBe("completed");
    }
  });

  it("uniqueness claims are proven by the solver", () => {
    for (const r of rounds) if (r.payload.claimsUnique) expect(acceptedTextAllocations(r.payload)).toHaveLength(1);
  });

  it("has at least four practice rounds per difficulty", () => {
    for (const d of ["gentle", "standard", "expert"]) expect(rounds.filter((r) => r.meta.difficulty === d && r.meta.status === "practice").length).toBeGreaterThanOrEqual(4);
  });

  const broken = (mut: (p: FragPayload) => void) => {
    const p = structuredClone(bundle("wf-demo-1").payload);
    mut(p);
    return checkFragmentsRound({ id: "x", status: "demo", title: "t" }, p, membership, familiar).join(" ");
  };
  it("rejects reused tiles, unused fragments, inserted letters and false uniqueness claims", () => {
    expect(broken((p) => (p.allocations[0].b = ["t1", "t4"]))).toContain("every tile exactly once");
    expect(broken((p) => p.tiles.push({ id: "t8", text: "X" }))).toContain("fragments hold");
    expect(broken((p) => (p.acceptedAnswers.c = ["SUNFLOWERS"]))).toContain("enumeration");
    expect(broken((p) => (p.tiles[0].id = "t2"))).toContain("unique");
    // Two interchangeable fragment sharings: claim must fail.
    const amb: FragPayload = {
      lanes: [
        { id: "a", clue: "x", length: 4 },
        { id: "b", clue: "y", length: 4 },
      ],
      tiles: [
        { id: "t1", text: "AB" },
        { id: "t2", text: "AB" },
        { id: "t3", text: "A" },
        { id: "t4", text: "BAB" },
      ],
      acceptedAnswers: { a: ["ABAB"], b: ["ABAB"] },
      allocations: [{ a: ["t1", "t2"], b: ["t3", "t4"] }],
      claimsUnique: true,
      explanation: "",
    };
    expect(acceptedTextAllocations(amb).length).toBeGreaterThan(1);
    expect(checkFragmentsRound({ id: "amb", status: "demo", title: "t" }, amb, new Set(["ABAB"]), new Set()).join(" ")).toContain("claims a unique solution");
  });
});
