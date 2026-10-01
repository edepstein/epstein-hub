"use client";

import { useMemo, type FormEvent, type ReactNode } from "react";
import type { PlayProps } from "../play-types";
import type { RoundBundle } from "../types";
import { definition } from "./definition";
import {
  caseClosed,
  caseScore,
  createDefinitionDetectiveEngine,
  definitionDone,
  roundScore,
  type CaseState,
  type DetectiveAction,
  type DetectivePayload,
  type DetectiveState,
} from "./engine";
import { useGameSession } from "@/hooks/useGameSession";
import { GameShell } from "@/components/game/GameShell";
import "./dossier.css";

type Picks = Record<string, { d?: string; e?: string }>;

export default function Play({ bundle, siblings }: PlayProps) {
  if (!bundle) return null;
  return <DossierGame bundle={bundle as RoundBundle<DetectivePayload>} siblings={siblings ?? []} />;
}

const status = (c: CaseState) =>
  c.revealed === "full" ? "revealed" : caseClosed(c) ? "closed" : c.definitionSolved ? "definition solved" : c.submissions || c.hintLevel ? "in progress" : "open";
const mark = (c: CaseState) => (c.revealed === "full" ? "◐" : caseClosed(c) ? "✓" : c.definitionSolved ? "◑" : "○");

/** Sentence with the target word emphasised (bold plus a text label for non-visual readers). */
function Sentence({ c }: { c: CaseState }): ReactNode {
  const idx = c.sentence.toLowerCase().indexOf(c.word.toLowerCase());
  if (idx < 0) return c.sentence;
  return (
    <>
      {c.sentence.slice(0, idx)}
      <strong className="dd-target">
        <span className="sr-only">target word: </span>
        {c.sentence.slice(idx, idx + c.word.length)}
      </strong>
      {c.sentence.slice(idx + c.word.length)}
    </>
  );
}

function DossierGame({ bundle, siblings }: { bundle: RoundBundle<DetectivePayload>; siblings: NonNullable<PlayProps["siblings"]> }) {
  const engine = useMemo(() => createDefinitionDetectiveEngine(), []);
  const session = useGameSession<DetectivePayload, DetectiveState, DetectiveAction, Picks>({
    engine,
    round: bundle.payload,
    meta: bundle.meta,
    title: bundle.meta.title ?? "Definition Detective",
  });
  const { state, dispatch } = session;
  const picks = session.draft ?? {};
  const c = state.cases[state.active];
  const pick = picks[c.id] ?? {};
  const setPick = (p: { d?: string; e?: string }) => session.setDraft({ ...picks, [c.id]: { ...pick, ...p } });
  const defDone = definitionDone(c);
  const closed = caseClosed(c);
  const n = state.cases.length;

  const submit = (ev?: FormEvent) => {
    ev?.preventDefault();
    const t = dispatch({ type: "submit", case: c.id, definitionId: defDone ? null : (pick.d ?? null), evidenceId: pick.e ?? null });
    if (t.ok && (t.code === "definition-wrong" || t.code === "evidence-weak")) session.announce(t.message, false, t.code);
  };
  const select = (id: string) => {
    if (id !== c.id) dispatch({ type: "select", case: id });
  };
  const nextOpen = state.cases.find((x, i) => i > state.active && !caseClosed(x)) ?? state.cases.find((x) => x.id !== c.id && !caseClosed(x));
  const textOf = (list: { id: string; text: string }[], id: string) => list.find((x) => x.id === id)?.text ?? "";

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
          <span className="side-kicker">Case file</span>
          <h2 style={{ fontVariantNumeric: "tabular-nums" }} data-testid="score">
            {roundScore(state)} of 100
          </h2>
          <p style={{ margin: "0 0 8px", fontSize: ".85rem" }}>Average of the case scores (definition 80, evidence 20), rounded down.</p>
          {state.cases.map((x, i) => (
            <div className="stat-row" key={x.id}>
              <span>
                Case {i + 1}, {x.word}
              </span>
              <span data-testid={`case-score-${x.id}`}>{caseScore(x)}</span>
            </div>
          ))}
          <div className="stat-row">
            <span>Hints used</span>
            <span>{state.hints.length}</span>
          </div>
          <div style={{ marginTop: 12 }}>
            {state.finished ? (
              <button type="button" className="btn secondary small" onClick={() => dispatch({ type: "resume" })}>
                Reopen the file
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
      <nav className="dd-strip" aria-label="Cases in this file">
        {state.cases.map((x, i) => (
          <button
            key={x.id}
            type="button"
            className="dd-strip-btn"
            aria-current={i === state.active ? "step" : undefined}
            onClick={() => select(x.id)}
            data-testid={`case-tab-${x.id}`}
          >
            <span aria-hidden="true">{mark(x)} </span>
            Case {i + 1} <span className="dd-strip-status">{status(x)}</span>
          </button>
        ))}
      </nav>

      <form id="detective-case" onSubmit={submit} data-testid="active-case" data-case={c.id}>
        <div className="eyebrow">
          Case {state.active + 1} of {n} · {c.word}
        </div>
        <p className="definition dd-sentence" data-testid="sentence">
          <Sentence c={c} />
        </p>

        <fieldset className="dd-group" disabled={defDone}>
          <legend>1. Choose the definition of “{c.word}” in this sentence</legend>
          {c.definitionOrder.map((id) => {
            const text = textOf(c.definitions, id);
            const tried = c.triedDefinitions.includes(id);
            const ruled = c.eliminated === id;
            const right = defDone && id === c.answer.definitionId;
            return (
              <label key={id} className={`clue dd-option${tried || ruled ? " out" : ""}${right ? " right" : ""}`}>
                <input
                  type="radio"
                  name={`def-${c.id}`}
                  value={id}
                  checked={defDone ? right : pick.d === id}
                  onChange={() => setPick({ d: id })}
                  disabled={tried && !defDone}
                />{" "}
                {text}
                {right ? <span className="dd-tag"> ✓ correct{c.revealed === "full" ? " (revealed)" : ""}</span> : null}
                {tried ? <span className="dd-tag"> ✗ tried, does not fit</span> : null}
                {ruled && !tried ? <span className="dd-tag"> ✗ ruled out by a hint</span> : null}
              </label>
            );
          })}
        </fieldset>

        <fieldset className="dd-group" disabled={closed}>
          <legend>2. Choose the evidence that most directly supports it (optional, 20 points)</legend>
          {c.evidenceOrder.map((id) => {
            const text = textOf(c.evidence, id);
            const tried = c.triedEvidence.includes(id);
            const right = (c.evidenceSolved || c.revealed !== "none") && id === c.answer.evidenceId;
            return (
              <label key={id} className={`clue dd-option${tried ? " out" : ""}${right ? " right" : ""}`}>
                <input
                  type="radio"
                  name={`ev-${c.id}`}
                  value={id}
                  checked={closed ? right : pick.e === id}
                  onChange={() => setPick({ e: id })}
                  disabled={tried && !closed}
                />{" "}
                “{text}”
                {right ? <span className="dd-tag"> ✓ decisive evidence{c.revealed !== "none" ? " (revealed)" : ""}</span> : null}
                {tried ? <span className="dd-tag"> ✗ weaker support</span> : null}
              </label>
            );
          })}
        </fieldset>

        {!closed ? (
          <div className="dd-actions">
            <button type="submit" className="btn">
              {defDone ? "Check evidence" : "Check definition and evidence"}
            </button>
            {pick.d || pick.e ? (
              <button type="button" className="text-button" onClick={() => setPick({ d: undefined, e: undefined })}>
                Clear choices
              </button>
            ) : null}
          </div>
        ) : null}
      </form>

      {defDone ? (
        <details className="dd-learn" data-testid="learn-more" open={closed}>
          <summary>{closed ? "View explanation and learn more" : "View explanation so far"}</summary>
          <p>{c.explanation}</p>
          <ul>
            {Object.entries(c.whyNot).map(([id, why]) => (
              <li key={id}>
                Not “{textOf(c.definitions, id)}”: {why}
              </li>
            ))}
          </ul>
          <p>
            <strong>Learn more.</strong> {c.word}: {c.learnMore.definition}
          </p>
          <p>
            <em>Example:</em> {c.learnMore.example}
          </p>
        </details>
      ) : null}

      {defDone && nextOpen ? (
        <div className="dd-next">
          <button type="button" className="btn secondary" onClick={() => select(nextOpen.id)}>
            Go to case {state.cases.indexOf(nextOpen) + 1}
          </button>
        </div>
      ) : null}
    </GameShell>
  );
}
