"use client";

import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { PlayProps } from "../play-types";
import type { RoundBundle } from "../types";
import { definition } from "./definition";
import {
  clueById,
  crypticWorkshopEngine as engine,
  deviceGiven,
  deviceListOffered,
  enumerationText,
  hintOffersFor,
  nextStage,
  score,
  STAGE_DEFINITION,
  STAGE_DEVICE,
  STAGE_FODDER,
  STAGE_INDICATOR,
  STAGE_LABEL,
  STAGE_LETTERS,
  STAGE_REVEAL,
  stageText,
  visibleStages,
  type WorkshopAction,
  type WorkshopClue,
  type WorkshopPayload,
  type WorkshopState,
} from "./engine";
import {
  DEVICE_LABEL,
  DEVICES,
  deviceDetail,
  explainOperation,
  findPhrase,
  HELP_EXAMPLES,
  letterPattern,
  normaliseLetters,
  wordplaySources,
  type Device,
} from "./construction";
import { useGameSession } from "@/hooks/useGameSession";
import { GameShell } from "@/components/game/GameShell";
import { ConfirmDialog } from "@/components/ui/Dialog";
import "./workshop.css";

interface Draft {
  active: string;
  inputs: Record<string, string>;
  devicesOpen?: Record<string, boolean>;
}

export default function Play({ bundle, siblings }: PlayProps) {
  if (!bundle) return null;
  return <Workshop bundle={bundle as RoundBundle<WorkshopPayload>} siblings={siblings ?? []} />;
}

type Mark = "definition" | "indicator" | "wordplay";
const MARK_LABEL: Record<Mark, string> = { definition: "definition", indicator: "indicator", wordplay: "wordplay material" };

/** Split the surface into plain and highlighted segments for the stages the player can see. */
function segments(clue: WorkshopClue, vis: Set<number>): { text: string; mark?: Mark }[] {
  const ranges: { start: number; end: number; mark: Mark }[] = [];
  const add = (phrase: string, mark: Mark) => {
    const f = findPhrase(clue.text, phrase)[0];
    if (f && !ranges.some((r) => f.start < r.end && r.start < f.end)) ranges.push({ ...f, mark });
  };
  if (vis.has(STAGE_DEFINITION)) add(clue.definition, "definition");
  if (vis.has(STAGE_INDICATOR)) clue.indicators.forEach((i) => add(i, "indicator"));
  if (vis.has(STAGE_FODDER)) wordplaySources(clue.construction).forEach((w) => add(w, "wordplay"));
  ranges.sort((a, b) => a.start - b.start);
  const out: { text: string; mark?: Mark }[] = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start > at) out.push({ text: clue.text.slice(at, r.start) });
    out.push({ text: clue.text.slice(r.start, r.end), mark: r.mark });
    at = r.end;
  }
  if (at < clue.text.length) out.push({ text: clue.text.slice(at) });
  return out;
}

function Workshop({ bundle, siblings }: { bundle: RoundBundle<WorkshopPayload>; siblings: NonNullable<PlayProps["siblings"]> }) {
  const session = useGameSession<WorkshopPayload, WorkshopState, WorkshopAction, Draft>({
    engine,
    round: bundle.payload,
    meta: bundle.meta,
    title: bundle.meta.title ?? "Cryptic Workshop",
  });
  const { state, dispatch } = session;
  const firstId = state.clues[0].id;
  const draft: Draft = session.draft && clueById(state, session.draft.active) ? session.draft : { active: firstId, inputs: {} };
  const active = clueById(state, draft.active)!;
  const index = state.clues.indexOf(active);
  const progress = state.progress[active.id];
  const vis = visibleStages(state, active.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const parseRef = useRef<HTMLHeadingElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const pendingParseFocus = useRef(false);

  const update = (patch: Partial<Draft>) => session.setDraft({ ...draft, ...patch });
  const input = draft.inputs[active.id] ?? "";
  const setInput = (v: string) => update({ inputs: { ...draft.inputs, [active.id]: v.toUpperCase() } });
  const select = (id: string, focusTab = false) => {
    update({ active: id });
    if (focusTab) tabRefs.current[state.clues.findIndex((c) => c.id === id)]?.focus();
  };

  useEffect(() => {
    if (pendingParseFocus.current && progress.status !== "open") {
      pendingParseFocus.current = false;
      parseRef.current?.focus();
    }
  }, [progress.status]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const t = dispatch({ type: "submit", clueId: active.id, answer: input });
    if (t.ok) {
      pendingParseFocus.current = true;
      update({ inputs: { ...draft.inputs, [active.id]: "" } });
    } else inputRef.current?.focus();
  };

  const takeHint = (stage: number) => {
    if (stage === STAGE_REVEAL) {
      setConfirmReveal(true);
      return;
    }
    dispatch({ type: "hint", clueId: active.id, stage });
  };

  const reveal = () => {
    pendingParseFocus.current = true;
    dispatch({ type: "hint", clueId: active.id, stage: STAGE_REVEAL });
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = state.clues.length;
    const to = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (to >= 0) {
      e.preventDefault();
      select(state.clues[to].id, true);
    }
  };

  let nextOpen: WorkshopClue | null = null;
  for (let k = 1; k <= state.clues.length && !nextOpen; k++) {
    const c = state.clues[(index + k) % state.clues.length];
    if (state.progress[c.id].status === "open") nextOpen = c;
  }

  const next = nextStage(state, active.id);
  const hintLog = state.clues.flatMap((c, i) => state.progress[c.id].stages.map((st) => `Clue ${i + 1}: ${stageText(c, st)}`));
  const solved = state.clues.filter((c) => state.progress[c.id].status === "solved").length;
  const hintsUsed = state.clues.reduce((n, c) => n + state.progress[c.id].stages.length, 0);
  const deviceKnown = vis.has(STAGE_DEVICE);
  const devicesOpen = state.mode === "standard" || !!draft.devicesOpen?.[active.id];
  const device = active.construction.type;
  const kicker = `${String(index + 1).padStart(2, "0")} / ${deviceKnown ? DEVICE_LABEL[device].toUpperCase() : "WHAT IS THE TRICK?"}`;
  const segs = segments(active, vis);
  const anyMark = segs.some((s) => s.mark);

  return (
    <GameShell
      game={definition}
      session={session}
      siblings={siblings}
      hintOffers={hintOffersFor(state, active.id)}
      onTakeHint={takeHint}
      hintLog={hintLog}
      side={
        <>
          <span className="side-kicker">This workshop</span>
          <h2 data-testid="cw-score" style={{ fontVariantNumeric: "tabular-nums" }}>
            {score(state)} of 100
          </h2>
          <div className="stat-row">
            <span>Clues solved</span>
            <span data-testid="cw-solved">
              {solved} of {state.clues.length}
            </span>
          </div>
          <div className="stat-row">
            <span>Hints taken</span>
            <span>{hintsUsed}</span>
          </div>
          <div className="stat-row">
            <span>Revealed</span>
            <span>{state.clues.filter((c) => state.progress[c.id].status === "revealed").length}</span>
          </div>
          {session.outcome === "playing" ? (
            <button type="button" className="btn secondary small" style={{ marginTop: 12 }} onClick={() => setConfirmAll(true)}>
              Reveal all remaining
            </button>
          ) : null}
          <details className="cw-help" style={{ marginTop: 16 }}>
            <summary>Device crib sheet</summary>
            <ul>
              {HELP_EXAMPLES.map((ex) => (
                <li key={ex.device}>
                  <strong>{DEVICE_LABEL[ex.device]}</strong>: “{ex.clue}” gives {ex.answer}. {ex.how}
                </li>
              ))}
            </ul>
          </details>
        </>
      }
    >
      <div className="cw-tabs" role="tablist" aria-label="Clues in this workshop">
        {state.clues.map((c, i) => {
          const st = state.progress[c.id].status;
          const selected = c.id === active.id;
          return (
            <button
              key={c.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`cw-tab-${c.id}`}
              aria-selected={selected}
              aria-controls="cw-panel"
              tabIndex={selected ? 0 : -1}
              className="cw-tab"
              data-status={st}
              onClick={() => select(c.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              Clue {i + 1}
              <small>{st === "solved" ? "✓ solved" : st === "revealed" ? "◌ revealed" : "open"}</small>
            </button>
          );
        })}
      </div>

      <div id="cw-panel" role="tabpanel" aria-labelledby={`cw-tab-${active.id}`}>
        <div className="quote cw-clue" data-testid="cw-clue">
          <span className="cw-kicker">{kicker}</span>
          <p className="cw-text">
            {segs.map((s, i) =>
              s.mark ? (
                <mark key={i} className={`cw-mark cw-${s.mark}`} data-mark={s.mark}>
                  {s.text}
                  <span className="sr-only"> ({MARK_LABEL[s.mark]})</span>
                </mark>
              ) : (
                <Fragment key={i}>{s.text}</Fragment>
              ),
            )}{" "}
            <span className="cw-enum" aria-label={`${active.answer.length} letters${active.enumeration.includes(",") ? `, words of ${active.enumeration}` : ""}`}>
              {enumerationText(active)}
            </span>
          </p>
          {vis.has(STAGE_LETTERS) && progress.status === "open" ? (
            <p className="cw-pattern" data-testid="cw-pattern">
              <span className="sr-only">Letters shown: </span>
              {letterPattern(active.answer, active.enumeration)}
            </p>
          ) : null}
        </div>
        {anyMark ? (
          <p className="cw-legend">
            <span className="cw-mark cw-definition">definition</span> underlined · <span className="cw-mark cw-indicator">indicator</span> boxed ·{" "}
            <span className="cw-mark cw-wordplay">wordplay</span> wavy
          </p>
        ) : null}

        {progress.status === "open" ? (
          <>
            <form className="entry cw-entry" onSubmit={submit}>
              <label htmlFor="cw-input" className="sr-only">
                Answer to clue {index + 1}, {active.answer.length} letters
              </label>
              <input
                id="cw-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setInput("");
                  }
                }}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder={`Answer (${active.enumeration})`}
                aria-describedby="game-feedback"
                maxLength={active.answer.length + 6}
              />
              <button className="btn" type="submit">
                Submit
              </button>
              <button type="button" className="btn secondary" onClick={() => setInput("")} disabled={!input}>
                Clear
              </button>
            </form>
            <p className="cw-count" aria-hidden="true">
              {normaliseLetters(input).length} of {active.answer.length} letters
            </p>

            <section className="cw-device" aria-labelledby="cw-device-h">
              <h3 id="cw-device-h">{deviceGiven(state) ? "Device" : deviceListOffered(state) ? "What kind of clue is it? (optional practice)" : "What is the trick?"}</h3>
              {deviceGiven(state) ? (
                <p>
                  <strong>{DEVICE_LABEL[device]}</strong>: {deviceBlurb(device)}
                </p>
              ) : !deviceListOffered(state) ? (
                <p className="cw-muted">Master clues offer no device list. Work out the trick yourself; the hint ladder will name it if you ask.</p>
              ) : devicesOpen ? (
                <div className="cw-device-list" role="group" aria-label="Choose a device">
                  {DEVICES.map((d) => {
                    const tried = progress.guesses.includes(d);
                    const right = tried && d === device;
                    return (
                      <button
                        key={d}
                        type="button"
                        className="text-button small"
                        data-state={right ? "right" : tried ? "wrong" : "untried"}
                        aria-pressed={tried}
                        disabled={tried || deviceKnown}
                        onClick={() => dispatch({ type: "identify", clueId: active.id, device: d })}
                      >
                        {right ? "✓ " : tried ? "✗ " : ""}
                        {DEVICE_LABEL[d]}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <button type="button" className="text-button small" onClick={() => update({ devicesOpen: { ...draft.devicesOpen, [active.id]: true } })}>
                  Practise naming the device
                </button>
              )}
              {!deviceGiven(state) && deviceKnown ? <p className="cw-known">Device: {DEVICE_LABEL[device]}.</p> : null}
            </section>
          </>
        ) : null}

        {progress.status === "open" || progress.stages.length ? (
        <section className="cw-notes" aria-labelledby="cw-notes-h">
          <h3 id="cw-notes-h">Workshop notes for clue {index + 1}</h3>
          {progress.stages.length === 0 && progress.status === "open" ? <p className="cw-muted">No hints taken for this clue.</p> : null}
          <ol data-testid="cw-notes">
            {progress.stages.map((st) => (
              <li key={st}>
                <strong>{STAGE_LABEL[st]}.</strong> {stageText(active, st)}
              </li>
            ))}
          </ol>
          {progress.status === "open" ? (
            <div className="cw-hint-actions">
              {next ? (
                <button type="button" className="btn secondary small" onClick={() => takeHint(next)}>
                  Next hint: {STAGE_LABEL[next]}
                </button>
              ) : (
                <span className="cw-muted">All hints for this clue are shown.</span>
              )}
              <button type="button" className="text-button small" onClick={() => setConfirmReveal(true)}>
                Reveal the answer
              </button>
            </div>
          ) : null}
        </section>
        ) : null}

        {progress.status !== "open" ? (
          <section className="cw-parse" aria-labelledby="cw-parse-h" data-testid="cw-parse">
            <h3 id="cw-parse-h" ref={parseRef} tabIndex={-1}>
              {progress.status === "solved" ? "✓ Solved" : "Revealed"}: {active.answer}
            </h3>
            <dl>
              <dt>Definition</dt>
              <dd>
                {active.lit === "full" || active.construction.type === "cryptic-definition" ? "The whole clue" : `“${active.definition}”`}
                {active.lit === "full" ? " (&lit: the wordplay is also the definition)" : active.lit === "semi" ? " (semi-&lit: it runs on into the wordplay)" : ""}
                {active.construction.type === "double-definition" ? ` and “${active.construction.second}”` : ""}
              </dd>
              <dt>Device</dt>
              <dd>{deviceDetail(active)}</dd>
              <dt>Indicator</dt>
              <dd>{active.indicators.length ? active.indicators.map((i) => `“${i}”`).join(", ") : device === "cryptic-definition" ? "None: there is no wordplay" : "None: the parts sit side by side"}</dd>
              <dt>Wordplay material</dt>
              <dd>{wordplaySources(active.construction).length ? wordplaySources(active.construction).map((w) => `“${w}”`).join(" + ") : "None: a cryptic definition has no wordplay"}</dd>
              <dt>How it works</dt>
              <dd>{explainOperation(active)}</dd>
              {active.note ? (
                <>
                  <dt>Note</dt>
                  <dd>{active.note}</dd>
                </>
              ) : null}
            </dl>
            {nextOpen ? (
              <button type="button" className="btn" onClick={() => select(nextOpen.id, true)}>
                Next clue
              </button>
            ) : null}
          </section>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmReveal}
        onClose={() => setConfirmReveal(false)}
        title={`Reveal clue ${index + 1}?`}
        body="You will see the answer and the full explanation. This clue will score 0 and the round will be marked as assisted."
        confirmLabel="Reveal the answer"
        onConfirm={reveal}
      />
      <ConfirmDialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        title="Reveal every remaining clue?"
        body="This ends the workshop with a revealed result. Clues you have already solved keep their points."
        confirmLabel="Reveal all remaining"
        onConfirm={() => dispatch({ type: "reveal-all" })}
      />
    </GameShell>
  );
}

function deviceBlurb(d: Device): string {
  const ex = HELP_EXAMPLES.find((e) => e.device === d);
  return ex ? `for example “${ex.clue}” gives ${ex.answer}.` : "";
}
