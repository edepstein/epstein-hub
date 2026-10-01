import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { loadMembershipSync } from "@/lib/dictionary/node";
import { newAttempt, restoreAttempt, sessionOptionsFor, withAction } from "@/lib/progress/attempt";
import {
  createWordDeductionEngine,
  describeRow,
  EXTENSION_ROWS,
  hardViolation,
  HINT_LETTER,
  HINT_PLACE,
  HINT_REVEAL,
  keyboardSummary,
  scoreGuess,
  type DeductionAction,
  type DeductionPayload,
  type DeductionState,
} from "./engine";
import { rounds } from "./rounds";
import { validateContent } from "./validate";

const membership = loadMembershipSync();
const engine = createWordDeductionEngine(membership);
const bundle = (id: string) => rounds.find((r) => r.meta.id === id)!;
const start = (id: string, eng = engine) => {
  const b = bundle(id);
  return eng.initialise(b.payload, sessionOptionsFor(b.meta, 1));
};
const custom = (answer: string, hardMode = false, eng = engine): DeductionState =>
  eng.initialise(
    { answer, guessLimit: 6, hardMode, definition: "Test definition.", explanation: "" } satisfies DeductionPayload,
    sessionOptionsFor({ ...bundle("wd-s1").meta, difficulty: hardMode ? "expert" : "standard" }, 1),
  );
const guess = (s: DeductionState, word: string) => engine.apply(s, { type: "guess", word });
const play = (s: DeductionState, words: string[]) => {
  for (const w of words) {
    const t = guess(s, w);
    expect(t.ok, `${w}: ${t.message}`).toBe(true);
    s = t.state;
  }
  return s;
};

describe("two-pass feedback", () => {
  it("EERIE against CRANE: absent, absent, present, absent, correct (the exact final E consumes the only E)", () => {
    expect(scoreGuess("EERIE", "CRANE")).toEqual(["absent", "absent", "present", "absent", "correct"]);
  });

  it("duplicate L regression: ALLEY against APPLE marks only one L", () => {
    expect(scoreGuess("ALLEY", "APPLE")).toEqual(["correct", "present", "absent", "present", "absent"]);
    expect(scoreGuess("APPLE", "ALLEY")).toEqual(["correct", "absent", "absent", "present", "present"]);
  });

  it("repeated letters in both guess and answer", () => {
    // Answer has two Es; guess has three: exact first, then leftmost remaining copy.
    expect(scoreGuess("EERIE", "GREEN")).toEqual(["present", "present", "present", "absent", "absent"]);
    expect(scoreGuess("SWEET", "SWEET")).toEqual(Array(5).fill("correct"));
    expect(scoreGuess("TEPEE", "SWEET")).toEqual(["present", "present", "absent", "correct", "absent"]);
  });

  it("reproduces every demo fixture's stored feedback", () => {
    for (const r of rounds.filter((x) => x.meta.status === "demo")) {
      for (const t of r.payload.fixtureFeedback!) expect(scoreGuess(t.guess, r.payload.answer), `${r.meta.id} ${t.guess}`).toEqual(t.expectedFeedback);
    }
  });

  it("property: marked copies of each letter never exceed its answer count (and equal the overlap)", () => {
    const word = fc.stringMatching(/^[ABCDE]{5}$/);
    fc.assert(
      fc.property(word, word, (g, a) => {
        const marks = scoreGuess(g, a);
        for (const ch of "ABCDE") {
          const marked = g.split("").filter((x, i) => x === ch && marks[i] !== "absent").length;
          const inAnswer = a.split("").filter((x) => x === ch).length;
          const inGuess = g.split("").filter((x) => x === ch).length;
          expect(marked).toBe(Math.min(inAnswer, inGuess));
        }
        marks.forEach((m, i) => expect(m === "correct").toBe(g[i] === a[i]));
      }),
      { numRuns: 500 },
    );
  });

  it("screen-reader row description names each letter once", () => {
    expect(describeRow({ guess: "EERIE", marks: scoreGuess("EERIE", "CRANE") })).toBe("E: absent; E: absent; R: elsewhere; I: absent; E: correct place");
  });
});

describe("guess validation and turn accounting", () => {
  it("invalid dictionary entries do not consume a guess and leave state untouched", () => {
    const s = start("wd-demo-1");
    const cases: [string, string][] = [
      ["", "empty"],
      ["cr ne", "non-letters"],
      ["cran", "too-short"],
      ["cranes", "too-long"],
      ["xqzvw", "not-in-word-list"],
    ];
    for (const [w, code] of cases) {
      const t = guess(s, w);
      expect(t.ok, w).toBe(false);
      expect(t.code, w).toBe(code);
      expect(t.state).toBe(s);
      expect(t.message.length).toBeGreaterThan(10);
    }
  });

  it("restricted fixture lexicon: SLATE rejected at zero cost; the production list accepts common guesses", () => {
    const fixture = bundle("wd-demo-1").payload.fixtureGuesses!;
    const restricted = createWordDeductionEngine(new Set(fixture.filter((w) => w !== "SLATE")));
    const s = start("wd-demo-1", restricted);
    const t = restricted.apply(s, { type: "guess", word: "SLATE" });
    expect(t.code).toBe("not-in-word-list");
    expect(t.state.rows).toHaveLength(0);
    // Full membership: SLATE and a guess outside the fixture list (STONE) are both accepted.
    const u = play(start("wd-demo-1"), ["SLATE", "STONE"]);
    expect(u.rows).toHaveLength(2);
    expect(fixture).not.toContain("STONE");
  });

  it("a legal wrong guess consumes one of six and locks its feedback", () => {
    const t = guess(start("wd-demo-1"), "eerie");
    expect(t.ok).toBe(true);
    expect(t.state.rows).toEqual([{ guess: "EERIE", marks: ["absent", "absent", "present", "absent", "correct"], extension: false }]);
    expect(t.message).toContain("5 guesses left");
    expect(engine.outcome(t.state)).toBe("playing");
  });

  it("repeating an earlier guess is rejected without cost", () => {
    const s = play(start("wd-demo-1"), ["TRAIN"]);
    const t = guess(s, "train");
    expect(t.code).toBe("repeated");
    expect(t.state).toBe(s);
  });

  it("first-attempt win", () => {
    const s = play(start("wd-demo-2"), ["PLANT"]);
    expect(engine.outcome(s)).toBe("completed");
    const r = engine.result(s)!;
    expect(r.headline).toBe("Solved in 1 guess.");
    expect(r.assistance).toEqual({ hints: 0, reveals: 0 });
    expect(guess(s, "CRANE").code).toBe("finished");
  });

  it("sixth-attempt win", () => {
    const s = play(start("wd-demo-1"), ["EERIE", "PLANT", "SHEEP", "HEART", "TRAIN", "CRANE"]);
    expect(engine.outcome(s)).toBe("completed");
    expect(engine.result(s)!.scoreText).toBe("6 of 6 guesses");
  });

  it("six misses: failed without revealing, then reveal shows the answer and definition", () => {
    let s = play(start("wd-demo-3"), ["EERIE", "PLANT", "CRANE", "HEART", "TRAIN", "SLATE"]);
    expect(engine.outcome(s)).toBe("failed");
    const failed = engine.result(s)!;
    expect(failed.headline).toBe("Not solved in 6 guesses.");
    expect(JSON.stringify(failed)).not.toContain("SHARE");
    expect(guess(s, "SHARE").code).toBe("out-of-guesses");
    s = engine.apply(s, { type: "reveal" }).state;
    expect(engine.outcome(s)).toBe("revealed");
    const r = engine.result(s)!;
    expect(r.headline).toContain("SHARE");
    expect(r.details.join(" ")).toContain(bundle("wd-demo-3").payload.definition);
    expect(r.assistance.reveals).toBe(1);
    expect(r.shareText).not.toContain("SHARE");
  });

  it("assisted extension after six misses: can still solve, but never as an unassisted in-limit success", () => {
    let s = play(start("wd-demo-3"), ["EERIE", "PLANT", "CRANE", "HEART", "TRAIN", "SLATE"]);
    expect(engine.apply(start("wd-demo-3"), { type: "extend" }).code).toBe("not-exhausted");
    s = engine.apply(s, { type: "extend" }).state;
    expect(engine.outcome(s)).toBe("playing");
    s = play(s, ["SHEEP", "SHARE"]);
    expect(s.rows.slice(6).every((r) => r.extension)).toBe(true);
    expect(engine.outcome(s)).toBe("completed");
    const r = engine.result(s)!;
    expect(r.headline).toBe("Solved in 8 guesses, after the 6-guess limit.");
    expect(r.assistance.hints).toBeGreaterThan(0);
    expect(r.shareText).toContain("X/6");
    expect(EXTENSION_ROWS).toBe(3);
  });
});

describe("hard mode (Expert)", () => {
  it("requires revealed letters in place", () => {
    const s = play(custom("LIGHT", true), ["NIGHT"]); // IGHT correct
    const t = guess(s, "BRING");
    expect(t.ok).toBe(false);
    expect(t.code).toBe("hard-fixed");
    expect(t.message).toMatch(/second letter must be I/);
    expect(guess(s, "MIGHT").ok).toBe(true);
  });

  it("requires confirmed minimum counts, including duplicates", () => {
    const s = play(custom("SWEET", true), ["EERIE"]); // E E present, one more E absent
    expect(s.rows[0].marks).toEqual(["present", "present", "absent", "absent", "absent"]);
    const t = guess(s, "TREND"); // only one E
    expect(t.code).toBe("hard-minimum");
    expect(t.message).toMatch(/at least 2 copies of E/);
  });

  it("excludes an elsewhere letter from its disproven position", () => {
    const s = play(custom("CRANE", true), ["TRAIN"]); // R, A correct, N present at 4
    const t = guess(s, "BRAWN"); // N back in position 5
    expect(t.code).toBe("hard-moved");
    expect(guess(s, "CRANE").ok).toBe(true);
  });

  it("a grey duplicate is not a blanket ban on the letter", () => {
    const s = play(custom("CRANE", true), ["EERIE"]); // final E correct, others absent
    expect(hardViolation(s, "CRANE")).toBeNull();
    expect(guess(s, "CRANE").ok).toBe(true);
  });

  it("does not apply outside Expert, and relaxing is recorded", () => {
    const easy = play(custom("LIGHT"), ["NIGHT"]);
    expect(guess(easy, "BRAVE").ok).toBe(true);
    let s = play(custom("LIGHT", true), ["NIGHT"]);
    s = engine.apply(s, { type: "relax-hard-mode" }).state;
    expect(guess(s, "BRAVE").ok).toBe(true);
    expect(engine.apply(s, { type: "relax-hard-mode" }).code).toBe("already-relaxed");
    s = play(s, ["BRAVE", "LIGHT"]);
    const r = engine.result(s)!;
    expect(r.details.join(" ")).toMatch(/Hard mode was switched off/);
    expect(r.shareText).toContain("hard mode relaxed");
    expect(r.assistance.hints).toBe(1);
  });

  it("hint information becomes a hard-mode constraint too", () => {
    let s = custom("LIGHT", true);
    s = engine.apply(s, { type: "hint", tier: HINT_PLACE }).state;
    expect(guess(s, "NIGHT").code).toBe("hard-fixed");
  });
});

describe("state-aware hints", () => {
  it("letter hint names an untried answer letter and is recorded", () => {
    let s = play(start("wd-demo-1"), ["TRAIN"]); // R, A, N tried
    const t = engine.apply(s, { type: "hint", tier: HINT_LETTER });
    expect(t.ok).toBe(true);
    expect(t.message).toMatch(/contains (C|E)\./);
    s = t.state;
    const t2 = engine.apply(s, { type: "hint", tier: HINT_LETTER });
    expect(t2.message).not.toBe(t.message);
    s = t2.state;
    expect(engine.apply(s, { type: "hint", tier: HINT_LETTER }).code).toBe("hint-unavailable");
    expect(s.hints).toHaveLength(2);
    expect(s.rows).toHaveLength(1); // no guess used
  });

  it("place hint gives the first letter, then the first unconfirmed place", () => {
    let s = start("wd-demo-2");
    const t = engine.apply(s, { type: "hint", tier: HINT_PLACE });
    expect(t.message).toBe("The answer begins with P.");
    s = play(t.state, ["PLAIN"]); // P L A correct
    const t2 = engine.apply(s, { type: "hint", tier: HINT_PLACE });
    expect(t2.message).toBe("The fourth letter is N.");
    const offers = engine.hints(t2.state);
    expect(offers.find((o) => o.tier === HINT_PLACE)!.description).toMatch(/fifth position/);
  });

  it("reveal hint ends the round as revealed", () => {
    const t = engine.apply(start("wd-g1"), { type: "hint", tier: HINT_REVEAL });
    expect(engine.outcome(t.state)).toBe("revealed");
    expect(engine.hints(t.state).every((o) => !o.available)).toBe(true);
  });

  it("assisted wins say so in the result and share text", () => {
    let s = engine.apply(start("wd-demo-2"), { type: "hint", tier: HINT_PLACE }).state;
    s = play(s, ["PLANT"]);
    const r = engine.result(s)!;
    expect(r.assistance.hints).toBe(1);
    expect(r.shareText).toMatch(/assisted \(1 hint\)/);
    expect(r.shareText).not.toContain("PLANT");
  });
});

describe("keyboard, share and persistence", () => {
  it("keyboard summary keeps the strongest state per letter", () => {
    const s = play(custom("CRANE"), ["EERIE", "TRACE"]);
    const k = keyboardSummary(s.rows);
    expect(k.E).toBe("correct");
    expect(k.R).toBe("correct");
    expect(k.I).toBe("absent");
    expect(k.C).toBe("present");
  });

  it("share grid is spoiler-free and uses symbols, not colours", () => {
    const s = play(start("wd-demo-1"), ["EERIE", "CRANE"]);
    const r = engine.result(s)!;
    expect(r.shareText).toContain("××↔×✓");
    expect(r.shareText).toContain("✓✓✓✓✓");
    expect(r.shareText).not.toMatch(/CRANE|EERIE/);
    expect(r.shareText).toContain("unassisted");
  });

  it("refresh after three guesses restores the exact rows through action replay", () => {
    const b = bundle("wd-s2");
    let attempt = newAttempt(b.meta, "att", 7, true, "2026-09-30T00:00:00Z");
    let s = engine.initialise(b.payload, sessionOptionsFor(b.meta, 7));
    const actions: DeductionAction[] = [
      { type: "guess", word: "CRANE" },
      { type: "guess", word: "zzzzz" }, // rejected: never stored
      { type: "hint", tier: HINT_LETTER },
      { type: "guess", word: "PLAIT" },
      { type: "guess", word: "ALLEY" },
    ];
    actions.forEach((a, i) => {
      const t = engine.apply(s, a);
      if (!t.ok) return;
      s = t.state;
      attempt = withAction(attempt, { id: `a${i}`, at: "2026-09-30T00:00:00Z", action: a }, engine.outcome(s), false);
    });
    const restored = restoreAttempt(engine, b.payload, b.meta, JSON.parse(JSON.stringify(attempt)));
    expect(restored.status).toBe("restored");
    if (restored.status === "restored") expect(restored.state).toEqual(s);
    expect(s.rows.map((r) => r.guess)).toEqual(["CRANE", "PLAIT", "ALLEY"]);
    expect(s.rows[2].marks).toEqual(["correct", "present", "absent", "present", "absent"]);
  });

  it("a forged saved guess that is not a word fails replay", () => {
    const b = bundle("wd-s2");
    let attempt = newAttempt(b.meta, "att", 7, true, "2026-09-30T00:00:00Z");
    attempt = withAction(attempt, { id: "x", at: "t", action: { type: "guess", word: "QQQQQ" } }, "playing", false);
    expect(restoreAttempt(engine, b.payload, b.meta, attempt).status).toBe("corrupt");
  });
});

describe("content", () => {
  it("validator passes and every difficulty has at least ten distinct rounds", () => {
    expect(validateContent()).toEqual([]);
    for (const d of ["gentle", "standard", "expert", "master"] as const) {
      const list = rounds.filter((r) => r.meta.difficulty === d && r.meta.status === "practice");
      expect(list.length, d).toBeGreaterThanOrEqual(d === "master" ? 14 : 10);
    }
    expect(new Set(rounds.map((r) => r.payload.answer)).size).toBe(rounds.length);
  });

  it("every round is winnable and Expert and Master rounds enforce hard mode", () => {
    for (const r of rounds) {
      const s = engine.initialise(r.payload, sessionOptionsFor(r.meta, 1));
      expect(s.hardMode, r.meta.id).toBe(r.meta.difficulty === "expert" || r.meta.difficulty === "master");
      const t = guess(s, r.payload.answer);
      expect(t.ok, r.meta.id).toBe(true);
      expect(engine.outcome(t.state)).toBe("completed");
    }
  });
});
