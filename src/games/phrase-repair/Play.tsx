"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlayProps } from "../play-types";
import type { RoundBundle } from "../types";
import { definition } from "./definition";
import { createPhraseRepairEngine, type PhraseAction, type PhrasePayload, type PhraseState } from "./engine";
import { useGameSession } from "@/hooks/useGameSession";
import { GameShell } from "@/components/game/GameShell";
import { KEY_PREFIX, readJson } from "@/lib/progress/storage";
import "./phrase.css";

const engine = createPhraseRepairEngine();

export default function Play({ bundle, siblings }: PlayProps) {
  if (!bundle) return null;
  return <PhraseGame bundle={bundle as RoundBundle<PhrasePayload>} siblings={siblings ?? []} />;
}

/** Best completed score among earlier attempts at this round on this device (kept when restarting). */
function bestEarlier(roundId: string): number | null {
  try {
    const r = readJson(`${KEY_PREFIX}:history:phrase-repair:${roundId}`);
    if (r.status !== "ok" || !Array.isArray(r.value)) return null;
    let best: number | null = null;
    for (const a of r.value as { outcome?: string; summary?: string }[]) {
      if (a.outcome !== "completed" || !a.summary) continue;
      const n = parseInt(a.summary, 10);
      if (Number.isFinite(n)) best = best === null ? n : Math.max(best, n);
    }
    return best;
  } catch {
    return null;
  }
}

function PhraseGame({ bundle, siblings }: { bundle: RoundBundle<PhrasePayload>; siblings: NonNullable<PlayProps["siblings"]> }) {
  const session = useGameSession<PhrasePayload, PhraseState, PhraseAction, undefined>({ engine, round: bundle.payload, meta: bundle.meta, title: bundle.meta.title ?? "Phrase Repair" });
  const { state, dispatch } = session;
  const finished = session.outcome !== "playing";
  const buttons = useRef(new Map<string, HTMLButtonElement | null>());
  const [focusWish, setFocusWish] = useState<{ id: string; dir: "left" | "right" } | null>(null);
  const [best, setBest] = useState<number | null>(null);

  useEffect(() => {
    // History changes when an attempt is archived (restart), so re-read on attempt change.
    setBest(bestEarlier(bundle.meta.id));
  }, [bundle.meta.id, session.attempt?.attemptId]);

  useEffect(() => {
    if (!focusWish) return;
    const pos = state.order.indexOf(focusWish.id);
    let dir = focusWish.dir;
    if (dir === "left" && pos === 0) dir = "right";
    if (dir === "right" && pos === state.order.length - 1) dir = "left";
    buttons.current.get(`${focusWish.id}:${dir}`)?.focus();
    setFocusWish(null);
  }, [focusWish, state.order]);

  const move = (pos: number, dir: "left" | "right") => {
    const id = state.order[pos];
    const other = dir === "left" ? pos - 1 : pos + 1;
    const t = dispatch({ type: "swap", a: pos, b: other });
    if (t.ok) setFocusWish({ id, dir });
  };

  const enumeration = state.enumeration.join(", ");
  const words = useMemo(() => state.order.map((id) => state.tokens[id]), [state.order, state.tokens]);
  const hintsUsed = state.hints.length;

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
          <span className="side-kicker">Your repair</span>
          <h2 style={{ fontVariantNumeric: "tabular-nums" }} data-testid="swap-count">
            {state.moves} swap{state.moves === 1 ? "" : "s"}
          </h2>
          <p style={{ margin: "0 0 6px" }}>Every neighbour swap and every undo counts.</p>
          <div className="stat-row">
            <span>Hints taken</span>
            <span>{hintsUsed}</span>
          </div>
          <div className="stat-row">
            <span>Tiles</span>
            <span>{state.order.length}</span>
          </div>
          {state.solved ? (
            <div className="stat-row">
              <span>Minimum possible</span>
              <span>{state.minimum}</span>
            </div>
          ) : null}
          <div className="stat-row" data-testid="best-earlier">
            <span>Best earlier attempt</span>
            <span>{best === null ? "None yet" : `${best} points`}</span>
          </div>
        </>
      }
    >
      <div className="pr-clue" id="pr-clue">
        <strong>{state.clue}</strong>
        <small>
          ({enumeration}) · {state.order.length} words
        </small>
      </div>

      <ol id="phrase-tokens" className="pr-strip" aria-label="Phrase tiles in their current order" data-testid="phrase-tiles">
        {state.order.map((id, pos) => {
          const word = state.tokens[id];
          const marked = state.markedToken === id;
          return (
            <li key={id} className={`pr-token${marked ? " marked" : ""}`} data-token={id}>
              <span className="pr-pos" aria-hidden="true">
                {pos + 1}
              </span>
              <span className="pr-word">{word}</span>
              {marked ? <span className="pr-mark">✓ in place (hint)</span> : null}
              <span className="pr-moves">
                <button
                  type="button"
                  ref={(el) => {
                    buttons.current.set(`${id}:left`, el);
                  }}
                  className="pr-move"
                  disabled={finished || pos === 0}
                  aria-label={`Move ${word} left (word ${pos + 1} of ${state.order.length})`}
                  onClick={() => move(pos, "left")}
                >
                  ←
                </button>
                <button
                  type="button"
                  ref={(el) => {
                    buttons.current.set(`${id}:right`, el);
                  }}
                  className="pr-move"
                  disabled={finished || pos === state.order.length - 1}
                  aria-label={`Move ${word} right (word ${pos + 1} of ${state.order.length})`}
                  onClick={() => move(pos, "right")}
                >
                  →
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      <p className="pr-reading" aria-hidden="true">
        {words.join(" ")}
      </p>

      <div className="pr-actions">
        <button type="button" className="btn" onClick={() => dispatch({ type: "check" })} disabled={finished}>
          Check phrase
        </button>
        <button type="button" className="text-button" onClick={() => dispatch({ type: "undo" })} disabled={finished || !state.history.length}>
          Undo last swap (counts as a swap)
        </button>
      </div>
      <p className="pr-note">Any correct repair completes the round. Fewer swaps score more: 60 points for the repair plus up to 40 for efficiency.</p>
    </GameShell>
  );
}
