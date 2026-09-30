import { describe, expect, it } from "vitest";
import { commit, createMatch, type MatchState, type Membership } from "./engine";
import { handleTurn, publicView } from "./protocol";
import { compatibleDraft, newEnvelope, restoreMatch, withDraft, withRequest, type MatchEnvelope } from "./snapshot";
import { replayFixture } from "./fixture";
import { rulesHash, RULES_1_0 } from "./rules";

const ANY: Membership = { has: () => true };

function start(version: "1.0" | "1.1-candidate" = "1.1-candidate", seed = 5, players = 2): MatchState {
  const c = createMatch({ rulesVersion: version, dictionaryVersion: "gb-test", players: Array.from({ length: players }, (_, i) => ({ name: `P${i + 1}` })), seed });
  if (!c.ok) throw new Error(c.message);
  return c.state;
}

describe("hidden-rack projection", () => {
  it("shows the viewer's own rack and only counts for everyone else, never the bag order or RNG", () => {
    const s = start("1.1-candidate", 5, 3);
    for (const viewer of [0, 1, 2]) {
      const v = publicView(s, viewer);
      const json = JSON.stringify(v);
      expect(v.ownRack.map((t) => t.id)).toEqual(s.racks[viewer]);
      expect(v.players.map((p) => p.rackCount)).toEqual([7, 7, 7]);
      expect(v.bagCount).toBe(s.bag.length);
      for (let other = 0; other < 3; other++) {
        if (other === viewer) continue;
        for (const id of s.racks[other]) expect(json).not.toContain(`"${id}"`);
      }
      for (const id of s.bag) expect(json).not.toContain(`"${id}"`);
      expect(json).not.toMatch(/"bag"|"rng"|"racks"|"tiles"/);
    }
  });

  it("does not reveal which tiles were exchanged or drawn", () => {
    let s = start();
    const give = s.racks[0].slice(0, 3);
    const r = commit(s, { actionId: "x1", expectedVersion: 0, action: { type: "exchange", seat: 0, tileIds: give } }, ANY);
    s = r.state;
    const v = publicView(s, 1);
    const json = JSON.stringify(v);
    for (const id of [...give, ...s.racks[0]]) expect(json).not.toContain(`"${id}"`);
    expect(v.history).toEqual([{ kind: "exchange", seat: 0, version: 1, count: 3 }]);
  });

  it("an out-of-range viewer sees no rack at all", () => {
    const s = start();
    expect(publicView(s, -1).ownRack).toEqual([]);
    expect(publicView(s, 9).ownRack).toEqual([]);
  });

  it("discloses leftover racks only once the match is over", () => {
    let s = start("1.0", 9);
    expect(publicView(s, 1).end).toBeNull();
    for (let i = 0; i < 6; i++) s = commit(s, { actionId: `p${i}`, expectedVersion: s.version, action: { type: "pass", seat: s.current } }, ANY).state;
    const v = publicView(s, 1);
    expect(v.status).toBe("finished");
    expect(v.end!.adjustments[0].leftover).toHaveLength(7);
  });
});

describe("server-authoritative turn protocol", () => {
  it("accepts a valid move and returns the redacted state for the requester", () => {
    const { steps } = replayFixture();
    expect(steps).toHaveLength(3);
    const s = start("1.0", 3);
    const out = handleTurn(s, "m1", { matchId: "m1", seat: 0, actionId: "a1", expectedVersion: 0, action: { type: "pass", seat: 0 } }, ANY);
    expect(out.response).toMatchObject({ status: "accepted", code: "passed" });
    expect(out.response.view.version).toBe(1);
    expect(out.response.view.ownRack.map((t) => t.id)).toEqual(s.racks[0]);
  });

  it("returns conflict with the current authoritative view for a stale version", () => {
    let s = start("1.0", 3);
    s = handleTurn(s, "m1", { matchId: "m1", seat: 0, actionId: "a1", expectedVersion: 0, action: { type: "pass", seat: 0 } }, ANY).state;
    const out = handleTurn(s, "m1", { matchId: "m1", seat: 1, actionId: "b1", expectedVersion: 0, action: { type: "pass", seat: 1 } }, ANY);
    expect(out.response).toMatchObject({ status: "conflict", code: "stale-version" });
    expect(out.state).toBe(s);
    expect(out.response.view.version).toBe(1);
  });

  it("returns the original result for a duplicate submission", () => {
    let s = start("1.0", 3);
    const req = { matchId: "m1", seat: 0, actionId: "a1", expectedVersion: 0, action: { type: "pass" as const, seat: 0 } };
    s = handleTurn(s, "m1", req, ANY).state;
    const again = handleTurn(s, "m1", req, ANY);
    expect(again.response.status).toBe("duplicate");
    expect(again.state).toBe(s);
    expect(again.state.version).toBe(1);
  });

  it("refuses forged seats, non-members and moves for another match", () => {
    const s = start("1.0", 3);
    const forged = handleTurn(s, "m1", { matchId: "m1", seat: 1, actionId: "f", expectedVersion: 0, action: { type: "pass", seat: 0 } }, ANY);
    expect(forged.response).toMatchObject({ status: "forbidden", code: "forged-seat" });
    expect(forged.state).toBe(s);
    expect(forged.response.view.ownRack.map((t) => t.id)).toEqual(s.racks[1]);
    expect(handleTurn(s, "m1", { matchId: "m1", seat: 5, actionId: "f", expectedVersion: 0, action: { type: "pass", seat: 5 } }, ANY).response.code).toBe("not-a-member");
    expect(handleTurn(s, "m1", { matchId: "m2", seat: 0, actionId: "f", expectedVersion: 0, action: { type: "pass", seat: 0 } }, ANY).response.code).toBe("wrong-match");
  });

  it("an illegal move is rejected without consuming the turn", () => {
    const s = start("1.0", 3);
    const out = handleTurn(s, "m1", { matchId: "m1", seat: 0, actionId: "a1", expectedVersion: 0, action: { type: "place", seat: 0, placements: [{ tileId: s.racks[0][0], row: 0, column: 0 }] } }, ANY);
    expect(out.response.status).toBe("rejected");
    expect(out.state).toBe(s);
    expect(out.response.view.current).toBe(0);
  });
});

describe("match snapshot", () => {
  function played(): { env: MatchEnvelope; state: MatchState } {
    let env = newEnvelope({ matchId: "m-1", rulesVersion: "1.0", dictionaryVersion: "gb-test", players: [{ name: "Ann" }, { name: "Ben" }], seed: 77, now: "t0" });
    const c = createMatch({ rulesVersion: "1.0", dictionaryVersion: "gb-test", players: env.setup.players, seed: 77 });
    if (!c.ok) throw new Error();
    let state = c.state;
    const reqs = [
      { actionId: "a1", expectedVersion: 0, action: { type: "hint" as const, seat: 0 } },
      { actionId: "a2", expectedVersion: 1, action: { type: "pass" as const, seat: 0 } },
      { actionId: "a3", expectedVersion: 2, action: { type: "exchange" as const, seat: 1, tileIds: state.racks[1].slice(0, 2) } },
    ];
    for (const req of reqs) {
      const r = commit(state, req, ANY);
      expect(r.status).toBe("accepted");
      state = r.state;
      env = withRequest(env, req, "t");
    }
    return { env, state };
  }

  it("round-trips through JSON and replays to the identical state", () => {
    const { env, state } = played();
    const r = restoreMatch(JSON.parse(JSON.stringify(env)), ANY, "gb-test");
    expect(r.status).toBe("restored");
    if (r.status === "restored") expect(r.state).toEqual(state);
  });

  it("appending the same request twice is idempotent", () => {
    const { env } = played();
    expect(withRequest(env, { actionId: "a1", expectedVersion: 9, action: { type: "pass", seat: 0 } }, "t")).toBe(env);
  });

  it("rejects malformed, tampered or reordered saves as corrupt", () => {
    const { env } = played();
    expect(restoreMatch(null, ANY, "gb-test").status).toBe("corrupt");
    expect(restoreMatch({ hello: 1 }, ANY, "gb-test").status).toBe("corrupt");
    expect(restoreMatch({ ...env, schemaVersion: 2 }, ANY, "gb-test").status).toBe("corrupt");
    const tampered = structuredClone(env);
    (tampered.actions[2].action as { tileIds: string[] }).tileIds = ["t1", "t1"];
    expect(restoreMatch(tampered, ANY, "gb-test")).toMatchObject({ status: "corrupt" });
    const reordered = { ...env, actions: [env.actions[1], env.actions[0], env.actions[2]] };
    expect(restoreMatch(reordered, ANY, "gb-test").status).toBe("corrupt");
    const repeated = { ...env, actions: [env.actions[0], env.actions[0]] };
    expect(restoreMatch(repeated, ANY, "gb-test").status).toBe("corrupt");
    const badPlayers = { ...env, setup: { ...env.setup, players: [{ name: "Ann" }, { name: "ann" }] } };
    expect(restoreMatch(badPlayers, ANY, "gb-test").status).toBe("corrupt");
  });

  it("never replays a save under a different rule set or word list", () => {
    const { env } = played();
    // Relabelled as 1.1-candidate: the pinned rules hash no longer matches.
    expect(restoreMatch({ ...env, rulesVersion: "1.1-candidate" }, ANY, "gb-test").status).toBe("version-mismatch");
    expect(restoreMatch({ ...env, rulesHash: "0000" }, ANY, "gb-test").status).toBe("version-mismatch");
    expect(restoreMatch({ ...env, rulesVersion: "2.0" }, ANY, "gb-test").status).toBe("version-mismatch");
    expect(restoreMatch(env, ANY, "gb-other").status).toBe("version-mismatch");
    expect(env.rulesHash).toBe(rulesHash(RULES_1_0));
  });

  it("restores a draft only when it still fits the position", () => {
    const { env, state } = played();
    const seat = state.current;
    const rack = state.racks[seat];
    const draft = { seat, version: state.version, placements: [{ tileId: rack[0], row: 4, column: 4 }], rackOrder: [...rack].reverse() };
    const saved = withDraft(env, draft);
    const r = restoreMatch(JSON.parse(JSON.stringify(saved)), ANY, "gb-test");
    if (r.status !== "restored") throw new Error(r.status);
    expect(compatibleDraft(r.state, r.envelope.draft)).toEqual(draft);
    expect(compatibleDraft(r.state, { ...draft, version: 0 })).toBeUndefined();
    expect(compatibleDraft(r.state, { ...draft, seat: 1 - seat })).toBeUndefined();
    expect(compatibleDraft(r.state, { ...draft, placements: [{ tileId: "t999", row: 4, column: 4 }] })).toBeUndefined();
    expect(compatibleDraft(r.state, { ...draft, rackOrder: ["zz"] })?.rackOrder).toEqual(rack);
    // A committed request clears the draft.
    expect(withRequest(saved, { actionId: "a9", expectedVersion: 3, action: { type: "pass", seat } }, "t").draft).toBeUndefined();
  });
});
