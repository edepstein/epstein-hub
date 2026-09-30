"use client";

import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { PlayProps } from "../play-types";
import type { RoundBundle } from "../types";
import { definition } from "./definition";
import { createLetterSetEngine, type SetAction, type SetPayload, type SetState } from "./engine";
import { useGameSession } from "@/hooks/useGameSession";
import { GameShell } from "@/components/game/GameShell";
import { WordListGate } from "@/components/game/WordListGate";
import { createRng } from "@/lib/rng";
import "./garden.css";

export default function Play({ bundle, siblings }: PlayProps) {
  if (!bundle) return null;
  return <WordListGate>{(words) => <GardenGame bundle={bundle as RoundBundle<SetPayload>} words={words} siblings={siblings ?? []} />}</WordListGate>;
}

/** Petal positions around the centre (px within the 260 x 240 garden). */
const petal = (k: number) => {
  const a = (k * Math.PI) / 3;
  return { left: 96 + 69 * Math.sin(a), top: 86 - 69 * Math.cos(a) };
};

function GardenGame({ bundle, words, siblings }: { bundle: RoundBundle<SetPayload>; words: ReadonlySet<string>; siblings: NonNullable<PlayProps["siblings"]> }) {
  const engine = useMemo(() => createLetterSetEngine(words), [words]);
  const session = useGameSession<SetPayload, SetState, SetAction, string>({ engine, round: bundle.payload, meta: bundle.meta, title: bundle.meta.title ?? "Letter Set" });
  const { state, dispatch } = session;
  const draft = session.draft ?? "";
  const inputRef = useRef<HTMLInputElement>(null);
  const [sort, setSort] = useState<"order" | "length" | "alpha">("order");
  const shuffleCount = useRef(0);
  const setDraft = (d: string) => session.setDraft(d.toUpperCase());

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const t = dispatch({ type: "submit", word: draft });
    if (t.ok) setDraft("");
    inputRef.current?.focus();
  };

  const tap = (letter: string) => {
    setDraft(draft + letter);
    inputRef.current?.focus();
  };

  const shuffle = () => {
    shuffleCount.current += 1;
    const rng = createRng((Date.now() ^ (shuffleCount.current * 7919)) >>> 0);
    let order = rng.shuffle(state.outer);
    if (order.join() === state.outer.join()) order = [...order.slice(1), order[0]];
    dispatch({ type: "shuffle", order });
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
  const allLetterFound = state.found.filter((f) => f.allLetter);
  const pct = Math.round((targetFound / state.targets.length) * 100);
  const sorted = useMemo(() => {
    const list = [...state.found];
    if (sort === "length") list.sort((a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word));
    if (sort === "alpha") list.sort((a, b) => a.word.localeCompare(b.word));
    return list;
  }, [state.found, sort]);
  const outerLetters = state.outer.map((i) => state.letters[i]);
  const hintLog = state.hints.map((h) => h.text);
  const complete = session.outcome === "completed";

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
          <h2 style={{ fontVariantNumeric: "tabular-nums" }} data-testid="score">
            {score} points
          </h2>
          <div className="ls-progress" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </div>
          <p style={{ margin: "0 0 6px" }} data-testid="target-progress">
            {targetFound} of {state.targets.length} everyday words
          </p>
          <p style={{ margin: "0 0 8px", fontSize: ".8rem", color: "var(--muted)" }}>
            The everyday list is a curated set of familiar words. Bonus words from the full list score but do not count towards it.
          </p>
          <div className="stat-row">
            <span>All-letter words</span>
            <span>{allLetterFound.length ? `${allLetterFound.length} found` : "Not yet"}</span>
          </div>
          <div className="stat-row">
            <span>Bonus words</span>
            <span>{bonus}</span>
          </div>
          <div className="stat-row">
            <span>Accepted words</span>
            <span>
              {state.found.length} of {state.lexicon.length}
            </span>
          </div>
          <div className="stat-row">
            <span>Max score</span>
            <span>{state.maxScore} pts</span>
          </div>
          <div className="stat-row">
            <span>Hints used</span>
            <span>{state.hints.length}</span>
          </div>
          <div style={{ marginTop: 12 }}>
            {state.finished ? (
              <button type="button" className="btn secondary small" onClick={() => dispatch({ type: "resume" })}>
                Continue finding words
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
      <div className="honey ls-garden" role="group" aria-label={`Letter garden. Letters may repeat. Required letter ${state.required} is in the middle.`}>
        {outerLetters.map((l, k) => {
          const p = petal(k);
          return (
            <button key={l} type="button" className="tile" style={{ left: p.left, top: p.top }} aria-label={l} onClick={() => tap(l)}>
              {l}
            </button>
          );
        })}
        <button
          type="button"
          className="tile centre"
          style={{ left: 96, top: 86 }}
          aria-label={`${state.required}, required letter, needed in every word`}
          onClick={() => tap(state.required)}
        >
          {state.required}
        </button>
      </div>
      <p className="circuit-caption" data-testid="required-caption">
        Required letter: <strong>{state.required}</strong> · repeat letters freely
      </p>

      {complete ? (
        <p className="ls-complete" role="note" data-testid="complete-note">
          <span aria-hidden="true">✦ </span>Every everyday word found. The garden stays open: keep finding bonus words.
        </p>
      ) : null}

      <form className="ls-entry" onSubmit={submit}>
        <label htmlFor="ls-input" className="sr-only">
          Your word
        </label>
        <input
          id="ls-input"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="Type or tap letters"
          aria-describedby="game-feedback"
          maxLength={20}
        />
        <button className="btn" type="submit">
          Submit
        </button>
      </form>
      <div className="ls-actions">
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

      <section aria-labelledby="ls-all-h" className="ls-all" data-testid="all-letter-area">
        <h2 id="ls-all-h">
          <span aria-hidden="true">✦ </span>All-letter words
        </h2>
        {allLetterFound.length ? (
          <ul>
            {allLetterFound.map((f) => (
              <li key={f.word}>
                {f.word} <small>{f.assisted ? "revealed · 0" : `+${f.points} including the 7-point bonus`}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p>None yet. An all-letter word uses every letter at least once and can be longer than seven letters.</p>
        )}
      </section>

      <details className="ls-found-wrap" open>
        <summary>
          <span id="ls-found-h">Words found ({state.found.length})</span>
        </summary>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
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
          <p style={{ color: "var(--muted)" }}>No words yet. Try a short word with the required letter.</p>
        ) : (
          <ul className="ls-found" data-testid="found-list" aria-labelledby="ls-found-h">
            {sorted.map((f) => (
              <li key={f.word} className={`${f.target ? "" : "bonus"} ${f.assisted ? "assisted" : ""} ${f.allLetter ? "all" : ""}`}>
                {f.allLetter ? <span aria-hidden="true">✦ </span> : null}
                {f.word}
                <small>
                  {f.assisted ? "revealed · 0" : `+${f.points}`}
                  {f.target ? "" : " · bonus"}
                  {f.allLetter ? " · all letters" : ""}
                </small>
              </li>
            ))}
          </ul>
        )}
      </details>
    </GameShell>
  );
}
