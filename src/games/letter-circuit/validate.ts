import { rounds } from "./rounds";
import { loadFamiliarSync, loadMembershipSync, loadUncommonSync } from "@/lib/dictionary/node";
import { EXCLUDED_WORDS } from "@/lib/dictionary/exclusions";
import { boardProblem, makeBoard, maskOf, playableWords, searchPar } from "./solver";
import { everydayPool, masterPool } from "./pool";

/**
 * Letter Circuit content checks: four sides of three, twelve distinct A-Z letters; the stored
 * everyday pool (Master pool for Master rounds, which also need three awkward letters, par 3 to 5 and
 * a board the everyday pool cannot finish as quickly) equals the recomputed pool for the board; par and its chain are re-proved by
 * breadth-first search; the par chain is legal (sides, chaining, coverage); pack fixture
 * reference chains are legal and their finite-lexicon optimum is reproduced.
 */
export function validateContent(): string[] {
  const problems: string[] = [];
  const membership = loadMembershipSync();
  const familiar = loadFamiliarSync();
  const pool = everydayPool(familiar, membership);
  const mPool = masterPool(familiar, loadUncommonSync(), membership, EXCLUDED_WORDS);
  const perDifficulty: Record<string, number> = {};
  const seen = new Set<string>();
  const seenSets = new Map<string, string>();
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
    const setKey = letters.slice().sort().join("");
    if (seenSets.has(setKey)) problems.push(`${at("sides")}: same twelve letters as ${seenSets.get(setKey)}`);
    seenSets.set(setKey, meta.id);
    const isMaster = meta.difficulty === "master";
    if (isMaster !== (p.pool === "master")) problems.push(`${at("pool")}: exactly the Master rounds must declare pool "master"`);
    const bands: Record<string, number> = { gentle: 2, standard: 3, expert: 4 };
    if (isMaster) {
      if (p.par < 3 || p.par > 5) problems.push(`${at("par")}: Master rounds need par 3 to 5, got ${p.par}`);
    } else if (meta.status !== "demo" && p.par !== bands[meta.difficulty]) problems.push(`${at("par")}: ${meta.difficulty} rounds need par ${bands[meta.difficulty]}, got ${p.par}`);
    const board = makeBoard(p.sides);
    if (isMaster) {
      const awkward = letters.filter((l) => "JKQVWXZ".includes(l)).length;
      if (awkward < 3) problems.push(`${at("sides")}: Master boards need at least three of J, K, Q, V, W, X, Z (has ${awkward})`);
      // The Master pool must genuinely be needed: the everyday pool alone cannot match Master par.
      const everyday = searchPar(board, playableWords(board, pool, p.minimumWordLength));
      if (everyday.words !== null && everyday.words <= p.par) problems.push(`${at("par")}: the everyday pool already reaches par ${everyday.words}; not a Master board`);
      if (!p.parChain.some((w) => !familiar.has(w))) problems.push(`${at("parChain")}: Master par chain uses only everyday words`);
    }
    const expected = playableWords(board, isMaster ? mPool : pool, p.minimumWordLength).map((e) => e.word);
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
  const minimums: Record<string, number> = { gentle: 12, standard: 12, expert: 18, master: 12 };
  for (const [d, n] of Object.entries(minimums)) if ((perDifficulty[d] ?? 0) < n) problems.push(`fewer than ${n} ${d} rounds`);
  return problems;
}
