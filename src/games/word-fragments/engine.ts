import {
  accept,
  reject,
  type GameEngine,
  type HintOffer,
  type Outcome,
  type ResultSummary,
  type SessionOptions,
  type Transition,
} from "@/lib/engine/types";
import { createRng } from "@/lib/rng";
import { plural } from "@/lib/text";

export const RULES_VERSION = "1.0";

export interface FragTile {
  /** Stable identity: identical-looking tiles have different ids. */
  id: string;
  text: string;
}

export interface FragLane {
  id: string;
  clue: string;
  /** Letters in the answer. */
  length: number;
}

export interface FragPayload {
  lanes: FragLane[];
  tiles: FragTile[];
  /** Accepted answers per lane id. */
  acceptedAnswers: Record<string, string[]>;
  /** One example full allocation (lane id → tile ids in order). Any valid allocation wins. */
  allocations: Record<string, string[]>[];
  /** True only when the validator's solver proves a single allocation of fragment texts. */
  claimsUnique: boolean;
  explanation: string;
}

export interface FragHint {
  tier: number;
  lane: string;
  text: string;
}

export interface FragState {
  lanes: FragLane[];
  tiles: Record<string, string>;
  answers: Record<string, string[]>;
  claimsUnique: boolean;
  explanation: string;
  /** Presentation order of the shared tray (seeded shuffle); placed tiles are skipped. */
  trayOrder: string[];
  /** Current allocation: lane id → tile ids in order. */
  placed: Record<string, string[]>;
  locked: string[];
  /** Earlier allocations for Undo (cleared when a hint locks a lane). */
  history: Record<string, string[]>[];
  laneChecks: number;
  hints: FragHint[];
  hintLane: string | null;
  hintLevel: number;
  solved: boolean;
  revealed: boolean;
}

export type FragAction =
  | { type: "place"; tile: string; lane: string; index?: number }
  | { type: "remove"; tile: string }
  | { type: "undo" }
  | { type: "check-lane"; lane: string }
  | { type: "submit" }
  | { type: "hint"; tier: number };

export const HINT_LANE = 1;
export const HINT_FIRST_TILE = 2;
export const HINT_COMPLETE_LANE = 3;
export const HINT_REVEAL = 4;

type Allocation = Record<string, string[]>;

/**
 * Exact solver: every way to give each lane an ordered list of distinct tiles whose concatenation is
 * one of `words(lane)`, using every tile exactly once. `fixed` pins lanes to given tile lists.
 * Identical-text tiles produce separate ID allocations; callers can collapse by text.
 */
export function solveAllocations(
  lanes: readonly FragLane[],
  tiles: Readonly<Record<string, string>>,
  words: (lane: FragLane) => readonly string[],
  opts: { limit?: number; fixed?: Allocation } = {},
): Allocation[] {
  const limit = opts.limit ?? 10000;
  const ids = Object.keys(tiles);
  const out: Allocation[] = [];
  const used = new Set<string>();
  const current: Allocation = {};
  for (const list of Object.values(opts.fixed ?? {})) for (const id of list) used.add(id);

  function fillLane(li: number) {
    if (out.length >= limit) return;
    if (li === lanes.length) {
      if (used.size === ids.length) out.push(Object.fromEntries(Object.entries(current).map(([k, v]) => [k, v.slice()])));
      return;
    }
    const lane = lanes[li];
    const fixed = opts.fixed?.[lane.id];
    if (fixed) {
      current[lane.id] = fixed.slice();
      fillLane(li + 1);
      return;
    }
    for (const word of words(lane)) {
      if (word.length !== lane.length) continue;
      const seq: string[] = [];
      const build = (pos: number) => {
        if (out.length >= limit) return;
        if (pos === word.length) {
          current[lane.id] = seq.slice();
          fillLane(li + 1);
          return;
        }
        for (const id of ids) {
          if (used.has(id)) continue;
          const t = tiles[id];
          if (!t || !word.startsWith(t, pos)) continue;
          used.add(id);
          seq.push(id);
          build(pos + t.length);
          seq.pop();
          used.delete(id);
        }
      };
      build(0);
    }
  }
  fillLane(0);
  return out;
}

/** Collapse ID allocations to distinct fragment-text allocations (identical-looking tiles are interchangeable). */
export function textSignature(a: Allocation, tiles: Readonly<Record<string, string>>, laneOrder: readonly string[]): string {
  return laneOrder.map((l) => (a[l] ?? []).map((id) => tiles[id]).join("+")).join(" | ");
}

export function laneText(s: Pick<FragState, "placed" | "tiles">, lane: string): string {
  return (s.placed[lane] ?? []).map((id) => s.tiles[id]).join("");
}

export function trayTiles(s: Pick<FragState, "trayOrder" | "placed">): string[] {
  const placed = new Set(Object.values(s.placed).flat());
  return s.trayOrder.filter((id) => !placed.has(id));
}

function laneOf(s: FragState, tile: string): string | null {
  for (const [lane, list] of Object.entries(s.placed)) if (list.includes(tile)) return lane;
  return null;
}

function laneLabel(s: FragState, lane: string) {
  return `answer ${s.lanes.findIndex((l) => l.id === lane) + 1}`;
}

function clonePlaced(p: Allocation): Allocation {
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.slice()]));
}

function laneCorrect(s: FragState, lane: string) {
  return (s.answers[lane] ?? []).includes(laneText(s, lane));
}

/** The solution allocation that agrees most with the current board (respecting locked lanes). */
export function bestTarget(s: FragState): Allocation | null {
  const fixed: Allocation = {};
  for (const l of s.locked) fixed[l] = s.placed[l];
  const sols = solveAllocations(s.lanes, s.tiles, (l) => s.answers[l.id] ?? [], { fixed, limit: 2000 });
  let best: Allocation | null = null;
  let bestScore = -1;
  for (const a of sols) {
    let score = 0;
    for (const lane of s.lanes) {
      const cur = s.placed[lane.id] ?? [];
      (a[lane.id] ?? []).forEach((id, i) => {
        if (cur[i] === id) score += 3;
        else if (cur[i] && s.tiles[cur[i]] === s.tiles[id]) score += 2;
        else if (cur.includes(id)) score += 1;
      });
    }
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}

/** Re-express a target allocation using the ids already where the player put identical-looking tiles. */
function adoptIdentical(s: FragState, target: Allocation, lane: string): string[] {
  const want = target[lane];
  const cur = s.placed[lane] ?? [];
  return want.map((id, i) => (cur[i] && cur[i] !== id && s.tiles[cur[i]] === s.tiles[id] && !want.includes(cur[i]) ? cur[i] : id));
}

export function createWordFragmentsEngine(): GameEngine<FragPayload, FragState, FragAction> {
  const finished = (s: FragState) => s.solved || s.revealed;

  /** Move tiles so `lane` holds exactly `ids`, returning displaced tiles to the tray. */
  function setLane(s: FragState, lane: string, ids: string[]): { placed: Allocation; moved: string[] } {
    const placed = clonePlaced(s.placed);
    const moved: string[] = [];
    for (const [l, list] of Object.entries(placed)) {
      if (l === lane) continue;
      const keep = list.filter((id) => !ids.includes(id));
      if (keep.length !== list.length) moved.push(...list.filter((id) => ids.includes(id)).map((id) => `${s.tiles[id]} from ${laneLabel(s, l)}`));
      placed[l] = keep;
    }
    placed[lane] = ids.slice();
    return { placed, moved };
  }

  const engine: GameEngine<FragPayload, FragState, FragAction> = {
    gameId: "word-fragments",
    rulesVersion: RULES_VERSION,

    initialise(round: FragPayload, options: SessionOptions): FragState {
      const tiles: Record<string, string> = {};
      for (const t of round.tiles) tiles[t.id] = t.text.toUpperCase();
      const placed: Allocation = {};
      for (const l of round.lanes) placed[l.id] = [];
      return {
        lanes: round.lanes.map((l) => ({ ...l })),
        tiles,
        answers: Object.fromEntries(Object.entries(round.acceptedAnswers).map(([k, v]) => [k, v.map((w) => w.toUpperCase())])),
        claimsUnique: round.claimsUnique,
        explanation: round.explanation,
        trayOrder: createRng(options.seed).shuffle(round.tiles.map((t) => t.id)),
        placed,
        locked: [],
        history: [],
        laneChecks: 0,
        hints: [],
        hintLane: null,
        hintLevel: 0,
        solved: false,
        revealed: false,
      };
    },

    preview(state) {
      const left = trayTiles(state).length;
      return { legal: left === 0, code: left ? "tiles-left" : "ok", message: left ? `${plural(left, "fragment")} still in the tray.` : "Every fragment is placed." };
    },

    apply(state, action): Transition<FragState> {
      if (finished(state)) return reject(state, "finished", "This board is finished. Start again to replay it.");
      switch (action.type) {
        case "place": {
          const { tile, lane } = action;
          if (!(tile in state.tiles)) return reject(state, "unknown-tile", "That fragment is not on this board.");
          const target = state.lanes.find((l) => l.id === lane);
          if (!target) return reject(state, "unknown-lane", "That answer lane does not exist.");
          if (state.locked.includes(lane)) return reject(state, "lane-locked", `${laneLabel(state, lane)} was completed by a hint and is locked.`);
          const from = laneOf(state, tile);
          if (from && state.locked.includes(from)) return reject(state, "tile-locked", `${state.tiles[tile]} belongs to a lane completed by a hint and cannot move.`);
          const placed = clonePlaced(state.placed);
          if (from) placed[from] = placed[from].filter((id) => id !== tile);
          const list = placed[lane];
          const index = action.index === undefined ? list.length : action.index;
          if (!Number.isInteger(index) || index < 0 || index > list.length) return reject(state, "bad-position", "There is no such position in that lane.");
          list.splice(index, 0, tile);
          const letters = list.reduce((n, id) => n + state.tiles[id].length, 0);
          if (letters > target.length)
            return reject(state, "too-long", `${state.tiles[tile]} would make ${letters} letters, but ${laneLabel(state, lane)} has ${target.length}. Remove a fragment first.`);
          const next: FragState = { ...state, placed, history: [...state.history, clonePlaced(state.placed)] };
          const verb = from === lane ? "Moved" : "Placed";
          return accept(next, "placed", `${verb} ${state.tiles[tile]} in ${laneLabel(state, lane)}, position ${index + 1}: ${laneText(next, lane)} (${letters} of ${target.length} letters).`);
        }
        case "remove": {
          const from = laneOf(state, action.tile);
          if (!from) return reject(state, "not-placed", "That fragment is already in the tray.");
          if (state.locked.includes(from)) return reject(state, "tile-locked", "That fragment is in a lane completed by a hint and cannot move.");
          const placed = clonePlaced(state.placed);
          placed[from] = placed[from].filter((id) => id !== action.tile);
          return accept({ ...state, placed, history: [...state.history, clonePlaced(state.placed)] }, "removed", `Returned ${state.tiles[action.tile]} to the tray.`);
        }
        case "undo": {
          if (!state.history.length) return reject(state, "nothing-to-undo", "There is nothing to undo.");
          const placed = state.history[state.history.length - 1];
          return accept({ ...state, placed: clonePlaced(placed), history: state.history.slice(0, -1) }, "undone", "Undid the last move.");
        }
        case "check-lane": {
          const lane = state.lanes.find((l) => l.id === action.lane);
          if (!lane) return reject(state, "unknown-lane", "That answer lane does not exist.");
          const text = laneText(state, lane.id);
          const ok = laneCorrect(state, lane.id);
          const label = laneLabel(state, lane.id);
          return accept(
            { ...state, laneChecks: state.laneChecks + 1 },
            ok ? "lane-correct" : "lane-not-yet",
            ok ? `Checked ${label}: ${text} is an accepted answer.` : `Checked ${label}: ${text || "the empty lane"} is not an accepted answer yet.`,
          );
        }
        case "submit": {
          const left = trayTiles(state).length;
          if (left) return reject(state, "tiles-left", `${plural(left, "fragment")} still in the tray. Every fragment must be used exactly once.`);
          const short = state.lanes.filter((l) => laneText(state, l.id).length !== l.length);
          if (short.length) return reject(state, "wrong-length", `${short.map((l) => laneLabel(state, l.id)).join(" and ")} ${short.length === 1 ? "does" : "do"} not have the right number of letters.`);
          if (!state.lanes.every((l) => laneCorrect(state, l.id))) return reject(state, "not-yet", "Not every answer is right yet. Your board is unchanged; try moving fragments between lanes.");
          return accept({ ...state, solved: true }, "completed", `Board complete: ${state.lanes.map((l) => laneText(state, l.id)).join(", ")}.`);
        }
        case "hint": {
          const target = bestTarget(state);
          if (!target) return reject(state, "hint-unavailable", "No hint is available from this position.");
          const pickLane = () =>
            state.hintLane && !state.locked.includes(state.hintLane) && !laneCorrect(state, state.hintLane)
              ? state.hintLane
              : (state.lanes.find((l) => !state.locked.includes(l.id) && !laneCorrect(state, l.id))?.id ?? null);
          if (action.tier === HINT_LANE) {
            if (state.hintLevel >= HINT_LANE && state.hintLane && !laneCorrect(state, state.hintLane)) return reject(state, "hint-unavailable", "You already have a lane to work on.");
            const lane = state.lanes.find((l) => !state.locked.includes(l.id) && !laneCorrect(state, l.id));
            if (!lane) return reject(state, "hint-unavailable", "Every lane already spells an answer. Press Submit board.");
            const text = `Try ${laneLabel(state, lane.id)} next: "${lane.clue}" uses ${plural(target[lane.id].length, "fragment")}.`;
            return accept({ ...state, hintLane: lane.id, hintLevel: HINT_LANE, hints: [...state.hints, { tier: HINT_LANE, lane: lane.id, text }] }, "hint", text);
          }
          if (action.tier === HINT_FIRST_TILE) {
            const lane = pickLane();
            if (!lane || state.hintLevel < HINT_LANE) return reject(state, "hint-unavailable", "Take the which-lane hint first.");
            if (state.hintLevel >= HINT_FIRST_TILE) return reject(state, "hint-unavailable", "You already have the first fragment for this lane.");
            const want = adoptIdentical(state, target, lane)[0];
            const cur = state.placed[lane] ?? [];
            if (cur[0] && state.tiles[cur[0]] === state.tiles[want]) {
              const text = `${laneLabel(state, lane)} already starts with the right fragment, ${state.tiles[want]}.`;
              return accept({ ...state, hintLevel: HINT_FIRST_TILE, hints: [...state.hints, { tier: HINT_FIRST_TILE, lane, text }] }, "hint", text);
            }
            const from = laneOf(state, want);
            if (from && state.locked.includes(from)) return reject(state, "hint-unavailable", "That fragment is locked elsewhere.");
            const placed = clonePlaced(state.placed);
            if (from) placed[from] = placed[from].filter((id) => id !== want);
            placed[lane] = [want, ...placed[lane].filter((id) => id !== want)];
            // Keep within the lane length: overflow returns to the tray (stated in the message).
            const bumped: string[] = [];
            const laneDef = state.lanes.find((l) => l.id === lane)!;
            while (placed[lane].reduce((n, id) => n + state.tiles[id].length, 0) > laneDef.length) bumped.push(state.tiles[placed[lane].pop()!]);
            const text = `${state.tiles[want]} starts ${laneLabel(state, lane)}${from ? ` (moved from ${laneLabel(state, from)})` : " (taken from the tray)"}.${bumped.length ? ` ${bumped.join(", ")} went back to the tray to make room.` : ""}`;
            return accept(
              { ...state, placed, history: [...state.history, clonePlaced(state.placed)], hintLevel: HINT_FIRST_TILE, hints: [...state.hints, { tier: HINT_FIRST_TILE, lane, text }] },
              "hint",
              text,
            );
          }
          if (action.tier === HINT_COMPLETE_LANE) {
            const lane = pickLane();
            if (!lane) return reject(state, "hint-unavailable", "Every lane already spells an answer. Press Submit board.");
            const ids = adoptIdentical(state, target, lane);
            const { placed, moved } = setLane(state, lane, ids);
            const word = ids.map((id) => state.tiles[id]).join("");
            const text = `${laneLabel(state, lane)} completed and locked: ${ids.map((id) => state.tiles[id]).join(" + ")} = ${word}.${moved.length ? ` Moved ${moved.join(", ")}.` : ""}`;
            return accept(
              { ...state, placed, locked: [...state.locked, lane], history: [], hintLane: null, hintLevel: 0, hints: [...state.hints, { tier: HINT_COMPLETE_LANE, lane, text }] },
              "lane-revealed",
              `${text} Undo history was cleared because this lane is now fixed.`,
            );
          }
          if (action.tier === HINT_REVEAL) {
            const placed: Allocation = {};
            for (const l of state.lanes) placed[l.id] = adoptIdentical(state, target, l.id);
            const text = `Revealed the board: ${state.lanes.map((l) => placed[l.id].map((id) => state.tiles[id]).join("")).join(", ")}.`;
            return accept({ ...state, placed, revealed: true, hints: [...state.hints, { tier: HINT_REVEAL, lane: "", text }] }, "revealed", `${text} The round is recorded as revealed.`);
          }
          return reject(state, "hint-unavailable", "That hint does not exist.");
        }
        default:
          return reject(state, "unknown-action", "Unknown action.");
      }
    },

    hints(state): HintOffer[] {
      if (finished(state)) return [];
      const open = state.lanes.some((l) => !state.locked.includes(l.id) && !laneCorrect(state, l.id));
      const cost = "No points lost; the result records one hint.";
      const haveLane = state.hintLevel >= HINT_LANE && !!state.hintLane && !laneCorrect(state, state.hintLane);
      return [
        { tier: HINT_LANE, label: "Which lane next", description: "Suggests an answer lane to work on and how many fragments it uses.", available: open && !haveLane, reason: open ? "You already have a lane to work on." : "Every lane already spells an answer.", reveal: false, cost },
        {
          tier: HINT_FIRST_TILE,
          label: "First fragment",
          description: "Places the correct first fragment in that lane, saying where it came from.",
          available: haveLane && state.hintLevel < HINT_FIRST_TILE,
          reason: haveLane ? "Already taken for this lane." : "Take the which-lane hint first.",
          reveal: false,
          cost,
        },
        {
          tier: HINT_COMPLETE_LANE,
          label: "Complete a lane",
          description: "Fills one lane with its fragments and locks it. Any fragments it needs are moved visibly from other lanes or the tray.",
          available: open,
          reason: "Every lane already spells an answer.",
          reveal: true,
          cost: "Recorded as a reveal; the board can still be completed.",
        },
        { tier: HINT_REVEAL, label: "Reveal the board", description: "Places every fragment and ends the round as revealed.", available: true, reveal: true, cost: "A revealed board scores 0." },
      ];
    },

    outcome(state): Outcome {
      if (state.revealed) return "revealed";
      if (state.solved) return "completed";
      return "playing";
    },

    result(state): ResultSummary | null {
      if (!finished(state)) return null;
      const nudges = state.hints.filter((h) => h.tier <= HINT_FIRST_TILE).length;
      const reveals = state.hints.filter((h) => h.tier >= HINT_COMPLETE_LANE).length;
      const lines = state.lanes.map((l) => `${(state.placed[l.id] ?? []).map((id) => state.tiles[id]).join(" + ")} = ${laneText(state, l.id)} (${l.clue})`);
      const score = state.revealed ? 0 : 100;
      const assisted = nudges + reveals + state.laneChecks;
      return {
        outcome: state.revealed ? "revealed" : "completed",
        headline: state.revealed ? "Board revealed." : assisted ? "Board complete, with some help." : "Board complete, unaided.",
        scoreText: `${score} points`,
        score,
        maxScore: 100,
        efficiency: null,
        assistance: { hints: nudges + state.laneChecks, reveals },
        details: [
          ...lines,
          `All ${Object.keys(state.tiles).length} fragments used exactly once.`,
          `Lane checks: ${state.laneChecks}. Hints: ${nudges}. Lanes completed or revealed by hints: ${reveals}${state.revealed ? " (whole board revealed)" : ""}.`,
        ],
        shareText: `Word Club · Word Fragments · ${state.revealed ? "revealed" : `${state.lanes.length} words built`}${assisted ? ` · ${plural(assisted, "assist")}` : " · unassisted"}`,
        explanation: [state.explanation, ...(state.claimsUnique ? ["A solver confirmed this is the only way to share out the fragments."] : [])],
      };
    },
  };
  return engine;
}
