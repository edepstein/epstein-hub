import {
  accept,
  reject,
  type Analysis,
  type GameEngine,
  type HintOffer,
  type Outcome,
  type ResultSummary,
  type SessionOptions,
  type Transition,
} from "@/lib/engine/types";
import { plural } from "@/lib/text";
import { buildBoard, type Lane, type LaneSpec } from "./board";

export const RULES_VERSION = "1.0";

export interface WeavePayload {
  rows: number;
  cols: number;
  lanes: LaneSpec[];
  /** Complete accepted grids, lane id -> answer. The first is the reference solution. */
  acceptedGrids: Record<string, string>[];
  /** Master rounds: other membership words that fit a lane's crossing pattern, each judged excluded by the clue. */
  reviewedAlternatives?: Record<string, string[]>;
  /** Gentle rounds: optional answer bank the player may choose to see. */
  bank?: string[];
  /** Pack fixtures: the original sample hints (kept as regression data). */
  sampleHints?: string[];
  explanation: string;
}

export interface WeaveHint {
  tier: number;
  text: string;
}

export interface WeaveState {
  rows: number;
  cols: number;
  lanes: Lane[];
  active: number[];
  /** Per accepted grid: cell -> letter. */
  solutions: Record<number, string>[];
  /** cell -> entered letter ("" or absent = empty). */
  entries: Record<number, string>;
  revealed: number[];
  /** Cells marked wrong by the most recent lane check (cleared when changed). */
  wrongMarks: number[];
  checks: { lane: string; wrong: number }[];
  hintLane: string | null;
  hints: WeaveHint[];
  bank: string[] | null;
  bankShown: boolean;
  failedSubmits: number;
  status: "in_progress" | "completed" | "revealed";
  explanation: string;
}

export type WeaveAction =
  | { type: "fill"; cells: [number, string][] }
  | { type: "submit" }
  | { type: "check"; lane: string }
  | { type: "reveal-lane"; lane: string }
  | { type: "hint"; tier: number };

export const HINT_LANE = 1;
export const HINT_LETTER = 2;
export const HINT_REVEAL_LANE = 3;
export const HINT_REVEAL_ALL = 4;
export const HINT_BANK = 5;

export const laneById = (s: Pick<WeaveState, "lanes">, id: string) => s.lanes.find((l) => l.id === id) ?? null;
export const entryAt = (s: Pick<WeaveState, "entries">, c: number) => s.entries[c] ?? "";
export const filledCount = (s: WeaveState) => s.active.filter((c) => entryAt(s, c)).length;

/** Index of the accepted grid that agrees with most current entries (ties: the first). */
export function bestSolution(s: Pick<WeaveState, "solutions" | "entries" | "active">): Record<number, string> {
  let best = s.solutions[0];
  let score = -1;
  for (const sol of s.solutions) {
    const n = s.active.filter((c) => s.entries[c] && s.entries[c] === sol[c]).length;
    if (n > score) {
      score = n;
      best = sol;
    }
  }
  return best;
}

export const laneAnswer = (s: WeaveState, lane: Lane) => lane.cells.map((c) => bestSolution(s)[c]).join("");
export const laneEntry = (s: Pick<WeaveState, "entries">, lane: Lane) => lane.cells.map((c) => entryAt(s, c) || "·").join("");
export const laneCorrect = (s: WeaveState, lane: Lane) => {
  const sol = bestSolution(s);
  return lane.cells.every((c) => entryAt(s, c) === sol[c]);
};
const gridMatches = (s: WeaveState) => s.solutions.some((sol) => s.active.every((c) => entryAt(s, c) === sol[c]));

export function scoreOf(s: WeaveState): number {
  const sol = bestSolution(s);
  const unaided = s.active.filter((c) => !s.revealed.includes(c) && entryAt(s, c) === sol[c]).length;
  return Math.floor((100 * unaided) / s.active.length);
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

export function createWordWeaveEngine(): GameEngine<WeavePayload, WeaveState, WeaveAction, string> {
  /** The lane whose crossings give most support: most correct crossing letters, not yet solved. */
  function suggestLane(s: WeaveState): Lane | null {
    const sol = bestSolution(s);
    let best: Lane | null = null;
    let key = [-1, -1, 0];
    for (const l of s.lanes) {
      if (laneCorrect(s, l)) continue;
      const crossings = l.cells.filter((c) => s.lanes.some((o) => o.id !== l.id && o.cells.includes(c)));
      const support = crossings.filter((c) => entryAt(s, c) === sol[c]).length;
      const k = [support, crossings.length, -l.length];
      if (k[0] > key[0] || (k[0] === key[0] && (k[1] > key[1] || (k[1] === key[1] && k[2] > key[2])))) {
        best = l;
        key = k;
      }
    }
    return best;
  }

  function hintTarget(s: WeaveState): Lane | null {
    const h = s.hintLane ? laneById(s, s.hintLane) : null;
    if (h && !laneCorrect(s, h)) return h;
    return suggestLane(s);
  }

  function revealCells(s: WeaveState, cells: number[]): WeaveState {
    const sol = bestSolution(s);
    const entries = { ...s.entries };
    const revealed = new Set(s.revealed);
    for (const c of cells) {
      if (entries[c] === sol[c]) continue; // already right: stays the player's own
      entries[c] = sol[c];
      revealed.add(c);
    }
    return { ...s, entries, revealed: [...revealed].sort((a, b) => a - b), wrongMarks: s.wrongMarks.filter((c) => !cells.includes(c)) };
  }

  const done = (s: WeaveState) => s.status !== "in_progress";

  const engine: GameEngine<WeavePayload, WeaveState, WeaveAction, string> = {
    gameId: "word-weave",
    rulesVersion: RULES_VERSION,

    initialise(round: WeavePayload, _options: SessionOptions): WeaveState {
      void _options;
      const board = buildBoard(round.rows, round.cols, round.lanes);
      const solutions = round.acceptedGrids.map((g) => {
        const out: Record<number, string> = {};
        for (const l of board.lanes) l.cells.forEach((c, i) => (out[c] = (g[l.id] ?? "")[i]?.toUpperCase() ?? ""));
        return out;
      });
      return {
        rows: round.rows,
        cols: round.cols,
        lanes: board.lanes,
        active: board.active,
        solutions,
        entries: {},
        revealed: [],
        wrongMarks: [],
        checks: [],
        hintLane: null,
        hints: [],
        bank: round.bank ? [...round.bank] : null,
        bankShown: false,
        failedSubmits: 0,
        status: "in_progress",
        explanation: round.explanation,
      };
    },

    preview(state, draft): Analysis {
      // Draft = a whole-lane answer typed for the selected lane: "laneId:WORD".
      const [id, raw = ""] = draft.split(":");
      const lane = laneById(state, id);
      if (!lane) return { legal: false, code: "no-lane", message: "Choose a lane first." };
      const word = raw.trim().toUpperCase();
      if (!/^[A-Z]+$/.test(word)) return { legal: false, code: "non-letters", message: "Use letters A to Z only." };
      if (word.length !== lane.length) return { legal: false, code: "wrong-length", message: `${lane.label} needs ${lane.length} letters; ${word} has ${word.length}.` };
      return { legal: true, code: "ok", message: `${word} fits ${lane.label}.` };
    },

    apply(state, action): Transition<WeaveState> {
      if (done(state)) return reject(state, "finished", state.status === "completed" ? "This weave is already complete." : "This weave has been revealed.");
      switch (action.type) {
        case "fill": {
          if (!Array.isArray(action.cells) || !action.cells.length) return reject(state, "empty", "Nothing to enter.");
          const entries = { ...state.entries };
          const changed: number[] = [];
          for (const pair of action.cells) {
            const [c, raw] = pair ?? [];
            const letter = typeof raw === "string" ? raw.trim().toUpperCase() : "";
            if (!state.active.includes(c)) return reject(state, "not-a-square", "That is not a playable square.");
            if (letter && !/^[A-Z]$/.test(letter)) return reject(state, "non-letters", "Use letters A to Z only.");
            if (state.revealed.includes(c)) {
              if (letter !== entryAt(state, c)) {
                const lane = state.lanes.find((l) => l.cells.includes(c))!;
                return reject(state, "revealed-square", `The ${ordinal(lane.cells.indexOf(c) + 1)} letter of ${lane.label} was revealed as ${entryAt(state, c)} and cannot be changed.`);
              }
              continue;
            }
            if (entryAt(state, c) !== letter) {
              changed.push(c);
              if (letter) entries[c] = letter;
              else delete entries[c];
            }
          }
          if (!changed.length) return reject(state, "no-change", "");
          const next: WeaveState = { ...state, entries, wrongMarks: state.wrongMarks.filter((c) => !changed.includes(c)) };
          const whole = action.cells.length > 1 ? state.lanes.find((l) => l.cells.length === action.cells.length && l.cells.every((c, i) => action.cells[i]?.[0] === c)) : null;
          const full = filledCount(next) === next.active.length;
          return accept(next, "filled", whole ? `Entered ${laneEntry(next, whole)} in ${whole.label}.${full ? " Every square is filled: submit when ready." : ""}` : full ? "Every square is filled: submit when ready." : "");
        }
        case "submit": {
          const empty = state.active.length - filledCount(state);
          if (empty) return reject(state, "incomplete", `${plural(empty, "square")} still empty. Fill every square, then submit.`);
          if (!gridMatches(state)) {
            // Count the failed attempt without changing any letters. (Accepted so it persists.)
            return accept({ ...state, failedSubmits: state.failedSubmits + 1 }, "incorrect", "Not yet: at least one square is wrong. You can check a lane to see where.");
          }
          const next: WeaveState = { ...state, status: "completed" };
          return accept(next, "complete", `Solved! Every lane agrees at every crossing. Score ${scoreOf(next)}.`);
        }
        case "check": {
          const lane = laneById(state, action.lane);
          if (!lane) return reject(state, "no-lane", "Choose a lane to check.");
          const sol = bestSolution(state);
          const wrong = lane.cells.filter((c) => entryAt(state, c) && entryAt(state, c) !== sol[c]);
          const empty = lane.cells.filter((c) => !entryAt(state, c)).length;
          const next: WeaveState = { ...state, wrongMarks: [...new Set([...state.wrongMarks, ...wrong])], checks: [...state.checks, { lane: lane.id, wrong: wrong.length }] };
          return accept(
            next,
            "checked",
            `${lane.label}: ${wrong.length ? `${plural(wrong.length, "square")} marked wrong` : "no wrong letters"}${empty ? `, ${plural(empty, "square")} empty` : ""}. Checking is recorded as help.`,
          );
        }
        case "reveal-lane": {
          const lane = laneById(state, action.lane);
          if (!lane) return reject(state, "no-lane", "Choose a lane to reveal.");
          if (laneCorrect(state, lane)) return reject(state, "already-correct", `${lane.label} is already correct.`);
          const next = revealCells(state, lane.cells);
          return accept({ ...next, hints: [...state.hints, { tier: HINT_REVEAL_LANE, text: `Revealed ${lane.label}.` }] }, "revealed", `Revealed ${lane.label}, including its shared squares.`);
        }
        case "hint": {
          if (action.tier === HINT_BANK) {
            if (!state.bank) return reject(state, "hint-unavailable", "This round has no word bank.");
            if (state.bankShown) return reject(state, "hint-unavailable", "The word bank is already showing.");
            return accept({ ...state, bankShown: true, hints: [...state.hints, { tier: HINT_BANK, text: "Showed the word bank." }] }, "hint", `Word bank: ${state.bank.join(", ")}.`);
          }
          if (action.tier === HINT_REVEAL_ALL) {
            const next = revealCells(state, state.active);
            return accept({ ...next, status: "revealed", hints: [...state.hints, { tier: HINT_REVEAL_ALL, text: "Revealed the whole weave." }] }, "revealed-all", "The whole weave is revealed. The round is recorded as revealed.");
          }
          const lane = hintTarget(state);
          if (!lane) return reject(state, "hint-unavailable", "Every lane is already correct: submit the grid.");
          if (action.tier === HINT_LANE) {
            const sol = bestSolution(state);
            const support = lane.cells.filter((c) => state.lanes.some((o) => o.id !== lane.id && o.cells.includes(c)) && entryAt(state, c) === sol[c]).length;
            const text = `Try ${lane.label} (${lane.length} letters): ${support ? `${plural(support, "of its letters is", "of its letters are")} already supported by crossing answers` : "it crosses the most other lanes"}.`;
            return accept({ ...state, hintLane: lane.id, hints: [...state.hints, { tier: HINT_LANE, text }] }, "hint", text);
          }
          if (action.tier === HINT_LETTER) {
            const sol = bestSolution(state);
            const c = lane.cells.find((x) => entryAt(state, x) !== sol[x])!;
            const next = revealCells(state, [c]);
            const text = `The ${ordinal(lane.cells.indexOf(c) + 1)} letter of ${lane.label} is ${sol[c]}.`;
            return accept({ ...next, hintLane: lane.id, hints: [...state.hints, { tier: HINT_LETTER, text }] }, "hint", `${text} It is filled in and marked as revealed.`);
          }
          if (action.tier === HINT_REVEAL_LANE) return engine.apply(state, { type: "reveal-lane", lane: lane.id });
          return reject(state, "hint-unavailable", "That hint does not exist.");
        }
        default:
          return reject(state, "unknown-action", "Unknown action.");
      }
    },

    hints(state): HintOffer[] {
      const lane = done(state) ? null : hintTarget(state);
      const none = done(state) ? "The round is over." : "Every lane is already correct: submit the grid.";
      const offers: HintOffer[] = [
        {
          tier: HINT_LANE,
          label: "Suggest a lane",
          description: "Points to the unsolved lane whose crossing answers already give it the most support.",
          available: !!lane,
          reason: none,
          reveal: false,
          cost: "Recorded as one hint; no squares change.",
        },
        {
          tier: HINT_LETTER,
          label: "Reveal a letter",
          description: lane ? `Fills in the first wrong or empty square of ${lane.label}.` : "Fills in one square.",
          available: !!lane,
          reason: none,
          reveal: true,
          cost: "That square is marked as revealed and does not count towards your score.",
        },
        {
          tier: HINT_REVEAL_LANE,
          label: "Reveal the lane",
          description: lane ? `Fills in all of ${lane.label}. Shared squares in crossing lanes are filled too.` : "Fills in a whole lane, including shared squares.",
          available: !!lane,
          reason: none,
          reveal: true,
          cost: "Every square it changes is marked as revealed and does not score.",
        },
        {
          tier: HINT_REVEAL_ALL,
          label: "Reveal everything",
          description: "Fills in the whole weave and ends the round as revealed.",
          available: !done(state),
          reason: "The round is over.",
          reveal: true,
          cost: "The round is recorded as revealed, not solved. Squares you already had right still score.",
        },
      ];
      if (state.bank)
        offers.unshift({
          tier: HINT_BANK,
          label: "Word bank",
          description: "Shows every answer in this grid, in alphabetical order, for you to place.",
          available: !state.bankShown && !done(state),
          reason: state.bankShown ? "Already showing." : "The round is over.",
          reveal: false,
          cost: "Recorded as one hint; no squares change.",
        });
      return offers;
    },

    outcome(state): Outcome {
      return state.status === "completed" ? "completed" : state.status === "revealed" ? "revealed" : "playing";
    },

    result(state): ResultSummary | null {
      if (!done(state)) return null;
      const score = scoreOf(state);
      const sol = bestSolution(state);
      const unaided = state.active.filter((c) => !state.revealed.includes(c) && entryAt(state, c) === sol[c]).length;
      const hints = state.hints.filter((h) => h.tier === HINT_LANE || h.tier === HINT_BANK).length + state.checks.length;
      const reveals = state.hints.filter((h) => h.tier === HINT_LETTER || h.tier === HINT_REVEAL_LANE || h.tier === HINT_REVEAL_ALL).length;
      return {
        outcome: state.status === "completed" ? "completed" : "revealed",
        headline:
          state.status === "completed"
            ? state.revealed.length
              ? `Woven, with ${plural(state.revealed.length, "revealed square")}.`
              : "Woven! Every answer solved unaided."
            : `Revealed. You had ${unaided} of ${state.active.length} squares right yourself.`,
        scoreText: `${score} of 100`,
        score,
        maxScore: 100,
        efficiency: score / 100,
        assistance: { hints, reveals },
        details: [
          `${unaided} of ${state.active.length} squares solved unaided (shared squares count once), scoring ${score}.`,
          state.revealed.length ? `${plural(state.revealed.length, "square")} revealed.` : "No squares revealed.",
          state.checks.length ? `${plural(state.checks.length, "lane check")} used.` : "No lane checks used.",
          state.failedSubmits ? `${plural(state.failedSubmits, "earlier submission")} had a wrong square.` : "Correct at the first submission.",
          ...(state.bankShown ? ["The word bank was used."] : []),
        ],
        shareText: `Word Club · Word Weave · ${score}/100 · ${state.lanes.length} lanes${state.status === "revealed" ? " · revealed" : hints + reveals ? ` · ${hints + reveals} helps` : " · unassisted"}`,
        explanation: [...state.lanes.map((l) => `${l.label}: ${laneAnswer(state, l)}. ${l.clue}.`), state.explanation],
      };
    },
  };
  return engine;
}
