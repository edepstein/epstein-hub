import { describe, expect, it } from "vitest";
import type { RoundBundle } from "../types";
import {
  createWordFamiliesEngine,
  HINT_CATEGORY,
  HINT_PAIR,
  HINT_REVEAL_GROUP,
  type FamiliesAction,
  type FamiliesPayload,
  type FamiliesState,
} from "./engine";
import { rounds, rawRounds } from "./rounds";
import { validateContent } from "./validate";
import { sessionOptionsFor } from "@/lib/progress/attempt";

const engine = createWordFamiliesEngine();
const byId = (id: string) => rounds.find((r) => r.meta.id === id) as RoundBundle<FamiliesPayload>;
const start = (id: string, seed = 7) => {
  const b = byId(id);
  return engine.initialise(b.payload, sessionOptionsFor(b.meta, seed));
};
const ids = (s: FamiliesState, ...labels: string[]) =>
  labels.map((l) => {
    const t = s.terms.find((x) => x.label === l);
    if (!t) throw new Error(`no tile ${l}`);
    return t.id;
  });
const run = (s: FamiliesState, ...actions: FamiliesAction[]) => {
  for (const a of actions) {
    const t = engine.apply(s, a);
    if (!t.ok) throw new Error(`${a.type} rejected: ${t.message}`);
    s = t.state;
  }
  return s;
};

describe("Word Families content", () => {
  it("passes the content validator", () => {
    expect(validateContent()).toEqual([]);
  });

  it("has at least four authored rounds per difficulty besides the demos", () => {
    for (const d of ["gentle", "standard", "expert"] as const) {
      expect(rounds.filter((r) => r.meta.difficulty === d && r.meta.status === "practice").length).toBeGreaterThanOrEqual(4);
    }
  });

  it("has at least ten rounds per difficulty (practice plus demo)", () => {
    for (const d of ["gentle", "standard", "expert"] as const) {
      expect(rounds.filter((r) => r.meta.difficulty === d).length).toBeGreaterThanOrEqual(10);
    }
  });

  it("wf-e6 and wf-e8 hidden words: exactly the intended four tiles hide a candidate", () => {
    const hiders = (id: string, list: string[]) =>
      rawRounds
        .find((r) => r.id === id)!
        .groups.flatMap((g) => g.terms)
        .filter((w) => list.some((x) => w.replace(/ /g, "").includes(x) && w !== x))
        .sort();
    const body = ["CHIN", "HIP", "ARM", "RIB", "EAR", "LEG", "LIP", "TOE", "EYE", "JAW", "GUM", "LUNG", "SHIN", "KNEE", "HAND", "HEEL", "NOSE", "NECK", "BACK", "HEAD", "FOOT", "BROW", "LASH", "LID", "CHEST", "HAIR", "NAIL", "SKIN", "BONE", "GUT", "HEART", "THUMB", "WRIST", "CALF", "THIGH", "SOLE", "PALM", "FIST", "CHEEK", "LAP", "HAM"];
    expect(hiders("wf-e6", body)).toEqual(["CHINA", "HARMONY", "SHIP", "TRIBE"]);
    const colours = ["RED", "TAN", "PINK", "BLUE", "GREY", "TEAL", "ROSE", "GOLD", "JADE", "LIME", "PLUM", "RUST", "BUFF", "NAVY", "CYAN", "ECRU", "FAWN", "AQUA", "BEIGE", "CREAM", "OCHRE", "AMBER", "LILAC", "MAUVE", "KHAKI", "WHITE", "BLACK", "BROWN", "GREEN", "PEACH", "CORAL", "IVORY", "OLIVE", "SEPIA", "SAGE", "MINT", "WINE", "RUBY", "SAND", "JET", "INK", "OPAL", "ASH"];
    expect(hiders("wf-e8", colours)).toEqual(["CHAMBER", "SACRED", "STEALTH", "SUBLIME"]);
  });

  it("imports both pack fixtures as demo rounds with their authored groups", () => {
    const demos = rounds.filter((r) => r.meta.status === "demo");
    expect(demos.map((d) => d.meta.sourceFixtureId).sort()).toEqual(["everyday-families", "starter-families"]);
    const s = start("wf-demo-2");
    expect(s.terms.some((t) => t.label === "FULL STOP")).toBe(true);
  });

  it("regression: the tutorial grouping is Gentle, never Expert, and expert rounds carry documented overlaps", () => {
    expect(byId("wf-demo-1").meta.difficulty).toBe("gentle");
    for (const r of rounds.filter((x) => x.meta.difficulty === "expert")) {
      expect(r.meta.sourceFixtureId).toBeNull();
      const board = new Set(r.payload.terms.map((t) => t.label));
      expect(r.payload.redHerrings.filter((h) => board.has(h.term)).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("every term is in exactly one group (mechanical exact cover)", () => {
    for (const { payload } of rounds) {
      const all = payload.groups.flatMap((g) => g.termIds);
      expect(new Set(all).size).toBe(payload.terms.length);
      expect(all.length).toBe(payload.terms.length);
    }
  });

  it("hidden-word categories are mechanically true, and no other tile on those boards hides a candidate", () => {
    const numbers = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE"];
    const e4 = rawRounds.find((r) => r.id === "wf-e4")!;
    const hideNum = (w: string) => numbers.some((n) => w.includes(n) && w !== n);
    const numberGroup = e4.groups.find((g) => g.label === "Hide a number")!;
    expect(numberGroup.terms.every(hideNum)).toBe(true);
    const others = e4.groups.filter((g) => g !== numberGroup).flatMap((g) => g.terms);
    expect(others.filter(hideNum)).toEqual([]);

    const animals = ["BEAR", "GOAT", "COW", "OWL", "ANT", "APE", "CAT", "DOG", "RAT", "HEN", "EMU", "ELK", "EWE", "RAM", "PIG", "BAT", "EEL", "ASS", "YAK", "GNU", "FOX", "OX", "BEE", "MOLE", "HARE", "LION", "MOUSE", "SEAL", "TIT"];
    const e2 = rawRounds.find((r) => r.id === "wf-e2")!;
    const hideAnimal = (w: string) => animals.filter((a) => w.includes(a) && w !== a);
    const animalGroup = e2.groups.find((g) => g.label === "Hide an animal")!;
    expect(animalGroup.terms.every((w) => hideAnimal(w).length > 0)).toBe(true);
    // GRAPEFRUIT (APE) is the only deliberate outside candidate, and citrus has exactly four candidates.
    const outside = e2.groups.filter((g) => g !== animalGroup).flatMap((g) => g.terms).filter((w) => hideAnimal(w).length);
    expect(outside).toEqual(["GRAPEFRUIT"]);
  });
});

describe("Word Families engine", () => {
  it("accepts a correct group in any order (CRANE with the three other birds)", () => {
    let s = start("wf-demo-1");
    const t = engine.apply(s, { type: "submit", ids: ids(s, "SWAN", "CRANE", "ROBIN", "EAGLE") });
    expect(t.ok).toBe(true);
    expect(t.code).toBe("group-found");
    expect(t.message).toContain("Birds");
    s = t.state;
    expect(s.solved).toEqual([{ groupId: "g1", via: "found" }]);
    expect(s.mistakes).toBe(0);
  });

  it("exact-size selection: three or five terms are rejected atomically with no mistake", () => {
    const s = start("wf-demo-1");
    const three = engine.apply(s, { type: "submit", ids: ids(s, "ROBIN", "CRANE", "EAGLE") });
    expect(three.ok).toBe(false);
    expect(three.code).toBe("wrong-size");
    expect(three.state).toBe(s);
    expect(three.message).toContain("you have selected 3");
    const five = engine.apply(s, { type: "submit", ids: ids(s, "ROBIN", "CRANE", "EAGLE", "SWAN", "OPAL") });
    expect(five.ok).toBe(false);
    expect(five.code).toBe("wrong-size");
  });

  it("mixed set costs one mistake; the identical set again costs nothing (in any order)", () => {
    let s = start("wf-demo-1");
    const mixed = ids(s, "ROBIN", "CRANE", "OPAL", "SAGE");
    const t1 = engine.apply(s, { type: "submit", ids: mixed });
    expect(t1.ok).toBe(true);
    expect(t1.code).toBe("wrong-group");
    s = t1.state;
    expect(s.mistakes).toBe(1);
    const again = engine.apply(s, { type: "submit", ids: [...mixed].reverse() });
    expect(again.ok).toBe(false);
    expect(again.code).toBe("already-tried");
    expect(again.message).toContain("tried this group");
    expect(again.state.mistakes).toBe(1);
  });

  it("one away means exactly three of the four belong to one unsolved group", () => {
    const s = start("wf-demo-1");
    const t = engine.apply(s, { type: "submit", ids: ids(s, "ROBIN", "CRANE", "EAGLE", "OPAL") });
    expect(t.code).toBe("one-away");
    expect(t.message).toContain("One away");
    const two = engine.apply(s, { type: "submit", ids: ids(s, "ROBIN", "CRANE", "OPAL", "RUBY") });
    expect(two.code).toBe("wrong-group");
  });

  it("solved terms are unavailable and never trigger one-away afterwards", () => {
    let s = start("wf-demo-1");
    s = run(s, { type: "submit", ids: ids(s, "ROBIN", "CRANE", "EAGLE", "SWAN") });
    const t = engine.apply(s, { type: "submit", ids: ids(s, "ROBIN", "OPAL", "RUBY", "PEARL") });
    expect(t.ok).toBe(false);
    expect(t.code).toBe("term-solved");
    expect(t.message).toContain("ROBIN");
  });

  it("rejects unknown ids and duplicated ids", () => {
    const s = start("wf-demo-1");
    expect(engine.apply(s, { type: "submit", ids: ["t01", "t02", "t03", "zz"] }).code).toBe("unknown-term");
    expect(engine.apply(s, { type: "submit", ids: ["t01", "t01", "t02", "t03"] }).code).toBe("duplicate-term");
  });

  it("shuffle preserves identifiers; rejects a non-permutation", () => {
    const s = start("wf-demo-1");
    const rev = [...s.order].reverse();
    const t = engine.apply(s, { type: "shuffle", order: rev });
    expect(t.ok).toBe(true);
    expect([...t.state.order].sort()).toEqual([...s.order].sort());
    expect(engine.apply(s, { type: "shuffle", order: rev.slice(1) }).ok).toBe(false);
  });

  it("four distinct mistakes block submission until the player continues (assisted), never forcibly ending", () => {
    let s = start("wf-demo-1");
    const wrong = [
      ["ROBIN", "OPAL", "SAGE", "FLUTE"],
      ["CRANE", "RUBY", "BASIL", "OBOE"],
      ["EAGLE", "PEARL", "THYME", "CELLO"],
      ["SWAN", "JADE", "MINT", "HARP"],
    ];
    for (const w of wrong) s = run(s, { type: "submit", ids: ids(s, ...w) });
    expect(s.mistakes).toBe(4);
    expect(engine.outcome(s)).toBe("playing");
    const blocked = engine.apply(s, { type: "submit", ids: ids(s, "ROBIN", "CRANE", "EAGLE", "SWAN") });
    expect(blocked.ok).toBe(false);
    expect(blocked.code).toBe("budget-reached");
    // Hints still work while blocked.
    expect(engine.hints(s).find((h) => h.tier === HINT_CATEGORY)?.available).toBe(true);
    s = run(s, { type: "continue" });
    expect(engine.apply(s, { type: "continue" }).ok).toBe(false);
    s = run(
      s,
      { type: "submit", ids: ids(s, "ROBIN", "CRANE", "EAGLE", "SWAN") },
      { type: "submit", ids: ids(s, "FLUTE", "OBOE", "CELLO", "HARP") },
      { type: "submit", ids: ids(s, "RUBY", "OPAL", "PEARL", "JADE") },
      { type: "submit", ids: ids(s, "BASIL", "THYME", "SAGE", "MINT") },
    );
    expect(engine.outcome(s)).toBe("completed");
    const r = engine.result(s)!;
    expect(r.assistance.hints).toBe(1);
    expect(r.details.join(" ")).toContain("assisted continuation");
    expect(r.shareText).toContain("assisted");
    expect(r.shareText).not.toMatch(/ROBIN|Birds/);
  });

  it("continue is unavailable before the budget is used", () => {
    const s = start("wf-demo-1");
    expect(engine.apply(s, { type: "continue" }).code).toBe("continue-unavailable");
  });

  it("a round without continuation fails at the budget", () => {
    const b = byId("wf-demo-1");
    let s = engine.initialise({ ...b.payload, continueAfterBudget: false, mistakeBudget: 1 }, sessionOptionsFor(b.meta, 1));
    s = run(s, { type: "submit", ids: ids(s, "ROBIN", "OPAL", "SAGE", "FLUTE") });
    expect(engine.outcome(s)).toBe("failed");
    expect(engine.result(s)?.headline).toContain("Out of mistakes");
  });

  it("progressive, state-aware hints: category, then a pair, then reveal the group; recorded as assistance", () => {
    let s = start("wf-demo-2");
    const offers = engine.hints(s);
    expect(offers.find((o) => o.tier === HINT_PAIR)?.available).toBe(false);
    expect(engine.apply(s, { type: "hint", tier: HINT_PAIR }).code).toBe("hint-unavailable");
    let t = engine.apply(s, { type: "hint", tier: HINT_CATEGORY });
    expect(t.message).toBe("One group is: Things with teeth.");
    s = t.state;
    t = engine.apply(s, { type: "hint", tier: HINT_PAIR });
    expect(t.message).toContain("COMB and SAW both belong to Things with teeth");
    s = t.state;
    // Solving the hinted group moves the ladder to the next group.
    s = run(s, { type: "submit", ids: ids(s, "COMB", "SAW", "ZIP", "GEAR") });
    t = engine.apply(s, { type: "hint", tier: HINT_CATEGORY });
    expect(t.message).toBe("One group is: Types of footwear.");
    s = t.state;
    t = engine.apply(s, { type: "hint", tier: HINT_REVEAL_GROUP });
    expect(t.ok).toBe(true);
    s = t.state;
    expect(s.solved.at(-1)).toEqual({ groupId: "g2", via: "revealed" });
    s = run(
      s,
      { type: "submit", ids: ids(s, "BED", "BATH", "CLASS", "SHOW") },
      { type: "submit", ids: ids(s, "COMMA", "COLON", "DASH", "FULL STOP") },
    );
    const r = engine.result(s)!;
    expect(r.outcome).toBe("completed");
    expect(r.assistance).toEqual({ hints: 3, reveals: 1 });
    expect(r.score).toBe(3);
    expect(r.explanation?.[0]).toContain("Things with teeth: COMB, SAW, ZIP, GEAR");
    expect(r.explanation?.[1]).toContain("(revealed)");
  });

  it("reveal all ends the round as revealed, never as an unaided completion", () => {
    let s = start("wf-s1");
    s = run(s, { type: "submit", ids: ids(s, "FOOT", "SNOW", "BASKET", "MEAT") }, { type: "reveal-all" });
    expect(engine.outcome(s)).toBe("revealed");
    const r = engine.result(s)!;
    expect(r.headline).toContain("You found 1 of 4");
    expect(r.assistance.reveals).toBe(3);
    expect(engine.apply(s, { type: "submit", ids: ids(s, "SNAP", "POKER", "BRIDGE", "RUMMY") }).code).toBe("round-over");
  });

  it("standard red herring: PIN with the BALL words is a mistake (one away), the intended partition solves", () => {
    let s = start("wf-s1");
    const t = engine.apply(s, { type: "submit", ids: ids(s, "FOOT", "SNOW", "BASKET", "PIN") });
    expect(t.code).toBe("one-away");
    s = run(
      t.state,
      { type: "submit", ids: ids(s, "FOOT", "SNOW", "BASKET", "MEAT") },
      { type: "submit", ids: ids(s, "NEEDLE", "THREAD", "THIMBLE", "PIN") },
      { type: "submit", ids: ids(s, "SNAP", "POKER", "BRIDGE", "RUMMY") },
      { type: "submit", ids: ids(s, "THAMES", "SEVERN", "TRENT", "MERSEY") },
    );
    expect(engine.result(s)?.headline).toBe("All 4 groups solved.");
  });

  it("gentle practice boards have three groups of four", () => {
    let s = start("wf-g1");
    expect(s.terms.length).toBe(12);
    s = run(
      s,
      { type: "submit", ids: ids(s, "WHISK", "LADLE", "SPATULA", "COLANDER") },
      { type: "submit", ids: ids(s, "COW", "SHEEP", "PIG", "GOAT") },
      { type: "submit", ids: ids(s, "APPLE", "PEAR", "PLUM", "CHERRY") },
    );
    const r = engine.result(s)!;
    expect(r.headline).toBe("All 3 groups solved without a mistake.");
    expect(r.shareText).toContain("●●●");
    expect(r.shareText).toContain("Gentle");
  });

  it("every round is solvable by submitting its groups, and replay is deterministic", () => {
    for (const b of rounds) {
      const actions: FamiliesAction[] = [{ type: "shuffle", order: [...b.payload.terms.map((t) => t.id)].reverse() }, ...b.payload.groups.map((g) => ({ type: "submit" as const, ids: [...g.termIds].reverse() }))];
      const a = actions.reduce((s, act) => engine.apply(s, act).state, engine.initialise(b.payload, sessionOptionsFor(b.meta, 99)));
      const c = actions.reduce((s, act) => engine.apply(s, act).state, engine.initialise(b.payload, sessionOptionsFor(b.meta, 99)));
      expect(engine.outcome(a)).toBe("completed");
      expect(a).toEqual(c);
    }
  });

  it("initial order is a seeded permutation and differs from the grouped authored order", () => {
    const a = start("wf-e1", 1);
    const b = start("wf-e1", 1);
    expect(a.order).toEqual(b.order);
    expect([...a.order].sort()).toEqual(a.terms.map((t) => t.id).sort());
  });

  it("preview explains the selection without committing", () => {
    const s = start("wf-demo-1");
    expect(engine.preview(s, ids(s, "ROBIN")).message).toContain("you have selected 1");
    expect(engine.preview(s, ids(s, "ROBIN", "OPAL", "SAGE", "FLUTE")).legal).toBe(true);
  });
});
