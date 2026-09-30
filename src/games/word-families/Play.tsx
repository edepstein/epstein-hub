"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { PlayProps } from "../play-types";
import type { RoundBundle } from "../types";
import { definition } from "./definition";
import {
  budgetBlocked,
  createWordFamiliesEngine,
  GROUP_SIZE,
  isSolvedTerm,
  labelOf,
  type FamiliesAction,
  type FamiliesDraft,
  type FamiliesPayload,
  type FamiliesState,
} from "./engine";
import { useGameSession } from "@/hooks/useGameSession";
import { GameShell } from "@/components/game/GameShell";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { createRng } from "@/lib/rng";
import { plural } from "@/lib/text";
import "./families.css";

export default function Play({ bundle, siblings }: PlayProps) {
  if (!bundle) return null;
  return <FamiliesGame bundle={bundle as RoundBundle<FamiliesPayload>} siblings={siblings ?? []} />;
}

const engine = createWordFamiliesEngine();

/** Longest single word on a tile decides its type size, so long terms wrap by word and stay readable. */
function sizeClass(label: string) {
  const longest = Math.max(...label.split(" ").map((w) => w.length));
  return longest >= 8 ? "long" : longest >= 7 ? "mid" : "short";
}

function FamiliesGame({ bundle, siblings }: { bundle: RoundBundle<FamiliesPayload>; siblings: NonNullable<PlayProps["siblings"]> }) {
  const session = useGameSession<FamiliesPayload, FamiliesState, FamiliesAction, FamiliesDraft>({
    engine,
    round: bundle.payload,
    meta: bundle.meta,
    title: bundle.meta.title ?? "Word Families",
  });
  const { state, dispatch } = session;
  const playing = session.outcome === "playing";
  const [revealOpen, setRevealOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const shuffleCount = useRef(0);

  // Only unsolved, known ids survive in the selection (a restored draft may be stale).
  const selected = useMemo(
    () => (session.draft ?? []).filter((id) => state.terms.some((t) => t.id === id) && !isSolvedTerm(state, id)).slice(0, GROUP_SIZE),
    [session.draft, state],
  );
  const board = state.order.filter((id) => !isSolvedTerm(state, id));
  const blocked = playing && budgetBlocked(state);
  const safeFocus = Math.min(focusIdx, Math.max(0, board.length - 1));

  const setSelected = (ids: string[]) => session.setDraft(ids.length ? ids : undefined);

  const toggle = (id: string) => {
    if (!playing) return;
    if (selected.includes(id)) {
      setSelected(selected.filter((x) => x !== id));
      return;
    }
    if (selected.length >= GROUP_SIZE) {
      session.announce(`You already have ${GROUP_SIZE} tiles selected. Deselect one first, or check the group.`, false, "selection-full");
      return;
    }
    setSelected([...selected, id]);
  };

  const submit = () => {
    const t = dispatch({ type: "submit", ids: selected });
    if (t.ok && (t.code === "group-found" || t.code === "complete")) {
      setSelected([]);
      setFocusIdx(0);
      requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>("button.wf-tile")?.focus());
    }
  };

  const shuffle = () => {
    shuffleCount.current += 1;
    const rng = createRng((Date.now() ^ (shuffleCount.current * 7919)) >>> 0);
    dispatch({ type: "shuffle", order: rng.shuffle(state.order) });
  };

  const clear = () => {
    setSelected([]);
    session.announce("Selection cleared.", true, "cleared");
  };

  const columns = () => {
    const tiles = gridRef.current ? [...gridRef.current.querySelectorAll<HTMLElement>("button.wf-tile")] : [];
    if (tiles.length < 2) return 1;
    const top = tiles[0].offsetTop;
    const n = tiles.findIndex((t) => t.offsetTop !== top);
    return n < 0 ? tiles.length : n;
  };

  const moveFocus = (to: number) => {
    const n = Math.max(0, Math.min(board.length - 1, to));
    setFocusIdx(n);
    gridRef.current?.querySelectorAll<HTMLButtonElement>("button.wf-tile")[n]?.focus();
  };

  const onTileKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const cols = columns();
    const keys: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + cols, ArrowUp: i - cols, Home: 0, End: board.length - 1 };
    if (e.key in keys) {
      e.preventDefault();
      moveFocus(keys[e.key]);
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      clear();
    }
  };

  const solvedRows = state.solved.map((s) => ({ ...s, group: state.groups.find((g) => g.id === s.groupId)! }));
  const hintLog = state.hints.map((h) => h.text);
  const nudges = state.hints.filter((h) => h.tier !== 3).length;
  const revealedCount = state.solved.filter((s) => s.via === "revealed").length;

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
          <h2 data-testid="groups-progress">
            {state.solved.length} of {state.groups.length} groups
          </h2>
          <div className="stat-row">
            <span>Mistakes</span>
            <span data-testid="mistakes">
              <span aria-hidden="true" className="wf-dots">
                {Array.from({ length: state.budget }, (_, i) => (i < state.mistakes ? "●" : "○")).join("")}
              </span>{" "}
              {state.mistakes} of {state.budget}
            </span>
          </div>
          <div className="stat-row">
            <span>Hints</span>
            <span data-testid="hints-used">{nudges}</span>
          </div>
          <div className="stat-row">
            <span>Groups revealed</span>
            <span>{revealedCount}</span>
          </div>
          {state.continued ? <p className="wf-note">Continuing after the mistake budget (assisted).</p> : null}
          {state.wrongSets.length ? (
            <div style={{ marginTop: 12 }}>
              <strong style={{ fontSize: ".9rem" }}>Groups you have tried</strong>
              <ul className="wf-tried" data-testid="tried-list">
                {state.wrongSets.map((w) => (
                  <li key={w.join("|")}>{w.map((id) => labelOf(state, id)).join(", ")}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      }
    >
      {solvedRows.length ? (
        <ol className="wf-solved" aria-label="Solved groups" data-testid="solved-groups">
          {solvedRows.map(({ group, via }) => (
            <li key={group.id} className="wf-solved-row" data-via={via}>
              <div className="wf-solved-head">
                <strong>{group.label}</strong>
                <span className="wf-via">{via === "found" ? "✓ Found" : "Revealed"}</span>
              </div>
              <div className="wf-solved-terms">{group.termIds.map((id) => labelOf(state, id)).join(" · ")}</div>
              <p>{group.explanation}</p>
            </li>
          ))}
        </ol>
      ) : null}

      {board.length ? (
        <>
          <p id="wf-instructions" className="sr-only">
            Use the arrow keys to move between tiles, Space to select, Enter to check the group and Escape to clear.
          </p>
          <div
            ref={gridRef}
            className="grid four families wf-board"
            role="group"
            aria-label={`Tiles. Select ${GROUP_SIZE} that share a connection.`}
            aria-describedby="wf-instructions"
            data-testid="wf-board"
            data-long={board.some((id) => sizeClass(labelOf(state, id)) === "long")}
          >
            {board.map((id, i) => {
              const label = labelOf(state, id);
              const on = selected.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  className={`tile wf-tile ${on ? "selected" : ""}`}
                  data-size={sizeClass(label)}
                  aria-pressed={on}
                  tabIndex={i === safeFocus ? 0 : -1}
                  disabled={!playing}
                  onFocus={() => setFocusIdx(i)}
                  onClick={() => toggle(id)}
                  onKeyDown={(e) => onTileKey(e, i)}
                >
                  {on ? (
                    <span className="wf-check" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                  <span className="wf-label">{label}</span>
                </button>
              );
            })}
          </div>
          <p className="wf-count" aria-live="polite" data-testid="selection-count">
            {selected.length} of {GROUP_SIZE} selected
          </p>
        </>
      ) : null}

      {blocked ? (
        <div className="wc-banner wf-budget" data-tone="warn" role="alert" data-testid="budget-panel">
          <span>
            You have used all {plural(state.budget, "mistake")}. You can keep going (your result will say you continued with help), take a hint or reveal the answers.
          </span>
          <span className="spacer" />
          <button type="button" className="btn small" onClick={() => dispatch({ type: "continue" })}>
            Continue
          </button>
          <button type="button" className="btn secondary small" onClick={() => setRevealOpen(true)}>
            Reveal answers
          </button>
        </div>
      ) : null}

      {playing ? (
        <div className="entry wf-actions">
          <button type="button" className="btn" onClick={submit} disabled={blocked}>
            Check group
          </button>
          <button type="button" className="btn secondary" onClick={clear} disabled={!selected.length}>
            Clear selection
          </button>
          <button type="button" className="text-button" onClick={shuffle}>
            Shuffle
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={revealOpen}
        onClose={() => setRevealOpen(false)}
        title="Reveal every remaining group?"
        body="The remaining groups and their explanations will be shown and the round will end as revealed. Groups you have already found still count."
        confirmLabel="Reveal answers"
        onConfirm={() => {
          setSelected([]);
          dispatch({ type: "reveal-all" });
        }}
      />
    </GameShell>
  );
}
