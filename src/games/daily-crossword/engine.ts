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
import { explainOperation, type Construction } from "../cryptic-workshop/construction";
import { key, numberGrid, runCells, type Cell, type Direction } from "./grid";

export const RULES_VERSION = "1.0";

export type Style = "quick" | "cryptic";

export interface CrypticParse {
  definition: string;
  indicators: string[];
  construction: Construction;
  /** &lit or semi-&lit marker for compound clues (see cryptic-workshop/tree.ts). */
  lit?: "full" | "semi";
}

export interface EntrySpec {
  /** Stable data id; not the display number. */
  id: string;
  direction: Direction;
  row: number;
  col: number;
  answer: string;
  enumeration: string;
  clue: string;
  cryptic?: CrypticParse;
  explanation?: string;
}

export interface CrosswordPayload {
  style: Style;
  /** Solution rows: A-Z letters and '#' for blocks. */
  grid: string[];
  entries: EntrySpec[];
  fixtureHints?: unknown[];
  fixtureNote?: string;
}

export interface Entry extends EntrySpec {
  number: number;
  cells: Cell[];
}

export interface CheckMark {
  letter: string;
  ok: boolean;
}

export interface CrosswordState {
  style: Style;
  solution: string[];
  entries: Entry[];
  /** Current letters, '' for empty; indexed [row][col]. */
  fill: string[][];
  pencil: boolean[][];
  revealed: boolean[][];
  /** Check verdicts by cell key; cleared when that cell changes. */
  checks: Record<string, CheckMark>;
  assists: { checks: number; reveals: number; revealedGrid: boolean };
  complete: boolean;
}

export type Scope = "cell" | "entry" | "grid";

export type CrosswordAction =
  | { type: "set"; row: number; col: number; letter: string; pencil?: boolean }
  | { type: "enter"; entryId: string; text: string; from?: number; pencil?: boolean }
  | { type: "check"; scope: Scope; row?: number; col?: number; entryId?: string }
  | { type: "reveal"; scope: Scope; row?: number; col?: number; entryId?: string }
  | { type: "ink" };

export const DIRECTION_LABEL: Record<Direction, string> = { across: "Across", down: "Down" };

export function entryLabel(e: Pick<Entry, "number" | "direction">): string {
  return `${e.number} ${DIRECTION_LABEL[e.direction]}`;
}

export function buildEntries(p: Pick<CrosswordPayload, "grid" | "entries">): Entry[] {
  const nums = numberGrid(p.grid);
  const entries = p.entries.map((e) => ({
    ...e,
    number: nums.get(key(e.row, e.col)) ?? 0,
    cells: runCells({ direction: e.direction, row: e.row, col: e.col, length: e.answer.length }),
  }));
  return entries.sort((a, b) => (a.direction === b.direction ? a.number - b.number : a.direction === "across" ? -1 : 1));
}

export const whiteCells = (s: Pick<CrosswordState, "solution">): Cell[] =>
  s.solution.flatMap((row, r) => [...row].flatMap((ch, c) => (ch === "#" ? [] : [{ row: r, col: c }])));

export function entriesAt(s: Pick<CrosswordState, "entries">, r: number, c: number): Partial<Record<Direction, Entry>> {
  const out: Partial<Record<Direction, Entry>> = {};
  for (const e of s.entries) if (e.cells.some((x) => x.row === r && x.col === c)) out[e.direction] = e;
  return out;
}

export const entryById = (s: Pick<CrosswordState, "entries">, id: string) => s.entries.find((e) => e.id === id);

const inGrid = (s: CrosswordState, r: number, c: number) =>
  Number.isInteger(r) && Number.isInteger(c) && r >= 0 && c >= 0 && r < s.solution.length && c < s.solution[0].length && s.solution[r][c] !== "#";

export const entryText = (s: CrosswordState, e: Entry) => e.cells.map(({ row, col }) => s.fill[row][col] || "·").join("");
export const entryFilled = (s: CrosswordState, e: Entry) => e.cells.every(({ row, col }) => !!s.fill[row][col]);

function clone2<T>(a: T[][]): T[][] {
  return a.map((row) => [...row]);
}

/** Recompute completion after a change; returns an extra sentence for the feedback. */
function settle(s: CrosswordState): { state: CrosswordState; note: string; code: string | null } {
  const cells = whiteCells(s);
  const allFilled = cells.every(({ row, col }) => !!s.fill[row][col]);
  if (!allFilled) return { state: s, note: "", code: null };
  const anyPencil = cells.some(({ row, col }) => s.pencil[row][col]);
  const allRight = cells.every(({ row, col }) => s.fill[row][col] === s.solution[row][col]);
  if (anyPencil) return { state: s, note: " Every square is filled; ink your pencil letters to have the grid checked.", code: null };
  if (allRight) return { state: { ...s, complete: true }, note: " The grid is complete and correct.", code: "complete" };
  return { state: s, note: " Every square is filled, but some entries need another look.", code: "full-incorrect" };
}

function scopeCells(s: CrosswordState, a: { scope: Scope; row?: number; col?: number; entryId?: string }): { cells: Cell[]; label: string } | { error: string } {
  if (a.scope === "grid") return { cells: whiteCells(s), label: "the grid" };
  if (a.scope === "entry") {
    const e = entryById(s, a.entryId ?? "");
    return e ? { cells: e.cells, label: entryLabel(e) } : { error: "Choose a clue first." };
  }
  if (a.scope === "cell") {
    if (!inGrid(s, a.row ?? -1, a.col ?? -1)) return { error: "Choose a white square first." };
    return { cells: [{ row: a.row!, col: a.col! }], label: `the square at row ${a.row! + 1}, column ${a.col! + 1}` };
  }
  return { error: "Unknown scope." };
}

function writeLetters(s: CrosswordState, writes: { cell: Cell; letter: string }[], pencil: boolean): CrosswordState {
  const fill = clone2(s.fill);
  const pen = clone2(s.pencil);
  const checks = { ...s.checks };
  for (const { cell, letter } of writes) {
    if (fill[cell.row][cell.col] === letter && pen[cell.row][cell.col] === (pencil && !!letter)) continue;
    fill[cell.row][cell.col] = letter;
    pen[cell.row][cell.col] = pencil && !!letter;
    delete checks[key(cell.row, cell.col)];
  }
  return { ...s, fill, pencil: pen, checks };
}

export function assistOffers(s: CrosswordState, active: { row: number; col: number; entryId: string | null }): HintOffer[] {
  const e = active.entryId ? entryById(s, active.entryId) : undefined;
  const open = !s.complete;
  const cellFilled = inGrid(s, active.row, active.col) && !!s.fill[active.row][active.col];
  const cellRevealed = inGrid(s, active.row, active.col) && s.revealed[active.row][active.col];
  const label = e ? entryLabel(e) : "the selected clue";
  const checkCost = "Recorded as assistance in your result.";
  return [
    { tier: 1, label: "Check this letter", description: "Marks the selected square right or wrong.", available: open && cellFilled, reason: open ? "The selected square is empty." : "The grid is complete.", reveal: false, cost: checkCost },
    { tier: 2, label: `Check ${label}`, description: "Marks each filled letter in the selected clue right or wrong.", available: open && !!e && e.cells.some((c) => s.fill[c.row][c.col]), reason: "Nothing to check in this clue yet.", reveal: false, cost: checkCost },
    { tier: 3, label: "Check the whole grid", description: "Marks every filled letter right or wrong.", available: open && whiteCells(s).some((c) => s.fill[c.row][c.col]), reason: "Nothing to check yet.", reveal: false, cost: checkCost },
    { tier: 4, label: "Reveal this letter", description: "Fills the selected square with the correct letter. Revealed letters are fixed.", available: open && !cellRevealed, reason: "Already revealed, or the grid is complete.", reveal: true, cost: "Recorded as a reveal in your result." },
    { tier: 5, label: `Reveal ${label}`, description: "Fills every square of the selected clue.", available: open && !!e && e.cells.some((c) => !s.revealed[c.row][c.col]), reason: "Already revealed, or the grid is complete.", reveal: true, cost: "Recorded as a reveal in your result." },
    { tier: 6, label: "Reveal the whole grid", description: "Fills every square and ends the puzzle with a revealed result.", available: open, reason: "The grid is complete.", reveal: true, cost: "The result is marked as revealed." },
  ];
}

export const dailyCrosswordEngine: GameEngine<CrosswordPayload, CrosswordState, CrosswordAction> = {
  gameId: "daily-crossword",
  rulesVersion: RULES_VERSION,

  initialise(round: CrosswordPayload, _options: SessionOptions): CrosswordState {
    void _options;
    const R = round.grid.length;
    const C = round.grid[0].length;
    const blank = <T,>(v: T) => Array.from({ length: R }, () => Array.from({ length: C }, () => v));
    return {
      style: round.style,
      solution: round.grid,
      entries: buildEntries(round),
      fill: blank(""),
      pencil: blank(false),
      revealed: blank(false),
      checks: {},
      assists: { checks: 0, reveals: 0, revealedGrid: false },
      complete: false,
    };
  },

  preview(state) {
    const filled = whiteCells(state).filter((c) => state.fill[c.row][c.col]).length;
    return { legal: true, code: "ok", message: `${filled} of ${whiteCells(state).length} squares filled.` };
  },

  apply(s, a): Transition<CrosswordState> {
    if (s.complete) return reject(s, "complete", "The grid is already complete.");
    switch (a.type) {
      case "set": {
        if (!inGrid(s, a.row, a.col)) return reject(s, "not-a-square", "That is not a white square.");
        const letter = (a.letter ?? "").toUpperCase();
        if (letter && !/^[A-Z]$/.test(letter)) return reject(s, "non-letter", "Use a single letter A to Z.");
        if (s.revealed[a.row][a.col]) return reject(s, "revealed-fixed", "That letter was revealed, so it is fixed.");
        const next = writeLetters(s, [{ cell: { row: a.row, col: a.col }, letter }], !!a.pencil);
        const st = settle(next);
        // Ordinary keystrokes are not announced (empty message); only a filled-grid verdict is.
        return accept(st.state, st.code ?? (letter ? "set" : "cleared"), st.note.trim());
      }
      case "enter": {
        const e = entryById(s, a.entryId);
        if (!e) return reject(s, "unknown-entry", "That clue is not in this puzzle.");
        const raw = (a.text ?? "").normalize("NFC").trim();
        if (!raw) return reject(s, "empty", "Type an answer first.");
        if (/[^A-Za-z\s'-]/.test(raw)) return reject(s, "non-letters", "Use letters A to Z only.");
        const letters = raw.toUpperCase().replace(/[^A-Z]/g, "");
        const from = a.from ?? 0;
        if (!Number.isInteger(from) || from < 0 || from >= e.cells.length) return reject(s, "bad-position", "That position is outside the clue.");
        if (a.from === undefined && letters.length !== e.cells.length) {
          return reject(s, "wrong-length", `${entryLabel(e)} needs ${plural(e.cells.length, "letter")} (${e.enumeration}); you entered ${letters.length}. Your text is kept so you can adjust it.`);
        }
        if (from + letters.length > e.cells.length) return reject(s, "too-long", `Only ${plural(e.cells.length - from, "letter")} fit from there in ${entryLabel(e)}.`);
        const writes = [...letters].map((letter, i) => ({ cell: e.cells[from + i], letter }));
        const clash = writes.find(({ cell, letter }) => s.revealed[cell.row][cell.col] && s.fill[cell.row][cell.col] !== letter);
        if (clash) {
          return reject(s, "revealed-clash", `Letter ${e.cells.indexOf(clash.cell) + 1} of ${entryLabel(e)} was revealed as ${s.fill[clash.cell.row][clash.cell.col]}; your text is kept.`);
        }
        const next = writeLetters(s, writes.filter(({ cell }) => !s.revealed[cell.row][cell.col]), !!a.pencil);
        const st = settle(next);
        return accept(st.state, st.code ?? "entered", `Entered ${letters} in ${entryLabel(e)}.${st.note}`);
      }
      case "check": {
        const sc = scopeCells(s, a);
        if ("error" in sc) return reject(s, "bad-scope", sc.error);
        const filled = sc.cells.filter((c) => s.fill[c.row][c.col] && !s.revealed[c.row][c.col]);
        if (!filled.length) return reject(s, "nothing-to-check", `There are no letters to check in ${sc.label}.`);
        const checks = { ...s.checks };
        let wrong = 0;
        for (const c of filled) {
          const ok = s.fill[c.row][c.col] === s.solution[c.row][c.col];
          if (!ok) wrong++;
          checks[key(c.row, c.col)] = { letter: s.fill[c.row][c.col], ok };
        }
        const next = { ...s, checks, assists: { ...s.assists, checks: s.assists.checks + 1 } };
        const msg = wrong
          ? `Checked ${sc.label}: ${plural(wrong, "letter")} wrong, marked with a cross.`
          : `Checked ${sc.label}: all ${plural(filled.length, "letter")} right.`;
        return accept(next, "checked", msg);
      }
      case "reveal": {
        const sc = scopeCells(s, a);
        if ("error" in sc) return reject(s, "bad-scope", sc.error);
        const todo = sc.cells.filter((c) => !s.revealed[c.row][c.col]);
        if (!todo.length) return reject(s, "nothing-to-reveal", `Everything in ${sc.label} is already revealed.`);
        const fill = clone2(s.fill);
        const pencil = clone2(s.pencil);
        const revealed = clone2(s.revealed);
        const checks = { ...s.checks };
        for (const c of todo) {
          fill[c.row][c.col] = s.solution[c.row][c.col];
          pencil[c.row][c.col] = false;
          revealed[c.row][c.col] = true;
          delete checks[key(c.row, c.col)];
        }
        const next: CrosswordState = {
          ...s,
          fill,
          pencil,
          revealed,
          checks,
          assists: { ...s.assists, reveals: s.assists.reveals + 1, revealedGrid: s.assists.revealedGrid || a.scope === "grid" },
        };
        const st = settle(next);
        return accept(st.state, st.code ?? "revealed", `Revealed ${sc.label}.${st.note}`);
      }
      case "ink": {
        const any = whiteCells(s).some((c) => s.pencil[c.row][c.col]);
        if (!any) return reject(s, "no-pencil", "There are no pencil letters to ink.");
        const next = { ...s, pencil: s.pencil.map((row) => row.map(() => false)) };
        const st = settle(next);
        return accept(st.state, st.code ?? "inked", `Pencil letters inked.${st.note}`);
      }
      default:
        return reject(s, "unknown-action", "Unknown action.");
    }
  },

  hints(state) {
    const first = state.entries.find((e) => !entryFilled(state, e)) ?? state.entries[0];
    return assistOffers(state, { row: first.cells[0].row, col: first.cells[0].col, entryId: first.id });
  },

  outcome(s): Outcome {
    if (!s.complete) return "playing";
    const all = whiteCells(s).every((c) => s.revealed[c.row][c.col]);
    return s.assists.revealedGrid || all ? "revealed" : "completed";
  },

  result(s): ResultSummary | null {
    if (!s.complete) return null;
    const cells = whiteCells(s);
    const revealedCells = cells.filter((c) => s.revealed[c.row][c.col]).length;
    const own = cells.length - revealedCells;
    const unaidedEntries = s.entries.filter((e) => e.cells.every((c) => !s.revealed[c.row][c.col])).length;
    const outcome = dailyCrosswordEngine.outcome(s) as "completed" | "revealed";
    const style = s.style === "cryptic" ? "Cryptic" : "Quick";
    const assisted = s.assists.checks + s.assists.reveals > 0;
    return {
      outcome,
      headline:
        outcome === "revealed"
          ? "Grid revealed. The answers and explanations are below."
          : assisted
            ? `${style} crossword complete, with some help.`
            : `${style} crossword complete, unassisted.`,
      scoreText: `${own} of ${cells.length} squares filled by you`,
      score: own,
      maxScore: cells.length,
      efficiency: null,
      assistance: { hints: s.assists.checks, reveals: s.assists.reveals },
      details: [
        `${style} edition, ${plural(s.entries.length, "clue")}.`,
        `${plural(unaidedEntries, "entry", "entries")} solved without any revealed letters.`,
        s.assists.checks ? `${plural(s.assists.checks, "check")} used.` : "No checks used.",
        s.assists.reveals ? `${plural(s.assists.reveals, "reveal")} used (${plural(revealedCells, "square")}).` : "No reveals used.",
      ],
      shareText: `Word Club · Crossword (${style}) · ${cells.length} squares · ${assisted ? `${plural(s.assists.checks, "check")}, ${plural(s.assists.reveals, "reveal")}` : "unassisted"}`,
      explanation: s.entries.map((e) => {
        const parse = e.cryptic ? ` ${explainOperation({ text: e.clue, answer: e.answer, enumeration: e.enumeration, ...e.cryptic })}` : "";
        return `${entryLabel(e)}: ${e.clue} (${e.enumeration}): ${e.answer}.${parse}${e.explanation ? ` ${e.explanation}` : ""}`;
      }),
    };
  },

  validateSnapshot(snapshot: unknown) {
    const s = snapshot as CrosswordState;
    if (!s?.fill || s.fill.length !== s.solution.length) return { ok: false, reason: "The saved grid does not match the puzzle." };
    return { ok: true, state: s };
  },
};

/** Tier numbers from assistOffers mapped to actions. */
export function assistAction(tier: number, active: { row: number; col: number; entryId: string | null }): CrosswordAction {
  const type = tier <= 3 ? "check" : "reveal";
  const scope: Scope = tier === 1 || tier === 4 ? "cell" : tier === 2 || tier === 5 ? "entry" : "grid";
  return { type, scope, row: active.row, col: active.col, entryId: active.entryId ?? undefined };
}
