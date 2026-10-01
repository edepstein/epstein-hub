import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { loadMembershipSync } from "@/lib/dictionary/node";
import { newAttempt, restoreAttempt, sessionOptionsFor, withAction } from "@/lib/progress/attempt";
import { createWordLadderEngine, HINT_INSERT, HINT_NEXT, HINT_POSITION, HINT_REVEAL, ladderScore, type LadderAction, type LadderState } from "./engine";
import { distancesFrom, hamming, isLadder, shortestPath } from "./graph";
import { rounds } from "./rounds";
import { validateContent } from "./validate";
import familiarList from "./content/familiar.json";

const membership = loadMembershipSync();
const familiar = new Set(familiarList);
const engine = createWordLadderEngine(membership, familiar);
const bundle = (id: string) => rounds.find((r) => r.meta.id === id)!;
const start = (id: string, eng = engine) => {
  const b = bundle(id);
  return eng.initialise(b.payload, sessionOptionsFor(b.meta, 1));
};
const submit = (s: LadderState, word: string, eng = engine) => eng.apply(s, { type: "submit", word });
const play = (s: LadderState, words: string[], eng = engine) => {
  for (const w of words) {
    const t = submit(s, w, eng);
    expect(t.ok, `${w}: ${t.message}`).toBe(true);
    s = t.state;
  }
  return s;
};
const words = (s: LadderState) => s.path.map((p) => p.word);

describe("pack acceptance cases", () => {
  it("COLD, CORD, CARD, WARD, WARM is legal and four moves (the optimum)", () => {
    const s = play(start("wl-demo-1"), ["CORD", "CARD", "WARD", "WARM"]);
    expect(engine.outcome(s)).toBe("completed");
    const r = engine.result(s)!;
    expect(r.score).toBe(100);
    expect(r.efficiency).toBe(1);
    expect(r.headline).toContain("That is par");
  });

  it("accepts the alternative COLD, CORD, WORD, WORM, WARM", () => {
    const s = play(start("wl-demo-1"), ["CORD", "WORD", "WORM", "WARM"]);
    expect(engine.outcome(s)).toBe("completed");
    expect(words(s)).not.toEqual(bundle("wl-demo-1").payload.examplePath);
  });

  it("rejects COLD to WARM in one move", () => {
    const s = start("wl-demo-1");
    const t = submit(s, "WARM");
    expect(t.code).toBe("too-many-changes");
    expect(t.state).toBe(s);
  });

  it("fixture dictionaries reproduce their stored optima (HEAD to TAIL is five)", () => {
    for (const r of rounds.filter((x) => x.meta.status === "demo")) {
      const dict = new Set(r.payload.fixtureDictionary);
      const eng = createWordLadderEngine(dict);
      const s = eng.initialise(r.payload, sessionOptionsFor(r.meta, 1));
      expect(s.optimalMoves, r.meta.id).toBe(r.payload.fixtureOptimalMoves);
    }
    const head = createWordLadderEngine(new Set(bundle("wl-demo-2").payload.fixtureDictionary));
    const s = play(start("wl-demo-2", head), ["HEAL", "TEAL", "TELL", "TALL", "TAIL"], head);
    expect(head.outcome(s)).toBe("completed");
    expect(s.path.length - 1).toBe(5);
    // Outside the fixture list, a common word the fixture omits is rejected there but accepted in full play.
    expect(submit(start("wl-demo-2", head), "HELD", head).code).toBe("not-in-word-list");
    expect(submit(start("wl-demo-2"), "HELD").ok).toBe(true);
  });

  it("optimum is recalculated when the lexicon changes (never reused from a smaller list)", () => {
    const b = bundle("wl-demo-1");
    const small = createWordLadderEngine(new Set(["COLD", "CORD", "CARD", "WARD", "WARM", "BOLD", "BOLT", "BOAT"]));
    expect(small.initialise(b.payload, sessionOptionsFor(b.meta, 1)).optimalMoves).toBe(4);
    const detour = createWordLadderEngine(new Set(["COLD", "CORD", "CARD", "HARD", "HARM", "WARM"]));
    expect(detour.initialise(b.payload, sessionOptionsFor(b.meta, 1)).optimalMoves).toBe(5);
  });
});

describe("rules and rejections", () => {
  it("rejects each broken rule with a precise code, leaving the route unchanged", () => {
    const s = play(start("wl-demo-1"), ["CORD"]);
    const cases: [string, string][] = [
      ["", "empty"],
      ["co-d", "non-letters"],
      ["cords", "wrong-length"],
      ["cod", "wrong-length"],
      ["cord", "no-change"],
      ["drco", "too-many-changes"],
      ["corq", "not-in-word-list"],
      ["cold", "repeated"],
    ];
    for (const [w, code] of cases) {
      const t = submit(s, w);
      expect(t.ok, w).toBe(false);
      expect(t.code, w).toBe(code);
      expect(t.state).toBe(s);
      expect(t.message.length).toBeGreaterThan(15);
    }
  });

  it("undo removes one edge; backtrack to an earlier rung truncates later steps", () => {
    let s = play(start("wl-demo-1"), ["CORD", "WORD", "WORM"]);
    s = engine.apply(s, { type: "undo" }).state;
    expect(words(s)).toEqual(["COLD", "CORD", "WORD"]);
    s = engine.apply(s, { type: "backtrack", to: 0 }).state;
    expect(words(s)).toEqual(["COLD"]);
    expect(s.undos).toBe(3);
    expect(s.movesTried).toBe(3);
    expect(engine.apply(s, { type: "undo" }).code).toBe("nothing-to-undo");
    expect(engine.apply(s, { type: "backtrack", to: 0 }).code).toBe("bad-step");
  });

  it("reaching the target closes the attempt: a repeated submit cannot append or score again", () => {
    const s = play(start("wl-demo-3"), ["COT", "COG", "DOG"]);
    const before = engine.result(s)!.score;
    for (const w of ["DOG", "DOT", "LOG"]) expect(submit(s, w).code).toBe("complete");
    expect(engine.apply(s, { type: "undo" }).code).toBe("complete");
    expect(engine.result(s)!.score).toBe(before);
  });

  it("scores 60 + floor(40 x optimum / moves), capped at 100", () => {
    expect(ladderScore(4, 4)).toBe(100);
    expect(ladderScore(4, 5)).toBe(92);
    expect(ladderScore(3, 7)).toBe(77);
    const s = play(start("wl-demo-3"), ["COT", "DOT", "LOT", "LOG", "DOG"]);
    const r = engine.result(s)!;
    expect(r.score).toBe(60 + Math.floor((40 * 3) / 5));
    expect(r.headline).toContain("Par is 3");
    expect(r.details.join(" ")).toContain("CAT → COT → DOT → LOT → LOG → DOG");
  });

  it("property: every accepted submission is one in-place substitution to a member word", () => {
    const s = play(start("wl-s1"), ["STEEP"]);
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Z]{4,6}$/), (w) => {
        const t = submit(s, w);
        if (t.ok) {
          expect(hamming("STEEP", w)).toBe(1);
          expect(membership.has(w)).toBe(true);
          expect(isLadder(words(t.state))).toBe(true);
        } else expect(t.state).toBe(s);
      }),
      { numRuns: 300 },
    );
    // Neighbour mutations are the interesting ones.
    for (let i = 0; i < 5; i++) for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") submit(s, "STEEP".slice(0, i) + c + "STEEP".slice(i + 1));
  });
});

describe("hints from the current word", () => {
  it("from WORD (off the stored example), the next word is computed by BFS from WORD", () => {
    const s = play(start("wl-demo-1"), ["CORD", "WORD"]);
    const sug = engine.suggest(s)!;
    expect(sug.remaining).toBe(2);
    expect(["WARD", "WORM"]).toContain(sug.next);
    expect(hamming("WORD", sug.next)).toBe(1);
    const t = engine.apply(s, { type: "hint", tier: HINT_NEXT });
    expect(t.message).toContain(`From WORD, ${sug.next}`);
    expect(t.message).not.toContain("CARD");
  });

  it("position hint marks a changeable letter, and is not charged twice for the same word", () => {
    let s = start("wl-demo-1");
    const t = engine.apply(s, { type: "hint", tier: HINT_POSITION });
    expect(t.ok).toBe(true);
    expect(t.message).toBe("From COLD, change the third letter (L).");
    s = t.state;
    expect(engine.apply(s, { type: "hint", tier: HINT_POSITION }).code).toBe("hint-unavailable");
    expect(engine.hints(s).find((o) => o.tier === HINT_POSITION)!.available).toBe(false);
    // After a move the ladder resets for the new word.
    s = play(s, ["CORD"]);
    expect(engine.hints(s).find((o) => o.tier === HINT_POSITION)!.available).toBe(true);
  });

  it("insert adds a hinted step; backtracking after it works and hints recalculate", () => {
    let s = play(start("wl-demo-1"), ["CORD"]);
    s = engine.apply(s, { type: "hint", tier: HINT_INSERT }).state;
    expect(s.path[2].assisted).toBe(true);
    expect(s.path.length).toBe(3);
    s = engine.apply(s, { type: "undo" }).state;
    expect(words(s)).toEqual(["COLD", "CORD"]);
    s = play(s, ["WORD"]);
    expect(engine.suggest(s)!.remaining).toBe(2);
    s = play(s, ["WORM", "WARM"]);
    const r = engine.result(s)!;
    expect(r.assistance.hints).toBe(1);
    expect(r.shareText).toContain("assisted");
    expect(r.shareText).not.toMatch(/COLD|WARM/);
  });

  it("hints avoid words already on the route, and report when only backtracking helps", () => {
    const eng = createWordLadderEngine(new Set(["AAA", "AAB", "ABB", "BBB", "ABA"]));
    const payload = { start: "AAA", target: "BBB", optimalMoves: 3, examplePath: ["AAA", "AAB", "ABB", "BBB"], explanation: "" };
    let s = eng.initialise(payload, sessionOptionsFor(bundle("wl-demo-1").meta, 1));
    s = play(s, ["ABA"], eng);
    // From ABA the only way on is ABB (via ABA->ABB). Fine.
    expect(eng.suggest(s)!.next).toBe("ABB");
    const dead = createWordLadderEngine(new Set(["AAA", "AAB", "ABB", "BBB", "AAC"]));
    let d = dead.initialise(payload, sessionOptionsFor(bundle("wl-demo-1").meta, 1));
    d = play(d, ["AAB", "AAC"], dead);
    // AAC's only neighbours are AAA and AAB, both used: no forward route.
    expect(dead.suggest(d)).toBeNull();
    expect(dead.apply(d, { type: "hint", tier: HINT_NEXT }).code).toBe("no-route");
    expect(dead.hints(d).every((o) => !o.available)).toBe(true);
    d = dead.apply(d, { type: "undo" }).state;
    expect(dead.suggest(d)!.next).toBe("ABB");
  });

  it("reveal completes a shortest remaining route and records the round as revealed", () => {
    let s = play(start("wl-e1"), ["FILE"]);
    s = engine.apply(s, { type: "hint", tier: HINT_REVEAL }).state;
    expect(engine.outcome(s)).toBe("revealed");
    expect(words(s)[words(s).length - 1]).toBe("TREE");
    expect(isLadder(words(s))).toBe(true);
    expect(s.path.length - 1).toBe(s.optimalMoves);
    const r = engine.result(s)!;
    expect(r.assistance.reveals).toBe(1);
    expect(r.score).toBeUndefined();
    expect(submit(s, "FREE").code).toBe("complete");
  });

  it("hint routes prefer the stored familiar example when the player is on it", () => {
    for (const r of rounds.filter((x) => x.meta.status === "practice")) {
      const s = engine.initialise(r.payload, sessionOptionsFor(r.meta, 1));
      expect(engine.suggest(s)!.route, r.meta.id).toEqual(r.payload.examplePath.slice(1));
    }
  });
});

describe("persistence and content", () => {
  it("restores a partial route by replaying actions, and rejects forged edges", () => {
    const b = bundle("wl-s4");
    let attempt = newAttempt(b.meta, "att", 3, true, "2026-09-30T00:00:00Z");
    let s = engine.initialise(b.payload, sessionOptionsFor(b.meta, 3));
    const acts: LadderAction[] = [
      { type: "submit", word: "BALL" },
      { type: "submit", word: "BALE" },
      { type: "undo" },
      { type: "hint", tier: HINT_POSITION },
      { type: "submit", word: "HALL" },
    ];
    acts.forEach((a, i) => {
      const t = engine.apply(s, a);
      expect(t.ok, JSON.stringify(a)).toBe(true);
      s = t.state;
      attempt = withAction(attempt, { id: `a${i}`, at: "t", action: a }, engine.outcome(s), false);
    });
    const res = restoreAttempt(engine, b.payload, b.meta, JSON.parse(JSON.stringify(attempt)));
    expect(res.status).toBe("restored");
    if (res.status === "restored") expect(res.state).toEqual(s);
    const forged = withAction(newAttempt(b.meta, "att2", 3, true, "t"), { id: "x", at: "t", action: { type: "submit", word: "LAMP" } }, "completed", false);
    expect(restoreAttempt(engine, b.payload, b.meta, forged).status).toBe("corrupt");
  });

  it("validator passes; engine optimum equals stored optimum and a familiar shortest route exists", () => {
    expect(validateContent()).toEqual([]);
    for (const r of rounds) {
      const s = engine.initialise(r.payload, sessionOptionsFor(r.meta, 1));
      expect(s.optimalMoves, r.meta.id).toBe(r.payload.optimalMoves);
      const ends = new Set([r.payload.start, r.payload.target]);
      const fam = shortestPath(r.payload.start, r.payload.target, (w) => ends.has(w) || familiar.has(w));
      expect(fam && fam.length - 1, r.meta.id).toBe(r.payload.optimalMoves);
      const done = play(s, r.payload.examplePath.slice(1));
      expect(engine.outcome(done), r.meta.id).toBe("completed");
    }
    const lengths = new Set(rounds.map((r) => r.payload.start.length));
    expect([...lengths].sort()).toEqual([3, 4, 5]);
  });

  it("par is defined over everyday words, so an obscure shortcut beats par without being rejected", () => {
    // WAST is a valid tile-game word (an archaic form of "was") but is not an everyday word.
    const b = rounds.find((r) => r.meta.id === "wl-g7")!;
    let s = engine.initialise(b.payload, sessionOptionsFor(b.meta, 1));
    expect(s.optimalMoves).toBe(3);
    s = play(s, ["WAST", "WEST"]);
    expect(engine.outcome(s)).toBe("completed");
    const r = engine.result(s)!;
    expect(r.score).toBe(100);
    expect(r.efficiency).toBe(1);
    expect(r.headline).toContain("beats par");
  });

  it("difficulties are distinct: expert ladders force a detour", () => {
    for (const r of rounds.filter((x) => x.meta.difficulty === "expert")) {
      expect(r.payload.optimalMoves).toBeGreaterThan(hamming(r.payload.start, r.payload.target));
    }
    expect(distancesFrom("WARM", (w) => membership.has(w)).get("COLD")).toBe(4);
  });
});
