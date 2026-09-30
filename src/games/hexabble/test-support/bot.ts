/**
 * TEST-ONLY simple Hexabble bot for seeded match simulation. It is NOT a computer opponent
 * and is never shipped to players.
 *
 * Information discipline: the bot receives only `PublicView` (board, scores, rack sizes, bag
 * count, whose turn) plus its OWN rack. It never sees the bag order or another player's rack.
 */
import {
  DIRS,
  KEY_LOCATIONS,
  NEIGHBOURS,
  RACK_SIZE,
  analyseMove,
  cellKey,
  inBoard,
  nextRandom,
  tileById,
  type Board,
  type MatchAction,
  type MatchState,
  type PlacementInput,
  type ResolvedPlacement,
  type WordList,
} from "../engine";

export interface PublicView {
  board: Board;
  bagCount: number;
  scores: number[];
  rackCounts: number[];
  current: number;
  over: boolean;
}

export function publicView(s: MatchState): PublicView {
  return {
    board: structuredClone(s.board),
    bagCount: s.bag.length,
    scores: s.players.map((p) => p.score),
    rackCounts: s.players.map((p) => p.rack.length),
    current: s.current,
    over: s.over,
  };
}

const FACES = "EASTIO";

export function chooseAction(view: PublicView, rack: readonly string[], dict: WordList, rng: number): { action: MatchAction; rng: number } {
  let seed = rng;
  const rand = () => {
    const n = nextRandom(seed);
    seed = n.state;
    return n.value;
  };
  const tiles = rack.map((id) => tileById(id)!);
  const freeKeys = KEY_LOCATIONS.filter(([q, r]) => !view.board[cellKey(q, r)]);
  const usable = tiles.filter((t) => t.kind === "letter" || t.kind === "wild" || (t.kind === "key" && freeKeys.length === 0));
  const faceOptions = (t: (typeof tiles)[number]) => (t.kind === "letter" ? [null] : FACES.split(""));
  const candidates: PlacementInput[][] = [];

  const hasLetters = Object.values(view.board).some((b) => b.letter !== null);
  if (!hasLetters && !view.board["0,0"]) {
    for (let i = 0; i < usable.length; i++)
      for (let j = 0; j < usable.length; j++)
        if (i !== j)
          for (const fi of faceOptions(usable[i]).slice(0, 2))
            for (const fj of faceOptions(usable[j]).slice(0, 2))
              candidates.push([
                { q: 0, r: 0, tileId: usable[i].id, assigned: fi },
                { q: 0, r: 1, tileId: usable[j].id, assigned: fj },
              ]);
  } else {
    const anchors: [number, number][] = [];
    const seen = new Set<string>();
    for (const [k, b] of Object.entries(view.board)) {
      if (b.letter === null) continue;
      const [q, r] = k.split(",").map(Number);
      for (const [dq, dr] of NEIGHBOURS) {
        const nq = q + dq;
        const nr = r + dr;
        const nk = cellKey(nq, nr);
        if (inBoard(nq, nr) && !view.board[nk] && !seen.has(nk)) {
          seen.add(nk);
          anchors.push([nq, nr]);
        }
      }
    }
    for (const [q, r] of anchors)
      for (const t of usable)
        for (const f of faceOptions(t).slice(0, 3)) candidates.push([{ q, r, tileId: t.id, assigned: f }]);
    // Two-tile lines through an anchor, sampled.
    for (let n = 0; n < 250 && anchors.length && usable.length >= 2; n++) {
      const [q, r] = anchors[Math.floor(rand() * anchors.length)];
      const d = DIRS[Math.floor(rand() * 3)];
      const s = rand() < 0.5 ? 1 : -1;
      const q2 = q + d[0] * s;
      const r2 = r + d[1] * s;
      if (!inBoard(q2, r2) || view.board[cellKey(q2, r2)]) continue;
      const i = Math.floor(rand() * usable.length);
      let j = Math.floor(rand() * (usable.length - 1));
      if (j >= i) j++;
      const fi = faceOptions(usable[i])[0];
      const fj = faceOptions(usable[j])[0];
      candidates.push([
        { q, r, tileId: usable[i].id, assigned: fi },
        { q: q2, r: r2, tileId: usable[j].id, assigned: fj },
      ]);
    }
  }
  // Key islands on free Key spaces.
  const keyTile = tiles.find((t) => t.kind === "key");
  if (keyTile && freeKeys.length) {
    const partner = tiles.filter((t) => t.kind === "letter");
    for (const [q, r] of freeKeys)
      for (const t of partner)
        for (const f of "AEIO") candidates.push([
          { q, r, tileId: keyTile.id, assigned: f },
          { q, r: r + 1, tileId: t.id, assigned: null },
        ]);
  }

  let best: { p: PlacementInput[]; score: number } | null = null;
  for (const c of candidates) {
    const res: ResolvedPlacement[] = c.map((p) => ({ q: p.q, r: p.r, tile: tileById(p.tileId)!, assigned: p.assigned ?? null }));
    if (res.some((p) => !inBoard(p.q, p.r))) continue;
    const a = analyseMove(view.board, res, dict);
    if (a.ok && (!best || a.score > best.score)) best = { p: c, score: a.score };
  }
  if (best) return { action: { type: "play", placements: best.p }, rng: seed };
  if (view.bagCount >= RACK_SIZE) {
    const out = tiles.filter((t) => t.kind === "pivot" || t.kind === "key" || rand() < 0.4).map((t) => t.id);
    return { action: { type: "exchange", tileIds: out.length ? out : [rack[0]] }, rng: seed };
  }
  return { action: { type: "pass" }, rng: seed };
}
