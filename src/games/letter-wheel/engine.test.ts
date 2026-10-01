import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { loadMembershipSync } from "@/lib/dictionary/node";
import { createLetterWheelEngine, HINT_DEFINE, HINT_HALF, HINT_NINE, HINT_REVEAL, HINT_START, positionsUsed, scoreWord, type WheelPayload, type WheelState } from "./engine";
import { rounds } from "./rounds";
import { sessionOptionsFor } from "@/lib/progress/attempt";

const membership = loadMembershipSync();
const engine = createLetterWheelEngine(membership);
const bundle = (id: string) => rounds.find((r) => r.meta.id === id)!;
const start = (id: string, seed = 1) => {
  const b = bundle(id);
  return engine.initialise(b.payload, sessionOptionsFor(b.meta, seed));
};
const submit = (s: WheelState, word: string) => engine.apply(s, { type: "submit", word });

describe("letter wheel rules", () => {
  it("accepts a valid word, scores its length and clears nothing else", () => {
    const s = start("lw-demo-1");
    const t = submit(s, "action");
    expect(t.ok).toBe(true);
    expect(t.state.found).toEqual([{ word: "ACTION", points: 6, assisted: false, target: true }]);
  });

  it("rejects each failure with a precise code and leaves state untouched", () => {
    const s = start("lw-demo-1");
    const cases: [string, string][] = [
      ["", "empty"],
      ["don't", "non-letters"],
      ["cat", "too-short"],
      ["duct", "missing-required"],
      ["aaaa", "letter-unavailable"],
      ["zeta", "letter-unavailable"],
      ["cadui", "not-in-word-list"],
    ];
    for (const [w, code] of cases) {
      const t = submit(s, w);
      expect(t.ok, w).toBe(false);
      expect(t.code, w).toBe(code);
      expect(t.state).toBe(s);
      expect(t.message.length).toBeGreaterThan(10);
    }
  });

  it("never scores a duplicate twice", () => {
    let s = start("lw-demo-1");
    s = submit(s, "ACTION").state;
    const t = submit(s, "action");
    expect(t.ok).toBe(false);
    expect(t.code).toBe("duplicate");
    expect(t.state.found).toHaveLength(1);
  });

  it("rejects a second A when the rack has one, permits it when there are two", () => {
    const one: WheelPayload = { letters: "ABCDEFGHI".split(""), requiredIndex: 0, minimumLength: 4, targets: ["ABED"], nineLetterAnswers: [], explanation: "" };
    const eng = createLetterWheelEngine(new Set(["ABED", "BAAED", "ABACI"]));
    const s1 = eng.initialise(one, sessionOptionsFor({ ...bundle("lw-demo-1").meta }, 1));
    expect(eng.apply(s1, { type: "submit", word: "ABACI" }).code).toBe("letter-unavailable");
    const two: WheelPayload = { ...one, letters: "ABCDEFGIA".split("") };
    const s2 = eng.initialise(two, sessionOptionsFor({ ...bundle("lw-demo-1").meta }, 1));
    expect(eng.apply(s2, { type: "submit", word: "ABACI" }).ok).toBe(true);
  });

  it("accepts both CREATIONS and REACTIONS with the nine-letter bonus", () => {
    let s = start("lw-demo-2");
    const a = submit(s, "creations");
    expect(a.ok).toBe(true);
    expect(a.state.found[0].points).toBe(18);
    s = a.state;
    const b = submit(s, "reactions");
    expect(b.ok).toBe(true);
    expect(b.state.found[1].points).toBe(18);
  });

  it("reproduces every demo fixture's stored maximumScore from its fixture lexicon", () => {
    for (const r of rounds.filter((x) => x.meta.status === "demo")) {
      const total = r.payload.fixtureLexicon!.reduce((acc, w) => acc + scoreWord(w), 0);
      expect(total, r.meta.id).toBe(r.payload.fixtureMaximumScore);
    }
  });

  it("accepts a common word the demo fixture omitted (production membership)", () => {
    const s = start("lw-demo-1");
    // OCEAN is not in the education fixture's finite list but is a real word on the rack.
    expect(bundle("lw-demo-1").payload.fixtureLexicon).not.toContain("OCEAN");
    expect(submit(s, "ocean").ok).toBe(true);
  });

  it("shuffle changes presentation only and rejects non-permutations", () => {
    const s = start("lw-g1");
    const t = engine.apply(s, { type: "shuffle", order: [8, 7, 6, 5, 4, 3, 2, 1, 0] });
    expect(t.ok).toBe(true);
    expect(t.state.lexicon).toEqual(s.lexicon);
    expect(engine.apply(s, { type: "shuffle", order: [0, 0, 1, 2, 3, 4, 5, 6, 7] }).ok).toBe(false);
  });

  it("initial display order is seeded and never regenerates on replay", () => {
    expect(start("lw-g1", 42).order).toEqual(start("lw-g1", 42).order);
  });

  it("hint ladder: start letter, half, reveal (0 points, assisted, counts to completion)", () => {
    let s = start("lw-demo-1");
    expect(engine.apply(s, { type: "hint", tier: HINT_HALF }).code).toBe("hint-unavailable");
    const h1 = engine.apply(s, { type: "hint", tier: HINT_START });
    expect(h1.ok).toBe(true);
    s = h1.state;
    const focus = s.hintFocus!;
    expect(h1.message).toContain(focus[0]);
    expect(engine.apply(s, { type: "hint", tier: HINT_START }).ok).toBe(false); // no repeated charge
    s = engine.apply(s, { type: "hint", tier: HINT_HALF }).state;
    const rev = engine.apply(s, { type: "hint", tier: HINT_REVEAL });
    expect(rev.ok).toBe(true);
    const f = rev.state.found.find((x) => x.word === focus)!;
    expect(f).toMatchObject({ points: 0, assisted: true, target: true });
    // Finding the revealed word again is a duplicate.
    expect(submit(rev.state, focus).code).toBe("duplicate");
  });

  it("nine-letter nudge gives the first letter once", () => {
    const s = start("lw-demo-1");
    const t = engine.apply(s, { type: "hint", tier: HINT_NINE });
    expect(t.message).toBe("A nine-letter answer starts with E.");
    expect(engine.apply(t.state, { type: "hint", tier: HINT_NINE }).ok).toBe(false);
  });

  it("completes when every everyday word is found, and play can continue", () => {
    let s = start("lw-demo-1");
    for (const w of bundle("lw-demo-1").payload.targets) s = submit(s, w).state;
    expect(engine.outcome(s)).toBe("completed");
    const r = engine.result(s)!;
    expect(r.outcome).toBe("completed");
    expect(r.assistance).toEqual({ hints: 0, reveals: 0 });
    expect(r.shareText).not.toMatch(/EDUCATION/);
    const more = submit(s, "ocean");
    expect(more.ok).toBe(true);
    expect(more.state.found.find((f) => f.word === "OCEAN")?.target).toBe(false);
  });

  it("finishing early gives an honest partial result, and resume reopens", () => {
    let s = start("lw-g1");
    s = submit(s, "YARD").state;
    s = engine.apply(s, { type: "finish" }).state;
    expect(engine.outcome(s)).toBe("abandoned");
    const r = engine.result(s)!;
    expect(r.headline).toMatch(/1 of 20/);
    expect(r.details.join(" ")).toMatch(/left unexplored/);
    s = engine.apply(s, { type: "resume" }).state;
    expect(engine.outcome(s)).toBe("playing");
  });

  it("every practice round is fully solvable within its own lexicon", () => {
    for (const r of rounds) {
      let s = engine.initialise(r.payload, sessionOptionsFor(r.meta, 3));
      for (const w of r.payload.targets) {
        const t = submit(s, w);
        expect(t.ok, `${r.meta.id} ${w} ${t.message}`).toBe(true);
        s = t.state;
      }
      expect(engine.outcome(s), r.meta.id).toBe("completed");
    }
  });

  it("master rounds: 14+ rounds, target wording, definition hints, and a completed result says target words", () => {
    const masters = rounds.filter((r) => r.meta.difficulty === "master");
    expect(masters.length).toBeGreaterThanOrEqual(14);
    expect(rounds.filter((r) => r.meta.difficulty === "expert").length).toBeGreaterThanOrEqual(22);
    const id = masters[0].meta.id;
    let s = start(id);
    expect(s.wordLabel).toBe("target");
    const offers = engine.hints(s);
    const def = offers.find((o) => o.tier === HINT_DEFINE)!;
    expect(def.available).toBe(true);
    const h = engine.apply(s, { type: "hint", tier: HINT_DEFINE });
    expect(h.ok).toBe(true);
    expect(h.message).toMatch(/^A \d-letter word starting [A-Z] means: /);
    const h2 = engine.apply(h.state, { type: "hint", tier: HINT_DEFINE });
    expect(h2.ok).toBe(true);
    expect(h2.state.hints[1].word).not.toBe(h2.state.hints[0].word);
    for (const w of masters[0].payload.targets) s = submit(s, w).state;
    const r = engine.result(s)!;
    expect(r.headline).toBe("Every target word found.");
    expect(r.details.join(" ")).toMatch(/target words/);
    expect(r.details.join(" ")).not.toMatch(/everyday/);
    // Non-master rounds keep the everyday wording and offer no definition hint.
    const g = start("lw-g1");
    expect(g.wordLabel).toBe("everyday");
    expect(engine.hints(g).some((o) => o.tier === HINT_DEFINE)).toBe(false);
  });

  it("property: any accepted word fits the rack multiset and contains the centre", () => {
    const s = start("lw-s1");
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Z]{1,10}$/), (w) => {
        const t = submit(s, w);
        if (t.ok) {
          expect(positionsUsed(s.letters, w).unavailable).toBeNull();
          expect(w.includes(s.required)).toBe(true);
          expect(w.length).toBeGreaterThanOrEqual(4);
        } else {
          expect(t.state).toBe(s);
        }
      }),
      { numRuns: 400 },
    );
  });
});
