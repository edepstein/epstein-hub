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
import { normaliseWord, plural } from "@/lib/text";

export const RULES_VERSION = "1.0";

export interface ClueCard {
  /** Stable card id within the round (pack fixtures use a..e). */
  id: string;
  /** Two independent definitions of the same answer. */
  clues: [string, string];
  length: number;
  /** Editorially accepted spellings; every one must fit both clues and the length. */
  accepted: string[];
  /** A usage sentence for one sense with ____ in place of the answer. */
  example: string;
  /** Shown once the card is solved or revealed: both senses explained. */
  explanation: string;
}

export interface CluePairsPayload {
  cards: ClueCard[];
  explanation: string;
  /** Pack demo round hint strings, kept as metadata only. */
  fixtureHints?: string[];
}

export type CardStatus = "open" | "solved" | "revealed";

export interface CardState extends ClueCard {
  status: CardStatus;
  /** The accepted spelling the player entered, or the first accepted answer when revealed. */
  answer: string | null;
  /** Distinct wrong guesses, in order. */
  wrong: string[];
  /** Number of leading letters shown by hints. */
  lettersShown: number;
  exampleShown: boolean;
  hints: string[];
}

export interface CluePairsState {
  mode: Difficulty;
  cards: CardState[];
  current: string;
  revealedAll: boolean;
  explanation: string;
}

export type CluePairsAction =
  | { type: "select"; cardId: string }
  | { type: "submit"; cardId: string; answer: string }
  | { type: "hint"; tier: number }
  | { type: "reveal-all" };

/** Draft: text typed per card, kept when switching cards. */
export type CluePairsDraft = Record<string, string>;

export const HINT_LETTER = 1;
export const HINT_EXAMPLE = 2;
export const HINT_REVEAL_CARD = 3;

export const cardNumber = (s: CluePairsState, id: string) => s.cards.findIndex((c) => c.id === id) + 1;
const isDone = (c: CardState) => c.status !== "open";
const allDone = (s: CluePairsState) => s.cards.every(isDone);
const cardHintCount = (c: CardState) => c.hints.length;

/** Letters revealed so far, e.g. "C R _ _ _". */
export function letterPattern(c: CardState): string {
  const a = c.accepted[0];
  return Array.from({ length: c.length }, (_, i) => (c.status !== "open" ? (c.answer ?? a)[i] : i < c.lettersShown ? a[i] : "_")).join(" ");
}

function outcomeOf(s: CluePairsState): Outcome {
  if (!allDone(s)) return "playing";
  if (s.revealedAll || s.cards.every((c) => c.status === "revealed")) return "revealed";
  return "completed";
}

function analyse(s: CluePairsState, cardId: string, raw: unknown): Analysis {
  const card = s.cards.find((c) => c.id === cardId);
  if (!card) return { legal: false, code: "unknown-card", message: "That card is not in this round." };
  const n = cardNumber(s, card.id);
  if (card.status === "solved") return { legal: false, code: "already-solved", message: `Card ${n} is already solved.` };
  if (card.status === "revealed") return { legal: false, code: "already-revealed", message: `Card ${n} has been revealed.` };
  if (typeof raw !== "string") return { legal: false, code: "empty", message: "Type an answer first." };
  const { word, problem } = normaliseWord(raw);
  if (problem === "empty") return { legal: false, code: "empty", message: "Type an answer first." };
  if (problem === "non-letters")
    return { legal: false, code: "non-letters", message: "Use letters A to Z only. Every answer is a single word with no spaces, hyphens or apostrophes." };
  if (word.length !== card.length)
    return { legal: false, code: "wrong-length", message: `The answer has ${card.length} letters; ${word} has ${word.length}. No attempt is counted.` };
  if (card.wrong.includes(word)) return { legal: false, code: "already-tried", message: `You have already tried ${word} for card ${n}. No attempt is counted.` };
  return { legal: true, code: "ok", message: `${word} fits the length.` };
}

export function createCluePairsEngine(): GameEngine<CluePairsPayload, CluePairsState, CluePairsAction, { cardId: string; answer: string }> {
  const engine: GameEngine<CluePairsPayload, CluePairsState, CluePairsAction, { cardId: string; answer: string }> = {
    gameId: "clue-pairs",
    rulesVersion: RULES_VERSION,

    initialise(round: CluePairsPayload, options: SessionOptions): CluePairsState {
      return {
        mode: options.mode,
        cards: round.cards.map((c) => ({
          ...c,
          clues: [c.clues[0], c.clues[1]],
          accepted: c.accepted.map((a) => a.toUpperCase()),
          status: "open",
          answer: null,
          wrong: [],
          lettersShown: 0,
          exampleShown: false,
          hints: [],
        })),
        current: round.cards[0]?.id ?? "",
        revealedAll: false,
        explanation: round.explanation,
      };
    },

    preview(state, draft) {
      return analyse(state, draft?.cardId ?? state.current, draft?.answer);
    },

    apply(state, action): Transition<CluePairsState> {
      const playing = outcomeOf(state) === "playing";
      const update = (id: string, f: (c: CardState) => CardState): CardState[] => state.cards.map((c) => (c.id === id ? f(c) : c));
      switch (action?.type) {
        case "select": {
          const card = state.cards.find((c) => c.id === action.cardId);
          if (!card) return reject(state, "unknown-card", "That card is not in this round.");
          if (state.current === card.id) return reject(state, "already-selected", `Card ${cardNumber(state, card.id)} is already showing.`);
          const n = cardNumber(state, card.id);
          const tail = card.status === "solved" ? " Solved." : card.status === "revealed" ? " Revealed." : ` ${card.length} letters.`;
          return accept({ ...state, current: card.id }, "selected", `Card ${n} of ${state.cards.length}.${tail}`);
        }
        case "submit": {
          if (!playing) return reject(state, "round-over", "This round is over. Start again to replay it.");
          const a = analyse(state, action.cardId, action.answer);
          if (!a.legal) return reject(state, a.code, a.message);
          const word = normaliseWord(action.answer).word;
          const card = state.cards.find((c) => c.id === action.cardId)!;
          const n = cardNumber(state, card.id);
          if (card.accepted.includes(word)) {
            const next: CluePairsState = { ...state, current: card.id, cards: update(card.id, (c) => ({ ...c, status: "solved", answer: word })) };
            const done = allDone(next);
            return accept(next, done ? "complete" : "solved", `Solved: ${word} answers both meanings on card ${n}.${done ? " Every card is complete." : ""}`);
          }
          const next: CluePairsState = { ...state, current: card.id, cards: update(card.id, (c) => ({ ...c, wrong: [...c.wrong, word] })) };
          // Only the objective fact is given; which meaning failed stays hidden unless the player asks for help.
          return accept(next, "wrong", `${word} is not the answer for card ${n}. The answer must fit both meanings.`);
        }
        case "hint": {
          if (!playing) return reject(state, "round-over", "This round is over.");
          const card = state.cards.find((c) => c.id === state.current)!;
          const n = cardNumber(state, card.id);
          if (isDone(card)) return reject(state, "hint-unavailable", `Card ${n} is already ${card.status}.`);
          const a = card.accepted[0];
          if (action.tier === HINT_LETTER) {
            if (card.lettersShown >= card.length - 1) return reject(state, "hint-unavailable", "Every letter but the last is already shown. Reveal the card instead.");
            const shown = card.lettersShown + 1;
            const text = shown === 1 ? `Card ${n} starts with ${a[0]}.` : `Card ${n} starts ${a.slice(0, shown)}.`;
            return accept({ ...state, cards: update(card.id, (c) => ({ ...c, lettersShown: shown, hints: [...c.hints, text] })) }, "hint", text);
          }
          if (action.tier === HINT_EXAMPLE) {
            if (card.lettersShown < 1) return reject(state, "hint-unavailable", "Take a letter hint first.");
            if (card.exampleShown) return reject(state, "hint-unavailable", "The usage example is already shown.");
            const text = `Card ${n} in use: ${card.example}`;
            return accept({ ...state, cards: update(card.id, (c) => ({ ...c, exampleShown: true, hints: [...c.hints, text] })) }, "hint", text);
          }
          if (action.tier === HINT_REVEAL_CARD) {
            const next: CluePairsState = { ...state, cards: update(card.id, (c) => ({ ...c, status: "revealed", answer: a })) };
            const done = allDone(next);
            return accept(next, done ? "complete" : "card-revealed", `Card ${n} revealed: ${a}. It scores 0.${done ? " Every card is now complete." : ""}`);
          }
          return reject(state, "hint-unavailable", "That hint does not exist.");
        }
        case "reveal-all": {
          if (!playing) return reject(state, "round-over", "This round is over.");
          const rest = state.cards.filter((c) => !isDone(c)).length;
          const next: CluePairsState = {
            ...state,
            revealedAll: true,
            cards: state.cards.map((c) => (isDone(c) ? c : { ...c, status: "revealed", answer: c.accepted[0] })),
          };
          return accept(next, "revealed-all", `${plural(rest, "remaining card")} revealed with explanations.`);
        }
        default:
          return reject(state, "unknown-action", "Unknown action.");
      }
    },

    hints(state): HintOffer[] {
      const card = state.cards.find((c) => c.id === state.current);
      const over = outcomeOf(state) !== "playing";
      const closed = !card || over || isDone(card);
      const n = card ? cardNumber(state, card.id) : 0;
      const why = card && isDone(card) ? `Card ${n} is already ${card.status}.` : "This round is over.";
      const shown = card?.lettersShown ?? 0;
      return [
        {
          tier: HINT_LETTER,
          label: shown ? "Another letter" : "First letter",
          description: shown ? `Shows letter ${shown + 1} of card ${n}.` : `Shows the first letter of card ${n}.`,
          available: !closed && shown < (card?.length ?? 0) - 1,
          reason: closed ? why : "Every letter but the last is shown.",
          reveal: false,
          cost: "The card still scores fully if you solve it; your result records the hint.",
        },
        {
          tier: HINT_EXAMPLE,
          label: "Usage example",
          description: `Shows a sentence using the answer to card ${n} in one of its meanings, with the answer blanked out.`,
          available: !closed && shown >= 1 && !card?.exampleShown,
          reason: closed ? why : card?.exampleShown ? "Already shown." : "Take a letter hint first.",
          reveal: false,
          cost: "The card still scores fully if you solve it; your result records the hint.",
        },
        {
          tier: HINT_REVEAL_CARD,
          label: "Reveal this card",
          description: `Shows the answer to card ${n} with both meanings explained. Other cards are not affected.`,
          available: !closed,
          reason: why,
          reveal: true,
          cost: "A revealed card scores 0.",
        },
      ];
    },

    outcome: outcomeOf,

    result(state): ResultSummary | null {
      const outcome = outcomeOf(state);
      if (outcome === "playing") return null;
      const n = state.cards.length;
      const solved = state.cards.filter((c) => c.status === "solved");
      const revealed = n - solved.length;
      // Each solved card is worth 100 / cardCount; the total is rounded once.
      const score = Math.round((solved.length * 100) / n);
      const hints = state.cards.reduce((t, c) => t + cardHintCount(c), 0);
      const wrong = state.cards.reduce((t, c) => t + c.wrong.length, 0);
      const assistedCards = state.cards.filter((c) => c.status === "revealed" || c.hints.length).length;
      const headline =
        outcome === "completed"
          ? assistedCards
            ? `All ${n} cards complete, ${assistedCards} with help.`
            : `All ${n} cards solved without help.`
          : `Answers revealed. You solved ${solved.length} of ${n} cards.`;
      return {
        outcome,
        headline,
        scoreText: `${score} of 100 points`,
        score,
        maxScore: 100,
        efficiency: null,
        assistance: { hints, reveals: revealed },
        details: [
          `${solved.length} of ${n} cards solved${revealed ? `; ${revealed} revealed (scoring 0)` : ""}.`,
          `${plural(wrong, "wrong guess", "wrong guesses")} across the round.`,
          hints ? `${plural(hints, "hint")} taken on ${plural(state.cards.filter((c) => c.hints.length).length, "card")}.` : "No hints taken.",
          ...(outcome === "completed" ? [assistedCards ? "Result: Assisted." : "Result: Completed unaided."] : []),
        ],
        shareText: `Word Club · Clue Pairs · ${DIFFICULTY_LABEL[state.mode]} · ${state.cards.map((c) => (c.status === "solved" ? (c.hints.length ? "◐" : "●") : "○")).join("")} · ${score}/100 · ${assistedCards ? "assisted" : "unassisted"}`,
        explanation: [
          ...state.cards.map((c, i) => `Card ${i + 1}, ${c.accepted.join(" or ")}${c.status === "revealed" ? " (revealed)" : ""}: ${c.explanation}`),
          state.explanation,
        ],
      };
    },
  };
  return engine;
}
