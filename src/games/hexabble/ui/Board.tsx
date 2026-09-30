"use client";

import { memo, type KeyboardEvent, type RefObject } from "react";
import {
  PREMIUM_LABEL,
  allCells,
  cellKey,
  inBoard,
  premiumAt,
  tileById,
  type MatchState,
  type Premium,
} from "../engine";
import type { MatchDraft } from "../engine";

/** Board geometry for rendering only. Legal cells always come from the engine (allCells). */
const COL_W = 45;
const ROW_H = 51.96;
const CELL_W = 58;
const CELL_H = 50.23;
const VIEW_W = 796;
const VIEW_H = 896;
export const BOARD_PX = { width: VIEW_W, height: VIEW_H };

const CELLS = allCells();

function position(q: number, r: number) {
  const x = q * COL_W;
  const y = (r + q / 2) * ROW_H;
  return {
    left: `${(((x + VIEW_W / 2 - CELL_W / 2) / VIEW_W) * 100).toFixed(4)}%`,
    top: `${(((y + VIEW_H / 2 - CELL_H / 2) / VIEW_H) * 100).toFixed(4)}%`,
  };
}

const PREMIUM_SHORT: Record<Premium, string> = { DL: "DL", TL: "TL", DW: "DW", TW: "TW", KEY: "DW", START: "" };

/** Visual rows stay level: from an even column, left/right go up-half; from odd, down-half. */
export function stepCell(q: number, r: number, key: string): [number, number] | null {
  const odd = ((q % 2) + 2) % 2 === 1;
  const moves: Record<string, [number, number]> = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowRight: odd ? [1, 0] : [1, -1],
    ArrowLeft: odd ? [-1, 1] : [-1, 0],
  };
  const m = moves[key];
  if (!m) return null;
  const nq = q + m[0];
  const nr = r + m[1];
  return inBoard(nq, nr) ? [nq, nr] : null;
}

export interface BoardProps {
  state: MatchState;
  draft: MatchDraft;
  cursor: [number, number];
  showDraft: boolean;
  mode: "readable" | "fit";
  boardRef: RefObject<HTMLDivElement | null>;
  onActivate(q: number, r: number): void;
  onCursor(q: number, r: number): void;
  onKey(e: KeyboardEvent<HTMLButtonElement>, q: number, r: number): void;
}

function describe(state: MatchState, draft: MatchDraft, showDraft: boolean, q: number, r: number): { label: string; face: string | null; kind: string | null; value: number | null; status: "placed" | "draft" | "empty" } {
  const k = cellKey(q, r);
  const p = premiumAt(q, r);
  const premium = p ? PREMIUM_LABEL[p] : "plain space";
  const b = state.board[k];
  if (b) {
    const t = tileById(b.tileId)!;
    const what = t.kind === "pivot" ? "Pivot (void)" : t.kind === "letter" ? `${b.letter}` : `${b.letter} (${t.kind === "wild" ? "Wild" : "Key"}, 0 points)`;
    return { label: `Space ${q},${r}: placed tile ${what}, ${premium}`, face: b.letter, kind: t.kind, value: t.kind === "letter" ? t.value : null, status: "placed" };
  }
  const d = showDraft ? draft.placements.find((x) => x.q === q && x.r === r) : undefined;
  if (d) {
    const t = tileById(d.tileId)!;
    const face = t.kind === "letter" ? t.letter : t.kind === "pivot" ? null : d.assigned;
    const what = t.kind === "pivot" ? "Pivot" : t.kind === "letter" ? `${face}` : `${face} (${t.kind === "wild" ? "Wild" : "Key"})`;
    return { label: `Space ${q},${r}: your unsubmitted tile ${what}, ${premium}`, face, kind: t.kind, value: t.kind === "letter" ? t.value : null, status: "draft" };
  }
  return { label: `Space ${q},${r}: empty, ${premium}`, face: null, kind: null, value: null, status: "empty" };
}

function BoardImpl({ state, draft, cursor, showDraft, mode, boardRef, onActivate, onCursor, onKey }: BoardProps) {
  const last = new Set(state.lastMove);
  const cursorKey = cellKey(cursor[0], cursor[1]);
  return (
    <div
      ref={boardRef}
      className="hx-board"
      data-mode={mode}
      role="group"
      aria-label="Hexabble board, 217 spaces. Arrow keys move between spaces; Enter or Space places the selected rack tile; Delete returns an unsubmitted tile; a letter key places a matching rack tile."
      data-testid="hx-board"
    >
      {CELLS.map(([q, r]) => {
        const k = cellKey(q, r);
        const p = premiumAt(q, r);
        const info = describe(state, draft, showDraft, q, r);
        return (
          <button
            key={k}
            type="button"
            className="hx-cell"
            data-cell={k}
            data-premium={p ?? undefined}
            data-status={info.status}
            data-last={last.has(k) ? "true" : undefined}
            tabIndex={k === cursorKey ? 0 : -1}
            aria-label={info.label}
            style={position(q, r)}
            onClick={() => {
              onCursor(q, r);
              onActivate(q, r);
            }}
            onFocus={() => {
              if (k !== cursorKey) onCursor(q, r);
            }}
            onKeyDown={(e) => onKey(e, q, r)}
          >
            <span className="hx-cell-bg" aria-hidden="true">
              {info.status === "empty" ? (
                p === "START" ? (
                  <span className="hx-start">⬡</span>
                ) : p === "KEY" ? (
                  <span className="hx-prem">
                    DW<span className="hx-key">🔑</span>
                  </span>
                ) : p ? (
                  <span className="hx-prem">{PREMIUM_SHORT[p]}</span>
                ) : null
              ) : (
                <span className="hx-tile" data-kind={info.kind ?? undefined}>
                  {info.kind === "pivot" ? (
                    <span className="hx-tile-l">⇄</span>
                  ) : (
                    <>
                      <span className="hx-tile-l">{info.face}</span>
                      {info.value !== null ? <span className="hx-tile-v">{info.value}</span> : <span className="hx-tile-w">{info.kind === "key" ? "KEY" : "WILD"}</span>}
                    </>
                  )}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const Board = memo(BoardImpl);
