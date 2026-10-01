"use client";

import { useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import type { PlayProps } from "../play-types";
import type { RoundBundle } from "../types";
import { definition } from "./definition";
import { createWordWeaveEngine, entryAt, laneCorrect, type WeaveAction, type WeavePayload, type WeaveState } from "./engine";
import type { Direction, Lane } from "./board";
import { useGameSession } from "@/hooks/useGameSession";
import { GameShell } from "@/components/game/GameShell";
import { ConfirmDialog } from "@/components/ui/Dialog";
import "./weave.css";

interface Draft {
  cell: number;
  dir: Direction;
  text: string;
}

export default function Play({ bundle, siblings }: PlayProps) {
  if (!bundle) return null;
  return <WeaveGame bundle={bundle as RoundBundle<WeavePayload>} siblings={siblings ?? []} />;
}

function WeaveGame({ bundle, siblings }: { bundle: RoundBundle<WeavePayload>; siblings: NonNullable<PlayProps["siblings"]> }) {
  const engine = useMemo(() => createWordWeaveEngine(), []);
  const session = useGameSession<WeavePayload, WeaveState, WeaveAction, Draft>({ engine, round: bundle.payload, meta: bundle.meta, title: bundle.meta.title ?? "Word Weave" });
  const { state, dispatch } = session;
  const cellRefs = useRef(new Map<number, HTMLInputElement>());
  const wasFocused = useRef(false);
  const [confirm, setConfirm] = useState<null | "check" | "reveal">(null);
  const finished = session.outcome !== "playing";

  const lanesAt = (c: number) => state.lanes.filter((l) => l.cells.includes(c));
  const raw = session.draft;
  const sel: Draft = raw && state.active.includes(raw.cell) ? raw : { cell: state.lanes[0].cells[0], dir: state.lanes[0].direction, text: "" };
  const here = lanesAt(sel.cell);
  const lane: Lane = here.find((l) => l.direction === sel.dir) ?? here[0];
  const setSel = (d: Partial<Draft>) => session.setDraft({ ...sel, ...d });

  const focusCell = (c: number) => cellRefs.current.get(c)?.focus();
  const select = (c: number, dir?: Direction) => {
    const ls = lanesAt(c);
    const d = dir && ls.some((l) => l.direction === dir) ? dir : ls.some((l) => l.direction === sel.dir) ? sel.dir : ls[0].direction;
    setSel({ cell: c, dir: d, text: c === sel.cell && d === sel.dir ? sel.text : "" });
  };
  const chooseLane = (l: Lane) => {
    const c = l.cells.find((x) => !entryAt(state, x)) ?? l.cells[0];
    setSel({ cell: c, dir: l.direction, text: "" });
    focusCell(c);
  };

  const step = (c: number, dr: number, dc: number): number | null => {
    let r = Math.floor(c / state.cols) + dr;
    let k = (c % state.cols) + dc;
    while (r >= 0 && r < state.rows && k >= 0 && k < state.cols) {
      const n = r * state.cols + k;
      if (state.active.includes(n)) return n;
      r += dr;
      k += dc;
    }
    return null;
  };

  const type = (c: number, letter: string) => {
    if (finished) return;
    if (state.revealed.includes(c)) {
      session.announce("That square was revealed and cannot be changed.");
    } else if (entryAt(state, c) !== letter) {
      dispatch({ type: "fill", cells: [[c, letter]] });
    }
    const i = lane.cells.indexOf(c);
    const next = lane.cells[i + 1];
    if (next != null) {
      setSel({ cell: next, text: "" });
      focusCell(next);
    }
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>, c: number) => {
    const letters = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
    const l = letters.replace(entryAt(state, c), "").at(-1) ?? letters.at(-1);
    if (l) type(c, l);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>, c: number) => {
    const moves: Record<string, [number, number, Direction]> = {
      ArrowUp: [-1, 0, "down"],
      ArrowDown: [1, 0, "down"],
      ArrowLeft: [0, -1, "across"],
      ArrowRight: [0, 1, "across"],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dr, dc, dir] = moves[e.key];
      // First press along the other axis switches direction at a crossing.
      if (sel.dir !== dir && lanesAt(c).some((l) => l.direction === dir)) return setSel({ dir, text: "" });
      const n = step(c, dr, dc);
      if (n != null) {
        select(n, dir);
        focusCell(n);
      }
      return;
    }
    if (e.key === " ") {
      e.preventDefault();
      const other = lanesAt(c).find((l) => l.direction !== sel.dir);
      if (other) setSel({ dir: other.direction, text: "" });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      dispatch({ type: "submit" });
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      if (finished) return;
      if (entryAt(state, c) && !state.revealed.includes(c)) {
        dispatch({ type: "fill", cells: [[c, ""]] });
        return;
      }
      const i = lane.cells.indexOf(c);
      const prev = e.key === "Backspace" ? lane.cells[i - 1] : undefined;
      if (prev != null) {
        if (entryAt(state, prev) && !state.revealed.includes(prev)) dispatch({ type: "fill", cells: [[prev, ""]] });
        setSel({ cell: prev, text: "" });
        focusCell(prev);
      }
    }
  };

  const enterWhole = (e: FormEvent) => {
    e.preventDefault();
    const word = sel.text.trim().toUpperCase();
    const a = engine.preview(state, `${lane.id}:${word}`);
    if (!a.legal) {
      session.announce(a.message, false, a.code);
      return;
    }
    const t = dispatch({ type: "fill", cells: lane.cells.map((c, i) => [c, word[i]] as [number, string]) });
    if (t.ok) setSel({ text: "" });
  };

  const hintLog = state.hints.map((h) => h.text);
  const wrong = new Set(state.wrongMarks);
  const filled = state.active.filter((c) => entryAt(state, c)).length;
  const otherDir = here.find((l) => l.direction !== lane.direction);

  return (
    <GameShell
      game={definition}
      session={session}
      siblings={siblings}
      hintOffers={engine.hints(state)}
      onTakeHint={(tier) => dispatch({ type: "hint", tier })}
      hintLog={hintLog}
      side={
        <>
          <span className="side-kicker">Your weave</span>
          <h2 data-testid="filled">
            {filled} of {state.active.length} squares filled
          </h2>
          <div className="stat-row">
            <span>Lanes</span>
            <span>{state.lanes.length}</span>
          </div>
          <div className="stat-row">
            <span>Revealed squares</span>
            <span data-testid="revealed-count">{state.revealed.length}</span>
          </div>
          <div className="stat-row">
            <span>Lane checks</span>
            <span>{state.checks.length}</span>
          </div>
          <div className="stat-row">
            <span>Hints</span>
            <span>{state.hints.length}</span>
          </div>
        </>
      }
    >
      <div className="ww-grid-wrap">
        <div
          className="crossword ww-grid"
          role="group"
          aria-label={`Weave grid, ${state.rows} rows by ${state.cols} columns. Arrow keys move, Space switches direction, Enter submits.`}
          style={{ gridTemplateColumns: `repeat(${state.cols}, minmax(44px, 56px))` }}
        >
          {Array.from({ length: state.rows * state.cols }, (_, c) => {
            if (!state.active.includes(c)) return <span key={c} className="cell black" aria-hidden="true" />;
            const ls = lanesAt(c);
            const start = state.lanes.find((l) => l.cells[0] === c);
            const r = Math.floor(c / state.cols);
            const k = c % state.cols;
            const letter = entryAt(state, c);
            const isRev = state.revealed.includes(c);
            const inLane = lane.cells.includes(c);
            const label = [
              `Row ${r + 1}, column ${k + 1}`,
              letter ? `letter ${letter}` : "empty",
              ...ls.map((l) => `${l.label} letter ${l.cells.indexOf(c) + 1}`),
              isRev ? "revealed" : "",
              wrong.has(c) ? "marked wrong" : "",
            ]
              .filter(Boolean)
              .join(", ");
            return (
              <label key={c} className={`cell ww-cell${inLane ? " in-lane" : ""}${c === sel.cell ? " current" : ""}${isRev ? " revealed" : ""}${wrong.has(c) ? " wrong" : ""}`}>
                {start ? <small aria-hidden="true">{start.number}</small> : null}
                <input
                  ref={(el) => {
                    if (el) cellRefs.current.set(c, el);
                    else cellRefs.current.delete(c);
                  }}
                  data-testid={`cell-${r}-${k}`}
                  value={letter}
                  aria-label={label}
                  tabIndex={c === sel.cell ? 0 : -1}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  inputMode="text"
                  readOnly={finished}
                  onFocus={() => c !== sel.cell && select(c)}
                  onPointerDown={(e) => (wasFocused.current = document.activeElement === e.currentTarget)}
                  onClick={() => {
                    // A second tap on the focused square switches direction at a crossing.
                    if (wasFocused.current && c === sel.cell && otherDir) setSel({ dir: otherDir.direction, text: "" });
                    wasFocused.current = false;
                  }}
                  onKeyDown={(e) => onKey(e, c)}
                  onChange={(e) => onChange(e, c)}
                />
                {isRev ? <span className="ww-mark" aria-hidden="true">{"▴"}</span> : null}
                {wrong.has(c) ? <span className="ww-mark wrong" aria-hidden="true">{"×"}</span> : null}
              </label>
            );
          })}
        </div>
      </div>

      <div className="ww-current" data-testid="current-clue">
        <div className="ww-current-head">
          <strong>{lane.label}</strong>
          {otherDir ? (
            <span className="ww-dir" role="group" aria-label="Direction at this square">
              {(["across", "down"] as const).map((d) => (
                <button key={d} type="button" className="text-button small" aria-pressed={lane.direction === d} onClick={() => { setSel({ dir: d, text: "" }); focusCell(sel.cell); }}>
                  {d === "across" ? "Across" : "Down"}
                </button>
              ))}
            </span>
          ) : null}
        </div>
        <p>
          {lane.clue} ({lane.length})
        </p>
        {!finished ? (
          <>
            <form className="ww-whole" onSubmit={enterWhole}>
              <label htmlFor="ww-answer" className="sr-only">
                Whole answer for {lane.label}
              </label>
              <input
                id="ww-answer"
                value={sel.text}
                onChange={(e) => setSel({ text: e.target.value.toUpperCase() })}
                placeholder={`Whole answer (${lane.length} letters)`}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={lane.length + 4}
              />
              <button type="submit" className="btn secondary small">
                Enter answer
              </button>
            </form>
            <div className="ww-lane-tools">
              <button type="button" className="text-button small" onClick={() => setConfirm("check")}>
                Check this lane
              </button>
              <button type="button" className="text-button small" onClick={() => setConfirm("reveal")} disabled={laneCorrect(state, lane)}>
                Reveal this lane
              </button>
            </div>
          </>
        ) : null}
      </div>

      {!finished ? (
        <div className="ww-submit">
          <button type="button" className="btn" onClick={() => dispatch({ type: "submit" })}>
            Submit grid
          </button>
        </div>
      ) : null}

      {state.bankShown && state.bank ? (
        <p className="ww-bank" data-testid="word-bank">
          <strong>Word bank:</strong> {state.bank.join(", ")}
        </p>
      ) : null}

      <div className="ww-clues">
        {(["across", "down"] as const).map((d) => (
          <section key={d} aria-label={d === "across" ? "Across clues" : "Down clues"}>
            <h2>{d === "across" ? "Across" : "Down"}</h2>
            <ul>
              {state.lanes
                .filter((l) => l.direction === d)
                .map((l) => (
                  <li key={l.id}>
                    <button type="button" className={`clue ww-clue${l.id === lane.id ? " active" : ""}`} aria-current={l.id === lane.id} onClick={() => chooseLane(l)}>
                      <strong>{l.number}</strong> {l.clue} ({l.length})
                      {state.hintLane === l.id && !laneCorrect(state, l) ? <em> · suggested</em> : null}
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>

      <ConfirmDialog
        open={confirm === "check"}
        onClose={() => setConfirm(null)}
        title={`Check ${lane.label}?`}
        body="Wrong letters in this lane will be marked. Nothing else changes, but the check is recorded as help in your result."
        confirmLabel="Check the lane"
        onConfirm={() => dispatch({ type: "check", lane: lane.id })}
      />
      <ConfirmDialog
        open={confirm === "reveal"}
        onClose={() => setConfirm(null)}
        title={`Reveal ${lane.label}?`}
        body="Every square of this lane is filled in, including squares it shares with crossing lanes. Squares that change are marked as revealed and do not score."
        confirmLabel="Reveal the lane"
        onConfirm={() => dispatch({ type: "reveal-lane", lane: lane.id })}
      />
    </GameShell>
  );
}
