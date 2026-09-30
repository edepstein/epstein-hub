import {
  accept,
  reject,
  DIFFICULTY_LABEL,
  type Analysis,
  type Difficulty,
  type GameEngine,
  type HintOffer,
  type Outcome,
  type ResultSummary,
  type SessionOptions,
  type Transition,
} from "@/lib/engine/types";
import { createRng } from "@/lib/rng";
import { plural } from "@/lib/text";

export const RULES_VERSION = "1.0";
export const GROUP_SIZE = 4;

/** A tile. The id is persistent and independent of the displayed label. */
export interface FamilyTerm {
  id: string;
  label: string;
}

export interface FamilyGroup {
  id: string;
  /** Category name, hidden until the group is solved or hinted. */
  label: string;
  termIds: string[];
  /** Shown once solved: the reasoning, including full compounds where relevant. */
  explanation: string;
}

/** Editorial notes: deliberate red herrings and rival groupings that were considered. */
export interface RedHerring {
  term: string;
  /** The rival reading, e.g. "PIN also forms PINBALL". */
  rival: string;
  /** Why the intended partition still holds. */
  resolvedBy: string;
}

export interface FamiliesPayload {
  terms: FamilyTerm[];
  groups: FamilyGroup[];
  mistakeBudget: number;
  /** When true (every current round), reaching the budget offers an assisted continuation. */
  continueAfterBudget: boolean;
  explanation: string;
  redHerrings: RedHerring[];
  /** Original pack hint metadata for demo fixtures (kept for regression only). */
  fixtureHints?: unknown[];
}

export interface SolvedGroup {
  groupId: string;
  via: "found" | "revealed";
}

export interface FamiliesHint {
  tier: number;
  groupId: string;
  text: string;
  termIds: string[];
}

export interface FamiliesState {
  mode: Difficulty;
  terms: FamilyTerm[];
  groups: FamilyGroup[];
  /** Display permutation of every term id (solved terms are hidden by the UI). */
  order: string[];
  solved: SolvedGroup[];
  /** Distinct wrong four-term sets, each sorted. */
  wrongSets: string[][];
  mistakes: number;
  budget: number;
  continueAfterBudget: boolean;
  /** The player chose to continue after using every mistake (assisted continuation). */
  continued: boolean;
  hints: FamiliesHint[];
  revealedAll: boolean;
  explanation: string;
}

export type FamiliesAction =
  | { type: "submit"; ids: string[] }
  | { type: "shuffle"; order: string[] }
  | { type: "hint"; tier: number }
  | { type: "continue" }
  | { type: "reveal-all" };

/** Draft = currently selected term ids (UI state, persisted separately). */
export type FamiliesDraft = string[];

export const HINT_CATEGORY = 1;
export const HINT_PAIR = 2;
export const HINT_REVEAL_GROUP = 3;

const setKey = (ids: readonly string[]) => [...ids].sort().join("|");

export const isSolvedTerm = (s: FamiliesState, id: string) =>
  s.solved.some((g) => s.groups.find((x) => x.id === g.groupId)?.termIds.includes(id));

export const unsolvedGroups = (s: FamiliesState) => s.groups.filter((g) => !s.solved.some((x) => x.groupId === g.id));

export const labelOf = (s: FamiliesState, id: string) => s.terms.find((t) => t.id === id)?.label ?? id;

/** The mistake budget is used up and the player has not (yet) chosen to continue. */
export const budgetBlocked = (s: FamiliesState) => s.mistakes >= s.budget && !s.continued;

const allSolved = (s: FamiliesState) => s.solved.length === s.groups.length;

/** The group the hint ladder is working on: the latest hinted unsolved group, else the first unsolved in authored order. */
export function hintFocus(s: FamiliesState): FamilyGroup | null {
  for (let i = s.hints.length - 1; i >= 0; i--) {
    const g = s.groups.find((x) => x.id === s.hints[i].groupId);
    if (g && !s.solved.some((x) => x.groupId === g.id)) return g;
  }
  return unsolvedGroups(s)[0] ?? null;
}

function focusLevel(s: FamiliesState, g: FamilyGroup | null): number {
  if (!g) return 0;
  return s.hints.filter((h) => h.groupId === g.id && h.tier !== HINT_REVEAL_GROUP).reduce((m, h) => Math.max(m, h.tier), 0);
}

function outcomeOf(s: FamiliesState): Outcome {
  if (allSolved(s)) {
    if (s.revealedAll || s.solved.every((g) => g.via === "revealed")) return "revealed";
    return "completed";
  }
  if (!s.continueAfterBudget && s.mistakes >= s.budget) return "failed";
  return "playing";
}

/** Check a selection without committing it. */
function analyse(s: FamiliesState, ids: unknown): Analysis<{ count: number }> {
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) return { legal: false, code: "bad-selection", message: "That selection could not be read." };
  const list = ids as string[];
  if (new Set(list).size !== list.length) return { legal: false, code: "duplicate-term", message: "A term can only be selected once." };
  for (const id of list) {
    if (!s.terms.some((t) => t.id === id)) return { legal: false, code: "unknown-term", message: "That term is not on this board." };
    if (isSolvedTerm(s, id)) return { legal: false, code: "term-solved", message: `${labelOf(s, id)} is already in a solved group.` };
  }
  if (list.length === 0) return { legal: false, code: "wrong-size", message: `Select ${GROUP_SIZE} terms that share a connection.`, feedback: { count: 0 } };
  if (list.length !== GROUP_SIZE) {
    const n = list.length;
    return {
      legal: false,
      code: "wrong-size",
      message: n < GROUP_SIZE ? `Select exactly ${GROUP_SIZE} terms; you have selected ${n}. No mistake is counted.` : `Select exactly ${GROUP_SIZE} terms; you have selected ${n}.`,
      feedback: { count: n },
    };
  }
  if (s.wrongSets.some((w) => setKey(w) === setKey(list)))
    return { legal: false, code: "already-tried", message: "You have tried this group already. It is not a group, and no extra mistake is counted.", feedback: { count: GROUP_SIZE } };
  return { legal: true, code: "ok", message: "Four terms selected. Ready to check.", feedback: { count: GROUP_SIZE } };
}

export function createWordFamiliesEngine(): GameEngine<FamiliesPayload, FamiliesState, FamiliesAction, FamiliesDraft> {
  const engine: GameEngine<FamiliesPayload, FamiliesState, FamiliesAction, FamiliesDraft> = {
    gameId: "word-families",
    rulesVersion: RULES_VERSION,

    initialise(round: FamiliesPayload, options: SessionOptions): FamiliesState {
      return {
        mode: options.mode,
        terms: round.terms.map((t) => ({ ...t })),
        groups: round.groups.map((g) => ({ ...g, termIds: [...g.termIds] })),
        // Seeded per attempt, so groups are never shown in authored order and replay is exact.
        order: createRng(options.seed).shuffle(round.terms.map((t) => t.id)),
        solved: [],
        wrongSets: [],
        mistakes: 0,
        budget: round.mistakeBudget,
        continueAfterBudget: round.continueAfterBudget,
        continued: false,
        hints: [],
        revealedAll: false,
        explanation: round.explanation,
      };
    },

    preview(state, draft) {
      return analyse(state, draft);
    },

    apply(state, action): Transition<FamiliesState> {
      const playing = outcomeOf(state) === "playing";
      switch (action?.type) {
        case "submit": {
          if (!playing) return reject(state, "round-over", "This round is over. Start again to replay it.");
          if (budgetBlocked(state))
            return reject(
              state,
              "budget-reached",
              `You have used all ${state.budget} mistakes. Choose Continue (marked as assisted), take a hint or reveal the answers.`,
            );
          const a = analyse(state, action.ids);
          if (!a.legal) return reject(state, a.code, a.message);
          const ids = action.ids;
          const match = unsolvedGroups(state).find((g) => setKey(g.termIds) === setKey(ids));
          if (match) {
            const next: FamiliesState = { ...state, solved: [...state.solved, { groupId: match.id, via: "found" }] };
            const done = allSolved(next);
            return accept(next, done ? "complete" : "group-found", `Correct: ${match.label}.${done ? " Every group is solved." : ""}`, {
              events: [{ type: "group-found", message: match.id }],
            });
          }
          const mistakes = state.mistakes + 1;
          const next: FamiliesState = { ...state, mistakes, wrongSets: [...state.wrongSets, [...ids].sort()] };
          // "One away" is defined exactly: three of the four selected terms belong to one unsolved group.
          const oneAway = unsolvedGroups(state).some((g) => ids.filter((id) => g.termIds.includes(id)).length === GROUP_SIZE - 1);
          let msg = oneAway ? "One away: three of these four belong to the same group." : "Not a group.";
          msg += ` Mistake ${mistakes} of ${state.budget}.`;
          if (mistakes === state.budget) {
            msg += state.continueAfterBudget
              ? " You have used every mistake. Continue (marked as assisted), take a hint or reveal the answers."
              : " That was your last mistake; the answers are now shown.";
          }
          return accept(next, oneAway ? "one-away" : "wrong-group", msg);
        }
        case "shuffle": {
          if (!playing) return reject(state, "round-over", "This round is over.");
          const o = action.order;
          const ok = Array.isArray(o) && o.length === state.terms.length && setKey(o) === setKey(state.terms.map((t) => t.id));
          if (!ok) return reject(state, "bad-order", "That arrangement is not a rearrangement of this board.");
          return accept({ ...state, order: [...o] }, "shuffled", "Tiles shuffled. Your selection and solved groups are unchanged.");
        }
        case "hint": {
          if (!playing) return reject(state, "round-over", "This round is over.");
          const g = hintFocus(state);
          if (!g) return reject(state, "hint-unavailable", "Every group is already solved.");
          const level = focusLevel(state, g);
          if (action.tier === HINT_CATEGORY) {
            if (level >= HINT_CATEGORY) return reject(state, "hint-unavailable", "You already have this group's category.");
            const text = `One group is: ${g.label}.`;
            return accept({ ...state, hints: [...state.hints, { tier: HINT_CATEGORY, groupId: g.id, text, termIds: [] }] }, "hint", text);
          }
          if (action.tier === HINT_PAIR) {
            if (level < HINT_CATEGORY) return reject(state, "hint-unavailable", "Take the category hint first.");
            if (level >= HINT_PAIR) return reject(state, "hint-unavailable", "You already have two terms from this group.");
            const pair = g.termIds.slice(0, 2);
            const text = `${labelOf(state, pair[0])} and ${labelOf(state, pair[1])} both belong to ${g.label}.`;
            return accept({ ...state, hints: [...state.hints, { tier: HINT_PAIR, groupId: g.id, text, termIds: pair }] }, "hint", text);
          }
          if (action.tier === HINT_REVEAL_GROUP) {
            const text = `Revealed: ${g.label} (${g.termIds.map((id) => labelOf(state, id)).join(", ")}).`;
            const next: FamiliesState = {
              ...state,
              solved: [...state.solved, { groupId: g.id, via: "revealed" }],
              hints: [...state.hints, { tier: HINT_REVEAL_GROUP, groupId: g.id, text, termIds: [...g.termIds] }],
            };
            const done = allSolved(next);
            return accept(next, done ? "complete" : "group-revealed", `${text} It counts as revealed, not found.${done ? " Every group is now shown." : ""}`);
          }
          return reject(state, "hint-unavailable", "That hint does not exist.");
        }
        case "continue": {
          if (!playing) return reject(state, "round-over", "This round is over.");
          if (!state.continueAfterBudget) return reject(state, "continue-unavailable", "This round does not allow play after the mistake budget.");
          if (state.mistakes < state.budget) return reject(state, "continue-unavailable", "You still have mistakes left, so there is nothing to continue from.");
          if (state.continued) return reject(state, "continue-unavailable", "You are already continuing.");
          return accept({ ...state, continued: true }, "continued", "Continuing. Your result will be marked as an assisted continuation, and further mistakes are still counted.");
        }
        case "reveal-all": {
          if (!playing) return reject(state, "round-over", "This round is over.");
          const rest = unsolvedGroups(state);
          const next: FamiliesState = {
            ...state,
            revealedAll: true,
            solved: [...state.solved, ...rest.map((g) => ({ groupId: g.id, via: "revealed" as const }))],
          };
          return accept(next, "revealed-all", `Answers revealed: ${plural(rest.length, "group")} shown with explanations.`);
        }
        default:
          return reject(state, "unknown-action", "Unknown action.");
      }
    },

    hints(state): HintOffer[] {
      const g = hintFocus(state);
      const level = focusLevel(state, g);
      const over = outcomeOf(state) !== "playing";
      const none = !g || over;
      return [
        {
          tier: HINT_CATEGORY,
          label: "Name a category",
          description: "Shows the category name of one group you have not solved.",
          available: !none && level < HINT_CATEGORY,
          reason: none ? "Every group is solved." : "You already have the category for the group being hinted.",
          reveal: false,
          cost: "No mistake is counted; your result records one hint.",
        },
        {
          tier: HINT_PAIR,
          label: "Two that belong together",
          description: "Names two terms from that same group.",
          available: !none && level === HINT_CATEGORY,
          reason: none ? "Every group is solved." : level < HINT_CATEGORY ? "Take the category hint first." : "Already taken for this group.",
          reveal: false,
          cost: "No mistake is counted; your result records one hint.",
        },
        {
          tier: HINT_REVEAL_GROUP,
          label: "Reveal a group",
          description: g && level ? `Solves the ${g.label} group for you and shows its explanation.` : "Solves one unsolved group for you and shows its explanation.",
          available: !none,
          reason: "Every group is solved.",
          reveal: true,
          cost: "The group counts as revealed, not found.",
        },
      ];
    },

    outcome: outcomeOf,

    result(state): ResultSummary | null {
      const outcome = outcomeOf(state);
      if (outcome === "playing") return null;
      const n = state.groups.length;
      const found = state.solved.filter((g) => g.via === "found").length;
      const revealed = n - found;
      const nudges = state.hints.filter((h) => h.tier !== HINT_REVEAL_GROUP).length;
      const hintCount = nudges + (state.continued ? 1 : 0);
      const assisted = hintCount + revealed > 0;
      const headline =
        outcome === "completed"
          ? `All ${n} groups solved${revealed ? `, ${revealed} revealed` : ""}${state.mistakes === 0 ? " without a mistake" : ""}.`
          : outcome === "failed"
            ? `Out of mistakes. You found ${found} of ${n} groups.`
            : `Answers revealed. You found ${found} of ${n} groups.`;
      const dots = state.groups.map((g) => (state.solved.find((x) => x.groupId === g.id)?.via === "found" ? "●" : "○")).join("");
      const details = [
        `${found} of ${n} groups found by you${revealed ? `; ${revealed} revealed` : ""}.`,
        `${plural(state.mistakes, "mistake")} (budget ${state.budget})${state.wrongSets.length ? `; ${plural(state.wrongSets.length, "distinct wrong group")} tried` : ""}.`,
        nudges ? `${plural(nudges, "hint")} taken.` : "No hints taken.",
        ...(state.continued ? ["You continued after using every mistake: marked as an assisted continuation."] : []),
      ];
      const explanation = state.groups.map((g) => {
        const via = state.solved.find((x) => x.groupId === g.id)?.via;
        return `${g.label}: ${g.termIds.map((id) => labelOf(state, id)).join(", ")}${via === "found" ? "" : " (revealed)"}. ${g.explanation}`;
      });
      return {
        outcome,
        headline,
        scoreText: `${found} of ${n} groups · ${plural(state.mistakes, "mistake")}`,
        score: found,
        maxScore: n,
        efficiency: null,
        assistance: { hints: hintCount, reveals: revealed },
        details,
        shareText: `Word Club · Word Families · ${DIFFICULTY_LABEL[state.mode]} · ${dots} · ${plural(state.mistakes, "mistake")} · ${assisted ? "assisted" : "unassisted"}`,
        explanation: [...explanation, state.explanation],
      };
    },
  };
  return engine;
}
