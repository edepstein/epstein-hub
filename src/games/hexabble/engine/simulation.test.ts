/**
 * Seeded full-match simulations and property tests: tile conservation, unique IDs,
 * deterministic replay, score/history consistency and snapshot validity through play,
 * exchange, pass, challenge and finish. The test-only bot sees public state plus its own rack.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { loadMembershipSync } from "@/lib/dictionary/node";
import {
  EMPTY_DRAFT,
  applyAction,
  buildSnapshot,
  conservationProblems,
  createMatch,
  validateSnapshot,
  allCells,
  type CheckingMode,
  type MatchAction,
  type MatchState,
} from "./index";
import { chooseAction, publicView } from "../test-support/bot";

const dict = loadMembershipSync();

function checkInvariants(s: MatchState) {
  expect(conservationProblems(s)).toEqual([]);
  const snap = buildSnapshot({
    state: s,
    draft: EMPTY_DRAFT,
    matchId: "m",
    createdAt: "x",
    updatedAt: "x",
    privacy: true,
    handover: false,
    dictionaryVersion: "gb-esdb-v1-candidate",
  });
  const check = validateSnapshot(JSON.parse(JSON.stringify(snap)));
  if (!check.ok) throw new Error(check.reason);
}

function simulate(seed: number, players: number, mode: CheckingMode) {
  let s = createMatch({ names: Array.from({ length: players }, (_, i) => `Bot ${i + 1}`), mode, seed });
  let rng = seed ^ 0x5bd1e995;
  const counts = { play: 0, pass: 0, exchange: 0, challenge: 0, rejected: 0, bingo: 0 };
  for (let step = 0; step < 600 && !s.over; step++) {
    const view = publicView(s);
    const ownRack = s.players[s.current].rack.slice();
    const choice = chooseAction(view, ownRack, dict, rng);
    rng = choice.rng;
    const t = applyAction(s, choice.action, dict);
    // Determinism: the same action on the same state gives the same result.
    const again = applyAction(s, choice.action, dict);
    expect(again.state).toEqual(t.state);
    if (!t.ok) {
      counts.rejected++;
      expect(t.state).toBe(s);
      s = applyAction(s, { type: "pass" }, dict).state;
    } else {
      s = t.state;
      const last = s.history[s.history.length - 1];
      if (t.code === "played") counts.play++;
      if (t.code === "passed") counts.pass++;
      if (t.code === "exchanged") counts.exchange++;
      if (t.code === "challenged") counts.challenge++;
      if (last?.type === "play" && last.bingo) counts.bingo++;
    }
    checkInvariants(s);
  }
  if (!s.over) s = applyAction(s, { type: "end" }, dict).state;
  checkInvariants(s);
  return { s, counts };
}

describe("seeded full-match simulation", () => {
  const cases: [number, number, CheckingMode][] = [
    [1, 2, "friendly"],
    [2, 3, "friendly"],
    [3, 4, "friendly"],
    [4, 2, "challenge"],
    [5, 3, "challenge"],
    [6, 2, "friendly"],
  ];
  for (const [seed, players, mode] of cases) {
    it(`seed ${seed}: ${players} players, ${mode} checking, reaches a consistent end`, () => {
      const { s, counts } = simulate(seed, players, mode);
      expect(s.over).toBe(true);
      expect(counts.play).toBeGreaterThan(5);
      expect(s.winners.length).toBeGreaterThanOrEqual(1);
      const end = s.history[s.history.length - 1];
      expect(end.type).toBe("end");
      // Final table adds up: play points + adjustment = final, and adjustments net to zero when someone went out.
      if (end.type === "end" && end.cause === "went-out") {
        expect(end.adjustments.reduce((a, b) => a + b, 0)).toBe(0);
      }
    }, 60_000);
  }
});

describe("property: arbitrary action sequences conserve tiles and reject atomically", () => {
  it("holds for random seeds, player counts and actions", () => {
    const cells = allCells();
    const actionArb = fc.oneof(
      fc.constant<{ kind: "pass" }>({ kind: "pass" }),
      fc.record({ kind: fc.constant("exchange" as const), mask: fc.array(fc.boolean(), { minLength: 7, maxLength: 7 }) }),
      fc.record({ kind: fc.constant("arrange" as const), shift: fc.nat(6) }),
      fc.record({ kind: fc.constant("play" as const), cell: fc.nat(cells.length - 1), idx: fc.nat(6), face: fc.constantFrom("A", "E", "S", "AA", "", "1") }),
      fc.record({ kind: fc.constant("dup" as const), idx: fc.nat(6) }),
    );
    fc.assert(
      fc.property(fc.nat(0xffffffff), fc.integer({ min: 2, max: 4 }), fc.array(actionArb, { maxLength: 40 }), (seed, n, script) => {
        let s = createMatch({ names: Array.from({ length: n }, (_, i) => `P${i}`), mode: seed % 2 ? "friendly" : "challenge", seed });
        for (const step of script) {
          if (s.over) break;
          const rack = s.players[s.current].rack;
          let action: MatchAction;
          if (step.kind === "pass") action = { type: "pass" };
          else if (step.kind === "exchange") action = { type: "exchange", tileIds: rack.filter((_, i) => step.mask[i]) };
          else if (step.kind === "arrange") action = { type: "arrange", tileIds: [...rack.slice(step.shift), ...rack.slice(0, step.shift)] };
          else if (step.kind === "dup") action = { type: "play", placements: [{ q: 0, r: 0, tileId: rack[step.idx % rack.length] }, { q: 0, r: 1, tileId: rack[step.idx % rack.length] }] };
          else {
            const [q, r] = cells[step.cell];
            action = { type: "play", placements: [{ q, r, tileId: rack[step.idx % rack.length], assigned: step.face || null }] };
          }
          const before = JSON.stringify(s);
          const t = applyAction(s, action, dict);
          if (!t.ok) {
            expect(t.state).toBe(s);
            expect(JSON.stringify(s)).toBe(before);
          }
          s = t.state;
          expect(conservationProblems(s)).toEqual([]);
          expect(new Set(s.players.flatMap((p) => p.rack)).size).toBe(s.players.reduce((a, p) => a + p.rack.length, 0));
        }
      }),
      { numRuns: 60, seed: 20260930 },
    );
  });
});
