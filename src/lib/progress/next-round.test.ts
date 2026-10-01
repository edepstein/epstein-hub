import { beforeEach, describe, expect, it } from "vitest";
import { memoryStore, setStoreForTesting, markSeen, writeJson } from "./storage";
import { nextPracticeRound, oldestPlayedRound, pickFreshRound, playedRoundIds } from "./next-round";

const rounds = (n: number, d = "gentle") => Array.from({ length: n }, (_, i) => ({ id: `${d[0]}${i + 1}`, difficulty: d }));

describe("no-repeat round selection", () => {
  beforeEach(() => setStoreForTesting(memoryStore()));

  it("never offers a round already played, even past the library index size", () => {
    const all = rounds(3);
    markSeen("g", "g1", "2026-10-01T10:00:00Z");
    expect(playedRoundIds("g").has("g1")).toBe(true);
    const a = nextPracticeRound("g", null, all);
    expect(a.next?.id).toBe("g2");
    markSeen("g", "g2", "2026-10-01T10:01:00Z");
    expect(nextPracticeRound("g", null, all).next?.id).toBe("g3");
  });

  it("prefers the same difficulty, then any unplayed round, then reports exhaustion", () => {
    const all = [...rounds(1, "gentle"), ...rounds(2, "expert")];
    markSeen("g", "e1", "t1");
    expect(nextPracticeRound("g", null, all, "expert").next?.id).toBe("e2");
    markSeen("g", "e2", "t2");
    expect(nextPracticeRound("g", null, all, "expert").next?.id).toBe("g1");
    markSeen("g", "g1", "t3");
    const done = nextPracticeRound("g", null, all, "expert");
    expect(done).toEqual({ next: null, exhausted: true });
    expect(oldestPlayedRound("g", all)?.id).toBe("e1");
  });

  it("excludes the round being finished", () => {
    expect(nextPracticeRound("g", "g1", rounds(2)).next?.id).toBe("g2");
  });

  it("counts rounds known only to the library index", () => {
    writeJson("wc:v1:index", [
      { gameId: "g", roundId: "g1", attemptId: "a", title: "t", difficulty: "gentle", outcome: "completed", assisted: false, practice: true, updatedAt: "t" },
    ]);
    expect(nextPracticeRound("g", null, rounds(2)).next?.id).toBe("g2");
  });

  it("surprise picks never-played and least-recent games, avoids the last game, skips exhausted games", () => {
    const games = [
      { gameId: "a", rounds: rounds(2) },
      { gameId: "b", rounds: rounds(2) },
      { gameId: "c", rounds: rounds(1) },
    ];
    markSeen("a", "g1", "2026-10-01T12:00:00Z"); // a played most recently
    markSeen("b", "g1", "2026-10-01T09:00:00Z");
    markSeen("c", "g1", "2026-10-01T08:00:00Z"); // c exhausted
    for (let i = 0; i < 30; i++) {
      const p = pickFreshRound(games, "a")!;
      expect(p.gameId).toBe("b"); // not the last game, not exhausted
      expect(p.round.id).toBe("g2");
    }
    markSeen("b", "g2", "t");
    markSeen("a", "g2", "t");
    expect(pickFreshRound(games, null)).toBeNull();
  });
});
