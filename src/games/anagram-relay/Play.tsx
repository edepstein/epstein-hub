"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { PlayProps } from "../play-types";
import type { RoundBundle } from "../types";
import { definition } from "./definition";
import { addedLetter, createAnagramRelayEngine, isFinished, scoreOf, suggestedLetter, type RelayAction, type RelayPayload, type RelayState } from "./engine";
import { useGameSession } from "@/hooks/useGameSession";
import { GameShell } from "@/components/game/GameShell";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { plural } from "@/lib/text";
import "./relay.css";

const engine = createAnagramRelayEngine();
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface RelayDraft {
  word: string;
  /** Letter placed in the acquisition slot (tile mode), or "" */
  add: string;
}

export default function Play({ bundle, siblings }: PlayProps) {
  if (!bundle) return null;
  return <RelayGame bundle={bundle as RoundBundle<RelayPayload>} siblings={siblings ?? []} />;
}

function tilesUsed(pool: string, draft: string): boolean[] {
  const used = [...pool].map(() => false);
  for (const ch of draft) {
    const i = [...pool].findIndex((l, idx) => l === ch && !used[idx]);
    if (i >= 0) used[i] = true;
  }
  return used;
}

function RelayGame({ bundle, siblings }: { bundle: RoundBundle<RelayPayload>; siblings: NonNullable<PlayProps["siblings"]> }) {
  const session = useGameSession<RelayPayload, RelayState, RelayAction, RelayDraft>({ engine, round: bundle.payload, meta: bundle.meta, title: bundle.meta.title ?? "Anagram Relay" });
  const { state, dispatch } = session;
  const draft: RelayDraft = { word: session.draft?.word ?? "", add: session.draft?.add ?? "" };
  const setDraft = (d: Partial<RelayDraft>) => {
    const next = { ...draft, ...d };
    next.word = next.word.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 14);
    session.setDraft(next.word || next.add ? next : undefined);
  };
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reviseStage, setReviseStage] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const finished = isFinished(state);
  const current = state.answers.length;
  const prev = current === 0 ? state.start : state.answers[current - 1];
  const pool = prev + draft.add;
  const used = tilesUsed(pool, draft.word);
  const chain = [state.start, ...state.answers];
  const suggestion = state.suggestAddedLetter ? suggestedLetter(state) : null;
  const lastIndex = useRef<number | null>(null);

  useEffect(() => {
    if (!session.ready) return;
    if (lastIndex.current !== null && lastIndex.current !== current && !finished) inputRef.current?.focus();
    lastIndex.current = current;
  }, [current, finished, session.ready]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const t = dispatch({ type: "submit", word: draft.word });
    if (t.ok) {
      session.setDraft(undefined);
      setPickerOpen(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setDraft({ word: "" });
    }
  };

  const tap = (i: number) => {
    if (used[i]) return;
    setDraft({ word: draft.word + pool[i] });
  };

  const choose = (l: string) => {
    // Changing the acquired letter clears any use of the old one from the draft.
    const word = draft.add && draft.add !== l ? "" : draft.word;
    setDraft({ add: l, word });
    setPickerOpen(false);
  };

  const confirmRevise = (stage: number) => {
    const old = state.answers[stage];
    const t = dispatch({ type: "revise", stage });
    if (t.ok) session.setDraft({ word: old, add: "" });
  };

  const preview = draft.word ? engine.preview(state, draft.word) : null;
  const n = state.stages.length;
  const later = reviseStage === null ? 0 : state.answers.length - reviseStage - 1;

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
          <span className="side-kicker">Your relay</span>
          <h2 style={{ fontVariantNumeric: "tabular-nums" }} data-testid="score">
            {scoreOf(state)} of 100 points
          </h2>
          <p style={{ margin: "0 0 6px" }} data-testid="stage-progress">
            {finished ? `All ${n} stages done` : `Stage ${current + 1} of ${n}`}
          </p>
          <div className="stat-row">
            <span>Solved by you</span>
            <span>{state.revealed.filter((r) => !r).length}</span>
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
      <ol className="ar-chain" aria-label="Relay stages">
        <li className="ar-leg done">
          <span className="ar-leg-label">Start</span>
          <span className="ar-word">{state.start}</span>
        </li>
        {state.stages.map((stage, i) => {
          if (i < state.answers.length) {
            const add = addedLetter(chain[i], state.answers[i]);
            return (
              <li key={i} className="ar-leg done" data-testid={`stage-${i + 1}`}>
                <span className="ar-leg-label">Stage {i + 1}</span>
                <span className="ar-word">{state.answers[i]}</span>
                <span className="ar-badge">
                  <span aria-hidden="true">+{add}</span>
                  <span className="sr-only">added {add}</span>
                </span>
                {state.revealed[i] ? <span className="ar-tag">filled by hint</span> : null}
                {!finished ? (
                  <button type="button" className="text-button small" onClick={() => setReviseStage(i)} aria-label={`Revise stage ${i + 1}, ${state.answers[i]}`}>
                    Revise
                  </button>
                ) : null}
                <span className="ar-clue-small">{stage.clue}</span>
              </li>
            );
          }
          if (i === current && !finished) {
            return (
              <li key={i} className="ar-leg current" data-testid={`stage-${i + 1}`} aria-current="step">
                <span className="ar-pill">
                  Stage {i + 1} of {n}
                </span>
                <p className="ar-clue" id="ar-clue">
                  {stage.clue} <span className="ar-enum">({stage.length})</span>
                  <small>
                    Keep all {prev.length} letters of {prev}, add one, and rearrange into {stage.length}.
                  </small>
                </p>
                <div className="ar-source" role="group" aria-label={`Tiles: ${prev}${draft.add ? ` plus ${draft.add}` : ""}. Tap to build your answer.`}>
                  {[...pool].map((l, k) => (
                    <button
                      key={k}
                      type="button"
                      className={`ar-tile${k >= prev.length ? " added" : ""}`}
                      aria-disabled={used[k]}
                      aria-label={`${l}${k >= prev.length ? ", the added letter" : ""}${used[k] ? ", already used" : ""}`}
                      onClick={() => tap(k)}
                    >
                      {l}
                    </button>
                  ))}
                  <span className="ar-slot" data-filled={!!draft.add}>
                    <button type="button" className="text-button small" aria-expanded={pickerOpen} aria-controls="ar-picker" onClick={() => setPickerOpen((v) => !v)}>
                      {draft.add ? `Change added letter (${draft.add})` : "Choose the added letter"}
                    </button>
                  </span>
                </div>
                {suggestion ? (
                  <p className="ar-suggest" data-testid="suggested-letter">
                    Suggested letter to add: <strong>{suggestion}</strong>
                  </p>
                ) : null}
                {pickerOpen ? (
                  <div id="ar-picker" className="ar-picker" role="group" aria-label="Alphabet: choose one letter to add">
                    {ALPHABET.map((l) => (
                      <button key={l} type="button" className="ar-pick" aria-pressed={draft.add === l} aria-label={`Add ${l}`} onClick={() => choose(l)}>
                        {l}
                      </button>
                    ))}
                    {draft.add ? (
                      <button type="button" className="text-button small" onClick={() => setDraft({ add: "", word: "" })}>
                        Remove added letter
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <form className="ar-entry" onSubmit={submit}>
                  <label htmlFor="ar-input" className="sr-only">
                    Answer for stage {i + 1}
                  </label>
                  <input
                    id="ar-input"
                    ref={inputRef}
                    value={draft.word}
                    onChange={(e) => setDraft({ word: e.target.value })}
                    onKeyDown={onKey}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder={"_ ".repeat(stage.length).trim()}
                    aria-describedby="ar-clue game-feedback"
                    maxLength={14}
                  />
                  <button className="btn" type="submit">
                    Submit
                  </button>
                </form>
                <div className="ar-actions">
                  <button type="button" className="text-button" onClick={() => setDraft({ word: draft.word.slice(0, -1) })} disabled={!draft.word}>
                    Delete letter
                  </button>
                  <button type="button" className="text-button" onClick={() => setDraft({ word: "" })} disabled={!draft.word}>
                    Clear
                  </button>
                </div>
                {preview ? (
                  <p className="ar-preview" data-testid="draft-preview" data-legal={preview.legal}>
                    {preview.legal ? `${preview.message} Submit to check it against the clue.` : preview.message}
                  </p>
                ) : null}
              </li>
            );
          }
          return (
            <li key={i} className="ar-leg locked" data-testid={`stage-${i + 1}`}>
              <span className="ar-leg-label">Stage {i + 1}</span>
              <span className="ar-blanks" aria-hidden="true">
                {"_ ".repeat(stage.length).trim()}
              </span>
              <span className="ar-clue-small">
                {stage.clue} ({stage.length}) · {finished ? "not reached" : "opens after the stage above"}
              </span>
            </li>
          );
        })}
      </ol>

      <ConfirmDialog
        open={reviseStage !== null}
        onClose={() => setReviseStage(null)}
        title={reviseStage === null ? "Revise" : `Revise stage ${reviseStage + 1}?`}
        body={
          reviseStage === null
            ? null
            : later > 0
              ? `Your answer ${state.answers[reviseStage]} will be reopened for editing, and ${plural(later, "later answer")} will be cleared because ${later === 1 ? "it depends" : "they depend"} on it. Hints you took stay on your record.`
              : `Your answer ${state.answers[reviseStage]} will be reopened for editing. Hints you took stay on your record.`
        }
        confirmLabel="Reopen this stage"
        onConfirm={() => reviseStage !== null && confirmRevise(reviseStage)}
      />
    </GameShell>
  );
}
