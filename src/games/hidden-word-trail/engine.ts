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
import { checkPath, exactCover, geometryFromGrid, spell, toCell, toIndex, type Cell, type Geometry } from "./solver";

export const RULES_VERSION = "1.0";

export interface TrailAnswer {
  word: string;
  /** Reference path, zero-based [row, col] pairs. Other legal routes are accepted too. */
  path: Cell[];
  /** Short definition used by the first hint (optional for pack fixtures). */
  clue?: string;
  /** The answer that names the theme (optional; explained in the result). */
  themeDefining?: boolean;
}

export interface TrailPayload {
  /** Grid rows, each a string of upper-case letters. */
  grid: string[];
  theme: string;
  answers: TrailAnswer[];
  /** Explains the theme-defining answer after completion. */
  themeNote?: string;
  /**
   * "membership": other words of bonusMinLength+ letters from the game's word list earn credits.
   * "none": pack fixtures, whose off-theme lists are deliberately empty.
   */
  bonusPolicy: "membership" | "none";
  bonusMinLength: number;
  /** Distinct bonus words needed to earn one hint. */
  creditsPerHint: number;
  explanation: string;
}

export interface FoundAnswer {
  word: string;
  path: number[];
  assisted: boolean;
}

export interface TrailHint {
  tier: number;
  text: string;
  word: string;
  /** Paid for with bonus-word credits rather than counted as assistance. */
  earned: boolean;
}

export interface TrailState {
  rows: number;
  cols: number;
  letters: string[];
  theme: string;
  themeNote: string | null;
  explanation: string;
  answers: { word: string; clue: string | null; themeDefining: boolean; refPath: number[] }[];
  bonusPolicy: TrailPayload["bonusPolicy"];
  bonusMinLength: number;
  creditsPerHint: number;
  found: FoundAnswer[];
  bonus: string[];
  tokensSpent: number;
  hintFocus: { word: string; path: number[] } | null;
  hintLevel: number;
  hints: TrailHint[];
  revealedAll: boolean;
}

export type TrailAction =
  | { type: "submit"; path: number[] }
  | { type: "hint"; tier: number }
  | { type: "reveal-all" };

export const HINT_START = 1;
export const HINT_HALF = 2;
export const HINT_REVEAL = 3;
export const HINT_REVEAL_ALL = 4;
export const MIN_PATH = 3;

export const geometryOf = (s: Pick<TrailState, "rows" | "cols" | "letters">): Geometry => ({ rows: s.rows, cols: s.cols, letters: s.letters });
export const solvedCells = (s: Pick<TrailState, "found">) => new Set(s.found.flatMap((f) => f.path));
export const remainingWords = (s: Pick<TrailState, "answers" | "found">) => s.answers.map((a) => a.word).filter((w) => !s.found.some((f) => f.word === w));
export const tokensEarned = (s: Pick<TrailState, "bonus" | "creditsPerHint">) => Math.floor(s.bonus.length / Math.max(1, s.creditsPerHint));
export const tokensAvailable = (s: TrailState) => tokensEarned(s) - s.tokensSpent;
export const complete = (s: Pick<TrailState, "answers" | "found">) => s.answers.every((a) => s.found.some((f) => f.word === a.word));

export function cellLabel(s: Pick<TrailState, "cols" | "letters">, i: number): string {
  const [r, c] = toCell(s, i);
  return `${s.letters[i]} (row ${r + 1}, column ${c + 1})`;
}

/** Whether the remaining answers can still tile the unsolved cells, optionally after placing `path`. */
export function feasibleAfter(s: TrailState, path: number[] | null, word: string | null): boolean {
  const blocked = solvedCells(s);
  if (path) for (const i of path) blocked.add(i);
  const rest = remainingWords(s).filter((w) => w !== word);
  return exactCover(geometryOf(s), rest, blocked, 1).count > 0;
}

function describeProblem(s: TrailState, path: number[], code: string, at: number): string {
  switch (code) {
    case "empty":
      return "Choose some squares first.";
    case "out-of-bounds":
      return "That square is not on the grid.";
    case "repeated-cell":
      return `A square cannot be used twice in one trail (${cellLabel(s, path[at])}).`;
    case "not-adjacent":
      return `${cellLabel(s, path[at])} does not touch ${cellLabel(s, path[at - 1])}. Each step must move to a neighbouring square, including diagonals.`;
    case "uses-solved":
      return `${cellLabel(s, path[at])} already belongs to a found word. Trails cannot overlap found words.`;
    default:
      return "That trail is not allowed.";
  }
}

export function createHiddenWordTrailEngine(membership: ReadonlySet<string>): GameEngine<TrailPayload, TrailState, TrailAction, number[]> {
  function analyse(s: TrailState, path: number[]): Analysis {
    if (!Array.isArray(path) || path.some((i) => typeof i !== "number")) return { legal: false, code: "bad-path", message: "That trail could not be read." };
    const problem = checkPath(geometryOf(s), path, solvedCells(s));
    if (problem) return { legal: false, code: problem.code, message: describeProblem(s, path, problem.code, problem.at) };
    const word = spell(geometryOf(s), path);
    if (path.length < MIN_PATH) return { legal: false, code: "too-short", message: `Trails need at least ${MIN_PATH} squares; ${word} has ${path.length}.` };
    return { legal: true, code: "ok", message: `Trail spells ${word}.` };
  }

  /** The answer the hint ladder is about: kept stable while it is still part of a feasible solution. */
  function focusFor(s: TrailState): { word: string; path: number[] } | null {
    if (complete(s)) return null;
    const blocked = solvedCells(s);
    if (s.hintFocus && !s.found.some((f) => f.word === s.hintFocus!.word)) {
      const f = s.hintFocus;
      if (f.path.every((i) => !blocked.has(i)) && feasibleAfter(s, f.path, f.word)) return f;
    }
    const rest = remainingWords(s);
    const cover = exactCover(geometryOf(s), rest, blocked, 1);
    if (!cover.first) return null;
    // Prefer the reference route when it is still free; never lead with the theme-defining answer.
    const order = s.answers
      .filter((a) => rest.includes(a.word))
      .sort((a, b) => Number(a.themeDefining) - Number(b.themeDefining) || a.word.length - b.word.length || s.answers.indexOf(a) - s.answers.indexOf(b));
    const pick = order[0];
    const refFree = pick.refPath.every((i) => !blocked.has(i)) && feasibleAfter(s, pick.refPath, pick.word);
    return { word: pick.word, path: refFree ? pick.refPath : cover.first.get(pick.word)! };
  }

  function placeReveal(s: TrailState, focus: { word: string; path: number[] }): TrailState {
    return { ...s, found: [...s.found, { word: focus.word, path: focus.path, assisted: true }], hintFocus: null, hintLevel: 0 };
  }

  const engine: GameEngine<TrailPayload, TrailState, TrailAction, number[]> = {
    gameId: "hidden-word-trail",
    rulesVersion: RULES_VERSION,

    initialise(round: TrailPayload, _options: SessionOptions): TrailState {
      void _options;
      const geo = geometryFromGrid(round.grid);
      return {
        rows: geo.rows,
        cols: geo.cols,
        letters: geo.letters,
        theme: round.theme,
        themeNote: round.themeNote ?? null,
        explanation: round.explanation,
        answers: round.answers.map((a) => ({
          word: a.word.toUpperCase(),
          clue: a.clue ?? null,
          themeDefining: !!a.themeDefining,
          refPath: a.path.map((c) => toIndex(geo, c)),
        })),
        bonusPolicy: round.bonusPolicy,
        bonusMinLength: round.bonusMinLength,
        creditsPerHint: round.creditsPerHint,
        found: [],
        bonus: [],
        tokensSpent: 0,
        hintFocus: null,
        hintLevel: 0,
        hints: [],
        revealedAll: false,
      };
    },

    preview(state, draft) {
      return analyse(state, draft);
    },

    apply(state, action): Transition<TrailState> {
      if (complete(state) && action.type !== "hint") return reject(state, "complete", "Every theme word is already found.");
      switch (action.type) {
        case "submit": {
          const a = analyse(state, action.path);
          if (!a.legal) return reject(state, a.code, a.message);
          const path = [...action.path];
          const word = spell(geometryOf(state), path);
          const target = state.answers.find((t) => t.word === word);
          if (target) {
            if (state.found.some((f) => f.word === word)) return reject(state, "duplicate", `You have already found ${word}.`);
            if (!feasibleAfter(state, path, word))
              return reject(
                state,
                "blocks-others",
                `${word} is a theme word, but this route would leave squares that the remaining theme words cannot fill. Try another route for ${word}.`,
              );
            const found = [...state.found, { word, path, assisted: false }];
            const focusCleared = state.hintFocus?.word === word;
            const next: TrailState = { ...state, found, hintFocus: focusCleared ? null : state.hintFocus, hintLevel: focusCleared ? 0 : state.hintLevel };
            const done = complete(next);
            const themeLine = target.themeDefining ? " It names the theme." : "";
            return accept(next, done ? "complete" : "found", `${word} found.${themeLine}${done ? " Every square is covered: puzzle complete!" : ` ${plural(remainingWords(next).length, "theme word")} to go.`}`);
          }
          if (state.bonusPolicy === "none")
            return reject(state, "not-theme", `${word} is not one of this round's theme words. This demo round has no bonus words.`);
          if (word.length < state.bonusMinLength)
            return reject(state, "not-theme", `${word} is not a theme word. Bonus words need at least ${state.bonusMinLength} letters.`);
          if (!membership.has(word)) return reject(state, "not-a-word", `${word} is not a theme word, and it is not in the game's word list.`);
          if (state.bonus.includes(word)) return reject(state, "bonus-duplicate", `${word} already earned its bonus credit. Each bonus word counts once.`);
          const bonus = [...state.bonus, word];
          const next = { ...state, bonus };
          const earnedNow = tokensEarned(next) > tokensEarned(state);
          const toGo = state.creditsPerHint - (bonus.length % state.creditsPerHint);
          return accept(
            next,
            earnedNow ? "bonus-hint" : "bonus",
            `${word} is a real word but not a theme word: one bonus credit.${earnedNow ? " You have earned a free hint!" : ` ${plural(toGo, "more bonus word")} earns a free hint.`}`,
          );
        }
        case "hint": {
          if (action.tier === HINT_REVEAL_ALL) {
            if (complete(state)) return reject(state, "hint-unavailable", "Every theme word is already found.");
            let s: TrailState = state;
            let guard = 0;
            while (!complete(s) && guard++ < 50) {
              const f = focusFor(s);
              if (!f) break;
              s = placeReveal(s, f);
            }
            if (!complete(s)) return reject(state, "hint-unavailable", "The remaining words could not be placed.");
            const n = s.found.length - state.found.length;
            return accept(
              { ...s, revealedAll: true, hints: [...state.hints, { tier: HINT_REVEAL_ALL, text: `Revealed the last ${plural(n, "theme word")}.`, word: "" }] as TrailHint[] },
              "revealed-all",
              `Revealed the remaining ${plural(n, "theme word")}. The round is marked as revealed.`,
            );
          }
          const focus = focusFor(state);
          if (!focus) return reject(state, "hint-unavailable", "Every theme word is already found.");
          const level = state.hintFocus?.word === focus.word ? state.hintLevel : 0;
          const pay = (s: TrailState) => {
            const earned = tokensAvailable(state) > 0;
            return { earned, tokensSpent: s.tokensSpent + (earned ? 1 : 0) };
          };
          if (action.tier === HINT_START) {
            if (level >= 1) return reject(state, "hint-unavailable", "You already have the starting square for this word.");
            const ans = state.answers.find((a) => a.word === focus.word)!;
            const text = `A ${focus.word.length}-letter theme word starts at ${cellLabel(state, focus.path[0])}.${ans.clue ? ` Clue: ${ans.clue}.` : ""}`;
            const { earned, tokensSpent } = pay(state);
            return accept(
              { ...state, tokensSpent, hintFocus: focus, hintLevel: 1, hints: [...state.hints, { tier: HINT_START, text, word: focus.word, earned }] },
              "hint",
              `${text}${earned ? " (Paid for with bonus credits.)" : ""}`,
            );
          }
          if (action.tier === HINT_HALF) {
            if (level < 1) return reject(state, "hint-unavailable", "Take the starting-square hint first.");
            if (level >= 2) return reject(state, "hint-unavailable", "You already have the first half of this trail.");
            const half = focus.path.slice(0, Math.ceil(focus.word.length / 2));
            const text = `The ${focus.word.length}-letter word begins ${half.map((i) => state.letters[i]).join("")}: ${half.map((i) => cellLabel(state, i)).join(", then ")}.`;
            const { earned, tokensSpent } = pay(state);
            return accept(
              { ...state, tokensSpent, hintFocus: focus, hintLevel: 2, hints: [...state.hints, { tier: HINT_HALF, text, word: focus.word, earned }] },
              "hint",
              `${text}${earned ? " (Paid for with bonus credits.)" : ""}`,
            );
          }
          if (action.tier === HINT_REVEAL) {
            const next = placeReveal(state, focus);
            const done = complete(next);
            return accept(
              { ...next, hints: [...state.hints, { tier: HINT_REVEAL, text: `Revealed ${focus.word}.`, word: focus.word, earned: false }] },
              done ? "complete" : "revealed",
              `Revealed ${focus.word} (marked as assisted).${done ? " Every square is covered." : ""}`,
            );
          }
          return reject(state, "hint-unavailable", "That hint does not exist.");
        }
        case "reveal-all":
          return engine.apply(state, { type: "hint", tier: HINT_REVEAL_ALL });
        default:
          return reject(state, "unknown-action", "Unknown action.");
      }
    },

    hints(state): HintOffer[] {
      const done = complete(state);
      const focus = done ? null : focusFor(state);
      const level = focus && state.hintFocus?.word === focus.word ? state.hintLevel : 0;
      const tokens = tokensAvailable(state);
      const cost = tokens > 0 ? `Paid for with bonus credits (${tokens} free ${tokens === 1 ? "hint" : "hints"} available), so it does not count as help.` : "Recorded as one hint in your result.";
      return [
        {
          tier: HINT_START,
          label: "Starting square",
          description: "Marks the first square and length of a theme word you have not found, with a short clue where the round has one.",
          available: !!focus && level < 1,
          reason: !focus ? "Every theme word is found." : "Already taken for the current word.",
          reveal: false,
          cost,
        },
        {
          tier: HINT_HALF,
          label: "Half the trail",
          description: "Marks the first half of that word's trail, square by square.",
          available: !!focus && level === 1,
          reason: !focus ? "Every theme word is found." : level < 1 ? "Take the starting square first." : "Already taken for the current word.",
          reveal: false,
          cost,
        },
        {
          tier: HINT_REVEAL,
          label: "Reveal the word",
          description: focus ? `Places ${level ? "the hinted" : "a"} theme word on the grid for you.` : "Places a theme word on the grid.",
          available: !!focus,
          reason: "Every theme word is found.",
          reveal: true,
          cost: "The word is marked as revealed in your result.",
        },
        {
          tier: HINT_REVEAL_ALL,
          label: "Reveal everything",
          description: "Places every remaining theme word and ends the round as revealed.",
          available: !done,
          reason: "Every theme word is found.",
          reveal: true,
          cost: "The round is recorded as revealed rather than solved.",
        },
      ];
    },

    outcome(state): Outcome {
      if (!complete(state)) return "playing";
      return state.revealedAll ? "revealed" : "completed";
    },

    result(state): ResultSummary | null {
      if (!complete(state)) return null;
      const total = state.answers.length;
      const assisted = state.found.filter((f) => f.assisted);
      const unaided = total - assisted.length;
      const freeHints = state.hints.filter((h) => (h.tier === HINT_START || h.tier === HINT_HALF) && !h.earned).length;
      const earnedHints = state.hints.filter((h) => h.earned).length;
      const themeWord = state.answers.find((a) => a.themeDefining);
      const outcome = state.revealedAll ? "revealed" : "completed";
      return {
        outcome,
        headline: state.revealedAll
          ? `Revealed. You found ${unaided} of ${total} theme words yourself.`
          : assisted.length
            ? `Every square covered, with ${plural(assisted.length, "word")} revealed.`
            : "Every square covered. Trail complete!",
        scoreText: `${unaided} of ${total} theme words found unaided`,
        score: unaided,
        maxScore: total,
        efficiency: null,
        assistance: { hints: freeHints, reveals: assisted.length },
        details: [
          `${unaided} of ${total} theme words traced yourself${assisted.length ? `; revealed: ${assisted.map((a) => a.word).join(", ")}` : ""}.`,
          `All ${state.letters.length} squares covered exactly once.`,
          state.bonusPolicy === "none"
            ? "This demo round has no bonus words."
            : state.bonus.length
              ? `${plural(state.bonus.length, "bonus word")} found (${state.bonus.join(", ")}), earning ${plural(tokensEarned(state), "free hint")}.`
              : "No bonus words found. Other real words of four or more letters would have earned free hints.",
          freeHints || earnedHints ? `Hints: ${freeHints} counted as help, ${earnedHints} paid for with bonus credits.` : "No hints used.",
        ],
        shareText: `Word Club · Hidden Word Trail · ${unaided}/${total} theme words${assisted.length ? `, ${assisted.length} revealed` : ""}${freeHints ? ` · ${plural(freeHints, "hint")}` : ""}${!assisted.length && !freeHints ? " · unassisted" : ""}`,
        explanation: [
          `Theme: ${state.theme}. Answers: ${state.answers.map((a) => a.word).join(", ")}.`,
          ...(themeWord && state.themeNote ? [state.themeNote] : []),
          state.explanation,
        ],
      };
    },
  };
  return engine;
}
