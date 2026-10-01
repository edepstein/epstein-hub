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
import { boardProblem, makeBoard, maskOf, playableWords, popcount, searchPar, type Board, type ParSearch, type WordEntry } from "./solver";

export const RULES_VERSION = "1.0";
export const SIDE_NAMES = ["top", "right", "bottom", "left"] as const;

export interface CircuitPayload {
  /** Four sides of three distinct letters: top, right, bottom, left. */
  sides: string[][];
  minimumWordLength: number;
  /** Master rounds only: par and hints use the Master pool (everyday plus less common words). Absent means the everyday pool. */
  pool?: "master";
  /** Proved minimum number of words using the round's pool (everyday, or Master) by breadth-first search. */
  par: number;
  /** One chain achieving par, shown after completion. */
  parChain: string[];
  /** Every everyday-pool word legal on this board, space-separated: used for par and for hints. */
  parPool: string;
  /** Pack fixtures only: the original finite lexicon, its reference chain and its stored optimum. */
  fixture?: { lexicon: string[]; referenceChain: string[]; optimum: number };
  explanation: string;
}

export interface ChainWord {
  word: string;
  assisted: boolean;
}

export interface BestChain {
  words: string[];
  /** Per-word flag: played for you by a hint. */
  played: boolean[];
  letters: number;
  assisted: boolean;
}

export interface CircuitHint {
  tier: number;
  text: string;
  word: string;
}

export interface CircuitState {
  sides: string[][];
  letters: string[];
  minimumWordLength: number;
  par: number;
  parChain: string[];
  /** True when par and hints come from the Master pool instead of the everyday pool. */
  master: boolean;
  pool: string[];
  explanation: string;
  chain: ChainWord[];
  /** Hints or reveals were used since the current chain was started. */
  chainAssisted: boolean;
  best: BestChain | null;
  completions: number;
  /** Trying for a shorter chain after a completion. */
  improving: boolean;
  hintFocus: { word: string; at: string } | null;
  hintLevel: number;
  hints: CircuitHint[];
}

export type CircuitAction =
  | { type: "submit"; word: string }
  | { type: "undo" }
  | { type: "new-chain" }
  | { type: "show-best" }
  | { type: "hint"; tier: number };

export const HINT_LETTERS = 1;
export const HINT_WORD = 2;
export const HINT_PLAY = 3;

export function boardOf(s: Pick<CircuitState, "sides">): Board {
  return makeBoard(s.sides);
}

export function coverage(s: Pick<CircuitState, "sides" | "chain">): number {
  const b = boardOf(s);
  return s.chain.reduce((m, w) => m | maskOf(b, w.word), 0);
}

export function requiredStart(s: Pick<CircuitState, "chain">): string | null {
  const last = s.chain[s.chain.length - 1];
  return last ? last.word[last.word.length - 1] : null;
}

export function unusedLetters(s: Pick<CircuitState, "sides" | "chain" | "letters">): string[] {
  const m = coverage(s);
  const b = boardOf(s);
  return s.letters.filter((l) => !(m & (1 << b.bitOf.get(l)!)));
}

export const chainComplete = (s: Pick<CircuitState, "sides" | "chain">) => s.chain.length > 0 && coverage(s) === boardOf(s).fullMask;

function focusKey(s: CircuitState) {
  return `${requiredStart(s) ?? "*"}:${coverage(s)}`;
}

/** Wording for the pool that proves par and supplies hints. */
export const lexName = (s: Pick<CircuitState, "master">) => (s.master ? "Master-pool" : "everyday");

const better = (a: BestChain, b: BestChain | null) => !b || a.words.length < b.words.length || (a.words.length === b.words.length && a.letters < b.letters);

export function createLetterCircuitEngine(membership: ReadonlySet<string>): GameEngine<CircuitPayload, CircuitState, CircuitAction, string> {
  const entryCache = new Map<string, WordEntry[]>();
  const searchCache = new Map<string, ParSearch>();

  function entries(s: CircuitState): WordEntry[] {
    const k = s.sides.map((x) => x.join("")).join("|");
    let e = entryCache.get(k);
    if (!e) {
      e = playableWords(boardOf(s), s.pool, s.minimumWordLength);
      entryCache.set(k, e);
    }
    return e;
  }

  /** Shortest everyday continuation from the current chain end. */
  function plan(s: CircuitState): ParSearch {
    const k = `${s.sides.map((x) => x.join("")).join("|")}#${focusKey(s)}`;
    let r = searchCache.get(k);
    if (!r) {
      r = searchPar(boardOf(s), entries(s), { last: requiredStart(s), mask: coverage(s) });
      searchCache.set(k, r);
    }
    return r;
  }

  function focusFor(s: CircuitState): string | null {
    if (chainComplete(s)) return null;
    if (s.hintFocus && s.hintFocus.at === focusKey(s)) return s.hintFocus.word;
    return plan(s).chain[0] ?? null;
  }

  function analyse(s: CircuitState, raw: string): Analysis {
    const { word, problem } = normaliseWord(raw);
    if (problem === "empty") return { legal: false, code: "empty", message: "Type or tap some letters first." };
    if (problem === "non-letters") return { legal: false, code: "non-letters", message: "Use letters A to Z only. Spaces, hyphens and apostrophes are not accepted." };
    if (word.length < s.minimumWordLength) return { legal: false, code: "too-short", message: `Words need at least ${s.minimumWordLength} letters; ${word} has ${word.length}.` };
    const b = boardOf(s);
    const p = boardProblem(b, word);
    if (p?.code === "letter-not-on-board") return { legal: false, code: "letter-not-on-board", message: `${p.letter} is not on the board.` };
    if (p?.code === "same-side")
      return {
        legal: false,
        code: "same-side",
        message: `${p.a} and ${p.b} are both on the ${SIDE_NAMES[p.side]} side. Consecutive letters must come from different sides.`,
      };
    const start = requiredStart(s);
    if (start && word[0] !== start)
      return { legal: false, code: "wrong-start", message: `Your next word must start with ${start}, the last letter of ${s.chain[s.chain.length - 1].word}.` };
    if (!membership.has(word) && !s.pool.includes(word))
      return { legal: false, code: "not-in-word-list", message: `${word} is not in this game's word list. Names, abbreviations and some rare words are excluded.` };
    const newLetters = [...new Set(word)].filter((l) => !(coverage(s) & (1 << b.bitOf.get(l)!)));
    return {
      legal: true,
      code: "ok",
      message: newLetters.length ? `${word} would add ${newLetters.join(", ")}.` : `${word} adds no new letters, but it would move you to ${word[word.length - 1]}.`,
    };
  }

  function commit(s: CircuitState, word: string, assisted: boolean): { state: CircuitState; code: string; message: string } {
    const b = boardOf(s);
    const before = coverage(s);
    const chain = [...s.chain, { word, assisted }];
    const chainAssisted = s.chainAssisted || assisted;
    let next: CircuitState = { ...s, chain, chainAssisted, hintFocus: null, hintLevel: 0 };
    const after = coverage(next);
    const added = popcount(after & ~before);
    if (after !== b.fullMask) {
      const left = b.letters.length - popcount(after);
      return {
        state: next,
        code: added ? "accepted" : "bridge",
        message: `${word} accepted${added ? `, adding ${plural(added, "new letter")}` : ", a bridge word with no new letters"}. ${plural(left, "letter")} still to use; next word starts with ${word[word.length - 1]}.`,
      };
    }
    const done: BestChain = { words: chain.map((c) => c.word), played: chain.map((c) => c.assisted), letters: chain.reduce((n, c) => n + c.word.length, 0), assisted: chainAssisted };
    const improved = better(done, s.best);
    next = { ...next, best: improved ? done : s.best, completions: s.completions + 1, improving: false };
    const vsPar = done.words.length <= s.par ? (done.words.length < s.par ? " That beats par!" : " That matches par!") : ` Par is ${s.par}.`;
    const msg = !s.best
      ? `${word} completes the circuit: every letter used in ${plural(done.words.length, "word")}.${vsPar}`
      : improved
        ? `New best: ${plural(done.words.length, "word")} (${done.letters} letters).${vsPar}`
        : `Complete in ${plural(done.words.length, "word")}. Your best stays at ${plural(s.best.words.length, "word")}.`;
    return { state: next, code: "complete", message: msg };
  }

  const engine: GameEngine<CircuitPayload, CircuitState, CircuitAction, string> = {
    gameId: "letter-circuit",
    rulesVersion: RULES_VERSION,

    initialise(round: CircuitPayload, _options: SessionOptions): CircuitState {
      void _options;
      const board = makeBoard(round.sides);
      return {
        sides: board.sides,
        letters: board.letters,
        minimumWordLength: round.minimumWordLength,
        par: round.par,
        master: round.pool === "master",
        parChain: round.parChain,
        pool: round.parPool.split(" ").filter(Boolean),
        explanation: round.explanation,
        chain: [],
        chainAssisted: false,
        best: null,
        completions: 0,
        improving: false,
        hintFocus: null,
        hintLevel: 0,
        hints: [],
      };
    },

    preview(state, draft) {
      return analyse(state, draft);
    },

    apply(state, action): Transition<CircuitState> {
      const locked = !!state.best && !state.improving;
      switch (action.type) {
        case "submit": {
          if (locked) return reject(state, "finished", "This circuit is complete. Choose Try for fewer words to start a new chain.");
          if (chainComplete(state)) return reject(state, "finished", "This chain already uses every letter.");
          const a = analyse(state, action.word);
          if (!a.legal) return reject(state, a.code, a.message);
          const word = normaliseWord(action.word).word;
          const r = commit(state, word, false);
          return accept(r.state, r.code, r.message);
        }
        case "undo": {
          if (locked) return reject(state, "finished", "This circuit is complete. Start a new chain to keep playing.");
          if (!state.chain.length) return reject(state, "nothing-to-undo", "There is no word to undo.");
          const removed = state.chain[state.chain.length - 1].word;
          const next: CircuitState = { ...state, chain: state.chain.slice(0, -1), hintFocus: null, hintLevel: 0 };
          const lost = popcount(coverage(state) & ~coverage(next));
          return accept(next, "undone", `Removed ${removed}.${lost ? ` ${plural(lost, "letter")} no longer used.` : " Every letter it used is still covered by earlier words."}`);
        }
        case "new-chain": {
          if (!state.chain.length && !locked) return reject(state, "nothing-to-clear", "Your chain is already empty.");
          const next: CircuitState = { ...state, chain: [], chainAssisted: false, improving: !!state.best, hintFocus: null, hintLevel: 0 };
          return accept(
            next,
            "new-chain",
            state.best ? `New chain started. Your best of ${plural(state.best.words.length, "word")} is kept.` : "New chain started. Any word can begin it.",
          );
        }
        case "show-best": {
          if (!state.best || !state.improving) return reject(state, "nothing-to-show", "There is no completed chain to show yet.");
          return accept({ ...state, improving: false, chain: [], chainAssisted: false, hintFocus: null, hintLevel: 0 }, "show-best", "Showing your best chain.");
        }
        case "hint": {
          if (locked) return reject(state, "hint-unavailable", "This circuit is complete.");
          const word = focusFor(state);
          if (!word) return reject(state, "hint-unavailable", chainComplete(state) ? "This chain is complete." : `No ${lexName(state)} route finishes from here. Try Undo or start a new chain.`);
          const level = state.hintFocus?.at === focusKey(state) ? state.hintLevel : 0;
          const b = boardOf(state);
          const cov = coverage(state);
          const fresh = [...new Set(word)].filter((l) => !(cov & (1 << b.bitOf.get(l)!)));
          const remainingPlan = plan(state).words ?? 0;
          if (action.tier === HINT_LETTERS) {
            if (level >= 1) return reject(state, "hint-unavailable", "You already have this nudge.");
            const start = requiredStart(state);
            const text = `${start ? `From ${start}, try` : "Try"} a ${word.length}-letter word starting with ${word[0]} that uses ${fresh.length ? fresh.join(", ") : "no new letters (a bridge)"}. A ${lexName(state)} route finishes in ${plural(remainingPlan, "more word")}.`;
            return accept(
              { ...state, chainAssisted: true, hintFocus: { word, at: focusKey(state) }, hintLevel: 1, hints: [...state.hints, { tier: HINT_LETTERS, text, word }] },
              "hint",
              text,
            );
          }
          if (action.tier === HINT_WORD) {
            if (level < 1) return reject(state, "hint-unavailable", "Take the letters nudge first.");
            if (level >= 2) return reject(state, "hint-unavailable", "You already have this word.");
            const text = `Suggested next word: ${word}.`;
            return accept(
              { ...state, chainAssisted: true, hintFocus: { word, at: focusKey(state) }, hintLevel: 2, hints: [...state.hints, { tier: HINT_WORD, text, word }] },
              "hint",
              `${text} Type it and submit when you are ready.`,
            );
          }
          if (action.tier === HINT_PLAY) {
            const r = commit({ ...state, hints: [...state.hints, { tier: HINT_PLAY, text: `Played ${word} for you.`, word }] }, word, true);
            return accept(r.state, r.code === "complete" ? "complete" : "revealed", `Played ${word} for you (marked as help). ${r.message}`);
          }
          return reject(state, "hint-unavailable", "That hint does not exist.");
        }
        default:
          return reject(state, "unknown-action", "Unknown action.");
      }
    },

    hints(state): HintOffer[] {
      const locked = !!state.best && !state.improving;
      const word = locked ? null : focusFor(state);
      const level = word && state.hintFocus?.at === focusKey(state) ? state.hintLevel : 0;
      const none = locked ? "This circuit is complete." : chainComplete(state) ? "This chain is complete." : `No ${lexName(state)} route finishes from here. Try Undo or start a new chain.`;
      return [
        {
          tier: HINT_LETTERS,
          label: "Letters to aim for",
          description: "Names the first letter, length and new letters of a word that starts where your chain ends and lies on a shortest route through the round's word pool (everyday words, or the wider Master pool in Master rounds).",
          available: !!word && level < 1,
          reason: word ? "Already taken for this position." : none,
          reveal: false,
          cost: "Recorded as a hint; the chain you finish is marked as helped.",
        },
        {
          tier: HINT_WORD,
          label: "Show the word",
          description: "Shows that word. You still type and submit it yourself.",
          available: !!word && level === 1,
          reason: !word ? none : level < 1 ? "Take the letters nudge first." : "Already shown.",
          reveal: false,
          cost: "Recorded as a hint; the chain you finish is marked as helped.",
        },
        {
          tier: HINT_PLAY,
          label: "Play it for me",
          description: "Adds that word to your chain.",
          available: !!word,
          reason: none,
          reveal: true,
          cost: "The word is marked as played for you.",
        },
      ];
    },

    outcome(state): Outcome {
      return state.best && !state.improving ? "completed" : "playing";
    },

    result(state): ResultSummary | null {
      if (!state.best || state.improving) return null;
      const best = state.best;
      const n = best.words.length;
      const hints = state.hints.filter((h) => h.tier !== HINT_PLAY).length;
      const played = state.hints.filter((h) => h.tier === HINT_PLAY).length;
      const vsPar = n < state.par ? `${state.par - n} under par` : n === state.par ? "matching par" : `${n - state.par} over par`;
      return {
        outcome: "completed",
        headline: n <= state.par ? `Circuit complete in ${plural(n, "word")}, ${vsPar}!` : `Circuit complete in ${plural(n, "word")} (par ${state.par}).`,
        scoreText: `${plural(n, "word")} · par ${state.par}`,
        score: n,
        maxScore: state.par,
        efficiency: Math.min(1, state.par / n),
        assistance: { hints, reveals: played },
        details: [
          `Best chain: ${best.words.join(" → ")} (${best.letters} letters)${best.assisted ? ", with help" : ", unaided"}.`,
          state.master
            ? `Par is ${state.par}: the fewest words a computer search found using the Master pool (everyday plus less common words of three to ten letters). Rarer words from the full word list can sometimes beat it.`
            : `Par is ${state.par}: the fewest words a computer search found using only everyday words. Longer word-list words can sometimes beat it.`,
          state.completions > 1 ? `You completed the circuit ${plural(state.completions, "time")}; your best is kept.` : "Try for fewer words to see if you can beat your chain; your best is kept.",
          hints || played ? `Help used: ${plural(hints, "hint")}, ${plural(played, "word")} played for you.` : "No hints used.",
        ],
        shareText: `Word Club · Letter Circuit · ${plural(n, "word")} (par ${state.par})${best.assisted ? " · with help" : " · unassisted"}`,
        explanation: [`One par route: ${state.parChain.join(" → ")}.`, state.explanation],
      };
    },
  };
  return engine;
}
