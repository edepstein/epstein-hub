"use client";

import { useState } from "react";
import type { PlayProps } from "../play-types";
import type { RoundBundle } from "../types";
import { definition } from "./definition";
import { createWordFragmentsEngine, laneText, trayTiles, type FragAction, type FragPayload, type FragState } from "./engine";
import { useGameSession } from "@/hooks/useGameSession";
import { GameShell } from "@/components/game/GameShell";
import { ConfirmDialog } from "@/components/ui/Dialog";
import "./fragments.css";

const engine = createWordFragmentsEngine();

export default function Play({ bundle, siblings }: PlayProps) {
  if (!bundle) return null;
  return <FragmentsGame bundle={bundle as RoundBundle<FragPayload>} siblings={siblings ?? []} />;
}

function FragmentsGame({ bundle, siblings }: { bundle: RoundBundle<FragPayload>; siblings: NonNullable<PlayProps["siblings"]> }) {
  const session = useGameSession<FragPayload, FragState, FragAction, undefined>({ engine, round: bundle.payload, meta: bundle.meta, title: bundle.meta.title ?? "Word Fragments" });
  const { state, dispatch } = session;
  const [selected, setSelected] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const finished = session.outcome !== "playing";
  const tray = trayTiles(state);
  const laneOfTile = (id: string) => Object.entries(state.placed).find(([, ids]) => ids.includes(id))?.[0] ?? null;
  const selLane = selected ? laneOfTile(selected) : null;
  const selText = selected ? state.tiles[selected] : "";

  const act = (a: FragAction) => {
    const t = dispatch(a);
    if (t.ok && (a.type === "place" || a.type === "remove" || a.type === "undo" || a.type === "hint")) setSelected(null);
    return t;
  };

  const tileButton = (id: string, where: string, index: number, lockedTile: boolean) => (
    <button
      key={id}
      type="button"
      className="wf-tile"
      data-tile={id}
      aria-pressed={selected === id}
      disabled={finished || lockedTile}
      aria-label={`${state.tiles[id]}${where === "tray" ? ", in the tray" : `, ${where} position ${index + 1}`}${lockedTile ? ", locked" : ""}${selected === id ? ", selected" : ""}`}
      onClick={() => setSelected(selected === id ? null : id)}
    >
      {state.tiles[id]}
    </button>
  );

  const placedCount = Object.values(state.placed).flat().length;
  const total = Object.keys(state.tiles).length;

  return (
    <GameShell
      game={definition}
      session={session}
      siblings={siblings}
      hintOffers={engine.hints(state)}
      onTakeHint={(tier) => act({ type: "hint", tier })}
      hintLog={state.hints.map((h) => h.text)}
      side={
        <>
          <span className="side-kicker">Your board</span>
          <h2 style={{ fontVariantNumeric: "tabular-nums" }} data-testid="placed-count">
            {placedCount} of {total} fragments placed
          </h2>
          <div className="stat-row">
            <span>Lane checks</span>
            <span>{state.laneChecks}</span>
          </div>
          <div className="stat-row">
            <span>Hints taken</span>
            <span>{state.hints.length}</span>
          </div>
          {state.claimsUnique ? <p style={{ fontSize: ".85rem", marginTop: 10 }}>One solution: a solver has checked there is only one way to share out these fragments.</p> : null}
        </>
      }
    >
      <p className="wf-instructions" id="wf-help">
        Select a fragment, then choose an answer to place it in. Every fragment is used exactly once.
        {selected ? (
          <strong data-testid="selected-tile">
            {" "}
            Selected: {selText}
            {selLane ? ` (in answer ${state.lanes.findIndex((l) => l.id === selLane) + 1})` : " (in the tray)"}.
          </strong>
        ) : null}
      </p>

      <ol className="wf-lanes" aria-label="Answer lanes">
        {state.lanes.map((lane, i) => {
          const ids = state.placed[lane.id] ?? [];
          const text = laneText(state, lane.id);
          const locked = state.locked.includes(lane.id);
          const label = `answer ${i + 1}`;
          const selIndex = selected && selLane === lane.id ? ids.indexOf(selected) : -1;
          return (
            <li key={lane.id} className={`wf-lane${locked ? " locked" : ""}`} data-testid={`lane-${i + 1}`}>
              <div className="wf-lane-head">
                <span className="wf-lane-n">{i + 1}</span>
                <span className="wf-clue">
                  {lane.clue} <span className="wf-enum">({lane.length})</span>
                </span>
                {locked ? <span className="wf-tag">Locked by hint</span> : null}
                {state.hintLane === lane.id && !locked ? <span className="wf-tag">Suggested by hint</span> : null}
              </div>
              <div className="wf-slots" role="group" aria-label={`Fragments in ${label}`}>
                {ids.length ? ids.map((id, k) => tileButton(id, label, k, locked)) : <span className="wf-empty">No fragments yet</span>}
              </div>
              <div className="wf-lane-foot">
                <span className="wf-letters" data-testid={`lane-${i + 1}-letters`}>
                  {text || "·"} · {text.length} of {lane.length} letters
                </span>
                <span className="wf-lane-actions">
                  {selected && !locked && selLane !== lane.id ? (
                    <button type="button" className="btn small" onClick={() => act({ type: "place", tile: selected, lane: lane.id })}>
                      Place {selText} in {label}
                    </button>
                  ) : null}
                  {selIndex >= 0 && !locked ? (
                    <>
                      <button type="button" className="text-button small" disabled={selIndex === 0} onClick={() => act({ type: "place", tile: selected!, lane: lane.id, index: selIndex - 1 })} aria-label={`Move ${selText} earlier in ${label}`}>
                        ← Earlier
                      </button>
                      <button type="button" className="text-button small" disabled={selIndex === ids.length - 1} onClick={() => act({ type: "place", tile: selected!, lane: lane.id, index: selIndex + 1 })} aria-label={`Move ${selText} later in ${label}`}>
                        Later →
                      </button>
                      <button type="button" className="text-button small" onClick={() => act({ type: "remove", tile: selected! })}>
                        Back to tray
                      </button>
                    </>
                  ) : null}
                  {!finished ? (
                    <button type="button" className="text-button small" onClick={() => dispatch({ type: "check-lane", lane: lane.id })} aria-label={`Check ${label} (counts as assistance)`}>
                      Check
                    </button>
                  ) : null}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <section className="wf-tray" aria-labelledby="wf-tray-h">
        <h2 id="wf-tray-h">Fragment tray ({tray.length})</h2>
        <div className="wf-tray-tiles" role="group" aria-label="Unplaced fragments" data-testid="tray">
          {tray.length ? tray.map((id, k) => tileButton(id, "tray", k, false)) : <span className="wf-empty">Every fragment is placed.</span>}
        </div>
      </section>

      <div className="wf-actions">
        <button type="button" className="btn" onClick={() => act({ type: "submit" })} disabled={finished}>
          Submit board
        </button>
        <button type="button" className="text-button" onClick={() => act({ type: "undo" })} disabled={finished || !state.history.length}>
          Undo last move
        </button>
        <button type="button" className="text-button" onClick={() => setClearOpen(true)} disabled={finished || !Object.entries(state.placed).some(([l, ids]) => ids.length && !state.locked.includes(l))}>
          Return all to tray
        </button>
        {selected ? (
          <button type="button" className="text-button" onClick={() => setSelected(null)}>
            Cancel selection
          </button>
        ) : null}
      </div>

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Return every fragment to the tray?"
        body="All fragments not locked by a hint go back to the tray. You can undo this one move at a time."
        confirmLabel="Return them"
        onConfirm={() => {
          for (const [lane, ids] of Object.entries(state.placed)) {
            if (state.locked.includes(lane)) continue;
            for (const id of ids) dispatch({ type: "remove", tile: id });
          }
          setSelected(null);
        }}
      />
    </GameShell>
  );
}
