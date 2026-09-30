"use client";

import {
  BINGO_BONUS,
  DIR_ARROWS,
  RACK_SIZE,
  finalRows,
  tileById,
  tileLabel,
  type AnalysedWord,
  type HistoryEntry,
  type MatchState,
  type MoveAnalysis,
  type Tile,
} from "../engine";

export const PLAYER_COLOURS = ["#ff6b6b", "#4dabf7", "#51cf66", "#fcc419"];
export const PLAYER_SHAPES = ["●", "■", "▲", "◆"];

export function PlayerMark({ index }: { index: number }) {
  return (
    <span className="hx-mark" style={{ color: PLAYER_COLOURS[index] }} aria-hidden="true">
      {PLAYER_SHAPES[index]}
    </span>
  );
}

export function Scoreboard({ state }: { state: MatchState }) {
  return (
    <section className="hx-panel" aria-labelledby="hx-scores">
      <h2 id="hx-scores">Scoreboard</h2>
      <ol className="hx-scores" data-testid="hx-scoreboard">
        {state.players.map((p, i) => {
          const now = i === state.current && !state.over;
          return (
            <li key={i} className="hx-pcard" data-current={now ? "true" : undefined} data-testid={`hx-player-${i}`}>
              <PlayerMark index={i} />
              <span className="hx-pname">
                <strong>{p.name}</strong>
                <small>
                  {now ? "Playing now · " : ""}
                  {p.rack.length} tile{p.rack.length === 1 ? "" : "s"}
                  {state.over && state.winners.includes(i) ? " · winner" : ""}
                </small>
              </span>
              <span className="hx-pscore" data-testid={`hx-score-${i}`} aria-label={`${p.name}: ${p.score} points`}>
                {p.score}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="hx-bag" data-testid="hx-bag">
        <span aria-hidden="true">⬢</span> Tiles in the bag: <strong>{state.bag.length}</strong>
      </p>
    </section>
  );
}

function historyText(e: HistoryEntry, state: MatchState): string {
  if (e.type === "end") return `Match over. ${e.reason}`;
  const name = state.players[e.player]?.name ?? "A player";
  if (e.type === "play") {
    const words = e.words.map((w) => (w.counted ? `${w.text} ${w.score}` : `${w.text} ignored`)).join(", ");
    return `${name} scored ${e.score}: ${words}${e.bingo ? `, plus ${BINGO_BONUS} for all seven tiles` : ""}`;
  }
  if (e.type === "challenge") return `${name} lost the turn. Not allowed: ${(e.invalid.length ? e.invalid : e.words).join(", ")}`;
  if (e.type === "pass") return `${name} passed`;
  return `${name} exchanged ${e.count} tile${e.count === 1 ? "" : "s"}`;
}

export function History({ state }: { state: MatchState }) {
  const items = state.history.map((e, i) => ({ e, i })).reverse();
  return (
    <section className="hx-panel" aria-labelledby="hx-moves">
      <h2 id="hx-moves">Moves</h2>
      {items.length === 0 ? (
        <p className="hx-muted">No moves yet. The first word must cover the centre start space ⬡.</p>
      ) : (
        <ol className="hx-history" data-testid="hx-history" reversed>
          {items.map(({ e, i }) => (
            <li key={i} data-type={e.type} style={{ borderColor: e.type === "end" ? "var(--hx-amber)" : PLAYER_COLOURS[e.player] }}>
              {e.type !== "end" ? <PlayerMark index={e.player} /> : null} {historyText(e, state)}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function wordLine(w: AnalysedWord, friendly: boolean) {
  const kind = w.kind === "main" ? w.dirs.map((d) => DIR_ARROWS[d]).join(" then ") : w.kind === "cross" ? "cross word" : "touch";
  const derivation = w.letters
    .map((l) => `${l.letter || "?"} ${l.value}${l.letterMult > 1 ? `×${l.letterMult}` : ""}`)
    .join(" + ");
  const status = !friendly ? (w.kind === "touch" ? "scores if valid" : "") : w.valid ? "✓ valid" : w.ignored ? "ignored (not a word)" : "✗ not in the word list";
  return (
    <li key={`${w.kind}-${w.cells.map((c) => c.join(",")).join("|")}`} data-ignored={w.ignored ? "true" : undefined} data-valid={w.valid === null ? undefined : String(w.valid)}>
      <span className="hx-wl-head">
        <strong>{w.text}</strong> <span className="hx-muted">{kind}</span>
        <span className="hx-wl-score">{w.ignored ? "0" : w.score}</span>
      </span>
      <span className="hx-wl-derive">
        {derivation} = {w.base}
        {w.wordMult > 1 ? ` × ${w.wordMult} word` : ""}
        {status ? <span className="hx-wl-status"> · {status}</span> : null}
      </span>
    </li>
  );
}

export function MovePreview({
  analysis,
  friendly,
  hasDraft,
  boardEmpty,
  wordsReady,
}: {
  analysis: MoveAnalysis | { ok: false; code: string; placementError: string } | null;
  friendly: boolean;
  hasDraft: boolean;
  boardEmpty: boolean;
  wordsReady: boolean;
}) {
  if (!hasDraft || !analysis)
    return (
      <div className="hx-preview" data-testid="hx-preview">
        <p className="hx-muted">
          Choose a tile from your rack, then a space on the board (or drag it there). Words read down ↓, down-right ↘ or up-right ↗.
          {boardEmpty ? " The first word must cover the centre start space ⬡." : ""}
        </p>
      </div>
    );
  if (analysis.placementError)
    return (
      <div className="hx-preview" data-testid="hx-preview">
        <p className="hx-err">
          <span aria-hidden="true">⚠ </span>
          {analysis.placementError}
        </p>
      </div>
    );
  const a = analysis as MoveAnalysis;
  return (
    <div className="hx-preview" data-testid="hx-preview">
      {friendly && !wordsReady ? <p className="hx-muted">Loading the word list…</p> : null}
      <ul className="hx-words">{a.words.map((w) => wordLine(w, friendly))}</ul>
      {a.bingo ? (
        <p className="hx-bingo">
          All seven tiles: +{BINGO_BONUS}
        </p>
      ) : null}
      {friendly && a.wordErrors.length ? (
        <ul className="hx-errs">
          {a.wordErrors.map((e) => (
            <li key={e} className="hx-err">
              <span aria-hidden="true">✗ </span>
              {e}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="hx-total" data-testid="hx-preview-total">
        <span>{friendly ? "Score for this move" : "Projected score"}</span>
        <strong>{a.score}</strong>
      </p>
      {!friendly ? <p className="hx-muted small">Challenge checking: words are checked when you place them. An invalid word loses the turn.</p> : null}
    </div>
  );
}

export function BoardKey() {
  const items: [string, string, string][] = [
    ["DL", "DL", "Double letter"],
    ["TL", "TL", "Triple letter"],
    ["DW", "DW", "Double word"],
    ["TW", "TW", "Triple word"],
    ["KEY", "🔑", "Key space (double word)"],
    ["START", "⬡", "Centre start (double word)"],
  ];
  return (
    <section className="hx-panel" aria-labelledby="hx-key">
      <h2 id="hx-key">Board key</h2>
      <ul className="hx-legend">
        {items.map(([p, sym, label]) => (
          <li key={p}>
            <span className="hx-sw" data-premium={p} aria-hidden="true">
              {sym}
            </span>
            {label}
          </li>
        ))}
      </ul>
      <p className="hx-muted small">Word multipliers add up: DW + TW is five times. A premium counts only on the turn it is first covered.</p>
    </section>
  );
}

export function RackTileFace({ tile, face }: { tile: Tile; face?: string | null }) {
  if (tile.kind === "letter")
    return (
      <>
        <span className="hx-rt-l">{tile.letter}</span>
        <span className="hx-rt-v">{tile.value}</span>
      </>
    );
  if (tile.kind === "pivot") return <span className="hx-rt-l">⇄</span>;
  return (
    <span className="hx-rt-special">
      {face ? <span className="hx-rt-l">{face}</span> : null}
      <span className="hx-rt-w">{tile.kind === "key" ? "🔑 KEY" : "WILD"}</span>
    </span>
  );
}

export function Results({ state, onRematch, onChangePlayers }: { state: MatchState; onRematch(): void; onChangePlayers(): void }) {
  const rows = finalRows(state).sort((a, b) => b.final - a.final);
  const winners = state.winners.map((i) => state.players[i].name);
  const headline = winners.length > 1 ? `A tie between ${winners.join(" and ")}` : `${winners[0]} wins`;
  return (
    <section className="hx-panel hx-results" aria-labelledby="hx-result-heading" data-testid="hx-results">
      <h2 id="hx-result-heading" tabIndex={-1}>
        Final result: {headline}
      </h2>
      <p>{state.endReason}</p>
      <div className="hx-table-wrap">
        <table className="hx-final">
          <caption className="sr-only">Final scores with unplayed-tile adjustments</caption>
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Play score</th>
              <th scope="col">Unplayed tiles</th>
              <th scope="col">Final</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.index} data-winner={r.winner ? "true" : undefined}>
                <th scope="row">
                  <PlayerMark index={r.index} /> {r.name}
                  {r.winner ? " (winner)" : ""}
                </th>
                <td>{r.playScore}</td>
                <td>
                  {r.adjustment >= 0 ? "+" : ""}
                  {r.adjustment}
                </td>
                <td>
                  <strong>{r.final}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hx-muted small">
        Everyone loses the value of tiles left on their rack. A player who used their last tile with the bag empty gains everyone else&apos;s
        unplayed values.
      </p>
      <div className="hx-row">
        <button type="button" className="hx-btn primary" onClick={onRematch}>
          Play again with the same players
        </button>
        <button type="button" className="hx-btn" onClick={onChangePlayers}>
          Change players or checking mode
        </button>
      </div>
    </section>
  );
}

export function rackTitle(id: string): string {
  const t = tileById(id);
  return t ? tileLabel(t) : id;
}

export const MAX_RACK = RACK_SIZE;
