"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { WordListGate } from "@/components/game/WordListGate";
import { LiveFeedback } from "@/components/game/LiveFeedback";
import { RulesView } from "@/components/game/RulesView";
import { SaveIndicator } from "@/components/game/SaveIndicator";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import type { Feedback } from "@/hooks/useGameSession";
import { definition } from "./definition";
import { analysePlacement, rackWordIdeas, rulesOf, type MatchState, type MoveAction, type Placement, type Tile } from "./engine";
import { publicView, type PublicView } from "./protocol";
import { LETTERS, PREMIUM_LABEL, premiumAt, type RulesVersion } from "./rules";
import { compatibleDraft } from "./snapshot";
import { useLocalMatch, type LocalMatch } from "./useLocalMatch";
import { Setup } from "./Setup";
import "./board.css";

/** Match games ignore the round bundle: the route is /play/shared-word-board/match. */
export default function Play() {
  return <WordListGate>{(words) => <MatchApp words={words} />}</WordListGate>;
}

function MatchApp({ words }: { words: ReadonlySet<string> }) {
  const m = useLocalMatch(words);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const style = useMemo(() => ({ "--accent": definition.theme.accent, "--wash": definition.theme.wash }) as CSSProperties, []);
  const st = m.state;

  return (
    <div data-game={definition.id} style={style} className="game-root">
      <div className="hero">
        <div>
          <div className="eyebrow">
            {definition.theme.kicker} <span className="sample-label">· Local pass-and-play · practice preview</span>
          </div>
          <h1>{definition.title}</h1>
          <p>
            {st ? (
              <>
                <strong>{st.players.map((p) => p.name).join(" v ")}</strong> · rules {st.rulesVersion}
                {st.rulesVersion === "1.1-candidate" ? " (proposed, not yet balanced)" : ""} · {definition.tagline}
              </>
            ) : (
              definition.tagline
            )}
          </p>
        </div>
        <span className="badge">Untimed · take your time</span>
      </div>

      <div className="toolbar" role="toolbar" aria-label="Match tools">
        <Link className="text-button" href={`/games/${definition.id}`} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
          About this game
        </Link>
        <button type="button" className="text-button" onClick={() => setRulesOpen(true)}>
          How to play
        </button>
        {st && st.status === "active" ? (
          <button type="button" className="text-button" onClick={() => setLeaveOpen(true)}>
            Leave match
          </button>
        ) : null}
        <SaveIndicator status={m.saveStatus} message={m.saveMessage} />
      </div>

      {m.externalChange ? (
        <div className="wc-banner" data-tone="warn" role="alert">
          This match was changed in another tab or window.
          <span className="spacer" />
          <button type="button" className="btn small" onClick={m.reload}>
            Load the latest match
          </button>
        </div>
      ) : null}
      {m.notice.kind === "restored" && st ? (
        <div className="wc-banner" data-tone="info" data-testid="restored-banner">
          Welcome back. Your match was restored ({m.notice.moves} saved move{m.notice.moves === 1 ? "" : "s"}). Any tiles you had placed but not submitted come back when you show your rack.
        </div>
      ) : null}
      {m.notice.kind === "corrupt" || m.notice.kind === "version-mismatch" ? (
        <div className="wc-banner" data-tone={m.notice.kind === "corrupt" ? "error" : "warn"} role="alert" data-testid="corrupt-banner">
          {m.notice.reason}
        </div>
      ) : null}
      {m.saveStatus === "unavailable" ? (
        <div className="wc-banner" data-tone="warn" data-testid="storage-banner">
          Saving is unavailable in this browser (private mode or blocked storage). You can still play; the match lasts until you leave the page.
        </div>
      ) : null}
      {m.saveStatus === "error" && m.saveMessage ? (
        <div className="wc-banner" data-tone="error" role="alert">
          {m.saveMessage}
        </div>
      ) : null}

      {!m.ready ? (
        <div className="empty" role="status">
          Loading your match…
        </div>
      ) : st ? (
        <MatchTable key={m.envelope?.matchId} m={m} state={st} words={words} />
      ) : (
        <Setup onStart={m.start} />
      )}

      <Dialog open={rulesOpen} onClose={() => setRulesOpen(false)} title={`How to play ${definition.title}`} closeLabel="Back to the match">
        <RulesView rules={definition.rules} />
      </Dialog>
      <ConfirmDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="Leave this match?"
        body="The match stops here without a result and is listed in your library as finished early. A copy is kept on this device. You can then set up a new match."
        confirmLabel="Leave match"
        onConfirm={m.leave}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

const coordText = (r: number, c: number) => `row ${r + 1}, column ${c + 1}`;

function tilePoints(state: MatchState, tile: Tile): number {
  const rules = rulesOf(state);
  return tile.letter === null ? rules.blankScore : (rules.tileScores[tile.letter] ?? 0);
}

function MatchTable({ m, state, words }: { m: LocalMatch; state: MatchState; words: ReadonlySet<string> }) {
  const rules = rulesOf(state);
  const size = rules.boardSize;
  const [revealed, setRevealed] = useState<number | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [rackOrder, setRackOrder] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<number>(rules.anchor[0] * size + rules.anchor[1]);
  const [direction, setDirection] = useState<"across" | "down">("across");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [blankFor, setBlankFor] = useState<{ tileId: string; cell: number } | null>(null);
  const [dialog, setDialog] = useState<null | "exchange" | "pass" | "resign" | "hint">(null);
  const [exchangePick, setExchangePick] = useState<string[]>([]);
  const [zoom, setZoom] = useState(false);
  const squareRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const seq = useRef(0);
  const restoredFrom = useRef(m.envelope?.draft);

  const announce = useCallback((ok: boolean, code: string, message: string) => {
    seq.current += 1;
    setFeedback({ ok, code, message, seq: seq.current });
  }, []);

  const finished = state.status === "finished";
  const seat = state.current;
  const myTurn = !finished && revealed === seat;
  const view: PublicView = publicView(state, myTurn ? seat : -1);

  // Hide the rack whenever the turn moves on (a hint does not end the turn).
  const turnKey = `${state.status}:${state.history.filter((h) => h.kind !== "hint").length}`;
  const lastTurnKey = useRef(turnKey);
  useEffect(() => {
    if (turnKey !== lastTurnKey.current) {
      lastTurnKey.current = turnKey;
      setRevealed(null);
      setPlacements([]);
      setSelected(null);
    }
  }, [turnKey]);

  const reveal = () => {
    const restored = compatibleDraft(state, restoredFrom.current);
    restoredFrom.current = undefined;
    if (restored) {
      setPlacements(restored.placements);
      setRackOrder(restored.rackOrder);
    } else {
      setPlacements([]);
      setRackOrder(state.racks[seat].slice());
    }
    setSelected(null);
    setRevealed(seat);
    setFeedback(null);
  };

  const saveDraft = useCallback(
    (ps: Placement[], order: string[]) => {
      m.setDraft(ps.length || order.length ? { seat, version: state.version, placements: ps, rackOrder: order } : undefined);
    },
    [m, seat, state.version],
  );

  const updatePlacements = (ps: Placement[]) => {
    setPlacements(ps);
    saveDraft(ps, rackOrder);
  };

  const placedIds = new Set(placements.map((p) => p.tileId));
  const rackTiles = (rackOrder.length === state.racks[seat].length ? rackOrder : state.racks[seat]).filter((id) => !placedIds.has(id)).map((id) => state.tiles[id]);
  const draftAt = new Map(placements.map((p) => [p.row * size + p.column, p]));

  const analysis = useMemo(() => (myTurn && placements.length ? analysePlacement(state, seat, placements, words) : null), [myTurn, placements, state, seat, words]);

  const focusCell = (idx: number) => {
    setFocus(idx);
    squareRefs.current[idx]?.focus();
  };

  const placeTile = (tileId: string, cell: number, face?: string) => {
    const tile = state.tiles[tileId];
    if (tile.letter === null && !face) {
      setBlankFor({ tileId, cell });
      return false;
    }
    const p: Placement = { tileId, row: Math.floor(cell / size), column: cell % size, ...(tile.letter === null ? { face } : {}) };
    updatePlacements([...placements.filter((x) => x.tileId !== tileId), p]);
    setSelected(null);
    return true;
  };

  const recallCell = (cell: number) => {
    const d = draftAt.get(cell);
    if (!d) return false;
    updatePlacements(placements.filter((p) => p !== d));
    return true;
  };

  const onSquare = (cell: number) => {
    setFocus(cell);
    if (!myTurn) return;
    if (draftAt.has(cell)) {
      recallCell(cell);
      return;
    }
    if (view.board[cell]) return;
    if (selected) placeTile(selected, cell);
    else announce(false, "choose-tile", "Choose a tile from your rack first, or type its letter.");
  };

  const step = (cell: number, dr: number, dc: number) => {
    const r = Math.floor(cell / size) + dr;
    const c = (cell % size) + dc;
    if (r < 0 || c < 0 || r >= size || c >= size) return cell;
    return r * size + c;
  };

  const onSquareKey = (e: KeyboardEvent<HTMLButtonElement>, cell: number) => {
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[e.key]) {
      e.preventDefault();
      focusCell(step(cell, ...moves[e.key]));
      return;
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const r = Math.floor(cell / size);
      focusCell(r * size + (e.key === "Home" ? 0 : size - 1));
      return;
    }
    if (!myTurn) return;
    const [dr, dc] = direction === "across" ? [0, 1] : [1, 0];
    if (/^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const letter = e.key.toUpperCase();
      if (view.board[cell] || draftAt.has(cell)) {
        announce(false, "square-taken", `${coordText(Math.floor(cell / size), cell % size)} is already filled.`);
        return;
      }
      const tile = rackTiles.find((t) => t.letter === letter) ?? rackTiles.find((t) => t.letter === null);
      if (!tile) {
        announce(false, "letter-not-on-rack", `You have no ${letter} on your rack.`);
        return;
      }
      placeTile(tile.id, cell, tile.letter === null ? letter : undefined);
      // Advance to the next square that is not already filled.
      let next = step(cell, dr, dc);
      while (next !== cell && (view.board[next] || draftAt.has(next))) {
        const after = step(next, dr, dc);
        if (after === next) break;
        next = after;
      }
      focusCell(next);
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      if (recallCell(cell)) return;
      if (e.key === "Backspace") {
        const prev = step(cell, -dr, -dc);
        recallCell(prev);
        focusCell(prev);
      }
    }
  };

  const clearDraft = () => {
    setPlacements([]);
    setSelected(null);
    saveDraft([], rackOrder);
  };

  const submitAction = (action: MoveAction) => {
    const r = m.act(action);
    if (!r) return;
    if (r.status === "accepted") {
      const nextName = r.state.status === "active" ? r.state.players[r.state.current].name : null;
      announce(true, r.code, nextName ? `${r.message} Pass the device to ${nextName}.` : r.message);
      restoredFrom.current = undefined;
    } else {
      announce(false, r.code, r.message);
    }
    return r;
  };

  const submit = () => {
    if (!placements.length) {
      announce(false, "no-tiles", "Place at least one tile from your rack first.");
      return;
    }
    submitAction({ type: "place", seat, placements });
  };

  const shuffle = () => {
    const order = state.racks[seat].slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    setRackOrder(order);
    saveDraft(placements, order);
  };

  const ideas = useMemo(() => (dialog === "hint" && myTurn ? rackWordIdeas(state, seat, words, 8) : []), [dialog, myTurn, state, seat, words]);
  const [shownIdeas, setShownIdeas] = useState<string[] | null>(null);

  const lastMove = state.history.filter((h) => h.kind !== "hint").at(-1);
  const lastMoveText = lastMove ? describeEntry(state, view.history[state.history.indexOf(lastMove)]) : null;

  const board = (
    <div className={`swb-board-wrap${zoom ? " zoomed" : ""}`}>
      <div className="tile-board swb-board" role="group" aria-label={`Board, ${size} by ${size}. Arrow keys move between squares. Type a letter to place it from your rack; Backspace takes it back.`} data-testid="board" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
        {view.board.map((cell, i) => {
          const r = Math.floor(i / size);
          const c = i % size;
          const d = myTurn ? draftAt.get(i) : undefined;
          const premium = premiumAt(rules, r, c);
          const centre = r === rules.anchor[0] && c === rules.anchor[1];
          const draftTile = d ? state.tiles[d.tileId] : null;
          const face = cell ? cell.face : d ? (draftTile!.letter ?? d.face ?? "?") : "";
          const isBlank = cell ? cell.blank : draftTile ? draftTile.letter === null : false;
          const parts = [coordText(r, c)];
          if (centre) parts.push("centre star");
          if (premium) parts.push(`${PREMIUM_LABEL[premium].long}${cell ? " (used)" : ""}`);
          if (cell) parts.push(`${cell.face}${cell.blank ? " (blank)" : ""}`);
          else if (d) parts.push(`${face}${isBlank ? " (blank)" : ""} placed this turn`);
          else parts.push("empty");
          const cls = ["square", cell ? "played" : "", d ? "draft" : "", premium && !cell && !d ? `premium ${premium}` : "", centre && !cell && !d ? "centre" : "", cell && cell.placedAt === state.version && state.version > 0 ? "latest" : ""]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={i}
              ref={(el) => {
                squareRefs.current[i] = el;
              }}
              type="button"
              className={cls}
              tabIndex={i === focus ? 0 : -1}
              aria-label={parts.join(", ")}
              data-cell={`${r}-${c}`}
              onClick={() => onSquare(i)}
              onKeyDown={(e) => onSquareKey(e, i)}
              onFocus={() => setFocus(i)}
            >
              {face ? (
                <>
                  <span className="face">{face}</span>
                  {rules.version !== "1.0" ? <small className="pts">{isBlank ? 0 : (rules.tileScores[face] ?? 0)}</small> : null}
                </>
              ) : premium ? (
                <span className="premium-label">{PREMIUM_LABEL[premium].short}</span>
              ) : centre ? (
                <span className="premium-label" aria-hidden="true">
                  ★
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );

  const scoreboard = (
    <div className="side-section" data-testid="scoreboard">
      <h3>Scores</h3>
      {view.players.map((p) => (
        <div className="stat-row" key={p.seat} data-testid={`score-${p.seat}`} data-current={p.seat === seat && !finished ? "true" : undefined}>
          <span>
            {p.seat === seat && !finished ? <strong>▶ {p.name} (to play)</strong> : p.name}
            {p.resigned ? " · resigned" : ""}
            <br />
            <small>
              {p.rackCount} tile{p.rackCount === 1 ? "" : "s"} on rack
              {p.hintsTaken ? ` · ${p.hintsTaken} hint${p.hintsTaken === 1 ? "" : "s"}` : ""}
            </small>
          </span>
          <strong className="swb-score">{p.score}</strong>
        </div>
      ))}
      <div className="stat-row" data-testid="bag-count">
        <span>Tiles in the bag</span>
        <strong>{view.bagCount}</strong>
      </div>
      <div className="stat-row">
        <span>Passes/exchanges in a row</span>
        <span>
          {view.consecutiveInactive} of {rules.passOrExchangeRoundsToEnd * view.players.filter((p) => !p.resigned).length}
        </span>
      </div>
    </div>
  );

  const history = (
    <div className="side-section">
      <h3>Move history</h3>
      {view.history.length === 0 ? (
        <p style={{ margin: 0 }}>No moves yet.</p>
      ) : (
        <ol className="swb-history" data-testid="history">
          {view.history.map((h, i) => (
            <li key={i}>{describeEntry(state, h)}</li>
          ))}
        </ol>
      )}
    </div>
  );

  return (
    <div className="game-layout">
      <section className="playbox" aria-label={`${definition.title} board`}>
        <div className="board-heading">
          <span>{definition.theme.strap}</span>
          <span className="board-emblem" aria-hidden="true">
            {definition.theme.emblem}
          </span>
        </div>
        <div className="puzzle-stage">
          <p className="swb-turn" data-testid="turn-status">
            {finished ? "The match is over." : myTurn ? `${state.players[seat].name}, it is your turn.` : `Waiting for ${state.players[seat].name} to take the device.`}
          </p>
          {board}
          <div className="swb-board-tools">
            <button type="button" className="text-button small" aria-pressed={direction === "down"} onClick={() => setDirection(direction === "across" ? "down" : "across")}>
              Typing goes {direction === "across" ? "across →" : "down ↓"}
            </button>
            <button type="button" className="text-button small" aria-pressed={zoom} onClick={() => setZoom(!zoom)}>
              {zoom ? "Fit board to screen" : "Bigger squares"}
            </button>
            {rules.premiumCells.length ? (
              <span className="swb-legend">2W double word · 3L triple letter · ★ centre · small number = tile value</span>
            ) : (
              <span className="swb-legend">★ centre · every letter scores 1</span>
            )}
          </div>

          {finished ? (
            <FinalResult state={state} m={m} />
          ) : !myTurn ? (
            <div className="swb-handover" data-testid="handover">
              {lastMoveText ? <p className="swb-last">Last move: {lastMoveText}</p> : null}
              <h2>Pass the device to {state.players[seat].name}</h2>
              <p>Racks stay hidden until the player whose turn it is chooses to show theirs. Other players, please look away.</p>
              <button type="button" className="btn" onClick={reveal}>
                I am {state.players[seat].name}: show my rack
              </button>
            </div>
          ) : (
            <>
              <p className="eyebrow" style={{ marginTop: 18 }}>
                {state.players[seat].name}&apos;s rack · choose a tile, then a square
              </p>
              <div className="letters swb-rack" role="group" aria-label={`${state.players[seat].name}'s rack`} data-testid="rack">
                {rackTiles.length === 0 ? <span className="swb-empty-rack">All your tiles are on the board.</span> : null}
                {rackTiles.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`tile${selected === t.id ? " selected" : ""}`}
                    aria-pressed={selected === t.id}
                    aria-label={`${t.letter ?? "Blank"}, ${tilePoints(state, t)} point${tilePoints(state, t) === 1 ? "" : "s"}`}
                    data-letter={t.letter ?? "?"}
                    onClick={() => setSelected(selected === t.id ? null : t.id)}
                  >
                    {t.letter ?? "?"}
                    {rules.version !== "1.0" ? <small className="pts">{tilePoints(state, t)}</small> : null}
                  </button>
                ))}
              </div>
              <div className="swb-preview" data-testid="move-preview" aria-live="off">
                {!analysis ? (
                  <p>Choose a tile, then an empty square. Or move to a square with the arrow keys and type a letter from your rack.</p>
                ) : analysis.legal ? (
                  <>
                    <p>
                      <strong data-testid="preview-total">This move scores {analysis.score}</strong>
                    </p>
                    <ul>
                      {analysis.words.map((w, i) => (
                        <li key={i}>
                          <strong>{w.word}</strong> ({w.direction}) {w.score}: {w.explanation}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p data-testid="preview-reason">Not ready yet: {analysis.message}</p>
                )}
              </div>
              <div className="swb-actions">
                <button type="button" className="btn" onClick={submit} disabled={!placements.length}>
                  Submit move
                </button>
                <button type="button" className="btn secondary" onClick={clearDraft} disabled={!placements.length}>
                  Recall tiles
                </button>
                <button type="button" className="btn secondary" onClick={shuffle}>
                  Shuffle rack
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    clearDraft();
                    setExchangePick([]);
                    setDialog("exchange");
                  }}
                >
                  Exchange…
                </button>
                <button type="button" className="btn secondary" onClick={() => setDialog("pass")}>
                  Pass…
                </button>
                <button type="button" className="btn secondary" onClick={() => setDialog("hint")}>
                  Word ideas…
                </button>
                <button type="button" className="text-button" onClick={() => setDialog("resign")}>
                  Resign…
                </button>
              </div>
            </>
          )}
        </div>
        <LiveFeedback feedback={feedback} />
      </section>
      <aside className="sidebox" aria-label="Scores and history">
        {scoreboard}
        {history}
        <div className="side-section">
          <h3>This match</h3>
          <p style={{ margin: 0 }}>
            Rules {state.rulesVersion}
            {state.rulesVersion === "1.1-candidate" ? " (proposed premiums and values, not yet balanced)" : " (uniform fixture rules, 32 tiles)"}. Local pass-and-play on this device. Online play needs the server set up.
          </p>
        </div>
        <p style={{ fontSize: ".8rem", color: "var(--muted)" }}>
          Board version {state.version} · words {state.dictionaryVersion}
        </p>
      </aside>

      <Dialog open={blankFor !== null} onClose={() => setBlankFor(null)} title="Choose a letter for the blank" closeLabel="Cancel">
        <p>The blank scores 0 whatever letter it stands for. Its letter is fixed once the move is submitted.</p>
        <div className="swb-letter-grid" role="group" aria-label="Letters">
          {LETTERS.map((l) => (
            <button
              key={l}
              type="button"
              className="tile"
              onClick={() => {
                if (blankFor) placeTile(blankFor.tileId, blankFor.cell, l);
                setBlankFor(null);
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </Dialog>

      <Dialog
        open={dialog === "exchange"}
        onClose={() => setDialog(null)}
        title="Exchange tiles"
        closeLabel="Cancel"
        actions={
          <button
            type="button"
            className="btn"
            disabled={exchangePick.length === 0 || state.bag.length < rules.exchangeAllowedWithBagMinimum}
            onClick={() => {
              setDialog(null);
              submitAction({ type: "exchange", seat, tileIds: exchangePick });
            }}
          >
            Exchange {exchangePick.length} tile{exchangePick.length === 1 ? "" : "s"}
          </button>
        }
      >
        {state.bag.length < rules.exchangeAllowedWithBagMinimum ? (
          <p data-testid="exchange-unavailable">
            Exchanging needs at least {rules.exchangeAllowedWithBagMinimum} tiles in the bag; there {state.bag.length === 1 ? "is" : "are"} {state.bag.length}. You can pass instead.
          </p>
        ) : (
          <>
            <p>Choose the tiles to put back. You draw replacements first, the bag is shuffled, and your turn ends with no score.</p>
            <div className="letters swb-rack" role="group" aria-label="Tiles to exchange">
              {state.racks[seat].map((id) => {
                const t = state.tiles[id];
                const on = exchangePick.includes(id);
                return (
                  <button key={id} type="button" className={`tile${on ? " selected" : ""}`} aria-pressed={on} aria-label={`${t.letter ?? "Blank"}${on ? ", chosen" : ""}`} onClick={() => setExchangePick(on ? exchangePick.filter((x) => x !== id) : [...exchangePick, id])}>
                    {t.letter ?? "?"}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Dialog>

      <ConfirmDialog
        open={dialog === "pass"}
        onClose={() => setDialog(null)}
        title="Pass this turn?"
        body={`You score nothing and keep your tiles. ${state.consecutiveInactive + 1} of ${rules.passOrExchangeRoundsToEnd * view.players.filter((p) => !p.resigned).length} passes or exchanges in a row would end the match.`}
        confirmLabel="Pass"
        onConfirm={() => {
          clearDraft();
          submitAction({ type: "pass", seat });
        }}
      />
      <ConfirmDialog
        open={dialog === "resign"}
        onClose={() => setDialog(null)}
        title={`Resign, ${state.players[seat].name}?`}
        body={
          view.players.filter((p) => !p.resigned).length === 2
            ? "The match ends now and the other player wins. Scores stay as they are, with no final adjustments."
            : "You leave the match and the others carry on. Your score stays as it is, and you cannot win."
        }
        confirmLabel="Resign"
        onConfirm={() => {
          clearDraft();
          submitAction({ type: "resign", seat });
        }}
      />
      <Dialog
        open={dialog === "hint"}
        onClose={() => {
          setDialog(null);
          setShownIdeas(null);
        }}
        title="Word ideas from your rack"
        closeLabel="Back to the board"
        actions={
          shownIdeas === null ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                const r = m.act({ type: "hint", seat });
                if (r?.status === "accepted") {
                  setShownIdeas(ideas);
                  // The hint moved the board version on; keep the draft attached to this turn.
                  m.setDraft(placements.length || rackOrder.length ? { seat, version: r.state.version, placements, rackOrder } : undefined);
                }
                else if (r) announce(false, r.code, r.message);
              }}
            >
              Show word ideas
            </button>
          ) : undefined
        }
      >
        {shownIdeas === null ? (
          <p>This lists up to eight words you could spell from your rack alone. It does not say where they fit. Taking it is recorded as assistance in the match history and result.</p>
        ) : shownIdeas.length ? (
          <ul data-testid="word-ideas">
            {shownIdeas.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : (
          <p data-testid="word-ideas">No words can be spelt from this rack alone. Try building on the board, or exchange.</p>
        )}
      </Dialog>
    </div>
  );
}

function describeEntry(state: MatchState, h: PublicView["history"][number] | undefined): string {
  if (!h) return "";
  const name = state.players[h.seat]?.name ?? `Player ${h.seat + 1}`;
  switch (h.kind) {
    case "place":
      return `${name}: ${h.words.map((w) => `${w.word} ${w.score}`).join(", ")} (total ${h.score})`;
    case "exchange":
      return `${name} exchanged ${h.count} tile${h.count === 1 ? "" : "s"}`;
    case "pass":
      return `${name} passed`;
    case "resign":
      return `${name} resigned`;
    case "hint":
      return `${name} looked at word ideas (assistance)`;
  }
}

function FinalResult({ state, m }: { state: MatchState; m: LocalMatch }) {
  const end = state.end!;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const winners = end.winners.map((s) => state.players[s].name);
  const headline =
    end.reason === "resigned"
      ? `${winners[0]} wins by resignation`
      : winners.length > 1
        ? `A shared win: ${winners.join(" and ")} with ${end.finalScores[end.winners[0]]}`
        : `${winners[0]} wins with ${end.finalScores[end.winners[0]]}`;
  const reason =
    end.reason === "went-out"
      ? `${state.players[end.wentOut!].name} used their last tile with the bag empty.`
      : end.reason === "passes"
        ? "Every player passed or exchanged three times in a row."
        : "The match ended by resignation. Scores are shown as they stood, with no adjustments.";
  const hints = state.hintsTaken.reduce((a, b) => a + b, 0);
  const rulesVersion: RulesVersion = state.rulesVersion;
  return (
    <div className="swb-result" data-testid="final-result">
      <h2 id="result-heading" tabIndex={-1} ref={headingRef}>
        {headline}
      </h2>
      <p>{reason}</p>
      <table className="swb-final">
        <caption className="sr-only">Final scores and adjustments</caption>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Before</th>
            <th scope="col">Tiles left</th>
            <th scope="col">Adjustment</th>
            <th scope="col">Final</th>
          </tr>
        </thead>
        <tbody>
          {state.players.map((p, seat) => {
            const a = end.adjustments[seat];
            return (
              <tr key={seat}>
                <th scope="row">
                  {p.name}
                  {state.resigned[seat] ? " (resigned)" : ""}
                </th>
                <td>{end.finalScores[seat] - a.net}</td>
                <td>{a.leftover.length ? a.leftover.map((l) => (l.blank ? "blank" : l.letter)).join(" ") : "none"}</td>
                <td>{a.net === 0 ? "0" : a.net > 0 ? `+${a.net}${a.bonus ? " (others' tiles)" : ""}` : `${a.net}`}</td>
                <td>
                  <strong>{end.finalScores[seat]}</strong>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ fontSize: ".9rem" }}>
        Rules {rulesVersion} · {state.history.filter((h) => h.kind === "place").length} moves · {hints ? `${hints} word-idea hint${hints === 1 ? "" : "s"} used` : "no hints used"}. This was an unranked local practice match.
      </p>
      <div className="swb-actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            const players = state.players.map((p) => p.name);
            m.leave();
            m.start({ players, rulesVersion });
          }}
        >
          Rematch with the same players
        </button>
        <button type="button" className="btn secondary" onClick={m.leave}>
          Set up a different match
        </button>
      </div>
    </div>
  );
}
