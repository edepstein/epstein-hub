"use client";

import { Fragment, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { PlayProps } from "../play-types";
import type { RoundBundle } from "../types";
import { definition } from "./definition";
import { createWordLadderEngine, current, isComplete, moves, type LadderAction, type LadderPayload, type LadderState } from "./engine";
import familiarList from "./content/familiar.json";
import { useGameSession } from "@/hooks/useGameSession";
import { GameShell } from "@/components/game/GameShell";
import { WordListGate } from "@/components/game/WordListGate";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { plural } from "@/lib/text";
import "./ladder.css";

const FAMILIAR: ReadonlySet<string> = new Set(familiarList);
const ordinal = (n: number) => ["first", "second", "third", "fourth", "fifth"][n] ?? `${n + 1}th`;

export default function Play({ bundle, siblings }: PlayProps) {
  if (!bundle) return null;
  return <WordListGate>{(words) => <LadderGame bundle={bundle as RoundBundle<LadderPayload>} words={words} siblings={siblings ?? []} />}</WordListGate>;
}

function Rung({ word, prev, hintPos, label }: { word: string; prev?: string; hintPos?: number | null; label: string }) {
  const changed = prev ? [...word].findIndex((c, i) => c !== prev[i]) : -1;
  const extra = [changed >= 0 ? `${ordinal(changed)} letter changed` : null, hintPos != null ? `hint: change the ${ordinal(hintPos)} letter` : null].filter(Boolean).join(", ");
  return (
    <span className="rung" role="img" aria-label={`${label}: ${word}${extra ? `, ${extra}` : ""}`}>
      {[...word].map((c, i) => (
        <span key={i} className={`tile ${i === changed ? "changed" : ""} ${i === hintPos ? "hinted" : ""}`} aria-hidden="true">
          {c}
        </span>
      ))}
    </span>
  );
}

function LadderGame({ bundle, words, siblings }: { bundle: RoundBundle<LadderPayload>; words: ReadonlySet<string>; siblings: NonNullable<PlayProps["siblings"]> }) {
  const engine = useMemo(() => createWordLadderEngine(words, FAMILIAR), [words]);
  const session = useGameSession<LadderPayload, LadderState, LadderAction, string>({
    engine,
    round: bundle.payload,
    meta: bundle.meta,
    title: bundle.meta.title ?? "Word Ladder",
  });
  const { state, dispatch } = session;
  const draft = session.draft ?? "";
  const inputRef = useRef<HTMLInputElement>(null);
  const [backTo, setBackTo] = useState<number | null>(null);

  const done = isComplete(state);
  const closed = done || state.revealed;
  const cur = current(state);
  const at = state.path.length - 1;
  const posHint = state.hints.find((h) => h.from === cur && h.atStep === at && h.tier <= 2 && h.position != null && !closed);
  const hintPos = posHint ? posHint.position : null;
  const setDraft = (d: string) => session.setDraft(d.toUpperCase());
  const onRoute = new Set(state.path.map((p) => p.word));
  const hintCount = state.hints.filter((h) => h.tier <= 3).length;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const t = dispatch({ type: "submit", word: draft });
    if (t.ok) setDraft("");
    inputRef.current?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setDraft("");
    }
  };

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
          <span className="side-kicker">Your route</span>
          <h2 data-testid="moves" style={{ fontVariantNumeric: "tabular-nums" }}>
            {moves(state)} {moves(state) === 1 ? "move" : "moves"}
          </h2>
          <div className="stat-row">
            <span>Shortest possible</span>
            <span data-testid="optimum">{state.optimalMoves}</span>
          </div>
          <div className="stat-row">
            <span>Word length</span>
            <span>{state.length} letters</span>
          </div>
          <div className="stat-row">
            <span>Steps tried</span>
            <span>{state.movesTried}</span>
          </div>
          <div className="stat-row">
            <span>Steps taken back</span>
            <span>{state.undos}</span>
          </div>
          <div className="stat-row">
            <span>Hints</span>
            <span data-testid="hint-count">{hintCount}</span>
          </div>
        </>
      }
    >
      <div className="ladder wl-ladder" data-testid="ladder">
        <span className="ladder-label">{state.path.length === 1 ? "Starting word" : "Your route so far"}</span>
        <ol className="wl-route" aria-label="Your route">
          {state.path.map((p, i) => {
            const isCur = i === state.path.length - 1;
            return (
              <Fragment key={`${i}-${p.word}`}>
                {i > 0 ? (
                  <li className="step-arrow" aria-hidden="true">
                    ↓ one letter changed{p.assisted ? " · hint" : ""}
                  </li>
                ) : null}
                <li className={`wl-step ${isCur ? "current" : ""} ${p.assisted ? "assisted" : ""}`} data-testid={`step-${i}`} data-word={p.word}>
                  <Rung
                    word={p.word}
                    prev={i > 0 ? state.path[i - 1].word : undefined}
                    hintPos={isCur ? hintPos : null}
                    label={i === 0 ? "Start" : `Step ${i}${p.assisted ? " (hinted)" : ""}${isCur ? ", current word" : ""}`}
                  />
                  {!closed && !isCur ? (
                    <button type="button" className="text-button small wl-back-here" onClick={() => setBackTo(i)} aria-label={`Go back to ${p.word}`}>
                      Back to here
                    </button>
                  ) : null}
                </li>
              </Fragment>
            );
          })}
        </ol>
        {!done ? (
          <>
            <div className="ladder-gap">
              {state.revealed ? "Route revealed" : `Next: change one letter in ${cur}`}
              <br />
              <span aria-hidden="true">⋮</span>
            </div>
            <div className="ladder-target" data-testid="target">
              <span className="ladder-label">Destination · reach in several steps</span>
              <Rung word={state.target} label="Destination" />
            </div>
          </>
        ) : (
          <p className="wl-reached" data-testid="reached">
            Destination reached: {state.target}
          </p>
        )}
      </div>

      {!closed ? (
        <>
          <form className="entry wl-entry" onSubmit={submit}>
            <label htmlFor="wl-input" className="sr-only">
              Next word
            </label>
            <input
              id="wl-input"
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder={`Next ${state.length}-letter word`}
              aria-describedby="game-feedback"
            />
            <button className="btn" type="submit">
              Submit
            </button>
          </form>
          <div className="wl-actions">
            <button
              type="button"
              className="btn secondary small"
              onClick={() => {
                dispatch({ type: "undo" });
                inputRef.current?.focus();
              }}
              disabled={state.path.length < 2}
            >
              Back one step
            </button>
            <button type="button" className="text-button small" onClick={() => setDraft("")} disabled={!draft}>
              Clear
            </button>
            {hintPos != null ? <span className="wl-hint-note">Hint: change the {ordinal(hintPos)} letter of {cur}.</span> : null}
          </div>
          {state.bank.length ? (
            <details className="wl-bank" data-testid="word-bank">
              <summary>Show word bank ({state.bank.length} words)</summary>
              <p>Some useful words for this ladder. Tap one to put it in the box. Words already on your route are crossed out.</p>
              <ul>
                {state.bank.map((w) => (
                  <li key={w}>
                    <button type="button" className={`wl-bank-word ${onRoute.has(w) ? "used" : ""}`} onClick={() => setDraft(w)} aria-label={`${w}${onRoute.has(w) ? ", already on your route" : ""}`}>
                      {w}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={backTo != null}
        onClose={() => setBackTo(null)}
        title="Go back to an earlier word?"
        body={backTo != null ? `Your route returns to ${state.path[backTo]?.word ?? ""} and ${plural(state.path.length - 1 - backTo, "later step")} will be removed. Steps you took back never count against your score.` : ""}
        confirmLabel="Go back"
        onConfirm={() => {
          if (backTo != null) dispatch({ type: "backtrack", to: backTo });
        }}
      />
    </GameShell>
  );
}
