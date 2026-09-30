"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { PlayProps } from "../play-types";
import type { RoundBundle } from "../types";
import { definition } from "./definition";
import {
  cardNumber,
  createCluePairsEngine,
  letterPattern,
  type CluePairsAction,
  type CluePairsDraft,
  type CluePairsPayload,
  type CluePairsState,
} from "./engine";
import { useGameSession } from "@/hooks/useGameSession";
import { GameShell } from "@/components/game/GameShell";
import { ConfirmDialog } from "@/components/ui/Dialog";
import "./pairs.css";

export default function Play({ bundle, siblings }: PlayProps) {
  if (!bundle) return null;
  return <PairsGame bundle={bundle as RoundBundle<CluePairsPayload>} siblings={siblings ?? []} />;
}

const engine = createCluePairsEngine();
const REPORT_KEY = "wc:v1:reports:clue-pairs";

function PairsGame({ bundle, siblings }: { bundle: RoundBundle<CluePairsPayload>; siblings: NonNullable<PlayProps["siblings"]> }) {
  const session = useGameSession<CluePairsPayload, CluePairsState, CluePairsAction, CluePairsDraft>({
    engine,
    round: bundle.payload,
    meta: bundle.meta,
    title: bundle.meta.title ?? "Clue Pairs",
  });
  const { state, dispatch } = session;
  const playing = session.outcome === "playing";
  const inputRef = useRef<HTMLInputElement>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [reportable, setReportable] = useState<{ cardId: string; guess: string } | null>(null);

  const card = state.cards.find((c) => c.id === state.current) ?? state.cards[0];
  const n = cardNumber(state, card.id);
  const drafts = session.draft ?? {};
  const value = drafts[card.id] ?? "";
  const setValue = (v: string) => {
    const next = { ...drafts, [card.id]: v.toUpperCase() };
    if (!v) delete next[card.id];
    session.setDraft(Object.keys(next).length ? next : undefined);
  };

  const select = (id: string) => {
    if (id !== state.current) dispatch({ type: "select", cardId: id });
    setReportable(null);
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const t = dispatch({ type: "submit", cardId: card.id, answer: value });
    if (t.ok && t.code !== "wrong") setValue("");
    setReportable(t.ok && t.code === "wrong" ? { cardId: card.id, guess: value.trim().toUpperCase() } : null);
    if (t.ok && t.code === "wrong") inputRef.current?.select();
  };

  const nextOpen = () => {
    const order = [...state.cards.slice(n), ...state.cards.slice(0, n - 1)];
    return order.find((c) => c.status === "open") ?? null;
  };

  const report = () => {
    if (!reportable) return;
    try {
      const raw = localStorage.getItem(REPORT_KEY);
      const list = raw ? (JSON.parse(raw) as unknown[]) : [];
      list.push({ roundId: bundle.meta.id, cardId: reportable.cardId, contentHash: bundle.meta.contentHash, rulesVersion: bundle.meta.rulesVersion, guess: reportable.guess, at: new Date().toISOString() });
      localStorage.setItem(REPORT_KEY, JSON.stringify(list.slice(-50)));
      session.announce(`Thank you. Your report about ${reportable.guess} is saved on this device for the editors. It does not change your score.`, true, "reported");
    } catch {
      session.announce("Your report could not be saved in this browser.", false, "report-failed");
    }
    setReportable(null);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setValue("");
    }
  };

  const solvedCount = state.cards.filter((c) => c.status === "solved").length;
  const revealedCount = state.cards.filter((c) => c.status === "revealed").length;
  const hintCount = state.cards.reduce((t, c) => t + c.hints.length, 0);
  const hintLog = card.hints;
  const upcoming = nextOpen();

  return (
    <GameShell
      game={definition}
      session={session}
      siblings={siblings}
      hintOffers={engine.hints(state)}
      onTakeHint={(tier) => dispatch({ type: "hint", tier })}
      hintLog={hintLog}
      extraTools={
        playing ? (
          <button type="button" className="text-button" onClick={() => setRevealOpen(true)}>
            Reveal answers
          </button>
        ) : null
      }
      side={
        <>
          <span className="side-kicker">Your progress</span>
          <h2 data-testid="cards-progress">
            {solvedCount + revealedCount} of {state.cards.length} cards
          </h2>
          <div className="stat-row">
            <span>Solved</span>
            <span data-testid="solved-count">{solvedCount}</span>
          </div>
          <div className="stat-row">
            <span>Revealed</span>
            <span>{revealedCount}</span>
          </div>
          <div className="stat-row">
            <span>Hints</span>
            <span data-testid="hints-used">{hintCount}</span>
          </div>
          <div className="stat-row">
            <span>Wrong guesses</span>
            <span>{state.cards.reduce((t, c) => t + c.wrong.length, 0)}</span>
          </div>
        </>
      }
    >
      <nav className="cp-cards" aria-label="Cards in this round">
        {state.cards.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className="cp-card-btn"
            data-status={c.status}
            aria-current={c.id === card.id ? "true" : undefined}
            aria-label={`Card ${i + 1}, ${c.status === "open" ? `${c.length} letters, unsolved` : c.status}`}
            onClick={() => select(c.id)}
          >
            <span className="cp-num">{i + 1}</span>
            <span className="cp-state">{c.status === "solved" ? "✓ Solved" : c.status === "revealed" ? "Revealed" : `${c.length} letters`}</span>
          </button>
        ))}
      </nav>

      <section aria-labelledby="cp-card-heading" data-testid="card" data-card={card.id}>
        <h2 id="cp-card-heading" className="cp-heading">
          Card {n} of {state.cards.length}
        </h2>
        <div id="pair-clue" className="clue">
          <strong>
            <span className="cp-meaning">Meaning 1</span>
            <span data-testid="meaning-1">{card.clues[0]}</span>
          </strong>
          <strong>
            <span className="cp-meaning">Meaning 2</span>
            <span data-testid="meaning-2">{card.clues[1]}</span>
          </strong>
          <small>One word · {card.length} letters</small>
        </div>

        {card.status === "open" ? (
          <>
            <form className="entry cp-entry" onSubmit={submit}>
              <label htmlFor="cp-input" className="sr-only">
                Answer for card {n}, {card.length} letters
              </label>
              <input
                id="cp-input"
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={onKey}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="Answer both clues"
                aria-describedby="game-feedback cp-enum"
                maxLength={24}
                disabled={!playing}
              />
              <span id="cp-enum" className="cp-enum" aria-label={`${card.length} letters`}>
                ({card.length})
              </span>
              <button className="btn" type="submit" disabled={!playing}>
                Submit
              </button>
              <button type="button" className="btn secondary" onClick={() => setValue("")} disabled={!value}>
                Clear
              </button>
            </form>
            {card.lettersShown || card.exampleShown ? (
              <div className="cp-hints" data-testid="card-hints">
                {card.lettersShown ? (
                  <p>
                    Letters shown: <span className="cp-pattern" aria-label={letterPattern(card).replace(/_/g, "blank")}>{letterPattern(card)}</span>
                  </p>
                ) : null}
                {card.exampleShown ? <p>In use: {card.example}</p> : null}
              </div>
            ) : null}
            {card.wrong.length ? (
              <p className="cp-wrong" data-testid="wrong-guesses">
                Tried: {card.wrong.join(", ")}
              </p>
            ) : null}
            {reportable && reportable.cardId === card.id ? (
              <button type="button" className="text-button small" onClick={report}>
                Report an answer issue
              </button>
            ) : null}
          </>
        ) : (
          <div className="cp-explain" data-testid="card-explanation">
            <p className="cp-answer">
              {card.status === "solved" ? "✓ Solved: " : "Revealed: "}
              <strong>{card.answer}</strong>
              {card.accepted.length > 1 ? <span> (also accepted: {card.accepted.filter((a) => a !== card.answer).join(", ")})</span> : null}
            </p>
            <p>{card.explanation}</p>
            {card.wrong.length ? <p className="cp-wrong">Your other guesses: {card.wrong.join(", ")}</p> : null}
            {playing && upcoming ? (
              <button type="button" className="btn" onClick={() => select(upcoming.id)}>
                Next card
              </button>
            ) : null}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={revealOpen}
        onClose={() => setRevealOpen(false)}
        title="Reveal every remaining card?"
        body="The remaining answers will be shown with both meanings explained, and the round will end as revealed. Cards you have solved still count."
        confirmLabel="Reveal answers"
        onConfirm={() => dispatch({ type: "reveal-all" })}
      />
    </GameShell>
  );
}
