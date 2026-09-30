import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { loadMembershipSync } from "@/lib/dictionary/node";
import { sessionOptionsFor } from "@/lib/progress/attempt";
import {
  complete,
  createHiddenWordTrailEngine,
  feasibleAfter,
  HINT_HALF,
  HINT_REVEAL,
  HINT_REVEAL_ALL,
  HINT_START,
  solvedCells,
  type TrailAction,
  type TrailPayload,
  type TrailState,
} from "./engine";
import { rounds } from "./rounds";
import { enumeratePaths, exactCover, geometryFromGrid, spell, toIndex } from "./solver";
import { validateContent } from "./validate";

const membership = loadMembershipSync();
const engine = createHiddenWordTrailEngine(membership);
const bundle = (id: string) => rounds.find((r) => r.meta.id === id)!;
const start = (id: string) => engine.initialise(bundle(id).payload, sessionOptionsFor(bundle(id).meta, 1));
const idx = (s: TrailState, cells: [number, number][]) => cells.map(([r, c]) => r * s.cols + c);
const submit = (s: TrailState, cells: [number, number][]) => engine.apply(s, { type: "submit", path: idx(s, cells) });

const TINY: TrailPayload = {
  grid: ["CAT", "ATE"],
  theme: "Test",
  answers: [
    { word: "CAT", path: [[0, 0], [0, 1], [0, 2]] },
    { word: "ATE", path: [[1, 0], [1, 1], [1, 2]] },
  ],
  bonusPolicy: "membership",
  bonusMinLength: 4,
  creditsPerHint: 3,
  explanation: "",
};
const tinyEngine = createHiddenWordTrailEngine(new Set(["CATE"]));
const tiny = () => tinyEngine.initialise(TINY, sessionOptionsFor(bundle("hwt-g1").meta, 1));

describe("hidden word trail geometry", () => {
  it("accepts diagonal steps and rejects jumps, reuse and too-short trails with precise codes", () => {
    const s = start("hwt-demo-2"); // serpentine-garden
    const jump = submit(s, [[0, 0], [0, 2], [0, 3]]);
    expect(jump.ok).toBe(false);
    expect(jump.code).toBe("not-adjacent");
    expect(jump.message).toContain("does not touch");
    expect(jump.state).toBe(s);
    const reuse = submit(s, [[0, 0], [0, 1], [0, 0]]);
    expect(reuse.code).toBe("repeated-cell");
    expect(submit(s, [[0, 0], [1, 1]]).code).toBe("too-short");
    expect(engine.apply(s, { type: "submit", path: [] }).code).toBe("empty");
    expect(engine.apply(s, { type: "submit", path: [0, 1, 99] }).code).toBe("out-of-bounds");
    // Diagonal: TREE starts (1,2) T -> (1,1) R -> (1,0) E -> (2,0) E; (1,0)->(2,0) is vertical, (0,1)->(1,2) diagonal is legal geometry.
    expect(engine.preview(s, idx(s, [[0, 1], [1, 2], [2, 3]])).legal).toBe(true);
  });

  it("solves the serpentine fixture with every reference path and covers all sixteen cells", () => {
    let s = start("hwt-demo-2");
    for (const a of bundle("hwt-demo-2").payload.answers) {
      const t = submit(s, a.path as [number, number][]);
      expect(t.ok, a.word).toBe(true);
      s = t.state;
    }
    expect(complete(s)).toBe(true);
    expect(solvedCells(s).size).toBe(16);
    expect(engine.outcome(s)).toBe("completed");
    const r = engine.result(s)!;
    expect(r.assistance).toEqual({ hints: 0, reveals: 0 });
    expect(r.shareText).not.toMatch(/GRASS|TREE|FLOWERS/);
  });

  it("straight-row fixtures are tutorial cases", () => {
    for (const id of ["hwt-demo-1", "hwt-demo-3"]) {
      let s = start(id);
      for (const a of bundle(id).payload.answers) s = submit(s, a.path as [number, number][]).state;
      expect(complete(s)).toBe(true);
    }
  });

  it("prevents overlap with a found word and rejects duplicates", () => {
    let s = start("hwt-demo-1");
    s = submit(s, [[0, 0], [0, 1], [0, 2], [0, 3]]).state; // TREE
    const overlap = submit(s, [[0, 0], [1, 1], [2, 2]]);
    expect(overlap.code).toBe("uses-solved");
    expect(overlap.message).toContain("already belongs to a found word");
    const dup = engine.apply(s, { type: "submit", path: idx(s, [[0, 0], [0, 1], [0, 2], [0, 3]]) });
    expect(dup.code).toBe("uses-solved");
  });

  it("accepts an alternative route that leaves a solution and rejects one that strands the puzzle", () => {
    const s = tiny();
    const alt = tinyEngine.apply(s, { type: "submit", path: [0, 3, 4] }); // C(0,0) A(1,0) T(1,1)
    expect(alt.ok).toBe(true);
    expect(feasibleAfter(alt.state, null, null)).toBe(true);
    const done = tinyEngine.apply(alt.state, { type: "submit", path: [1, 2, 5] }); // A(0,1) T(0,2) E(1,2)
    expect(done.ok).toBe(true);
    expect(complete(done.state)).toBe(true);

    const strand = tinyEngine.apply(s, { type: "submit", path: [0, 1, 4] }); // C A(0,1) T(1,1)
    expect(strand.ok).toBe(false);
    expect(strand.code).toBe("blocks-others");
    expect(strand.message).toContain("Try another route for CAT");
    expect(strand.state).toBe(s);

    const serp = start("hwt-demo-1");
    // TREE via the diagonal E at (1,1) strands LEAF.
    expect(submit(serp, [[0, 0], [0, 1], [1, 1], [0, 2]]).code).toBe("blocks-others");
  });

  it("restoring the same accepted routes reproduces the same feasibility state", () => {
    const s = tiny();
    const a1: TrailAction = { type: "submit", path: [0, 3, 4] };
    const once = tinyEngine.apply(s, a1).state;
    const replayed = tinyEngine.apply(tiny(), a1).state;
    expect(replayed).toEqual(once);
    expect(feasibleAfter(replayed, [1, 2, 5], "ATE")).toBe(true);
    expect(feasibleAfter(replayed, [1, 2], null)).toBe(false);
  });
});

describe("non-theme words and hints", () => {
  it("demo rounds have no bonus words", () => {
    const s = start("hwt-demo-1");
    const t = submit(s, [[1, 0], [1, 1], [1, 2]]); // LEA
    expect(t.code).toBe("not-theme");
    expect(t.message).toContain("no bonus words");
  });

  it("bonus credits count once per word and three earn a hint that is not counted as help", () => {
    const s0 = start("hwt-g1");
    const geo = geometryFromGrid(bundle("hwt-g1").payload.grid);
    const targets = new Set(s0.answers.map((a) => a.word));
    const bonus: number[][] = [];
    for (const w of membership) {
      if (w.length < 4 || w.length > 6 || targets.has(w)) continue;
      const p = enumeratePaths(geo, w, new Set(), 1);
      if (p.length) bonus.push(p[0]);
      if (bonus.length === 3) break;
    }
    expect(bonus).toHaveLength(3);
    let s = engine.apply(s0, { type: "submit", path: bonus[0] }).state;
    expect(s.bonus).toHaveLength(1);
    const again = engine.apply(s, { type: "submit", path: bonus[0] });
    expect(again.code).toBe("bonus-duplicate");
    s = engine.apply(s, { type: "submit", path: bonus[1] }).state;
    const third = engine.apply(s, { type: "submit", path: bonus[2] });
    expect(third.code).toBe("bonus-hint");
    s = third.state;
    const h = engine.apply(s, { type: "hint", tier: HINT_START });
    expect(h.ok).toBe(true);
    expect(h.state.hints[0].earned).toBe(true);
    expect(h.state.tokensSpent).toBe(1);
    // Short non-theme strings and non-words are rejected with reasons.
    const tn = tiny();
    expect(tinyEngine.apply(tn, { type: "submit", path: [1, 0, 3] }).code).toBe("not-theme"); // ACA: 3 letters
    expect(tinyEngine.apply(tn, { type: "submit", path: [0, 1, 2, 5] }).code).toBe("bonus"); // CATE
    expect(tinyEngine.apply(tn, { type: "submit", path: [3, 4, 5, 2] }).code).toBe("not-a-word"); // ATET
  });

  it("hint ladder marks a start, then half a trail, then reveals a word as assisted", () => {
    let s = start("hwt-s1");
    expect(engine.apply(s, { type: "hint", tier: HINT_HALF }).code).toBe("hint-unavailable");
    const h1 = engine.apply(s, { type: "hint", tier: HINT_START });
    expect(h1.ok).toBe(true);
    expect(h1.message).toMatch(/starts at . \(row \d, column \d\)/);
    expect(h1.message).toContain("Clue:");
    s = h1.state;
    const focus = s.hintFocus!;
    expect(engine.apply(s, { type: "hint", tier: HINT_START }).code).toBe("hint-unavailable");
    s = engine.apply(s, { type: "hint", tier: HINT_HALF }).state;
    expect(s.hintLevel).toBe(2);
    const rev = engine.apply(s, { type: "hint", tier: HINT_REVEAL });
    expect(rev.ok).toBe(true);
    s = rev.state;
    expect(s.found[0]).toEqual({ word: focus.word, path: focus.path, assisted: true });
    // The theme-defining word is never the first hint focus.
    const e = start("hwt-e1");
    expect(e.answers.find((a) => a.word === engine.apply(e, { type: "hint", tier: HINT_START }).state.hintFocus!.word)!.themeDefining).toBe(false);
  });

  it("reveal everything completes as revealed; the result is honest and spoiler-free", () => {
    let s = start("hwt-g2");
    s = submit(s, bundle("hwt-g2").payload.answers[0].path as [number, number][]).state;
    const t = engine.apply(s, { type: "hint", tier: HINT_REVEAL_ALL });
    expect(t.ok).toBe(true);
    expect(engine.outcome(t.state)).toBe("revealed");
    const r = engine.result(t.state)!;
    expect(r.outcome).toBe("revealed");
    expect(r.assistance.reveals).toBe(4);
    expect(r.score).toBe(1);
    for (const a of t.state.answers) expect(r.shareText).not.toContain(a.word);
    expect(engine.apply(t.state, { type: "submit", path: [0, 1, 2] }).code).toBe("complete");
  });

  it("hints follow the player's own routes: after an alternative route the revealed path is still feasible", () => {
    let s = tiny();
    s = tinyEngine.apply(s, { type: "submit", path: [0, 3, 4] }).state;
    const r = tinyEngine.apply(s, { type: "hint", tier: HINT_REVEAL });
    expect(r.ok).toBe(true);
    expect(r.state.found[1].path).toEqual([1, 2, 5]);
    expect(complete(r.state)).toBe(true);
  });
});

describe("content", () => {
  it("every round validates and has at least four rounds per difficulty", () => {
    expect(validateContent()).toEqual([]);
  });

  it("every practice board has exactly the listed words tiling it (exact-cover proof)", () => {
    for (const { meta, payload } of rounds) {
      const geo = geometryFromGrid(payload.grid);
      const cover = exactCover(geo, payload.answers.map((a) => a.word), new Set(), 5);
      expect(cover.count, meta.id).toBeGreaterThan(0);
      for (const a of payload.answers) expect(spell(geo, a.path.map((c) => toIndex(geo, c as [number, number]))), meta.id).toBe(a.word);
    }
  });

  it("every round can be completed by replaying its reference paths", () => {
    for (const { meta, payload } of rounds) {
      let s = engine.initialise(payload, sessionOptionsFor(meta, 1));
      for (const a of payload.answers) {
        const t = submit(s, a.path as [number, number][]);
        expect(t.ok, `${meta.id} ${a.word}: ${t.message}`).toBe(true);
        s = t.state;
      }
      expect(engine.outcome(s)).toBe("completed");
    }
  });
});

describe("invariants", () => {
  it("random trails never break atomicity, overlap or remaining feasibility", () => {
    const b = bundle("hwt-s2");
    const s0 = engine.initialise(b.payload, sessionOptionsFor(b.meta, 1));
    const n = s0.letters.length;
    const geo = geometryFromGrid(b.payload.grid);
    const targetPaths = s0.answers.flatMap((a) => enumeratePaths(geo, a.word));
    const pathArb = fc.oneof(fc.array(fc.integer({ min: 0, max: n - 1 }), { minLength: 0, maxLength: 7 }), fc.constantFrom(...targetPaths));
    fc.assert(
      fc.property(fc.array(pathArb, { maxLength: 25 }), (paths) => {
        let s = s0;
        for (const p of paths) {
          const t = engine.apply(s, { type: "submit", path: p });
          if (!t.ok) expect(t.state).toBe(s);
          s = t.state;
          const cells = s.found.flatMap((f) => f.path);
          expect(new Set(cells).size).toBe(cells.length);
          expect(feasibleAfter(s, null, null)).toBe(true);
        }
      }),
      { numRuns: 150 },
    );
  });
});
