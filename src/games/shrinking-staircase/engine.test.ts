import { describe, expect, it } from "vitest";
import { sessionOptionsFor } from "@/lib/progress/attempt";
import { loadFamiliarSync, loadMembershipSync } from "@/lib/dictionary/node";
import {
  createStaircaseEngine,
  describeStep,
  HINT_FILL,
  HINT_FIRST,
  HINT_LETTER,
  HINT_REVEAL_ALL,
  removedLetter,
  type StairAction,
  type StairPayload,
  type StairState,
} from "./engine";
import { rounds } from "./rounds";
import { checkStaircaseRound, validateContent } from "./validate";

const engine = createStaircaseEngine();
const bundle = (id: string) => rounds.find((r) => r.meta.id === id)!;
const start = (id: string) => {
  const b = bundle(id);
  return engine.initialise(b.payload, sessionOptionsFor(b.meta, 1));
};
function play(s: StairState, actions: StairAction[]) {
  for (const a of actions) {
    const t = engine.apply(s, a);
    expect(t.ok, `${JSON.stringify(a)}: ${t.message}`).toBe(true);
    s = t.state;
  }
  return s;
}
const submit = (word: string): StairAction => ({ type: "submit", word });

describe("Shrinking Staircase rules", () => {
  it("completes STONE, TONE, ONE, ON and STEAM, MEAT, MAT, AT with 100 points", () => {
    for (const [id, words] of [
      ["sc-demo-1", ["TONE", "ONE", "ON"]],
      ["sc-demo-2", ["meat", " mat ", "At"]],
    ] as const) {
      const s = play(start(id), words.map(submit));
      expect(engine.outcome(s)).toBe("completed");
      const r = engine.result(s)!;
      expect(r.score).toBe(100);
      expect(r.assistance).toEqual({ hints: 0, reveals: 0 });
      expect(r.explanation?.[0]).toMatch(/−/);
    }
  });

  it("rejects STONE to TUNE because U was introduced, atomically", () => {
    const s = start("sc-demo-1");
    const t = engine.apply(s, submit("TUNE"));
    expect(t.ok).toBe(false);
    expect(t.code).toBe("added-letter");
    expect(t.message).toContain("U is not in STONE");
    expect(t.state).toBe(s);
  });

  it("requires exactly one removed letter: pure anagrams and double removals fail on length", () => {
    const s = start("sc-demo-1");
    expect(engine.apply(s, submit("NOTES")).code).toBe("wrong-length");
    expect(engine.apply(s, submit("ONE")).code).toBe("wrong-length");
    expect(engine.apply(s, submit("TO NE")).code).toBe("non-letters");
    expect(engine.apply(s, submit("")).code).toBe("empty");
  });

  it("requires the clue's answer, not just any rearrangement", () => {
    const s = start("sc-demo-1");
    const t = engine.apply(s, submit("NOTE"));
    expect(t.ok).toBe(false);
    expect(t.code).toBe("not-clue-answer");
    expect(t.message).toContain("uses the right letters");
  });

  it("handles repeated letters as a multiset", () => {
    // PATTERN has two Ts; using three is an added letter, removing one T is legal.
    const s = start("sc-e3");
    const tooMany = engine.apply(s, submit("TATTER"));
    expect(tooMany.ok).toBe(false);
    expect(tooMany.message).toContain("PATTERN has only two Ts");
    expect(removedLetter("PATTERN", "PARENT")).toBe("T");
    expect(describeStep("PATTERN", "PARENT").occurrence).toBe("one of the two Ts");
    expect(removedLetter("TEACHER", "HEATER")).toBe("C");
    expect(removedLetter("HERE", "HER")).toBe("E");
  });

  it("accepts every authored branch and follows the chosen branch", () => {
    const a = play(start("sc-e1"), [submit("ANGERED")]);
    const b = play(start("sc-e1"), [submit("ENRAGED")]);
    for (const s of [a, b]) {
      const done = play(s, ["DANGER", "GRAND", "RANG", "NAG", "AN"].map(submit));
      expect(engine.outcome(done)).toBe("completed");
    }
    // Branch late in the chain: PAT or TAP.
    const base = play(start("sc-e3"), ["PARENT", "TAPER", "TAPE"].map(submit));
    expect(engine.outcome(play(base, [submit("TAP"), submit("AT")]))).toBe("completed");
    expect(engine.outcome(play(base, [submit("PAT"), submit("AT")]))).toBe("completed");
    // The player's chosen predecessor is never silently changed.
    expect(play(start("sc-e1"), [submit("ENRAGED")]).answers[0]).toBe("ENRAGED");
  });

  it("revising an earlier rung clears only the dependent later rungs and keeps hint history", () => {
    let s = play(start("sc-s1"), [submit("TWINE"), { type: "hint", tier: HINT_LETTER }, submit("TWIN"), submit("WIT")]);
    expect(s.answers).toEqual(["TWINE", "TWIN", "WIT"]);
    s = play(s, [{ type: "revise", rung: 1 }]);
    expect(s.answers).toEqual(["TWINE"]);
    expect(s.hints).toHaveLength(1);
    expect(s.revisions).toBe(1);
    expect(engine.apply(s, { type: "revise", rung: 3 }).code).toBe("not-answered");
    s = play(s, ["TWIN", "WIT", "IT"].map(submit));
    expect(engine.outcome(s)).toBe("completed");
    expect(engine.result(s)!.details.join(" ")).toContain("revised an earlier rung 1 time");
  });

  it("hints progress per rung: letter (with occurrence), first letter, fill (scores 0)", () => {
    let s = start("sc-e3");
    expect(engine.apply(s, { type: "hint", tier: HINT_FIRST }).code).toBe("hint-unavailable");
    let t = engine.apply(s, { type: "hint", tier: HINT_LETTER });
    expect(t.message).toContain("one of the two Ts");
    s = t.state;
    expect(engine.apply(s, { type: "hint", tier: HINT_LETTER }).ok).toBe(false);
    t = engine.apply(s, { type: "hint", tier: HINT_FIRST });
    expect(t.message).toContain("begins with P");
    s = t.state;
    t = engine.apply(s, { type: "hint", tier: HINT_FILL });
    expect(t.ok).toBe(true);
    expect(t.state.answers).toEqual(["PARENT"]);
    expect(t.state.revealed).toEqual([true]);
    s = play(t.state, ["TAPER", "TAPE", "PAT", "AT"].map(submit));
    const r = engine.result(s)!;
    expect(r.outcome).toBe("completed");
    expect(r.score).toBe(80);
    expect(r.assistance).toEqual({ hints: 2, reveals: 1 });
  });

  it("hints follow the player's branch", () => {
    const s = play(start("sc-e3"), ["PARENT", "TAPER", "TAPE", "TAP"].map(submit));
    const t = engine.apply(s, { type: "hint", tier: HINT_LETTER });
    expect(t.message).toContain("remove the P from TAP");
  });

  it("reveal all ends as revealed with honest scoring; terminal actions are rejected", () => {
    let s = play(start("sc-s2"), [submit("IRATE")]);
    s = play(s, [{ type: "hint", tier: HINT_REVEAL_ALL }]);
    expect(engine.outcome(s)).toBe("revealed");
    expect(s.answers).toEqual(["IRATE", "RATE", "TEA", "AT"]);
    const r = engine.result(s)!;
    expect(r.score).toBe(25);
    expect(r.outcome).toBe("revealed");
    expect(engine.apply(s, submit("RATE")).code).toBe("finished");
    expect(engine.apply(s, { type: "hint", tier: HINT_LETTER }).code).toBe("finished");
    expect(engine.hints(s)).toEqual([]);
  });

  it("repeated Submit after completion does not add points twice", () => {
    const s = play(start("sc-g1"), ["SPOT", "POT", "TO"].map(submit));
    const again = engine.apply(s, submit("TO"));
    expect(again.ok).toBe(false);
    expect(again.state).toBe(s);
    expect(engine.result(s)!.score).toBe(100);
  });

  it("replaying the same actions reproduces the same state (restore)", () => {
    const actions: StairAction[] = [submit("HONEST"), { type: "hint", tier: HINT_LETTER }, submit("TONES"), { type: "revise", rung: 1 }, submit("NOTES")];
    const a = play(start("sc-e2"), actions);
    const b = play(start("sc-e2"), actions);
    expect(b).toEqual(a);
  });

  it("scores equal fractions rounded once", () => {
    // 3 of 4 rungs solved = 75; 2 of 6 solved (expert) = 33.
    let s = play(start("sc-s3"), [{ type: "hint", tier: HINT_FILL }, ...["FORT", "FOR", "OR"].map(submit)]);
    expect(engine.result(s)!.score).toBe(75);
    s = play(start("sc-e1"), [submit("ANGERED"), submit("DANGER"), { type: "hint", tier: HINT_REVEAL_ALL }]);
    expect(engine.result(s)!.score).toBe(33);
  });

  it("preview describes the removed letter without committing", () => {
    const s = start("sc-demo-2");
    const p = engine.preview(s, "meat");
    expect(p.legal).toBe(true);
    expect(p.message).toContain("removes S");
    expect(s.answers).toEqual([]);
  });
});

describe("Shrinking Staircase content", () => {
  const membership = loadMembershipSync();
  const familiar = loadFamiliarSync();

  it("all bundled rounds validate", () => {
    expect(validateContent()).toEqual([]);
  });

  it("has at least four practice rounds per difficulty", () => {
    for (const d of ["gentle", "standard", "expert"]) {
      expect(rounds.filter((r) => r.meta.difficulty === d).length).toBeGreaterThanOrEqual(14);
    }
  });

  it("every accepted chain is playable to completion through the engine", () => {
    for (const r of rounds) {
      for (const chain of r.payload.acceptedChains) {
        const s = play(engine.initialise(r.payload, sessionOptionsFor(r.meta, 1)), chain.slice(1).map(submit));
        expect(engine.outcome(s), `${r.meta.id} ${chain.join(">")}`).toBe("completed");
      }
    }
  });

  const broken = (mut: (p: StairPayload) => void) => {
    const p = structuredClone(bundle("sc-demo-1").payload);
    mut(p);
    return checkStaircaseRound({ id: "x", status: "demo", title: "t" }, p, membership, familiar);
  };

  it("rejects the pack's deliberately broken fixture (TUNE introduces a letter)", () => {
    expect(broken((p) => (p.acceptedChains[0][1] = "TUNE")).join(" ")).toContain("introduces U");
  });

  it("rejects an accepted branch without a continuation, a substitution and a wrong enumeration", () => {
    expect(broken((p) => p.acceptedChains.push(["STONE", "NOTE", "ONE"])).join(" ")).toContain("without a complete continuation");
    expect(broken((p) => (p.acceptedChains[0][2] = "TOE")).join(" ")).toMatch(/does not remove exactly one|introduces/);
    expect(broken((p) => (p.rungs[0].length = 3)).join(" ")).toContain("expected 4");
    expect(broken((p) => (p.acceptedChains[0][1] = "TONS")).join(" ")).toContain("introduces");
  });
});
