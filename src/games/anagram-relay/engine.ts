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

export interface RelayStage {
  clue: string;
  length: number;
}

export interface RelayPayload {
  /** Supplied start word (upper-case). */
  start: string;
  /** Clued stages; each answer is exactly one letter longer than the word before. */
  stages: RelayStage[];
  /** Every complete accepted chain, beginning with `start`. Branches are separate chains. */
  acceptedChains: string[][];
  /** Authored added letter per stage, one list per chain (recomputed and checked by the validator). */
  addedLetters: string[][];
  /** Gentle rounds display the letter to add at each stage. */
  suggestAddedLetter: boolean;
  explanation: string;
}

export interface RelayHint {
  stage: number;
  tier: number;
  text: string;
}

export interface RelayState {
  start: string;
  stages: RelayStage[];
  chains: string[][];
  suggestAddedLetter: boolean;
  explanation: string;
  answers: string[];
  /** Parallel to answers: true when a hint filled the stage. */
  revealed: boolean[];
  hintLevel: number;
  hints: RelayHint[];
  revisions: number;
  gaveUp: boolean;
}

export type RelayAction =
  | { type: "submit"; word: string }
  | { type: "revise"; stage: number }
  | { type: "hint"; tier: number };

export const HINT_LETTER = 1;
export const HINT_START = 2;
export const HINT_PATTERN = 3;
export const HINT_FILL = 4;
export const HINT_REVEAL_ALL = 5;

const NUMBER_WORD = ["no", "one", "two", "three", "four", "five", "six"];

/** Letters of `word` not covered by `pool` (multiset difference word − pool). */
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

/** The single added letter when `next` = `prev` plus exactly one occurrence, else null. */
export function addedLetter(prev: string, next: string): string | null {
  if (next.length !== prev.length + 1) return null;
  if (extraLetters(prev, next).length) return null;
  const add = extraLetters(next, prev);
  return add.length === 1 ? add[0] : null;
}

/** Position (1-based) of the added occurrence in `next`: the last occurrence of that letter, so earlier copies read as kept letters. */
export function addedPosition(prev: string, next: string): number {
  const add = addedLetter(prev, next);
  if (!add) return -1;
  return next.lastIndexOf(add) + 1;
}

function stageIndex(s: RelayState) {
  return s.answers.length;
}

function previousWord(s: Pick<RelayState, "start" | "answers">, stage: number) {
  return stage === 0 ? s.start : s.answers[stage - 1];
}

/** Accepted answers for `stage` given the player's accepted prefix (branch-aware). */
export function candidates(s: Pick<RelayState, "chains" | "start" | "answers">, stage: number): string[] {
  const prefix = [s.start, ...s.answers.slice(0, stage)];
  const out: string[] = [];
  for (const c of s.chains) {
    if (prefix.every((w, i) => c[i] === w)) {
      const w = c[stage + 1];
      if (w && !out.includes(w)) out.push(w);
    }
  }
  return out;
}

function continuation(s: RelayState): string[] | null {
  const prefix = [s.start, ...s.answers];
  return s.chains.find((c) => prefix.every((w, i) => c[i] === w)) ?? null;
}

/** The added letter the current stage expects on the player's branch (for gentle display and hints). */
export function suggestedLetter(s: RelayState): string | null {
  const c = continuation(s);
  const i = stageIndex(s);
  if (!c || !c[i + 1]) return null;
  return addedLetter(c[i], c[i + 1]);
}

export function isFinished(s: RelayState) {
  return s.gaveUp || s.answers.length === s.stages.length;
}

export function scoreOf(s: RelayState) {
  const solved = s.revealed.filter((r) => !r).length;
  return Math.round((solved * 100) / s.stages.length);
}

export function analyseStage(prev: string, raw: string, length: number): Analysis<{ added: string | null }> {
  const { word, problem } = normaliseWord(raw);
  if (problem === "empty") return { legal: false, code: "empty", message: "Type or tap the letters of your answer first." };
  if (problem === "non-letters") return { legal: false, code: "non-letters", message: "Use letters A to Z only. Spaces, hyphens and apostrophes are not accepted." };
  const missing = extraLetters(prev, word);
  const added = extraLetters(word, prev);
  if (missing.length) {
    const list = [...new Set(missing)].join(", ");
    if (added.length && word.length === prev.length)
      return {
        legal: false,
        code: "substitution",
        message: `${word} swaps ${list} for ${added.join(", ")}. Every letter of ${prev} must stay, plus exactly one new letter.`,
      };
    return { legal: false, code: "dropped-letter", message: `${word} leaves out ${list} from ${prev}. Every letter must stay; you only add one.` };
  }
  if (!added.length) return { legal: false, code: "pure-anagram", message: `${word} uses exactly the letters of ${prev}. Each stage must grow by one letter.` };
  if (added.length > 1)
    return { legal: false, code: "too-many-added", message: `${word} adds ${NUMBER_WORD[added.length] ?? added.length} letters (${added.join(", ")}). Add exactly one letter to ${prev}.` };
  if (word.length !== length) return { legal: false, code: "wrong-length", message: `This stage needs ${plural(length, "letter")}.` };
  return { legal: true, code: "ok", message: `${word} keeps every letter of ${prev} and adds ${added[0]}.`, feedback: { added: added[0] } };
}

export function createAnagramRelayEngine(): GameEngine<RelayPayload, RelayState, RelayAction, string> {
  function focus(s: RelayState): string | null {
    const c = continuation(s);
    return c ? c[stageIndex(s) + 1] ?? null : null;
  }

  const engine: GameEngine<RelayPayload, RelayState, RelayAction, string> = {
    gameId: "anagram-relay",
    rulesVersion: RULES_VERSION,

    initialise(round: RelayPayload, _options: SessionOptions): RelayState {
      void _options;
      return {
        start: round.start.toUpperCase(),
        stages: round.stages.map((st) => ({ ...st })),
        chains: round.acceptedChains.map((c) => c.map((w) => w.toUpperCase())),
        suggestAddedLetter: round.suggestAddedLetter,
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
      if (isFinished(state)) return { legal: false, code: "finished", message: "The relay is finished." };
      const i = stageIndex(state);
      return analyseStage(previousWord(state, i), draft, state.stages[i].length);
    },

    apply(state, action): Transition<RelayState> {
      switch (action.type) {
        case "submit": {
          if (isFinished(state)) return reject(state, "finished", "The relay is already finished.");
          const i = stageIndex(state);
          const prev = previousWord(state, i);
          const a = analyseStage(prev, action.word, state.stages[i].length);
          if (!a.legal) return reject(state, a.code, a.message);
          const word = normaliseWord(action.word).word;
          if (!candidates(state, i).includes(word))
            return reject(state, "not-clue-answer", `${word} is a fair letter move, but it is not the answer to this clue. Your letters are kept so you can rearrange them.`);
          const next: RelayState = { ...state, answers: [...state.answers, word], revealed: [...state.revealed, false], hintLevel: 0 };
          const done = next.answers.length === next.stages.length;
          return accept(next, done ? "completed" : "accepted", `${word} is right: ${prev} plus ${addedLetter(prev, word)}.${done ? " The relay is complete." : ""}`);
        }
        case "revise": {
          if (isFinished(state)) return reject(state, "finished", "The relay is finished; start a new attempt to change answers.");
          const r = action.stage;
          if (!Number.isInteger(r) || r < 0 || r >= state.answers.length) return reject(state, "not-answered", "Only a stage you have already answered can be revised.");
          const cleared = state.answers.length - r - 1;
          const next: RelayState = { ...state, answers: state.answers.slice(0, r), revealed: state.revealed.slice(0, r), hintLevel: 0, revisions: state.revisions + 1 };
          return accept(
            next,
            "revised",
            `Stage ${r + 1} is open again${cleared > 0 ? ` and ${plural(cleared, "later answer")} ${cleared === 1 ? "was" : "were"} cleared` : ""}. Hints you took stay on your record.`,
          );
        }
        case "hint": {
          if (isFinished(state)) return reject(state, "finished", "The relay is already finished.");
          const i = stageIndex(state);
          const prev = previousWord(state, i);
          const target = focus(state);
          if (!target) return reject(state, "hint-unavailable", "No hint is available here.");
          const add = addedLetter(prev, target) ?? "?";
          const level = Math.max(state.hintLevel, state.suggestAddedLetter ? HINT_LETTER : 0);
          const record = (tier: number, text: string, code = "hint") =>
            accept({ ...state, hintLevel: Math.max(state.hintLevel, tier), hints: [...state.hints, { stage: i, tier, text }] }, code, text);
          if (action.tier === HINT_LETTER) {
            if (level >= HINT_LETTER) return reject(state, "hint-unavailable", state.suggestAddedLetter ? "Gentle rounds already show the letter to add." : "You already know the letter to add.");
            return record(HINT_LETTER, `Stage ${i + 1}: add ${add} to ${prev}.`);
          }
          if (action.tier === HINT_START) {
            if (level < HINT_LETTER) return reject(state, "hint-unavailable", "Take the letter-to-add hint first.");
            if (level >= HINT_START) return reject(state, "hint-unavailable", "You already have the opening letters.");
            return record(HINT_START, `Stage ${i + 1}: the answer begins ${target.slice(0, 2)}.`);
          }
          if (action.tier === HINT_PATTERN) {
            if (level < HINT_START) return reject(state, "hint-unavailable", "Take the opening-letters hint first.");
            if (level >= HINT_PATTERN) return reject(state, "hint-unavailable", "You already have the pattern for this stage.");
            const pos = addedPosition(prev, target);
            const pattern = [...target].map((ch, k) => (k < 2 || k === pos - 1 ? ch : "_")).join(" ");
            return record(HINT_PATTERN, `Stage ${i + 1}: ${pattern}. The new ${add} sits in position ${pos}; the other letters of ${prev} fill the gaps.`);
          }
          if (action.tier === HINT_FILL) {
            const text = `Stage ${i + 1} filled: ${prev} + ${add} rearranges to ${target}.`;
            const next: RelayState = {
              ...state,
              answers: [...state.answers, target],
              revealed: [...state.revealed, true],
              hintLevel: 0,
              hints: [...state.hints, { stage: i, tier: HINT_FILL, text }],
            };
            const done = next.answers.length === next.stages.length;
            return accept(next, done ? "completed" : "stage-revealed", `${text} This stage scores 0.${done ? " The relay is complete." : ""}`);
          }
          if (action.tier === HINT_REVEAL_ALL) {
            const chain = continuation(state);
            if (!chain) return reject(state, "hint-unavailable", "No reveal is available here.");
            const rest = chain.slice(i + 1);
            const text = `Revealed the rest of the relay: ${rest.join(", ")}.`;
            const next: RelayState = {
              ...state,
              answers: chain.slice(1),
              revealed: [...state.revealed, ...rest.map(() => true)],
              hintLevel: 0,
              gaveUp: true,
              hints: [...state.hints, { stage: i, tier: HINT_REVEAL_ALL, text }],
            };
            return accept(next, "revealed", `${text} Revealed stages score 0.`);
          }
          return reject(state, "hint-unavailable", "That hint does not exist.");
        }
        default:
          return reject(state, "unknown-action", "Unknown action.");
      }
    },

    hints(state): HintOffer[] {
      if (isFinished(state)) return [];
      const i = stageIndex(state);
      const level = Math.max(state.hintLevel, state.suggestAddedLetter ? HINT_LETTER : 0);
      const cost = "No points lost; the result records one hint.";
      return [
        {
          tier: HINT_LETTER,
          label: "Letter to add",
          description: `Names the one letter to add to ${previousWord(state, i)} for stage ${i + 1}.`,
          available: level < HINT_LETTER,
          reason: state.suggestAddedLetter ? "Gentle rounds already show the letter to add." : "Already taken for this stage.",
          reveal: false,
          cost,
        },
        {
          tier: HINT_START,
          label: "Opening letters",
          description: `Shows the first two letters of the stage ${i + 1} answer.`,
          available: level === HINT_LETTER,
          reason: level < HINT_LETTER ? "Take the letter-to-add hint first." : "Already taken for this stage.",
          reveal: false,
          cost,
        },
        {
          tier: HINT_PATTERN,
          label: "Where the new letter goes",
          description: "Shows the answer pattern with the opening letters and the position of the new letter.",
          available: level === HINT_START,
          reason: level < HINT_START ? "Take the opening-letters hint first." : "Already taken for this stage.",
          reveal: false,
          cost,
        },
        {
          tier: HINT_FILL,
          label: "Fill this stage",
          description: `Fills stage ${i + 1} and shows the letter that was added.`,
          available: true,
          reveal: true,
          cost: "The filled stage scores 0; later stages are still yours to solve.",
        },
        {
          tier: HINT_REVEAL_ALL,
          label: "Reveal the whole relay",
          description: "Shows every remaining answer and ends the round as revealed.",
          available: true,
          reveal: true,
          cost: "Every revealed stage scores 0 and the round is recorded as revealed.",
        },
      ];
    },

    outcome(state): Outcome {
      if (state.gaveUp) return "revealed";
      if (state.answers.length === state.stages.length) return "completed";
      return "playing";
    },

    result(state): ResultSummary | null {
      if (!isFinished(state)) return null;
      const n = state.stages.length;
      const solved = state.revealed.filter((r) => !r).length;
      const revealedCount = n - solved;
      const score = scoreOf(state);
      const nudges = state.hints.filter((h) => h.tier <= HINT_PATTERN).length;
      const chain = [state.start, ...state.answers];
      const steps = state.answers.map((w, i) => `${chain[i]} + ${addedLetter(chain[i], w)} → ${w}${state.revealed[i] ? " · revealed" : ""}`);
      return {
        outcome: state.gaveUp ? "revealed" : "completed",
        headline: state.gaveUp
          ? `Relay revealed after ${plural(solved, "stage")} of ${n}.`
          : revealedCount
            ? `Relay complete, ${revealedCount} of ${n} stages filled by hints.`
            : nudges
              ? "Relay complete with a little help."
              : "Relay complete, every stage solved unaided.",
        scoreText: `${score} of 100 points`,
        score,
        maxScore: 100,
        efficiency: null,
        assistance: { hints: nudges, reveals: state.hints.filter((h) => h.tier >= HINT_FILL).length },
        details: [
          `${solved} of ${n} stages solved by you (one ${n === 3 ? "third" : "share"} of 100 each, rounded once at the end).`,
          ...(revealedCount ? [`${plural(revealedCount, "stage")} filled by a hint or reveal, scoring 0.`] : []),
          `${plural(nudges, "nudge")} taken; nudges do not cost points.`,
          ...(state.revisions ? [`You revised an earlier stage ${plural(state.revisions, "time")}.`] : []),
          `Letters added: ${state.answers.map((w, i) => addedLetter(chain[i], w)).join(", ")}.`,
        ],
        shareText: `Word Club · Anagram Relay · ${solved}/${n} stages · ${score} pts${nudges + revealedCount ? ` · ${nudges} hint${nudges === 1 ? "" : "s"}, ${revealedCount} revealed` : " · unassisted"}`,
        explanation: [...steps, state.explanation],
      };
    },
  };
  return engine;
}
