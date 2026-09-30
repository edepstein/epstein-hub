"use client";

import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { PlayProps } from "../play-types";
import type { RoundBundle } from "../types";
import { definition } from "./definition";
import {
  boardOf,
  chainComplete,
  coverage,
  createLetterCircuitEngine,
  requiredStart,
  SIDE_NAMES,
  unusedLetters,
  type CircuitAction,
  type CircuitPayload,
  type CircuitState,
} from "./engine";
import { useGameSession } from "@/hooks/useGameSession";
import { GameShell } from "@/components/game/GameShell";
import { WordListGate } from "@/components/game/WordListGate";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { plural } from "@/lib/text";
import "./circuit.css";

export default function Play({ bundle, siblings }: PlayProps) {
  if (!bundle) return null;
  return <WordListGate>{(words) => <CircuitGame bundle={bundle as RoundBundle<CircuitPayload>} words={words} siblings={siblings ?? []} />}</WordListGate>;
}

/** Tile centre as a percentage of the square: top, right, bottom, left sides. */
function tilePos(side: number, k: number): { x: number; y: number } {
  const t = [18, 50, 82][k];
  if (side === 0) return { x: t, y: 0 };
  if (side === 1) return { x: 100, y: t };
  if (side === 2) return { x: t, y: 100 };
  return { x: 0, y: t };
}
const SIDE_MARK = ["▲", "▶", "▼", "◀"];

function CircuitGame({ bundle, words, siblings }: { bundle: RoundBundle<CircuitPayload>; words: ReadonlySet<string>; siblings: NonNullable<PlayProps["siblings"]> }) {
  const engine = useMemo(() => createLetterCircuitEngine(words), [words]);
  const session = useGameSession<CircuitPayload, CircuitState, CircuitAction, string>({
    engine,
    round: bundle.payload,
    meta: bundle.meta,
    title: bundle.meta.title ?? "Letter Circuit",
  });
  const { state, dispatch } = session;
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const board = useMemo(() => boardOf(state), [state]);
  const start = requiredStart(state);
  const draft = session.draft ?? start ?? "";
  const setDraft = (d: string) => session.setDraft(d.toUpperCase());
  const locked = !!state.best && !state.improving;
  const cov = coverage(state);
  const used = (l: string) => !!(cov & (1 << board.bitOf.get(l)!));
  const clean = draft.replace(/[^A-Za-z]/g, "").toUpperCase();
  const lastLetter = clean.at(-1);
  const lastSide = lastLetter ? board.sideOf.get(lastLetter) : undefined;

  const focusInput = () => inputRef.current?.focus();
  const afterChange = (s: CircuitState) => setDraft(requiredStart(s) ?? "");

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const t = dispatch({ type: "submit", word: draft });
    if (t.ok) afterChange(t.state);
    focusInput();
  };

  const tap = (l: string) => {
    if (locked) return;
    if (lastSide !== undefined && board.sideOf.get(l) === lastSide) {
      session.announce(`${l} is on the ${SIDE_NAMES[lastSide]} side, the same side as ${lastLetter}. Choose a letter from another side.`);
      return;
    }
    setDraft(clean + l);
    focusInput();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setDraft(start ?? "");
    }
  };

  const hintLog = state.hints.map((h) => h.text);
  const remaining = unusedLetters(state);
  const lettersUsed = state.letters.length - remaining.length;
  const draftPoints = [...clean].filter((l) => board.sideOf.has(l)).map((l) => {
    const s = board.sideOf.get(l)!;
    return tilePos(s, board.sides[s].indexOf(l));
  });
  const done = chainComplete(state);

  return (
    <GameShell
      game={definition}
      session={session}
      siblings={siblings}
      hintOffers={engine.hints(state)}
      onTakeHint={(tier) => {
        const t = dispatch({ type: "hint", tier });
        if (t.ok && t.state.chain.length !== state.chain.length) afterChange(t.state);
      }}
      hintLog={hintLog}
      side={
        <>
          <span className="side-kicker">Your circuit</span>
          <h2 data-testid="letters-used">
            {lettersUsed} of 12 letters used
          </h2>
          <div className="stat-row">
            <span>Words in this chain</span>
            <span data-testid="chain-count">{state.chain.length}</span>
          </div>
          <div className="stat-row">
            <span>Par (everyday words)</span>
            <span data-testid="par">{state.par}</span>
          </div>
          <div className="stat-row">
            <span>Your best</span>
            <span data-testid="best">{state.best ? `${plural(state.best.words.length, "word")}${state.best.assisted ? " (helped)" : ""}` : "Not yet"}</span>
          </div>
          <div className="stat-row">
            <span>Hints used</span>
            <span>{state.hints.length}</span>
          </div>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {locked ? (
              <button type="button" className="btn secondary small" onClick={() => afterChange(dispatch({ type: "new-chain" }).state)}>
                Try for fewer words
              </button>
            ) : null}
            {state.improving ? (
              <button type="button" className="btn secondary small" onClick={() => afterChange(dispatch({ type: "show-best" }).state)}>
                Back to my best
              </button>
            ) : null}
          </div>
          {state.best ? (
            <p className="lc-best" data-testid="best-chain">
              Best: {state.best.words.join(" → ")}
            </p>
          ) : null}
        </>
      }
    >
      <div className="lc-wrap">
        <div className="lc-square" role="group" aria-label="Letter board: four sides of three letters">
          <svg className="lc-lines" viewBox="-2 -2 104 104" aria-hidden="true">
            {draftPoints.length > 1 ? <polyline points={draftPoints.map((p) => `${p.x},${p.y}`).join(" ")} /> : null}
          </svg>
          <div className="lc-centre" aria-hidden="true">
            {start && !locked ? <span>{start}</span> : <span>{"↗"}</span>}
          </div>
          {board.sides.map((side, s) =>
            side.map((l, k) => {
              const p = tilePos(s, k);
              const blocked = lastSide === s && !locked;
              const isUsed = used(l);
              const inDraft = clean.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  className={`lc-tile${isUsed ? " used" : ""}${inDraft ? " in-draft" : ""}`}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  aria-disabled={blocked || locked}
                  data-letter={l}
                  aria-label={`${l}, ${SIDE_NAMES[s]} side${isUsed ? ", already used" : ", not used yet"}${blocked ? ", same side as your last letter" : ""}`}
                  onClick={() => tap(l)}
                >
                  {l}
                  <span className="lc-side-mark" aria-hidden="true">
                    {SIDE_MARK[s]}
                  </span>
                  {isUsed ? (
                    <span className="lc-used-mark" aria-hidden="true">
                      {"✓"}
                    </span>
                  ) : null}
                </button>
              );
            }),
          )}
        </div>
      </div>
      <p className="circuit-caption">Across sides, never along one side.</p>

      <p className="lc-status" data-testid="remaining">
        {done ? "Every letter used." : `Still to use: ${remaining.join(", ")}`}
        {start && !locked ? (
          <>
            {" · "}
            <strong data-testid="next-start">Next word starts with {start}</strong>
          </>
        ) : null}
      </p>

      <form className="lc-entry" onSubmit={submit}>
        <label htmlFor="lc-input" className="sr-only">
          Your word
        </label>
        <input
          id="lc-input"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={locked ? "Circuit complete" : "Enter a chain word"}
          aria-describedby="game-feedback"
          maxLength={20}
          disabled={locked}
        />
        <button className="btn" type="submit" disabled={locked}>
          Submit
        </button>
      </form>
      <div className="lc-actions">
        <button type="button" className="text-button" onClick={() => setDraft(draft.slice(0, -1))} disabled={!draft || locked}>
          Delete letter
        </button>
        <button type="button" className="text-button" onClick={() => setDraft(start ?? "")} disabled={locked || draft === (start ?? "")}>
          Clear
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            const t = dispatch({ type: "undo" });
            if (t.ok) afterChange(t.state);
          }}
          disabled={locked || !state.chain.length}
        >
          Undo last word
        </button>
        <button type="button" className="text-button" onClick={() => setConfirmNew(true)} disabled={locked || !state.chain.length}>
          Start a new chain
        </button>
      </div>

      <section aria-labelledby="lc-chain-h" style={{ marginTop: 16 }}>
        <h2 id="lc-chain-h" style={{ fontSize: "1rem", margin: "0 0 6px" }}>
          {locked ? "Your best chain" : "Your chain"}
        </h2>
        {(locked ? state.best!.words.map((w, i) => ({ word: w, assisted: !!state.best!.played[i] })) : state.chain).length ? (
          <ol className="lc-chain" data-testid="chain">
            {(locked ? state.best!.words.map((w, i) => ({ word: w, assisted: !!state.best!.played[i] })) : state.chain).map((c, i) => (
              <li key={`${c.word}-${i}`} className={c.assisted ? "assisted" : ""}>
                {c.word}
                {c.assisted ? <small> · played for you</small> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="lc-muted">No words yet. Any word can start the chain.</p>
        )}
      </section>

      <ConfirmDialog
        open={confirmNew}
        onClose={() => setConfirmNew(false)}
        title="Start a new chain?"
        body={state.best ? "Your current chain is cleared. Your best completed chain is kept." : "Your current chain is cleared so you can start from any word."}
        confirmLabel="Start a new chain"
        onConfirm={() => afterChange(dispatch({ type: "new-chain" }).state)}
      />
    </GameShell>
  );
}
