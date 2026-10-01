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
import { normaliseWord, plural } from "@/lib/text";
import { createRng } from "@/lib/rng";

/**
 * Letter Set (games/letter-set.md, upgrades/letter-set.md).
 * Seven different letters, one required. Words of 4+ letters using only those letters,
 * each letter repeatable without limit. All-letter words use every letter at least once.
 * Validation order (brief): length, permitted characters, required letter, membership, duplicate.
 */
export const RULES_VERSION = "1.0";
export const ALL_LETTER_BONUS = 7;

export interface TargetWord {
  word: string;
  /** Original short definition shown by the definition hint and after a reveal. */
  clue?: string;
}

export interface SetPayload {
  /** Seven different upper-case letters, including the required letter. */
  letters: string[];
  required: string;
  minimumLength: number;
  /** Curated everyday targets: the completion denominator. */
  targets: TargetWord[];
  /** "everyday" (default) or "target" (Master). Used in player-facing text. */
  wordLabel?: "everyday" | "target";
  /** Targets that use every letter (must equal the computed coverage set). */
  allLetterTargets: string[];
  /** Pack demo fixtures only: finite lexicon and stored totals kept as regression data. */
  fixtureLexicon?: string[];
  fixtureAllLetterAnswers?: string[];
  fixtureMaximumScore?: number;
  explanation: string;
}

export interface FoundWord {
  word: string;
  points: number;
  assisted: boolean;
  target: boolean;
  allLetter: boolean;
}

export interface HintRecord {
  tier: number;
  text: string;
  word: string;
}

export interface SetState {
  letters: string[];
  required: string;
  /** Display order of the six outer letters (indices into letters, never the required one). */
  outer: number[];
  minimumLength: number;
  targets: string[];
  wordLabel: "everyday" | "target";
  clues: Record<string, string>;
  allLetterTargets: string[];
  /** Every acceptable word for this board under the pinned membership (sorted). */
  lexicon: string[];
  allLetterWords: string[];
  maxScore: number;
  targetMaxScore: number;
  found: FoundWord[];
  hintFocus: string | null;
  hintLevel: number;
  hints: HintRecord[];
  allLetterNudgeTaken: boolean;
  finished: boolean;
  explanation: string;
}

export type SetAction =
  | { type: "submit"; word: string }
  | { type: "shuffle"; order: number[] }
  | { type: "hint"; tier: number }
  | { type: "finish" }
  | { type: "resume" };

export const HINT_START = 1;
export const HINT_DEFINITION = 2;
export const HINT_REVEAL = 3;
export const HINT_ALL_LETTER = 9;

export function usesAllLetters(word: string, letters: readonly string[]): boolean {
  return letters.every((l) => word.includes(l));
}

export function scoreWord(word: string, letters: readonly string[]): number {
  const base = word.length === 4 ? 1 : word.length;
  return base + (usesAllLetters(word, letters) ? ALL_LETTER_BONUS : 0);
}

export function scoreLines(word: string, letters: readonly string[]) {
  const lines = [{ label: word.length === 4 ? "Four-letter word" : `${word.length} letters`, points: word.length === 4 ? 1 : word.length }];
  if (usesAllLetters(word, letters)) lines.push({ label: "All-letter bonus", points: ALL_LETTER_BONUS });
  return lines;
}

/** True when every character of word is one of the letters (repeats allowed). */
export function fitsSet(word: string, letters: readonly string[]): boolean {
  for (const ch of word) if (!letters.includes(ch)) return false;
  return true;
}

export function createLetterSetEngine(membership: ReadonlySet<string>): GameEngine<SetPayload, SetState, SetAction, string> {
  function analyse(state: SetState, raw: string): Analysis {
    const { word, problem } = normaliseWord(raw);
    if (problem === "empty") return { legal: false, code: "empty", message: "Type or tap some letters first." };
    if (problem === "non-letters")
      return { legal: false, code: "non-letters", message: "Use letters A to Z only. Spaces, hyphens and apostrophes are not accepted." };
    if (word.length < state.minimumLength)
      return { legal: false, code: "too-short", message: `Words need at least ${state.minimumLength} letters; ${word} has ${word.length}.` };
    const foreign = [...new Set(word)].filter((ch) => !state.letters.includes(ch));
    if (foreign.length)
      return {
        legal: false,
        code: "letter-unavailable",
        message: `${foreign.join(" and ")} ${foreign.length === 1 ? "is" : "are"} not in this set. Use only ${listLetters(state.letters)}.`,
      };
    if (!word.includes(state.required)) return { legal: false, code: "missing-required", message: `This word needs ${state.required}. Every word must include the required letter.` };
    if (!state.lexicon.includes(word))
      return { legal: false, code: "not-in-word-list", message: `${word} is not in this game's word list. Names, abbreviations and some rare words are excluded.` };
    if (state.found.some((f) => f.word === word)) return { legal: false, code: "duplicate", message: `Already found: ${word} is in your list.` };
    const pts = scoreWord(word, state.letters);
    return { legal: true, code: "ok", message: `${word} would score ${pts}.`, score: { lines: scoreLines(word, state.letters), total: pts } };
  }

  function focusWord(state: SetState): string | null {
    if (state.hintFocus && !state.found.some((f) => f.word === state.hintFocus)) return state.hintFocus;
    const remaining = state.targets.filter((t) => !state.found.some((f) => f.word === t)).sort((a, b) => a.length - b.length || a.localeCompare(b));
    return remaining[0] ?? null;
  }

  const targetsComplete = (s: SetState) => s.targets.every((t) => s.found.some((f) => f.word === t));

  const engine: GameEngine<SetPayload, SetState, SetAction, string> = {
    gameId: "letter-set",
    rulesVersion: RULES_VERSION,

    initialise(round: SetPayload, options: SessionOptions): SetState {
      const letters = round.letters.map((l) => l.toUpperCase());
      const required = round.required.toUpperCase();
      const targets = round.targets.map((t) => t.word.toUpperCase());
      const lexiconSet = new Set<string>();
      for (const w of membership) {
        if (w.length >= round.minimumLength && w.includes(required) && fitsSet(w, letters)) lexiconSet.add(w);
      }
      for (const t of targets) lexiconSet.add(t);
      const lexicon = [...lexiconSet].sort();
      const outerIdx = letters.map((_, i) => i).filter((i) => letters[i] !== required);
      return {
        letters,
        required,
        outer: createRng(options.seed).shuffle(outerIdx),
        minimumLength: round.minimumLength,
        targets,
        wordLabel: round.wordLabel ?? "everyday",
        clues: Object.fromEntries(round.targets.filter((t) => t.clue).map((t) => [t.word.toUpperCase(), t.clue as string])),
        allLetterTargets: round.allLetterTargets.map((w) => w.toUpperCase()),
        lexicon,
        allLetterWords: lexicon.filter((w) => usesAllLetters(w, letters)),
        maxScore: lexicon.reduce((s, w) => s + scoreWord(w, letters), 0),
        targetMaxScore: targets.reduce((s, w) => s + scoreWord(w, letters), 0),
        found: [],
        hintFocus: null,
        hintLevel: 0,
        hints: [],
        allLetterNudgeTaken: false,
        finished: false,
        explanation: round.explanation,
      };
    },

    preview(state, draft) {
      return analyse(state, draft);
    },

    apply(state, action): Transition<SetState> {
      switch (action.type) {
        case "submit": {
          const a = analyse(state, action.word);
          if (!a.legal) return reject(state, a.code, a.message);
          const word = normaliseWord(action.word).word;
          const pts = scoreWord(word, state.letters);
          const allLetter = usesAllLetters(word, state.letters);
          const target = state.targets.includes(word);
          const found = [...state.found, { word, points: pts, assisted: false, target, allLetter }];
          const clearsFocus = state.hintFocus === word;
          const next: SetState = { ...state, found, hintFocus: clearsFocus ? null : state.hintFocus, hintLevel: clearsFocus ? 0 : state.hintLevel };
          const completedNow = !targetsComplete(state) && targetsComplete(next);
          const parts = [`${word} scores ${pts}.`];
          if (allLetter) parts.push(`All-letter word! It uses every letter, earning ${ALL_LETTER_BONUS} extra points.`);
          if (!target) parts.push(`A bonus word beyond the ${state.wordLabel} list.`);
          if (completedNow) parts.push(`You have found every ${state.wordLabel} word. Keep going for bonus words if you like.`);
          return accept(next, completedNow ? "targets-complete" : allLetter ? "all-letter" : "accepted", parts.join(" "), { score: a.score });
        }
        case "shuffle": {
          const o = action.order;
          const valid =
            Array.isArray(o) &&
            o.length === state.outer.length &&
            [...o].sort((x, y) => x - y).join(",") === [...state.outer].sort((x, y) => x - y).join(",");
          if (!valid) return reject(state, "bad-order", "That arrangement is not a rearrangement of the six outer letters.");
          return accept({ ...state, outer: [...o] }, "shuffled", `Outer letters rearranged. ${state.required} stays in the middle and the words available are unchanged.`);
        }
        case "hint": {
          if (action.tier === HINT_ALL_LETTER) {
            if (state.found.some((f) => f.allLetter)) return reject(state, "hint-unavailable", "You have already found an all-letter word.");
            if (state.allLetterNudgeTaken) return reject(state, "hint-unavailable", "You have already taken the all-letter nudge.");
            const w = [...state.allLetterTargets].sort((a, b) => a.length - b.length)[0];
            if (!w) return reject(state, "hint-unavailable", "This set has no listed all-letter word.");
            const text = `An all-letter word begins with ${w[0]} and has ${w.length} letters.`;
            return accept({ ...state, allLetterNudgeTaken: true, hints: [...state.hints, { tier: HINT_ALL_LETTER, text, word: w }] }, "hint", text);
          }
          const focus = focusWord(state);
          if (!focus) return reject(state, "hint-unavailable", `Every ${state.wordLabel} word is already found.`);
          const level = state.hintFocus === focus ? state.hintLevel : 0;
          if (action.tier === HINT_START) {
            if (level >= 1) return reject(state, "hint-unavailable", "You already have the length and first letter of this word.");
            const text = `${state.wordLabel === "everyday" ? "An everyday" : "A target"} word of ${focus.length} letters begins with ${focus[0]}.`;
            return accept({ ...state, hintFocus: focus, hintLevel: 1, hints: [...state.hints, { tier: HINT_START, text, word: focus }] }, "hint", text);
          }
          if (action.tier === HINT_DEFINITION) {
            if (level < 1) return reject(state, "hint-unavailable", "Take the length and first letter hint first.");
            if (level >= 2) return reject(state, "hint-unavailable", "You already have the definition of this word.");
            const text = state.clues[focus]
              ? `The ${focus.length}-letter ${focus[0]} word means: ${state.clues[focus]}.`
              : `The ${focus.length}-letter ${focus[0]} word is a familiar one with no separate definition here; it ends with ${focus[focus.length - 1]}.`;
            return accept({ ...state, hintFocus: focus, hintLevel: 2, hints: [...state.hints, { tier: HINT_DEFINITION, text, word: focus }] }, "hint", text);
          }
          if (action.tier === HINT_REVEAL) {
            const allLetter = usesAllLetters(focus, state.letters);
            const found = [...state.found, { word: focus, points: 0, assisted: true, target: true, allLetter }];
            const next: SetState = {
              ...state,
              found,
              hintFocus: null,
              hintLevel: 0,
              hints: [...state.hints, { tier: HINT_REVEAL, text: `Revealed ${focus} (scores 0)${state.clues[focus] ? `: ${state.clues[focus]}` : "."}`, word: focus }],
            };
            const completedNow = targetsComplete(next);
            return accept(
              next,
              completedNow ? "targets-complete" : "revealed",
              `Revealed ${focus}${state.clues[focus] ? `: ${state.clues[focus]}` : ""}. It counts towards the ${state.wordLabel} list but scores 0.${completedNow ? ` That completes the ${state.wordLabel} words.` : ""}`,
            );
          }
          return reject(state, "hint-unavailable", "That hint does not exist.");
        }
        case "finish":
          if (state.finished) return reject(state, "already-finished", "This round is already finished.");
          return accept({ ...state, finished: true }, "finished", "Round finished. You can keep playing if you change your mind.");
        case "resume":
          if (!state.finished) return reject(state, "not-finished", "The round is still open.");
          return accept({ ...state, finished: false }, "resumed", "Back to the garden.");
        default:
          return reject(state, "unknown-action", "Unknown action.");
      }
    },

    hints(state): HintOffer[] {
      const focus = focusWord(state);
      const level = focus && state.hintFocus === focus ? state.hintLevel : 0;
      const none = `Every ${state.wordLabel} word is found.`;
      const offers: HintOffer[] = [
        {
          tier: HINT_START,
          label: "Length and first letter",
          description: `Shows the length and first letter of one ${state.wordLabel} word you have not found.`,
          available: !!focus && level < 1,
          reason: !focus ? none : "Already taken for the current word.",
          reveal: false,
          cost: "No points lost; the result records one hint.",
        },
        {
          tier: HINT_DEFINITION,
          label: "Definition",
          description: "Shows a short definition of that same word.",
          available: !!focus && level === 1,
          reason: !focus ? none : level < 1 ? "Take the length and first letter first." : "Already taken for the current word.",
          reveal: false,
          cost: "No points lost; the result records one hint.",
        },
        {
          tier: HINT_REVEAL,
          label: "Reveal a word",
          description: focus ? `Adds the ${level ? "hinted" : "shortest unfound"} ${state.wordLabel} word to your list, with its definition.` : `Adds an ${state.wordLabel} word to your list.`,
          available: !!focus,
          reason: none,
          reveal: true,
          cost: "The revealed word scores 0 and is marked as revealed, but counts towards completion.",
        },
      ];
      if (state.allLetterTargets.length) {
        offers.push({
          tier: HINT_ALL_LETTER,
          label: "All-letter nudge",
          description: "Shows the first letter and length of an all-letter word.",
          available: !state.allLetterNudgeTaken && !state.found.some((f) => f.allLetter),
          reason: "Already taken, or an all-letter word is found.",
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
      const revealed = state.found.filter((f) => f.assisted);
      const bonus = state.found.filter((f) => !f.target).length;
      const allFound = state.found.filter((f) => f.allLetter && !f.assisted);
      const hints = state.hints.filter((h) => h.tier !== HINT_REVEAL).length;
      const missed = state.targets.filter((t) => !state.found.some((f) => f.word === t));
      const unexplored = state.lexicon.length - state.found.length;
      return {
        outcome: done ? "completed" : "abandoned",
        headline: done
          ? revealed.length
            ? `Every ${state.wordLabel} word found, ${revealed.length} with a reveal.`
            : `Every ${state.wordLabel} word found.`
          : `You found ${targetFound} of ${state.targets.length} ${state.wordLabel} words.`,
        scoreText: `${score} points`,
        score,
        maxScore: state.maxScore,
        efficiency: null,
        assistance: { hints, reveals: revealed.length },
        details: [
          `${targetFound} of ${state.targets.length} ${state.wordLabel} words (the curated list)${revealed.length ? `, ${revealed.length} revealed and scoring 0` : ""}.`,
          allFound.length ? `All-letter ${allFound.length === 1 ? "word" : "words"} found: ${allFound.map((f) => f.word).join(", ")} (+${ALL_LETTER_BONUS} each).` : "No all-letter word found unaided yet.",
          bonus ? `${plural(bonus, "bonus word")} beyond the ${state.wordLabel} list.` : `No bonus words beyond the ${state.wordLabel} list yet.`,
          `All accepted words: ${state.found.length} of ${state.lexicon.length} found; ${plural(unexplored, "accepted word")} left unexplored (maximum ${state.maxScore} points in the full word list).`,
          ...(done ? ["You can keep finding bonus words; the result updates as you go."] : []),
        ],
        shareText: `Word Club · Letter Set · ${targetFound}/${state.targets.length} ${state.wordLabel} words · ${allFound.length ? "all-letter word found · " : ""}${score} pts${hints + revealed.length ? ` · ${hints} hint${hints === 1 ? "" : "s"}, ${revealed.length} revealed` : " · unassisted"}`,
        explanation: [
          state.explanation,
          ...(missed.length ? [`${state.wordLabel === "everyday" ? "Everyday" : "Target"} words not found: ${missed.map((w) => (state.clues[w] ? `${w} (${state.clues[w]})` : w)).join("; ")}.`] : []),
          ...revealed.map((f) => (state.clues[f.word] ? `${f.word} was revealed: ${state.clues[f.word]}.` : `${f.word} was revealed.`)),
          `All-letter words on the ${state.wordLabel} list: ${state.allLetterTargets.join(", ")}.`,
        ],
      };
    },
  };
  return engine;
}

function listLetters(letters: readonly string[]): string {
  const sorted = [...letters].sort();
  return `${sorted.slice(0, -1).join(", ")} and ${sorted[sorted.length - 1]}`;
}
