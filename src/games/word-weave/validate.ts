import { rounds } from "./rounds";
import { loadFamiliarSync, loadMembershipSync, loadUncommonSync } from "@/lib/dictionary/node";
import { buildBoard, connected, idx, maximalRuns } from "./board";

/**
 * Word Weave content checks: lanes inside the grid; every maximal run of 2+ active squares is
 * exactly one clued lane (no uncued runs, no orphan squares); the lane network is connected;
 * every accepted grid gives each lane an answer of the right length and agrees at every
 * crossing; practice answers are familiar ESDB words; bank lists exactly the answers.
 */
export function validateContent(): string[] {
  const problems: string[] = [];
  const membership = loadMembershipSync();
  const familiar = loadFamiliarSync();
  const uncommon = loadUncommonSync();
  const membershipByLength = new Map<number, string[]>();
  for (const w of membership) {
    if (w.length < 7 || w.length > 9) continue;
    const bucket = membershipByLength.get(w.length);
    if (bucket) bucket.push(w);
    else membershipByLength.set(w.length, [w]);
  }
  const perDifficulty: Record<string, number> = {};
  const seen = new Set<string>();
  const seenAnswers = new Map<string, string>();
  const seenClues = new Map<string, string>();
  for (const { meta, payload: p } of rounds) {
    const at = (f: string) => `${meta.id}.${f}`;
    if (seen.has(meta.id)) problems.push(`${meta.id}: duplicate id`);
    seen.add(meta.id);
    perDifficulty[meta.difficulty] = (perDifficulty[meta.difficulty] ?? 0) + 1;
    if (new Set(p.lanes.map((l) => l.id)).size !== p.lanes.length) problems.push(`${at("lanes")}: duplicate lane ids`);
    p.lanes.forEach((l, i) => {
      const endR = l.direction === "down" ? l.row + l.length - 1 : l.row;
      const endC = l.direction === "across" ? l.col + l.length - 1 : l.col;
      if (l.row < 0 || l.col < 0 || endR >= p.rows || endC >= p.cols) problems.push(`${at(`lanes[${i}]`)}: ${l.id} runs outside the ${p.rows}x${p.cols} grid`);
      if (l.length < 2) problems.push(`${at(`lanes[${i}]`)}: lanes need at least two squares`);
      if (!l.clue.trim()) problems.push(`${at(`lanes[${i}].clue`)}: missing clue`);
    });
    const board = buildBoard(p.rows, p.cols, p.lanes);
    const runs = maximalRuns(board);
    const laneRuns = board.lanes.map((l) => `${l.direction}:${idx(p.cols, l.row, l.col)}:${l.length}`).sort();
    for (const r of runs) if (!laneRuns.includes(r)) problems.push(`${at("lanes")}: uncued run ${r}`);
    for (const r of laneRuns) if (!runs.includes(r)) problems.push(`${at("lanes")}: lane ${r} is not a maximal run`);
    if (!connected(board)) problems.push(`${at("lanes")}: lanes are not all connected`);
    if (!p.acceptedGrids.length) problems.push(`${at("acceptedGrids")}: no accepted grid`);
    p.acceptedGrids.forEach((g, gi) => {
      const cell = new Map<number, string>();
      for (const l of board.lanes) {
        const w = g[l.id];
        if (!w || w.length !== l.length || !/^[A-Z]+$/.test(w)) {
          problems.push(`${at(`acceptedGrids[${gi}].${l.id}`)}: answer ${w} does not fit ${l.length} squares`);
          continue;
        }
        l.cells.forEach((c, i) => {
          if (cell.has(c) && cell.get(c) !== w[i]) problems.push(`${at(`acceptedGrids[${gi}].${l.id}`)}: ${w} disagrees at a crossing (${cell.get(c)} vs ${w[i]})`);
          cell.set(c, w[i]);
        });
        if (meta.status !== "demo") {
          if (!membership.has(w)) problems.push(`${at(`acceptedGrids[${gi}].${l.id}`)}: ${w} not in membership`);
          if (meta.difficulty === "master") {
            if (!familiar.has(w) && !uncommon.has(w)) problems.push(`${at(`acceptedGrids[${gi}].${l.id}`)}: ${w} not in the familiar or uncommon layer`);
          } else if (!familiar.has(w)) problems.push(`${at(`acceptedGrids[${gi}].${l.id}`)}: ${w} not in the familiar (size-35) layer`);
        }
        if ((meta.title ?? "").toUpperCase().includes(w) || meta.id.toUpperCase().includes(w)) problems.push(`${meta.id}: id/title spoils ${w}`);
      }
      for (const k of Object.keys(g)) if (!board.lanes.some((l) => l.id === k)) problems.push(`${at(`acceptedGrids[${gi}]`)}: unknown lane ${k}`);
    });
    if (meta.status !== "demo") {
      for (const w of new Set(p.acceptedGrids.flatMap((g) => Object.values(g)))) {
        if (seenAnswers.has(w)) problems.push(`${at("acceptedGrids")}: ${w} already an answer in ${seenAnswers.get(w)}`);
        seenAnswers.set(w, meta.id);
      }
      for (const l of p.lanes) {
        const k = l.clue.trim().toLowerCase();
        if (seenClues.has(k)) problems.push(`${at(`lanes.${l.id}.clue`)}: clue repeats ${seenClues.get(k)}`);
        seenClues.set(k, meta.id);
      }
    }
    if (meta.difficulty === "master") {
      // Every other membership word that fits a lane's crossing pattern must be listed as reviewed
      // (the clue excludes it); an unlisted fit is an unreviewed ambiguity.
      const ref = p.acceptedGrids[0];
      for (const l of board.lanes) {
        const w = ref[l.id];
        if (!w) continue;
        const fixed = new Map<number, string>();
        l.cells.forEach((c, i) => {
          if ((board.lanesAt.get(c) ?? []).length > 1) fixed.set(i, w[i]);
        });
        const accepted = new Set(p.acceptedGrids.map((g) => g[l.id]));
        const fits = (membershipByLength.get(l.length) ?? []).filter((x) => !accepted.has(x) && [...fixed].every(([i, ch]) => x[i] === ch));
        const listed = new Set(p.reviewedAlternatives?.[l.id] ?? []);
        for (const x of fits) if (!listed.has(x)) problems.push(`${at(`lanes.${l.id}`)}: unreviewed alternative ${x} fits the crossings of ${w}`);
        for (const x of listed) if (!fits.includes(x)) problems.push(`${at(`reviewedAlternatives.${l.id}`)}: ${x} is listed but does not fit`);
      }
      const crossings = board.active.filter((c) => (board.lanesAt.get(c) ?? []).length > 1).length;
      if (p.lanes.length < 8 || p.lanes.length > 12) problems.push(`${meta.id}: master rounds have 8 to 12 lanes`);
      if (crossings < 16) problems.push(`${meta.id}: master rounds need at least 16 crossings (has ${crossings})`);
      if (p.acceptedGrids[0] && Object.values(p.acceptedGrids[0]).filter((w) => w.length >= 7).length < 6) problems.push(`${meta.id}: master rounds need at least six lanes of 7+ letters`);
    }
    if (p.bank) {
      const answers = [...new Set(p.acceptedGrids.flatMap((g) => Object.values(g)))].sort();
      if ([...p.bank].sort().join() !== answers.join()) problems.push(`${at("bank")}: bank must list exactly the answers`);
      if (meta.difficulty !== "gentle") problems.push(`${at("bank")}: word banks are for gentle rounds only`);
    }
    if (meta.status !== "demo") {
      const n = p.lanes.length;
      if (meta.difficulty === "gentle" && (n < 3 || n > 5)) problems.push(`${meta.id}: gentle rounds have 3 to 5 lanes`);
      if (meta.difficulty !== "gentle" && meta.difficulty !== "master" && (n < 6 || n > 10)) problems.push(`${meta.id}: standard and expert rounds have 6 to 10 lanes`);
    }
  }
  for (const d of ["gentle", "standard", "expert"]) if ((perDifficulty[d] ?? 0) < 12) problems.push(`fewer than 12 ${d} rounds`);
  if ((perDifficulty.expert ?? 0) < 18) problems.push("fewer than 18 expert rounds");
  if ((perDifficulty.master ?? 0) < 12) problems.push("fewer than 12 master rounds");
  return problems;
}
