"use client";

import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { PlayProps } from "../play-types";
import type { RoundBundle } from "../types";
import { definition } from "./definition";
import {
  createWordDeductionEngine,
  describeRow,
  EXTENSION_ROWS,
  HINT_PLACE,
  isExhausted,
  isWon,
  keyboardSummary,
  MARK_SYMBOL,
  MARK_TEXT,
  rowsAllowed,
  WORD_LENGTH,
  type DeductionAction,
  type DeductionPayload,
  type DeductionState,
} from "./engine";
import { useGameSession } from "@/hooks/useGameSession";
import { GameShell } from "@/components/game/GameShell";
import { WordListGate } from "@/components/game/WordListGate";
import { ConfirmDialog } from "@/components/ui/Dialog";
import "./deduction.css";

const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

export default function Play({ bundle, siblings }: PlayProps) {
  if (!bundle) return null;
  return <WordListGate>{(words) => <DeductionGame bundle={bundle as RoundBundle<DeductionPayload>} words={words} siblings={siblings ?? []} />}</WordListGate>;
}

function DeductionGame({ bundle, words, siblings }: { bundle: RoundBundle<DeductionPayload>; words: ReadonlySet<string>; siblings: NonNullable<PlayProps["siblings"]> }) {
  const engine = useMemo(() => createWordDeductionEngine(words), [words]);
  const session = useGameSession<DeductionPayload, DeductionState, DeductionAction, string>({
    engine,
    round: bundle.payload,
    meta: bundle.meta,
    title: bundle.meta.title ?? "Word Deduction",
  });
  const { state, dispatch } = session;
  const draft = session.draft ?? "";
  const inputRef = useRef<HTMLInputElement>(null);
  const [relaxOpen, setRelaxOpen] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);

  const won = isWon(state);
  const exhausted = isExhausted(state);
  const closed = won || state.revealed || exhausted;
  const total = rowsAllowed(state);
  const keys = keyboardSummary(state.rows);
  const setDraft = (d: string) => session.setDraft(d.toUpperCase());

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const t = dispatch({ type: "guess", word: draft });
    if (t.ok) setDraft("");
    inputRef.current?.focus();
  };

  const press = (letter: string) => {
    const letters = draft.replace(/[^A-Za-z]/g, "");
    if (letters.length >= WORD_LENGTH) {
      session.announce("Five letters already. Submit, or delete a letter first.");
      return;
    }
    setDraft(draft + letter);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setDraft("");
    }
  };

  const hardOn = state.hardMode && !state.hardRelaxed;
  const draftLetters = draft.trim().toUpperCase().slice(0, WORD_LENGTH).split("");
  const hintLog = state.hints.map((h) => h.text);
  const hintsUsed = state.hints.length + state.extensions + (state.hardRelaxed ? 1 : 0);

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
          <h2 data-testid="guesses-used" style={{ fontVariantNumeric: "tabular-nums" }}>
            {state.rows.length} of {state.guessLimit} guesses
          </h2>
          {state.extensions ? <p style={{ margin: "0 0 6px" }}>Plus {state.extensions * EXTENSION_ROWS} extra rows (assisted)</p> : null}
          <div className="stat-row">
            <span>Hard mode</span>
            <span data-testid="hard-mode">{state.hardMode ? (state.hardRelaxed ? "Switched off" : "On") : "Off"}</span>
          </div>
          <div className="stat-row">
            <span>Hints and help</span>
            <span>{hintsUsed}</span>
          </div>
          <div className="stat-row">
            <span>Letters ruled out</span>
            <span>{Object.values(keys).filter((m) => m === "absent").length}</span>
          </div>
          {hintLog.length ? (
            <div className="side-section">
              <h3>Hints taken</h3>
              <ul style={{ margin: 0, paddingLeft: "1.1em", fontSize: ".88rem" }} data-testid="hint-log">
                {hintLog.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {hardOn && !closed ? (
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn secondary small" onClick={() => setRelaxOpen(true)}>
                Switch hard mode off
              </button>
            </div>
          ) : null}
        </>
      }
    >
      {hardOn ? (
        <p className="wd-mode" data-testid="hard-mode-note">
          Hard mode: keep ✓ letters in place, use every ↔ letter, and do not return a ↔ letter to the same place.
        </p>
      ) : null}

      <ol className="deduction wd-board" data-testid="guess-board" aria-label={`Guesses: ${state.rows.length} of ${total} used`}>
        {Array.from({ length: Math.max(total, state.rows.length) }, (_, r) => {
          const row = state.rows[r];
          if (row) {
            return (
              <li key={r} className="wd-row" data-testid={`guess-row-${r}`} data-marks={row.marks.join(",")} data-extension={row.extension || undefined}>
                <span className="sr-only">
                  Guess {r + 1}{row.extension ? " (extra row)" : ""}: {row.guess}. {describeRow(row)}.
                </span>
                {row.guess.split("").map((ch, i) => (
                  <span key={i} className={`tile ${row.marks[i]}`} aria-hidden="true">
                    {ch}
                    <span className="feedback-mark">{MARK_SYMBOL[row.marks[i]]}</span>
                  </span>
                ))}
              </li>
            );
          }
          const current = r === state.rows.length && !closed;
          return (
            <li key={r} className={`wd-row ${current ? "current" : ""} ${r >= state.guessLimit ? "extra" : ""}`} aria-hidden={current ? undefined : true}>
              {current ? <span className="sr-only">Guess {r + 1}, being typed: {draftLetters.join("") || "empty"}.</span> : null}
              {Array.from({ length: WORD_LENGTH }, (_, i) => (
                <span key={i} className={`tile ${current && draftLetters[i] ? "typed" : ""}`} aria-hidden="true">
                  {current ? draftLetters[i] ?? "" : ""}
                </span>
              ))}
            </li>
          );
        })}
      </ol>
      <div className="legend" aria-hidden="true">
        <span>✓ Correct place</span>
        <span>↔ Elsewhere</span>
        <span>× Absent</span>
      </div>

      {state.mode === "gentle" && !closed && state.rows.length === 0 && state.hints.length === 0 ? (
        <p className="wd-offer">
          Want a start?{" "}
          <button type="button" className="text-button small" onClick={() => dispatch({ type: "hint", tier: HINT_PLACE })}>
            Show the first letter
          </button>{" "}
          <small>(recorded as a hint)</small>
        </p>
      ) : null}

      {exhausted ? (
        <div className="wd-out" data-testid="out-of-guesses">
          <p style={{ margin: "0 0 10px" }}>
            {state.extensions ? "Those extra rows are used up." : `All ${state.guessLimit} guesses used.`} The round is recorded as not solved.
          </p>
          <div className="wd-out-actions">
            <button type="button" className="btn" onClick={() => setRevealOpen(true)}>
              Reveal the answer
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                dispatch({ type: "extend" });
                inputRef.current?.focus();
              }}
            >
              Keep guessing ({EXTENSION_ROWS} extra rows, assisted)
            </button>
          </div>
        </div>
      ) : null}

      {state.revealed || won ? (
        <div className="wd-answer" data-testid="answer-card">
          <strong>{state.answer}</strong>
          <span>{state.definition}</span>
        </div>
      ) : null}

      {!closed ? (
        <>
          <form className="entry wd-entry" onSubmit={submit}>
            <label htmlFor="wd-input" className="sr-only">
              Your guess
            </label>
            <input
              id="wd-input"
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Five-letter guess"
              aria-describedby="game-feedback"
            />
            <button className="btn" type="submit">
              Submit
            </button>
            <button type="button" className="btn secondary" onClick={() => setDraft("")} disabled={!draft}>
              Clear
            </button>
          </form>

          <div className="wd-keyboard" role="group" aria-label="On-screen keyboard">
            {KEY_ROWS.map((row, ri) => (
              <div className="wd-keyrow" key={row}>
                {ri === 2 ? (
                  <button type="button" className="wd-key wide" onClick={() => submit()}>
                    Enter
                  </button>
                ) : null}
                {row.split("").map((k) => {
                  const m = keys[k];
                  return (
                    <button
                      key={k}
                      type="button"
                      className={`wd-key ${m ?? ""}`}
                      data-state={m ?? "unknown"}
                      aria-label={m ? `${k}, ${MARK_TEXT[m]}` : k}
                      onClick={() => press(k)}
                    >
                      {k}
                      {m ? (
                        <span className="feedback-mark" aria-hidden="true">
                          {MARK_SYMBOL[m]}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                {ri === 2 ? (
                  <button type="button" className="wd-key wide" aria-label="Delete letter" onClick={() => setDraft(draft.slice(0, -1))}>
                    Delete
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={relaxOpen}
        onClose={() => setRelaxOpen(false)}
        title="Switch hard mode off?"
        body="Your guesses will no longer have to use the letters already revealed. This stays off for the rest of the round, and your result will say so."
        confirmLabel="Switch it off"
        onConfirm={() => dispatch({ type: "relax-hard-mode" })}
      />
      <ConfirmDialog
        open={revealOpen}
        onClose={() => setRevealOpen(false)}
        title="Reveal the answer?"
        body="The answer and its meaning will be shown and the round ends as revealed."
        confirmLabel="Reveal it"
        onConfirm={() => dispatch({ type: "reveal" })}
      />
    </GameShell>
  );
}
