import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { restoreAttempt, sessionOptionsFor } from "@/lib/progress/attempt";
import { assistAction, dailyCrosswordEngine as engine, entryById, entryLabel, type CrosswordAction, type CrosswordState } from "./engine";
import { deriveRuns, isConnected, isSymmetric, numberGrid } from "./grid";
import { advance, arrow, jumpEntry, retreat, toggle, type Cursor } from "./nav";
import { rounds } from "./rounds";
import { validateRounds } from "./validate";

const bundle = (id: string) => rounds.find((r) => r.meta.id === id)!;
const start = (id: string) => engine.initialise(bundle(id).payload, sessionOptionsFor(bundle(id).meta, 1));
const apply = (s: CrosswordState, a: CrosswordAction) => engine.apply(s, a);
function solve(s: CrosswordState, except: string[] = []): CrosswordState {
  for (const e of s.entries) if (!except.includes(e.id)) s = apply(s, { type: "enter", entryId: e.id, text: e.answer }).state;
  return s;
}

describe("grid geometry and numbering", () => {
  it("word-square fixtures validate every crossing and number conventionally", () => {
    const s = start("dc-demo-1");
    expect(s.entries.map(entryLabel)).toEqual(["1 Across", "5 Across", "6 Across", "7 Across", "1 Down", "2 Down", "3 Down", "4 Down"]);
    expect(entryById(s, "down-2")!.number).toBe(2); // stable id differs from display number rules
  });

  it("derives runs without one-letter entries and shares numbers where across and down start together", () => {
    const g = ["PRICE", "S#V#N", "ALOFT", "L#R#E", "MAYOR"];
    expect(deriveRuns(g)).toHaveLength(6);
    const n = numberGrid(g);
    expect([...n.entries()]).toEqual([["0,0", 1], ["0,2", 2], ["0,4", 3], ["2,0", 4], ["4,0", 5]]);
    expect(isConnected(g)).toBe(true);
    expect(isSymmetric(g)).toBe(true);
    expect(isConnected(["AB#", "###", "#CD"])).toBe(false);
  });

  it("the validator accepts the bank and rejects a disagreeing crossing and an orphan cell", () => {
    expect(validateRounds(rounds)).toEqual([]);
    const bad = structuredClone(bundle("dc-gq1"));
    bad.payload.grid[0] = "PRICK"; // breaks 3 Down ENTER and 1 Across
    expect(validateRounds([bad]).join()).toMatch(/disagrees with grid letters/);
    const orphan = structuredClone(bundle("dc-gq1"));
    orphan.payload.entries = orphan.payload.entries.filter((e) => e.answer !== "IVORY");
    expect(validateRounds([orphan]).join()).toMatch(/no entry for the down run at row 0, col 2/);
    const badClue = structuredClone(bundle("dc-gc1"));
    badClue.payload.entries[0].cryptic!.construction = { type: "anagram", fodder: "Snoot" };
    badClue.payload.entries[0].clue = "Snoot around for a piece of cutlery";
    expect(validateRounds([badClue]).join()).toMatch(/does not use exactly the letters/);
  });
});

describe("crossword engine", () => {
  it("changing a crossing letter updates both entries", () => {
    let s = start("dc-gq1");
    s = apply(s, { type: "set", row: 0, col: 0, letter: "p" }).state;
    const across = entryById(s, "a-r0c0")!;
    const down = entryById(s, "d-r0c0")!;
    expect(across.cells[0]).toEqual(down.cells[0]);
    expect(s.fill[0][0]).toBe("P");
  });

  it("rejects illegal input atomically with precise reasons", () => {
    const s = start("dc-gq1");
    expect(apply(s, { type: "set", row: 1, col: 1, letter: "A" }).code).toBe("not-a-square");
    expect(apply(s, { type: "set", row: 0, col: 0, letter: "7" }).code).toBe("non-letter");
    const wl = apply(s, { type: "enter", entryId: "a-r0c0", text: "cost" });
    expect(wl.code).toBe("wrong-length");
    expect(wl.message).toBe("1 Across needs 5 letters (5); you entered 4. Your text is kept so you can adjust it.");
    expect(wl.state).toBe(s);
    expect(apply(s, { type: "enter", entryId: "a-r0c0", text: "pr1ce" }).code).toBe("non-letters");
    expect(apply(s, { type: "check", scope: "grid" }).code).toBe("nothing-to-check");
  });

  it("pasted answers fill an entry; partial paste writes from a position", () => {
    let s = start("dc-gq1");
    s = apply(s, { type: "enter", entryId: "a-r0c0", text: " Price " }).state;
    expect(s.fill[0].join("")).toBe("PRICE");
    s = apply(s, { type: "enter", entryId: "d-r0c4", text: "NTER", from: 1 }).state;
    expect([1, 2, 3, 4].map((r) => s.fill[r][4]).join("")).toBe("NTER");
    expect(apply(s, { type: "enter", entryId: "d-r0c4", text: "NTERS", from: 1 }).code).toBe("too-long");
  });

  it("filling a wrong grid never shows success and does not locate errors", () => {
    let s = solve(start("dc-gq1"), ["a-r4c0"]);
    const t = apply(s, { type: "enter", entryId: "a-r4c0", text: "MAJOR" });
    expect(t.ok).toBe(true);
    expect(t.code).toBe("full-incorrect");
    expect(t.message).toMatch(/some entries need another look/);
    expect(engine.outcome(t.state)).toBe("playing");
    s = apply(t.state, { type: "set", row: 4, col: 2, letter: "Y" }).state;
    expect(engine.outcome(s)).toBe("completed");
    expect(engine.result(s)!.assistance).toEqual({ hints: 0, reveals: 0 });
    expect(engine.result(s)!.shareText).not.toMatch(/PRICE|MAYOR/);
    expect(apply(s, { type: "set", row: 0, col: 0, letter: "A" }).code).toBe("complete");
  });

  it("check marks right and wrong, records assistance, and clears when the letter changes", () => {
    let s = start("dc-gq1");
    s = apply(s, { type: "enter", entryId: "a-r0c0", text: "PRIZE" }).state;
    const c = apply(s, { type: "check", scope: "entry", entryId: "a-r0c0" });
    expect(c.message).toBe("Checked 1 Across: 1 letter wrong, marked with a cross.");
    s = c.state;
    expect(s.checks["0,3"]).toEqual({ letter: "Z", ok: false });
    expect(s.checks["0,0"].ok).toBe(true);
    s = apply(s, { type: "set", row: 0, col: 3, letter: "C" }).state;
    expect(s.checks["0,3"]).toBeUndefined();
    expect(s.assists.checks).toBe(1);
  });

  it("reveal fixes letters, is recorded, and reveal grid gives a revealed outcome", () => {
    let s = start("dc-gq1");
    s = apply(s, assistAction(4, { row: 0, col: 0, entryId: "a-r0c0" })).state;
    expect(s.fill[0][0]).toBe("P");
    expect(apply(s, { type: "set", row: 0, col: 0, letter: "Q" }).code).toBe("revealed-fixed");
    expect(apply(s, { type: "enter", entryId: "a-r0c0", text: "QRICE" }).code).toBe("revealed-clash");
    s = apply(s, { type: "enter", entryId: "a-r0c0", text: "PRICE" }).state;
    s = solve(s);
    expect(engine.outcome(s)).toBe("completed");
    expect(engine.result(s)!.assistance).toEqual({ hints: 0, reveals: 1 });
    const g = apply(start("dc-gc1"), { type: "reveal", scope: "grid" });
    expect(engine.outcome(g.state)).toBe("revealed");
    expect(engine.result(g.state)!.explanation!.join(" ")).toMatch(/Rearrange the letters of SNOOP to make SPOON/);
  });

  it("pencil letters are distinct and completion waits until they are inked", () => {
    let s = start("dc-gq1");
    for (const e of s.entries) s = apply(s, { type: "enter", entryId: e.id, text: e.answer, pencil: e.id === "a-r2c0" }).state;
    expect(s.pencil[2][1]).toBe(true);
    expect(engine.outcome(s)).toBe("playing");
    const t = apply(s, { type: "ink" });
    expect(t.code).toBe("complete");
    expect(apply(start("dc-gq1"), { type: "ink" }).code).toBe("no-pencil");
  });

  it("every authored grid is solvable from its own entries", () => {
    for (const r of rounds) {
      const s = solve(engine.initialise(r.payload, sessionOptionsFor(r.meta, 2)));
      expect(engine.outcome(s), r.meta.id).toBe("completed");
    }
  });

  it("restores exactly by replaying stored actions (including checks and reveals)", () => {
    const b = bundle("dc-sq1");
    const actions: CrosswordAction[] = [
      { type: "set", row: 0, col: 0, letter: "M" },
      { type: "enter", entryId: "a-r2c0", text: "CHERUBS" },
      { type: "check", scope: "grid" },
      { type: "reveal", scope: "entry", entryId: "d-r0c6" },
    ];
    let s = engine.initialise(b.payload, sessionOptionsFor(b.meta, 5));
    for (const a of actions) s = engine.apply(s, a).state;
    const stored = {
      schemaVersion: 1, attemptId: "att-1", gameId: "daily-crossword", roundId: b.meta.id, contentHash: b.meta.contentHash,
      rulesVersion: b.meta.rulesVersion, dictionaryVersion: b.meta.dictionaryVersion, mode: "standard", seed: 5, practice: true, revision: 4,
      actions: actions.map((action, i) => ({ id: `a${i}`, at: "2026-01-01T00:00:00Z", action })), outcome: "playing", assisted: true,
      createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    };
    const res = restoreAttempt(engine, b.payload, b.meta, stored);
    expect(res.status).toBe("restored");
    if (res.status === "restored") expect(res.state).toEqual(s);
  });

  it("property: random set actions never write outside white squares and never complete a wrong grid", () => {
    const s0 = start("dc-eq1");
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.integer({ min: -1, max: 9 }), fc.integer({ min: -1, max: 9 }), fc.constantFrom("A", "E", "", "Z", "1")), { maxLength: 40 }), (moves) => {
        let s = s0;
        for (const [r, c, l] of moves) s = apply(s, { type: "set", row: r, col: c, letter: l }).state;
        s.solution.forEach((row, r) => [...row].forEach((ch, c) => ch === "#" && expect(s.fill[r][c]).toBe("")));
        if (engine.outcome(s) === "completed") expect(s.fill.map((r) => r.join("")).join("")).toBe(s.solution.join("").replace(/#/g, ""));
      }),
      { numRuns: 200 },
    );
  });
});

describe("cursor navigation", () => {
  const s = start("dc-gq1");
  it("typing advances within the entry and Backspace retreats", () => {
    let cur: Cursor = { row: 0, col: 0, dir: "across" };
    cur = advance(s, cur);
    expect(cur).toEqual({ row: 0, col: 1, dir: "across" });
    cur = advance(s, { row: 0, col: 4, dir: "across" });
    expect(cur.col).toBe(4);
    expect(retreat(s, { row: 2, col: 0, dir: "down" })).toEqual({ row: 1, col: 0, dir: "down" });
  });
  it("arrows skip blocks and take the arrow's axis where an entry exists", () => {
    expect(arrow(s, { row: 0, col: 0, dir: "across" }, "ArrowDown")).toEqual({ row: 1, col: 0, dir: "down" });
    expect(arrow(s, { row: 0, col: 1, dir: "across" }, "ArrowDown")).toEqual({ row: 2, col: 1, dir: "across" });
    expect(arrow(s, { row: 1, col: 0, dir: "down" }, "ArrowRight")).toEqual({ row: 1, col: 2, dir: "down" });
  });
  it("toggle switches direction only where both entries exist; Tab walks entries in order", () => {
    expect(toggle(s, { row: 0, col: 0, dir: "across" }).dir).toBe("down");
    expect(toggle(s, { row: 0, col: 1, dir: "across" }).dir).toBe("across");
    expect(jumpEntry(s, { row: 0, col: 0, dir: "across" }, 1)).toEqual({ row: 2, col: 0, dir: "across" });
    expect(jumpEntry(s, { row: 0, col: 0, dir: "across" }, -1)).toBeNull();
  });
});

describe("Master grids", () => {
  const master = rounds.filter((r) => r.meta.difficulty === "master");
  it("there are six, three quick and three cryptic, all 9x9 to 13x13, symmetric and connected", () => {
    expect(master).toHaveLength(6);
    expect(master.filter((r) => r.payload.style === "cryptic")).toHaveLength(3);
    for (const r of master) {
      expect(r.payload.grid.length).toBeGreaterThanOrEqual(9);
      expect(r.payload.grid.length).toBeLessThanOrEqual(13);
      expect(isSymmetric(r.payload.grid)).toBe(true);
      expect(isConnected(r.payload.grid)).toBe(true);
      expect(r.payload.entries.length).toBeGreaterThanOrEqual(12);
    }
  });
  it("every Master and new Expert grid is solved by entering its own answers", () => {
    for (const r of rounds.filter((x) => x.meta.id.startsWith("dc-m") || ["dc-eq5", "dc-eq6", "dc-ec4"].includes(x.meta.id))) {
      let s = engine.initialise(r.payload, sessionOptionsFor(r.meta, 1));
      for (const e of r.payload.entries) {
        const t = engine.apply(s, { type: "enter", entryId: e.id, text: e.answer });
        expect(t.ok, `${r.meta.id} ${e.id}`).toBe(true);
        s = t.state;
      }
      expect(engine.outcome(s), r.meta.id).toBe("completed");
    }
  });
  it("the validator needs six Master grids and rejects a repeated answer from an earlier grid", () => {
    expect(validateRounds(rounds)).toEqual([]);
    expect(validateRounds(rounds.filter((r) => r.meta.difficulty !== "master")).join()).toMatch(/only 0 master grids/);
    const sameAs = rounds.find((r) => r.meta.id === "dc-mq2")!;
    const grid = structuredClone(sameAs);
    grid.meta.id = "dc-mq8";
    expect(validateRounds([...rounds, grid]).join()).toMatch(/already used in/);
  });
});
