import {
  accept,
  reject,
  type Difficulty,
  type GameEngine,
  type HintOffer,
  type Outcome,
  type ResultSummary,
  type SessionOptions,
  type Transition,
} from "@/lib/engine/types";
import { plural } from "@/lib/text";
import {
  DEVICE_LABEL,
  DEVICES,
  deviceDetail,
  enumerationLengths,
  explainOperation,
  fodderHint,
  indicatorHint,
  letterPattern,
  normaliseLetters,
  type CrypticClue,
  type Device,
} from "./construction";

export const RULES_VERSION = "1.0";

const withArticle = (noun: string) => `${/^[aeiou]/.test(noun) ? "an" : "a"} ${noun}`;

export interface WorkshopClue extends CrypticClue {
  id: string;
}

export interface WorkshopPayload {
  clues: WorkshopClue[];
  /** Pack fixture regression data (demo rounds only). */
  fixtureHints?: string[];
  fixtureExplanation?: string;
}

/** Hint stages, in order. Reveal is always available; stages 1-5 are taken in sequence. */
export const STAGE_DEFINITION = 1;
export const STAGE_DEVICE = 2;
export const STAGE_INDICATOR = 3;
export const STAGE_FODDER = 4;
export const STAGE_LETTERS = 5;
export const STAGE_REVEAL = 6;

export const STAGE_LABEL: Record<number, string> = {
  1: "Identify the definition",
  2: "Name the device",
  3: "Highlight the indicator",
  4: "Show the wordplay material",
  5: "Show some letters",
  6: "Reveal the answer",
};

export type ClueStatus = "open" | "solved" | "revealed";

export interface ClueProgress {
  status: ClueStatus;
  /** Hint stages taken by the player (1-5), in order. Reveal is recorded as status. */
  stages: number[];
  /** Device guesses in order (mechanism practice). */
  guesses: Device[];
}

export interface WorkshopState {
  mode: Difficulty;
  clues: WorkshopClue[];
  progress: Record<string, ClueProgress>;
  /** True when the player chose to reveal every remaining clue. */
  revealedAll: boolean;
}

export type WorkshopAction =
  | { type: "submit"; clueId: string; answer: string }
  | { type: "identify"; clueId: string; device: Device }
  | { type: "hint"; clueId: string; stage: number }
  | { type: "reveal-all" };

/** Gentle names the device up front, so that stage is given rather than taken. */
export const deviceGiven = (s: Pick<WorkshopState, "mode">) => s.mode === "gentle";

/** Master offers no device list at all: naming the trick is part of the solve. The hint ladder still names it on request. */
export const deviceListOffered = (s: Pick<WorkshopState, "mode">) => s.mode !== "master";

export function clueById(s: WorkshopState, id: string): WorkshopClue | undefined {
  return s.clues.find((c) => c.id === id);
}

export function enumerationText(c: Pick<CrypticClue, "enumeration">): string {
  return `(${c.enumeration})`;
}

/** Stages currently visible for a clue (taken, given, or everything once settled). */
export function visibleStages(s: WorkshopState, id: string): Set<number> {
  const p = s.progress[id];
  const out = new Set<number>(p?.stages ?? []);
  if (deviceGiven(s)) out.add(STAGE_DEVICE);
  if (p && p.guesses.length && p.guesses.at(-1) === clueById(s, id)?.construction.type) out.add(STAGE_DEVICE);
  if (p && p.status !== "open") [1, 2, 3, 4, 5, 6].forEach((n) => out.add(n));
  return out;
}

/** The next stage in the ladder for this clue, or null when 1-5 are all shown. */
export function nextStage(s: WorkshopState, id: string): number | null {
  const vis = visibleStages(s, id);
  for (let k = STAGE_DEFINITION; k <= STAGE_LETTERS; k++) if (!vis.has(k)) return k;
  return null;
}

/** The text a hint stage shows for a clue. */
export function stageText(clue: WorkshopClue, stage: number): string {
  switch (stage) {
    case STAGE_DEFINITION:
      return clue.construction.type === "double-definition"
        ? `"${clue.definition}" is one definition; the clue holds a second.`
        : clue.lit === "full"
          ? "The whole clue is the definition, and the wordplay is in it too (an &lit)."
          : clue.construction.type === "cryptic-definition"
            ? "The whole clue is the definition."
            : clue.lit === "semi"
              ? `The definition is "${clue.definition}", which runs on into the wordplay (a semi-&lit).`
              : `The definition is "${clue.definition}".`;
    case STAGE_DEVICE:
      return `The device is: ${deviceDetail(clue)}.`;
    case STAGE_INDICATOR:
      return indicatorHint(clue);
    case STAGE_FODDER:
      return fodderHint(clue);
    case STAGE_LETTERS:
      return `Some letters: ${letterPattern(clue.answer, clue.enumeration)}.`;
    case STAGE_REVEAL:
      return `The answer is ${clue.answer}. ${explainOperation(clue)}`;
    default:
      return "";
  }
}

export function score(s: WorkshopState): number {
  const solved = s.clues.filter((c) => s.progress[c.id].status === "solved").length;
  return Math.round((solved / s.clues.length) * 100);
}

const settled = (s: WorkshopState) => s.clues.every((c) => s.progress[c.id].status !== "open");

function hintOffersFor(s: WorkshopState, id: string): HintOffer[] {
  const clue = clueById(s, id);
  const p = s.progress[id];
  if (!clue || !p) return [];
  const open = p.status === "open";
  const vis = visibleStages(s, id);
  const next = nextStage(s, id);
  const offers: HintOffer[] = [];
  for (let k = STAGE_DEFINITION; k <= STAGE_LETTERS; k++) {
    if (k === STAGE_DEVICE && deviceGiven(s)) continue;
    offers.push({
      tier: k,
      label: STAGE_LABEL[k],
      description: stageDescription(k),
      available: open && next === k,
      reason: !open ? "This clue is already finished." : vis.has(k) ? "Already shown for this clue." : "Take the earlier hints for this clue first.",
      reveal: false,
      cost: "No points lost; the result records one hint.",
    });
  }
  offers.push({
    tier: STAGE_REVEAL,
    label: STAGE_LABEL[STAGE_REVEAL],
    description: "Shows the answer and the full explanation of how the clue works.",
    available: open,
    reason: "This clue is already finished.",
    reveal: true,
    cost: "This clue then scores 0 and the round is marked as assisted.",
  });
  return offers;
}

function stageDescription(stage: number): string {
  switch (stage) {
    case STAGE_DEFINITION:
      return "Underlines the definition: the part of the clue that means the answer.";
    case STAGE_DEVICE:
      return "Names the kind of wordplay, such as anagram or hidden word.";
    case STAGE_INDICATOR:
      return "Marks the word or words that signal the wordplay.";
    case STAGE_FODDER:
      return "Marks the words the answer is built from and says what to do with them, without giving letters.";
    case STAGE_LETTERS:
      return "Shows about a third of the answer's letters.";
    default:
      return "";
  }
}

export { hintOffersFor };

export const crypticWorkshopEngine: GameEngine<WorkshopPayload, WorkshopState, WorkshopAction, string> = {
  gameId: "cryptic-workshop",
  rulesVersion: RULES_VERSION,

  initialise(round: WorkshopPayload, options: SessionOptions): WorkshopState {
    const progress: Record<string, ClueProgress> = {};
    for (const c of round.clues) progress[c.id] = { status: "open", stages: [], guesses: [] };
    return { mode: options.mode, clues: round.clues, progress, revealedAll: false };
  },

  preview(state, draft) {
    const answer = normaliseLetters(draft ?? "");
    const clue = state.clues.find((c) => state.progress[c.id].status === "open");
    if (!clue) return { legal: false, code: "complete", message: "Every clue is finished." };
    if (!answer) return { legal: false, code: "empty", message: "Type an answer first." };
    return answer.length === clue.answer.length
      ? { legal: true, code: "ok", message: "Ready to submit." }
      : { legal: false, code: "wrong-length", message: `The answer has ${clue.answer.length} letters.` };
  },

  apply(state, action): Transition<WorkshopState> {
    if (action.type === "reveal-all") {
      if (settled(state)) return reject(state, "complete", "Every clue is already finished.");
      const progress = { ...state.progress };
      let n = 0;
      for (const c of state.clues) {
        if (progress[c.id].status === "open") {
          progress[c.id] = { ...progress[c.id], status: "revealed" };
          n += 1;
        }
      }
      return accept({ ...state, progress, revealedAll: true }, "revealed-all", `Revealed ${plural(n, "remaining clue")}. Each explanation is now open.`);
    }
    const clue = clueById(state, (action as { clueId?: string }).clueId ?? "");
    if (!clue) return reject(state, "unknown-clue", "That clue is not part of this round.");
    const p = state.progress[clue.id];
    const idx = state.clues.indexOf(clue) + 1;
    const withProgress = (np: ClueProgress): WorkshopState => ({ ...state, progress: { ...state.progress, [clue.id]: np } });

    switch (action.type) {
      case "submit": {
        if (p.status !== "open") return reject(state, "already-finished", `Clue ${idx} is already ${p.status}.`);
        const raw = (action.answer ?? "").trim();
        if (!raw) return reject(state, "empty", "Type an answer first.");
        if (/[^A-Za-z\s'-]/.test(raw.normalize("NFC"))) return reject(state, "non-letters", "Use letters A to Z only.");
        const answer = normaliseLetters(raw);
        const need = clue.answer.length;
        if (answer.length !== need) {
          return reject(
            state,
            "wrong-length",
            `The enumeration ${enumerationText(clue)} asks for ${plural(need, "letter")}; ${answer} has ${answer.length}. Your letters are kept so you can adjust them.`,
          );
        }
        if (answer !== clue.answer) {
          return reject(state, "incorrect", `${answer} is not the answer to clue ${idx}. Your letters are kept; try a hint if you are stuck.`);
        }
        const next = withProgress({ ...p, status: "solved" });
        const done = settled(next);
        return accept(next, done ? "round-complete" : "solved", `${answer} is right. The explanation is open below.${done ? " That finishes the workshop." : ""}`);
      }
      case "identify": {
        if (!DEVICES.includes(action.device)) return reject(state, "unknown-device", "That is not one of the listed devices.");
        if (deviceGiven(state)) return reject(state, "device-given", "Gentle clues name their device already.");
        if (!deviceListOffered(state)) return reject(state, "device-list-unavailable", "Master clues offer no device list. The hint ladder names the device when you ask for it.");
        const correct = clue.construction.type;
        if (p.guesses.includes(correct)) return reject(state, "device-known", `You have already named the device for clue ${idx}.`);
        if (p.guesses.includes(action.device)) return reject(state, "device-repeat", `You have already tried ${DEVICE_LABEL[action.device]} for clue ${idx}.`);
        const next = withProgress({ ...p, guesses: [...p.guesses, action.device] });
        return action.device === correct
          ? accept(next, "device-correct", `Yes: clue ${idx} is ${withArticle(DEVICE_LABEL[correct].toLowerCase())} clue.`)
          : accept(next, "device-incorrect", `Not ${withArticle(DEVICE_LABEL[action.device].toLowerCase())} clue. Naming the device is optional practice and costs nothing.`);
      }
      case "hint": {
        if (p.status !== "open") return reject(state, "already-finished", `Clue ${idx} is already ${p.status}.`);
        if (action.stage === STAGE_REVEAL) {
          const next = withProgress({ ...p, status: "revealed" });
          const done = settled(next);
          return accept(next, done ? "round-complete" : "revealed", `Clue ${idx} revealed: ${clue.answer}. It scores 0; the explanation is open below.${done ? " That finishes the workshop." : ""}`);
        }
        const want = nextStage(state, clue.id);
        if (want === null) return reject(state, "hint-unavailable", `Every hint for clue ${idx} is already shown; only Reveal remains.`);
        if (action.stage !== want) {
          return visibleStages(state, clue.id).has(action.stage)
            ? reject(state, "hint-unavailable", "That hint is already shown for this clue.")
            : reject(state, "hint-unavailable", `Take "${STAGE_LABEL[want]}" first.`);
        }
        return accept(withProgress({ ...p, stages: [...p.stages, want] }), "hint", stageText(clue, want));
      }
      default:
        return reject(state, "unknown-action", "Unknown action.");
    }
  },

  hints(state): HintOffer[] {
    const open = state.clues.find((c) => state.progress[c.id].status === "open");
    return open ? hintOffersFor(state, open.id) : [];
  },

  outcome(state): Outcome {
    if (!settled(state)) return "playing";
    const solved = state.clues.some((c) => state.progress[c.id].status === "solved");
    return state.revealedAll || !solved ? "revealed" : "completed";
  },

  result(state): ResultSummary | null {
    if (!settled(state)) return null;
    const total = state.clues.length;
    const solved = state.clues.filter((c) => state.progress[c.id].status === "solved");
    const revealed = state.clues.filter((c) => state.progress[c.id].status === "revealed");
    const hints = state.clues.reduce((n, c) => n + state.progress[c.id].stages.length, 0);
    const unaided = solved.filter((c) => state.progress[c.id].stages.length === 0).length;
    const guessed = state.clues.filter((c) => state.progress[c.id].guesses.length);
    const firstTry = guessed.filter((c) => state.progress[c.id].guesses[0] === c.construction.type).length;
    const outcome = crypticWorkshopEngine.outcome(state) as "completed" | "revealed";
    const s = score(state);
    const headline =
      solved.length === total
        ? hints === 0
          ? `Workshop complete: all ${total} clues solved without hints.`
          : `Workshop complete: all ${total} clues solved.`
        : solved.length === 0
          ? "Every clue was revealed. The explanations are below."
          : `${solved.length} of ${total} clues solved, ${revealed.length} revealed.`;
    const details = [
      `${plural(solved.length, "clue")} solved (${unaided} without hints), ${plural(revealed.length, "clue")} revealed.`,
      hints ? `${plural(hints, "hint")} taken. Hints cost no points: learning the trick is the point.` : "No hints taken.",
      state.mode === "gentle"
        ? "Gentle clues name their device, so there was no device practice this round."
        : state.mode === "master"
          ? "Master clues offer no device list, so there was no device practice this round."
          : guessed.length
          ? `Device practice: named the device first time on ${firstTry} of ${plural(guessed.length, "clue")} you tried.`
          : "Device practice was not tried this round; it is optional.",
      ...(revealed.length ? [`Revealed clues score 0 and mark the round as assisted.`] : []),
    ];
    const explanation = state.clues.map((c, i) => {
      const how = explainOperation(c);
      return `${i + 1}. ${c.text} ${enumerationText(c)}: ${c.answer}. Definition "${c.definition}". ${deviceDetail(c)}. ${how}${c.note ? ` ${c.note}` : ""}`;
    });
    return {
      outcome,
      headline,
      scoreText: `${s} of 100`,
      score: s,
      maxScore: 100,
      efficiency: null,
      assistance: { hints, reveals: revealed.length },
      details,
      shareText: `Word Club · Cryptic Workshop · ${state.mode[0].toUpperCase()}${state.mode.slice(1)} · ${solved.length}/${total} solved · ${
        hints + revealed.length ? `${plural(hints, "hint")}, ${revealed.length} revealed` : "unassisted"
      }`,
      explanation,
    };
  },

  validateSnapshot(snapshot: unknown) {
    const s = snapshot as WorkshopState;
    if (!s || !Array.isArray(s.clues) || !s.progress) return { ok: false, reason: "The saved workshop is incomplete." };
    for (const c of s.clues) if (!s.progress[c.id]) return { ok: false, reason: "The saved workshop is missing a clue." };
    return { ok: true, state: s };
  },
};

/** Letters in the answer, for the enumeration display. */
export function enumerationBoxes(c: Pick<CrypticClue, "enumeration">): number[] {
  return enumerationLengths(c.enumeration);
}
