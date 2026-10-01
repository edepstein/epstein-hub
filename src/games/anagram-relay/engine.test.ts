import { describe, expect, it } from "vitest";
import { sessionOptionsFor } from "@/lib/progress/attempt";
import { loadFamiliarSync, loadMembershipSync, loadUncommonSync } from "@/lib/dictionary/node";
import {
  addedLetter,
  addedPosition,
  createAnagramRelayEngine,
  HINT_FILL,
  HINT_LETTER,
  HINT_PATTERN,
  HINT_REVEAL_ALL,
  HINT_START,
  suggestedLetter,
  type RelayAction,
  type RelayPayload,
  type RelayState,
} from "./engine";
import { rounds } from "./rounds";
import { checkRelayRound, validateContent } from "./validate";

const engine = createAnagramRelayEngine();
const bundle = (id: string) => rounds.find((r) => r.meta.id === id)!;
const start = (id: string) => {
  const b = bundle(id);
  return engine.initialise(b.payload, sessionOptionsFor(b.meta, 1));
};
function play(s: RelayState, actions: RelayAction[]) {
  for (const a of actions) {
    const t = engine.apply(s, a);
    expect(t.ok, `${JSON.stringify(a)}: ${t.message}`).toBe(true);
    s = t.state;
  }
  return s;
}
const submit = (word: string): RelayAction => ({ type: "submit", word });

describe("Anagram Relay rules (add exactly one letter)", () => {
  it("STARE+N ASTERN +P PARENTS +R PARTNERS and PLATE+N PLANET +S PLANETS +R PLANTERS", () => {
    expect([addedLetter("STARE", "ASTERN"), addedLetter("ASTERN", "PARENTS"), addedLetter("PARENTS", "PARTNERS")]).toEqual(["N", "P", "R"]);
    expect([addedLetter("PLATE", "PLANET"), addedLetter("PLANET", "PLANETS"), addedLetter("PLANETS", "PLANTERS")]).toEqual(["N", "S", "R"]);
    for (const [id, words] of [
      ["ar-demo-1", ["astern", "parents", "partners"]],
      ["ar-demo-2", ["PLANET", "PLANETS", "PLANTERS"]],
    ] as const) {
      const s = play(start(id), words.map(submit));
      expect(engine.outcome(s)).toBe("completed");
      expect(engine.result(s)!.score).toBe(100);
    }
  });

  it("rejects STARE to ALERT: the discarded exchange-one rule", () => {
    const s = start("ar-demo-1");
    const t = engine.apply(s, submit("ALERT"));
    expect(t.ok).toBe(false);
    expect(t.code).toBe("substitution");
    expect(t.message).toContain("swaps S for L");
    expect(t.state).toBe(s);
  });

  it("rejects PLANET to PLATE (removes a letter), pure anagrams, two added letters and unused old letters", () => {
    const s = play(start("ar-demo-2"), [submit("PLANET")]);
    expect(engine.apply(s, submit("PLATE")).code).toBe("dropped-letter");
    expect(engine.apply(s, submit("PLATEN")).code).toBe("pure-anagram");
    expect(engine.apply(s, submit("PLANETSS")).code).toBe("too-many-added");
    expect(engine.apply(s, submit("PLANTS")).code).toBe("substitution");
    expect(engine.apply(s, submit("PLAN ETS")).code).toBe("non-letters");
  });

  it("allows the added letter to repeat one already present (a second R to PARENTS)", () => {
    expect(addedLetter("PARENTS", "PARTNERS")).toBe("R");
    expect(addedPosition("PARENTS", "PARTNERS")).toBe(7);
    const s = play(start("ar-demo-1"), ["ASTERN", "PARENTS"].map(submit));
    expect(engine.preview(s, "PARTNERS").message).toContain("adds R");
    expect(engine.outcome(play(s, [submit("PARTNERS")]))).toBe("completed");
  });

  it("requires the clue's answer, not any legal add-one word", () => {
    const s = start("ar-demo-1");
    // STARE + S = TEARS... not 6 letters; STARE + D = TREADS/DATERS; legal move but wrong clue.
    const t = engine.apply(s, submit("TREADS"));
    expect(t.code).toBe("not-clue-answer");
  });

  it("accepts both authored branches and completes the chain from each", () => {
    for (const w of ["ANGERED", "ENRAGED"]) {
      const s = play(start("ar-e2"), [submit("DANGER"), submit(w), submit("ENDANGER")]);
      expect(engine.outcome(s)).toBe("completed");
      expect(s.answers[1]).toBe(w);
    }
    for (const w of ["NOTE", "TONE"]) expect(engine.outcome(play(start("ar-s6"), [submit(w), submit("TENOR"), submit("CORNET")]))).toBe("completed");
  });

  it("one wrong stage does not break others; revising clears only dependent stages", () => {
    let s = play(start("ar-s2"), [submit("EMAIL"), submit("MALICE")]);
    const wrong = engine.apply(s, submit("MIRACEL"));
    expect(wrong.ok).toBe(false);
    expect(wrong.state.answers).toEqual(["EMAIL", "MALICE"]);
    s = play(s, [{ type: "revise", stage: 1 }]);
    expect(s.answers).toEqual(["EMAIL"]);
    expect(s.revisions).toBe(1);
    expect(engine.apply(s, { type: "revise", stage: 2 }).code).toBe("not-answered");
    s = play(s, ["MALICE", "MIRACLE"].map(submit));
    expect(engine.outcome(s)).toBe("completed");
  });

  it("hints: letter, opening letters, pattern, fill (scores 0); gentle already shows the letter", () => {
    let s = start("ar-s1");
    expect(engine.apply(s, { type: "hint", tier: HINT_START }).code).toBe("hint-unavailable");
    let t = engine.apply(s, { type: "hint", tier: HINT_LETTER });
    expect(t.message).toContain("add H to RATE");
    s = t.state;
    t = engine.apply(s, { type: "hint", tier: HINT_START });
    expect(t.message).toContain("begins HE");
    s = t.state;
    t = engine.apply(s, { type: "hint", tier: HINT_PATTERN });
    expect(t.message).toContain("H E _ _ _");
    expect(t.message).toContain("position 1");
    s = play(t.state, [{ type: "hint", tier: HINT_FILL }, submit("THREAD"), submit("BREADTH")]);
    const r = engine.result(s)!;
    expect(r.score).toBe(67);
    expect(r.assistance).toEqual({ hints: 3, reveals: 1 });

    const g = start("ar-g1");
    expect(suggestedLetter(g)).toBe("H");
    expect(engine.apply(g, { type: "hint", tier: HINT_LETTER }).code).toBe("hint-unavailable");
    expect(engine.apply(g, { type: "hint", tier: HINT_START }).ok).toBe(true);
  });

  it("hints follow the player's branch", () => {
    const s = play(start("ar-e2"), [submit("DANGER"), submit("ENRAGED")]);
    expect(engine.apply(s, { type: "hint", tier: HINT_LETTER }).message).toContain("add N to ENRAGED");
  });

  it("reveal ends honestly; repeated terminal submits do not score twice", () => {
    let s = play(start("ar-e3"), [submit("LATTER"), { type: "hint", tier: HINT_REVEAL_ALL }]);
    expect(engine.outcome(s)).toBe("revealed");
    expect(engine.result(s)!.score).toBe(33);
    expect(engine.apply(s, submit("PLATTER")).code).toBe("finished");
    s = play(start("ar-g2"), ["NOTE", "STONE", "HONEST"].map(submit));
    const again = engine.apply(s, submit("HONEST"));
    expect(again.ok).toBe(false);
    expect(again.state).toBe(s);
    expect(engine.result(s)!.details.join(" ")).toContain("Letters added: O, S, H");
  });

  it("replays deterministically", () => {
    const actions: RelayAction[] = [submit("DANGER"), { type: "hint", tier: HINT_LETTER }, submit("ANGERED"), { type: "revise", stage: 1 }, submit("ENRAGED")];
    expect(play(start("ar-e2"), actions)).toEqual(play(start("ar-e2"), actions));
  });
});

describe("Anagram Relay content", () => {
  const membership = loadMembershipSync();
  const familiar = loadFamiliarSync();
  it("all bundled rounds validate and every chain plays to completion", () => {
    expect(validateContent()).toEqual([]);
    for (const r of rounds)
      for (const chain of r.payload.acceptedChains)
        expect(engine.outcome(play(engine.initialise(r.payload, sessionOptionsFor(r.meta, 1)), chain.slice(1).map(submit)))).toBe("completed");
  });

  it("has the target number of rounds per difficulty", () => {
    const min: Record<string, number> = { gentle: 14, standard: 14, expert: 20, master: 14 };
    for (const d of Object.keys(min)) expect(rounds.filter((r) => r.meta.difficulty === d).length).toBeGreaterThanOrEqual(min[d]);
  });

  it("Master relays finish on nine or ten letters, never show the added letter and need rearranging", () => {
    for (const r of rounds.filter((x) => x.meta.difficulty === "master")) {
      const chain = r.payload.acceptedChains[0];
      expect(chain[chain.length - 1].length).toBeGreaterThanOrEqual(9);
      expect(r.payload.suggestAddedLetter).toBe(false);
      expect(r.payload.stages.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("a four-stage Master relay scores 25 per stage and its letter hint is a real hint", () => {
    let s = start("ar-m1");
    expect(engine.hints(s).find((h) => h.tier === HINT_LETTER)?.available).toBe(true);
    s = play(s, [submit("TITULAR"), { type: "hint", tier: HINT_FILL }, submit("MUTILATOR"), submit("STIMULATOR")]);
    const res = engine.result(s)!;
    expect(res.score).toBe(75);
  });

  it("Master validation rejects shown letters, a slipped-in letter, wrong length and answers outside the Master layers", () => {
    const uncommon = loadUncommonSync();
    const m = (mut: (p: RelayPayload) => void) => {
      const p = structuredClone(bundle("ar-m1").payload);
      mut(p);
      return checkRelayRound({ id: "x", status: "practice", title: "t" }, p, membership, familiar, uncommon, "master").join(" ");
    };
    expect(m(() => {})).toBe("");
    expect(m((p) => (p.suggestAddedLetter = true))).toContain("never show the letter");
    expect(m((p) => p.stages.pop())).toMatch(/nine- or ten-letter|answers for/);
    expect(m((p) => {
      p.acceptedChains[0][1] = "RITUALS";
      p.addedLetters[0][0] = "S";
    })).toContain("slipped in");
  });

  const broken = (mut: (p: RelayPayload) => void) => {
    const p = structuredClone(bundle("ar-demo-1").payload);
    mut(p);
    return checkRelayRound({ id: "x", status: "demo", title: "t" }, p, membership, familiar).join(" ");
  };

  it("rejects the pack's broken fixture (old exchange-one relay) and wrong added-letter metadata", () => {
    expect(broken((p) => (p.acceptedChains[0][1] = "ALERT"))).toMatch(/drops S from STARE/);
    expect(broken((p) => (p.addedLetters[0][0] = "M"))).toContain("stored M, computed N");
    expect(broken((p) => p.acceptedChains.push(["STARE", "ASTERN", "PARENTS"]))).toContain("without a complete continuation");
    expect(broken((p) => (p.acceptedChains[0][2] = "ASTERNS"))).toMatch(/adds|drops/);
  });
});
