"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import type { PlayProps } from "../play-types";
import type { RoundBundle } from "../types";
import { definition } from "./definition";
import { createMissingLinksEngine, type BoardState, type Branch, type LinksAction, type LinksPayload, type LinksState } from "./engine";
import { useGameSession } from "@/hooks/useGameSession";
import { GameShell } from "@/components/game/GameShell";
import { WordListGate } from "@/components/game/WordListGate";
import "./bridge.css";

type Drafts = Record<string, string>;

export default function Play({ bundle, siblings }: PlayProps) {
  if (!bundle) return null;
  return <WordListGate>{(words) => <BridgeGame bundle={bundle as RoundBundle<LinksPayload>} words={words} siblings={siblings ?? []} />}</WordListGate>;
}

const STATUS_TEXT = { open: "open", solved: "solved", revealed: "revealed" } as const;
const STATUS_MARK = { open: "○", solved: "✓", revealed: "◐" } as const;

function BridgeGame({ bundle, words, siblings }: { bundle: RoundBundle<LinksPayload>; words: ReadonlySet<string>; siblings: NonNullable<PlayProps["siblings"]> }) {
  const engine = useMemo(() => createMissingLinksEngine(words), [words]);
  const session = useGameSession<LinksPayload, LinksState, LinksAction, Drafts>({ engine, round: bundle.payload, meta: bundle.meta, title: bundle.meta.title ?? "Missing Links" });
  const { state, dispatch } = session;
  const drafts = session.draft ?? {};
  const inputRef = useRef<HTMLInputElement>(null);
  const [showFits, setShowFits] = useState<Record<string, boolean>>({});
  const board = state.boards[state.active];
  const draft = drafts[board.id] ?? "";
  const setDraft = (v: string) => session.setDraft({ ...drafts, [board.id]: v.toUpperCase() });

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const t = dispatch({ type: "guess", board: board.id, word: draft });
    if (t.ok) {
      const rest = { ...drafts };
      delete rest[board.id];
      session.setDraft(rest);
      if (t.code === "wrong-link") session.announce(t.message, false, "wrong-link");
    }
    inputRef.current?.focus();
  };

  const select = (id: string) => {
    if (id !== board.id) dispatch({ type: "select", board: id });
  };

  const score = state.boards.filter((b) => b.status === "solved").length * 100;
  const open = state.boards.filter((b) => b.status === "open");
  const nextOpen = state.boards.find((b, i) => i > state.active && b.status === "open") ?? open.find((b) => b.id !== board.id);
  const bankVisible = state.bank === "shown" || board.bankOpened;
  const boardIndex = state.active + 1;
  const solution = board.solutions.find((s) => s.link === board.solvedWith) ?? board.solutions[0];

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
          <span className="side-kicker">Your progress</span>
          <h2 style={{ fontVariantNumeric: "tabular-nums" }} data-testid="score">
            {score} points
          </h2>
          <p style={{ margin: "0 0 8px" }} data-testid="board-progress">
            {state.boards.filter((b) => b.status !== "open").length} of {state.boards.length} boards finished
          </p>
          <div className="stat-row">
            <span>Links solved</span>
            <span>{state.boards.filter((b) => b.status === "solved").length}</span>
          </div>
          <div className="stat-row">
            <span>Revealed</span>
            <span>{state.boards.filter((b) => b.status === "revealed").length}</span>
          </div>
          <div className="stat-row">
            <span>Wrong guesses</span>
            <span>{state.boards.reduce((n, b) => n + b.guesses.length, 0)}</span>
          </div>
          <div className="stat-row">
            <span>Hints used</span>
            <span>{state.hints.length}</span>
          </div>
          <div className="stat-row">
            <span>Word bank</span>
            <span>{state.bank === "shown" ? "Shown (Gentle)" : `${state.boards.filter((b) => b.bankOpened).length} opened`}</span>
          </div>
          <div style={{ marginTop: 12 }}>
            {state.finished ? (
              <button type="button" className="btn secondary small" onClick={() => dispatch({ type: "resume" })}>
                Back to the boards
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
      <nav className="ml-strip" aria-label="Boards in this round">
        {state.boards.map((b, i) => (
          <button
            key={b.id}
            type="button"
            className="ml-strip-btn"
            data-status={b.status}
            aria-current={i === state.active ? "step" : undefined}
            onClick={() => select(b.id)}
            data-testid={`board-tab-${b.id}`}
          >
            <span aria-hidden="true">{STATUS_MARK[b.status]} </span>
            Board {i + 1} <span className="ml-strip-status">{STATUS_TEXT[b.status]}</span>
          </button>
        ))}
      </nav>

      <section className="ml-board" aria-labelledby="ml-board-h" data-testid="active-board" data-board={board.id}>
        <h2 id="ml-board-h" className="ml-board-h">
          Board {boardIndex} of {state.boards.length} · {board.branches.length} branches ·{" "}
          <span data-testid="enumeration">
            missing word: {board.linkLength} letters
          </span>
        </h2>

        {board.status === "open" ? (
          <>
            <form className="ml-entry" onSubmit={submit}>
              <label htmlFor="ml-input" className="sr-only">
                Missing word for board {boardIndex}, {board.linkLength} letters
              </label>
              <input
                id="ml-input"
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setDraft("");
                  }
                }}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder={`${board.linkLength} letters`}
                aria-describedby="game-feedback"
              />
              <button className="btn" type="submit">
                Submit
              </button>
            </form>
            <p className="ml-slots" aria-hidden="true">
              {Array.from({ length: board.linkLength }, (_, k) => (
                <span key={k}>{draft[k] ?? ""}</span>
              ))}
            </p>
          </>
        ) : (
          <p className="ml-solved" data-testid="board-outcome">
            {board.status === "solved" ? (
              <>
                <span aria-hidden="true">✓ </span>Solved with <strong>{board.solvedWith}</strong>
              </>
            ) : (
              <>
                <span aria-hidden="true">◐ </span>Revealed: <strong>{board.solutions[0].link}</strong> (scores 0)
              </>
            )}
          </p>
        )}

        <ol className="ml-branches" aria-label={`Branches on board ${boardIndex}`}>
          {board.branches.map((br) => (
            <BranchCard key={br.id} br={br} board={board} link={board.status === "open" ? null : solution.link} compound={board.status === "open" ? null : solution.compounds[br.id]} />
          ))}
        </ol>

        {board.status === "open" ? (
          <div className="ml-bank">
            {bankVisible ? (
              <>
                <p className="ml-bank-h" id="ml-bank-h">
                  Word bank{state.bank === "optional" ? " (opened: this board counts as helped)" : ""}. Tap a word to put it in the box.
                </p>
                <ul className="ml-bank-list" aria-labelledby="ml-bank-h" data-testid="word-bank">
                  {board.candidates.map((c) => (
                    <li key={c}>
                      <button type="button" className="text-button" onClick={() => { setDraft(c); inputRef.current?.focus(); }}>
                        {c}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <button type="button" className="text-button" onClick={() => dispatch({ type: "open-bank", board: board.id })}>
                Show word bank (counts as help)
              </button>
            )}
          </div>
        ) : null}

        {board.guesses.length ? (
          <div className="ml-guesses" data-testid="guesses">
            <p style={{ margin: "0 0 6px" }}>
              Tried on this board:{" "}
              {board.guesses.map((g) => `${g.word} (${g.fits.filter(Boolean).length} of ${g.fits.length})`).join(", ")}
            </p>
            <button type="button" className="text-button small" aria-expanded={!!showFits[board.id]} onClick={() => setShowFits({ ...showFits, [board.id]: !showFits[board.id] })}>
              {showFits[board.id] ? "Hide which branches failed" : "Show which branches failed"}
            </button>
            {showFits[board.id] ? (
              <ul className="ml-fits">
                {board.guesses.map((g) => (
                  <li key={g.word}>
                    <strong>{g.word}</strong>:{" "}
                    {board.branches.map((br, k) => `${br.prefix}${g.word}${br.suffix} ${g.fits[k] ? "is a word" : "is not a word here"}`).join("; ")}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {board.status !== "open" ? (
          <details className="ml-explain" data-testid="explanation">
            <summary>View explanation</summary>
            <p>{board.explanation}</p>
            <ul>
              {board.branches.map((br) => (
                <li key={br.id}>
                  <strong>{solution.compounds[br.id]}</strong>: {br.clue}
                </li>
              ))}
            </ul>
            {board.solutions.length > 1 ? <p>Accepted links: {board.solutions.map((s) => s.link).join(" or ")}.</p> : null}
          </details>
        ) : null}

        {board.status !== "open" && nextOpen ? (
          <div className="ml-next">
            <button type="button" className="btn" onClick={() => select(nextOpen.id)}>
              Go to board {state.boards.indexOf(nextOpen) + 1}
            </button>
          </div>
        ) : null}
      </section>
    </GameShell>
  );
}

function BranchCard({ br, board, link, compound }: { br: Branch; board: BoardState; link: string | null; compound: string | null }) {
  const before = br.prefix === "";
  const slot = (
    <span className={`ml-slot${link ? " filled" : ""}`} aria-hidden="true">
      {link ?? "?"}
    </span>
  );
  const srTemplate = before ? `Blank before ${br.suffix}` : `${br.prefix} then blank`;
  return (
    <li className="ml-branch" data-branch={br.id}>
      <p className="ml-template">
        <span className="sr-only">{link ? `${compound}. ` : `${srTemplate}, ${board.linkLength} letters. `}</span>
        <span aria-hidden="true">
          {before ? (
            <>
              {slot} <span className="ml-arrow">→</span> {br.suffix}
            </>
          ) : (
            <>
              {br.prefix} <span className="ml-arrow">→</span> {slot}
            </>
          )}
        </span>
      </p>
      <p className="ml-dir" aria-hidden="true">
        {before ? "blank before" : "blank after"}
        {compound ? ` · ${compound}` : ""}
      </p>
      <p className="ml-clue">{br.clue}</p>
    </li>
  );
}
