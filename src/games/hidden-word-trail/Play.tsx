"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { PlayProps } from "../play-types";
import type { RoundBundle } from "../types";
import { definition } from "./definition";
import {
  cellLabel,
  createHiddenWordTrailEngine,
  HINT_HALF,
  remainingWords,
  solvedCells,
  tokensAvailable,
  tokensEarned,
  type TrailAction,
  type TrailPayload,
  type TrailState,
} from "./engine";
import { adjacent, toCell } from "./solver";
import { useGameSession } from "@/hooks/useGameSession";
import { GameShell } from "@/components/game/GameShell";
import { WordListGate } from "@/components/game/WordListGate";
import { plural } from "@/lib/text";
import "./trail.css";

export default function Play({ bundle, siblings }: PlayProps) {
  if (!bundle) return null;
  return <WordListGate>{(words) => <TrailGame bundle={bundle as RoundBundle<TrailPayload>} words={words} siblings={siblings ?? []} />}</WordListGate>;
}

function TrailGame({ bundle, words, siblings }: { bundle: RoundBundle<TrailPayload>; words: ReadonlySet<string>; siblings: NonNullable<PlayProps["siblings"]> }) {
  const engine = useMemo(() => createHiddenWordTrailEngine(words), [words]);
  const session = useGameSession<TrailPayload, TrailState, TrailAction, number[]>({
    engine,
    round: bundle.payload,
    meta: bundle.meta,
    title: bundle.meta.title ?? "Hidden Word Trail",
  });
  const { state, dispatch } = session;
  const solved = useMemo(() => solvedCells(state), [state]);
  const rawDraft = session.draft;
  const path = useMemo(() => (Array.isArray(rawDraft) ? rawDraft.filter((i) => typeof i === "number" && !solved.has(i)) : []), [rawDraft, solved]);
  const setPath = (p: number[]) => session.setDraft(p.length ? p : undefined);
  const [focus, setFocus] = useState(0);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const drag = useRef<{ active: boolean; start: number; moved: boolean }>({ active: false, start: -1, moved: false });
  const suppressClick = useRef(false);
  const finished = session.outcome !== "playing";

  // Drop any draft squares that a reveal has since filled.
  useEffect(() => {
    if (Array.isArray(rawDraft) && rawDraft.length !== path.length) session.setDraft(path.length ? path : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path.length, rawDraft]);

  const word = path.map((i) => state.letters[i]).join("");
  const foundIndex = useMemo(() => {
    const m = new Map<number, number>();
    state.found.forEach((f, k) => f.path.forEach((i) => m.set(i, k)));
    return m;
  }, [state.found]);
  const hintFocus = state.hintFocus && !state.found.some((f) => f.word === state.hintFocus!.word) ? state.hintFocus : null;
  const hinted = new Map<number, number>();
  if (hintFocus && state.hintLevel >= 1) {
    const n = state.hintLevel >= 2 ? Math.ceil(hintFocus.path.length / 2) : 1;
    hintFocus.path.slice(0, n).forEach((i, k) => hinted.set(i, k + 1));
  }

  /** Tap/Space on a square: extend, step back or explain why not. */
  const touch = (i: number) => {
    if (finished) return;
    if (solved.has(i)) {
      session.announce(`${cellLabel(state, i)} already belongs to ${state.found[foundIndex.get(i)!].word}.`);
      return;
    }
    if (!path.length) return setPath([i]);
    const last = path[path.length - 1];
    if (i === last || (path.length >= 2 && i === path[path.length - 2])) return setPath(path.slice(0, -1));
    if (path.includes(i)) {
      session.announce(`${cellLabel(state, i)} is already in your trail. Tap the last square to step back, or Clear to start again.`);
      return;
    }
    if (!adjacent(state, last, i)) {
      session.announce(`${cellLabel(state, i)} does not touch ${cellLabel(state, last)}. Choose a neighbouring square, or Clear to start a new trail.`);
      return;
    }
    setPath([...path, i]);
  };

  const submit = () => {
    if (!path.length) {
      session.announce("Choose some squares first.");
      return;
    }
    const t = dispatch({ type: "submit", path });
    if (t.ok) setPath([]);
  };

  const moveFocus = (i: number) => {
    setFocus(i);
    cellRefs.current[i]?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const [r, c] = toCell(state, i);
    const go = (dr: number, dc: number) => {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < state.rows && cc >= 0 && cc < state.cols) moveFocus(rr * state.cols + cc);
    };
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        return go(-1, 0);
      case "ArrowDown":
        e.preventDefault();
        return go(1, 0);
      case "ArrowLeft":
        e.preventDefault();
        return go(0, -1);
      case "ArrowRight":
        e.preventDefault();
        return go(0, 1);
      case "Home":
        e.preventDefault();
        return moveFocus(r * state.cols);
      case "End":
        e.preventDefault();
        return moveFocus(r * state.cols + state.cols - 1);
      case " ":
      case "Spacebar":
        e.preventDefault();
        return touch(i);
      case "Enter":
        e.preventDefault();
        return submit();
      case "Backspace":
      case "Delete":
        e.preventDefault();
        return setPath(path.slice(0, -1));
      case "Escape":
        if (path.length) {
          e.preventDefault();
          setPath([]);
          session.announce("Trail cleared.", true, "cleared");
        }
        return;
    }
  };

  // Optional drag: pressing a square and moving across neighbours extends the trail.
  const cellAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-cell]");
    return el ? Number(el.dataset.cell) : null;
  };
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, i: number) => {
    if (finished || e.button > 0) return;
    drag.current = { active: true, start: i, moved: false };
  };
  const pathRef = useRef(path);
  useEffect(() => {
    pathRef.current = path;
  }, [path]);
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.active) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i == null || solved.has(i)) return;
    let p = pathRef.current;
    if (!d.moved) {
      if (i === d.start) return;
      d.moved = true;
      suppressClick.current = true;
      const last = p[p.length - 1];
      if (!p.length || (last !== d.start && !(adjacent(state, last, d.start) && !p.includes(d.start)))) p = [d.start];
      else if (last !== d.start) p = [...p, d.start];
    }
    const last = p[p.length - 1];
    if (i === last) {
      if (p !== pathRef.current) setPath(p);
      return;
    }
    if (p.length >= 2 && i === p[p.length - 2]) p = p.slice(0, -1);
    else if (!p.includes(i) && adjacent(state, last, i)) p = [...p, i];
    if (p !== pathRef.current) {
      pathRef.current = p;
      setPath(p);
    }
  };
  const endDrag = () => {
    drag.current.active = false;
    if (suppressClick.current) setTimeout(() => (suppressClick.current = false), 0);
  };

  const hintLog = state.hints.map((h) => `${h.text}${h.earned ? " (paid with bonus credits)" : ""}`);
  const remaining = remainingWords(state).length;
  const tokens = tokensAvailable(state);
  const centre = (i: number) => {
    const [r, c] = toCell(state, i);
    return { x: ((c + 0.5) / state.cols) * 100, y: ((r + 0.5) / state.rows) * 100 };
  };
  const line = (p: number[]) => p.map((i) => `${centre(i).x},${centre(i).y}`).join(" ");

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
          <span className="side-kicker">Your progress</span>
          <h2 data-testid="trail-progress">
            {state.found.length} of {state.answers.length} theme words
          </h2>
          <div className="stat-row">
            <span>Squares covered</span>
            <span data-testid="cells-covered">
              {solved.size} of {state.letters.length}
            </span>
          </div>
          {state.bonusPolicy === "membership" ? (
            <>
              <div className="stat-row">
                <span>Bonus words</span>
                <span data-testid="bonus-count">{state.bonus.length}</span>
              </div>
              <div className="stat-row">
                <span>Free hints earned</span>
                <span data-testid="tokens">
                  {tokensEarned(state)} ({tokens} unused)
                </span>
              </div>
              {state.bonus.length ? <p className="hwt-bonus-list">{state.bonus.join(", ")}</p> : null}
            </>
          ) : (
            <p style={{ fontSize: ".85rem" }}>This demo round has no bonus words.</p>
          )}
          <div className="stat-row">
            <span>Hints used</span>
            <span>{state.hints.length}</span>
          </div>
        </>
      }
    >
      <p className="eyebrow hwt-theme" data-testid="theme">
        Theme: {state.theme}
      </p>
      <p className="hwt-trail-text" data-testid="trail-text">
        {path.length ? (
          <>
            <strong>{word}</strong>
            <span className="hwt-trail-cells"> · {path.map((i) => cellLabel(state, i)).join(" → ")}</span>
          </>
        ) : (
          <span className="hwt-muted">{finished ? "Every square is covered." : "Tap, drag or use the arrow keys and Space to trace a trail."}</span>
        )}
      </p>
      <div className="hwt-scroll">
      <div className="hwt-board" style={{ aspectRatio: `${state.cols} / ${state.rows}`, maxWidth: `${state.cols * 78}px`, minWidth: `${state.cols * 44 + (state.cols - 1) * 5}px` }}>
        <svg className="hwt-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {state.found.map((f, k) => (
            <polyline key={k} points={line(f.path)} className={f.assisted ? "found assisted" : "found"} />
          ))}
          {path.length > 1 ? <polyline points={line(path)} className="current" /> : null}
        </svg>
        <div
          className="hwt-grid"
          role="group"
          aria-label={`Letter grid, ${state.rows} rows by ${state.cols} columns. Arrow keys move, Space adds a square, Backspace removes the last, Escape clears, Enter submits.`}
          style={{ gridTemplateColumns: `repeat(${state.cols}, 1fr)` }}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={endDrag}
        >
          {state.letters.map((l, i) => {
            const step = path.indexOf(i);
            const fk = foundIndex.get(i);
            const f = fk != null ? state.found[fk] : null;
            const [r, c] = toCell(state, i);
            const hintStep = hinted.get(i);
            const label = [
              `${l}, row ${r + 1}, column ${c + 1}`,
              step >= 0 ? `step ${step + 1} of your trail` : "",
              f ? `in found word ${f.word}${f.assisted ? " (revealed)" : ""}` : "",
              hintStep ? `hint: letter ${hintStep} of a theme word` : "",
            ]
              .filter(Boolean)
              .join(", ");
            return (
              <button
                key={i}
                ref={(el) => {
                  cellRefs.current[i] = el;
                }}
                type="button"
                data-cell={i}
                data-testid={`cell-${r}-${c}`}
                className={`hwt-cell${step >= 0 ? " selected" : ""}${f ? " found" : ""}${f?.assisted ? " assisted" : ""}${hintStep ? " hinted" : ""}`}
                tabIndex={i === focus ? 0 : -1}
                aria-label={label}
                aria-pressed={step >= 0}
                onFocus={() => setFocus(i)}
                onKeyDown={(e) => onKey(e, i)}
                onPointerDown={(e) => onPointerDown(e, i)}
                onClick={() => {
                  if (suppressClick.current) return;
                  touch(i);
                }}
              >
                <span className="hwt-letter">{l}</span>
                {step >= 0 ? <span className="hwt-step" aria-hidden="true">{step + 1}</span> : null}
                {f ? <span className="hwt-mark" aria-hidden="true">{f.assisted ? "?" : "✓"}</span> : null}
                {hintStep && step < 0 ? <span className="hwt-hint" aria-hidden="true">{hintStep === 1 ? "start" : hintStep}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
      </div>
      <div className="hwt-actions">
        <button type="button" className="btn" onClick={submit} disabled={finished || !path.length}>
          Submit trail
        </button>
        <button type="button" className="text-button" onClick={() => setPath(path.slice(0, -1))} disabled={!path.length}>
          Remove last
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setPath([]);
            session.announce("Trail cleared.", true, "cleared");
          }}
          disabled={!path.length}
        >
          Clear
        </button>
      </div>
      {tokens > 0 && !finished ? (
        <p className="hwt-token-note" data-testid="token-note">
          You have {plural(tokens, "free hint")} from bonus words. Your next {tokens === 1 ? "hint" : "hints"} will not count as help.
        </p>
      ) : null}

      <section aria-labelledby="hwt-found-h" style={{ marginTop: 16 }}>
        <h2 id="hwt-found-h" style={{ fontSize: "1rem", margin: "0 0 6px" }}>
          Theme words found ({state.found.length} of {state.answers.length})
        </h2>
        {state.found.length ? (
          <ol className="hwt-found" data-testid="found-list">
            {state.found.map((f) => {
              const a = state.answers.find((x) => x.word === f.word);
              return (
                <li key={f.word} className={f.assisted ? "assisted" : ""}>
                  {f.word}
                  {a?.themeDefining ? <small> · names the theme</small> : null}
                  {f.assisted ? <small> · revealed</small> : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="hwt-muted">None yet. {remaining} theme words cover all {state.letters.length} squares.</p>
        )}
        {hintFocus && state.hintLevel >= 1 ? (
          <p className="hwt-muted" data-testid="hint-focus">
            Hint in play: a {hintFocus.word.length}-letter word starting at {cellLabel(state, hintFocus.path[0])}.
            {state.hintLevel >= HINT_HALF ? " The first half of its trail is marked." : ""}
          </p>
        ) : null}
      </section>
    </GameShell>
  );
}
