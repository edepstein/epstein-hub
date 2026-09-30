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
import { plural } from "@/lib/text";

export const RULES_VERSION = "1.0";

export interface PhraseToken {
  /** Stable identity; duplicate words are distinct tokens with different ids. */
  id: string;
  text: string;
}

export interface PhrasePayload {
  clue: string;
  /** Letters per word of the target phrase(s); every accepted target fits it. */
  enumeration: number[];
  /** Tiles in their starting (scrambled) order. */
  tokens: PhraseToken[];
  /** Every accepted complete word sequence. */
  acceptedTargets: string[][];
  /** Stored minimum adjacent swaps from the starting order (recomputed by the validator). */
  minimumAdjacentSwaps: number;
  /** Proper nouns in the phrase (exempt from the membership spelling check). */
  properNouns?: string[];
  explanation: string;
}

export interface PhraseHint {
  tier: number;
  text: string;
}

export interface PhraseState {
  clue: string;
  enumeration: number[];
  tokens: Record<string, string>;
  initial: string[];
  targets: string[][];
  explanation: string;
  /** Current order of token ids. */
  order: string[];
  /** Every board change so far, including undos (each is one adjacent swap). */
  moves: number;
  /** Left index of each swap still on the undo stack. */
  history: number[];
  /** Minimum adjacent swaps from the starting order to the nearest accepted target. */
  minimum: number;
  solved: boolean;
  revealed: boolean;
  hints: PhraseHint[];
  firstWordShown: boolean;
  /** Token marked as already in its final place by the hint (not locked). */
  markedToken: string | null;
  markedTaken: boolean;
  nextMoveHints: number;
}

export type PhraseAction =
  | { type: "swap"; a: number; b: number }
  | { type: "undo" }
  | { type: "check" }
  | { type: "hint"; tier: number };

export const HINT_FIRST_WORD = 1;
export const HINT_CORRECT_TILE = 2;
export const HINT_NEXT_MOVE = 3;
export const HINT_REVEAL = 4;

/**
 * Minimum adjacent swaps turning `words` into `target` when both are the same multiset.
 * Identical words are matched in order (k-th occurrence to k-th occurrence), which never
 * creates an inversion between equal words, so the inversion count of the resulting
 * permutation is the true minimum (verified exhaustively for small boards in tests/validator).
 * Returns null when the multisets differ.
 */
export function minSwaps(words: readonly string[], target: readonly string[]): number | null {
  const perm = targetPositions(words, target);
  if (!perm) return null;
  let inv = 0;
  for (let i = 0; i < perm.length; i++) for (let j = i + 1; j < perm.length; j++) if (perm[i] > perm[j]) inv++;
  return inv;
}

/** Target index for each current position under order-preserving matching of equal words. */
export function targetPositions(words: readonly string[], target: readonly string[]): number[] | null {
  if (words.length !== target.length) return null;
  const queues = new Map<string, number[]>();
  target.forEach((w, i) => {
    const q = queues.get(w) ?? [];
    q.push(i);
    queues.set(w, q);
  });
  const perm: number[] = [];
  for (const w of words) {
    const q = queues.get(w);
    if (!q || !q.length) return null;
    perm.push(q.shift()!);
  }
  return perm;
}

/** Exhaustive breadth-first minimum (for validation of small boards). */
export function bfsMinSwaps(words: readonly string[], targets: readonly (readonly string[])[]): number | null {
  const goal = new Set(targets.map((t) => t.join("\u0001")));
  const startKey = words.join("\u0001");
  if (goal.has(startKey)) return 0;
  const seen = new Set([startKey]);
  let frontier = [words.slice()];
  for (let depth = 1; frontier.length; depth++) {
    const next: string[][] = [];
    for (const w of frontier) {
      for (let i = 0; i + 1 < w.length; i++) {
        if (w[i] === w[i + 1]) continue;
        const n = w.slice();
        [n[i], n[i + 1]] = [n[i + 1], n[i]];
        const k = n.join("\u0001");
        if (goal.has(k)) return depth;
        if (!seen.has(k)) {
          seen.add(k);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return null;
}

export function wordsOf(s: Pick<PhraseState, "order" | "tokens">): string[] {
  return s.order.map((id) => s.tokens[id]);
}

/** The accepted target nearest to the current board (fewest swaps; first listed wins ties). */
export function nearestTarget(s: Pick<PhraseState, "order" | "tokens" | "targets">): { target: string[]; distance: number } {
  const words = wordsOf(s);
  let best: { target: string[]; distance: number } | null = null;
  for (const t of s.targets) {
    const d = minSwaps(words, t);
    if (d !== null && (!best || d < best.distance)) best = { target: t, distance: d };
  }
  return best ?? { target: s.targets[0], distance: Number.POSITIVE_INFINITY };
}

/** A swap (left index) that lowers the distance to the nearest target by one, or null when solved. */
export function efficientMove(s: Pick<PhraseState, "order" | "tokens" | "targets">): number | null {
  const { target } = nearestTarget(s);
  const perm = targetPositions(wordsOf(s), target);
  if (!perm) return null;
  for (let i = 0; i + 1 < perm.length; i++) if (perm[i] > perm[i + 1]) return i;
  return null;
}

export function scoreFor(minimum: number, moves: number): number {
  if (minimum === 0 || moves <= 0) return 100;
  return Math.min(100, 60 + Math.floor((40 * minimum) / moves));
}

function sentence(words: string[]) {
  const s = words.join(" ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

export function createPhraseRepairEngine(): GameEngine<PhrasePayload, PhraseState, PhraseAction> {
  const matches = (s: PhraseState) => {
    const words = wordsOf(s).join(" ");
    return s.targets.some((t) => t.join(" ") === words);
  };
  const finished = (s: PhraseState) => s.solved || s.revealed;

  function doSwap(s: PhraseState, i: number): PhraseState {
    const order = s.order.slice();
    [order[i], order[i + 1]] = [order[i + 1], order[i]];
    return { ...s, order, markedToken: s.markedToken };
  }

  const engine: GameEngine<PhrasePayload, PhraseState, PhraseAction> = {
    gameId: "phrase-repair",
    rulesVersion: RULES_VERSION,

    initialise(round: PhrasePayload, _options: SessionOptions): PhraseState {
      void _options;
      const tokens: Record<string, string> = {};
      for (const t of round.tokens) tokens[t.id] = t.text.toUpperCase();
      const initial = round.tokens.map((t) => t.id);
      const targets = round.acceptedTargets.map((t) => t.map((w) => w.toUpperCase()));
      const base = { order: initial, tokens, targets };
      return {
        clue: round.clue,
        enumeration: round.enumeration.slice(),
        tokens,
        initial,
        targets,
        explanation: round.explanation,
        order: initial.slice(),
        moves: 0,
        history: [],
        minimum: nearestTarget(base).distance,
        solved: false,
        revealed: false,
        hints: [],
        firstWordShown: false,
        markedToken: null,
        markedTaken: false,
        nextMoveHints: 0,
      };
    },

    preview(state) {
      return { legal: !finished(state), code: finished(state) ? "finished" : "ok", message: `${plural(state.moves, "swap")} so far.` };
    },

    apply(state, action): Transition<PhraseState> {
      if (finished(state) && action.type !== "check") return reject(state, "finished", "This phrase is already finished. Start again to practise it.");
      switch (action.type) {
        case "swap": {
          const { a, b } = action;
          const n = state.order.length;
          if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= n || b >= n)
            return reject(state, "out-of-range", "There is no tile in that position.");
          if (Math.abs(a - b) !== 1)
            return reject(state, "not-adjacent", `Only neighbouring tiles can swap in one move. Positions ${a + 1} and ${b + 1} are not next to each other.`);
          const i = Math.min(a, b);
          const next = doSwap(state, i);
          const words = wordsOf(next);
          return accept(
            { ...next, moves: state.moves + 1, history: [...state.history, i] },
            "swapped",
            `Swapped ${words[i + 1]} and ${words[i]}: ${words[i]} is now word ${i + 1} and ${words[i + 1]} is word ${i + 2}. ${plural(state.moves + 1, "swap")} so far.`,
          );
        }
        case "undo": {
          if (!state.history.length) return reject(state, "nothing-to-undo", "There is no swap to undo.");
          const i = state.history[state.history.length - 1];
          const next = doSwap(state, i);
          const words = wordsOf(next);
          return accept(
            { ...next, moves: state.moves + 1, history: state.history.slice(0, -1) },
            "undone",
            `Undid the last swap: ${words[i]} is back at word ${i + 1}. Undo counts as a swap, so your count is now ${state.moves + 1}.`,
          );
        }
        case "check": {
          if (state.solved) return reject(state, "finished", "Already repaired.");
          if (state.revealed) return reject(state, "finished", "This phrase was revealed.");
          if (!matches(state)) return reject(state, "not-yet", "Not repaired yet. Keep swapping neighbours; your tiles are unchanged.");
          const score = scoreFor(state.minimum, state.moves);
          return accept(
            { ...state, solved: true },
            "completed",
            `Repaired: ${sentence(wordsOf(state))} ${plural(state.moves, "swap")} against a minimum of ${state.minimum}, scoring ${score}.`,
          );
        }
        case "hint": {
          const { target } = nearestTarget(state);
          if (action.tier === HINT_FIRST_WORD) {
            if (state.firstWordShown) return reject(state, "hint-unavailable", "You already have the first word.");
            const text = `The phrase begins ${target[0]}.`;
            return accept({ ...state, firstWordShown: true, hints: [...state.hints, { tier: HINT_FIRST_WORD, text }] }, "hint", text);
          }
          if (action.tier === HINT_CORRECT_TILE) {
            if (state.markedTaken) return reject(state, "hint-unavailable", "You have already used this hint.");
            const words = wordsOf(state);
            const idx = words.findIndex((w, i) => w === target[i]);
            const text =
              idx < 0
                ? "No tile is in its final place yet."
                : `${words[idx]} (word ${idx + 1}) is already in its final place. It is not locked; you can still move it.`;
            return accept(
              { ...state, markedTaken: true, markedToken: idx < 0 ? null : state.order[idx], hints: [...state.hints, { tier: HINT_CORRECT_TILE, text }] },
              "hint",
              text,
            );
          }
          if (action.tier === HINT_NEXT_MOVE) {
            const i = efficientMove(state);
            if (i === null) return reject(state, "hint-unavailable", "The tiles already read as the phrase. Press Check phrase.");
            const words = wordsOf(state);
            const text = `An efficient next move: swap ${words[i]} and ${words[i + 1]} (words ${i + 1} and ${i + 2}).`;
            return accept({ ...state, nextMoveHints: state.nextMoveHints + 1, hints: [...state.hints, { tier: HINT_NEXT_MOVE, text }] }, "hint", text);
          }
          if (action.tier === HINT_REVEAL) {
            // Arrange the tiles as the nearest target, keeping token identities (order-preserving for duplicates).
            const perm = targetPositions(wordsOf(state), target)!;
            const order: string[] = new Array(perm.length);
            perm.forEach((p, i) => (order[p] = state.order[i]));
            const text = `Revealed: ${sentence(target)}`;
            return accept({ ...state, order, revealed: true, hints: [...state.hints, { tier: HINT_REVEAL, text }] }, "revealed", `${text} The round is recorded as revealed.`);
          }
          return reject(state, "hint-unavailable", "That hint does not exist.");
        }
        default:
          return reject(state, "unknown-action", "Unknown action.");
      }
    },

    hints(state): HintOffer[] {
      if (finished(state)) return [];
      const cost = "No points lost; the result records one hint.";
      return [
        { tier: HINT_FIRST_WORD, label: "First word", description: "Shows the first word of the phrase.", available: !state.firstWordShown, reason: "Already taken.", reveal: false, cost },
        {
          tier: HINT_CORRECT_TILE,
          label: "A tile in place",
          description: "Marks one tile that is already in its final position, without locking it.",
          available: !state.markedTaken,
          reason: "Already taken.",
          reveal: false,
          cost,
        },
        {
          tier: HINT_NEXT_MOVE,
          label: "Efficient next move",
          description: "Names a neighbouring swap that brings the phrase one step closer. You can ask again at any point.",
          available: efficientMove(state) !== null,
          reason: "The tiles already read as the phrase.",
          reveal: false,
          cost: "Your moves still count; each use is recorded as a hint.",
        },
        { tier: HINT_REVEAL, label: "Reveal the phrase", description: "Puts every tile in place and ends the round as revealed.", available: true, reveal: true, cost: "A revealed phrase scores 0." },
      ];
    },

    outcome(state): Outcome {
      if (state.revealed) return "revealed";
      if (state.solved) return "completed";
      return "playing";
    },

    result(state): ResultSummary | null {
      if (!finished(state)) return null;
      const hints = state.hints.filter((h) => h.tier !== HINT_REVEAL).length;
      const words = wordsOf(state);
      if (state.revealed) {
        return {
          outcome: "revealed",
          headline: "Phrase revealed.",
          scoreText: "0 points",
          score: 0,
          maxScore: 100,
          efficiency: null,
          assistance: { hints, reveals: 1 },
          details: [
            `The phrase: ${sentence(words)}`,
            `You made ${plural(state.moves, "swap")} before revealing. The minimum from the starting order was ${state.minimum}.`,
            "Play this round again to practise the repair yourself.",
          ],
          shareText: `Word Club · Phrase Repair · revealed`,
          explanation: [state.explanation],
        };
      }
      const score = scoreFor(state.minimum, state.moves);
      const efficiency = state.minimum === 0 ? 1 : state.minimum / state.moves;
      return {
        outcome: "completed",
        headline: state.moves === state.minimum ? "Repaired in the fewest possible swaps." : "Phrase repaired.",
        scoreText: `${score} points`,
        score,
        maxScore: 100,
        efficiency,
        assistance: { hints, reveals: 0 },
        details: [
          `The phrase: ${sentence(words)}`,
          `Your swaps: ${state.moves} (undo counts as a swap). Minimum from the starting order: ${state.minimum}.`,
          `Score: 60 for repairing, plus 40 × ${state.minimum}/${state.moves || 1} rounded down = ${score}.`,
          ...(hints ? [`${plural(hints, "hint")} taken; hints do not cost points.`] : []),
        ],
        shareText: `Word Club · Phrase Repair · ${state.moves} swaps (minimum ${state.minimum}) · ${score} pts${hints ? ` · ${plural(hints, "hint")}` : " · unassisted"}`,
        explanation: [state.explanation, `Minimum swaps equal the number of word pairs that start in the wrong order relative to each other (inversions); repeated words are matched in order so they never count against you.`],
      };
    },
  };
  return engine;
}
