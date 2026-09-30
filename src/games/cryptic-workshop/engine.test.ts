import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { sessionOptionsFor } from "@/lib/progress/attempt";
import { restoreAttempt } from "@/lib/progress/attempt";
import {
  crypticWorkshopEngine as engine,
  hintOffersFor,
  nextStage,
  score,
  STAGE_DEFINITION,
  STAGE_DEVICE,
  STAGE_FODDER,
  STAGE_INDICATOR,
  STAGE_LETTERS,
  STAGE_REVEAL,
  visibleStages,
  type WorkshopState,
} from "./engine";
import { explainOperation, findPhrase, letterPattern, verifyClue, wordplayLetters, type CrypticClue } from "./construction";
import { rounds } from "./rounds";
import { validateRounds } from "./validate";

const bundle = (id: string) => rounds.find((r) => r.meta.id === id)!;
const start = (id: string) => {
  const b = bundle(id);
  return engine.initialise(b.payload, sessionOptionsFor(b.meta, 1));
};
const submit = (s: WorkshopState, clueId: string, answer: string) => engine.apply(s, { type: "submit", clueId, answer });
const clue = (id: string, clueId: string) => bundle(id).payload.clues.find((c) => c.id === clueId)! as CrypticClue;

describe("construction checks (pack acceptance cases)", () => {
  it("LISTEN anagrams to SILENT and TALES to STALE", () => {
    expect(verifyClue(clue("cw-demo-1", "a")).problems).toEqual([]);
    expect(verifyClue(clue("cw-demo-2", "a")).problems).toEqual([]);
    expect(explainOperation(clue("cw-demo-1", "a"))).toBe("Rearrange the letters of LISTEN to make SILENT.");
  });

  it("show rental contains WREN at offset 3 after removing spaces", () => {
    const c = clue("cw-demo-1", "b");
    expect(wordplayLetters(c.construction, 4)).toBe("WREN");
    expect(c.construction).toMatchObject({ type: "hidden", start: 3 });
    expect(explainOperation(c)).toContain("sho[WREN]tal");
  });

  it("DESSERTS reverses to STRESSED", () => {
    expect(wordplayLetters(clue("cw-demo-1", "c").construction, 8)).toBe("STRESSED");
    expect(verifyClue(clue("cw-demo-1", "c")).problems).toEqual([]);
  });

  it("rejects a clue whose fodder was changed without recomputing, even with a correct definition", () => {
    const good = clue("cw-demo-1", "a");
    const badFodder: CrypticClue = { ...good, text: "Quiet: lisent, upset", construction: { type: "anagram", fodder: "lisent" } };
    expect(verifyClue(badFodder).problems).toEqual([]); // still a valid anagram: letters match
    const wrong: CrypticClue = { ...good, text: "Quiet: listed, upset", construction: { type: "anagram", fodder: "listed" } };
    expect(verifyClue(wrong).problems.join()).toMatch(/does not use exactly the letters/);
    const movedHidden: CrypticClue = { ...clue("cw-demo-1", "b"), construction: { type: "hidden", fodder: "show rental", start: 2 } };
    expect(verifyClue(movedHidden).problems.join()).toMatch(/not at offset 2/);
    const badIndicator: CrypticClue = { ...good, indicators: ["unset"] };
    expect(verifyClue(badIndicator).problems.join()).toMatch(/not a whole phrase/);
  });

  it("checks charade, container, deletion, initials and phrase placement", () => {
    expect(verifyClue(clue("cw-s1", "a")).problems).toEqual([]); // CAR + PET
    expect(wordplayLetters(clue("cw-s1", "c").construction, 5)).toBe("STAIN"); // S(TA)IN
    expect(wordplayLetters(clue("cw-e1", "b").construction, 5)).toBe("RIDGE"); // (B)RIDGE
    expect(wordplayLetters(clue("cw-g4", "a").construction, 4)).toBe("CALM");
    const wrongPlace = { ...clue("cw-s1", "c"), construction: { ...(clue("cw-s1", "c").construction as { type: "container" }), at: 2 } } as CrypticClue;
    expect(verifyClue(wrongPlace).problems.join()).toMatch(/gives SITAN/);
    const midDef: CrypticClue = { ...clue("cw-g1", "c"), text: "Part snare sent back", definition: "snare" };
    expect(verifyClue(midDef).problems.join()).toMatch(/start or end/);
    const badAbbrev = { ...clue("cw-s1", "c"), construction: { type: "container", outer: { source: "Sin", letters: "SIN", via: "literal" }, inner: { source: "thanks", letters: "TX", via: "abbreviation" }, at: 1 } } as CrypticClue;
    expect(verifyClue(badAbbrev).problems.join()).toMatch(/abbreviation list/);
  });

  it("whole-word phrase search does not match inside words", () => {
    expect(findPhrase("Metal found in hot interior", "in")).toHaveLength(1);
    expect(findPhrase("Metal in hot interior", "in")[0].start).toBe(6);
  });

  it("letter pattern shows every third letter per word", () => {
    expect(letterPattern("SILENT", "6")).toBe("S · · E · ·");
    expect(letterPattern("ICECREAM", "3,5")).toBe("I · ·  /  C · · A ·");
  });

  it("the whole bank passes validation and the validator catches a broken round", () => {
    expect(validateRounds(rounds)).toEqual([]);
    const broken = structuredClone(rounds[2]);
    (broken.payload.clues[0].construction as { fodder: string }).fodder = "Chimp";
    broken.payload.clues[0].text = "Chimp mixture makes a fruit";
    expect(validateRounds([...rounds.slice(0, 2), broken, ...rounds.slice(3)]).join()).toMatch(/does not use exactly the letters/);
  });
});

describe("workshop engine", () => {
  it("accepts the right answer before any mechanism is chosen, ignoring case and spaces", () => {
    const t = submit(start("cw-demo-1"), "a", " silent ");
    expect(t.ok).toBe(true);
    expect(t.state.progress.a.status).toBe("solved");
    expect(t.message).toMatch(/SILENT is right/);
  });

  it("rejects wrong length, wrong letters, empty and symbols atomically with precise reasons", () => {
    const s = start("cw-demo-1");
    const cases: [string, string][] = [
      ["", "empty"],
      ["sil3nt", "non-letters"],
      ["quiet", "wrong-length"],
      ["listen", "incorrect"],
    ];
    for (const [a, code] of cases) {
      const t = submit(s, "a", a);
      expect(t.ok, a).toBe(false);
      expect(t.code, a).toBe(code);
      expect(t.state).toBe(s);
    }
    expect(submit(s, "a", "quiet").message).toMatch(/\(6\) asks for 6 letters; QUIET has 5/);
    expect(submit(s, "zz", "silent").code).toBe("unknown-clue");
  });

  it("repeated submit of a solved clue never counts twice", () => {
    let s = submit(start("cw-demo-1"), "a", "SILENT").state;
    const again = submit(s, "a", "SILENT");
    expect(again.ok).toBe(false);
    expect(again.code).toBe("already-finished");
    s = again.state;
    expect(score(s)).toBe(33);
  });

  it("clues can be solved in any order; score sums thirds and rounds once", () => {
    let s = start("cw-demo-2");
    s = submit(s, "c", "rose").state;
    s = submit(s, "a", "stale").state;
    expect(score(s)).toBe(67);
    expect(engine.outcome(s)).toBe("playing");
    const t = submit(s, "b", "stop");
    expect(t.code).toBe("round-complete");
    expect(score(t.state)).toBe(100);
    const r = engine.result(t.state)!;
    expect(r.outcome).toBe("completed");
    expect(r.assistance).toEqual({ hints: 0, reveals: 0 });
    expect(r.shareText).not.toMatch(/STALE|STOP|ROSE/);
    expect(r.explanation!.join(" ")).toMatch(/ROSE sounds like ROWS/);
  });

  it("hint ladder is sequential per clue, never repeats a charge and keeps each clue's stage", () => {
    let s = start("cw-demo-2"); // standard: device not given
    expect(engine.apply(s, { type: "hint", clueId: "a", stage: STAGE_INDICATOR }).message).toMatch(/Identify the definition/);
    const h1 = engine.apply(s, { type: "hint", clueId: "a", stage: STAGE_DEFINITION });
    expect(h1.message).toBe('The definition is "Not fresh".');
    s = h1.state;
    expect(engine.apply(s, { type: "hint", clueId: "a", stage: STAGE_DEFINITION }).ok).toBe(false);
    s = engine.apply(s, { type: "hint", clueId: "a", stage: STAGE_DEVICE }).state;
    // switch clues after hint 2: clue b starts at its own first stage
    expect(nextStage(s, "b")).toBe(STAGE_DEFINITION);
    s = engine.apply(s, { type: "hint", clueId: "b", stage: STAGE_DEFINITION }).state;
    expect(nextStage(s, "a")).toBe(STAGE_INDICATOR);
    const ind = engine.apply(s, { type: "hint", clueId: "a", stage: STAGE_INDICATOR });
    expect(ind.message).toMatch(/"broken" signals the device/);
    s = ind.state;
    const fod = engine.apply(s, { type: "hint", clueId: "a", stage: STAGE_FODDER });
    expect(fod.message).toBe('The letters to rearrange are in "tales".');
    expect(fod.message).not.toMatch(/STALE/);
    s = fod.state;
    s = engine.apply(s, { type: "hint", clueId: "a", stage: STAGE_LETTERS }).state;
    expect(engine.apply(s, { type: "hint", clueId: "a", stage: STAGE_LETTERS }).code).toBe("hint-unavailable");
    expect(s.progress.a.stages).toEqual([1, 2, 3, 4, 5]);
    s = submit(s, "a", "stale").state;
    const r = engine.apply(s, { type: "reveal-all" });
    expect(engine.result(r.state)!.assistance).toEqual({ hints: 6, reveals: 2 });
  });

  it("gentle names the device, so the ladder skips that stage and practice is refused", () => {
    let s = start("cw-g1");
    expect(visibleStages(s, "a").has(STAGE_DEVICE)).toBe(true);
    s = engine.apply(s, { type: "hint", clueId: "a", stage: STAGE_DEFINITION }).state;
    expect(nextStage(s, "a")).toBe(STAGE_INDICATOR);
    expect(hintOffersFor(s, "a").some((o) => o.tier === STAGE_DEVICE)).toBe(false);
    expect(engine.apply(s, { type: "identify", clueId: "a", device: "anagram" }).code).toBe("device-given");
  });

  it("mechanism practice records guesses, accepts mistakes, and a correct guess skips the device hint", () => {
    let s = start("cw-s1");
    const wrong = engine.apply(s, { type: "identify", clueId: "b", device: "hidden" });
    expect(wrong.ok).toBe(true);
    expect(wrong.code).toBe("device-incorrect");
    s = wrong.state;
    expect(engine.apply(s, { type: "identify", clueId: "b", device: "hidden" }).code).toBe("device-repeat");
    s = engine.apply(s, { type: "identify", clueId: "b", device: "anagram" }).state;
    expect(engine.apply(s, { type: "identify", clueId: "b", device: "charade" }).code).toBe("device-known");
    s = engine.apply(s, { type: "hint", clueId: "b", stage: STAGE_DEFINITION }).state;
    expect(nextStage(s, "b")).toBe(STAGE_INDICATOR);
    for (const id of ["a", "b", "c"]) s = engine.apply(s, { type: "hint", clueId: id, stage: STAGE_REVEAL }).state;
    expect(engine.result(s)!.details.join(" ")).toMatch(/first time on 0 of 1 clue/);
  });

  it("reveal marks the clue revealed (0 points); all revealed gives a revealed outcome", () => {
    let s = start("cw-e1");
    const r = engine.apply(s, { type: "hint", clueId: "a", stage: STAGE_REVEAL });
    expect(r.ok).toBe(true);
    expect(r.state.progress.a.status).toBe("revealed");
    expect(submit(r.state, "a", "SPARROW").code).toBe("already-finished");
    s = submit(r.state, "b", "ridge").state;
    s = submit(s, "c", "carnation").state;
    expect(engine.outcome(s)).toBe("completed");
    expect(engine.result(s)!.headline).toBe("2 of 3 clues solved, 1 revealed.");
    expect(score(s)).toBe(67);
    const all = engine.apply(start("cw-e1"), { type: "reveal-all" });
    expect(engine.outcome(all.state)).toBe("revealed");
    expect(engine.apply(all.state, { type: "reveal-all" }).ok).toBe(false);
  });

  it("every round is solvable with its authored answers", () => {
    for (const r of rounds) {
      let s = engine.initialise(r.payload, sessionOptionsFor(r.meta, 2));
      for (const c of r.payload.clues) {
        const t = submit(s, c.id, c.answer);
        expect(t.ok, `${r.meta.id}.${c.id}`).toBe(true);
        s = t.state;
      }
      expect(engine.outcome(s)).toBe("completed");
      expect(score(s)).toBe(100);
    }
  });

  it("restores exactly by replaying stored actions", () => {
    const b = bundle("cw-s2");
    const actions = [
      { type: "hint", clueId: "b", stage: 1 },
      { type: "identify", clueId: "a", device: "double-definition" },
      { type: "submit", clueId: "a", answer: "spring" },
    ];
    let s = engine.initialise(b.payload, sessionOptionsFor(b.meta, 5));
    for (const a of actions) s = engine.apply(s, a as never).state;
    const stored = {
      schemaVersion: 1, attemptId: "att-1", gameId: "cryptic-workshop", roundId: b.meta.id, contentHash: b.meta.contentHash,
      rulesVersion: b.meta.rulesVersion, dictionaryVersion: b.meta.dictionaryVersion, mode: "standard", seed: 5, practice: true, revision: 3,
      actions: actions.map((action, i) => ({ id: `a${i}`, at: "2026-01-01T00:00:00Z", action })), outcome: "playing", assisted: true,
      createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    };
    const res = restoreAttempt(engine, b.payload, b.meta, stored);
    expect(res.status).toBe("restored");
    if (res.status === "restored") expect(res.state).toEqual(s);
  });

  it("property: arbitrary submissions never change state unless exactly the answer", () => {
    const s = start("cw-g2");
    fc.assert(
      fc.property(fc.constantFrom("a", "b", "c"), fc.string({ maxLength: 10 }), (id, text) => {
        const t = submit(s, id, text);
        const c = s.clues.find((x) => x.id === id)!;
        if (t.ok) expect(text.toUpperCase().replace(/[^A-Z]/g, "")).toBe(c.answer);
        else expect(t.state).toBe(s);
      }),
      { numRuns: 300 },
    );
  });
});
