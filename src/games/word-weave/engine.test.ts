import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { sessionOptionsFor } from "@/lib/progress/attempt";
import { buildBoard, connected, maximalRuns } from "./board";
import {
  createWordWeaveEngine,
  entryAt,
  HINT_BANK,
  HINT_LANE,
  HINT_LETTER,
  HINT_REVEAL_ALL,
  HINT_REVEAL_LANE,
  laneById,
  laneCorrect,
  type WeaveAction,
  type WeavePayload,
  type WeaveState,
} from "./engine";
import { rounds } from "./rounds";
import { validateContent } from "./validate";

const engine = createWordWeaveEngine();
const bundle = (id: string) => rounds.find((r) => r.meta.id === id)!;
const start = (id: string) => engine.initialise(bundle(id).payload, sessionOptionsFor(bundle(id).meta, 1));
const fillLane = (s: WeaveState, id: string, word: string) => {
  const lane = laneById(s, id)!;
  return engine.apply(s, { type: "fill", cells: lane.cells.map((c, i) => [c, word[i]] as [number, string]) });
};
const solve = (s: WeaveState, grid: Record<string, string>) => {
  for (const [id, w] of Object.entries(grid)) s = fillLane(s, id, w).state;
  return s;
};

describe("word weave geometry", () => {
  it("CRANE crosses BARK at A and BARK crosses KITE at K", () => {
    const s = start("wv-demo-1");
    const [a, b, c] = ["a", "b", "c"].map((id) => laneById(s, id)!);
    const ab = a.cells.filter((x) => b.cells.includes(x));
    const bc = b.cells.filter((x) => c.cells.includes(x));
    expect(ab).toHaveLength(1);
    expect(bc).toHaveLength(1);
    expect(a.cells.indexOf(ab[0])).toBe(2);
    expect(b.cells.indexOf(ab[0])).toBe(1);
    expect(b.cells.indexOf(bc[0])).toBe(3);
    expect(c.cells.indexOf(bc[0])).toBe(0);
    expect(s.solutions[0][ab[0]]).toBe("A");
    expect(s.solutions[0][bc[0]]).toBe("K");
  });

  it("SOLE crosses BOAT at O and BOAT crosses TIME at T", () => {
    const s = start("wv-demo-2");
    const [a, b, c] = ["a", "b", "c"].map((id) => laneById(s, id)!);
    const ab = a.cells.find((x) => b.cells.includes(x))!;
    const bc = b.cells.find((x) => c.cells.includes(x))!;
    expect(s.solutions[0][ab]).toBe("O");
    expect(s.solutions[0][bc]).toBe("T");
  });

  it("numbers lanes and detects uncued runs and disconnected boards", () => {
    const s = start("wv-s1");
    expect(s.lanes.map((l) => l.label)).toEqual(["1 Across", "4 Across", "5 Across", "1 Down", "2 Down", "3 Down"]);
    // An across lane next to a down lane creates an uncued run.
    const bad = buildBoard(3, 3, [
      { id: "x", direction: "across", row: 0, col: 0, length: 3, clue: "x" },
      { id: "y", direction: "across", row: 1, col: 0, length: 3, clue: "y" },
    ]);
    expect(maximalRuns(bad).filter((r) => r.startsWith("down"))).toHaveLength(3);
    expect(connected(bad)).toBe(false);
  });
});

describe("word weave play", () => {
  it("solves both fixtures and scores 100 unaided", () => {
    for (const id of ["wv-demo-1", "wv-demo-2"]) {
      let s = solve(start(id), bundle(id).payload.acceptedGrids[0]);
      const t = engine.apply(s, { type: "submit" });
      expect(t.ok).toBe(true);
      expect(t.code).toBe("complete");
      s = t.state;
      expect(engine.outcome(s)).toBe("completed");
      expect(engine.result(s)!.score).toBe(100);
      expect(engine.apply(s, { type: "submit" }).code).toBe("finished");
    }
  });

  it("a shared square holds one letter: overwriting it changes both lanes", () => {
    let s = start("wv-demo-1");
    s = fillLane(s, "a", "CRANE").state;
    const b = laneById(s, "b")!;
    expect(entryAt(s, b.cells[1])).toBe("A");
    s = fillLane(s, "b", "BORK").state; // overwrite shared A with O
    const a = laneById(s, "a")!;
    expect(entryAt(s, a.cells[2])).toBe("O");
  });

  it("rejects incomplete and wrong grids neutrally, keeps entries, and checks lanes as help", () => {
    let s = fillLane(start("wv-demo-1"), "a", "CRANE").state;
    const inc = engine.apply(s, { type: "submit" });
    expect(inc.ok).toBe(false);
    expect(inc.code).toBe("incomplete");
    expect(inc.message).toMatch(/squares? still empty/);
    s = solve(s, { b: "BARK", c: "KITS" });
    const wrong = engine.apply(s, { type: "submit" });
    expect(wrong.code).toBe("incorrect");
    expect(wrong.message).not.toContain("KITE");
    expect(wrong.state.entries).toEqual(s.entries);
    const chk = engine.apply(wrong.state, { type: "check", lane: "c" });
    expect(chk.message).toContain("1 square marked wrong");
    expect(chk.state.wrongMarks).toHaveLength(1);
    s = fillLane(chk.state, "c", "KITE").state;
    expect(s.wrongMarks).toHaveLength(0);
    s = engine.apply(s, { type: "submit" }).state;
    const r = engine.result(s)!;
    expect(r.outcome).toBe("completed");
    expect(r.assistance.hints).toBe(1);
    expect(r.details.join(" ")).toContain("1 earlier submission");
  });

  it("rejects bad input atomically", () => {
    const s = start("wv-demo-1");
    expect(engine.apply(s, { type: "fill", cells: [[0, "A"]] }).code).toBe("not-a-square");
    const a = laneById(s, "a")!;
    expect(engine.apply(s, { type: "fill", cells: [[a.cells[0], "7"]] }).code).toBe("non-letters");
    expect(engine.apply(s, { type: "fill", cells: [] }).state).toBe(s);
    expect(engine.preview(s, "a:CRAN").code).toBe("wrong-length");
    expect(engine.preview(s, "a:CRANE").legal).toBe(true);
  });

  it("hint ladder: suggest the best-supported lane, reveal a letter, reveal a lane; revealed squares are locked and unscored", () => {
    let s = fillLane(start("wv-s1"), "a00", "SWEEP").state;
    const h1 = engine.apply(s, { type: "hint", tier: HINT_LANE });
    expect(h1.ok).toBe(true);
    // Lanes crossing SWEEP have one supported letter each; the hint names a down lane.
    expect(h1.message).toMatch(/Try \d Down/);
    s = h1.state;
    const lane = laneById(s, s.hintLane!)!;
    const h2 = engine.apply(s, { type: "hint", tier: HINT_LETTER });
    expect(h2.ok).toBe(true);
    s = h2.state;
    expect(s.revealed).toHaveLength(1);
    const locked = engine.apply(s, { type: "fill", cells: [[s.revealed[0], "Z"]] });
    expect(locked.code).toBe("revealed-square");
    const h3 = engine.apply(s, { type: "hint", tier: HINT_REVEAL_LANE });
    expect(h3.ok).toBe(true);
    s = h3.state;
    expect(laneCorrect(s, lane)).toBe(true);
    // SWEEP's shared square was already right, so it is not counted as revealed.
    expect(s.revealed).toHaveLength(lane.length - 1);
    s = solve(s, bundle("wv-s1").payload.acceptedGrids[0]);
    const done = engine.apply(s, { type: "submit" });
    expect(done.ok).toBe(true);
    expect(engine.result(done.state)!.score).toBe(Math.floor((100 * (21 - 4)) / 21));
  });

  it("reveal everything ends as revealed and keeps earlier correct squares scoring", () => {
    let s = fillLane(start("wv-demo-1"), "a", "CRANE").state;
    s = engine.apply(s, { type: "hint", tier: HINT_REVEAL_ALL }).state;
    expect(engine.outcome(s)).toBe("revealed");
    const r = engine.result(s)!;
    expect(r.outcome).toBe("revealed");
    expect(r.score).toBe(Math.floor((100 * 5) / 11));
    for (const w of ["CRANE", "BARK", "KITE"]) expect(r.shareText).not.toContain(w);
  });

  it("gentle rounds offer a word bank recorded as a hint", () => {
    const s = start("wv-g1");
    const t = engine.apply(s, { type: "hint", tier: HINT_BANK });
    expect(t.ok).toBe(true);
    expect(t.message).toContain("Word bank:");
    expect(engine.apply(t.state, { type: "hint", tier: HINT_BANK }).ok).toBe(false);
    expect(engine.hints(start("wv-s1")).some((h) => h.tier === HINT_BANK)).toBe(false);
  });

  it("accepts a listed alternative complete grid", () => {
    const p: WeavePayload = {
      ...bundle("wv-demo-1").payload,
      acceptedGrids: [...bundle("wv-demo-1").payload.acceptedGrids, { a: "CRANE", b: "PARK", c: "KITE" }],
    };
    let s = engine.initialise(p, sessionOptionsFor(bundle("wv-demo-1").meta, 1));
    s = solve(s, { a: "CRANE", b: "PARK", c: "KITE" });
    expect(engine.apply(s, { type: "submit" }).code).toBe("complete");
  });
});

describe("content", () => {
  it("every round validates, at least four per difficulty", () => {
    expect(validateContent()).toEqual([]);
  });

  it("has twelve master and eighteen expert rounds with large lattices", () => {
    expect(rounds.filter((r) => r.meta.difficulty === "master")).toHaveLength(12);
    expect(rounds.filter((r) => r.meta.difficulty === "expert").length).toBeGreaterThanOrEqual(18);
    for (const { meta, payload } of rounds.filter((r) => r.meta.difficulty === "master")) expect(payload.lanes.length, meta.id).toBeGreaterThanOrEqual(8);
  });

  it("every accepted grid completes through the engine", () => {
    for (const { meta, payload } of rounds)
      for (const g of payload.acceptedGrids) {
        const s = solve(engine.initialise(payload, sessionOptionsFor(meta, 1)), g);
        expect(engine.apply(s, { type: "submit" }).code, meta.id).toBe("complete");
      }
  });
});

describe("invariants", () => {
  it("random fills never break atomicity, and revealed squares never change", () => {
    const s0 = start("wv-e1");
    const act: fc.Arbitrary<WeaveAction> = fc.oneof(
      fc.tuple(fc.constantFrom(...s0.active), fc.constantFrom("", "A", "E", "T", "Z")).map(([c, l]) => ({ type: "fill" as const, cells: [[c, l]] as [number, string][] })),
      fc.constantFrom(...s0.lanes.map((l) => l.id)).map((lane) => ({ type: "check" as const, lane })),
      fc.constant({ type: "hint" as const, tier: HINT_LETTER }),
      fc.constant({ type: "submit" as const }),
    );
    fc.assert(
      fc.property(fc.array(act, { maxLength: 40 }), (actions) => {
        let s = s0;
        for (const a of actions) {
          const t = engine.apply(s, a);
          if (!t.ok) expect(t.state).toBe(s);
          for (const c of s.revealed) expect(entryAt(t.state, c)).toBe(entryAt(s, c));
          s = t.state;
        }
      }),
      { numRuns: 150 },
    );
  });
});
