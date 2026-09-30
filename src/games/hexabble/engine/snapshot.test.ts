import { describe, expect, it } from "vitest";
import {
  EMPTY_DRAFT,
  RULES_VERSION,
  applyAction,
  buildSnapshot,
  createMatch,
  tileById,
  validateSnapshot,
  type MatchDraft,
  type MatchSnapshot,
  type MatchState,
} from "./index";
import { placements, rig, setOf } from "../test-support/rig";

const make = (state: MatchState, draft: MatchDraft = EMPTY_DRAFT, handover = false): MatchSnapshot =>
  buildSnapshot({
    state,
    draft,
    matchId: "match-1",
    createdAt: "2026-09-30T10:00:00.000Z",
    updatedAt: "2026-09-30T10:05:00.000Z",
    privacy: true,
    handover,
    dictionaryVersion: "gb-esdb-v1-candidate",
  });
const roundTrip = (s: MatchSnapshot) => JSON.parse(JSON.stringify(s));

function playedMatch() {
  // A real opening from a real deal: find a rigged state with a legal first move instead.
  const g = rig({ racks: ["CATSEEN", "DOGRIEL"] });
  const t = applyAction(g, { type: "play", placements: placements(g, [[0, 0, 0], [0, 1, 1], [0, 2, 2]]) }, setOf("CAT"));
  expect(t.ok).toBe(true);
  return t.state;
}

describe("snapshot round trip", () => {
  it("a fresh match with a draft restores exactly", () => {
    const g = createMatch({ names: ["Mum", "Ed"], mode: "friendly", seed: 99 });
    const rack = g.players[0].rack;
    const draft: MatchDraft = {
      placements: rack.slice(0, 2).map((id, i) => {
        const t = tileById(id)!;
        return { q: 0, r: i, tileId: id, assigned: t.kind === "wild" || t.kind === "key" ? "E" : null };
      }),
      selected: rack[2],
    };
    const check = validateSnapshot(roundTrip(make(g, draft, true)));
    expect(check.ok).toBe(true);
    if (check.ok) {
      expect(check.snapshot.state).toEqual(g);
      expect(check.snapshot.draft).toEqual(draft);
      expect(check.snapshot.handover).toBe(true);
    }
  });

  it("a played position and a finished match restore, including the final result", () => {
    const played = playedMatch();
    expect(validateSnapshot(roundTrip(make(played))).ok).toBe(true);
    const over = applyAction(played, { type: "end" }, setOf()).state;
    const check = validateSnapshot(roundTrip(make(over)));
    expect(check.ok).toBe(true);
    if (check.ok) {
      expect(check.snapshot.state.over).toBe(true);
      expect(check.snapshot.state.winners).toEqual(over.winners);
      expect(check.snapshot.state.history.at(-1)?.type).toBe("end");
    }
  });

  it("stores the generator state as a number, never a function", () => {
    const g = createMatch({ names: ["A", "B"], mode: "challenge", seed: 5 });
    const raw = roundTrip(make(g));
    expect(typeof raw.state.rngState).toBe("number");
    // Continuing from a restored snapshot gives the same exchange result as the original.
    const check = validateSnapshot(raw);
    if (!check.ok) throw new Error(check.reason);
    const ids = g.players[0].rack.slice(0, 2);
    expect(applyAction(check.snapshot.state, { type: "exchange", tileIds: ids }, setOf()).state).toEqual(
      applyAction(g, { type: "exchange", tileIds: ids }, setOf()).state,
    );
  });
});

describe("snapshot rejection", () => {
  const base = () => roundTrip(make(createMatch({ names: ["A", "B", "C"], mode: "friendly", seed: 12 })));
  const reject = (mutate: (s: ReturnType<typeof base>) => void) => {
    const s = base();
    mutate(s);
    return validateSnapshot(s);
  };

  it("rejects unknown save versions and other rules versions with their own codes", () => {
    expect(reject((s) => (s.schemaVersion = 2))).toMatchObject({ ok: false, code: "unknown-version" });
    expect(reject((s) => (s.rulesVersion = "hexabble-rules-0.9"))).toMatchObject({ ok: false, code: "rules-version" });
    expect(RULES_VERSION).toBe("hexabble-rules-1.0");
  });
  it("rejects non-objects and missing fields", () => {
    expect(validateSnapshot(null).ok).toBe(false);
    expect(validateSnapshot("{}").ok).toBe(false);
    expect(reject((s) => delete s.state.bag)).toMatchObject({ ok: false, code: "malformed" });
  });
  it("rejects duplicated tiles", () => {
    expect(reject((s) => s.state.bag.push(s.state.players[0].rack[0]))).toMatchObject({ ok: false, code: "integrity" });
  });
  it("rejects missing tiles", () => {
    expect(reject((s) => s.state.bag.pop())).toMatchObject({ ok: false });
  });
  it("rejects unknown tile IDs", () => {
    expect(reject((s) => (s.state.bag[0] = "t999"))).toMatchObject({ ok: false });
  });
  it("rejects invalid board cells", () => {
    expect(
      reject((s) => {
        const id = s.state.bag.pop();
        s.state.board["9,0"] = { tileId: id, letter: "A", player: 0, turn: 1 };
      }),
    ).toMatchObject({ ok: false });
  });
  it("rejects impossible player indices", () => {
    expect(reject((s) => (s.state.current = 3))).toMatchObject({ ok: false, code: "integrity" });
    expect(reject((s) => (s.state.current = 1.5))).toMatchObject({ ok: false });
    expect(reject((s) => (s.state.players = s.state.players.slice(0, 1)))).toMatchObject({ ok: false });
  });
  it("rejects scores that do not match the history", () => {
    expect(reject((s) => (s.state.players[1].score = 50))).toMatchObject({ ok: false, code: "integrity" });
  });
  it("rejects a wrong face on a board tile", () => {
    const played = playedMatch();
    const s = roundTrip(make(played));
    s.state.board["0,0"].letter = "Q";
    expect(validateSnapshot(s)).toMatchObject({ ok: false, code: "integrity" });
  });
  it("rejects drafts using tiles outside the active rack, occupied cells or bad faces", () => {
    const played = playedMatch();
    const other = played.players[0].rack[0]; // player 1 is now active
    expect(validateSnapshot(roundTrip(make(played, { placements: [{ q: 1, r: 0, tileId: other, assigned: null }], selected: null }))).ok).toBe(false);
    const own = played.players[1].rack[0];
    expect(validateSnapshot(roundTrip(make(played, { placements: [{ q: 0, r: 0, tileId: own, assigned: null }], selected: null }))).ok).toBe(false);
    expect(validateSnapshot(roundTrip(make(played, { placements: [{ q: 1, r: 0, tileId: own, assigned: "A" }], selected: null }))).ok).toBe(false);
    expect(validateSnapshot(roundTrip(make(played, { placements: [{ q: 1, r: 0, tileId: own, assigned: null }], selected: own }))).ok).toBe(false);
    expect(validateSnapshot(roundTrip(make(played, { placements: [{ q: 1, r: 0, tileId: own, assigned: null }], selected: null }))).ok).toBe(true);
  });
  it("rejects a finished match whose winners do not match the scores", () => {
    const over = applyAction(playedMatch(), { type: "end" }, setOf()).state;
    const s = roundTrip(make(over));
    s.state.winners = [1 - over.winners[0]];
    expect(validateSnapshot(s)).toMatchObject({ ok: false, code: "integrity" });
  });
  it("rejects an unfinished match with a final result", () => {
    expect(reject((s) => (s.state.endReason = "Done"))).toMatchObject({ ok: false, code: "integrity" });
  });
});
