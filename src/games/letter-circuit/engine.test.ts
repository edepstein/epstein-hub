import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { loadMembershipSync } from "@/lib/dictionary/node";
import { sessionOptionsFor } from "@/lib/progress/attempt";
import { chainComplete, coverage, createLetterCircuitEngine, HINT_LETTERS, HINT_PLAY, HINT_WORD, requiredStart, unusedLetters, type CircuitState } from "./engine";
import { rounds } from "./rounds";
import { boardProblem, makeBoard, maskOf, playableWords, searchPar } from "./solver";
import { validateContent } from "./validate";

const membership = loadMembershipSync();
const engine = createLetterCircuitEngine(membership);
const bundle = (id: string) => rounds.find((r) => r.meta.id === id)!;
const start = (id: string) => engine.initialise(bundle(id).payload, sessionOptionsFor(bundle(id).meta, 1));
const play = (s: CircuitState, ...words: string[]) => {
  for (const w of words) {
    const t = engine.apply(s, { type: "submit", word: w });
    if (!t.ok) throw new Error(`${w}: ${t.message}`);
    s = t.state;
  }
  return s;
};

describe("letter circuit rules", () => {
  it("all three pack fixture chains pass sides, chaining and coverage", () => {
    for (const id of ["lc-demo-1", "lc-demo-2", "lc-demo-3"]) {
      const b = bundle(id);
      const s = play(start(id), ...b.payload.fixture!.referenceChain);
      expect(chainComplete(s), id).toBe(true);
      expect(engine.outcome(s)).toBe("completed");
      expect(s.best!.words).toEqual(b.payload.fixture!.referenceChain);
    }
  });

  it("breadth-first search proves the fixture optimum of 4, and a richer dictionary lowers it", () => {
    const p = bundle("lc-demo-1").payload;
    const board = makeBoard(p.sides);
    expect(searchPar(board, playableWords(board, p.fixture!.lexicon)).words).toBe(4);
    const richer = [...p.fixture!.lexicon, ...p.parChain];
    const shorter = searchPar(board, playableWords(board, richer)).words!;
    expect(shorter).toBeLessThan(4);
    expect(p.par).toBe(searchPar(board, playableWords(board, p.parPool.split(" "))).words);
    expect(p.par).toBeLessThan(4);
  });

  it("rejects each failure with a precise code and leaves state untouched", () => {
    const s = start("lc-demo-1"); // sides ADT EFR CIL NOS
    const cases: [string, string, string][] = [
      ["", "empty", "Type or tap"],
      ["co-ld", "non-letters", "A to Z"],
      ["co", "too-short", "at least 3"],
      ["colby", "letter-not-on-board", "B is not on the board"],
      ["tad", "same-side", "T and A are both on the top side"],
      ["cfdcf", "not-in-word-list", "not in this game's word list"],
    ];
    for (const [w, code, text] of cases) {
      const t = engine.apply(s, { type: "submit", word: w });
      expect(t.ok, w).toBe(false);
      expect(t.code, w).toBe(code);
      expect(t.message, w).toContain(text);
      expect(t.state).toBe(s);
    }
    const s2 = play(s, "COLD");
    const wrong = engine.apply(s2, { type: "submit", word: "TRAIN" });
    expect(wrong.code).toBe("wrong-start");
    expect(wrong.message).toContain("must start with D, the last letter of COLD");
  });

  it("allows repeated letters separated by legal side changes", () => {
    const board = makeBoard(bundle("lc-demo-1").payload.sides);
    const repeat = [...membership].find((w) => w.length >= 5 && new Set(w).size < w.length && !boardProblem(board, w))!;
    expect(repeat).toBeTruthy();
    const t = engine.apply(start("lc-demo-1"), { type: "submit", word: repeat });
    expect(t.ok).toBe(true);
  });

  it("accepts a bridge word that adds no new letters", () => {
    const s = play(start("lc-demo-1"), "COLD");
    const board = makeBoard(s.sides);
    const cov = coverage(s);
    const bridge = [...membership].find((w) => w[0] === "D" && w.length >= 3 && !boardProblem(board, w) && (maskOf(board, w) & ~cov) === 0)!;
    expect(bridge).toBeTruthy();
    const t = engine.apply(s, { type: "submit", word: bridge });
    expect(t.ok).toBe(true);
    expect(t.code).toBe("bridge");
    expect(coverage(t.state)).toBe(cov);
    expect(requiredStart(t.state)).toBe(bridge.at(-1));
  });

  it("undo removes only coverage unique to the removed word", () => {
    let s = play(start("lc-demo-1"), "COLD", "DRAFT", "TRAIN");
    expect(unusedLetters(s).sort()).toEqual(["E", "S"]);
    s = engine.apply(s, { type: "undo" }).state;
    // TRAIN added I and N only; T, R and A remain covered by DRAFT.
    expect(unusedLetters(s).sort()).toEqual(["E", "I", "N", "S"]);
    expect(requiredStart(s)).toBe("T");
    s = engine.apply(s, { type: "undo" }).state;
    s = engine.apply(s, { type: "undo" }).state;
    expect(s.chain).toEqual([]);
    expect(engine.apply(s, { type: "undo" }).code).toBe("nothing-to-undo");
  });

  it("keeps the best completed chain while trying again, and records an improvement", () => {
    let s = play(start("lc-demo-1"), "COLD", "DRAFT", "TRAIN", "NEST");
    expect(engine.outcome(s)).toBe("completed");
    expect(engine.apply(s, { type: "submit", word: "TEN" }).code).toBe("finished");
    s = engine.apply(s, { type: "new-chain" }).state;
    expect(engine.outcome(s)).toBe("playing");
    expect(s.best!.words).toHaveLength(4);
    const par = s.parChain;
    const t = engine.apply(play(s, ...par.slice(0, -1)), { type: "submit", word: par.at(-1)! });
    expect(t.message).toContain("New best");
    expect(t.state.best!.words).toEqual(par);
    expect(t.state.completions).toBe(2);
    const r = engine.result(t.state)!;
    expect(r.headline).toContain("matching par");
    expect(r.shareText).not.toMatch(new RegExp(par.join("|")));
    // A worse completion keeps the better best.
    let w = engine.apply(t.state, { type: "new-chain" }).state;
    w = play(w, "COLD", "DRAFT", "TRAIN", "NEST");
    expect(w.best!.words).toEqual(par);
    // show-best abandons an improvement attempt without losing the best.
    const x = engine.apply(play(engine.apply(w, { type: "new-chain" }).state, "COLD"), { type: "show-best" });
    expect(x.ok).toBe(true);
    expect(engine.outcome(x.state)).toBe("completed");
  });

  it("hints start from the current endpoint, then show the word, then play it as help", () => {
    const first = bundle("lc-s1").payload.parChain[0];
    const end = first.at(-1)!;
    let s = play(start("lc-s1"), first);
    const h1 = engine.apply(s, { type: "hint", tier: HINT_LETTERS });
    expect(h1.ok).toBe(true);
    expect(h1.message).toMatch(new RegExp(`^From ${end}, try a \\d+-letter word starting with ${end}`));
    s = h1.state;
    const word = s.hintFocus!.word;
    expect(word[0]).toBe(end);
    const h2 = engine.apply(s, { type: "hint", tier: HINT_WORD });
    expect(h2.message).toContain(word);
    s = h2.state;
    const h3 = engine.apply(s, { type: "hint", tier: HINT_PLAY });
    expect(h3.ok).toBe(true);
    expect(h3.state.chain.at(-1)).toEqual({ word, assisted: true });
    // Following hints from here always finishes.
    let f = h3.state;
    for (let i = 0; i < 10 && !chainComplete(f); i++) f = engine.apply(f, { type: "hint", tier: HINT_PLAY }).state;
    expect(engine.outcome(f)).toBe("completed");
    expect(f.best!.assisted).toBe(true);
    expect(engine.result(f)!.assistance.reveals).toBeGreaterThan(0);
  });
});

describe("content", () => {
  it("every round validates, with at least four per difficulty", () => {
    expect(validateContent()).toEqual([]);
  });

  it("every practice par chain can be played through the engine to par", () => {
    for (const { meta, payload } of rounds) {
      const s = play(engine.initialise(payload, sessionOptionsFor(meta, 1)), ...payload.parChain);
      expect(engine.outcome(s), meta.id).toBe("completed");
      expect(s.best!.words.length).toBe(payload.par);
    }
  });
});

describe("invariants", () => {
  it("coverage always equals the union of the chain and the chain always links", () => {
    const s0 = start("lc-g2");
    const pool = s0.pool.slice(0, 400);
    const actionArb = fc.oneof(
      fc.constantFrom(...pool).map((word) => ({ type: "submit" as const, word })),
      fc.constant({ type: "undo" as const }),
      fc.constant({ type: "new-chain" as const }),
      fc.constant({ type: "hint" as const, tier: HINT_PLAY }),
    );
    fc.assert(
      fc.property(fc.array(actionArb, { maxLength: 30 }), (actions) => {
        let s = s0;
        const board = makeBoard(s0.sides);
        for (const a of actions) {
          const t = engine.apply(s, a);
          if (!t.ok) expect(t.state).toBe(s);
          s = t.state;
          expect(coverage(s)).toBe(s.chain.reduce((m, w) => m | maskOf(board, w.word), 0));
          for (let i = 1; i < s.chain.length; i++) expect(s.chain[i].word[0]).toBe(s.chain[i - 1].word.at(-1));
          if (s.best) expect(s.best.words.length).toBeGreaterThanOrEqual(s.par - 1);
        }
      }),
      { numRuns: 120 },
    );
  });
});
