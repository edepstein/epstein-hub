import { describe, expect, it } from "vitest";
import { sessionOptionsFor } from "@/lib/progress/attempt";
import { loadMembershipSync } from "@/lib/dictionary/node";
import { createRng } from "@/lib/rng";
import {
  bfsMinSwaps,
  createPhraseRepairEngine,
  efficientMove,
  HINT_CORRECT_TILE,
  HINT_FIRST_WORD,
  HINT_NEXT_MOVE,
  HINT_REVEAL,
  minSwaps,
  nearestTarget,
  scoreFor,
  wordsOf,
  type PhraseAction,
  type PhrasePayload,
  type PhraseState,
} from "./engine";
import { rounds } from "./rounds";
import { checkPhraseRound, validateContent } from "./validate";

const engine = createPhraseRepairEngine();
const bundle = (id: string) => rounds.find((r) => r.meta.id === id)!;
const init = (p: PhrasePayload) => engine.initialise(p, sessionOptionsFor(bundle("pr-demo-1").meta, 1));
const start = (id: string) => init(bundle(id).payload);
function play(s: PhraseState, actions: PhraseAction[]) {
  for (const a of actions) {
    const t = engine.apply(s, a);
    expect(t.ok, `${JSON.stringify(a)}: ${t.message}`).toBe(true);
    s = t.state;
  }
  return s;
}
const swap = (i: number): PhraseAction => ({ type: "swap", a: i, b: i + 1 });

/** Greedy optimal solve using the efficient-move helper. */
function solveOptimally(s: PhraseState): PhraseState {
  for (let guard = 0; guard < 100; guard++) {
    const i = efficientMove(s);
    if (i === null) break;
    s = play(s, [swap(i)]);
  }
  return play(s, [{ type: "check" }]);
}

describe("Phrase Repair minimum swaps", () => {
  it("reproduces the fixture minimums 4, 6 and 7", () => {
    expect(minSwaps("SPILT OVER MILK CRY".split(" "), "CRY OVER SPILT MILK".split(" "))).toBe(4);
    expect(minSwaps("LEAP YOU BEFORE LOOK".split(" "), "LOOK BEFORE YOU LEAP".split(" "))).toBe(6);
    expect(minSwaps("STITCH SAVES A NINE TIME IN".split(" "), "A STITCH IN TIME SAVES NINE".split(" "))).toBe(7);
    expect(start("pr-demo-1").minimum).toBe(4);
    expect(start("pr-demo-2").minimum).toBe(6);
    expect(start("pr-demo-3").minimum).toBe(7);
  });

  it("matches repeated words in order, so duplicates are not over-counted", () => {
    const words = "COME GO EASY EASY".split(" ");
    const target = "EASY COME EASY GO".split(" ");
    expect(minSwaps(words, target)).toBe(3);
    expect(bfsMinSwaps(words, [target])).toBe(3);
  });

  it("property: inversion minimum equals exhaustive search on random boards with duplicates", () => {
    const rng = createRng(20260930);
    const vocab = ["A", "B", "C", "A", "B", "D", "A"];
    for (let k = 0; k < 150; k++) {
      const n = 3 + rng.int(5);
      const target = rng.shuffle(vocab).slice(0, n);
      const board = rng.shuffle(target);
      expect(minSwaps(board, target)).toBe(bfsMinSwaps(board, [target]));
    }
  });

  it("returns null for different token multisets", () => {
    expect(minSwaps(["SPILT", "MILK"], ["SPILLED", "MILK"])).toBeNull();
  });
});

describe("Phrase Repair rules", () => {
  it("adjacent swaps only: a non-adjacent exchange is rejected atomically", () => {
    const s = start("pr-demo-1");
    const t = engine.apply(s, { type: "swap", a: 0, b: 3 });
    expect(t.ok).toBe(false);
    expect(t.code).toBe("not-adjacent");
    expect(t.state).toBe(s);
    expect(engine.apply(s, { type: "swap", a: 3, b: 4 }).code).toBe("out-of-range");
  });

  it("repairs CRY OVER SPILT MILK in four swaps for 100 points", () => {
    let s = start("pr-demo-1");
    s = play(s, [swap(2), swap(1), swap(0), swap(1)]);
    expect(wordsOf(s)).toEqual(["CRY", "OVER", "SPILT", "MILK"]);
    s = play(s, [{ type: "check" }]);
    const r = engine.result(s)!;
    expect(r.outcome).toBe("completed");
    expect(r.score).toBe(100);
    expect(r.efficiency).toBe(1);
  });

  it("token identity: duplicates keep distinct ids and swaps return to the start", () => {
    let s = start("pr-s3");
    const idsBefore = [...s.order];
    s = play(s, [swap(1), swap(1)]);
    expect(s.order).toEqual(idsBefore);
    expect(s.moves).toBe(2);
    expect(new Set(s.order).size).toBe(s.order.length);
    expect(wordsOf(s).filter((w) => w === "THE")).toHaveLength(2);
  });

  it("undo counts as a swap and scoring follows 60 + floor(40 * min / moves)", () => {
    let s = start("pr-demo-1");
    s = play(s, [swap(0), { type: "undo" }]);
    expect(s.moves).toBe(2);
    expect(s.order).toEqual(start("pr-demo-1").order);
    expect(engine.apply(play(start("pr-demo-1"), []), { type: "undo" }).code).toBe("nothing-to-undo");
    s = solveOptimally(s);
    expect(s.moves).toBe(6);
    expect(engine.result(s)!.score).toBe(60 + Math.floor((40 * 4) / 6));
    expect(scoreFor(0, 0)).toBe(100);
    expect(scoreFor(7, 7)).toBe(100);
    expect(scoreFor(7, 20)).toBe(74);
  });

  it("check rejects an unrepaired board and keeps tiles; repeated check after completion is rejected", () => {
    const s = start("pr-g1");
    const t = engine.apply(s, { type: "check" });
    expect(t.code).toBe("not-yet");
    expect(t.state).toBe(s);
    const done = solveOptimally(s);
    const again = engine.apply(done, { type: "check" });
    expect(again.ok).toBe(false);
    expect(engine.result(done)!.score).toBe(100);
    expect(engine.apply(done, swap(0)).code).toBe("finished");
  });

  it("accepts either authored endpoint and measures the minimum to the nearer one", () => {
    const s = start("pr-e1");
    const [a, b] = s.targets;
    const words = wordsOf(s);
    expect(s.minimum).toBe(Math.min(minSwaps(words, a)!, minSwaps(words, b)!));
    const done = solveOptimally(s);
    expect(engine.outcome(done)).toBe("completed");
    expect(done.moves).toBe(s.minimum);
    // Drive to the farther endpoint too: it also completes.
    const far = minSwaps(words, a)! > minSwaps(words, b)! ? a : b;
    let t = s;
    for (let guard = 0; guard < 60; guard++) {
      const cur = wordsOf(t);
      if (cur.join(" ") === far.join(" ")) break;
      // bubble towards `far` using order-preserving matching
      const pos: number[] = [];
      const used = far.map(() => false);
      for (const w of cur) {
        const k = far.findIndex((x, i) => x === w && !used[i]);
        used[k] = true;
        pos.push(k);
      }
      const i = pos.findIndex((p, j) => j + 1 < pos.length && p > pos[j + 1]);
      t = play(t, [swap(i)]);
    }
    expect(engine.outcome(play(t, [{ type: "check" }]))).toBe("completed");
  });

  it("hints: first word, a tile in place (not locked), efficient next move lowers distance, reveal", () => {
    let s = start("pr-s1");
    let t = engine.apply(s, { type: "hint", tier: HINT_FIRST_WORD });
    expect(t.message).toContain("begins TOO");
    s = t.state;
    expect(engine.apply(s, { type: "hint", tier: HINT_FIRST_WORD }).ok).toBe(false);
    const before = nearestTarget(s).distance;
    t = engine.apply(s, { type: "hint", tier: HINT_NEXT_MOVE });
    expect(t.ok).toBe(true);
    const m = /words (\d) and (\d)/.exec(t.message)!;
    s = play(t.state, [swap(Number(m[1]) - 1)]);
    expect(nearestTarget(s).distance).toBe(before - 1);
    t = engine.apply(s, { type: "hint", tier: HINT_CORRECT_TILE });
    expect(t.ok).toBe(true);
    s = t.state;
    // Not locked: the marked tile can still move.
    const markedAt = s.markedToken ? s.order.indexOf(s.markedToken) : 0;
    const moved = engine.apply(s, swap(Math.min(markedAt, s.order.length - 2)));
    expect(moved.ok).toBe(true);
    s = play(s, [{ type: "hint", tier: HINT_REVEAL }]);
    expect(engine.outcome(s)).toBe("revealed");
    expect(wordsOf(s)).toEqual(["TOO", "MANY", "COOKS", "SPOIL", "THE", "BROTH"]);
    const r = engine.result(s)!;
    expect(r.score).toBe(0);
    expect(r.assistance).toEqual({ hints: 3, reveals: 1 });
    expect(engine.hints(s)).toEqual([]);
  });

  it("restores exactly by replaying raw swap history", () => {
    const actions: PhraseAction[] = [swap(0), swap(3), { type: "undo" }, { type: "hint", tier: HINT_NEXT_MOVE }, swap(2)];
    const a = play(start("pr-e2"), actions);
    const b = play(start("pr-e2"), actions);
    expect(b).toEqual(a);
    expect(a.moves).toBe(4);
  });
});

describe("Phrase Repair content", () => {
  const membership = loadMembershipSync();
  it("all rounds validate, and each is solvable in exactly its stored minimum", () => {
    expect(validateContent()).toEqual([]);
    for (const r of rounds) {
      const s = solveOptimally(init(r.payload));
      expect(engine.outcome(s), r.meta.id).toBe("completed");
      expect(s.moves, r.meta.id).toBe(r.payload.minimumAdjacentSwaps);
    }
  });

  it("has at least four practice rounds per difficulty, with repeated tokens at expert", () => {
    for (const d of ["gentle", "standard", "expert"]) expect(rounds.filter((r) => r.meta.difficulty === d && r.meta.status === "practice").length).toBeGreaterThanOrEqual(4);
    const expertWithDuplicates = rounds.filter((r) => r.meta.difficulty === "expert" && new Set(r.payload.tokens.map((t) => t.text)).size < r.payload.tokens.length);
    expect(expertWithDuplicates.length).toBeGreaterThanOrEqual(4);
  });

  const broken = (mut: (p: PhrasePayload) => void) => {
    const p = structuredClone(bundle("pr-demo-1").payload);
    mut(p);
    return checkPhraseRound({ id: "x", status: "demo", title: "t" }, p, membership).join(" ");
  };
  it("rejects the pack's broken fixture (minimum + 1), duplicated tokens and wrong enumeration", () => {
    expect(broken((p) => (p.minimumAdjacentSwaps += 1))).toContain("stored 5, computed 4");
    expect(broken((p) => (p.tokens[1].text = "MILK"))).toContain("token multisets must be equal");
    expect(broken((p) => (p.tokens[1].id = "t1"))).toContain("unique");
    expect(broken((p) => (p.enumeration = [3, 4, 4, 5]))).toContain("does not fit the enumeration");
    expect(broken((p) => (p.tokens = p.acceptedTargets[0].map((text, i) => ({ id: `t${i}`, text }))))).toContain("starts already solved");
  });
});
