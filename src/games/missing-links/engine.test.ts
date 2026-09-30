import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { loadMembershipSync } from "@/lib/dictionary/node";
import { newAttempt, restoreAttempt, sessionOptionsFor, withAction } from "@/lib/progress/attempt";
import { compoundOf, createMissingLinksEngine, HINT_BRANCH, HINT_FIRST_LETTER, HINT_REVEAL, POINTS_PER_LINK, type LinksAction, type LinksState } from "./engine";
import { rounds } from "./rounds";
import { validateContent } from "./validate";

const membership = loadMembershipSync();
const engine = createMissingLinksEngine(membership);
const bundle = (id: string) => rounds.find((r) => r.meta.id === id)!;
const start = (id: string, seed = 1) => {
  const b = bundle(id);
  return engine.initialise(b.payload, sessionOptionsFor(b.meta, seed));
};
const guess = (s: LinksState, word: string, board = s.boards[s.active].id) => engine.apply(s, { type: "guess", board, word });
const run = (s: LinksState, actions: LinksAction[]) => actions.reduce((acc, a) => engine.apply(acc, a).state, s);

describe("missing links: canonical fixture boards", () => {
  it.each([
    ["ml-demo-1", "LIGHT", ["DAYLIGHT", "MOONLIGHT", "LIGHTHOUSE"]],
    ["ml-demo-2", "BOOK", ["NOTEBOOK", "BOOKCASE", "BOOKMARK"]],
    ["ml-demo-3", "FOOT", ["FOOTBALL", "FOOTPRINT", "BAREFOOT"]],
  ])("%s: %s completes all three compounds in their displayed directions", (id, link, compounds) => {
    const s = start(id);
    expect(s.boards[0].branches.map((br) => compoundOf(br, link))).toEqual(compounds);
    for (const c of compounds) expect(membership.has(c), c).toBe(true);
    const t = guess(s, link.toLowerCase());
    expect(t.ok).toBe(true);
    expect(t.code).toBe("round-complete");
    expect(t.state.boards[0].status).toBe("solved");
    expect(engine.result(t.state)!.score).toBe(POINTS_PER_LINK);
    expect(engine.result(t.state)!.outcome).toBe("completed");
  });

  it("orientation matters: HOUSELIGHT is not LIGHTHOUSE, and the whole compound is not the link", () => {
    const s = start("ml-demo-1");
    const light = s.boards[0].branches.find((br) => br.suffix === "HOUSE")!;
    expect(compoundOf(light, "LIGHT")).toBe("LIGHTHOUSE");
    expect(compoundOf(light, "LIGHT")).not.toBe("HOUSELIGHT");
    const whole = guess(s, "lighthouse");
    expect(whole.ok).toBe(false);
    expect(whole.code).toBe("whole-compound");
    expect(whole.state).toBe(s);
    const reversed = guess(s, "houselight");
    expect(reversed.ok).toBe(false);
    expect(reversed.code).toBe("wrong-length");
  });

  it("missing-spaces policy: spaced or hyphenated entries are rejected with a reason, not stripped", () => {
    const s = start("ml-demo-1");
    for (const w of ["LI GHT", "light-", "day light"]) {
      const t = guess(s, w);
      expect(t.code, w).toBe("spaces");
      expect(t.message).toMatch(/one word/);
      expect(t.state).toBe(s);
    }
    expect(guess(s, "  light  ").ok).toBe(true); // surrounding whitespace is trimmed
  });

  it("enumeration: a word of the wrong length is rejected without counting as a guess", () => {
    const s = start("ml-demo-2");
    const t = guess(s, "books");
    expect(t.code).toBe("wrong-length");
    expect(t.message).toBe("The missing word has 4 letters; BOOKS has 5.");
    expect(t.state.boards[0].guesses).toHaveLength(0);
  });

  it("a word valid for only some branches is a recorded wrong guess, with no points lost and no branch revealed", () => {
    // SNOW board: FOOT makes FOOTMAN and FOOTBALL but not FOOTFLAKE.
    const s = run(start("ml-g1"), [{ type: "select", board: "2" }]);
    const t = guess(s, "foot");
    expect(t.ok).toBe(true);
    expect(t.code).toBe("wrong-link");
    expect(t.message).toBe("FOOT makes a word in 2 of 3 branches, but the link must complete every branch. No points lost.");
    expect(t.message).not.toMatch(/FLAKE/);
    expect(t.state.boards[1].guesses).toEqual([{ word: "FOOT", fits: [true, false, true] }]);
    expect(t.state.boards[1].status).toBe("open");
    const again = guess(t.state, "FOOT");
    expect(again.code).toBe("already-tried");
    expect(again.state).toBe(t.state);
  });

  it("repeated submit after success neither changes state nor adds points", () => {
    const s = guess(start("ml-demo-3"), "FOOT").state;
    const t = guess(s, "FOOT");
    expect(t.ok).toBe(false);
    expect(t.code).toBe("already-solved");
    expect(t.state).toBe(s);
    expect(engine.result(s)!.score).toBe(100);
  });
});

describe("missing links: rounds of several boards", () => {
  it("accepts either configured link where two genuinely fit (DOOR or GATE)", () => {
    const s = start("ml-s2");
    const a = guess(s, "door", "1");
    const b = guess(s, "gate", "1");
    expect(a.ok && b.ok).toBe(true);
    expect(a.state.boards[0].status).toBe("solved");
    expect(b.state.boards[0].solvedWith).toBe("GATE");
    expect(b.message).toMatch(/accepted alternative to DOOR/);
    expect(b.message).toMatch(/GATEWAY, GATEKEEPER and GATEPOST/);
    // GOAL fits two branches only.
    expect(guess(s, "goal", "1").message).toMatch(/2 of 3 branches/);
  });

  it("four-branch expert board: MOTHER and FATHER accepted, PARENT fits three branches only", () => {
    const s = start("ml-e1");
    expect(s.boards[0].branches).toHaveLength(4);
    expect(guess(s, "father", "1").ok).toBe(true);
    expect(guess(s, "mother", "1").state.boards[0].status).toBe("solved");
    const p = guess(s, "parent", "1");
    expect(p.code).toBe("wrong-link");
    expect(p.message).toMatch(/3 of 4 branches/);
  });

  it("selecting a board is replayable state; hints apply to the selected board and progress through three stages", () => {
    let s = start("ml-s1");
    s = engine.apply(s, { type: "select", board: "3" }).state;
    expect(s.active).toBe(2);
    expect(engine.apply(s, { type: "hint", tier: HINT_BRANCH }).code).toBe("hint-unavailable");
    const h1 = engine.apply(s, { type: "hint", tier: HINT_FIRST_LETTER });
    expect(h1.message).toBe("Board 3: the link begins with D.");
    expect(engine.apply(h1.state, { type: "hint", tier: HINT_FIRST_LETTER }).ok).toBe(false); // no repeated charge
    const h2 = engine.apply(h1.state, { type: "hint", tier: HINT_BRANCH });
    expect(h2.message).toBe("Board 3: ____BIN is DUSTBIN (a large container for household rubbish).");
    // A branch reveal does not submit anything.
    expect(h2.state.boards[2].status).toBe("open");
    expect(h2.state.boards[0].hintLevel).toBe(0);
    const solved = guess(h2.state, "dust");
    expect(solved.message).toMatch(/with help/);
    expect(solved.state.boards[2].status).toBe("solved");
  });

  it("reveal scores 0 and is distinguished from an unaided solve in the result", () => {
    let s = start("ml-g2");
    s = guess(s, "RAIN", "1").state;
    s = run(s, [{ type: "select", board: "2" }, { type: "hint", tier: HINT_REVEAL }]);
    expect(s.boards[1].status).toBe("revealed");
    expect(guess(s, "BIRTH", "2").code).toBe("already-revealed");
    s = run(s, [{ type: "select", board: "3" }, { type: "hint", tier: HINT_FIRST_LETTER }]);
    s = guess(s, "HORSE", "3").state;
    expect(engine.outcome(s)).toBe("completed");
    const r = engine.result(s)!;
    expect(r.score).toBe(200);
    expect(r.maxScore).toBe(300);
    expect(r.assistance).toEqual({ hints: 1, reveals: 1 });
    expect(r.details[0]).toBe("Board 1: solved first time, unaided (100 points).");
    expect(r.details[1]).toBe("Board 2: revealed (0 points).");
    expect(r.details[2]).toBe("Board 3: solved first time, with 1 hint (100 points).");
    expect(r.shareText).not.toMatch(/RAIN|BIRTH|HORSE/);
  });

  it("revealing every board ends as revealed, not completed", () => {
    let s = start("ml-demo-1");
    s = engine.apply(s, { type: "hint", tier: HINT_REVEAL }).state;
    expect(engine.outcome(s)).toBe("revealed");
    expect(engine.result(s)!.headline).toMatch(/revealed/);
  });

  it("word bank: visible in gentle (no assistance), optional elsewhere and marks the board helped", () => {
    const g = start("ml-g1");
    expect(engine.apply(g, { type: "open-bank", board: "1" }).code).toBe("bank-shown");
    let s = start("ml-s3");
    s = engine.apply(s, { type: "open-bank", board: "1" }).state;
    expect(s.boards[0].bankOpened).toBe(true);
    expect(engine.apply(s, { type: "open-bank", board: "1" }).code).toBe("bank-open");
    s = guess(s, "worm", "1").state;
    s = guess(s, "heart", "2").state;
    s = guess(s, "key", "3").state;
    const r = engine.result(s)!;
    expect(r.assistance).toEqual({ hints: 1, reveals: 0 });
    expect(r.details[0]).toMatch(/with word bank/);
    expect(r.details[1]).toMatch(/unaided/);
  });

  it("bank order is seeded per session and never exposes the answer by position", () => {
    const a = start("ml-g1", 5).boards[0].candidates;
    expect(start("ml-g1", 5).boards[0].candidates).toEqual(a);
    const firsts = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => start("ml-g1", seed).boards[0].candidates[0]));
    expect(firsts.size).toBeGreaterThan(1);
  });

  it("finish early records unexplored boards without revealing them; resume reopens", () => {
    let s = guess(start("ml-e2"), "SKIN", "1").state;
    s = engine.apply(s, { type: "finish" }).state;
    expect(engine.outcome(s)).toBe("abandoned");
    const r = engine.result(s)!;
    expect(r.details[1]).toBe("Board 2: left unexplored.");
    expect(r.explanation!.join(" ")).not.toMatch(/CAST|PIPE/);
    s = engine.apply(s, { type: "resume" }).state;
    expect(engine.outcome(s)).toBe("playing");
  });

  it("restore: replaying stored actions reproduces boards, guesses, hints and bank order", () => {
    const b = bundle("ml-s4");
    let attempt = newAttempt(b.meta, "att-1", 99, true, "2026-09-30T00:00:00Z");
    let s = engine.initialise(b.payload, sessionOptionsFor(b.meta, 99));
    const actions: LinksAction[] = [
      { type: "guess", board: "1", word: "LEAK" },
      { type: "select", board: "2" },
      { type: "hint", tier: HINT_FIRST_LETTER },
      { type: "guess", board: "2", word: "CORN" },
    ];
    actions.forEach((a, i) => {
      s = engine.apply(s, a).state;
      attempt = withAction(attempt, { id: `a${i}`, at: "2026-09-30T00:00:00Z", action: a }, engine.outcome(s), i > 1);
    });
    const restored = restoreAttempt(engine, b.payload, b.meta, JSON.parse(JSON.stringify(attempt)));
    expect(restored.status).toBe("restored");
    if (restored.status === "restored") expect(restored.state).toEqual(s);
  });
});

describe("missing links: content", () => {
  it("validator passes; each difficulty has at least four practice rounds of three boards", () => {
    expect(validateContent()).toEqual([]);
    for (const d of ["gentle", "standard", "expert"] as const) {
      const rs = rounds.filter((r) => r.meta.difficulty === d && r.meta.status === "practice");
      expect(rs.length, d).toBeGreaterThanOrEqual(4);
      for (const r of rs) expect(r.payload.boards.length).toBe(3);
    }
  });

  it("every board in every round is solvable with every accepted link", () => {
    for (const r of rounds) {
      for (const b of r.payload.boards) {
        for (const sol of b.solutions) {
          const s = engine.initialise(r.payload, sessionOptionsFor(r.meta, 1));
          const t = guess(s, sol.link, b.id);
          expect(t.ok, `${r.meta.id}/${b.id} ${sol.link}`).toBe(true);
          expect(t.state.boards.find((x) => x.id === b.id)!.status).toBe("solved");
        }
      }
    }
  });

  it("the canonical fixture boards have no unlisted alternative link in the word list", () => {
    for (const id of ["ml-demo-1", "ml-demo-2", "ml-demo-3"]) {
      const b = bundle(id).payload.boards[0];
      const alts = [...membership].filter((w) => w.length === b.linkLength && !b.solutions.some((s) => s.link === w) && b.branches.every((br) => membership.has(compoundOf(br, w))));
      expect(alts, id).toEqual([]);
    }
  });

  it("property: any accepted guess either solves (an accepted link) or is a recorded wrong guess; rejections never change state", () => {
    const s = start("ml-g3");
    const links = new Set(bundle("ml-g3").payload.boards[0].solutions.map((x) => x.link));
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Z ]{0,8}$/), (w) => {
        const t = guess(s, w, "1");
        if (!t.ok) expect(t.state).toBe(s);
        else if (t.code === "wrong-link") expect(t.state.boards[0].guesses).toHaveLength(1);
        else expect(links.has(w.trim())).toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});
