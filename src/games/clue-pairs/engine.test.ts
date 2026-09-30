import { describe, expect, it } from "vitest";
import type { RoundBundle } from "../types";
import { createCluePairsEngine, HINT_EXAMPLE, HINT_LETTER, HINT_REVEAL_CARD, letterPattern, type CluePairsAction, type CluePairsPayload, type CluePairsState } from "./engine";
import { rounds } from "./rounds";
import { validateContent } from "./validate";
import { sessionOptionsFor } from "@/lib/progress/attempt";

const engine = createCluePairsEngine();
const byId = (id: string) => rounds.find((r) => r.meta.id === id) as RoundBundle<CluePairsPayload>;
const start = (id: string) => {
  const b = byId(id);
  return engine.initialise(b.payload, sessionOptionsFor(b.meta, 1));
};
const run = (s: CluePairsState, ...actions: CluePairsAction[]) => {
  for (const a of actions) {
    const t = engine.apply(s, a);
    if (!t.ok) throw new Error(`${a.type} rejected: ${t.message}`);
    s = t.state;
  }
  return s;
};
const submit = (cardId: string, answer: string): CluePairsAction => ({ type: "submit", cardId, answer });

describe("Clue Pairs content", () => {
  it("passes the content validator", () => {
    expect(validateContent()).toEqual([]);
  });

  it("has four authored five-card rounds per difficulty plus the two pack demos", () => {
    for (const d of ["gentle", "standard", "expert"] as const) {
      const practice = rounds.filter((r) => r.meta.difficulty === d && r.meta.status === "practice");
      expect(practice.length).toBeGreaterThanOrEqual(4);
      for (const r of practice) expect(r.payload.cards.length).toBe(5);
    }
    expect(rounds.filter((r) => r.meta.status === "demo").map((r) => r.meta.sourceFixtureId)).toEqual(["pairs-001", "pairs-002"]);
  });

  it("regression DRAFT/DRAUGHT: the air-current card accepts only DRAUGHT, and DRAFT is only used for its own senses", () => {
    const all = rounds.flatMap((r) => r.payload.cards);
    const draught = all.find((c) => c.accepted.includes("DRAUGHT"))!;
    expect(draught.clues.join(" ")).toMatch(/current of air/);
    expect(draught.accepted).toEqual(["DRAUGHT"]);
    for (const c of all.filter((x) => x.accepted.includes("DRAFT"))) expect(c.clues.join(" ")).not.toMatch(/air|chequered/i);
    let s = start("cp-e1");
    const t = engine.apply(s, submit("a", "DRAFT"));
    expect(t.ok).toBe(false);
    expect(t.code).toBe("wrong-length");
    s = run(s, submit("a", "draught"));
    expect(s.cards[0].status).toBe("solved");
  });
});

describe("Clue Pairs engine", () => {
  it("accepts CRANE and BARK in their authored senses; case and surrounding spaces are normalised", () => {
    let s = start("cp-demo-1");
    const t = engine.apply(s, submit("a", "  crane "));
    expect(t.ok).toBe(true);
    expect(t.code).toBe("solved");
    s = run(t.state, submit("b", "Bark"));
    expect(s.cards[1].answer).toBe("BARK");
  });

  it("completes pairs-001 in reverse card order", () => {
    let s = start("cp-demo-1");
    s = run(s, submit("e", "BEAM"), submit("d", "MATCH"), submit("c", "SOLE"), submit("b", "BARK"), submit("a", "CRANE"));
    expect(engine.outcome(s)).toBe("completed");
    const r = engine.result(s)!;
    expect(r.score).toBe(100);
    expect(r.headline).toBe("All 5 cards solved without help.");
    expect(r.shareText).not.toMatch(/CRANE|BARK|SOLE|MATCH|BEAM/);
  });

  it("completes pairs-002 in mixed order with BANK, SPRING, SEAL, BAT and JAM", () => {
    const s = run(start("cp-demo-2"), submit("c", "SEAL"), submit("a", "BANK"), submit("e", "JAM"), submit("b", "SPRING"), submit("d", "BAT"));
    expect(engine.outcome(s)).toBe("completed");
  });

  it("a real word that fits only one meaning is a wrong guess; repeating it costs nothing", () => {
    let s = start("cp-demo-1");
    const t = engine.apply(s, submit("a", "HERON")); // a wading bird, but not a lifting machine
    expect(t.ok).toBe(true);
    expect(t.code).toBe("wrong");
    expect(t.message).toContain("must fit both meanings");
    expect(t.message).not.toMatch(/bird|machine/i);
    s = t.state;
    expect(s.cards[0].wrong).toEqual(["HERON"]);
    const again = engine.apply(s, submit("a", "heron"));
    expect(again.ok).toBe(false);
    expect(again.code).toBe("already-tried");
    expect(again.state).toBe(s);
  });

  it("rejects punctuation, spaces and wrong lengths recoverably, without counting an attempt", () => {
    const s = start("cp-demo-1");
    for (const [answer, code] of [["CR-NE", "non-letters"], ["CR NE", "non-letters"], ["CRAN", "wrong-length"], ["", "empty"]]) {
      const t = engine.apply(s, submit("a", answer));
      expect(t.ok).toBe(false);
      expect(t.code).toBe(code);
      expect(t.state).toBe(s);
    }
    expect(engine.apply(s, submit("a", "CRAN")).message).toContain("5 letters");
  });

  it("repeated submission of a solved card does not add points twice", () => {
    let s = run(start("cp-demo-1"), submit("a", "CRANE"));
    const t = engine.apply(s, submit("a", "CRANE"));
    expect(t.ok).toBe(false);
    expect(t.code).toBe("already-solved");
    s = run(s, submit("b", "BARK"), submit("c", "SOLE"), submit("d", "MATCH"), submit("e", "BEAM"));
    expect(engine.result(s)?.score).toBe(100);
  });

  it("accepted alternates: any listed spelling solves the card", () => {
    const b = byId("cp-demo-1");
    const payload: CluePairsPayload = { ...b.payload, cards: b.payload.cards.map((c) => (c.id === "a" ? { ...c, accepted: ["CRANE", "KRANE"] } : c)) };
    const s = engine.initialise(payload, sessionOptionsFor(b.meta, 1));
    const t = engine.apply(s, submit("a", "krane"));
    expect(t.code).toBe("solved");
    expect(t.state.cards[0].answer).toBe("KRANE");
  });

  it("hints are per card and progressive: letters, then usage example; reveal is separate and scores 0", () => {
    let s = start("cp-demo-2");
    expect(engine.apply(s, { type: "hint", tier: HINT_EXAMPLE }).code).toBe("hint-unavailable");
    // Request a BAT hint: select card d, never exposing card a.
    s = run(s, { type: "select", cardId: "d" });
    let t = engine.apply(s, { type: "hint", tier: HINT_LETTER });
    expect(t.message).toBe("Card 4 starts with B.");
    s = t.state;
    t = engine.apply(s, { type: "hint", tier: HINT_LETTER });
    expect(t.message).toBe("Card 4 starts BA.");
    s = t.state;
    expect(letterPattern(s.cards[3])).toBe("B A _");
    // Cannot reveal every letter via the letter hint.
    expect(engine.apply(s, { type: "hint", tier: HINT_LETTER }).code).toBe("hint-unavailable");
    t = engine.apply(s, { type: "hint", tier: HINT_EXAMPLE });
    expect(t.message).toContain("hung upside down");
    expect(t.message).not.toMatch(/\bBAT\b/);
    s = t.state;
    expect(s.cards[0].hints).toEqual([]);
    expect(s.cards[0].status).toBe("open");
    // Solving a hinted card still scores, but is assisted.
    s = run(s, submit("d", "bat"), { type: "select", cardId: "a" }, { type: "hint", tier: HINT_REVEAL_CARD });
    expect(s.cards[0].status).toBe("revealed");
    expect(engine.apply(s, submit("a", "BANK")).code).toBe("already-revealed");
    s = run(s, submit("b", "SPRING"), submit("c", "SEAL"), submit("e", "JAM"));
    const r = engine.result(s)!;
    expect(r.outcome).toBe("completed");
    expect(r.score).toBe(80);
    expect(r.assistance).toEqual({ hints: 3, reveals: 1 });
    expect(r.headline).toContain("2 with help");
    expect(r.details.join(" ")).toContain("Assisted");
    expect(r.explanation?.[0]).toContain("(revealed)");
  });

  it("reveal all ends as revealed, never an unaided win, and later submissions are refused", () => {
    let s = run(start("cp-g1"), submit("a", "RING"), { type: "reveal-all" });
    expect(engine.outcome(s)).toBe("revealed");
    const r = engine.result(s)!;
    expect(r.score).toBe(20);
    expect(r.headline).toContain("You solved 1 of 5");
    expect(engine.apply(s, submit("b", "PALM")).code).toBe("round-over");
    s = run(s, { type: "select", cardId: "c" });
    expect(s.current).toBe("c");
  });

  it("scores 100/cardCount per solved card, rounding once at the end", () => {
    const b = byId("cp-demo-1");
    const payload: CluePairsPayload = { ...b.payload, cards: b.payload.cards.slice(0, 3) };
    let s = engine.initialise(payload, sessionOptionsFor(b.meta, 1));
    s = run(s, submit("a", "CRANE"), submit("b", "BARK"), { type: "select", cardId: "c" }, { type: "hint", tier: HINT_REVEAL_CARD });
    expect(engine.result(s)?.score).toBe(67);
  });

  it("switching cards keeps the current card for resume; selecting the same card is refused", () => {
    let s = start("cp-s1");
    s = run(s, { type: "select", cardId: "c" });
    expect(s.current).toBe("c");
    expect(engine.apply(s, { type: "select", cardId: "c" }).ok).toBe(false);
    expect(engine.apply(s, { type: "select", cardId: "zz" }).code).toBe("unknown-card");
  });

  it("every round is solvable with its accepted answers and replay is deterministic", () => {
    for (const b of rounds) {
      const actions: CluePairsAction[] = [...b.payload.cards].reverse().map((c) => submit(c.id, c.accepted[0].toLowerCase()));
      const a = actions.reduce((s, act) => engine.apply(s, act).state, engine.initialise(b.payload, sessionOptionsFor(b.meta, 3)));
      const c = actions.reduce((s, act) => engine.apply(s, act).state, engine.initialise(b.payload, sessionOptionsFor(b.meta, 3)));
      expect(engine.outcome(a)).toBe("completed");
      expect(a).toEqual(c);
    }
  });
});
