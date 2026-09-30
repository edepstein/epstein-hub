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
import { fitsMultiset, normaliseWord, plural } from "@/lib/text";
import { createRng } from "@/lib/rng";

export const RULES_VERSION = "1.0";

export interface WheelPayload {
  /** Nine physical letter positions, upper-case, in authored display order. */
  letters: string[];
  /** Index into letters of the required (centre) position. */
  requiredIndex: number;
  minimumLength: number;
  /** Curated everyday target words (the completion denominator). Upper-case. */
  targets: string[];
  /** Nine-letter answers known to exist on this rack. */
  nineLetterAnswers: string[];
  /** Pack demo fixtures only: the original finite lexicon and its stored maximum score (regression data). */
  fixtureLexicon?: string[];
  fixtureMaximumScore?: number;
  explanation: string;
}

export interface FoundWord {
  word: string;
  points: number;
  assisted: boolean;
  target: boolean;
}

export interface HintRecord {
  tier: number;
  text: string;
  word: string;
}

export interface WheelState {
  letters: string[];
  requiredIndex: number;
  required: string;
  minimumLength: number;
  targets: string[];
  nineLetterAnswers: string[];
  /** Every acceptable word for this rack under the pinned membership (sorted). */
  lexicon: string[];
  maxScore: number;
  /** Display permutation of physical positions (presentation only). */
  order: number[];
  found: FoundWord[];
  hintFocus: string | null;
  hintLevel: number;
  hints: HintRecord[];
  nineNudgeTaken: boolean;
  finished: boolean;
  explanation: string;
}

export type WheelAction =
  | { type: "submit"; word: string }
  | { type: "shuffle"; order: number[] }
  | { type: "hint"; tier: number }
  | { type: "finish" }
  | { type: "resume" };

export const HINT_START = 1;
export const HINT_HALF = 2;
export const HINT_REVEAL = 3;
export const HINT_NINE = 9;

export function scoreWord(word: string): number {
  return word.length + (word.length === 9 ? 9 : 0);
}

/** Which physical positions a draft consumes (greedy, preferring non-required duplicates last). */
export function positionsUsed(letters: string[], draft: string): { used: boolean[]; unavailable: string | null } {
  const used = letters.map(() => false);
  for (const ch of draft.toUpperCase()) {
    const i = letters.findIndex((l, idx) => l === ch && !used[idx]);
    if (i < 0) return { used, unavailable: ch };
    used[i] = true;
  }
  return { used, unavailable: null };
}

function isTarget(state: Pick<WheelState, "targets">, w: string) {
  return state.targets.includes(w);
}

export function createLetterWheelEngine(membership: ReadonlySet<string>): GameEngine<WheelPayload, WheelState, WheelAction, string> {
  function analyse(state: WheelState, raw: string): Analysis {
    const { word, problem } = normaliseWord(raw);
    if (problem === "empty") return { legal: false, code: "empty", message: "Type or tap some letters first." };
    if (problem === "non-letters")
      return { legal: false, code: "non-letters", message: "Use letters A to Z only. Spaces, hyphens and apostrophes are not accepted." };
    if (word.length < state.minimumLength)
      return { legal: false, code: "too-short", message: `Words need at least ${state.minimumLength} letters; ${word} has ${word.length}.` };
    if (!word.includes(state.required))
      return { legal: false, code: "missing-required", message: `Every word must include the centre letter ${state.required}.` };
    const { unavailable } = positionsUsed(state.letters, word);
    if (unavailable) {
      const onRack = state.letters.filter((l) => l === unavailable).length;
      const msg =
        onRack === 0
          ? `${unavailable} is not on the wheel.`
          : `The wheel has only ${onRack} ${unavailable}${onRack === 1 ? "" : "s"}, and each letter can be used once per word.`;
      return { legal: false, code: "letter-unavailable", message: msg };
    }
    if (state.found.some((f) => f.word === word)) return { legal: false, code: "duplicate", message: `You have already found ${word}.` };
    if (!state.lexicon.includes(word))
      return { legal: false, code: "not-in-word-list", message: `${word} is not in this game's word list. Names, abbreviations and some rare words are excluded.` };
    const pts = scoreWord(word);
    return {
      legal: true,
      code: "ok",
      message: `${word} would score ${pts}.`,
      score: { lines: [{ label: `${word.length} letters`, points: word.length }, ...(word.length === 9 ? [{ label: "Nine-letter bonus", points: 9 }] : [])], total: pts },
    };
  }

  function focusWord(state: WheelState): string | null {
    if (state.hintFocus && !state.found.some((f) => f.word === state.hintFocus)) return state.hintFocus;
    const remaining = state.targets
      .filter((t) => !state.found.some((f) => f.word === t))
      .sort((a, b) => a.length - b.length || a.localeCompare(b));
    return remaining[0] ?? null;
  }

  const targetsComplete = (s: WheelState) => s.targets.every((t) => s.found.some((f) => f.word === t));

  const engine: GameEngine<WheelPayload, WheelState, WheelAction, string> = {
    gameId: "letter-wheel",
    rulesVersion: RULES_VERSION,

    initialise(round: WheelPayload, options: SessionOptions): WheelState {
      const letters = round.letters.map((l) => l.toUpperCase());
      const required = letters[round.requiredIndex];
      const targets = round.targets.map((w) => w.toUpperCase());
      const lexiconSet = new Set<string>();
      for (const w of membership) {
        if (w.length >= round.minimumLength && w.length <= letters.length && w.includes(required) && fitsMultiset(w, letters)) lexiconSet.add(w);
      }
      for (const t of targets) lexiconSet.add(t);
      const lexicon = [...lexiconSet].sort();
      return {
        letters,
        requiredIndex: round.requiredIndex,
        required,
        minimumLength: round.minimumLength,
        targets,
        nineLetterAnswers: round.nineLetterAnswers.map((w) => w.toUpperCase()),
        lexicon,
        maxScore: lexicon.reduce((s, w) => s + scoreWord(w), 0),
        // Seeded presentation order so the nine-letter answer is never displayed in reading order.
        order: createRng(options.seed).shuffle(letters.map((_, i) => i)),
        found: [],
        hintFocus: null,
        hintLevel: 0,
        hints: [],
        nineNudgeTaken: false,
        finished: false,
        explanation: round.explanation,
      };
    },

    preview(state, draft) {
      return analyse(state, draft);
    },

    apply(state, action): Transition<WheelState> {
      switch (action.type) {
        case "submit": {
          const a = analyse(state, action.word);
          if (!a.legal) return reject(state, a.code, a.message);
          const word = normaliseWord(action.word).word;
          const pts = scoreWord(word);
          const found = [...state.found, { word, points: pts, assisted: false, target: isTarget(state, word) }];
          const next: WheelState = { ...state, found, hintFocus: state.hintFocus === word ? null : state.hintFocus, hintLevel: state.hintFocus === word ? 0 : state.hintLevel };
          const completedNow = !targetsComplete(state) && targetsComplete(next);
          const bonus = word.length === 9 ? " including the nine-letter bonus" : "";
          const kind = isTarget(state, word) ? "" : " A bonus word beyond the everyday list.";
          return accept(next, completedNow ? "targets-complete" : "accepted", `${word} scores ${pts}${bonus}.${kind}${completedNow ? " You have found every everyday word!" : ""}`, {
            score: a.score,
          });
        }
        case "shuffle": {
          const o = action.order;
          const valid = Array.isArray(o) && o.length === state.letters.length && [...o].sort((x, y) => x - y).every((v, i) => v === i);
          if (!valid) return reject(state, "bad-order", "That arrangement is not a rearrangement of the nine letters.");
          return accept({ ...state, order: [...o] }, "shuffled", "Letters rearranged. The words available are unchanged.");
        }
        case "hint": {
          if (action.tier === HINT_NINE) {
            if (state.found.some((f) => f.word.length === 9)) return reject(state, "hint-unavailable", "You have already found a nine-letter word.");
            if (state.nineNudgeTaken) return reject(state, "hint-unavailable", "You have already taken the nine-letter nudge.");
            const nine = state.nineLetterAnswers[0];
            if (!nine) return reject(state, "hint-unavailable", "This wheel has no listed nine-letter answer.");
            const text = `A nine-letter answer starts with ${nine[0]}.`;
            return accept({ ...state, nineNudgeTaken: true, hints: [...state.hints, { tier: HINT_NINE, text, word: nine }] }, "hint", text);
          }
          const focus = focusWord(state);
          if (!focus) return reject(state, "hint-unavailable", "Every everyday word is already found.");
          const level = state.hintFocus === focus ? state.hintLevel : 0;
          if (action.tier === HINT_START) {
            if (level >= 1) return reject(state, "hint-unavailable", "You already have the starting letter for this word.");
            const text = `An everyday word of ${focus.length} letters starts with ${focus[0]}.`;
            return accept({ ...state, hintFocus: focus, hintLevel: 1, hints: [...state.hints, { tier: HINT_START, text, word: focus }] }, "hint", text);
          }
          if (action.tier === HINT_HALF) {
            if (level < 1) return reject(state, "hint-unavailable", "Take the starting-letter hint first.");
            if (level >= 2) return reject(state, "hint-unavailable", "You already have the first half of this word.");
            const half = focus.slice(0, Math.ceil(focus.length / 2));
            const text = `The ${focus.length}-letter word starts ${half}${"·".repeat(focus.length - half.length)}.`;
            return accept({ ...state, hintFocus: focus, hintLevel: 2, hints: [...state.hints, { tier: HINT_HALF, text, word: focus }] }, "hint", text);
          }
          if (action.tier === HINT_REVEAL) {
            const found = [...state.found, { word: focus, points: 0, assisted: true, target: true }];
            const next = { ...state, found, hintFocus: null, hintLevel: 0, hints: [...state.hints, { tier: HINT_REVEAL, text: `Revealed ${focus} (scores 0).`, word: focus }] };
            const completedNow = targetsComplete(next);
            return accept(next, completedNow ? "targets-complete" : "revealed", `Revealed ${focus}. It counts towards completion but scores 0.${completedNow ? " That completes the everyday words." : ""}`);
          }
          return reject(state, "hint-unavailable", "That hint does not exist.");
        }
        case "finish":
          if (state.finished) return reject(state, "already-finished", "This round is already finished.");
          return accept({ ...state, finished: true }, "finished", "Round finished. You can keep playing if you change your mind.");
        case "resume":
          if (!state.finished) return reject(state, "not-finished", "The round is still open.");
          return accept({ ...state, finished: false }, "resumed", "Back to the wheel.");
        default:
          return reject(state, "unknown-action", "Unknown action.");
      }
    },

    hints(state): HintOffer[] {
      const focus = focusWord(state);
      const level = focus && state.hintFocus === focus ? state.hintLevel : 0;
      const offers: HintOffer[] = [
        {
          tier: HINT_START,
          label: "Starting letter",
          description: "Shows the first letter and length of one everyday word you have not found.",
          available: !!focus && level < 1,
          reason: !focus ? "Every everyday word is found." : "Already taken for the current word.",
          reveal: false,
          cost: "No points lost; the result records one hint.",
        },
        {
          tier: HINT_HALF,
          label: "First half",
          description: "Shows the first half of that same word.",
          available: !!focus && level === 1,
          reason: !focus ? "Every everyday word is found." : level < 1 ? "Take the starting letter first." : "Already taken for the current word.",
          reveal: false,
          cost: "No points lost; the result records one hint.",
        },
        {
          tier: HINT_REVEAL,
          label: "Reveal a word",
          description: focus ? `Adds the ${level ? "hinted" : "shortest unfound"} everyday word to your list.` : "Adds an everyday word to your list.",
          available: !!focus,
          reason: "Every everyday word is found.",
          reveal: true,
          cost: "The revealed word scores 0 but counts towards completion.",
        },
      ];
      if (state.nineLetterAnswers.length) {
        offers.push({
          tier: HINT_NINE,
          label: "Nine-letter nudge",
          description: "Shows the first letter of a nine-letter answer.",
          available: !state.nineNudgeTaken && !state.found.some((f) => f.word.length === 9),
          reason: "Already taken, or a nine-letter word is found.",
          reveal: false,
          cost: "No points lost; the result records one hint.",
        });
      }
      return offers;
    },

    outcome(state): Outcome {
      if (targetsComplete(state)) return "completed";
      if (state.finished) return "abandoned";
      return "playing";
    },

    result(state): ResultSummary | null {
      const done = targetsComplete(state);
      if (!done && !state.finished) return null;
      const score = state.found.reduce((s, f) => s + f.points, 0);
      const targetFound = state.found.filter((f) => f.target).length;
      const revealed = state.found.filter((f) => f.assisted).length;
      const bonus = state.found.filter((f) => !f.target).length;
      const nineFound = state.found.find((f) => f.word.length === 9 && !f.assisted);
      const hints = state.hints.filter((h) => h.tier !== HINT_REVEAL).length;
      const missed = state.targets.filter((t) => !state.found.some((f) => f.word === t));
      const unexplored = state.lexicon.length - state.found.length;
      return {
        outcome: done ? "completed" : "abandoned",
        headline: done
          ? revealed
            ? `Every everyday word found, ${revealed} with help.`
            : "Every everyday word found."
          : `You found ${targetFound} of ${state.targets.length} everyday words.`,
        scoreText: `${score} points`,
        score,
        maxScore: state.maxScore,
        efficiency: null,
        assistance: { hints, reveals: revealed },
        details: [
          `${targetFound} of ${state.targets.length} everyday words${revealed ? ` (${revealed} revealed, scoring 0)` : ""}.`,
          bonus ? `${plural(bonus, "bonus word")} beyond the everyday list.` : "No bonus words beyond the everyday list yet.",
          nineFound ? `Nine-letter word found: ${nineFound.word} (+9 bonus).` : "The nine-letter word is still waiting.",
          `${plural(unexplored, "accepted word")} left unexplored in the full word list (maximum ${state.maxScore} points).`,
          ...(done ? ["You can keep finding bonus words; the result updates as you go."] : []),
        ],
        shareText: `Word Club · Letter Wheel · ${targetFound}/${state.targets.length} everyday words · ${score} pts${hints + revealed ? ` · ${hints} hint${hints === 1 ? "" : "s"}, ${revealed} revealed` : " · unassisted"}`,
        explanation: [state.explanation, ...(missed.length ? [`Everyday words not found: ${missed.join(", ")}.`] : []), `Nine-letter answers: ${state.nineLetterAnswers.join(", ")}.`],
      };
    },
  };
  return engine;
}
