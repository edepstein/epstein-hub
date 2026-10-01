"use client";

import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { PlayProps } from "../play-types";
import type { RoundBundle } from "../types";
import { definition } from "./definition";
import { createLetterWheelEngine, positionsUsed, type WheelAction, type WheelPayload, type WheelState } from "./engine";
import { useGameSession } from "@/hooks/useGameSession";
import { GameShell } from "@/components/game/GameShell";
import { WordListGate } from "@/components/game/WordListGate";
import { createRng } from "@/lib/rng";
import "./wheel.css";

export default function Play({ bundle, siblings }: PlayProps) {
  if (!bundle) return null;
  return <WordListGate>{(words) => <WheelGame bundle={bundle as RoundBundle<WheelPayload>} words={words} siblings={siblings ?? []} />}</WordListGate>;
}

function WheelGame({ bundle, words, siblings }: { bundle: RoundBundle<WheelPayload>; words: ReadonlySet<string>; siblings: NonNullable<PlayProps["siblings"]> }) {
  const engine = useMemo(() => createLetterWheelEngine(words), [words]);
  const session = useGameSession<WheelPayload, WheelState, WheelAction, string>({ engine, round: bundle.payload, meta: bundle.meta, title: bundle.meta.title ?? "Letter Wheel" });
  const { state, dispatch } = session;
  const draft = session.draft ?? "";
  const inputRef = useRef<HTMLInputElement>(null);
  const [sort, setSort] = useState<"order" | "length" | "alpha">("order");
  const shuffleCount = useRef(0);

  const { used } = positionsUsed(state.letters, draft.replace(/[^A-Za-z]/g, ""));
  const setDraft = (d: string) => session.setDraft(d.toUpperCase());

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const t = dispatch({ type: "submit", word: draft });
    if (t.ok) setDraft("");
    inputRef.current?.focus();
  };

  const tap = (i: number) => {
    if (used[i]) return;
    setDraft(draft + state.letters[i]);
    inputRef.current?.focus();
  };

  const shuffle = () => {
    shuffleCount.current += 1;
    const rng = createRng((Date.now() ^ (shuffleCount.current * 7919)) >>> 0);
    dispatch({ type: "shuffle", order: rng.shuffle(state.order) });
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setDraft("");
    }
  };

  const score = state.found.reduce((s, f) => s + f.points, 0);
  const targetFound = state.found.filter((f) => f.target).length;
  const bonus = state.found.filter((f) => !f.target).length;
  const pct = Math.round((targetFound / state.targets.length) * 100);
  const sorted = useMemo(() => {
    const list = [...state.found];
    if (sort === "length") list.sort((a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word));
    if (sort === "alpha") list.sort((a, b) => a.word.localeCompare(b.word));
    return list;
  }, [state.found, sort]);

  const outer = state.order.filter((i) => i !== state.requiredIndex);
  const hintLog = state.hints.map((h) => h.text);

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
          <h2 style={{ fontVariantNumeric: "tabular-nums" }} data-testid="score">{score} points</h2>
          <div className="lw-progress" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </div>
          <p style={{ margin: "0 0 6px" }} data-testid="target-progress">
            {targetFound} of {state.targets.length} {state.wordLabel} words
          </p>
          <div className="stat-row">
            <span>Bonus words</span>
            <span>{bonus}</span>
          </div>
          <div className="stat-row">
            <span>Words in the full list</span>
            <span>{state.lexicon.length}</span>
          </div>
          <div className="stat-row">
            <span>Nine-letter</span>
            <span>{state.found.some((f) => f.word.length === 9) ? "Found" : "Not yet"}</span>
          </div>
          <div className="stat-row">
            <span>Hints used</span>
            <span>{state.hints.length}</span>
          </div>
          <div style={{ marginTop: 12 }}>
            {state.finished ? (
              <button type="button" className="btn secondary small" onClick={() => dispatch({ type: "resume" })}>
                Keep playing
              </button>
            ) : session.outcome === "playing" ? (
              <button type="button" className="btn secondary small" onClick={() => dispatch({ type: "finish" })}>
                Finish and see result
              </button>
            ) : null}
          </div>
        </>
      }
    >
      <div className="lw-wheel" role="group" aria-label={`Letter wheel. Centre letter ${state.required} must be in every word.`}>
        {outer.map((pos, k) => {
          const angle = (k / outer.length) * Math.PI * 2;
          return (
            <button
              key={pos}
              type="button"
              className="lw-letter"
              style={{ left: `${50 + 40 * Math.sin(angle)}%`, top: `${50 - 40 * Math.cos(angle)}%` }}
              aria-disabled={used[pos]}
              aria-label={`${state.letters[pos]}${used[pos] ? ", already used in this word" : ""}`}
              onClick={() => tap(pos)}
            >
              {state.letters[pos]}
            </button>
          );
        })}
        <button
          type="button"
          className="lw-letter centre"
          style={{ left: "50%", top: "50%" }}
          aria-disabled={used[state.requiredIndex]}
          aria-label={`${state.required}, centre letter, required in every word${used[state.requiredIndex] ? ", already used" : ""}`}
          onClick={() => tap(state.requiredIndex)}
        >
          {state.required}
        </button>
      </div>

      <form className="lw-entry" onSubmit={submit}>
        <label htmlFor="lw-input" className="sr-only">
          Your word
        </label>
        <input
          id="lw-input"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="Type or tap letters"
          aria-describedby="game-feedback"
          maxLength={12}
        />
        <button className="btn" type="submit">
          Submit
        </button>
      </form>
      <div className="lw-actions">
        <button type="button" className="text-button" onClick={() => setDraft(draft.slice(0, -1))} disabled={!draft}>
          Delete letter
        </button>
        <button type="button" className="text-button" onClick={() => setDraft("")} disabled={!draft}>
          Clear
        </button>
        <button type="button" className="text-button" onClick={shuffle}>
          Shuffle
        </button>
      </div>

      <section aria-labelledby="lw-found-h" style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h2 id="lw-found-h" style={{ fontSize: "1rem", margin: 0 }}>
            Words found ({state.found.length})
          </h2>
          <label style={{ fontSize: ".85rem" }}>
            Sort{" "}
            <select className="nav-select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="order">Order found</option>
              <option value="length">Longest first</option>
              <option value="alpha">A to Z</option>
            </select>
          </label>
        </div>
        {sorted.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No words yet. Try a short word with the centre letter.</p>
        ) : (
          <ul className="lw-found" data-testid="found-list">
            {sorted.map((f) => (
              <li key={f.word} className={`${f.target ? "" : "bonus"} ${f.assisted ? "assisted" : ""}`}>
                {f.word}
                <small>
                  {f.assisted ? "revealed · 0" : `+${f.points}`}
                  {f.target ? "" : " · bonus"}
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </GameShell>
  );
}
