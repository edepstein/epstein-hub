import {
  accept,
  reject,
  type Analysis,
  type Difficulty,
  type GameEngine,
  type HintOffer,
  type Outcome,
  type ResultSummary,
  type SessionOptions,
  type Transition,
} from "@/lib/engine/types";
import { normaliseWord, plural } from "@/lib/text";

export const RULES_VERSION = "1.0";
export const WORD_LENGTH = 5;
/** Extra rows granted each time the player chooses to keep guessing after the limit. */
export const EXTENSION_ROWS = 3;

export type Mark = "correct" | "present" | "absent";

export interface DeductionPayload {
  /** Curated five-letter answer, upper-case. */
  answer: string;
  guessLimit: number;
  /** Expert rounds enforce revealed information (hard mode). */
  hardMode: boolean;
  /** Short editor-written definition shown when the answer is revealed. */
  definition: string;
  explanation: string;
  /** Pack demo fixtures only: the original finite guess list (regression data, not gameplay membership). */
  fixtureGuesses?: string[];
  /** Pack demo fixtures only: stored feedback expectations (regression data). */
  fixtureFeedback?: { guess: string; expectedFeedback: Mark[] }[];
}

export interface GuessRow {
  guess: string;
  marks: Mark[];
  /** True for rows entered after the guess limit, in an assisted extension. */
  extension: boolean;
}

export const HINT_LETTER = 1;
export const HINT_PLACE = 2;
export const HINT_REVEAL = 3;

export interface HintRecord {
  tier: number;
  text: string;
  letter: string;
  /** Zero-based position for place hints. */
  position: number | null;
  /** Number of guesses made when the hint was taken. */
  afterGuesses: number;
}

export interface DeductionState {
  answer: string;
  guessLimit: number;
  mode: Difficulty;
  hardMode: boolean;
  /** Hard mode switched off mid-round (recorded as assistance). */
  hardRelaxed: boolean;
  rows: GuessRow[];
  hints: HintRecord[];
  /** Number of assisted extensions granted after the limit. */
  extensions: number;
  revealed: boolean;
  definition: string;
  explanation: string;
}

export type DeductionAction =
  | { type: "guess"; word: string }
  | { type: "hint"; tier: number }
  | { type: "extend" }
  | { type: "reveal" }
  | { type: "relax-hard-mode" };

export const MARK_SYMBOL: Record<Mark, string> = { correct: "✓", present: "↔", absent: "×" };
export const MARK_TEXT: Record<Mark, string> = { correct: "correct place", present: "elsewhere", absent: "absent" };

/**
 * Two-pass feedback. Pass 1 marks exact positions and consumes those answer letters.
 * Pass 2 scans the remaining guess positions left to right, marking present only while an
 * unused copy of that letter remains in the answer.
 */
export function scoreGuess(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array.from({ length: guess.length }, () => "absent");
  const remaining = new Map<string, number>();
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = "correct";
    else remaining.set(answer[i], (remaining.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === "correct") continue;
    const n = remaining.get(guess[i]) ?? 0;
    if (n > 0) {
      marks[i] = "present";
      remaining.set(guess[i], n - 1);
    }
  }
  return marks;
}

const RANK: Record<Mark, number> = { absent: 1, present: 2, correct: 3 };

/** Strongest established state per letter across all rows (for the on-screen keyboard). */
export function keyboardSummary(rows: readonly GuessRow[]): Record<string, Mark> {
  const out: Record<string, Mark> = {};
  for (const r of rows) {
    r.guess.split("").forEach((ch, i) => {
      const m = r.marks[i];
      if (!out[ch] || RANK[m] > RANK[out[ch]]) out[ch] = m;
    });
  }
  return out;
}

/** Plain row description for screen readers: "C: absent; R: elsewhere; ...". */
export function describeRow(row: Pick<GuessRow, "guess" | "marks">): string {
  return row.guess
    .split("")
    .map((ch, i) => `${ch}: ${MARK_TEXT[row.marks[i]]}`)
    .join("; ");
}

export function shareRow(marks: readonly Mark[]): string {
  return marks.map((m) => MARK_SYMBOL[m]).join("");
}

const ordinal = (n: number) => ["first", "second", "third", "fourth", "fifth"][n] ?? `${n + 1}th`;

/** Constraints that hard mode derives from feedback rows and place/letter hints. */
export interface HardConstraints {
  /** position -> required letter */
  fixed: (string | null)[];
  /** letter -> minimum count */
  minimum: Map<string, number>;
  /** position -> letters known not to be there (from "elsewhere" marks) */
  excluded: Set<string>[];
}

export function hardConstraints(state: Pick<DeductionState, "rows" | "hints">): HardConstraints {
  const fixed: (string | null)[] = Array.from({ length: WORD_LENGTH }, () => null);
  const minimum = new Map<string, number>();
  const excluded = Array.from({ length: WORD_LENGTH }, () => new Set<string>());
  for (const r of state.rows) {
    const counts = new Map<string, number>();
    r.guess.split("").forEach((ch, i) => {
      const m = r.marks[i];
      if (m === "correct") fixed[i] = ch;
      if (m === "present") excluded[i].add(ch);
      if (m !== "absent") counts.set(ch, (counts.get(ch) ?? 0) + 1);
    });
    for (const [ch, n] of counts) minimum.set(ch, Math.max(minimum.get(ch) ?? 0, n));
  }
  for (const h of state.hints) {
    if (h.tier === HINT_PLACE && h.position != null) fixed[h.position] = h.letter;
    if (h.tier === HINT_LETTER) minimum.set(h.letter, Math.max(minimum.get(h.letter) ?? 0, 1));
  }
  // A fixed letter counts towards the minimum as well.
  const fixedCounts = new Map<string, number>();
  for (const ch of fixed) if (ch) fixedCounts.set(ch, (fixedCounts.get(ch) ?? 0) + 1);
  for (const [ch, n] of fixedCounts) minimum.set(ch, Math.max(minimum.get(ch) ?? 0, n));
  return { fixed, minimum, excluded };
}

/** First hard-mode violation for a guess, or null. Grey letters are deliberately not banned. */
export function hardViolation(state: Pick<DeductionState, "rows" | "hints">, guess: string): { code: string; message: string } | null {
  const c = hardConstraints(state);
  for (let i = 0; i < WORD_LENGTH; i++) {
    const need = c.fixed[i];
    if (need && guess[i] !== need)
      return { code: "hard-fixed", message: `Hard mode: the ${ordinal(i)} letter must be ${need}, as already revealed.` };
  }
  for (const [ch, n] of [...c.minimum].sort(([a], [b]) => a.localeCompare(b))) {
    const have = guess.split("").filter((x) => x === ch).length;
    if (have < n)
      return {
        code: "hard-minimum",
        message: n === 1 ? `Hard mode: your guess must include ${ch}, which is in the answer.` : `Hard mode: your guess must include at least ${n} copies of ${ch}.`,
      };
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (c.excluded[i].has(guess[i]))
      return { code: "hard-moved", message: `Hard mode: ${guess[i]} cannot go ${ordinal(i)}; an earlier guess showed it belongs elsewhere.` };
  }
  return null;
}

export function isWon(s: Pick<DeductionState, "rows" | "answer">): boolean {
  const last = s.rows[s.rows.length - 1];
  return !!last && last.guess === s.answer;
}

export function rowsAllowed(s: Pick<DeductionState, "guessLimit" | "extensions">): number {
  return s.guessLimit + s.extensions * EXTENSION_ROWS;
}

export function isExhausted(s: DeductionState): boolean {
  return !isWon(s) && !s.revealed && s.rows.length >= rowsAllowed(s);
}

/** Letters of the answer that no guess has used yet (in answer order, unique). */
function untriedAnswerLetters(s: DeductionState): string[] {
  const tried = new Set(s.rows.flatMap((r) => r.guess.split("")));
  const hinted = new Set(s.hints.filter((h) => h.tier === HINT_LETTER).map((h) => h.letter));
  return [...new Set(s.answer.split(""))].filter((ch) => !tried.has(ch) && !hinted.has(ch));
}

/** Answer letters the player knows are present but whose place is not yet fixed. */
function unplacedKnownLetters(s: DeductionState): string[] {
  const c = hardConstraints(s);
  const known = [...c.minimum.keys()];
  return known.filter((ch) => s.answer.split("").some((a, i) => a === ch && c.fixed[i] !== ch));
}

function firstUnknownPosition(s: DeductionState): number | null {
  const c = hardConstraints(s);
  for (let i = 0; i < WORD_LENGTH; i++) if (c.fixed[i] !== s.answer[i]) return i;
  return null;
}

function letterHintTarget(s: DeductionState): { letter: string; fresh: boolean } | null {
  const untried = untriedAnswerLetters(s);
  if (untried.length) return { letter: untried[0], fresh: true };
  return null;
}

export function createWordDeductionEngine(membership: ReadonlySet<string>): GameEngine<DeductionPayload, DeductionState, DeductionAction, string> {
  function analyse(state: DeductionState, raw: string): Analysis {
    if (isWon(state)) return { legal: false, code: "finished", message: "You have already found the word." };
    if (state.revealed) return { legal: false, code: "finished", message: "The answer has been revealed, so this round is closed." };
    if (isExhausted(state))
      return { legal: false, code: "out-of-guesses", message: "You have used every guess. Reveal the answer, or keep guessing with extra rows (marked assisted)." };
    const { word, problem } = normaliseWord(raw);
    if (problem === "empty") return { legal: false, code: "empty", message: "Type a five-letter word first." };
    if (problem === "non-letters") return { legal: false, code: "non-letters", message: "Use letters A to Z only, with no spaces or punctuation." };
    if (word.length !== WORD_LENGTH)
      return {
        legal: false,
        code: word.length < WORD_LENGTH ? "too-short" : "too-long",
        message: `Guesses must have exactly five letters; ${word} has ${word.length}.`,
      };
    if (word !== state.answer && !membership.has(word))
      return { legal: false, code: "not-in-word-list", message: `${word} is not in this game's word list, so it does not use a guess.` };
    if (state.rows.some((r) => r.guess === word)) return { legal: false, code: "repeated", message: `You have already guessed ${word}. It does not use a guess.` };
    if (state.hardMode && !state.hardRelaxed) {
      const v = hardViolation(state, word);
      if (v) return { legal: false, code: v.code, message: `${v.message} It does not use a guess.` };
    }
    return { legal: true, code: "ok", message: `${word} is ready to submit.` };
  }

  const engine: GameEngine<DeductionPayload, DeductionState, DeductionAction, string> = {
    gameId: "word-deduction",
    rulesVersion: RULES_VERSION,

    initialise(round: DeductionPayload, options: SessionOptions): DeductionState {
      return {
        answer: round.answer.toUpperCase(),
        guessLimit: round.guessLimit,
        mode: options.mode,
        hardMode: round.hardMode,
        hardRelaxed: false,
        rows: [],
        hints: [],
        extensions: 0,
        revealed: false,
        definition: round.definition,
        explanation: round.explanation,
      };
    },

    preview(state, draft) {
      return analyse(state, draft);
    },

    apply(state, action): Transition<DeductionState> {
      switch (action.type) {
        case "guess": {
          const a = analyse(state, action.word);
          if (!a.legal) return reject(state, a.code, a.message);
          const word = normaliseWord(action.word).word;
          const marks = scoreGuess(word, state.answer);
          const row: GuessRow = { guess: word, marks, extension: state.rows.length >= state.guessLimit };
          const next: DeductionState = { ...state, rows: [...state.rows, row] };
          const n = next.rows.length;
          if (word === state.answer) {
            return accept(next, "won", `${describeRow(row)}. Solved: ${word} in ${plural(n, "guess", "guesses")}.`, { feedback: marks });
          }
          if (isExhausted(next)) {
            const msg = row.extension
              ? `${describeRow(row)}. Those extra rows are used up. Reveal the answer, or take more extra rows.`
              : `${describeRow(row)}. That was your last guess. Reveal the answer, or keep guessing with extra rows (marked assisted).`;
            return accept(next, "out-of-guesses", msg, { feedback: marks });
          }
          const left = rowsAllowed(next) - n;
          return accept(next, "guessed", `${describeRow(row)}. ${plural(left, "guess", "guesses")} left.`, { feedback: marks });
        }
        case "hint": {
          if (isWon(state) || state.revealed) return reject(state, "hint-unavailable", "The round is finished, so no hints are needed.");
          if (action.tier === HINT_LETTER) {
            const t = letterHintTarget(state);
            if (!t) return reject(state, "hint-unavailable", "You have already tried every letter in the answer. Try a place hint instead.");
            const text = `The answer contains ${t.letter}.`;
            const rec: HintRecord = { tier: HINT_LETTER, text, letter: t.letter, position: null, afterGuesses: state.rows.length };
            return accept({ ...state, hints: [...state.hints, rec] }, "hint", text);
          }
          if (action.tier === HINT_PLACE) {
            const p = firstUnknownPosition(state);
            if (p == null) return reject(state, "hint-unavailable", "Every letter's place is already known.");
            const text = p === 0 ? `The answer begins with ${state.answer[0]}.` : `The ${ordinal(p)} letter is ${state.answer[p]}.`;
            const rec: HintRecord = { tier: HINT_PLACE, text, letter: state.answer[p], position: p, afterGuesses: state.rows.length };
            return accept({ ...state, hints: [...state.hints, rec] }, "hint", text);
          }
          if (action.tier === HINT_REVEAL) return engine.apply(state, { type: "reveal" });
          return reject(state, "hint-unavailable", "That hint does not exist.");
        }
        case "reveal": {
          if (isWon(state)) return reject(state, "finished", "You have already found the word.");
          if (state.revealed) return reject(state, "finished", "The answer is already revealed.");
          return accept({ ...state, revealed: true }, "revealed", `The answer was ${state.answer}: ${state.definition}`);
        }
        case "extend": {
          if (!isExhausted(state)) return reject(state, "not-exhausted", "You still have guesses left.");
          return accept(
            { ...state, extensions: state.extensions + 1 },
            "extended",
            `${EXTENSION_ROWS} extra rows added. Your result will show the round was not solved within ${state.guessLimit} guesses.`,
          );
        }
        case "relax-hard-mode": {
          if (!state.hardMode) return reject(state, "not-hard-mode", "This round does not use hard mode.");
          if (state.hardRelaxed) return reject(state, "already-relaxed", "Hard mode is already switched off for this round.");
          if (isWon(state) || state.revealed) return reject(state, "finished", "The round is finished.");
          return accept({ ...state, hardRelaxed: true }, "relaxed", "Hard mode is off for the rest of this round. Your result will say so.");
        }
        default:
          return reject(state, "unknown-action", "Unknown action.");
      }
    },

    hints(state): HintOffer[] {
      const finished = isWon(state) || state.revealed;
      const letter = letterHintTarget(state);
      const place = firstUnknownPosition(state);
      const assistedCost =
        state.mode === "gentle" ? "No guess is used; your result records the hint." : "No guess is used, but your result is marked assisted.";
      const unplaced = unplacedKnownLetters(state);
      return [
        {
          tier: HINT_LETTER,
          label: "A letter you have not tried",
          description: "Names one letter that is in the answer and that none of your guesses has used yet.",
          available: !finished && !!letter,
          reason: finished ? "The round is finished." : unplaced.length ? "You have already tried every letter in the answer; a place hint will help more." : "No untried letters remain.",
          reveal: false,
          cost: assistedCost,
        },
        {
          tier: HINT_PLACE,
          label: place === 0 || place == null ? "First letter" : "A letter in place",
          description:
            place === 0 || place == null
              ? "Shows the first letter of the answer."
              : `Shows the letter in the ${ordinal(place)} position, the first place you have not yet confirmed.`,
          available: !finished && place != null,
          reason: finished ? "The round is finished." : "Every place is already known.",
          reveal: false,
          cost: assistedCost,
        },
        {
          tier: HINT_REVEAL,
          label: "Reveal the answer",
          description: "Shows the answer and its meaning, and ends the round.",
          available: !finished,
          reason: "The round is finished.",
          reveal: true,
          cost: "The round is recorded as revealed, not solved.",
        },
      ];
    },

    outcome(state): Outcome {
      if (isWon(state)) return "completed";
      if (state.revealed) return "revealed";
      if (isExhausted(state)) return "failed";
      return "playing";
    },

    result(state): ResultSummary | null {
      const outcome = engine.outcome(state);
      if (outcome === "playing") return null;
      const n = state.rows.length;
      const inLimit = state.rows.filter((r) => !r.extension);
      const hintCount = state.hints.length + state.extensions + (state.hardRelaxed ? 1 : 0);
      const reveals = state.revealed ? 1 : 0;
      const assisted = hintCount + reveals > 0;
      const won = outcome === "completed";
      const wonInLimit = won && n <= state.guessLimit;
      const grid = state.rows.map((r) => shareRow(r.marks)).join("\n");
      const tally = won ? (wonInLimit ? `${n}/${state.guessLimit}` : `X/${state.guessLimit}, solved later in ${n}`) : state.revealed ? `X/${state.guessLimit}, revealed` : `X/${state.guessLimit}`;
      const flags = [
        state.hardMode ? (state.hardRelaxed ? "hard mode relaxed" : "hard mode") : null,
        assisted ? `assisted (${plural(hintCount, "hint")}${reveals ? ", revealed" : ""})` : "unassisted",
      ].filter(Boolean);

      let headline: string;
      if (won && wonInLimit) headline = `Solved in ${plural(n, "guess", "guesses")}.`;
      else if (won) headline = `Solved in ${n} guesses, after the ${state.guessLimit}-guess limit.`;
      else if (state.revealed) headline = `Revealed: the answer was ${state.answer}.`;
      else headline = `Not solved in ${state.guessLimit} guesses.`;

      const details: string[] = [];
      if (won && !wonInLimit) details.push(`Not solved within ${state.guessLimit} guesses; you kept going with extra rows, so this counts as assisted practice.`);
      details.push(`${plural(n, "accepted guess", "accepted guesses")}${inLimit.length !== n ? ` (${n - inLimit.length} in extra rows)` : ""}. Rejected entries never used a guess.`);
      if (state.hints.length) details.push(`Hints: ${state.hints.map((h) => `${h.text} (after ${plural(h.afterGuesses, "guess", "guesses")})`).join(" ")}`);
      else details.push("No hints taken.");
      if (state.hardMode) details.push(state.hardRelaxed ? "Hard mode was switched off during the round." : "Hard mode was kept throughout: every guess used the information already revealed.");
      if (outcome === "failed") details.push("The answer is still hidden. Reveal it, or keep guessing with extra rows (marked assisted).");
      if (outcome !== "failed") details.push(`${state.answer}: ${state.definition}`);

      return {
        outcome,
        headline,
        scoreText: won ? `${n} of ${state.guessLimit} guesses` : `${n} guesses, not solved`,
        efficiency: null,
        assistance: { hints: hintCount, reveals },
        details,
        shareText: `Word Club · Word Deduction · ${tally} · ${flags.join(" · ")}\n${grid}`,
        explanation: outcome === "failed" ? [state.explanation] : [state.explanation, `The answer was ${state.answer}: ${state.definition}`],
      };
    },
  };
  return engine;
}
