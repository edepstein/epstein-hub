import { rounds } from "./rounds";
import { loadFamiliarSync, loadMembershipSync, loadUncommonSync } from "@/lib/dictionary/node";
import { compoundOf } from "./engine";

/**
 * Missing Links content checks (games/missing-links.md "Automated validators"):
 * - each branch template has exactly one blank (prefix or suffix empty, never both) and a clue;
 * - each accepted link has the enumerated length and substitutes into every branch to give
 *   exactly the stored compound spelling (no added space, no deleted letters);
 * - every compound is a closed form in the pinned membership list (practice rounds);
 * - candidates are unique, of the link length and include the primary link;
 * - an exhaustive search of the membership list finds no other link that completes every
 *   branch unless it is listed as an accepted solution or an explicit rejected alternative;
 * - clues never contain the link, practice rounds meet the per-difficulty shape
 *   (gentle: 3 branches + visible bank; standard: 3 branches, optional bank, mixed directions;
 *   expert: 4 branches, optional bank).
 */
/**
 * Master compounds are drawn from the familiar plus uncommon layers (SCOWL 60). These closed compounds are
 * real, standard words that only appear in the full gameplay list; each was checked by hand and is logged
 * for editorial review in docs/REVIEW-LOG.md. Nothing else outside the two layers may appear in a Master board.
 */
export const MASTER_COMPOUND_ALLOW = new Set(["MUGWORT", "SOAPWORT"]);

export function validateContent(): string[] {
  const problems: string[] = [];
  const membership = loadMembershipSync();
  const layer = new Set<string>([...loadFamiliarSync(), ...loadUncommonSync()]);
  const compoundsSeen = new Map<string, string>();
  const perDifficulty: Record<string, number> = {};
  const links = new Map<string, string>();
  const clues = new Map<string, string>();
  for (const { meta, payload } of rounds) {
    perDifficulty[meta.difficulty] = (perDifficulty[meta.difficulty] ?? 0) + 1;
    const practice = meta.status !== "demo";
    if (!payload.boards.length) problems.push(`${meta.id}.boards: empty`);
    if (practice && payload.boards.length < 3) problems.push(`${meta.id}.boards: practice rounds hold at least three boards`);
    if (practice && meta.difficulty === "gentle" && payload.bank !== "shown") problems.push(`${meta.id}.bank: gentle rounds show the bank`);
    if (practice && meta.difficulty !== "gentle" && payload.bank !== "optional") problems.push(`${meta.id}.bank: ${meta.difficulty} rounds hide the bank`);
    const ids = new Set<string>();
    payload.boards.forEach((b, bi) => {
      const at = (f: string) => `${meta.id}.boards[${bi}].${f}`;
      if (ids.has(b.id)) problems.push(`${at("id")}: duplicate board id`);
      ids.add(b.id);
      const want = practice ? (meta.difficulty === "expert" || meta.difficulty === "master" ? 4 : 3) : 3;
      if (b.branches.length !== want) problems.push(`${at("branches")}: expected ${want} branches, found ${b.branches.length}`);
      const brIds = new Set(b.branches.map((x) => x.id));
      if (brIds.size !== b.branches.length) problems.push(`${at("branches")}: duplicate branch ids`);
      if (!brIds.has(b.hintBranch)) problems.push(`${at("hintBranch")}: ${b.hintBranch} is not a branch`);
      b.branches.forEach((br, ri) => {
        const f = `branches[${ri}]`;
        const blanks = (br.prefix === "" ? 1 : 0) + (br.suffix === "" ? 1 : 0);
        if (blanks !== 1) problems.push(`${at(f)}: template must have exactly one blank (prefix or suffix empty, not both)`);
        if (!/^[A-Z]*$/.test(br.prefix + br.suffix)) problems.push(`${at(f)}: components must be upper-case A-Z with no spaces`);
        if (!br.clue || br.clue.length < 4) problems.push(`${at(f)}.clue: missing definition`);
        if (clues.has(br.clue)) problems.push(`${at(f)}.clue: repeats a clue already used in ${clues.get(br.clue)}`);
        clues.set(br.clue, meta.id);
        if (/—/.test(br.clue)) problems.push(`${at(f)}.clue: em dash in user-facing copy`);
      });
      if (!b.solutions.length) problems.push(`${at("solutions")}: no accepted link`);
      for (const [si, s] of b.solutions.entries()) {
        const f = `solutions[${si}]`;
        if (s.link.length !== b.linkLength) problems.push(`${at(f)}: ${s.link} does not match enumeration ${b.linkLength}`);
        if (!/^[A-Z]+$/.test(s.link)) problems.push(`${at(f)}: ${s.link} must be one upper-case word`);
        for (const br of b.branches) {
          const expected = compoundOf(br, s.link);
          if (s.compounds[br.id] !== expected) problems.push(`${at(f)}.compounds.${br.id}: stored ${s.compounds[br.id]}, substitution gives ${expected}`);
          if (practice && !membership.has(expected)) problems.push(`${at(f)}.compounds.${br.id}: ${expected} is not a closed compound in the word list`);
          if (meta.difficulty === "master" && !layer.has(expected) && !MASTER_COMPOUND_ALLOW.has(expected)) problems.push(`${at(f)}.compounds.${br.id}: master compound ${expected} is outside the familiar and uncommon layers and not on the reviewed allow-list`);
          if (meta.difficulty === "master" || meta.difficulty === "expert") {
            if (compoundsSeen.has(expected)) problems.push(`${at(f)}.compounds.${br.id}: ${expected} already appears in ${compoundsSeen.get(expected)}`);
            compoundsSeen.set(expected, meta.id);
          }
          if (practice && br.clue.toUpperCase().includes(s.link)) problems.push(`${at(`branches.${br.id}.clue`)}: clue contains the link ${s.link}`);
        }
      }
      const cands = b.candidates;
      if (new Set(cands).size !== cands.length) problems.push(`${at("candidates")}: duplicates`);
      if (cands.some((c) => c.length !== b.linkLength)) problems.push(`${at("candidates")}: every candidate must have ${b.linkLength} letters`);
      if (!cands.includes(b.solutions[0]?.link)) problems.push(`${at("candidates")}: must include the primary link`);
      if (cands.length < 4) problems.push(`${at("candidates")}: at least four candidates`);
      if (practice) {
        const accepted = new Set(b.solutions.map((s) => s.link));
        const rejected = new Set((b.rejectedAlternatives ?? []).map((r) => r.link));
        for (const w of membership) {
          if (w.length !== b.linkLength || accepted.has(w) || rejected.has(w)) continue;
          if (b.branches.every((br) => membership.has(compoundOf(br, w))))
            problems.push(`${at("solutions")}: ${w} also completes every branch; accept it or list it in rejectedAlternatives with a reason`);
        }
        const primary = b.solutions[0]?.link;
        if (primary && links.has(primary)) problems.push(`${at("solutions")}: link ${primary} already used in ${links.get(primary)}`);
        if (primary) links.set(primary, meta.id);
      }
      const title = `${meta.title ?? ""} ${meta.id}`.toUpperCase();
      for (const s of b.solutions) if (title.includes(s.link)) problems.push(`${meta.id}: id/title may spoil the link ${s.link}`);
    });
    if (practice && (meta.difficulty === "standard" || meta.difficulty === "expert" || meta.difficulty === "master")) {
      const mixed = payload.boards.some((b) => b.branches.some((br) => br.prefix === "") && b.branches.some((br) => br.suffix === ""));
      if (!mixed) problems.push(`${meta.id}: ${meta.difficulty} rounds need at least one board mixing before and after blanks`);
    }
  }
  const minimum: Record<string, number> = { gentle: 14, standard: 14, expert: 20, master: 12 };
  for (const [d, n] of Object.entries(minimum)) if ((perDifficulty[d] ?? 0) < n) problems.push(`fewer than ${n} ${d} rounds`);
  return problems;
}
