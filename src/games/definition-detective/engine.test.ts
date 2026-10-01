import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { newAttempt, restoreAttempt, sessionOptionsFor, withAction } from "@/lib/progress/attempt";
import {
  caseScore,
  createDefinitionDetectiveEngine,
  HINT_ELIMINATE,
  HINT_FOCUS,
  HINT_REVEAL,
  roundScore,
  type DetectiveAction,
  type DetectiveState,
} from "./engine";
import { rounds } from "./rounds";
import { validateContent } from "./validate";

const engine = createDefinitionDetectiveEngine();
const bundle = (id: string) => rounds.find((r) => r.meta.id === id)!;
const start = (id: string, seed = 1) => {
  const b = bundle(id);
  return engine.initialise(b.payload, sessionOptionsFor(b.meta, seed));
};
const ans = (s: DetectiveState, cid: string) => s.cases.find((c) => c.id === cid)!.answer;
const submit = (s: DetectiveState, cid: string, d?: string | null, e?: string | null) => engine.apply(s, { type: "submit", case: cid, definitionId: d, evidenceId: e });
const wrongDef = (s: DetectiveState, cid: string) => s.cases.find((c) => c.id === cid)!.definitions.find((d) => d.id !== ans(s, cid).definitionId)!.id;
const wrongEv = (s: DetectiveState, cid: string) => s.cases.find((c) => c.id === cid)!.evidence.find((e) => e.id !== ans(s, cid).evidenceId)!.id;
const defText = (s: DetectiveState, cid: string) => {
  const c = s.cases.find((x) => x.id === cid)!;
  return c.definitions.find((d) => d.id === c.answer.definitionId)!.text;
};

describe("definition detective: fixture meanings", () => {
  it("ambivalent = conflicting feelings (not indifference); mitigate = make less severe; meticulous = attention to detail", () => {
    const s = start("dd-demo-1");
    expect(defText(s, "a")).toBe("Having conflicting feelings");
    expect(defText(s, "b")).toBe("Make less severe");
    expect(defText(s, "c")).toBe("Showing careful attention to detail");
    const indifferent = s.cases[0].definitions.find((d) => d.text === "Feeling completely indifferent")!.id;
    const t = submit(s, "a", indifferent);
    expect(t.code).toBe("definition-wrong");
    expect(t.state.cases[0].definitionSolved).toBe(false);
  });

  it("every stored evidence phrase occurs exactly once in its sentence (all fixture and practice cases)", () => {
    for (const r of rounds) for (const c of r.payload.cases) for (const e of c.evidence) expect(c.sentence.split(e.text).length - 1, `${r.meta.id}/${c.id} ${e.text}`).toBe(1);
  });
});

describe("definition detective: scoring and stages", () => {
  it("correct definition + evidence scores 100 for the case; definition alone scores 80", () => {
    let s = start("dd-demo-1");
    s = submit(s, "a", ans(s, "a").definitionId, ans(s, "a").evidenceId).state;
    expect(caseScore(s.cases[0])).toBe(100);
    s = submit(s, "b", ans(s, "b").definitionId).state;
    expect(caseScore(s.cases[1])).toBe(80);
  });

  it("completing all definitions with no evidence gives 80 and completes the file", () => {
    let s = start("dd-g1");
    for (const c of s.cases) s = submit(s, c.id, c.answer.definitionId).state;
    expect(engine.outcome(s)).toBe("completed");
    expect(engine.result(s)!.score).toBe(80);
    expect(engine.result(s)!.details.join(" ")).toMatch(/definition only; evidence still open/);
  });

  it("round score is the floor of the average", () => {
    let s = start("dd-s1");
    s = submit(s, "a", ans(s, "a").definitionId, ans(s, "a").evidenceId).state; // 100
    s = submit(s, "b", ans(s, "b").definitionId).state; // 80
    s = submit(s, "c", ans(s, "c").definitionId).state; // 80
    expect(roundScore(s)).toBe(86); // 260 / 3 = 86.67
  });

  it("wrong definition: neutral retry, recorded once, no points; repeating it is refused", () => {
    const s = start("dd-g2");
    const d = wrongDef(s, "a");
    const t = submit(s, "a", d);
    expect(t.ok).toBe(true);
    expect(t.code).toBe("definition-wrong");
    expect(t.message).toMatch(/no points are lost/);
    expect(t.state.cases[0].triedDefinitions).toEqual([d]);
    const again = submit(t.state, "a", d);
    expect(again.code).toBe("already-tried");
    expect(again.state).toBe(t.state);
  });

  it("right definition with weak evidence keeps the definition; evidence can be revised for 20 more", () => {
    let s = start("dd-e1");
    const t = submit(s, "b", ans(s, "b").definitionId, wrongEv(s, "b"));
    expect(t.code).toBe("evidence-weak");
    s = t.state;
    expect(caseScore(s.cases[1])).toBe(80);
    expect(submit(s, "b", wrongDef(s, "b"), ans(s, "b").evidenceId).code).toBe("definition-locked");
    expect(submit(s, "b", null, null).code).toBe("choose-evidence");
    const fixed = submit(s, "b", null, ans(s, "b").evidenceId);
    expect(fixed.code).toBe("case-solved");
    expect(caseScore(fixed.state.cases[1])).toBe(100);
  });

  it("a definition is required first; unknown choices are rejected atomically", () => {
    const s = start("dd-g3");
    expect(submit(s, "a", null, ans(s, "a").evidenceId).code).toBe("choose-definition");
    expect(submit(s, "a", "d9").code).toBe("unknown-choice");
    expect(submit(s, "z", "d1").code).toBe("unknown-case");
  });

  it("duplicate Submit after a case is closed changes nothing", () => {
    let s = start("dd-g4");
    s = submit(s, "a", ans(s, "a").definitionId, ans(s, "a").evidenceId).state;
    const t = submit(s, "a", ans(s, "a").definitionId, ans(s, "a").evidenceId);
    expect(t.code).toBe("case-closed");
    expect(t.state).toBe(s);
  });

  it("cases may be solved in any order and switching never auto-advances", () => {
    let s = start("dd-s2");
    s = engine.apply(s, { type: "select", case: "c" }).state;
    expect(s.active).toBe(2);
    s = submit(s, "c", ans(s, "c").definitionId).state;
    expect(s.active).toBe(2);
  });
});

describe("definition detective: hints and reveals", () => {
  it("three stages on the active case: pointer, rule out a distractor (with reason), reveal", () => {
    let s = start("dd-demo-1");
    expect(engine.apply(s, { type: "hint", tier: HINT_ELIMINATE }).code).toBe("hint-unavailable");
    const h1 = engine.apply(s, { type: "hint", tier: HINT_FOCUS });
    expect(h1.message).toMatch(/Case 1 \(ambivalent\): Read what follows the colon/);
    s = h1.state;
    const h2 = engine.apply(s, { type: "hint", tier: HINT_ELIMINATE });
    expect(h2.message).toMatch(/Feeling completely indifferent.*does not fit\. Indifference means/);
    s = h2.state;
    expect(s.cases[0].eliminated).toBe("d2");
    const h3 = engine.apply(s, { type: "hint", tier: HINT_REVEAL });
    expect(h3.code).toBe("revealed");
    s = h3.state;
    expect(s.cases[0].revealed).toBe("full");
    expect(caseScore(s.cases[0])).toBe(0);
  });

  it("revealed versus independently solved: a reveal scores 0 but completes; hints alone keep points", () => {
    let s = start("dd-g1");
    s = engine.apply(s, { type: "hint", tier: HINT_REVEAL }).state; // case a revealed
    s = engine.apply(s, { type: "select", case: "b" }).state;
    s = engine.apply(s, { type: "hint", tier: HINT_FOCUS }).state;
    s = submit(s, "b", ans(s, "b").definitionId, ans(s, "b").evidenceId).state; // 100 with help
    s = submit(s, "c", ans(s, "c").definitionId, ans(s, "c").evidenceId).state; // 100 independent
    const r = engine.result(s)!;
    expect(r.outcome).toBe("completed");
    expect(r.score).toBe(66);
    expect(r.assistance).toEqual({ hints: 1, reveals: 1 });
    expect(r.details[0]).toMatch(/revealed \(0 points\)/);
    expect(r.details[1]).toMatch(/with 1 hint \(100 points\)/);
    expect(r.details[2]).toMatch(/solved independently \(100 points\)/);
    expect(r.shareText).not.toMatch(/reluctant|fragile|concise/i);
  });

  it("revealing evidence after a solved definition keeps the 80", () => {
    let s = start("dd-s3");
    s = submit(s, "a", ans(s, "a").definitionId).state;
    const offers = engine.hints(s);
    expect(offers.find((o) => o.tier === HINT_REVEAL)!.label).toBe("Reveal the evidence");
    expect(offers.find((o) => o.tier === HINT_ELIMINATE)!.available).toBe(false);
    s = engine.apply(s, { type: "hint", tier: HINT_REVEAL }).state;
    expect(s.cases[0].revealed).toBe("evidence");
    expect(caseScore(s.cases[0])).toBe(80);
  });

  it("rule-out never picks a definition the player already tried, and hints do not change selections", () => {
    let s = start("dd-demo-1");
    s = submit(s, "a", "d2").state; // tried the authored distractor
    s = engine.apply(s, { type: "hint", tier: HINT_FOCUS }).state;
    s = engine.apply(s, { type: "hint", tier: HINT_ELIMINATE }).state;
    expect(s.cases[0].eliminated).not.toBe("d2");
    expect(s.cases[0].eliminated).not.toBe(s.cases[0].answer.definitionId);
    expect(s.cases[0].definitionSolved).toBe(false);
  });

  it("revealing every case ends as revealed", () => {
    let s = start("dd-demo-2");
    for (const c of ["a", "b", "c"]) {
      if (s.cases[s.active].id !== c) s = engine.apply(s, { type: "select", case: c }).state;
      s = engine.apply(s, { type: "hint", tier: HINT_REVEAL }).state;
    }
    expect(engine.outcome(s)).toBe("revealed");
  });
});

describe("definition detective: order, restore and content", () => {
  it("display order is seeded, differs across seeds and never decides correctness", () => {
    const orders = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => start("dd-demo-1", seed).cases[0].definitionOrder[0]));
    expect(orders.size).toBeGreaterThan(1);
    expect(start("dd-demo-1", 9).cases[0].definitionOrder).toEqual(start("dd-demo-1", 9).cases[0].definitionOrder);
    for (const seed of [1, 2, 3]) {
      const s = start("dd-demo-1", seed);
      expect(submit(s, "a", "d1", "e1").code).toBe("case-solved");
    }
  });

  it("restore replays the same seeded order, selections, attempts and hints", () => {
    const b = bundle("dd-e2");
    let attempt = newAttempt(b.meta, "att-1", 1234, true, "2026-09-30T00:00:00Z");
    let s = engine.initialise(b.payload, sessionOptionsFor(b.meta, 1234));
    const a = s.cases[0].answer;
    const actions: DetectiveAction[] = [
      { type: "submit", case: "a", definitionId: s.cases[0].definitions.find((d) => d.id !== a.definitionId)!.id },
      { type: "hint", tier: HINT_FOCUS },
      { type: "submit", case: "a", definitionId: a.definitionId },
      { type: "select", case: "b" },
    ];
    actions.forEach((act, i) => {
      s = engine.apply(s, act).state;
      attempt = withAction(attempt, { id: `a${i}`, at: "2026-09-30T00:00:00Z", action: act }, engine.outcome(s), i > 0);
    });
    const restored = restoreAttempt(engine, b.payload, b.meta, JSON.parse(JSON.stringify(attempt)));
    expect(restored.status).toBe("restored");
    if (restored.status === "restored") expect(restored.state).toEqual(s);
  });

  it("finish early is honest and resumable", () => {
    let s = start("dd-e3");
    s = submit(s, "a", ans(s, "a").definitionId).state;
    s = engine.apply(s, { type: "finish" }).state;
    expect(engine.outcome(s)).toBe("abandoned");
    expect(engine.result(s)!.details[1]).toMatch(/left unexplored/);
    expect(engine.apply(s, { type: "resume" }).ok).toBe(true);
  });

  it("validator passes; at least four practice files per difficulty", () => {
    expect(validateContent()).toEqual([]);
    for (const d of ["gentle", "standard", "expert"] as const) expect(rounds.filter((r) => r.meta.difficulty === d && r.meta.status === "practice").length).toBeGreaterThanOrEqual(4);
  });

  it("every case in every file is solvable to 100", () => {
    for (const r of rounds) {
      let s = engine.initialise(r.payload, sessionOptionsFor(r.meta, 2));
      for (const c of s.cases) s = submit(s, c.id, c.answer.definitionId, c.answer.evidenceId).state;
      expect(engine.result(s)!.score, r.meta.id).toBe(100);
    }
  });

  it("property: arbitrary submissions never exceed 100 per case and rejections never mutate", () => {
    const s0 = start("dd-s4");
    const ids = fc.constantFrom("d1", "d2", "d3", "d4", "x", null);
    const evs = fc.constantFrom("e1", "e2", "e3", "y", null);
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.constantFrom("a", "b", "c"), ids, evs), { maxLength: 12 }), (moves) => {
        let s = s0;
        for (const [c, d, e] of moves) {
          const t = submit(s, c, d, e);
          if (!t.ok) expect(t.state).toBe(s);
          s = t.state;
          for (const cs of s.cases) expect(caseScore(cs)).toBeLessThanOrEqual(100);
        }
        expect(roundScore(s)).toBeLessThanOrEqual(100);
      }),
      { numRuns: 200 },
    );
  });
});
