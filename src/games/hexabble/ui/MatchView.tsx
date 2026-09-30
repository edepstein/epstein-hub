"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent, type PointerEvent, type SetStateAction } from "react";
import {
  EMPTY_DRAFT,
  RACK_SIZE,
  applyAction,
  cellKey,
  needsFace,
  previewMove,
  tileById,
  tileLabel,
  type HistoryEntry,
  type MatchAction,
  type MatchDraft,
  type MatchState,
  type WordList,
} from "../engine";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Board, stepCell } from "./Board";
import { BoardKey, History, MovePreview, PlayerMark, RackTileFace, Results, Scoreboard } from "./panels";
import { readBoardPref, writeBoardPref, type BoardMode } from "./persistence";

export interface Session {
  matchId: string;
  createdAt: string;
  privacy: boolean;
  handover: boolean;
  state: MatchState;
  draft: MatchDraft;
}

interface FeedbackMsg {
  ok: boolean;
  message: string;
  code: string;
  seq: number;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const NO_WORDS: WordList = { has: () => false };

function lastMoveSummary(state: MatchState): string {
  const last = [...state.history].reverse().find((e): e is Exclude<HistoryEntry, { type: "end" }> => e.type !== "end");
  if (!last) return "";
  const name = state.players[last.player].name;
  if (last.type === "play")
    return `Last move: ${name} scored ${last.score} (${last.words
      .filter((w) => w.counted)
      .map((w) => w.text)
      .join(", ")}).`;
  if (last.type === "challenge") return `Last move: ${name}'s word was not allowed, so they lost the turn.`;
  if (last.type === "pass") return `Last move: ${name} passed.`;
  return `Last move: ${name} exchanged ${last.count} tile${last.count === 1 ? "" : "s"}.`;
}

export function MatchView({
  session,
  setSession,
  words,
  wordsStatus,
  onRules,
  onNewMatch,
  onRematch,
}: {
  session: Session;
  setSession: Dispatch<SetStateAction<Session | null>>;
  words: WordList | null;
  wordsStatus: "loading" | "ready" | "error";
  onRules(): void;
  onNewMatch(): void;
  onRematch(): void;
}) {
  const { state, draft } = session;
  const friendly = state.mode === "friendly";
  const current = state.players[state.current];
  const [cursor, setCursor] = useState<[number, number]>([0, 0]);
  const [feedback, setFeedback] = useState<FeedbackMsg | null>(null);
  const [face, setFace] = useState<null | { tileId: string; q: number; r: number; existing: boolean }>(null);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [exchangeSel, setExchangeSel] = useState<string[]>([]);
  const [passOpen, setPassOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [mode, setMode] = useState<BoardMode>("fit");
  const boardRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rackRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    setMode(readBoardPref() ?? (window.innerWidth <= 700 ? "readable" : "fit"));
  }, []);

  const say = useCallback((ok: boolean, message: string, code = ok ? "ok" : "rejected") => {
    seq.current += 1;
    setFeedback({ ok, message, code, seq: seq.current });
  }, []);

  const update = useCallback(
    (fn: (s: Session) => Session) =>
      setSession((prev) => (prev ? fn(prev) : prev)),
    [setSession],
  );
  const setDraft = useCallback((d: MatchDraft) => update((s) => ({ ...s, draft: d })), [update]);

  // ---- derived ----
  const draftIds = useMemo(() => new Set(draft.placements.map((p) => p.tileId)), [draft]);
  const visibleRack = current.rack.filter((id) => !draftIds.has(id));
  const analysis = useMemo(
    () => (draft.placements.length && !state.over ? previewMove(state, draft.placements, friendly ? words : null) : null),
    [state, draft, friendly, words],
  );
  const boardEmpty = Object.keys(state.board).length === 0;
  const showHandover = session.handover && !state.over;

  // ---- centre the readable board ----
  const centre = useCallback(() => {
    const v = viewportRef.current;
    if (!v) return;
    v.scrollLeft = Math.max(0, (v.scrollWidth - v.clientWidth) / 2);
    v.scrollTop = Math.max(0, (v.scrollHeight - v.clientHeight) / 2);
  }, []);
  useEffect(() => {
    if (!showHandover) centre();
  }, [mode, showHandover, centre]);

  // Focus the result heading when a match finishes during play.
  const wasOver = useRef(state.over);
  useEffect(() => {
    if (!wasOver.current && state.over) resultsRef.current?.querySelector<HTMLElement>("#hx-result-heading")?.focus();
    wasOver.current = state.over;
  }, [state.over]);

  // ---- engine dispatch ----
  const dispatch = useCallback(
    (action: MatchAction, opts: { clearDraft: boolean }) => {
      if (action.type === "play" && !words) {
        say(false, "The word list is still loading, so the move cannot be checked yet. Your tiles stay where they are.", "words-loading");
        return false;
      }
      const t = applyAction(state, action, words ?? NO_WORDS);
      if (!t.ok) {
        say(false, t.message, t.code);
        return false;
      }
      const turnPassed = t.state.current !== state.current || t.state.turn !== state.turn;
      update((s) => ({
        ...s,
        state: t.state,
        draft: opts.clearDraft || t.state.over ? EMPTY_DRAFT : s.draft,
        handover: s.privacy && !t.state.over && turnPassed,
      }));
      if (action.type !== "arrange") say(t.code !== "challenged", t.message, t.code);
      return true;
    },
    [state, words, say, update],
  );

  // ---- draft editing ----
  const placeAt = useCallback(
    (q: number, r: number, tileId: string) => {
      const k = cellKey(q, r);
      if (state.board[k] || draft.placements.some((p) => p.q === q && p.r === r)) {
        say(false, "That space is already taken.", "occupied");
        return;
      }
      const t = tileById(tileId);
      if (!t) return;
      if (needsFace(t)) {
        setFace({ tileId, q, r, existing: false });
        return;
      }
      setDraft({ placements: [...draft.placements, { q, r, tileId, assigned: null }], selected: null });
    },
    [state.board, draft, say, setDraft],
  );

  const removeAt = useCallback(
    (q: number, r: number) => {
      const d = draft.placements.find((p) => p.q === q && p.r === r);
      if (!d) return false;
      setDraft({ placements: draft.placements.filter((p) => p !== d), selected: draft.selected });
      say(true, `${tileLabel(tileById(d.tileId)!).split(",")[0]} returned to your rack.`, "recalled-one");
      return true;
    },
    [draft, setDraft, say],
  );

  const activateCell = useCallback(
    (q: number, r: number) => {
      if (state.over || showHandover) return;
      const d = draft.placements.find((p) => p.q === q && p.r === r);
      if (d) {
        const t = tileById(d.tileId)!;
        if (needsFace(t)) setFace({ tileId: d.tileId, q, r, existing: true });
        else removeAt(q, r);
        return;
      }
      if (state.board[cellKey(q, r)]) return;
      if (draft.selected) placeAt(q, r, draft.selected);
      else say(false, "Choose a tile from your rack first, then a space.", "no-selection");
    },
    [state.over, state.board, showHandover, draft, placeAt, removeAt, say],
  );

  const focusCell = useCallback((q: number, r: number) => {
    setCursor([q, r]);
    const el = boardRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${cellKey(q, r)}"]`);
    if (el) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, []);

  const onCellKey = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, q: number, r: number) => {
      const next = stepCell(q, r, e.key);
      if (next) {
        e.preventDefault();
        focusCell(next[0], next[1]);
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        focusCell(0, 0);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activateCell(q, r);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeAt(q, r);
        return;
      }
      if (e.key === "Escape" && draft.selected) {
        e.preventDefault();
        setDraft({ ...draft, selected: null });
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (state.over || showHandover) return;
        const L = e.key.toUpperCase();
        const id =
          visibleRack.find((x) => tileById(x)?.letter === L) ?? visibleRack.find((x) => tileById(x)?.kind === "wild");
        if (!id) {
          say(false, `You have no ${L} tile (or Wild) in your rack.`, "no-such-tile");
          return;
        }
        const t = tileById(id)!;
        if (state.board[cellKey(q, r)] || draft.placements.some((p) => p.q === q && p.r === r)) {
          say(false, "That space is already taken.", "occupied");
          return;
        }
        if (t.kind === "wild") setDraft({ placements: [...draft.placements, { q, r, tileId: id, assigned: L }], selected: null });
        else placeAt(q, r, id);
      }
    },
    [focusCell, activateCell, removeAt, draft, setDraft, state.over, state.board, showHandover, visibleRack, say, placeAt],
  );

  const selectTile = useCallback(
    (id: string, viaKeyboard: boolean) => {
      const selected = draft.selected === id ? null : id;
      setDraft({ ...draft, selected });
      if (selected && viaKeyboard) focusCell(cursor[0], cursor[1]);
    },
    [draft, setDraft, focusCell, cursor],
  );

  // ---- drag from the rack (optional; click and keyboard always work) ----
  const drag = useRef<{ id: string; x0: number; y0: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number } | null>(null);
  const onRackPointerDown = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    if (e.button > 0) return;
    drag.current = { id, x0: e.clientX, y0: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onRackPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 8) return;
    d.moved = true;
    setGhost({ id: d.id, x: e.clientX, y: e.clientY });
  };
  const onRackPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    setGhost(null);
    if (!d || !d.moved) return;
    suppressClick.current = true;
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-cell]");
    if (target) {
      const [q, r] = target.dataset.cell!.split(",").map(Number);
      setCursor([q, r]);
      placeAt(q, r, d.id);
    }
  };

  // ---- turn actions ----
  const submit = () => {
    if (!draft.placements.length) {
      say(false, "Place at least one tile on the board first.", "no-placements");
      return;
    }
    dispatch({ type: "play", placements: draft.placements }, { clearDraft: true });
  };
  const recall = () => {
    if (!draft.placements.length && !draft.selected) return;
    setDraft(EMPTY_DRAFT);
    say(true, "Your tiles are back on your rack.", "recalled");
  };
  const shuffle = () => {
    const ids = current.rack.slice();
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    dispatch({ type: "arrange", tileIds: ids }, { clearDraft: false });
  };
  const reveal = () => {
    update((s) => ({ ...s, handover: false }));
    setTimeout(() => rackRef.current?.querySelector<HTMLButtonElement>("button")?.focus(), 0);
  };

  const exchangeDisabled = state.bag.length < RACK_SIZE;

  // ---- render ----
  const faceTile = face ? tileById(face.tileId) : null;

  return (
    <div className="hx-match" data-testid="hx-match">
      <header className="hx-topbar">
        <div className="hx-brand">
          <svg viewBox="-60 -52 120 104" className="hx-logo-hex small" aria-hidden="true">
            <polygon points="60,0 30,52 -30,52 -60,0 -30,-52 30,-52" />
          </svg>
          HEXABBLE
        </div>
        <p className="hx-turn" data-testid="hx-turn" aria-live="polite">
          {state.over ? (
            <strong>Match over</strong>
          ) : (
            <>
              <PlayerMark index={state.current} /> <strong>{current.name}</strong>&apos;s turn <span className="hx-muted">· move {state.turn}</span>
            </>
          )}
          <span className="hx-mode-pill">{friendly ? "Friendly checking" : "Challenge checking"}</span>
        </p>
        <div className="hx-actions">
          <button type="button" className="hx-btn ghost" onClick={onRules}>
            Rules
          </button>
          <button type="button" className="hx-btn ghost" onClick={() => setEndOpen(true)} disabled={state.over}>
            End game
          </button>
          <button type="button" className="hx-btn danger" onClick={onNewMatch}>
            New match
          </button>
        </div>
      </header>

      <div id="hx-feedback" className="hx-feedback" role="status" aria-live="polite" data-ok={feedback ? String(feedback.ok) : undefined} data-code={feedback?.code} data-testid="feedback">
        {feedback ? <span key={feedback.seq}>{feedback.message}</span> : null}
      </div>

      {showHandover ? (
        <section className="hx-handover" aria-labelledby="hx-hand-title" data-testid="hx-handover">
          <div className="hx-hand-dot" style={{ background: `var(--hx-p${state.current})` }} aria-hidden="true" />
          <h2 id="hx-hand-title">{current.name}&apos;s turn</h2>
          <p>
            {lastMoveSummary(state) || "New match."} Scores:{" "}
            {state.players.map((p) => `${p.name} ${p.score}`).join(", ")}. Make sure only {current.name} can see the screen, then show the tiles.
          </p>
          <button type="button" className="hx-btn primary big" onClick={reveal} autoFocus>
            Show {current.name}&apos;s tiles
          </button>
        </section>
      ) : (
        <div className="hx-layout">
          <div className="hx-board-col">
            {state.over ? (
              <div ref={resultsRef}>
                <Results state={state} onRematch={onRematch} onChangePlayers={onNewMatch} />
              </div>
            ) : null}
            <div className="hx-board-tools">
              <span className="hx-muted small" id="hx-board-mode-label">
                Board size
              </span>
              <div className="hx-seg small" role="group" aria-labelledby="hx-board-mode-label">
                {(["readable", "fit"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => {
                      setMode(m);
                      writeBoardPref(m);
                    }}
                  >
                    {m === "readable" ? "Readable" : "Fit"}
                  </button>
                ))}
              </div>
              <span className="hx-muted small">{mode === "readable" ? "Large letters; scroll the board to see it all." : "The whole board at once; smaller letters."}</span>
            </div>
            <div className="hx-viewport" data-mode={mode} ref={viewportRef} data-testid="hx-viewport">
              <Board
                state={state}
                draft={draft}
                cursor={cursor}
                showDraft
                mode={mode}
                boardRef={boardRef}
                onActivate={activateCell}
                onCursor={(q, r) => setCursor([q, r])}
                onKey={onCellKey}
              />
            </div>
          </div>

          <aside className="hx-side" aria-label="Your rack and move">
            {!state.over ? (
              <section className="hx-panel hx-rack-panel" aria-labelledby="hx-rack-title">
                <div className="hx-rack-head">
                  <h2 id="hx-rack-title">
                    <PlayerMark index={state.current} /> {current.name}&apos;s tiles
                  </h2>
                  <span className="hx-muted small">Rack value {visibleRack.reduce((s, id) => s + (tileById(id)?.kind === "letter" ? tileById(id)!.value : 0), 0)}</span>
                </div>
                <div className="hx-rack" ref={rackRef} role="group" aria-label="Your rack. Select a tile, then a board space." data-testid="hx-rack">
                  {Array.from({ length: RACK_SIZE }, (_, i) => {
                    const id = visibleRack[i];
                    const t = id ? tileById(id) : null;
                    return (
                      <div className="hx-slot" key={i}>
                        {t ? (
                          <button
                            type="button"
                            className="hx-rtile"
                            data-kind={t.kind}
                            data-tile={t.id}
                            aria-pressed={draft.selected === t.id}
                            aria-label={tileLabel(t)}
                            title={tileLabel(t)}
                            onClick={() => {
                              if (suppressClick.current) {
                                suppressClick.current = false;
                                return;
                              }
                              selectTile(t.id, false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                selectTile(t.id, true);
                              }
                            }}
                            onPointerDown={(e) => onRackPointerDown(e, t.id)}
                            onPointerMove={onRackPointerMove}
                            onPointerUp={onRackPointerUp}
                            onPointerCancel={() => {
                              drag.current = null;
                              setGhost(null);
                            }}
                          >
                            <RackTileFace tile={t} />
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <p className="hx-muted small" aria-live="polite">
                  {draft.selected ? `Selected: ${tileLabel(tileById(draft.selected)!)}. Now choose a space.` : "Tip: select a tile, then a space. On the board, a letter key places a matching tile."}
                </p>
                <div className="hx-row">
                  <button type="button" className="hx-btn ghost small" onClick={shuffle}>
                    ⇆ Shuffle
                  </button>
                  <button type="button" className="hx-btn ghost small" onClick={recall} disabled={!draft.placements.length && !draft.selected}>
                    ↶ Recall
                  </button>
                </div>
                <button type="button" className="hx-btn primary big" onClick={submit} disabled={!draft.placements.length || wordsStatus !== "ready"} data-testid="hx-place">
                  Place tiles
                </button>
                <div className="hx-row">
                  <button
                    type="button"
                    className="hx-btn ghost small"
                    onClick={() => {
                      setExchangeSel([]);
                      setExchangeOpen(true);
                    }}
                    disabled={exchangeDisabled}
                    aria-describedby={exchangeDisabled ? "hx-ex-note" : undefined}
                  >
                    Exchange tiles
                  </button>
                  <button type="button" className="hx-btn ghost small" onClick={() => setPassOpen(true)}>
                    Pass turn
                  </button>
                </div>
                {exchangeDisabled ? (
                  <p className="hx-muted small" id="hx-ex-note">
                    Exchanges need at least {RACK_SIZE} tiles in the bag.
                  </p>
                ) : null}
                <MovePreview analysis={analysis} friendly={friendly} hasDraft={draft.placements.length > 0} boardEmpty={boardEmpty} wordsReady={!!words} />
              </section>
            ) : null}
            <Scoreboard state={state} />
            <BoardKey />
          </aside>
          <div className="hx-history-col">
            <History state={state} />
          </div>
        </div>
      )}

      {ghost ? (
        <div className="hx-ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">
          <span className="hx-rtile" data-kind={tileById(ghost.id)?.kind}>
            <RackTileFace tile={tileById(ghost.id)!} />
          </span>
        </div>
      ) : null}

      <Dialog
        open={face !== null}
        onClose={() => setFace(null)}
        title={`Choose a letter for your ${faceTile?.kind === "key" ? "Key" : "Wild"} tile`}
        closeLabel="Cancel"
        actions={
          face?.existing ? (
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                if (face) removeAt(face.q, face.r);
                setFace(null);
              }}
            >
              Return tile to rack
            </button>
          ) : undefined
        }
      >
        <p className="hx-dialog-note">
          {faceTile?.kind === "key"
            ? "A Key tile shows any letter and scores 0. While a Key space is free it must sit on one."
            : "A Wild tile shows any letter and scores 0."}
        </p>
        <div className="hx-letters" role="group" aria-label="Letters">
          {LETTERS.map((l) => (
            <button
              key={l}
              type="button"
              className="hx-letter"
              onClick={() => {
                if (!face) return;
                if (face.existing)
                  setDraft({ ...draft, placements: draft.placements.map((p) => (p.q === face.q && p.r === face.r ? { ...p, assigned: l } : p)) });
                else setDraft({ placements: [...draft.placements, { q: face.q, r: face.r, tileId: face.tileId, assigned: l }], selected: null });
                setFace(null);
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </Dialog>

      <Dialog
        open={exchangeOpen}
        onClose={() => setExchangeOpen(false)}
        title="Exchange tiles"
        closeLabel="Cancel"
        actions={
          <button
            type="button"
            className="btn"
            disabled={!exchangeSel.length}
            onClick={() => {
              const ok = dispatch({ type: "exchange", tileIds: exchangeSel }, { clearDraft: true });
              if (ok) setExchangeOpen(false);
            }}
          >
            Exchange {exchangeSel.length} tile{exchangeSel.length === 1 ? "" : "s"}
          </button>
        }
      >
        <p className="hx-dialog-note">
          Choose the tiles to swap. New tiles are drawn from the bag and yours go back in. This uses your turn and scores nothing.
        </p>
        <div className="hx-exrack" role="group" aria-label="Tiles to exchange">
          {current.rack.map((id) => {
            const t = tileById(id)!;
            const on = exchangeSel.includes(id);
            return (
              <button
                key={id}
                type="button"
                className="hx-rtile"
                data-kind={t.kind}
                aria-pressed={on}
                aria-label={tileLabel(t)}
                onClick={() => setExchangeSel((sel) => (on ? sel.filter((x) => x !== id) : [...sel, id]))}
              >
                <RackTileFace tile={t} />
              </button>
            );
          })}
        </div>
      </Dialog>

      <ConfirmDialog
        open={passOpen}
        onClose={() => setPassOpen(false)}
        title="Pass this turn?"
        body={`You score nothing this turn and any tiles on the board return to your rack. After ${2 * state.players.length} scoreless turns in a row (passes, exchanges or failed challenges) the match ends.`}
        confirmLabel="Pass"
        onConfirm={() => dispatch({ type: "pass" }, { clearDraft: true })}
      />
      <ConfirmDialog
        open={endOpen}
        onClose={() => setEndOpen(false)}
        title="End the match now?"
        body="Use this when you all agree no more good moves can be made. Everyone loses the value of the tiles left on their rack and the highest total wins. This cannot be undone."
        confirmLabel="End the match"
        onConfirm={() => dispatch({ type: "end" }, { clearDraft: true })}
      />
    </div>
  );
}
