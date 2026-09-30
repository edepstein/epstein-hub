import { rounds } from "./rounds";
import { loadFamiliarSync, loadMembershipSync } from "@/lib/dictionary/node";
import { boardProblem, makeBoard, maskOf, playableWords, searchPar } from "./solver";
import { everydayPool } from "./pool";

/**
 * Letter Circuit content checks: four sides of three, twelve distinct A-Z letters; the stored
 * everyday pool equals the recomputed pool for the board; par and its chain are re-proved by
 * breadth-first search; the par chain is legal (sides, chaining, coverage); pack fixture
 * reference chains are legal and their finite-lexicon optimum is reproduced.
 */
export function validateContent(): string[] {
  const problems: string[] = [];
  const membership = loadMembershipSync();
  const pool = everydayPool(loadFamiliarSync(), membership);
  const perDifficulty: Record<string, number> = {};
  const seen = new Set<string>();
  const checkChain = (at: string, board: ReturnType<typeof makeBoard>, chain: string[], lexicon: ReadonlySet<string>) => {
    let mask = 0;
    chain.forEach((w, i) => {
      if (w.length < 3) problems.push(`${at}[${i}]: ${w} shorter than 3`);
      const p = boardProblem(board, w);
      if (p) problems.push(`${at}[${i}]: ${w} breaks the board (${p.code})`);
      else mask |= maskOf(board, w);
      if (!lexicon.has(w)) problems.push(`${at}[${i}]: ${w} not in the word list`);
      if (i > 0 && chain[i - 1].at(-1) !== w[0]) problems.push(`${at}[${i}]: ${w} does not start with the last letter of ${chain[i - 1]}`);
    });
    if (mask !== board.fullMask) problems.push(`${at}: chain does not use all twelve letters`);
  };
  for (const { meta, payload: p } of rounds) {
    const at = (f: string) => `${meta.id}.${f}`;
    if (seen.has(meta.id)) problems.push(`${meta.id}: duplicate id`);
    seen.add(meta.id);
    perDifficulty[meta.difficulty] = (perDifficulty[meta.difficulty] ?? 0) + 1;
    if (p.sides.length !== 4 || p.sides.some((s) => s.length !== 3)) problems.push(`${at("sides")}: need four sides of three letters`);
    const letters = p.sides.flat();
    if (!letters.every((l) => /^[A-Z]$/.test(l))) problems.push(`${at("sides")}: letters must be single A-Z`);
    if (new Set(letters).size !== 12) problems.push(`${at("sides")}: twelve distinct letters required`);
    const board = makeBoard(p.sides);
    const expected = playableWords(board, pool, p.minimumWordLength).map((e) => e.word);
    const stored = p.parPool.split(" ").filter(Boolean);
    if (expected.join(" ") !== stored.join(" ")) problems.push(`${at("parPool")}: stored pool (${stored.length}) differs from recomputed pool (${expected.length})`);
    const entries = playableWords(board, stored, p.minimumWordLength);
    const par = searchPar(board, entries);
    if (par.words !== p.par) problems.push(`${at("par")}: stored ${p.par}, breadth-first search proves ${par.words}`);
    if (p.parChain.length !== p.par) problems.push(`${at("parChain")}: length ${p.parChain.length} differs from par ${p.par}`);
    checkChain(at("parChain"), board, p.parChain, new Set(stored));
    if (p.fixture) {
      checkChain(at("fixture.referenceChain"), board, p.fixture.referenceChain, new Set(p.fixture.lexicon));
      const fx = searchPar(board, playableWords(board, p.fixture.lexicon, p.minimumWordLength));
      if (fx.words !== p.fixture.optimum) problems.push(`${at("fixture.optimum")}: stored ${p.fixture.optimum}, recomputed ${fx.words}`);
    }
    if (meta.status !== "demo" && p.parChain.some((w) => (meta.title ?? "").toUpperCase().includes(w))) problems.push(`${meta.id}: title spoils the par chain`);
  }
  for (const d of ["gentle", "standard", "expert"]) if ((perDifficulty[d] ?? 0) < 4) problems.push(`fewer than 4 ${d} rounds`);
  return problems;
}
