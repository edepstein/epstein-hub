"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import type { PlayProps } from "../play-types";
import type { RoundBundle } from "../types";
import { definition } from "./definition";
import {
  assistAction,
  assistOffers,
  dailyCrosswordEngine as engine,
  entriesAt,
  entryFilled,
  entryLabel,
  whiteCells,
  type CrosswordAction,
  type CrosswordPayload,
  type CrosswordState,
  type Entry,
} from "./engine";
import { key } from "./grid";
import { activeEntry, advance, arrow, edge, fixCursor, focusEntry, jumpEntry, retreat, startCursor, toggle, type Cursor } from "./nav";
import { useGameSession } from "@/hooks/useGameSession";
import { GameShell } from "@/components/game/GameShell";
import { ConfirmDialog } from "@/components/ui/Dialog";
import "./crossword.css";

interface Draft extends Cursor {
  pencil?: boolean;
  zoom?: number;
  answer?: string;
}

const ZOOMS = [1, 1.25, 1.5, 2];

export default function Play({ bundle, siblings }: PlayProps) {
  if (!bundle) return null;
  return <Crossword bundle={bundle as RoundBundle<CrosswordPayload>} siblings={siblings ?? []} />;
}

function Crossword({ bundle, siblings }: { bundle: RoundBundle<CrosswordPayload>; siblings: NonNullable<PlayProps["siblings"]> }) {
  const session = useGameSession<CrosswordPayload, CrosswordState, CrosswordAction, Draft>({
    engine,
    round: bundle.payload,
    meta: bundle.meta,
    title: bundle.meta.title ?? "Daily Crossword",
  });
  const { state, dispatch } = session;
  const R = state.solution.length;
  const C = state.solution[0].length;
  const raw = session.draft;
  const cur: Cursor = raw && raw.row < R && raw.col < C && state.solution[raw.row][raw.col] !== "#" ? fixCursor(state, raw) : startCursor(state);
  const draft: Draft = { ...raw, ...cur };
  const pencil = !!draft.pencil;
  const zoom = ZOOMS.includes(draft.zoom ?? 1) ? (draft.zoom ?? 1) : 1;
  const entry = activeEntry(state, cur)!;
  const crossing = entriesAt(state, cur.row, cur.col)[cur.dir === "across" ? "down" : "across"];
  const done = session.outcome !== "playing";

  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const wantFocus = useRef(false);
  const pointerWasActive = useRef(false);
  const listRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [confirmGrid, setConfirmGrid] = useState(false);

  const setDraft = (patch: Partial<Draft>) => session.setDraft({ ...draft, ...patch });
  const moveTo = (c: Cursor, focus = true) => {
    wantFocus.current = focus;
    setDraft({ row: c.row, col: c.col, dir: c.dir });
  };

  // Keep keyboard focus on the active square after cursor moves initiated from the grid or clue list.
  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    cellRefs.current.get(key(cur.row, cur.col))?.focus({ preventScroll: false });
  }, [cur.row, cur.col, cur.dir]);

  // Keep the active clue visible inside a scrolling clue list without scrolling the page.
  useEffect(() => {
    for (const id of [entry.id, crossing?.id]) {
      const el = id ? listRefs.current.get(id) : null;
      const box = el?.closest(".xw-list") as HTMLElement | null;
      if (!el || !box || box.scrollHeight <= box.clientHeight) continue;
      const top = el.offsetTop - box.offsetTop;
      if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = Math.max(0, top - 8);
    }
  }, [entry.id, crossing?.id]);

  const typeLetter = (letter: string) => {
    if (state.revealed[cur.row][cur.col]) {
      moveTo(advance(state, cur));
      return;
    }
    const t = dispatch({ type: "set", row: cur.row, col: cur.col, letter, pencil });
    if (t.ok) moveTo(advance(t.state, cur));
  };

  const backspace = () => {
    const here = state.fill[cur.row][cur.col];
    if (here && !state.revealed[cur.row][cur.col]) {
      dispatch({ type: "set", row: cur.row, col: cur.col, letter: "" });
      return;
    }
    const prev = retreat(state, cur);
    moveTo(prev);
    if ((prev.row !== cur.row || prev.col !== cur.col) && state.fill[prev.row][prev.col] && !state.revealed[prev.row][prev.col]) {
      dispatch({ type: "set", row: prev.row, col: prev.col, letter: "" });
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (/^[a-zA-Z]$/.test(k)) {
      e.preventDefault();
      if (!done) typeLetter(k.toUpperCase());
      return;
    }
    switch (k) {
      case "Backspace":
        e.preventDefault();
        if (!done) backspace();
        return;
      case "Delete":
        e.preventDefault();
        if (!done && state.fill[cur.row][cur.col] && !state.revealed[cur.row][cur.col]) dispatch({ type: "set", row: cur.row, col: cur.col, letter: "" });
        return;
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
        e.preventDefault();
        moveTo(arrow(state, cur, k));
        return;
      case " ":
      case "Enter":
        e.preventDefault();
        moveTo(toggle(state, cur));
        return;
      case "Home":
      case "End":
        e.preventDefault();
        moveTo(edge(state, cur, k === "Home" ? "first" : "last"));
        return;
      case "Tab": {
        const next = jumpEntry(state, cur, e.shiftKey ? -1 : 1);
        if (next) {
          e.preventDefault();
          moveTo(next);
        }
        return;
      }
      default:
        if (k.length === 1) {
          e.preventDefault();
          session.announce("Use letters A to Z only.", false, "non-letter");
        }
    }
  };

  // Touch keyboards often send input events rather than key events.
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (done) return;
    const v = e.target.value.toUpperCase();
    const current = state.fill[cur.row][cur.col];
    if (!v) {
      if (current) dispatch({ type: "set", row: cur.row, col: cur.col, letter: "" });
      return;
    }
    const letters = v.replace(/[^A-Z]/g, "");
    const fresh = letters.replace(current, "") || letters;
    if (!fresh) {
      session.announce("Use letters A to Z only.", false, "non-letter");
      return;
    }
    typeLetter(fresh[fresh.length - 1]);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (done) return;
    const text = e.clipboardData.getData("text");
    const letters = text.toUpperCase().replace(/[^A-Z]/g, "");
    const from = entry.cells.findIndex((c) => c.row === cur.row && c.col === cur.col);
    const whole = letters.length === entry.cells.length;
    const t = dispatch({ type: "enter", entryId: entry.id, text, from: whole ? undefined : from, pencil });
    if (t.ok) {
      const end = entry.cells[Math.min((whole ? 0 : from) + letters.length, entry.cells.length - 1)];
      moveTo({ row: end.row, col: end.col, dir: entry.direction });
    }
  };

  const selectCell = (r: number, c: number) => {
    if (pointerWasActive.current && r === cur.row && c === cur.col) moveTo(toggle(state, cur));
    else if (r !== cur.row || c !== cur.col) moveTo(fixCursor(state, { row: r, col: c, dir: cur.dir }));
    pointerWasActive.current = false;
  };

  const chooseEntry = (e: Entry) => moveTo(focusEntry(state, e));

  const submitAnswer = (e: FormEvent) => {
    e.preventDefault();
    const t = dispatch({ type: "enter", entryId: entry.id, text: draft.answer ?? "", pencil });
    if (t.ok) setDraft({ answer: "" });
  };

  const assist = (tier: number) => {
    if (tier === 6) {
      setConfirmGrid(true);
      return;
    }
    dispatch(assistAction(tier, { row: cur.row, col: cur.col, entryId: entry.id }));
  };

  const cellLabel = (r: number, c: number) => {
    const at = entriesAt(state, r, c);
    const parts = (["across", "down"] as const)
      .map((d) => at[d])
      .filter((x): x is Entry => !!x)
      .map((x) => `${entryLabel(x)}, letter ${x.cells.findIndex((y) => y.row === r && y.col === c) + 1} of ${x.cells.length}`);
    const letter = state.fill[r][c];
    const mark = state.checks[key(r, c)];
    const status = [
      letter ? `${letter}${state.pencil[r][c] ? ", pencil" : ""}` : "empty",
      mark && mark.letter === letter ? (mark.ok ? "checked right" : "checked wrong") : "",
      state.revealed[r][c] ? "revealed" : "",
    ].filter(Boolean);
    return `Row ${r + 1}, column ${c + 1}. ${parts.join("; ")}. ${status.join(", ")}.`;
  };

  const nums = new Map(state.entries.map((e) => [key(e.cells[0].row, e.cells[0].col), e.number]));
  const inEntry = new Set(entry.cells.map((c) => key(c.row, c.col)));
  const anyPencil = whiteCells(state).some((c) => state.pencil[c.row][c.col]);
  const filled = whiteCells(state).filter((c) => state.fill[c.row][c.col]).length;
  const total = whiteCells(state).length;
  const across = state.entries.filter((e) => e.direction === "across");
  const down = state.entries.filter((e) => e.direction === "down");
  const idx = state.entries.indexOf(entry);
  const hintLog = [
    ...(state.assists.checks ? [`${state.assists.checks} check${state.assists.checks === 1 ? "" : "s"} used.`] : []),
    ...(state.assists.reveals ? [`${state.assists.reveals} reveal${state.assists.reveals === 1 ? "" : "s"} used.`] : []),
  ];

  const clueList = (title: string, list: Entry[]) => (
    <section className="xw-list-wrap" aria-labelledby={`xw-${title}`}>
      <h3 id={`xw-${title}`}>{title}</h3>
      <ol className="xw-list">
        {list.map((e) => {
          const isActive = e.id === entry.id;
          const isCross = e.id === crossing?.id;
          const full = entryFilled(state, e);
          return (
            <li key={e.id}>
              <button
                type="button"
                ref={(el) => {
                  if (el) listRefs.current.set(e.id, el);
                  else listRefs.current.delete(e.id);
                }}
                className="xw-clue"
                data-active={isActive || undefined}
                data-cross={isCross || undefined}
                aria-current={isActive ? "true" : undefined}
                onClick={() => chooseEntry(e)}
              >
                <span className="xw-marker" aria-hidden="true">
                  {isActive ? "▶" : isCross ? "▷" : ""}
                </span>
                <strong>{e.number}</strong>
                <span className="xw-clue-text">
                  {e.clue} ({e.enumeration})
                </span>
                {full ? <span className="xw-filled">filled</span> : null}
                {isCross ? <span className="sr-only">(crosses the selected square)</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );

  return (
    <GameShell
      game={definition}
      session={session}
      siblings={siblings}
      hintOffers={assistOffers(state, { row: cur.row, col: cur.col, entryId: entry.id })}
      onTakeHint={assist}
      hintLog={hintLog}
      side={
        <>
          <span className="side-kicker">{state.style === "cryptic" ? "Cryptic edition" : "Quick edition"}</span>
          <h2 data-testid="xw-progress" style={{ fontVariantNumeric: "tabular-nums" }}>
            {filled} of {total} squares
          </h2>
          <div className="stat-row">
            <span>Clues</span>
            <span>{state.entries.length}</span>
          </div>
          <div className="stat-row">
            <span>Checks used</span>
            <span data-testid="xw-checks">{state.assists.checks}</span>
          </div>
          <div className="stat-row">
            <span>Reveals used</span>
            <span data-testid="xw-reveals">{state.assists.reveals}</span>
          </div>
          <div className="side-section xw-legend">
            <h3>Square marks</h3>
            <ul>
              <li>
                <span className="xw-key xw-key-active" aria-hidden="true" /> thick frame: selected square
              </li>
              <li>
                <span className="xw-key xw-key-entry" aria-hidden="true" /> shaded: selected answer
              </li>
              <li>
                <em>italic, dotted</em>: pencil letter
              </li>
              <li>✗ with a slash: checked wrong · ✓: checked right</li>
              <li>●: revealed, fixed</li>
            </ul>
          </div>
        </>
      }
    >
      <div className="xw-bar" data-testid="xw-bar">
        <button type="button" className="text-button small" aria-label="Previous clue" onClick={() => idx > 0 && chooseEntry(state.entries[idx - 1])} disabled={idx <= 0}>
          ‹
        </button>
        <p>
          <strong>
            {entryLabel(entry)} ({entry.enumeration})
          </strong>{" "}
          <span data-testid="xw-active-clue">{entry.clue}</span>
          <small className="xw-coord">
            Row {cur.row + 1}, column {cur.col + 1}
          </small>
        </p>
        <button type="button" className="text-button small" aria-label="Next clue" onClick={() => idx < state.entries.length - 1 && chooseEntry(state.entries[idx + 1])} disabled={idx >= state.entries.length - 1}>
          ›
        </button>
      </div>

      <div className="xw-tools" role="group" aria-label="Grid tools">
        <button type="button" className="text-button small" aria-pressed={pencil} onClick={() => setDraft({ pencil: !pencil })}>
          ✎ Pencil {pencil ? "on" : "off"}
        </button>
        {anyPencil ? (
          <button type="button" className="text-button small" onClick={() => dispatch({ type: "ink" })} disabled={done}>
            Ink pencil letters
          </button>
        ) : null}
        <span className="xw-group" role="group" aria-label="Check">
          <span aria-hidden="true">Check:</span>
          <button type="button" className="text-button small" onClick={() => assist(1)} disabled={done} aria-label="Check letter">
            Letter
          </button>
          <button type="button" className="text-button small" onClick={() => assist(2)} disabled={done} aria-label="Check word">
            Word
          </button>
          <button type="button" className="text-button small" onClick={() => assist(3)} disabled={done} aria-label="Check grid">
            Grid
          </button>
        </span>
        <span className="xw-group" role="group" aria-label="Reveal">
          <span aria-hidden="true">Reveal:</span>
          <button type="button" className="text-button small" onClick={() => assist(4)} disabled={done} aria-label="Reveal letter">
            Letter
          </button>
          <button type="button" className="text-button small" onClick={() => assist(5)} disabled={done} aria-label="Reveal word">
            Word
          </button>
          <button type="button" className="text-button small" onClick={() => assist(6)} disabled={done} aria-label="Reveal grid">
            Grid
          </button>
        </span>
        <span className="xw-group" role="group" aria-label="Zoom">
          <button type="button" className="text-button small" aria-label="Zoom out" disabled={zoom === ZOOMS[0]} onClick={() => setDraft({ zoom: ZOOMS[ZOOMS.indexOf(zoom) - 1] })}>
            −
          </button>
          <span aria-live="polite" data-testid="xw-zoom">
            {Math.round(zoom * 100)}%
          </span>
          <button type="button" className="text-button small" aria-label="Zoom in" disabled={zoom === ZOOMS[ZOOMS.length - 1]} onClick={() => setDraft({ zoom: ZOOMS[ZOOMS.indexOf(zoom) + 1] })}>
            +
          </button>
        </span>
      </div>

      <div className="xw-frame" data-testid="xw-frame" tabIndex={-1} aria-label="Crossword grid area; scrolls when zoomed">
        <div
          className="xw-grid"
          role="grid"
          aria-label={`${R} by ${C} crossword grid. Arrow keys move, letters fill, Space switches direction, Tab moves to the next clue.`}
          style={{ "--cols": C, "--zoom": zoom } as CSSProperties}
          data-testid="xw-grid"
        >
          {state.solution.map((row, r) => (
            <div role="row" key={r} className="xw-row">
              {[...row].map((ch, c) => {
                if (ch === "#") return <div key={c} role="gridcell" className="xw-cell xw-block" aria-label={`Row ${r + 1}, column ${c + 1}. Black square.`} />;
                const k = key(r, c);
                const isActive = r === cur.row && c === cur.col;
                const letter = state.fill[r][c];
                const mark = state.checks[k];
                const check = mark && mark.letter === letter ? (mark.ok ? "right" : "wrong") : undefined;
                const num = nums.get(k);
                return (
                  <div
                    key={c}
                    role="gridcell"
                    className="xw-cell"
                    data-active={isActive || undefined}
                    data-entry={inEntry.has(k) || undefined}
                    data-pencil={state.pencil[r][c] || undefined}
                    data-check={check}
                    data-revealed={state.revealed[r][c] || undefined}
                    aria-selected={isActive}
                  >
                    {num ? (
                      <span className="xw-num" aria-hidden="true">
                        {num}
                      </span>
                    ) : null}
                    <input
                      ref={(el) => {
                        if (el) cellRefs.current.set(k, el);
                        else cellRefs.current.delete(k);
                      }}
                      data-cell={k}
                      tabIndex={isActive ? 0 : -1}
                      value={letter}
                      onChange={onChange}
                      onKeyDown={onKey}
                      onPaste={onPaste}
                      onPointerDown={() => {
                        pointerWasActive.current = isActive;
                      }}
                      onClick={() => selectCell(r, c)}
                      onFocus={() => {
                        if (!isActive && !wantFocus.current) moveTo(fixCursor(state, { row: r, col: c, dir: cur.dir }), false);
                      }}
                      aria-label={cellLabel(r, c)}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      inputMode="text"
                      readOnly={done}
                    />
                    {check === "wrong" ? (
                      <span className="xw-flag" aria-hidden="true">
                        ✗
                      </span>
                    ) : check === "right" ? (
                      <span className="xw-flag ok" aria-hidden="true">
                        ✓
                      </span>
                    ) : null}
                    {state.revealed[r][c] ? (
                      <span className="xw-dot" aria-hidden="true">
                        ●
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {!done ? (
        <form className="entry xw-answer" onSubmit={submitAnswer}>
          <label htmlFor="xw-answer-input">
            Answer the selected clue, {entryLabel(entry)} ({entry.enumeration})
          </label>
          <div className="xw-answer-row">
            <input
              id="xw-answer-input"
              value={draft.answer ?? ""}
              onChange={(e) => setDraft({ answer: e.target.value.toUpperCase() })}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="Type or paste a whole answer"
              aria-describedby="game-feedback"
            />
            <button type="submit" className="btn">
              Enter answer
            </button>
          </div>
        </form>
      ) : null}

      <div className="xw-clues">
        {clueList("Across", across)}
        {clueList("Down", down)}
      </div>

      <ConfirmDialog
        open={confirmGrid}
        onClose={() => setConfirmGrid(false)}
        title="Reveal the whole grid?"
        body="Every square is filled with the answer and the puzzle ends with a revealed result."
        confirmLabel="Reveal the grid"
        onConfirm={() => dispatch({ type: "reveal", scope: "grid" })}
      />
    </GameShell>
  );
}
