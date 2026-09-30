import { beforeEach, describe, expect, it } from "vitest";
import { accept, reject, type GameEngine, type RoundMeta } from "@/lib/engine/types";
import { newAttempt, restoreAttempt, withAction } from "./attempt";
import { memoryStore, readIndex, saveAttempt, setStoreForTesting, readJson, attemptKey, quarantine } from "./storage";
import { contentHash } from "@/lib/hash";

// A tiny counter engine to exercise the shared session contract.
type S = { total: number; seen: string[] };
type A = { type: "add"; n: number } | { type: "hint" };
const engine: GameEngine<{ target: number }, S, A> = {
  gameId: "test",
  rulesVersion: "1",
  initialise: () => ({ total: 0, seen: [] }),
  preview: () => ({ legal: true, code: "ok", message: "" }),
  apply(state, action) {
    if (action.type === "hint") return accept({ ...state, seen: [...state.seen, "hint"] }, "hint", "hint");
    if (action.n <= 0) return reject(state, "non-positive", "Must be positive");
    return accept({ ...state, total: state.total + action.n }, "added", "Added");
  },
  hints: () => [],
  result: (s) => (s.total >= 10 ? { outcome: "completed", headline: "Done", assistance: { hints: 0, reveals: 0 }, details: [], shareText: "" } : null),
  outcome: (s) => (s.total >= 10 ? "completed" : "playing"),
};
const payload = { target: 10 };
const meta: RoundMeta = {
  id: "r1",
  gameId: "test",
  difficulty: "gentle",
  status: "practice",
  rulesVersion: "1",
  dictionaryVersion: null,
  sourceFixtureId: null,
  contentHash: contentHash(payload),
};

describe("attempt persistence", () => {
  beforeEach(() => setStoreForTesting(memoryStore()));

  it("replays actions to restore exact state", () => {
    let a = newAttempt(meta, "att1", 1, true, "2026-09-30T00:00:00Z");
    a = withAction(a, { id: "x1", at: "t", action: { type: "add", n: 4 } }, "playing", false);
    a = withAction(a, { id: "x2", at: "t", action: { type: "add", n: 7 } }, "completed", false);
    const r = restoreAttempt(engine, payload, meta, JSON.parse(JSON.stringify(a)));
    expect(r.status).toBe("restored");
    if (r.status === "restored") expect(r.state.total).toBe(11);
  });

  it("commits each action id at most once", () => {
    let a = newAttempt(meta, "att1", 1, true, "t");
    const act = { id: "same", at: "t", action: { type: "add", n: 4 } };
    a = withAction(a, act, "playing", false);
    a = withAction(a, act, "playing", false);
    expect(a.actions).toHaveLength(1);
    expect(a.revision).toBe(1);
  });

  it("rejects a snapshot whose actions no longer replay", () => {
    let a = newAttempt(meta, "att1", 1, true, "t");
    a = withAction(a, { id: "bad", at: "t", action: { type: "add", n: -1 } }, "playing", false);
    expect(restoreAttempt(engine, payload, meta, a).status).toBe("corrupt");
  });

  it("flags a content or rules version change instead of reinterpreting", () => {
    const a = newAttempt(meta, "att1", 1, true, "t");
    expect(restoreAttempt(engine, payload, { ...meta, contentHash: "different" }, a).status).toBe("version-mismatch");
    expect(restoreAttempt(engine, payload, { ...meta, rulesVersion: "2" }, a).status).toBe("version-mismatch");
  });

  it("treats malformed JSON shapes as corrupt", () => {
    expect(restoreAttempt(engine, payload, meta, { hello: 1 }).status).toBe("corrupt");
    expect(restoreAttempt(engine, payload, meta, null).status).toBe("corrupt");
  });

  it("indexes saved attempts for the library and quarantines corrupt raw data", () => {
    const a = newAttempt(meta, "att1", 1, true, "t");
    saveAttempt(a, "Round one");
    expect(readIndex()).toHaveLength(1);
    const q = quarantine(attemptKey("test", "r1"), "{not json");
    expect(q).toBeTruthy();
    expect(readJson(attemptKey("test", "r1")).status).toBe("empty");
  });

  it("reports unavailable storage", () => {
    setStoreForTesting(null);
    expect(readJson("x").status).toBe("unavailable");
    expect(() => saveAttempt(newAttempt(meta, "a", 1, true, "t"), "x")).toThrow(/unavailable/i);
  });
});
