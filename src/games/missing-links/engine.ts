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
import { createRng } from "@/lib/rng";
import { plural } from "@/lib/text";

/**
 * Missing Links (games/missing-links.md, upgrades/missing-links.md).
 * Each board shows three (expert: four) branch templates with one blank placed explicitly
 * before or after a fixed component. One single word must complete every branch as an approved
 * closed compound: displayed components, displayed order, no spaces, no deleted letters.
 * A round holds several boards. A correct link earns 100; a revealed board earns 0.
 */
export const RULES_VERSION = "1.0";
export const POINTS_PER_LINK = 100;

export interface Branch {
  id: string;
  /** Fixed text before the blank ("" when the blank comes first). */
  prefix: string;
  /** Fixed text after the blank ("" when the blank comes last). */
  suffix: string;
  /** Meaning of the completed compound; must fit every accepted link. */
  clue: string;
}

export interface LinkSolution {
  link: string;
  /** Branch id to exact closed compound spelling. */
  compounds: Record<string, string>;
}

export interface LinkBoard {
  id: string;
  linkLength: number;
  branches: Branch[];
  /** Candidate bank (includes the primary link). */
  candidates: string[];
  /** First entry is the editor's link; any other entry is an accepted alternative. */
  solutions: LinkSolution[];
  /** Branch completed by the second hint. */
  hintBranch: string;
  explanation: string;
  /** Words that make real compounds in every branch but do not fit the definitions. */
  rejectedAlternatives?: { link: string; reason: string }[];
  /** Pack fixtures only: the original sample hint strings, kept for provenance. */
  fixtureHints?: string[];
}

export interface LinksPayload {
  /** shown = bank visible as normal play (Gentle); optional = opening it counts as assistance. */
  bank: "shown" | "optional";
  boards: LinkBoard[];
}

export interface GuessRecord {
  word: string;
  /** Per branch (in display order): does substituting the word make a word in the list? */
  fits: boolean[];
}

export type BoardStatus = "open" | "solved" | "revealed";

export interface BoardState {
  id: string;
  linkLength: number;
  branches: Branch[];
  /** Bank in seeded display order. */
  candidates: string[];
  solutions: LinkSolution[];
  hintBranch: string;
  explanation: string;
  rejectedAlternatives: { link: string; reason: string }[];
  status: BoardStatus;
  solvedWith: string | null;
  guesses: GuessRecord[];
  hintLevel: number;
  bankOpened: boolean;
}

export interface HintRecord {
  board: string;
  tier: number;
  text: string;
}

export interface LinksState {
  bank: "shown" | "optional";
  boards: BoardState[];
  /** Index of the board being worked on (hints apply here). */
  active: number;
  hints: HintRecord[];
  finished: boolean;
}

export type LinksAction =
  | { type: "select"; board: string }
  | { type: "guess"; board: string; word: string }
  | { type: "hint"; tier: number }
  | { type: "open-bank"; board: string }
  | { type: "finish" }
  | { type: "resume" };

export const HINT_FIRST_LETTER = 1;
export const HINT_BRANCH = 2;
export const HINT_REVEAL = 3;

/** Normalise free text: Unicode NFC, trim, upper-case. Internal spacing is kept so it can be explained. */
export function normaliseLink(raw: string): string {
  return raw.normalize("NFC").trim().toUpperCase();
}

export const compoundOf = (b: Pick<Branch, "prefix" | "suffix">, link: string) => `${b.prefix}${link}${b.suffix}`;
export const template = (b: Pick<Branch, "prefix" | "suffix">, blank = "____") => `${b.prefix}${blank}${b.suffix}`;

export function createMissingLinksEngine(membership: ReadonlySet<string>): GameEngine<LinksPayload, LinksState, LinksAction, string> {
  const findBoard = (s: LinksState, id: string) => s.boards.findIndex((b) => b.id === id);

  function analyse(state: LinksState, boardId: string, raw: string): Analysis<{ fits?: boolean[]; solution?: LinkSolution }> {
    const i = findBoard(state, boardId);
    if (i < 0) return { legal: false, code: "unknown-board", message: "That board is not part of this round." };
    const b = state.boards[i];
    if (b.status === "solved") return { legal: false, code: "already-solved", message: `Board ${i + 1} is already solved with ${b.solvedWith}.` };
    if (b.status === "revealed") return { legal: false, code: "already-revealed", message: `Board ${i + 1} has been revealed.` };
    const word = normaliseLink(raw);
    if (!word) return { legal: false, code: "empty", message: "Type the missing word first." };
    if (/[\s\-'’]/.test(word))
      return {
        legal: false,
        code: "spaces",
        message: "Enter one word without spaces, hyphens or apostrophes. Every answer here makes a closed compound written as one word.",
      };
    if (!/^[A-Z]+$/.test(word)) return { legal: false, code: "non-letters", message: "Use letters A to Z only." };
    if (word.length !== b.linkLength) {
      const whole = b.branches.find(
        (br) => word.length === br.prefix.length + br.suffix.length + b.linkLength && word.startsWith(br.prefix) && word.endsWith(br.suffix) && (br.prefix || br.suffix),
      );
      if (whole)
        return {
          legal: false,
          code: "whole-compound",
          message: `Type only the missing word, not the whole compound. The missing word has ${b.linkLength} letters.`,
        };
      return { legal: false, code: "wrong-length", message: `The missing word has ${b.linkLength} letters; ${word} has ${word.length}.` };
    }
    if (b.guesses.some((g) => g.word === word)) return { legal: false, code: "already-tried", message: `You have already tried ${word} on this board.` };
    const solution = b.solutions.find((s) => s.link === word);
    if (solution) return { legal: true, code: "correct", message: `${word} completes every branch.`, feedback: { solution } };
    const fits = b.branches.map((br) => membership.has(compoundOf(br, word)));
    return { legal: true, code: "wrong-link", message: "", feedback: { fits } };
  }

  const boardDone = (b: BoardState) => b.status !== "open";
  const allDone = (s: LinksState) => s.boards.every(boardDone);
  const withBoard = (s: LinksState, i: number, b: BoardState): LinksState => ({ ...s, boards: s.boards.map((x, k) => (k === i ? b : x)) });
  const assisted = (s: LinksState, b: BoardState) => b.hintLevel > 0 || (s.bank === "optional" && b.bankOpened);
  const listCompounds = (b: BoardState, sol: LinkSolution) => {
    const words = b.branches.map((br) => sol.compounds[br.id]);
    return words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}` : words[0];
  };

  const engine: GameEngine<LinksPayload, LinksState, LinksAction, string> = {
    gameId: "missing-links",
    rulesVersion: RULES_VERSION,

    initialise(round: LinksPayload, options: SessionOptions): LinksState {
      const rng = createRng(options.seed);
      return {
        bank: round.bank,
        boards: round.boards.map((b) => ({
          id: b.id,
          linkLength: b.linkLength,
          branches: b.branches.map((br) => ({ ...br })),
          candidates: rng.shuffle(b.candidates.map((c) => c.toUpperCase())),
          solutions: b.solutions,
          hintBranch: b.hintBranch,
          explanation: b.explanation,
          rejectedAlternatives: b.rejectedAlternatives ?? [],
          status: "open",
          solvedWith: null,
          guesses: [],
          hintLevel: 0,
          bankOpened: false,
        })),
        active: 0,
        hints: [],
        finished: false,
      };
    },

    preview(state, draft) {
      return analyse(state, state.boards[state.active]?.id ?? "", draft);
    },

    apply(state, action): Transition<LinksState> {
      switch (action.type) {
        case "select": {
          const i = findBoard(state, action.board);
          if (i < 0) return reject(state, "unknown-board", "That board is not part of this round.");
          if (i === state.active) return reject(state, "already-selected", `Board ${i + 1} is already selected.`);
          return accept({ ...state, active: i }, "selected", `Board ${i + 1} of ${state.boards.length}.`);
        }
        case "guess": {
          const a = analyse(state, action.board, action.word);
          if (!a.legal) return reject(state, a.code, a.message);
          const i = findBoard(state, action.board);
          const b = state.boards[i];
          const word = normaliseLink(action.word);
          if (a.code === "correct") {
            const sol = a.feedback!.solution!;
            const nb: BoardState = { ...b, status: "solved", solvedWith: word };
            const next = withBoard(state, i, nb);
            const alt = sol.link !== b.solutions[0].link ? ` (an accepted alternative to ${b.solutions[0].link})` : "";
            const done = allDone(next);
            return accept(
              next,
              done ? "round-complete" : "solved",
              `${word} is the link${alt}: ${listCompounds(b, sol)}. ${POINTS_PER_LINK} points${assisted(state, b) ? ", with help" : ""}.${done ? " Every board in this round is finished." : ""}`,
              { score: { lines: [{ label: `Board ${i + 1} link`, points: POINTS_PER_LINK }], total: POINTS_PER_LINK } },
            );
          }
          const fits = a.feedback!.fits!;
          const n = fits.filter(Boolean).length;
          const rej = b.rejectedAlternatives.find((r) => r.link === word);
          const msg = rej
            ? `${word} makes a word in every branch, but not ones that match the definitions. ${rej.reason}`
            : n === 0
              ? `${word} does not make a word in any branch. Try another link.`
              : `${word} makes a word in ${n} of ${b.branches.length} branches, but the link must complete every branch. No points lost.`;
          const nb: BoardState = { ...b, guesses: [...b.guesses, { word, fits }] };
          return accept(withBoard(state, i, nb), "wrong-link", msg);
        }
        case "open-bank": {
          const i = findBoard(state, action.board);
          if (i < 0) return reject(state, "unknown-board", "That board is not part of this round.");
          const b = state.boards[i];
          if (state.bank === "shown") return reject(state, "bank-shown", "The word bank is already part of this round.");
          if (b.bankOpened) return reject(state, "bank-open", "The word bank for this board is already open.");
          if (boardDone(b)) return reject(state, "board-finished", "This board is already finished.");
          return accept(withBoard(state, i, { ...b, bankOpened: true }), "bank-opened", `Word bank opened for board ${i + 1}. One of these words is the link; this board is now marked as helped.`);
        }
        case "hint": {
          const i = state.active;
          const b = state.boards[i];
          if (!b || boardDone(b)) return reject(state, "hint-unavailable", "This board is already finished. Choose an open board for a hint.");
          const link = b.solutions[0].link;
          const rec = (tier: number, text: string) => [...state.hints, { board: b.id, tier, text }];
          if (action.tier === HINT_FIRST_LETTER) {
            if (b.hintLevel >= 1) return reject(state, "hint-unavailable", "You already have the first letter for this board.");
            const text = `Board ${i + 1}: the link begins with ${link[0]}.`;
            return accept({ ...withBoard(state, i, { ...b, hintLevel: 1 }), hints: rec(HINT_FIRST_LETTER, text) }, "hint", text);
          }
          if (action.tier === HINT_BRANCH) {
            if (b.hintLevel < 1) return reject(state, "hint-unavailable", "Take the first-letter hint first.");
            if (b.hintLevel >= 2) return reject(state, "hint-unavailable", "You already have a completed branch for this board.");
            const br = b.branches.find((x) => x.id === b.hintBranch) ?? b.branches[0];
            const text = `Board ${i + 1}: ${template(br)} is ${b.solutions[0].compounds[br.id]} (${br.clue.charAt(0).toLowerCase()}${br.clue.slice(1)}).`;
            return accept({ ...withBoard(state, i, { ...b, hintLevel: 2 }), hints: rec(HINT_BRANCH, text) }, "hint", text);
          }
          if (action.tier === HINT_REVEAL) {
            const text = `Board ${i + 1} revealed: ${link} (${listCompounds(b, b.solutions[0])}). Scores 0.`;
            const next: LinksState = { ...withBoard(state, i, { ...b, hintLevel: 3, status: "revealed" }), hints: rec(HINT_REVEAL, text) };
            const done = allDone(next);
            return accept(next, done ? "round-complete" : "revealed", `${text}${done ? " Every board in this round is finished." : ""}`);
          }
          return reject(state, "hint-unavailable", "That hint does not exist.");
        }
        case "finish":
          if (state.finished) return reject(state, "already-finished", "This round is already finished.");
          if (allDone(state)) return reject(state, "already-finished", "Every board is already finished.");
          return accept({ ...state, finished: true }, "finished", "Round finished. Unsolved boards are left unexplored; you can come back to them.");
        case "resume":
          if (!state.finished) return reject(state, "not-finished", "The round is still open.");
          return accept({ ...state, finished: false }, "resumed", "Back to the bridges.");
        default:
          return reject(state, "unknown-action", "Unknown action.");
      }
    },

    hints(state): HintOffer[] {
      const i = state.active;
      const b = state.boards[i];
      const open = !!b && !boardDone(b);
      const lvl = b?.hintLevel ?? 0;
      const where = `board ${i + 1}`;
      const closed = "This board is finished. Select an open board.";
      return [
        {
          tier: HINT_FIRST_LETTER,
          label: "First letter",
          description: `Shows the first letter of the link on ${where}.`,
          available: open && lvl < 1,
          reason: !open ? closed : "Already taken for this board.",
          reveal: false,
          cost: "No points lost; the board is marked as solved with help.",
        },
        {
          tier: HINT_BRANCH,
          label: "One completed branch",
          description: `Shows one finished compound on ${where}. It does not enter an answer for you.`,
          available: open && lvl === 1,
          reason: !open ? closed : lvl < 1 ? "Take the first letter first." : "Already taken for this board.",
          reveal: false,
          cost: "No points lost; the board is marked as solved with help.",
        },
        {
          tier: HINT_REVEAL,
          label: "Reveal the link",
          description: `Shows the link and every compound on ${where}.`,
          available: open,
          reason: closed,
          reveal: true,
          cost: "The board scores 0 and is recorded as revealed.",
        },
      ];
    },

    outcome(state): Outcome {
      if (allDone(state)) return state.boards.some((b) => b.status === "solved") ? "completed" : "revealed";
      if (state.finished) return "abandoned";
      return "playing";
    },

    result(state): ResultSummary | null {
      const done = allDone(state);
      if (!done && !state.finished) return null;
      const solved = state.boards.filter((b) => b.status === "solved");
      const unaided = solved.filter((b) => !assisted(state, b));
      const revealed = state.boards.filter((b) => b.status === "revealed");
      const open = state.boards.filter((b) => b.status === "open");
      const score = solved.length * POINTS_PER_LINK;
      const max = state.boards.length * POINTS_PER_LINK;
      const hints = state.hints.filter((h) => h.tier !== HINT_REVEAL).length;
      const banks = state.bank === "optional" ? state.boards.filter((b) => b.bankOpened).length : 0;
      const wrong = state.boards.reduce((n, b) => n + b.guesses.length, 0);
      const outcome = done ? (solved.length ? "completed" : "revealed") : "abandoned";
      const n = state.boards.length;
      return {
        outcome,
        headline:
          outcome === "revealed"
            ? "Every link was revealed this time."
            : outcome === "abandoned"
              ? `You solved ${solved.length} of ${n} links.`
              : unaided.length === n
                ? `All ${n} links solved unaided.`
                : `${solved.length} of ${n} links solved${revealed.length ? `, ${revealed.length} revealed` : ""}.`,
        scoreText: `${score} of ${max} points`,
        score,
        maxScore: max,
        efficiency: null,
        assistance: { hints: hints + banks, reveals: revealed.length },
        details: [
          ...state.boards.map((b, i) => {
            const g = b.guesses.length;
            const tries = g ? `after ${plural(g, "wrong guess", "wrong guesses")}` : "first time";
            if (b.status === "solved") {
              const help = [b.hintLevel ? plural(b.hintLevel, "hint") : "", state.bank === "optional" && b.bankOpened ? "word bank" : ""].filter(Boolean).join(" and ");
              return `Board ${i + 1}: solved ${tries}${help ? `, with ${help}` : ", unaided"} (${POINTS_PER_LINK} points).`;
            }
            if (b.status === "revealed") return `Board ${i + 1}: revealed (0 points).`;
            return `Board ${i + 1}: left unexplored.`;
          }),
          `${plural(wrong, "wrong guess", "wrong guesses")} in total; wrong guesses never cost points.`,
          ...(open.length ? ["Resume to try the unexplored boards; nothing has been revealed."] : []),
        ],
        shareText: `Word Club · Missing Links · ${solved.length}/${n} links · ${score} pts${hints + banks + revealed.length ? ` · ${hints} hint${hints === 1 ? "" : "s"}${banks ? `, ${banks} bank${banks === 1 ? "" : "s"}` : ""}, ${revealed.length} revealed` : " · unassisted"}`,
        explanation: state.boards
          .filter((b) => b.status !== "open")
          .map((b) => {
            const sol = b.solutions.find((s) => s.link === b.solvedWith) ?? b.solutions[0];
            const meanings = b.branches.map((br) => `${sol.compounds[br.id]}: ${br.clue.charAt(0).toLowerCase()}${br.clue.slice(1)}`).join("; ");
            return `${b.explanation} ${meanings}.`;
          }),
      };
    },
  };
  return engine;
}
