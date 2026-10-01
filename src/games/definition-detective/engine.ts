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
import { createRng } from "@/lib/rng";
import { plural } from "@/lib/text";

/**
 * Definition Detective (games/definition-detective.md, upgrades/definition-detective.md, docs/07).
 * A round is a case file of three cases. Each case: a sentence with a target word, four definitions
 * and three evidence phrases (stable ids, shuffled per session). Choose a definition (80 points) and the
 * evidence phrase that most directly supports it (20 points). Definitions alone complete a case.
 * Round score = floor(average of case scores). A full reveal scores 0 for that case.
 */
export const RULES_VERSION = "1.0";
export const DEFINITION_POINTS = 80;
export const EVIDENCE_POINTS = 20;

export interface Choice {
  id: string;
  text: string;
}

export interface DetectiveCase {
  id: string;
  word: string;
  sentence: string;
  definitions: Choice[];
  evidence: Choice[];
  answer: { definitionId: string; evidenceId: string };
  /** Hint 1: points to the part of the sentence that matters, without naming the answer. */
  focus: string;
  /** Why each wrong definition fails (keyed by definition id). */
  whyNot: Record<string, string>;
  /** Preferred distractor ruled out by hint 2. */
  eliminate: string;
  explanation: string;
  learnMore: { definition: string; example: string };
}

export interface DetectivePayload {
  cases: DetectiveCase[];
  explanation: string;
  /** Pack fixtures only: original round-level sample hints, kept for provenance. */
  fixtureHints?: string[];
}

export interface CaseState {
  id: string;
  word: string;
  sentence: string;
  definitions: Choice[];
  evidence: Choice[];
  /** Seeded display orders (ids); correctness never depends on position. */
  definitionOrder: string[];
  evidenceOrder: string[];
  answer: { definitionId: string; evidenceId: string };
  focus: string;
  whyNot: Record<string, string>;
  eliminate: string;
  explanation: string;
  learnMore: { definition: string; example: string };
  definitionSolved: boolean;
  evidenceSolved: boolean;
  /** none | evidence (evidence shown after a solved definition) | full (definition and evidence shown). */
  revealed: "none" | "evidence" | "full";
  triedDefinitions: string[];
  triedEvidence: string[];
  submissions: number;
  hintLevel: number;
  eliminated: string | null;
}

export interface HintRecord {
  case: string;
  tier: number;
  text: string;
}

export interface DetectiveState {
  cases: CaseState[];
  active: number;
  hints: HintRecord[];
  finished: boolean;
  explanation: string;
}

export type DetectiveAction =
  | { type: "select"; case: string }
  | { type: "submit"; case: string; definitionId?: string | null; evidenceId?: string | null }
  | { type: "hint"; tier: number }
  | { type: "finish" }
  | { type: "resume" };

export const HINT_FOCUS = 1;
export const HINT_ELIMINATE = 2;
export const HINT_REVEAL = 3;

export const definitionDone = (c: CaseState) => c.definitionSolved || c.revealed === "full";
export const evidenceDone = (c: CaseState) => c.evidenceSolved || c.revealed !== "none";
export const caseClosed = (c: CaseState) => definitionDone(c) && evidenceDone(c);

export function caseScore(c: CaseState): number {
  if (c.revealed === "full") return 0;
  return (c.definitionSolved ? DEFINITION_POINTS : 0) + (c.evidenceSolved ? EVIDENCE_POINTS : 0);
}

export function roundScore(s: Pick<DetectiveState, "cases">): number {
  return Math.floor(s.cases.reduce((a, c) => a + caseScore(c), 0) / s.cases.length);
}

const textOf = (list: Choice[], id: string) => list.find((x) => x.id === id)?.text ?? id;

export function createDefinitionDetectiveEngine(): GameEngine<DetectivePayload, DetectiveState, DetectiveAction> {
  const at = (s: DetectiveState, id: string) => s.cases.findIndex((c) => c.id === id);
  const withCase = (s: DetectiveState, i: number, c: CaseState): DetectiveState => ({ ...s, cases: s.cases.map((x, k) => (k === i ? c : x)) });
  const allDefinitions = (s: DetectiveState) => s.cases.every(definitionDone);
  const label = (s: DetectiveState, i: number) => `Case ${i + 1} (${s.cases[i].word})`;

  const engine: GameEngine<DetectivePayload, DetectiveState, DetectiveAction> = {
    gameId: "definition-detective",
    rulesVersion: RULES_VERSION,

    initialise(round: DetectivePayload, options: SessionOptions): DetectiveState {
      const rng = createRng(options.seed);
      return {
        cases: round.cases.map((c) => ({
          id: c.id,
          word: c.word,
          sentence: c.sentence,
          definitions: c.definitions,
          evidence: c.evidence,
          definitionOrder: rng.shuffle(c.definitions.map((d) => d.id)),
          evidenceOrder: rng.shuffle(c.evidence.map((e) => e.id)),
          answer: c.answer,
          focus: c.focus,
          whyNot: c.whyNot,
          eliminate: c.eliminate,
          explanation: c.explanation,
          learnMore: c.learnMore,
          definitionSolved: false,
          evidenceSolved: false,
          revealed: "none",
          triedDefinitions: [],
          triedEvidence: [],
          submissions: 0,
          hintLevel: 0,
          eliminated: null,
        })),
        active: 0,
        hints: [],
        finished: false,
        explanation: round.explanation,
      };
    },

    preview() {
      return { legal: true, code: "ok", message: "" };
    },

    apply(state, action): Transition<DetectiveState> {
      switch (action.type) {
        case "select": {
          const i = at(state, action.case);
          if (i < 0) return reject(state, "unknown-case", "That case is not in this file.");
          if (i === state.active) return reject(state, "already-selected", `${label(state, i)} is already open.`);
          return accept({ ...state, active: i }, "selected", `${label(state, i)} of ${state.cases.length}.`);
        }
        case "submit": {
          const i = at(state, action.case);
          if (i < 0) return reject(state, "unknown-case", "That case is not in this file.");
          const c = state.cases[i];
          if (caseClosed(c)) return reject(state, "case-closed", `${label(state, i)} is already closed. Nothing more to score here.`);
          const d = action.definitionId ?? null;
          const e = action.evidenceId ?? null;
          if (d && !c.definitions.some((x) => x.id === d)) return reject(state, "unknown-choice", "That definition is not one of the options.");
          if (e && !c.evidence.some((x) => x.id === e)) return reject(state, "unknown-choice", "That evidence is not one of the options.");

          if (!definitionDone(c)) {
            if (!d) return reject(state, "choose-definition", "Choose a definition first. Evidence is optional.");
            if (c.triedDefinitions.includes(d)) return reject(state, "already-tried", "You have already tried that definition. Choose another.");
            if (e && c.triedEvidence.includes(e)) return reject(state, "already-tried", "You have already tried that evidence. Choose another phrase, or leave evidence empty.");
            if (d !== c.answer.definitionId) {
              const nc: CaseState = { ...c, triedDefinitions: [...c.triedDefinitions, d], submissions: c.submissions + 1 };
              return accept(withCase(state, i, nc), "definition-wrong", "That definition does not fit this sentence. Read the context again and try another; no points are lost.");
            }
            let nc: CaseState = { ...c, definitionSolved: true, submissions: c.submissions + 1 };
            let code = "definition-solved";
            let msg = `Right definition: ${DEFINITION_POINTS} points. Add the supporting evidence for ${EVIDENCE_POINTS} more whenever you like.`;
            if (e) {
              if (e === c.answer.evidenceId) {
                nc = { ...nc, evidenceSolved: true };
                code = "case-solved";
                msg = `Right definition and the decisive evidence: ${DEFINITION_POINTS + EVIDENCE_POINTS} points.`;
              } else {
                nc = { ...nc, triedEvidence: [...c.triedEvidence, e] };
                code = "evidence-weak";
                msg = `Right definition: ${DEFINITION_POINTS} points. That phrase is weaker support; choose different evidence for ${EVIDENCE_POINTS} more without losing the definition.`;
              }
            }
            const next = withCase(state, i, nc);
            const all = !allDefinitions(state) && allDefinitions(next);
            return accept(next, all ? "file-complete" : code, `${msg}${all ? " Every definition in this file is solved." : ""}`);
          }

          // Definition already settled: only evidence can still be scored.
          if (d && d !== c.answer.definitionId) return reject(state, "definition-locked", "The definition for this case is already solved; only the evidence can change.");
          if (!e) return reject(state, "choose-evidence", "Choose an evidence phrase to submit.");
          if (c.triedEvidence.includes(e)) return reject(state, "already-tried", "You have already tried that evidence. Choose another phrase.");
          if (e !== c.answer.evidenceId) {
            const nc: CaseState = { ...c, triedEvidence: [...c.triedEvidence, e], submissions: c.submissions + 1 };
            return accept(withCase(state, i, nc), "evidence-weak", "That phrase is weaker support. Your definition still counts; try another phrase.");
          }
          const nc: CaseState = { ...c, evidenceSolved: true, submissions: c.submissions + 1 };
          return accept(withCase(state, i, nc), "case-solved", `That is the decisive evidence: ${EVIDENCE_POINTS} more points.`);
        }
        case "hint": {
          const i = state.active;
          const c = state.cases[i];
          if (!c || caseClosed(c)) return reject(state, "hint-unavailable", "This case is closed. Choose an open case for a hint.");
          const rec = (tier: number, text: string) => [...state.hints, { case: c.id, tier, text }];
          if (action.tier === HINT_FOCUS) {
            if (c.hintLevel >= 1) return reject(state, "hint-unavailable", "You already have the pointer for this case.");
            const text = `${label(state, i)}: ${c.focus}`;
            return accept({ ...withCase(state, i, { ...c, hintLevel: 1 }), hints: rec(HINT_FOCUS, text) }, "hint", text);
          }
          if (action.tier === HINT_ELIMINATE) {
            if (c.hintLevel < 1) return reject(state, "hint-unavailable", "Take the pointer hint first.");
            if (c.eliminated) return reject(state, "hint-unavailable", "A definition has already been ruled out for this case.");
            if (definitionDone(c)) return reject(state, "hint-unavailable", "The definition is already solved; only the evidence remains.");
            const wrong = c.definitions.map((x) => x.id).filter((id) => id !== c.answer.definitionId && !c.triedDefinitions.includes(id));
            const target = wrong.includes(c.eliminate) ? c.eliminate : wrong[0];
            if (!target) return reject(state, "hint-unavailable", "Every wrong definition has already been tried.");
            const text = `${label(state, i)}: “${textOf(c.definitions, target)}” does not fit. ${c.whyNot[target] ?? ""}`.trim();
            return accept({ ...withCase(state, i, { ...c, hintLevel: 2, eliminated: target }), hints: rec(HINT_ELIMINATE, text) }, "hint", text);
          }
          if (action.tier === HINT_REVEAL) {
            const evidence = textOf(c.evidence, c.answer.evidenceId);
            if (definitionDone(c)) {
              const text = `${label(state, i)}: the decisive evidence is “${evidence}”. ${c.explanation}`;
              return accept({ ...withCase(state, i, { ...c, hintLevel: 3, revealed: "evidence" }), hints: rec(HINT_REVEAL, text) }, "revealed", `${text} Your ${DEFINITION_POINTS} definition points stand; the evidence scores 0.`);
            }
            const text = `${label(state, i)} revealed: “${textOf(c.definitions, c.answer.definitionId)}”, supported by “${evidence}”. ${c.explanation}`;
            const next = { ...withCase(state, i, { ...c, hintLevel: 3, revealed: "full" as const }), hints: rec(HINT_REVEAL, text) };
            const all = allDefinitions(next);
            return accept(next, all ? "file-complete" : "revealed", `${text} This case scores 0 but counts as completed.${all ? " Every definition in this file is settled." : ""}`);
          }
          return reject(state, "hint-unavailable", "That hint does not exist.");
        }
        case "finish":
          if (state.finished) return reject(state, "already-finished", "This file is already finished.");
          if (allDefinitions(state)) return reject(state, "already-finished", "Every definition is already settled.");
          return accept({ ...state, finished: true }, "finished", "File closed for now. Unsolved cases are left unexplored; you can come back to them.");
        case "resume":
          if (!state.finished) return reject(state, "not-finished", "The file is still open.");
          return accept({ ...state, finished: false }, "resumed", "Back to the case file.");
        default:
          return reject(state, "unknown-action", "Unknown action.");
      }
    },

    hints(state): HintOffer[] {
      const i = state.active;
      const c = state.cases[i];
      const open = !!c && !caseClosed(c);
      const lvl = c?.hintLevel ?? 0;
      const where = c ? `case ${i + 1}` : "this case";
      const closed = "This case is closed. Choose an open case.";
      const defDone = !!c && definitionDone(c);
      return [
        {
          tier: HINT_FOCUS,
          label: "Where to look",
          description: `Points to the part of the sentence that matters in ${where}. Your selections are not changed.`,
          available: open && lvl < 1,
          reason: !open ? closed : "Already taken for this case.",
          reveal: false,
          cost: "No points lost; the case is marked as solved with help.",
        },
        {
          tier: HINT_ELIMINATE,
          label: "Rule out a definition",
          description: `Explains why one wrong definition in ${where} does not fit.`,
          available: open && lvl >= 1 && !c.eliminated && !defDone,
          reason: !open ? closed : defDone ? "The definition is already solved." : lvl < 1 ? "Take the pointer first." : "Already taken for this case.",
          reveal: false,
          cost: "No points lost; the case is marked as solved with help.",
        },
        {
          tier: HINT_REVEAL,
          label: defDone ? "Reveal the evidence" : "Reveal the answer",
          description: defDone
            ? `Shows the decisive evidence for ${where} with an explanation.`
            : `Shows the definition and the evidence for ${where} with an explanation.`,
          available: open,
          reason: closed,
          reveal: true,
          cost: defDone ? "The evidence scores 0; your definition points stand." : "This case scores 0 but counts as completed.",
        },
      ];
    },

    outcome(state): Outcome {
      if (allDefinitions(state)) return state.cases.every((c) => c.revealed === "full") ? "revealed" : "completed";
      if (state.finished) return "abandoned";
      return "playing";
    },

    result(state): ResultSummary | null {
      const done = allDefinitions(state);
      if (!done && !state.finished) return null;
      const score = roundScore(state);
      const n = state.cases.length;
      const fullReveals = state.cases.filter((c) => c.revealed === "full").length;
      const evReveals = state.cases.filter((c) => c.revealed === "evidence").length;
      const hints = state.hints.filter((h) => h.tier !== HINT_REVEAL).length;
      const independent = state.cases.filter((c) => c.definitionSolved && c.evidenceSolved && c.hintLevel === 0).length;
      const solvedDefs = state.cases.filter((c) => c.definitionSolved).length;
      const outcome = done ? (fullReveals === n ? "revealed" : "completed") : "abandoned";
      return {
        outcome,
        headline:
          outcome === "revealed"
            ? "Every case was revealed this time."
            : outcome === "abandoned"
              ? `You solved ${solvedDefs} of ${n} definitions.`
              : independent === n
                ? "Case closed: every definition and every piece of evidence, unaided."
                : `${solvedDefs} of ${n} definitions solved${fullReveals ? `, ${fullReveals} revealed` : ""}.`,
        scoreText: `${score} of 100 points`,
        score,
        maxScore: 100,
        efficiency: null,
        assistance: { hints, reveals: fullReveals + evReveals },
        details: [
          ...state.cases.map((c, i) => {
            const pts = caseScore(c);
            const help = c.hintLevel > 0 && c.hintLevel < 3 ? `, with ${plural(c.hintLevel, "hint")}` : "";
            const name = `Case ${i + 1}, ${c.word.toUpperCase()}`;
            if (c.revealed === "full") return `${name}: revealed (0 points).`;
            if (!c.definitionSolved) return `${name}: left unexplored.`;
            const ev = c.evidenceSolved ? "definition and evidence" : c.revealed === "evidence" ? "definition; evidence revealed" : "definition only; evidence still open";
            const indep = c.hintLevel === 0 && c.evidenceSolved ? ", solved independently" : help;
            return `${name}: ${ev}${indep} (${pts} points).`;
          }),
          `Score is the average of the case scores, rounded down (definition ${DEFINITION_POINTS}, evidence ${EVIDENCE_POINTS}). It measures this practice file only.`,
          ...(done && state.cases.some((c) => c.definitionSolved && !evidenceDone(c)) ? ["You can still choose evidence for the open cases; the score updates."] : []),
        ],
        shareText: `Word Club · Definition Detective · ${solvedDefs}/${n} definitions · ${score} pts${hints + fullReveals + evReveals ? ` · ${hints} hint${hints === 1 ? "" : "s"}, ${fullReveals + evReveals} revealed` : " · unassisted"}`,
        explanation: state.cases
          .filter((c) => definitionDone(c))
          .map((c) => {
            const why = Object.entries(c.whyNot)
              .map(([id, w]) => `Not “${textOf(c.definitions, id)}”: ${w}`)
              .join(" ");
            return `${c.word.toUpperCase()}: ${c.explanation} ${why}`;
          }),
      };
    },

    validateSnapshot(snapshot) {
      const s = snapshot as DetectiveState;
      if (!s || !Array.isArray(s.cases)) return { ok: false, reason: "The saved case file is not readable." };
      return { ok: true, state: s };
    },
  };
  return engine;
}
