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
import { letterCounts, normaliseWord, plural } from "@/lib/text";

export const RULES_VERSION = "1.0";

export interface StairRung {
  clue: string;
  length: number;
}

export interface StairPayload {
  /** Supplied first word (upper-case). */
  start: string;
  /** Clued rungs, each exactly one letter shorter than the one before. */
  rungs: StairRung[];
  /** Every complete accepted chain, each beginning with `start`. Branches are separate chains. */
  acceptedChains: string[][];
  /** Gentle rounds show the available letters as tiles from the start. */
  lettersAid: boolean;
  explanation: string;
}

export interface StairHint {
  rung: number;
  tier: number;
  text: string;
}

export interface StairState {
  start: string;
  rungs: StairRung[];
  chains: string[][];
  lettersAid: boolean;
  explanation: string;
  /** Accepted answers, rung by rung (answers[i] answers rungs[i]). */
  answers: string[];
  /** Parallel to answers: true when the rung was filled by a hint rather than solved. */
  revealed: boolean[];
  /** Hint tier already taken for the current rung (0 = none). */
  hintLevel: number;
  hints: StairHint[];
  revisions: number;
  /** The player asked for the whole remaining staircase. */
  gaveUp: boolean;
}

export type StairAction =
  | { type: "submit"; word: string }
  | { type: "revise"; rung: number }
  | { type: "hint"; tier: number };

export const HINT_LETTER = 1;
export const HINT_FIRST = 2;
export const HINT_FILL = 3;
export const HINT_REVEAL_ALL = 4;

const NUMBER_WORD = ["no", "one", "two", "three", "four", "five", "six"];

/** Letters in `word` beyond what `pool` supplies (multiset difference word − pool). */
export function extraLetters(word: string, pool: string): string[] {
  const counts = letterCounts(pool);
  const extra: string[] = [];
  for (const ch of word) {
    const n = counts.get(ch) ?? 0;
    if (n <= 0) extra.push(ch);
    else counts.set(ch, n - 1);
  }
  return extra;
}

/** The single letter removed when `next` is a legal step down from `prev`, else null. */
export function removedLetter(prev: string, next: string): string | null {
  if (next.length !== prev.length - 1) return null;
  if (extraLetters(next, prev).length) return null;
  const left = extraLetters(prev, next);
  return left.length === 1 ? left[0] : null;
}

/**
 * How the survivors rearrange: prev with one occurrence of the removed letter taken out
 * (the occurrence that keeps the survivors closest to the answer's order).
 */
export function describeStep(prev: string, next: string): { removed: string; survivors: string; rearranged: boolean; occurrence: string } {
  const removed = removedLetter(prev, next) ?? "?";
  const positions = [...prev].map((c, i) => (c === removed ? i : -1)).filter((i) => i >= 0);
  let survivors = prev;
  for (const i of positions) {
    const s = prev.slice(0, i) + prev.slice(i + 1);
    survivors = s;
    if (s === next) break;
  }
  const count = positions.length;
  const occurrence = count > 1 ? `one of the ${NUMBER_WORD[count] ?? count} ${removed}s` : removed;
  return { removed, survivors, rearranged: survivors !== next, occurrence };
}

function currentIndex(s: StairState) {
  return s.answers.length;
}

function previousWord(s: StairState, rung: number) {
  return rung === 0 ? s.start : s.answers[rung - 1];
}

/** Accepted answers for `rung` given the player's accepted prefix (branch-aware). */
export function candidates(s: Pick<StairState, "chains" | "start" | "answers">, rung: number): string[] {
  const prefix = [s.start, ...s.answers.slice(0, rung)];
  const out: string[] = [];
  for (const c of s.chains) {
    if (prefix.every((w, i) => c[i] === w)) {
      const w = c[rung + 1];
      if (w && !out.includes(w)) out.push(w);
    }
  }
  return out;
}

/** First accepted chain continuing the player's prefix (used for hints and reveals). */
function continuation(s: StairState): string[] | null {
  const prefix = [s.start, ...s.answers];
  return s.chains.find((c) => prefix.every((w, i) => c[i] === w)) ?? null;
}

export function isFinished(s: StairState) {
  return s.gaveUp || s.answers.length === s.rungs.length;
}

export function scoreOf(s: StairState) {
  const solved = s.revealed.filter((r) => !r).length;
  return Math.round((solved * 100) / s.rungs.length);
}

export function analyseStep(prev: string, raw: string, length: number): Analysis<{ removed: string | null }> {
  const { word, problem } = normaliseWord(raw);
  if (problem === "empty") return { legal: false, code: "empty", message: "Type or tap the letters of your answer first." };
  if (problem === "non-letters") return { legal: false, code: "non-letters", message: "Use letters A to Z only. Spaces, hyphens and apostrophes are not accepted." };
  const extra = extraLetters(word, prev);
  if (extra.length) {
    const ch = extra[0];
    const inPrev = [...prev].filter((c) => c === ch).length;
    return {
      legal: false,
      code: "added-letter",
      message:
        inPrev === 0
          ? `${ch} is not in ${prev}. You may only remove a letter, never add or swap one.`
          : `${prev} has only ${NUMBER_WORD[inPrev] ?? inPrev} ${ch}${inPrev === 1 ? "" : "s"}, so ${word} uses too many.`,
    };
  }
  if (word.length !== length) {
    return {
      legal: false,
      code: "wrong-length",
      message: `This rung needs ${plural(length, "letter")}; ${word} has ${word.length}. Remove exactly one letter from ${prev} and use all the rest.`,
    };
  }
  const removed = removedLetter(prev, word);
  return { legal: true, code: "ok", message: `${word} removes ${removed} from ${prev}.`, feedback: { removed } };
}

export function createStaircaseEngine(): GameEngine<StairPayload, StairState, StairAction, string> {
  function focus(s: StairState): string | null {
    const c = continuation(s);
    return c ? c[currentIndex(s) + 1] ?? null : null;
  }

  const engine: GameEngine<StairPayload, StairState, StairAction, string> = {
    gameId: "shrinking-staircase",
    rulesVersion: RULES_VERSION,

    initialise(round: StairPayload, _options: SessionOptions): StairState {
      void _options;
      return {
        start: round.start.toUpperCase(),
        rungs: round.rungs.map((r) => ({ ...r })),
        chains: round.acceptedChains.map((c) => c.map((w) => w.toUpperCase())),
        lettersAid: round.lettersAid,
        explanation: round.explanation,
        answers: [],
        revealed: [],
        hintLevel: 0,
        hints: [],
        revisions: 0,
        gaveUp: false,
      };
    },

    preview(state, draft) {
      if (isFinished(state)) return { legal: false, code: "finished", message: "The staircase is finished." };
      const i = currentIndex(state);
      return analyseStep(previousWord(state, i), draft, state.rungs[i].length);
    },

    apply(state, action): Transition<StairState> {
      switch (action.type) {
        case "submit": {
          if (isFinished(state)) return reject(state, "finished", "The staircase is already finished.");
          const i = currentIndex(state);
          const prev = previousWord(state, i);
          const a = analyseStep(prev, action.word, state.rungs[i].length);
          if (!a.legal) return reject(state, a.code, a.message);
          const word = normaliseWord(action.word).word;
          if (!candidates(state, i).includes(word)) {
            return reject(state, "not-clue-answer", `${word} uses the right letters, but it is not the answer to this clue. Your letters are kept so you can try another arrangement.`);
          }
          const next: StairState = { ...state, answers: [...state.answers, word], revealed: [...state.revealed, false], hintLevel: 0 };
          const d = describeStep(prev, word);
          const done = next.answers.length === next.rungs.length;
          return accept(next, done ? "completed" : "accepted", `${word} is right: ${prev} lost ${d.removed}${d.rearranged ? " and the rest were rearranged" : ""}.${done ? " The staircase is complete." : ""}`);
        }
        case "revise": {
          if (isFinished(state)) return reject(state, "finished", "The staircase is finished; start a new attempt to change answers.");
          const r = action.rung;
          if (!Number.isInteger(r) || r < 0 || r >= state.answers.length) return reject(state, "not-answered", "Only a rung you have already answered can be revised.");
          const cleared = state.answers.length - r;
          const next: StairState = {
            ...state,
            answers: state.answers.slice(0, r),
            revealed: state.revealed.slice(0, r),
            hintLevel: 0,
            revisions: state.revisions + 1,
          };
          return accept(next, "revised", `Rung ${r + 1} is open again${cleared > 1 ? ` and ${plural(cleared - 1, "later answer")} ${cleared - 1 === 1 ? "was" : "were"} cleared` : ""}. Hints you took stay on your record.`);
        }
        case "hint": {
          if (isFinished(state)) return reject(state, "finished", "The staircase is already finished.");
          const i = currentIndex(state);
          const prev = previousWord(state, i);
          const target = focus(state);
          if (!target) return reject(state, "hint-unavailable", "No hint is available here.");
          const d = describeStep(prev, target);
          if (action.tier === HINT_LETTER) {
            if (state.hintLevel >= HINT_LETTER) return reject(state, "hint-unavailable", "You already know which letter to remove.");
            const text =
              d.occurrence === d.removed
                ? `Rung ${i + 1}: remove the ${d.removed} from ${prev}.`
                : `Rung ${i + 1}: remove ${d.occurrence} from ${prev}; either one will do, because the rest are rearranged.`;
            return accept({ ...state, hintLevel: HINT_LETTER, hints: [...state.hints, { rung: i, tier: HINT_LETTER, text }] }, "hint", text);
          }
          if (action.tier === HINT_FIRST) {
            if (state.hintLevel < HINT_LETTER) return reject(state, "hint-unavailable", "Take the letter-to-remove hint first.");
            if (state.hintLevel >= HINT_FIRST) return reject(state, "hint-unavailable", "You already have the first letter of this answer.");
            const text = `Rung ${i + 1}: the answer begins with ${target[0]}.`;
            return accept({ ...state, hintLevel: HINT_FIRST, hints: [...state.hints, { rung: i, tier: HINT_FIRST, text }] }, "hint", text);
          }
          if (action.tier === HINT_FILL) {
            const text = `Rung ${i + 1} filled: ${prev} without ${d.removed} leaves ${d.survivors.split("").join(" ")}, which ${d.rearranged ? "rearranges to" : "already spells"} ${target}.`;
            const next: StairState = {
              ...state,
              answers: [...state.answers, target],
              revealed: [...state.revealed, true],
              hintLevel: 0,
              hints: [...state.hints, { rung: i, tier: HINT_FILL, text }],
            };
            const done = next.answers.length === next.rungs.length;
            return accept(next, done ? "completed" : "rung-revealed", `${text} This rung scores 0.${done ? " The staircase is complete." : ""}`);
          }
          if (action.tier === HINT_REVEAL_ALL) {
            const chain = continuation(state);
            if (!chain) return reject(state, "hint-unavailable", "No reveal is available here.");
            const rest = chain.slice(i + 1);
            const text = `Revealed the rest of the staircase: ${rest.join(", ")}.`;
            const next: StairState = {
              ...state,
              answers: chain.slice(1),
              revealed: [...state.revealed, ...rest.map(() => true)],
              hintLevel: 0,
              gaveUp: true,
              hints: [...state.hints, { rung: i, tier: HINT_REVEAL_ALL, text }],
            };
            return accept(next, "revealed", `${text} Revealed rungs score 0.`);
          }
          return reject(state, "hint-unavailable", "That hint does not exist.");
        }
        default:
          return reject(state, "unknown-action", "Unknown action.");
      }
    },

    hints(state): HintOffer[] {
      if (isFinished(state)) return [];
      const i = currentIndex(state);
      const lvl = state.hintLevel;
      const cost = "No points lost; the result records one hint.";
      return [
        {
          tier: HINT_LETTER,
          label: "Letter to remove",
          description: `Names the letter to take out of ${previousWord(state, i)} for rung ${i + 1}, including which one if it appears twice.`,
          available: lvl < HINT_LETTER,
          reason: "Already taken for this rung.",
          reveal: false,
          cost,
        },
        {
          tier: HINT_FIRST,
          label: "First letter",
          description: `Shows the first letter of the answer to rung ${i + 1}.`,
          available: lvl === HINT_LETTER,
          reason: lvl < HINT_LETTER ? "Take the letter-to-remove hint first." : "Already taken for this rung.",
          reveal: false,
          cost,
        },
        {
          tier: HINT_FILL,
          label: "Fill this rung",
          description: `Fills rung ${i + 1} and explains how the letters rearrange.`,
          available: true,
          reveal: true,
          cost: "The filled rung scores 0; the rest of the staircase is still yours to solve.",
        },
        {
          tier: HINT_REVEAL_ALL,
          label: "Reveal the whole staircase",
          description: "Shows every remaining answer and ends the round as revealed.",
          available: true,
          reveal: true,
          cost: "Every revealed rung scores 0 and the round is recorded as revealed.",
        },
      ];
    },

    outcome(state): Outcome {
      if (state.gaveUp) return "revealed";
      if (state.answers.length === state.rungs.length) return "completed";
      return "playing";
    },

    result(state): ResultSummary | null {
      if (!isFinished(state)) return null;
      const n = state.rungs.length;
      const solved = state.revealed.filter((r) => !r).length;
      const revealedCount = n - solved;
      const score = scoreOf(state);
      const nudges = state.hints.filter((h) => h.tier === HINT_LETTER || h.tier === HINT_FIRST).length;
      const chain = [state.start, ...state.answers];
      const steps = state.answers.map((w, i) => {
        const d = describeStep(chain[i], w);
        return `${chain[i]} − ${d.removed} → ${w}${d.rearranged ? ` (${d.survivors} rearranged)` : " (same order)"}${state.revealed[i] ? " · revealed" : ""}`;
      });
      const headline = state.gaveUp
        ? `Staircase revealed after ${plural(solved, "rung")} of ${n}.`
        : revealedCount
          ? `Staircase complete, ${revealedCount} of ${n} rungs filled by hints.`
          : nudges
            ? "Staircase complete with a little help."
            : "Staircase complete, every rung solved unaided.";
      return {
        outcome: state.gaveUp ? "revealed" : "completed",
        headline,
        scoreText: `${score} of 100 points`,
        score,
        maxScore: 100,
        efficiency: null,
        assistance: { hints: nudges, reveals: state.hints.filter((h) => h.tier >= HINT_FILL).length },
        details: [
          `${solved} of ${n} rungs solved by you (${Math.round(100 / n)} points each, rounded once at the end).`,
          ...(revealedCount ? [`${plural(revealedCount, "rung")} filled by a hint or reveal, scoring 0.`] : []),
          `${plural(nudges, "nudge")} taken (letter to remove or first letter); nudges do not cost points.`,
          ...(state.revisions ? [`You revised an earlier rung ${plural(state.revisions, "time")}.`] : []),
          "Wrong guesses never cost points.",
        ],
        shareText: `Word Club · Shrinking Staircase · ${solved}/${n} rungs · ${score} pts${nudges + revealedCount ? ` · ${nudges} hint${nudges === 1 ? "" : "s"}, ${revealedCount} revealed` : " · unassisted"}`,
        explanation: [...steps, state.explanation],
      };
    },
  };
  return engine;
}
