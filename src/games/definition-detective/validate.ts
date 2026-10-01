import { loadFamiliarSync, loadUncommonSync } from "@/lib/dictionary/node";
import { rounds } from "./rounds";

/**
 * Definition Detective content checks (games/definition-detective.md "Automated validators"):
 * three cases per round; exactly four unique definitions and three unique evidence phrases per case
 * with unique ids; correct ids exist; every evidence phrase occurs exactly once in the sentence; the
 * target word appears in the sentence; every wrong definition has a "why not" note; the hint-2
 * distractor is a wrong definition; focus, explanation and Learn more text are present; the Learn more
 * example is a new sentence; no em dashes in user-facing copy; each difficulty has rounds.
 */
export function validateContent(): string[] {
  const problems: string[] = [];
  const perDifficulty: Record<string, number> = {};
  const words = new Map<string, string>();
  const familiar = loadFamiliarSync();
  const uncommon = loadUncommonSync();
  for (const { meta, payload } of rounds) {
    perDifficulty[meta.difficulty] = (perDifficulty[meta.difficulty] ?? 0) + 1;
    if (payload.cases.length !== 3) problems.push(`${meta.id}.cases: expected 3 cases, found ${payload.cases.length}`);
    const caseIds = new Set<string>();
    payload.cases.forEach((c, ci) => {
      const at = (f: string) => `${meta.id}.cases[${ci}].${f}`;
      if (caseIds.has(c.id)) problems.push(`${at("id")}: duplicate case id`);
      caseIds.add(c.id);
      const w = c.word.toLowerCase();
      if (words.has(w)) problems.push(`${at("word")}: ${w} already used in ${words.get(w)}`);
      words.set(w, meta.id);
      if (!c.sentence.toLowerCase().includes(w)) problems.push(`${at("sentence")}: does not contain the target word ${c.word}`);
      if (meta.difficulty === "master" && (!uncommon.has(w.toUpperCase()) || familiar.has(w.toUpperCase()))) problems.push(`${at("word")}: master words must come from the uncommon layer (SCOWL 60 but not 35), ${c.word} does not`);
      if (meta.difficulty === "master" && c.sentence.split(/\s+/).length < 18) problems.push(`${at("sentence")}: master sentences need enough context (18 words at least)`);
      const spans = c.evidence.map((e) => [c.sentence.indexOf(e.text), c.sentence.indexOf(e.text) + e.text.length]);
      if (meta.difficulty === "master" || meta.difficulty === "expert") for (let i = 0; i < spans.length; i++) for (let j = i + 1; j < spans.length; j++) if (spans[i][0] < spans[j][1] && spans[j][0] < spans[i][1]) problems.push(`${at("evidence")}: phrases ${i + 1} and ${j + 1} overlap in the sentence`);
      if (c.definitions.length !== 4) problems.push(`${at("definitions")}: expected exactly 4`);
      if (new Set(c.definitions.map((d) => d.id)).size !== c.definitions.length) problems.push(`${at("definitions")}: duplicate ids`);
      if (new Set(c.definitions.map((d) => d.text.toLowerCase())).size !== c.definitions.length) problems.push(`${at("definitions")}: duplicate texts`);
      if (c.evidence.length !== 3) problems.push(`${at("evidence")}: expected exactly 3`);
      if (new Set(c.evidence.map((e) => e.id)).size !== c.evidence.length) problems.push(`${at("evidence")}: duplicate ids`);
      if (new Set(c.evidence.map((e) => e.text)).size !== c.evidence.length) problems.push(`${at("evidence")}: duplicate texts`);
      c.evidence.forEach((e, ei) => {
        const n = c.sentence.split(e.text).length - 1;
        if (n !== 1) problems.push(`${at(`evidence[${ei}]`)}: "${e.text}" occurs ${n} times in the sentence (must be exactly once)`);
      });
      if (!c.definitions.some((d) => d.id === c.answer.definitionId)) problems.push(`${at("answer.definitionId")}: ${c.answer.definitionId} does not exist`);
      if (!c.evidence.some((e) => e.id === c.answer.evidenceId)) problems.push(`${at("answer.evidenceId")}: ${c.answer.evidenceId} does not exist`);
      for (const d of c.definitions) {
        if (d.id === c.answer.definitionId) continue;
        if (!c.whyNot[d.id] || c.whyNot[d.id].length < 8) problems.push(`${at(`whyNot.${d.id}`)}: missing reason why "${d.text}" fails`);
      }
      if (c.whyNot[c.answer.definitionId]) problems.push(`${at("whyNot")}: the correct definition must not have a why-not note`);
      if (c.eliminate === c.answer.definitionId || !c.definitions.some((d) => d.id === c.eliminate)) problems.push(`${at("eliminate")}: must be a wrong definition id`);
      if (!c.focus || c.focus.length < 8) problems.push(`${at("focus")}: missing pointer hint`);
      const correct = c.evidence.find((e) => e.id === c.answer.evidenceId)?.text ?? "";
      if (correct && c.focus.includes(correct)) problems.push(`${at("focus")}: pointer hint quotes the answer evidence`);
      if (!c.explanation || c.explanation.length < 20) problems.push(`${at("explanation")}: missing`);
      if (!c.learnMore?.definition || !c.learnMore?.example) problems.push(`${at("learnMore")}: needs a definition and an example`);
      if (c.learnMore?.example === c.sentence) problems.push(`${at("learnMore.example")}: must be a new sentence`);
      const copy = [c.sentence, c.focus, c.explanation, c.learnMore?.definition, c.learnMore?.example, ...c.definitions.map((d) => d.text), ...Object.values(c.whyNot)].join(" ");
      if (/—/.test(copy)) problems.push(`${meta.id}.cases[${ci}]: em dash in user-facing copy`);
      if (`${meta.title ?? ""} ${meta.id}`.toLowerCase().includes(w)) problems.push(`${meta.id}: title or id spoils ${w}`);
    });
  }
  const minimum: Record<string, number> = { gentle: 12, standard: 12, expert: 18, master: 12 };
  for (const [d, n] of Object.entries(minimum)) if ((perDifficulty[d] ?? 0) < n) problems.push(`fewer than ${n} ${d} rounds`);
  return problems;
}
