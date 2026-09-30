"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { PlayProps } from "../play-types";
import type { RoundBundle } from "../types";
import { definition } from "./definition";
import { createStaircaseEngine, describeStep, isFinished, scoreOf, type StairAction, type StairPayload, type StairState } from "./engine";
import { useGameSession } from "@/hooks/useGameSession";
import { GameShell } from "@/components/game/GameShell";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { plural } from "@/lib/text";
import "./staircase.css";

const engine = createStaircaseEngine();

export default function Play({ bundle, siblings }: PlayProps) {
  if (!bundle) return null;
  return <StaircaseGame bundle={bundle as RoundBundle<StairPayload>} siblings={siblings ?? []} />;
}

/** Which tiles of `word` a draft consumes (each tile at most once). */
function tilesUsed(word: string, draft: string): boolean[] {
  const used = [...word].map(() => false);
  for (const ch of draft) {
    const i = [...word].findIndex((l, idx) => l === ch && !used[idx]);
    if (i >= 0) used[i] = true;
  }
  return used;
}

function StaircaseGame({ bundle, siblings }: { bundle: RoundBundle<StairPayload>; siblings: NonNullable<PlayProps["siblings"]> }) {
  const session = useGameSession<StairPayload, StairState, StairAction, string>({ engine, round: bundle.payload, meta: bundle.meta, title: bundle.meta.title ?? "Shrinking Staircase" });
  const { state, dispatch } = session;
  const draft = session.draft ?? "";
  const setDraft = (d: string) => session.setDraft(d.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 12));
  const [showTiles, setShowTiles] = useState(false);
  const [reviseRung, setReviseRung] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const finished = isFinished(state);
  const current = state.answers.length;
  const prev = current === 0 ? state.start : state.answers[current - 1];
  const tilesVisible = state.lettersAid || showTiles;
  const used = tilesUsed(prev, draft);
  const lastIndex = useRef<number | null>(null);

  useEffect(() => {
    if (!session.ready) return;
    if (lastIndex.current !== null && lastIndex.current !== current && !finished) inputRef.current?.focus();
    lastIndex.current = current;
  }, [current, finished, session.ready]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const t = dispatch({ type: "submit", word: draft });
    if (t.ok) setDraft("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setDraft("");
    }
  };

  const tap = (i: number) => {
    if (used[i]) return;
    setDraft(draft + prev[i]);
    inputRef.current?.focus();
  };

  const confirmRevise = (rung: number) => {
    const old = state.answers[rung];
    const t = dispatch({ type: "revise", rung });
    if (t.ok) setDraft(old);
  };

  const preview = draft ? engine.preview(state, draft) : null;
  const n = state.rungs.length;
  const solvedCount = state.revealed.filter((r) => !r).length;
  const chain = [state.start, ...state.answers];
  const later = reviseRung === null ? 0 : state.answers.length - reviseRung - 1;

  return (
    <GameShell
      game={definition}
      session={session}
      siblings={siblings}
      hintOffers={engine.hints(state)}
      onTakeHint={(tier) => dispatch({ type: "hint", tier })}
      hintLog={state.hints.map((h) => h.text)}
      side={
        <>
          <span className="side-kicker">Your climb down</span>
          <h2 style={{ fontVariantNumeric: "tabular-nums" }} data-testid="score">
            {scoreOf(state)} of 100 points
          </h2>
          <p style={{ margin: "0 0 6px" }} data-testid="rung-progress">
            {finished ? `All ${n} rungs done` : `Rung ${current + 1} of ${n}`}
          </p>
          <div className="stat-row">
            <span>Solved by you</span>
            <span>{solvedCount}</span>
          </div>
          <div className="stat-row">
            <span>Hints taken</span>
            <span>{state.hints.length}</span>
          </div>
          <div className="stat-row">
            <span>Revisions</span>
            <span>{state.revisions}</span>
          </div>
        </>
      }
    >
      <ol className="ss-stairs" aria-label="Staircase, from the starting word down">
        <li className="ss-step solved" style={{ width: "100%" }}>
          <span className="ss-label">Start</span>
          <span className="ss-word" aria-label={`Starting word ${state.start}`}>
            {state.start}
          </span>
        </li>
        {state.rungs.map((rung, i) => {
          const width = `${Math.max(46, 100 - ((i + 1) * 54) / n)}%`;
          const indent = `${((i + 1) * 27) / n}%`;
          const answered = i < state.answers.length;
          const isCurrent = i === current && !finished;
          if (answered) {
            const d = describeStep(chain[i], state.answers[i]);
            return (
              <li key={i} className="ss-step solved" style={{ width, marginLeft: indent }} data-testid={`rung-${i + 1}`}>
                <span className="ss-label">Rung {i + 1}</span>
                <span className="ss-word">{state.answers[i]}</span>
                <span className="ss-badge" title={`Removed ${d.removed}`}>
                  <span aria-hidden="true">−{d.removed}</span>
                  <span className="sr-only">removed {d.removed}</span>
                </span>
                {state.revealed[i] ? <span className="ss-tag">filled by hint</span> : null}
                {!finished ? (
                  <button type="button" className="text-button small" onClick={() => setReviseRung(i)} aria-label={`Revise rung ${i + 1}, ${state.answers[i]}`}>
                    Revise
                  </button>
                ) : null}
                <span className="ss-clue-small">{rung.clue}</span>
              </li>
            );
          }
          if (isCurrent) {
            return (
              <li key={i} className="ss-step current" style={{ width, marginLeft: indent }} data-testid={`rung-${i + 1}`} aria-current="step">
                <span className="ss-label">Rung {i + 1} · your turn</span>
                <p className="ss-clue" id="ss-clue">
                  {rung.clue} <span className="ss-enum">({rung.length})</span>
                </p>
                <p className="ss-from">
                  Remove one letter from <strong>{prev}</strong> and rearrange the other {plural(rung.length, "letter")}.
                </p>
                {tilesVisible ? (
                  <div className="ss-tiles" role="group" aria-label={`Letters of ${prev}. Tap to add to your answer.`}>
                    {[...prev].map((l, k) => (
                      <button
                        key={k}
                        type="button"
                        className="ss-tile"
                        aria-disabled={used[k]}
                        aria-label={`${l}${used[k] ? ", already used" : ""}`}
                        onClick={() => tap(k)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                ) : null}
                <form className="ss-entry" onSubmit={submit}>
                  <label htmlFor="ss-input" className="sr-only">
                    Answer for rung {i + 1}
                  </label>
                  <input
                    id="ss-input"
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKey}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder={"_ ".repeat(rung.length).trim()}
                    aria-describedby="ss-clue game-feedback"
                    maxLength={12}
                  />
                  <button className="btn" type="submit">
                    Submit
                  </button>
                </form>
                <div className="ss-actions">
                  <button type="button" className="text-button" onClick={() => setDraft(draft.slice(0, -1))} disabled={!draft}>
                    Delete letter
                  </button>
                  <button type="button" className="text-button" onClick={() => setDraft("")} disabled={!draft}>
                    Clear
                  </button>
                  {!state.lettersAid ? (
                    <button type="button" className="text-button" aria-pressed={showTiles} onClick={() => setShowTiles((v) => !v)}>
                      {showTiles ? "Hide letter tiles" : "Show letter tiles"}
                    </button>
                  ) : null}
                </div>
                {preview ? (
                  <p className="ss-preview" data-testid="draft-preview" data-legal={preview.legal}>
                    {preview.legal ? `${preview.message} Submit to check it against the clue.` : preview.message}
                  </p>
                ) : null}
              </li>
            );
          }
          return (
            <li key={i} className="ss-step locked" style={{ width, marginLeft: indent }} data-testid={`rung-${i + 1}`}>
              <span className="ss-label">Rung {i + 1}</span>
              <span className="ss-blanks" aria-hidden="true">
                {"_ ".repeat(rung.length).trim()}
              </span>
              <span className="ss-clue-small">
                {rung.clue} ({rung.length}) · {finished ? "not reached" : "opens when the rung above is solved"}
              </span>
            </li>
          );
        })}
      </ol>

      <ConfirmDialog
        open={reviseRung !== null}
        onClose={() => setReviseRung(null)}
        title={reviseRung === null ? "Revise" : `Revise rung ${reviseRung + 1}?`}
        body={
          reviseRung === null
            ? null
            : later > 0
              ? `Your answer ${state.answers[reviseRung]} will be reopened for editing, and ${plural(later, "answer")} below it will be cleared because ${later === 1 ? "it depends" : "they depend"} on it. Hints you took stay on your record.`
              : `Your answer ${state.answers[reviseRung]} will be reopened for editing. Hints you took stay on your record.`
        }
        confirmLabel="Reopen this rung"
        onConfirm={() => reviseRung !== null && confirmRevise(reviseRung)}
      />
    </GameShell>
  );
}
