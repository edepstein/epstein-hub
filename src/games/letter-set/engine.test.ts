import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { loadMembershipSync } from "@/lib/dictionary/node";
import { sessionOptionsFor } from "@/lib/progress/attempt";
import { restoreAttempt, newAttempt, withAction } from "@/lib/progress/attempt";
import {
  ALL_LETTER_BONUS,
  createLetterSetEngine,
  fitsSet,
  HINT_ALL_LETTER,
  HINT_DEFINITION,
  HINT_REVEAL,
  HINT_START,
  scoreWord,
  usesAllLetters,
  type SetState,
} from "./engine";
import { rounds } from "./rounds";
import { validateContent } from "./validate";

const membership = loadMembershipSync();
const engine = createLetterSetEngine(membership);
const bundle = (id: string) => rounds.find((r) => r.meta.id === id)!;
const start = (id: string, seed = 1) => {
  const b = bundle(id);
  return engine.initialise(b.payload, sessionOptionsFor(b.meta, seed));
};
const submit = (s: SetState, word: string) => engine.apply(s, { type: "submit", word });

describe("letter set rules", () => {
  it("accepts TRANSPARENT on the parents board: repeated letters are allowed and it is an all-letter word", () => {
    const s = start("ls-demo-1");
    const t = submit(s, "transparent");
    expect(t.ok).toBe(true);
    expect(t.state.found[0]).toEqual({ word: "TRANSPARENT", points: 11 + ALL_LETTER_BONUS, assisted: false, target: true, allLetter: true });
    expect(t.message).toMatch(/All-letter word/);
  });

  it("scores four-letter words 1, longer words their length", () => {
    let s = start("ls-demo-1");
    const a = submit(s, "part");
    expect(a.state.found[0].points).toBe(1);
    s = a.state;
    const b = submit(s, "paper");
    expect(b.state.found[1].points).toBe(5);
    expect(b.score?.lines).toEqual([{ label: "5 letters", points: 5 }]);
  });

  it("rejects ARTICLES on the article board because S is not in the set", () => {
    const s = start("ls-demo-2");
    const t = submit(s, "articles");
    expect(t.ok).toBe(false);
    expect(t.code).toBe("letter-unavailable");
    expect(t.message).toBe("S is not in this set. Use only A, C, E, I, L, R and T.");
    expect(t.state).toBe(s);
  });

  it("rejects a dictionary word that lacks the required letter", () => {
    const s = start("ls-demo-3"); // required H
    expect(membership.has("TEARS")).toBe(true);
    const t = submit(s, "tears");
    expect(t.code).toBe("missing-required");
    expect(t.message).toBe("This word needs H. Every word must include the required letter.");
  });

  it("checks length, then characters, then required letter, then membership, then duplicates", () => {
    const s = start("ls-demo-1"); // E A R T S N P, required P
    const cases: [string, string][] = [
      ["", "empty"],
      ["pa-rt", "non-letters"],
      ["pqz", "too-short"], // too short beats foreign letters
      ["pizza", "letter-unavailable"],
      ["tears", "missing-required"],
      ["ppppa", "not-in-word-list"],
    ];
    for (const [w, code] of cases) {
      const t = submit(s, w);
      expect(t.ok, w).toBe(false);
      expect(t.code, w).toBe(code);
      expect(t.state).toBe(s);
      expect(t.message.length).toBeGreaterThan(10);
    }
  });

  it("repeat submission never scores twice and produces no second celebration", () => {
    let s = start("ls-demo-1");
    s = submit(s, "PARENTS").state;
    const t = submit(s, "parents");
    expect(t.ok).toBe(false);
    expect(t.code).toBe("duplicate");
    expect(t.message).toMatch(/^Already found/);
    expect(t.state.found).toHaveLength(1);
    expect(t.state.found[0].points).toBe(14);
  });

  it("reproduces every demo fixture's maximumScore and allLetterAnswers from its finite lexicon", () => {
    const demos = rounds.filter((x) => x.meta.status === "demo");
    expect(demos.map((d) => d.meta.sourceFixtureId)).toEqual(["parents", "article", "teachers"]);
    for (const r of demos) {
      const p = r.payload;
      expect(p.fixtureLexicon!.reduce((acc, w) => acc + scoreWord(w, p.letters), 0), r.meta.id).toBe(p.fixtureMaximumScore);
      expect(p.fixtureLexicon!.filter((w) => usesAllLetters(w, p.letters)).sort(), r.meta.id).toEqual([...p.fixtureAllLetterAnswers!].sort());
    }
  });

  it("accepts common words beyond the restricted demo lexicon (production membership)", () => {
    const s = start("ls-demo-1");
    expect(bundle("ls-demo-1").payload.fixtureLexicon).not.toContain("PASTE");
    const t = submit(s, "paste");
    expect(t.ok).toBe(true);
    expect(t.state.found[0].target).toBe(false);
    expect(t.message).toMatch(/bonus word/);
  });

  it("maximum score is derived from the pinned lexicon and all-letter words are found by coverage", () => {
    const s = start("ls-g1");
    expect(s.maxScore).toBe(s.lexicon.reduce((a, w) => a + scoreWord(w, s.letters), 0));
    expect(s.allLetterWords).toEqual(s.lexicon.filter((w) => s.letters.every((l) => w.includes(l))));
    expect(s.allLetterWords).toContain("KITCHENETTE");
    for (const w of s.lexicon) {
      expect(fitsSet(w, s.letters)).toBe(true);
      expect(w.includes(s.required)).toBe(true);
    }
  });

  it("shuffle keeps the required letter out of the outer ring and changes nothing else", () => {
    const s = start("ls-g2");
    expect(s.outer.map((i) => s.letters[i])).not.toContain(s.required);
    const reversed = [...s.outer].reverse();
    const t = engine.apply(s, { type: "shuffle", order: reversed });
    expect(t.ok).toBe(true);
    expect(t.state.outer).toEqual(reversed);
    expect(t.state.lexicon).toBe(s.lexicon);
    const reqIdx = s.letters.indexOf(s.required);
    expect(engine.apply(s, { type: "shuffle", order: [reqIdx, ...s.outer.slice(1)] }).code).toBe("bad-order");
    expect(engine.apply(s, { type: "shuffle", order: [0, 0, 0, 0, 0, 0] }).ok).toBe(false);
  });

  it("initial outer order is seeded, so a replay reproduces it", () => {
    expect(start("ls-g1", 42).outer).toEqual(start("ls-g1", 42).outer);
  });

  it("hint ladder: length and first letter, definition, then reveal at 0 points (assisted)", () => {
    let s = start("ls-g1");
    expect(engine.apply(s, { type: "hint", tier: HINT_DEFINITION }).code).toBe("hint-unavailable");
    const h1 = engine.apply(s, { type: "hint", tier: HINT_START });
    expect(h1.ok).toBe(true);
    s = h1.state;
    const focus = s.hintFocus!;
    expect(h1.message).toBe(`An everyday word of ${focus.length} letters begins with ${focus[0]}.`);
    expect(engine.apply(s, { type: "hint", tier: HINT_START }).ok).toBe(false); // no repeated charge
    const h2 = engine.apply(s, { type: "hint", tier: HINT_DEFINITION });
    expect(h2.message).toContain(s.clues[focus]);
    s = h2.state;
    const rev = engine.apply(s, { type: "hint", tier: HINT_REVEAL });
    expect(rev.ok).toBe(true);
    expect(rev.state.found.find((f) => f.word === focus)).toMatchObject({ points: 0, assisted: true, target: true });
    expect(submit(rev.state, focus).code).toBe("duplicate");
    const r = engine.apply(rev.state, { type: "finish" }).state;
    expect(engine.result(r)!.assistance).toEqual({ hints: 2, reveals: 1 });
  });

  it("finding the hinted word unaided clears the focus and scores normally", () => {
    let s = engine.apply(start("ls-g1"), { type: "hint", tier: HINT_START }).state;
    const focus = s.hintFocus!;
    s = submit(s, focus).state;
    expect(s.hintFocus).toBeNull();
    expect(s.found[0].points).toBe(scoreWord(focus, s.letters));
  });

  it("all-letter nudge gives the first letter and length once", () => {
    const s = start("ls-demo-1");
    const t = engine.apply(s, { type: "hint", tier: HINT_ALL_LETTER });
    expect(t.message).toBe("An all-letter word begins with P and has 7 letters.");
    expect(engine.apply(t.state, { type: "hint", tier: HINT_ALL_LETTER }).ok).toBe(false);
  });

  it("completes when every everyday word is found, then play continues", () => {
    let s = start("ls-demo-2");
    for (const t of bundle("ls-demo-2").payload.targets) s = submit(s, t.word).state;
    expect(engine.outcome(s)).toBe("completed");
    const r = engine.result(s)!;
    expect(r.outcome).toBe("completed");
    expect(r.assistance).toEqual({ hints: 0, reveals: 0 });
    expect(r.shareText).not.toMatch(/ARTICLE/);
    const more = submit(s, "crate");
    expect(more.ok).toBe(true);
    expect(more.state.found.at(-1)?.target).toBe(false);
  });

  it("finishing early gives an honest partial result and resume reopens", () => {
    let s = start("ls-e2");
    s = submit(s, "GEAR").state;
    s = engine.apply(s, { type: "finish" }).state;
    expect(engine.outcome(s)).toBe("abandoned");
    const r = engine.result(s)!;
    expect(r.headline).toMatch(/1 of 19/);
    expect(r.details.join(" ")).toMatch(/left unexplored/);
    s = engine.apply(s, { type: "resume" }).state;
    expect(engine.outcome(s)).toBe("playing");
  });

  it("a saved assisted run cannot resume as unassisted (replay restores hints and reveals)", () => {
    const b = bundle("ls-g3");
    let attempt = newAttempt(b.meta, "att-1", 7, true, "2026-09-30T00:00:00Z");
    let s = engine.initialise(b.payload, sessionOptionsFor(b.meta, 7));
    const actions = [
      { type: "submit", word: "ROOF" },
      { type: "hint", tier: HINT_START },
      { type: "hint", tier: HINT_REVEAL },
    ] as const;
    actions.forEach((a, i) => {
      s = engine.apply(s, a).state;
      attempt = withAction(attempt, { id: `a${i}`, at: "2026-09-30T00:00:00Z", action: a }, engine.outcome(s), i > 0);
    });
    const restored = restoreAttempt(engine, b.payload, b.meta, JSON.parse(JSON.stringify(attempt)));
    expect(restored.status).toBe("restored");
    if (restored.status === "restored") {
      expect(restored.state.found).toEqual(s.found);
      expect(restored.state.hints).toHaveLength(2);
      expect(restored.state.found.some((f) => f.assisted)).toBe(true);
      expect(restored.state.outer).toEqual(s.outer);
    }
  });

  it("every round is fully solvable within its own lexicon and has an everyday all-letter word", () => {
    for (const r of rounds) {
      let s = engine.initialise(r.payload, sessionOptionsFor(r.meta, 3));
      expect(r.payload.allLetterTargets.length, r.meta.id).toBeGreaterThan(0);
      for (const t of r.payload.targets) {
        const tr = submit(s, t.word);
        expect(tr.ok, `${r.meta.id} ${t.word} ${tr.message}`).toBe(true);
        s = tr.state;
      }
      expect(engine.outcome(s), r.meta.id).toBe("completed");
    }
  });

  it("content validator passes and difficulties have distinct boards", () => {
    expect(validateContent()).toEqual([]);
    for (const d of ["gentle", "standard", "expert"] as const) {
      expect(rounds.filter((r) => r.meta.difficulty === d && r.meta.status === "practice").length, d).toBeGreaterThanOrEqual(4);
    }
  });

  it("property: any accepted word uses only the seven letters, includes the required letter and is 4+ long", () => {
    const s = start("ls-s1");
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Z]{1,10}$/), (w) => {
        const t = submit(s, w);
        if (t.ok) {
          expect(fitsSet(w, s.letters)).toBe(true);
          expect(w.includes(s.required)).toBe(true);
          expect(w.length).toBeGreaterThanOrEqual(4);
          expect(t.state.found[0].points).toBe(scoreWord(w, s.letters));
        } else {
          expect(t.state).toBe(s);
        }
      }),
      { numRuns: 400 },
    );
  });
});
