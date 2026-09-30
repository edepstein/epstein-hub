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
import { distancesFrom, hamming, neighbours } from "./graph";

export const RULES_VERSION = "1.0";

export interface LadderPayload {
  start: string;
  target: string;
  /** Minimum number of moves under the pinned membership list (checked by the validator and recomputed by the engine). */
  optimalMoves: number;
  /** One shortest route using familiar words. An example, never the only accepted answer. */
  examplePath: string[];
  /** Optional visible word bank (Gentle and demo rounds). */
  bank?: string[];
  explanation: string;
  /** Pack demo fixtures only: the original finite round dictionary and its stored optimum (regression data). */
  fixtureDictionary?: string[];
  fixtureOptimalMoves?: number;
}

export interface Step {
  word: string;
  /** Inserted by a hint rather than typed by the player. */
  assisted: boolean;
}

export const HINT_POSITION = 1;
export const HINT_NEXT = 2;
export const HINT_INSERT = 3;
export const HINT_REVEAL = 4;

export interface HintRecord {
  tier: number;
  text: string;
  /** The current word when the hint was taken, and its index in the route. */
  from: string;
  atStep: number;
  word: string | null;
  position: number | null;
}

export interface LadderState {
  start: string;
  target: string;
  length: number;
  /** BFS minimum under the membership this engine was created with. */
  optimalMoves: number;
  path: Step[];
  hints: HintRecord[];
  revealed: boolean;
  /** Accepted moves ever made, including ones later taken back. */
  movesTried: number;
  undos: number;
  examplePath: string[];
  bank: string[];
  explanation: string;
}

export type LadderAction =
  | { type: "submit"; word: string }
  | { type: "undo" }
  | { type: "backtrack"; to: number }
  | { type: "hint"; tier: number };

export function ladderScore(optimal: number, moves: number): number {
  if (moves <= 0) return 0;
  return Math.min(100, 60 + Math.floor((40 * optimal) / moves));
}

const ordinal = (n: number) => ["first", "second", "third", "fourth", "fifth", "sixth", "seventh"][n] ?? `${n + 1}th`;

export const current = (s: Pick<LadderState, "path">) => s.path[s.path.length - 1].word;
export const moves = (s: Pick<LadderState, "path">) => s.path.length - 1;
export const isComplete = (s: Pick<LadderState, "path" | "target">) => current(s) === s.target;

export interface Suggestion {
  /** Shortest number of moves still needed without reusing a word already on the route. */
  remaining: number;
  next: string;
  position: number;
  /** The whole suggested remaining route, excluding the current word. */
  route: string[];
}

/**
 * Word Ladder engine factory. `membership` is the pinned gameplay word list; `familiar` (optional)
 * is only used to prefer everyday words when a hint has several equally short choices.
 */
export function createWordLadderEngine(
  membership: ReadonlySet<string>,
  familiar: ReadonlySet<string> = new Set(),
): GameEngine<LadderPayload, LadderState, LadderAction, string> & { suggest(state: LadderState): Suggestion | null } {
  const distCache = new Map<string, Map<string, number>>();
  const has = (extra: ReadonlySet<string>, blocked: ReadonlySet<string>) => (w: string) => !blocked.has(w) && (membership.has(w) || extra.has(w));

  function distances(target: string, extra: ReadonlySet<string>, blocked: ReadonlySet<string>, familiarOnly = false): Map<string, number> {
    const key = `${familiarOnly ? "F" : "M"}|${target}|${[...extra].sort().join(",")}|${[...blocked].sort().join(",")}`;
    let d = distCache.get(key);
    if (!d) {
      const base = has(extra, blocked);
      d = distancesFrom(target, familiarOnly ? (w) => base(w) && (familiar.has(w) || extra.has(w)) : base);
      if (distCache.size > 200) distCache.clear();
      distCache.set(key, d);
    }
    return d;
  }

  const endpoints = (s: Pick<LadderState, "start" | "target">) => new Set([s.start, s.target]);

  /** Shortest remaining route from the current word that does not revisit earlier route words. */
  function suggest(state: LadderState): Suggestion | null {
    const cur = current(state);
    if (cur === state.target) return null;
    const blocked = new Set(state.path.slice(0, -1).map((p) => p.word));
    const extra = endpoints(state);
    const dist = distances(state.target, extra, blocked);
    const famDist = distances(state.target, extra, blocked, true);
    const d = dist.get(cur);
    if (d == null) return null;
    const route: string[] = [];
    let w = cur;
    let remaining = d;
    const ex = state.examplePath;
    while (w !== state.target) {
      const cands = neighbours(w, has(extra, blocked)).filter((n) => dist.get(n) === remaining - 1);
      const i = ex.indexOf(w);
      const exNext = i >= 0 ? ex[i + 1] : undefined;
      const rank = (n: string) => (n === exNext ? 0 : famDist.get(n) === remaining - 1 ? 1 : familiar.has(n) ? 2 : 3);
      cands.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
      w = cands[0];
      route.push(w);
      remaining -= 1;
    }
    const next = route[0];
    const position = [...cur].findIndex((c, k) => c !== next[k]);
    return { remaining: d, next, position, route };
  }

  function hintLevel(state: LadderState): number {
    const at = state.path.length - 1;
    const cur = current(state);
    return state.hints.filter((h) => h.from === cur && h.atStep === at && h.tier <= HINT_NEXT).reduce((m, h) => Math.max(m, h.tier), 0);
  }

  function analyse(state: LadderState, raw: string): Analysis {
    if (isComplete(state)) return { legal: false, code: "complete", message: `You have already reached ${state.target}. This ladder is complete.` };
    if (state.revealed) return { legal: false, code: "complete", message: "The route has been revealed, so this ladder is closed." };
    const { word, problem } = normaliseWord(raw);
    const cur = current(state);
    if (problem === "empty") return { legal: false, code: "empty", message: `Type a word that changes one letter of ${cur}.` };
    if (problem === "non-letters") return { legal: false, code: "non-letters", message: "Use letters A to Z only, with no spaces or punctuation." };
    if (word.length !== state.length)
      return {
        legal: false,
        code: "wrong-length",
        message: `Every word in this ladder has ${state.length} letters; ${word} has ${word.length}. Adding or removing letters is not allowed.`,
      };
    const diff = hamming(cur, word);
    if (diff === 0) return { legal: false, code: "no-change", message: `${word} is your current word. Change exactly one letter.` };
    if (diff > 1)
      return {
        legal: false,
        code: "too-many-changes",
        message: `${word} changes ${diff} letters of ${cur}. Change exactly one letter in place; rearranging is not allowed.`,
      };
    if (word !== state.target && !membership.has(word)) return { legal: false, code: "not-in-word-list", message: `${word} is not in this game's word list.` };
    const idx = state.path.findIndex((p) => p.word === word);
    if (idx >= 0)
      return {
        legal: false,
        code: "repeated",
        message: `${word} is already on your route (step ${idx}). A ladder never repeats a word; use Back to return to it.`,
      };
    return { legal: true, code: "ok", message: `${cur} to ${word} is a legal step.` };
  }

  function appendSteps(state: LadderState, words: string[], assisted: boolean): LadderState {
    return {
      ...state,
      path: [...state.path, ...words.map((word) => ({ word, assisted }))],
      movesTried: state.movesTried + words.length,
    };
  }

  const engine = {
    gameId: "word-ladder",
    rulesVersion: RULES_VERSION,
    suggest,

    initialise(round: LadderPayload, _options: SessionOptions): LadderState {
      void _options;
      const start = round.start.toUpperCase();
      const target = round.target.toUpperCase();
      const dist = distances(target, new Set([start, target]), new Set());
      return {
        start,
        target,
        length: start.length,
        optimalMoves: dist.get(start) ?? round.optimalMoves,
        path: [{ word: start, assisted: false }],
        hints: [],
        revealed: false,
        movesTried: 0,
        undos: 0,
        examplePath: round.examplePath.map((w) => w.toUpperCase()),
        bank: (round.bank ?? []).map((w) => w.toUpperCase()),
        explanation: round.explanation,
      };
    },

    preview(state: LadderState, draft: string): Analysis {
      return analyse(state, draft);
    },

    apply(state: LadderState, action: LadderAction): Transition<LadderState> {
      switch (action.type) {
        case "submit": {
          const a = analyse(state, action.word);
          if (!a.legal) return reject(state, a.code, a.message);
          const word = normaliseWord(action.word).word;
          const next = appendSteps(state, [word], false);
          if (word === state.target) {
            const m = moves(next);
            return accept(next, "complete", `${word}! You reached the target in ${plural(m, "move")}; the shortest possible is ${state.optimalMoves}.`);
          }
          return accept(next, "step", `${word} added. Move ${moves(next)}. Next: change one letter of ${word}.`);
        }
        case "undo": {
          if (isComplete(state) || state.revealed) return reject(state, "complete", "This ladder is finished, so its route is locked.");
          if (state.path.length < 2) return reject(state, "nothing-to-undo", "You are at the starting word; there is nothing to take back.");
          const removed = current(state);
          const path = state.path.slice(0, -1);
          return accept({ ...state, path, undos: state.undos + 1 }, "undone", `Took back ${removed}. You are on ${path[path.length - 1].word} again.`);
        }
        case "backtrack": {
          if (isComplete(state) || state.revealed) return reject(state, "complete", "This ladder is finished, so its route is locked.");
          const to = action.to;
          if (!Number.isInteger(to) || to < 0 || to >= state.path.length - 1) return reject(state, "bad-step", "Choose an earlier word on your route to go back to.");
          const removed = state.path.length - 1 - to;
          const path = state.path.slice(0, to + 1);
          return accept(
            { ...state, path, undos: state.undos + removed },
            "undone",
            `Went back to ${path[to].word}, removing ${plural(removed, "later step")}.`,
          );
        }
        case "hint": {
          if (isComplete(state) || state.revealed) return reject(state, "hint-unavailable", "This ladder is finished.");
          const s = suggest(state);
          const cur = current(state);
          if (!s) return reject(state, "no-route", `No route to ${state.target} from ${cur} avoids the words already on your route. Use Back to try another way.`);
          const at = state.path.length - 1;
          const level = hintLevel(state);
          const record = (tier: number, text: string, word: string | null, position: number | null): HintRecord => ({ tier, text, from: cur, atStep: at, word, position });
          if (action.tier === HINT_POSITION) {
            if (level >= HINT_POSITION) return reject(state, "hint-unavailable", "You already have this hint for the current word.");
            const text = `From ${cur}, change the ${ordinal(s.position)} letter (${cur[s.position]}).`;
            return accept({ ...state, hints: [...state.hints, record(HINT_POSITION, text, null, s.position)] }, "hint", text);
          }
          if (action.tier === HINT_NEXT) {
            if (level >= HINT_NEXT) return reject(state, "hint-unavailable", "You already have the next word for this position.");
            const text = `From ${cur}, ${s.next} is one step along a shortest remaining route.`;
            return accept({ ...state, hints: [...state.hints, record(HINT_NEXT, text, s.next, s.position)] }, "hint", text);
          }
          if (action.tier === HINT_INSERT) {
            const text = `Inserted ${s.next} after ${cur}.`;
            const next = appendSteps({ ...state, hints: [...state.hints, record(HINT_INSERT, text, s.next, s.position)] }, [s.next], true);
            const done = s.next === state.target;
            return accept(next, done ? "complete" : "inserted", done ? `${text} That reaches ${state.target}.` : `${text} It is marked as a hinted step.`);
          }
          if (action.tier === HINT_REVEAL) {
            const text = `Revealed the rest of a shortest route: ${s.route.join(", ")}.`;
            const next = appendSteps({ ...state, revealed: true, hints: [...state.hints, record(HINT_REVEAL, text, null, null)] }, s.route, true);
            return accept(next, "revealed", text);
          }
          return reject(state, "hint-unavailable", "That hint does not exist.");
        }
        default:
          return reject(state, "unknown-action", "Unknown action.");
      }
    },

    hints(state: LadderState): HintOffer[] {
      const finished = isComplete(state) || state.revealed;
      const s = finished ? null : suggest(state);
      const level = hintLevel(state);
      const cur = current(state);
      const none = finished ? "The ladder is finished." : `No route from ${cur} avoids your earlier words. Use Back first.`;
      return [
        {
          tier: HINT_POSITION,
          label: "Which letter to change",
          description: `Marks a letter of ${cur} that changes on a shortest remaining route.`,
          available: !!s && level < HINT_POSITION,
          reason: s ? "Already taken for this word." : none,
          reveal: false,
          cost: "No points lost; your result is marked assisted.",
        },
        {
          tier: HINT_NEXT,
          label: "Next word",
          description: `Names a word one step from ${cur} on a shortest remaining route, worked out from where you are now.`,
          available: !!s && level < HINT_NEXT,
          reason: s ? "Already taken for this word." : none,
          reveal: false,
          cost: "No points lost; your result is marked assisted.",
        },
        {
          tier: HINT_INSERT,
          label: "Insert the next word",
          description: `Adds that next word to your route for you, marked as a hinted step. You can still take it back.`,
          available: !!s,
          reason: none,
          reveal: true,
          cost: "The step counts as a move and your result is marked assisted.",
        },
        {
          tier: HINT_REVEAL,
          label: "Reveal the whole route",
          description: `Completes a shortest route from ${cur} to ${state.target} and ends the round.`,
          available: !!s,
          reason: none,
          reveal: true,
          cost: "The round is recorded as revealed, not solved, and scores nothing.",
        },
      ];
    },

    outcome(state: LadderState): Outcome {
      if (state.revealed) return "revealed";
      if (isComplete(state)) return "completed";
      return "playing";
    },

    result(state: LadderState): ResultSummary | null {
      const outcome = engine.outcome(state);
      if (outcome === "playing") return null;
      const m = moves(state);
      const hinted = state.path.filter((p) => p.assisted).length;
      const nudges = state.hints.filter((h) => h.tier === HINT_POSITION || h.tier === HINT_NEXT).length;
      const inserts = state.hints.filter((h) => h.tier === HINT_INSERT).length;
      const reveals = state.revealed ? 1 : 0;
      const route = state.path.map((p) => (p.assisted ? `${p.word} (hint)` : p.word)).join(" → ");
      const example = state.examplePath.join(" → ");
      const assisted = nudges + inserts + reveals > 0;
      if (outcome === "revealed") {
        return {
          outcome,
          headline: `Route revealed: ${state.start} to ${state.target}.`,
          scoreText: "No score for a revealed route",
          efficiency: null,
          assistance: { hints: nudges + inserts, reveals },
          details: [
            `Your route had ${plural(state.hints.find((h) => h.tier === HINT_REVEAL)?.atStep ?? m, "move")} before the reveal.`,
            `Full route: ${route}.`,
            `The shortest possible is ${plural(state.optimalMoves, "move")}, for example ${example}.`,
          ],
          shareText: `Word Club · Word Ladder · ${state.length} letters · route revealed · best ${state.optimalMoves}`,
          explanation: [state.explanation, `A shortest route: ${example}.`],
        };
      }
      const score = ladderScore(state.optimalMoves, m);
      const eff = state.optimalMoves / m;
      return {
        outcome,
        headline: m === state.optimalMoves ? `Reached ${state.target} in ${plural(m, "move")}: the shortest possible.` : `Reached ${state.target} in ${plural(m, "move")}. The shortest possible is ${state.optimalMoves}.`,
        scoreText: `${score} of 100 points`,
        score,
        maxScore: 100,
        efficiency: eff,
        assistance: { hints: nudges + inserts, reveals },
        details: [
          `Your route: ${route}.`,
          `A shortest route: ${example}. Any legal route counts; this is only an example.`,
          `Score: 60 for completing, plus ${Math.floor((40 * state.optimalMoves) / m)} for efficiency (${state.optimalMoves} ÷ ${m} of 40).`,
          `${plural(state.movesTried, "step")} tried in total, ${plural(state.undos, "step")} taken back.`,
          hinted ? `${plural(hinted, "step")} came from hints.` : assisted ? `${plural(nudges, "hint")} taken.` : "No hints taken.",
        ],
        shareText: `Word Club · Word Ladder · ${state.length} letters · ${m} moves (best ${state.optimalMoves}) · ${score}/100 · ${assisted ? `assisted (${plural(nudges + inserts, "hint")})` : "unassisted"}`,
        explanation: [state.explanation, `A shortest route: ${example}.`],
      };
    },
  };
  return engine;
}
