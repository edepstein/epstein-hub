/**
 * TEST SUPPORT ONLY. A simple legal-move finder used by seeded full-match simulations in the
 * engine tests. It is not offered as an opponent anywhere in the UI (no pretend bot). It uses only
 * the mover's rack and the public board, never the bag or other racks.
 */
import { analysePlacement, commit, rulesOf, shuffleWith, type MatchState, type Membership, type MoveAction, type Placement } from "./engine";

export function findMove(state: MatchState, words: Membership, candidates: readonly string[], rngSeed: number): Placement[] | null {
  const rules = rulesOf(state);
  const size = rules.boardSize;
  const seat = state.current;
  const rack = state.racks[seat].map((id) => ({ id, letter: state.tiles[id].letter }));
  const empty = state.board.every((c) => c === null);
  const lines: { dr: number; dc: number; r: number; c: number }[] = [];
  for (let i = 0; i < size; i++) {
    lines.push({ dr: 0, dc: 1, r: i, c: 0 });
    lines.push({ dr: 1, dc: 0, r: 0, c: i });
  }
  const [order] = shuffleWith(lines, rngSeed);
  const faceAt = (r: number, c: number) => (r < 0 || c < 0 || r >= size || c >= size ? null : (state.board[r * size + c]?.face ?? null));
  const [cands] = shuffleWith(candidates, rngSeed ^ 0x9e3779b9);
  for (const line of order) {
    for (let start = 0; start < size; start++) {
      const sr = line.r + line.dr * start;
      const sc = line.c + line.dc * start;
      if (faceAt(sr - line.dr, sc - line.dc)) continue; // must not continue a longer word backwards
      for (const w of cands) {
        if (start + w.length > size) continue;
        const er = sr + line.dr * w.length;
        const ec = sc + line.dc * w.length;
        if (faceAt(er, ec)) continue;
        const pool = rack.slice();
        const placements: Placement[] = [];
        let usesBoard = false;
        let ok = true;
        for (let k = 0; k < w.length && ok; k++) {
          const r = sr + line.dr * k;
          const c = sc + line.dc * k;
          const f = faceAt(r, c);
          if (f) {
            if (f !== w[k]) ok = false;
            usesBoard = true;
            continue;
          }
          let idx = pool.findIndex((t) => t.letter === w[k]);
          if (idx < 0) idx = pool.findIndex((t) => t.letter === null);
          if (idx < 0) {
            ok = false;
            continue;
          }
          const t = pool.splice(idx, 1)[0];
          placements.push(t.letter === null ? { tileId: t.id, row: r, column: c, face: w[k] } : { tileId: t.id, row: r, column: c });
        }
        if (!ok || placements.length === 0) continue;
        if (empty && !placements.some((p) => p.row === rules.anchor[0] && p.column === rules.anchor[1])) continue;
        if (!empty && !usesBoard) {
          const touches = placements.some((p) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => faceAt(p.row + dr, p.column + dc)));
          if (!touches) continue;
        }
        if (analysePlacement(state, seat, placements, words).legal) return placements;
      }
    }
  }
  return null;
}

export interface SimulationResult {
  final: MatchState;
  turns: number;
  problems: string[];
  states: MatchState[];
}

/** Play a whole match with the move finder, falling back to exchange then pass. */
export function simulate(start: MatchState, words: Membership, candidates: readonly string[], seed: number, maxTurns = 400): SimulationResult {
  let state = start;
  const states = [state];
  const problems: string[] = [];
  let turns = 0;
  while (state.status === "active" && turns < maxTurns) {
    const seat = state.current;
    const placements = findMove(state, words, candidates, (seed + turns * 7919) >>> 0);
    const rules = rulesOf(state);
    let action: MoveAction;
    if (placements) action = { type: "place", seat, placements };
    else if (state.bag.length >= rules.exchangeAllowedWithBagMinimum) action = { type: "exchange", seat, tileIds: state.racks[seat].slice(0, Math.min(3, state.racks[seat].length)) };
    else action = { type: "pass", seat };
    const r = commit(state, { actionId: `sim-${turns}`, expectedVersion: state.version, action }, words);
    if (r.status !== "accepted") {
      problems.push(`turn ${turns}: ${action.type} rejected (${r.code}: ${r.message})`);
      break;
    }
    state = r.state;
    states.push(state);
    turns++;
  }
  if (state.status !== "finished") problems.push(`match did not finish within ${maxTurns} turns`);
  return { final: state, turns, problems, states };
}
