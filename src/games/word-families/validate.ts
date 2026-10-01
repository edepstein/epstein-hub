import { rawRounds, rounds } from "./rounds";
import { GROUP_SIZE } from "./engine";

const norm = (s: string) => s.normalize("NFC").trim().replace(/\s+/g, " ").toUpperCase();

/**
 * Word Families content checks (mechanical only; semantic uniqueness needs human editors):
 * exact cover (every term in exactly one group, 4 per group), unique normalised labels and ids,
 * group counts per difficulty (Gentle 3 or 4, others 4), display order is a permutation that does
 * not show any group together, explanations present, readable tile length, spoiler-free titles,
 * red-herring notes reference real tiles, and the tutorial fixture is never labelled Expert.
 */
export function validateContent(): string[] {
  const problems: string[] = [];
  const perDifficulty: Record<string, number> = {};
  const ids = new Set<string>();
  rounds.forEach(({ meta, payload: p }, idx) => {
    const raw = rawRounds[idx];
    const at = (f: string) => `${meta.id}.${f}`;
    if (ids.has(meta.id)) problems.push(`${meta.id}: duplicate round id`);
    ids.add(meta.id);
    perDifficulty[meta.difficulty] = (perDifficulty[meta.difficulty] ?? 0) + 1;

    const allowed = meta.difficulty === "gentle" ? [3, 4] : [4];
    if (!allowed.includes(p.groups.length)) problems.push(`${at("groups")}: ${meta.difficulty} needs ${allowed.join(" or ")} groups, found ${p.groups.length}`);
    if (p.terms.length !== p.groups.length * GROUP_SIZE) problems.push(`${at("terms")}: expected ${p.groups.length * GROUP_SIZE} terms, found ${p.terms.length}`);

    const labels = p.terms.map((t) => norm(t.label));
    if (new Set(labels).size !== labels.length) problems.push(`${at("terms")}: two tiles normalise to the same label`);
    if (new Set(p.terms.map((t) => t.id)).size !== p.terms.length) problems.push(`${at("terms")}: duplicate term id`);
    for (const t of p.terms) {
      if (!/^[A-Z][A-Z' -]*[A-Z]$/.test(t.label)) problems.push(`${at("terms")}: "${t.label}" should be upper-case letters (spaces allowed)`);
      const longest = Math.max(...t.label.split(" ").map((w) => w.length));
      if (longest > 10) problems.push(`${at("terms")}: "${t.label}" has a word longer than 10 letters (unreadable on a phone tile)`);
    }

    const seen = new Map<string, string>();
    p.groups.forEach((g, gi) => {
      if (g.termIds.length !== GROUP_SIZE) problems.push(`${at(`groups[${gi}].terms`)}: expected ${GROUP_SIZE}, found ${g.termIds.length}`);
      if (!g.label.trim()) problems.push(`${at(`groups[${gi}].label`)}: missing category label`);
      if (g.explanation.trim().length < 10) problems.push(`${at(`groups[${gi}].explanation`)}: missing explanation`);
      for (const id of g.termIds) {
        if (!p.terms.some((t) => t.id === id)) problems.push(`${at(`groups[${gi}].terms`)}: ${id} is not a tile`);
        if (seen.has(id)) problems.push(`${at(`groups[${gi}].terms`)}: ${id} is also in ${seen.get(id)}`);
        seen.set(id, g.id);
      }
    });
    for (const t of p.terms) if (!seen.has(t.id)) problems.push(`${at("terms")}: ${t.label} belongs to no group`);

    // Display order must be a permutation and never show a whole group in one row of four.
    for (let r = 0; r + GROUP_SIZE <= p.terms.length; r += GROUP_SIZE) {
      const row = p.terms.slice(r, r + GROUP_SIZE).map((t) => t.id).sort().join("|");
      if (p.groups.some((g) => [...g.termIds].sort().join("|") === row)) problems.push(`${at("displayOrder")}: row ${r / GROUP_SIZE + 1} shows a complete group`);
    }
    if (raw.displayOrder && new Set(raw.displayOrder).size !== raw.displayOrder.length) problems.push(`${at("displayOrder")}: repeated term`);

    if (!(p.mistakeBudget >= 1 && p.mistakeBudget <= 8)) problems.push(`${at("mistakeBudget")}: out of range`);
    const onBoard = new Set(p.terms.map((t) => t.label));
    for (const h of p.redHerrings) {
      if (!h.term.endsWith("(not used)") && !onBoard.has(h.term)) problems.push(`${at("redHerrings")}: ${h.term} is not on the board`);
      if (!h.rival.trim() || !h.resolvedBy.trim()) problems.push(`${at("redHerrings")}: ${h.term} needs a rival reading and a resolution`);
    }
    if (meta.difficulty === "expert" && p.redHerrings.filter((h) => onBoard.has(h.term)).length < 3)
      problems.push(`${at("redHerrings")}: expert rounds need at least three documented overlaps`);
    if (meta.difficulty === "standard" && meta.status !== "demo" && p.redHerrings.length < 2) problems.push(`${at("redHerrings")}: standard rounds need documented red herrings`);
    // Regression: the tutorial grouping must never be presented as Expert.
    if (meta.sourceFixtureId === "starter-families" && meta.difficulty !== "gentle") problems.push(`${meta.id}: the tutorial fixture must stay Gentle`);

    const spoil = [...p.groups.map((g) => norm(g.label)), ...labels];
    if (spoil.some((s) => norm(meta.title ?? "").includes(s) || meta.id.toUpperCase().includes(s))) problems.push(`${meta.id}: id/title may spoil an answer`);
    if (!/Gentle|Standard|Expert|Starter|Everyday/.test(meta.title ?? "")) problems.push(`${meta.id}: title should be a neutral round name`);
  });
  const seenLabels = new Map<string, string>();
  for (const { meta, payload: p } of rounds) {
    if (meta.id === "wf-e1") continue; // grandfathered: wf-e1 deliberately reuses plain Trees/Birds beside wordplay groups
    for (const g of p.groups) {
      const k = norm(g.label);
      if (seenLabels.has(k)) problems.push(`${meta.id}: category "${g.label}" is already used in ${seenLabels.get(k)}`);
      else seenLabels.set(k, meta.id);
    }
  }
  for (const d of ["gentle", "standard", "expert"]) if ((perDifficulty[d] ?? 0) < 15) problems.push(`fewer than 15 ${d} rounds`);
  return problems;
}
