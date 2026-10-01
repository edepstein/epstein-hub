/**
 * Cryptic clue model and mechanical construction checks (shared with Daily Crossword's
 * cryptic edition). Everything here is pure: no React, no DOM.
 *
 * A clue is a surface text (without enumeration), an answer (A-Z only), an enumeration,
 * the definition phrase, indicator phrases and a typed construction. `verifyClue` proves
 * what can be proved mechanically (anagram multisets, hidden offsets, reversals, charade
 * concatenation, container positions, deletions, initial letters, phrase positions) and
 * lists what cannot (synonyms, homophones) as editorial checks.
 */

import { ABBREVIATIONS, findPhrase, normaliseLetters, reverse, sortLetters, type Span } from "./clue-text";
import { describeTree, treeLetters, treeOps, treeSources, verifyCompound, type Node } from "./tree";

export { ABBREVIATIONS, findPhrase, normaliseLetters };
export type { Span, Node };

export type Device =
  | "anagram"
  | "hidden"
  | "reversal"
  | "charade"
  | "container"
  | "deletion"
  | "initials"
  | "double-definition"
  | "homophone"
  | "compound"
  | "cryptic-definition";

export const DEVICES: readonly Device[] = [
  "anagram",
  "hidden",
  "reversal",
  "charade",
  "container",
  "deletion",
  "initials",
  "double-definition",
  "homophone",
  "compound",
  "cryptic-definition",
];

export const DEVICE_LABEL: Record<Device, string> = {
  anagram: "Anagram",
  hidden: "Hidden word",
  reversal: "Reversal",
  charade: "Charade",
  container: "Container",
  deletion: "Deletion",
  initials: "Initial letters",
  "double-definition": "Double definition",
  homophone: "Homophone",
  compound: "Compound",
  "cryptic-definition": "Cryptic definition",
};

/** One-sentence explanation of each device, used in hints and the help card. */
export const DEVICE_EXPLAINER: Record<Device, string> = {
  anagram: "the letters of some words in the clue are rearranged",
  hidden: "the answer is spelt out inside consecutive letters of the clue, often across a word break",
  reversal: "a word is written backwards",
  charade: "the answer is built from parts placed one after another",
  container: "one part goes inside another",
  deletion: "a letter is removed from a word",
  initials: "the first letters of some words spell the answer",
  "double-definition": "two separate definitions of the same word sit side by side",
  homophone: "the answer sounds like another word",
  compound: "several operations are nested: the result of one becomes the material for the next",
  "cryptic-definition": "there is no wordplay: the whole clue is one deliberately misleading definition",
};

/** Allowed indicator phrases per device (house list; extend deliberately, with review). */
export const INDICATORS: Record<Device, readonly string[]> = {
  anagram: ["upset", "broken", "mixture", "reorganised", "shift", "moves", "out", "wrecked", "shaken up", "scrambled", "changed", "bent", "around"],
  hidden: ["found in", "hidden in", "served in", "in", "some", "part of", "seen in"],
  reversal: ["returned", "sent back", "turned over", "in reverse", "going back", "back"],
  charade: ["with", "and", "by", "then"],
  container: ["receives", "swallowing", "absorbing", "around", "holding", "taking in"],
  deletion: ["headless", "beheaded"],
  initials: ["initially", "at first", "leaders of"],
  "double-definition": [],
  homophone: ["we hear", "sounds like", "reportedly", "on the radio"],
  compound: [],
  "cryptic-definition": [],
};

export type PartVia = "literal" | "synonym" | "abbreviation" | "anagram" | "reversal";

export interface Part {
  /** Exact words from the clue text that produce this part. */
  source: string;
  /** Letters the part contributes (A-Z). */
  letters: string;
  via: PartVia;
}

export type Construction =
  | { type: "anagram"; fodder: string }
  | { type: "hidden"; fodder: string; start: number }
  | { type: "reversal"; fodder: Part }
  | { type: "charade"; parts: Part[] }
  | { type: "container"; outer: Part; inner: Part; at: number }
  | { type: "deletion"; source: Part; remove: "first" | "last" }
  | { type: "initials"; fodder: string }
  | { type: "double-definition"; second: string }
  | { type: "homophone"; soundsLike: Part; pronunciationNote: string }
  /** Nested operations (anagram inside a charade, a reversed container, ...). See tree.ts. */
  | { type: "compound"; root: Node }
  /** No wordplay: the whole clue is one misleading definition. Flagged honestly to editors and players. */
  | { type: "cryptic-definition" };

export interface CrypticClue {
  /** Surface reading without the enumeration. */
  text: string;
  /** A-Z only, no spaces. */
  answer: string;
  /** Word lengths, e.g. "6" or "4,3". */
  enumeration: string;
  /** Exact phrase from the text; must sit at the start or end. */
  definition: string;
  /** Exact indicator phrases from the text (may be empty for charades and double definitions). */
  indicators: string[];
  construction: Construction;
  /**
   * &lit ("full": the whole clue is both definition and wordplay) or semi-&lit ("semi": the
   * definition runs from one end into the wordplay). Compound clues only.
   */
  lit?: "full" | "semi";
  /** Optional authored remark shown in the explanation. */
  note?: string;
}

export function enumerationLengths(enumeration: string): number[] {
  return enumeration.split(/[,-]/).map((n) => Number(n.trim()));
}

/** Parts that come from clue words, for highlighting the wordplay material. */
export function wordplaySources(c: Construction): string[] {
  switch (c.type) {
    case "anagram":
    case "hidden":
    case "initials":
      return [c.fodder];
    case "reversal":
      return [c.fodder.source];
    case "charade":
      return c.parts.map((p) => p.source);
    case "container":
      return [c.outer.source, c.inner.source];
    case "deletion":
      return [c.source.source];
    case "double-definition":
      return [c.second];
    case "homophone":
      return [c.soundsLike.source];
    case "compound":
      return treeSources(c.root);
    case "cryptic-definition":
      return [];
  }
}

function checkPart(p: Part, where: string, problems: string[], editorial: string[]) {
  const src = normaliseLetters(p.source);
  if (!/^[A-Z]+$/.test(p.letters)) problems.push(`${where}: letters must be A-Z (got "${p.letters}")`);
  switch (p.via) {
    case "literal":
      if (src !== p.letters) problems.push(`${where}: "${p.source}" does not spell ${p.letters}`);
      break;
    case "anagram":
      if (sortLetters(src) !== sortLetters(p.letters)) problems.push(`${where}: ${p.letters} is not an anagram of "${p.source}"`);
      break;
    case "reversal":
      if (reverse(src) !== p.letters) problems.push(`${where}: ${p.letters} is not "${p.source}" reversed`);
      break;
    case "abbreviation": {
      const allowed = ABBREVIATIONS[p.source.toLowerCase()];
      if (!allowed || !allowed.includes(p.letters)) problems.push(`${where}: ${p.letters} for "${p.source}" is not in the house abbreviation list`);
      break;
    }
    case "synonym":
      editorial.push(`${where}: confirm "${p.source}" can mean ${p.letters}`);
      break;
  }
}

export interface ClueCheck {
  /** Mechanical failures: the clue must not ship. */
  problems: string[];
  /** Things only a human editor can confirm (synonyms, homophones, surface, fairness). */
  editorial: string[];
}

/** Letters produced by the wordplay, or null when the device has no letter operation. */
export function wordplayLetters(c: Construction, answerLength: number): string | null {
  switch (c.type) {
    case "anagram":
      return null;
    case "hidden":
      return normaliseLetters(c.fodder).slice(c.start, c.start + answerLength);
    case "reversal":
      return reverse(c.fodder.letters);
    case "charade":
      return c.parts.map((p) => p.letters).join("");
    case "container":
      return c.outer.letters.slice(0, c.at) + c.inner.letters + c.outer.letters.slice(c.at);
    case "deletion":
      return c.remove === "first" ? c.source.letters.slice(1) : c.source.letters.slice(0, -1);
    case "initials":
      return c.fodder
        .split(/\s+/)
        .map((w) => normaliseLetters(w)[0] ?? "")
        .join("");
    case "double-definition":
    case "homophone":
    case "cryptic-definition":
      return null;
    case "compound":
      return treeLetters(c.root);
  }
}

export function verifyClue(clue: CrypticClue, where = "clue"): ClueCheck {
  const problems: string[] = [];
  const editorial: string[] = [];
  const { text, answer, construction: c } = clue;
  if (!/^[A-Z]+$/.test(answer)) problems.push(`${where}.answer: must be A-Z only`);
  const lens = enumerationLengths(clue.enumeration);
  if (lens.some((n) => !Number.isInteger(n) || n < 1)) problems.push(`${where}.enumeration: "${clue.enumeration}" is malformed`);
  else if (lens.reduce((a, b) => a + b, 0) !== answer.length) problems.push(`${where}.enumeration: ${clue.enumeration} does not total ${answer.length} letters`);
  if (/\(\d/.test(text)) problems.push(`${where}.text: must not include the enumeration`);
  if (clue.lit && c.type !== "compound") problems.push(`${where}: only compound clues can be marked &lit`);

  if (c.type === "compound") {
    const r = verifyCompound(clue, c.root, where);
    return { problems: [...problems, ...r.problems], editorial: r.editorial };
  }
  if (c.type === "cryptic-definition") {
    const def = findPhrase(text, clue.definition)[0];
    const stripped = text.replace(/[^A-Za-z]+$/, "");
    const lead = text.length - text.replace(/^[^A-Za-z]+/, "").length;
    if (!def || def.start !== lead || def.end !== stripped.length) problems.push(`${where}: a cryptic definition's definition is the whole clue`);
    if (clue.indicators.length) problems.push(`${where}: a cryptic definition has no indicators`);
    if (normaliseLetters(text).includes(answer)) problems.push(`${where}: the answer appears inside the clue text`);
    editorial.push(`${where}: cryptic definition (no wordplay, so nothing can be machine-checked): confirm the whole clue is a fair, misleading-but-accurate definition of ${answer}`);
    return { problems, editorial };
  }

  // Phrases: definition, indicators and wordplay sources must each appear exactly once, whole-word.
  const spans: { label: string; span: Span }[] = [];
  const locate = (label: string, phrase: string) => {
    const found = findPhrase(text, phrase);
    if (found.length === 0) problems.push(`${where}: ${label} "${phrase}" is not a whole phrase in the clue text`);
    else if (found.length > 1) problems.push(`${where}: ${label} "${phrase}" appears more than once; highlighting would be ambiguous`);
    else spans.push({ label, span: found[0] });
    return found[0];
  };
  const def = locate("definition", clue.definition);
  const stripped = text.replace(/[^A-Za-z]+$/, "");
  const lead = text.length - text.replace(/^[^A-Za-z]+/, "").length;
  if (def && def.start !== lead && def.end !== stripped.length) problems.push(`${where}: definition "${clue.definition}" must be at the start or end of the clue`);
  if (normaliseLetters(clue.definition).includes(answer)) problems.push(`${where}: definition contains the answer itself`);
  for (const ind of clue.indicators) {
    locate("indicator", ind);
    const allowed = INDICATORS[c.type];
    if (!allowed.includes(ind.toLowerCase())) problems.push(`${where}: "${ind}" is not a house ${DEVICE_LABEL[c.type].toLowerCase()} indicator`);
  }
  const needsIndicator = !["charade", "double-definition"].includes(c.type);
  if (needsIndicator && clue.indicators.length === 0) problems.push(`${where}: a ${DEVICE_LABEL[c.type].toLowerCase()} clue needs an indicator`);
  for (const s of wordplaySources(c)) locate("wordplay", s);
  // No two highlighted phrases may overlap.
  const sorted = [...spans].sort((a, b) => a.span.start - b.span.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].span.start < sorted[i - 1].span.end) problems.push(`${where}: ${sorted[i - 1].label} and ${sorted[i].label} overlap`);
  }

  switch (c.type) {
    case "anagram": {
      const f = normaliseLetters(c.fodder);
      if (sortLetters(f) !== sortLetters(answer)) problems.push(`${where}: anagram fodder "${c.fodder}" (${f}) does not use exactly the letters of ${answer}`);
      if (f === answer) problems.push(`${where}: anagram fodder is already the answer`);
      break;
    }
    case "hidden": {
      const f = normaliseLetters(c.fodder);
      if (f.slice(c.start, c.start + answer.length) !== answer) problems.push(`${where}: ${answer} is not at offset ${c.start} of "${c.fodder}" (${f})`);
      if (f === answer || (c.start === 0 && f.length === answer.length)) problems.push(`${where}: hidden fodder must be longer than the answer`);
      // A hidden word should span a word break or sit inside a longer word, never be a whole word.
      const words = c.fodder.split(/\s+/).map(normaliseLetters);
      if (words.includes(answer)) problems.push(`${where}: ${answer} appears as a whole word in the fodder`);
      break;
    }
    case "reversal":
      checkPart(c.fodder, `${where}.fodder`, problems, editorial);
      if (reverse(c.fodder.letters) !== answer) problems.push(`${where}: ${c.fodder.letters} reversed is ${reverse(c.fodder.letters)}, not ${answer}`);
      break;
    case "charade":
      if (c.parts.length < 2) problems.push(`${where}: a charade needs at least two parts`);
      c.parts.forEach((p, i) => checkPart(p, `${where}.parts[${i}]`, problems, editorial));
      if (c.parts.map((p) => p.letters).join("") !== answer) problems.push(`${where}: parts ${c.parts.map((p) => p.letters).join("+")} do not make ${answer}`);
      break;
    case "container": {
      checkPart(c.outer, `${where}.outer`, problems, editorial);
      checkPart(c.inner, `${where}.inner`, problems, editorial);
      if (c.at < 1 || c.at >= c.outer.letters.length) problems.push(`${where}: insertion point ${c.at} must be strictly inside ${c.outer.letters}`);
      const made = c.outer.letters.slice(0, c.at) + c.inner.letters + c.outer.letters.slice(c.at);
      if (made !== answer) problems.push(`${where}: ${c.inner.letters} inside ${c.outer.letters} at ${c.at} gives ${made}, not ${answer}`);
      break;
    }
    case "deletion": {
      checkPart(c.source, `${where}.source`, problems, editorial);
      const made = wordplayLetters(c, answer.length);
      if (made !== answer) problems.push(`${where}: removing the ${c.remove} letter of ${c.source.letters} gives ${made}, not ${answer}`);
      break;
    }
    case "initials": {
      const made = wordplayLetters(c, answer.length);
      if (made !== answer) problems.push(`${where}: initials of "${c.fodder}" spell ${made}, not ${answer}`);
      break;
    }
    case "double-definition":
      editorial.push(`${where}: confirm both "${clue.definition}" and "${c.second}" independently define ${answer}`);
      if (c.second.toLowerCase() === clue.definition.toLowerCase()) problems.push(`${where}: the two definitions are identical`);
      break;
    case "homophone":
      checkPart(c.soundsLike, `${where}.soundsLike`, problems, editorial);
      if (!c.pronunciationNote.trim()) problems.push(`${where}: homophones need a recorded UK pronunciation note`);
      if (c.soundsLike.letters === answer) problems.push(`${where}: homophone source is the answer itself`);
      editorial.push(`${where}: confirm ${answer} and ${c.soundsLike.letters} sound the same in standard UK English (${c.pronunciationNote})`);
      break;
  }
  editorial.push(`${where}: confirm "${clue.definition}" is a fair definition of ${answer} and the surface reads naturally`);
  return { problems, editorial };
}

function describePart(p: Part): string {
  switch (p.via) {
    case "literal":
      return p.letters;
    case "synonym":
      return `${p.letters} ("${p.source}")`;
    case "abbreviation":
      return `${p.letters} (short for "${p.source}")`;
    case "anagram":
      return `${p.letters} ("${p.source}" rearranged)`;
    case "reversal":
      return `${p.letters} ("${p.source}" reversed)`;
  }
}

/** Step-by-step statement of the letter operation, suitable for the solved parse card. */
export function explainOperation(clue: CrypticClue): string {
  const { answer, construction: c } = clue;
  switch (c.type) {
    case "anagram":
      return `Rearrange the letters of ${normaliseLetters(c.fodder)} to make ${answer}.`;
    case "hidden": {
      const f = normaliseLetters(c.fodder);
      const before = f.slice(0, c.start).toLowerCase();
      const after = f.slice(c.start + answer.length).toLowerCase();
      return `${answer} is hidden in "${c.fodder}": ${before}[${answer}]${after}.`;
    }
    case "reversal":
      return `${describePart(c.fodder)} written backwards gives ${answer}.`;
    case "charade":
      return `${c.parts.map(describePart).join(" + ")} = ${answer}.`;
    case "container":
      return `${describePart(c.inner)} goes inside ${describePart(c.outer)}: ${c.outer.letters.slice(0, c.at)}(${c.inner.letters})${c.outer.letters.slice(c.at)} = ${answer}.`;
    case "deletion": {
      const gone = c.remove === "first" ? c.source.letters[0] : c.source.letters.at(-1);
      return `${describePart(c.source)} without its ${c.remove} letter, ${gone}, gives ${answer}.`;
    }
    case "initials":
      return `The first letters of "${c.fodder}" spell ${answer}.`;
    case "double-definition":
      return `"${clue.definition}" and "${c.second}" both mean ${answer}.`;
    case "homophone":
      return `${answer} sounds like ${describePart(c.soundsLike)}. ${c.pronunciationNote}`;
    case "compound":
      return `${describeTree(c.root, answer)}${clue.lit === "full" ? " The whole clue is also the definition (&lit)." : clue.lit === "semi" ? " The definition runs on into the wordplay (semi-&lit)." : ""}`;
    case "cryptic-definition":
      return `There is no wordplay: the whole clue is a cryptic definition of ${answer}.`;
  }
}

/** Stage-4 hint: where the wordplay material is, without giving its letters away. */
export function fodderHint(clue: CrypticClue): string {
  const c = clue.construction;
  const q = (s: string) => `"${s}"`;
  const partHint = (p: Part) => (p.via === "literal" ? `the word ${q(p.source)} itself` : p.via === "abbreviation" ? `a short form of ${q(p.source)}` : `a word for ${q(p.source)}`);
  switch (c.type) {
    case "anagram":
      return `The letters to rearrange are in ${q(c.fodder)}.`;
    case "hidden":
      return `The answer is spelt out inside ${q(c.fodder)}. Read straight across, ignoring spaces.`;
    case "reversal":
      return `Take ${partHint(c.fodder)} and read it backwards.`;
    case "charade":
      return `Join ${c.parts.map(partHint).join(", then ")}.`;
    case "container":
      return `Put ${partHint(c.inner)} inside ${partHint(c.outer)}.`;
    case "deletion":
      return `Take ${partHint(c.source)} and remove its ${c.remove} letter.`;
    case "initials":
      return `Take the first letter of each word in ${q(c.fodder)}.`;
    case "double-definition":
      return `The second definition is ${q(c.second)}. Find one word that fits both.`;
    case "homophone":
      return `The answer sounds like ${partHint(c.soundsLike)}.`;
    case "compound": {
      const srcs = treeSources(c.root).map(q).join(", ");
      return `The wordplay is built from ${srcs}, in more than one step. Work from the inside out: the result of one step becomes the material for the next.`;
    }
    case "cryptic-definition":
      return "There is no wordplay to find: the whole clue is one deliberately misleading definition. Read it again for its other meaning.";
  }
}

/** Each indicator with the kind of operation it signals, for the stage-3 hint. */
export function treeIndicatorKinds(root: Node): [string, string][] {
  const out: [string, string][] = [];
  const kinds: Record<string, string> = {
    anagram: "an anagram",
    container: "a container",
    reversal: "a reversal",
    deletion: "a deletion",
    remove: "something removed",
    select: "a selection of letters",
    hidden: "a hidden word",
    homophone: "a homophone",
    charade: "how two parts are joined",
  };
  const walk = (n: Node): void => {
    switch (n.op) {
      case "part":
        return;
      case "charade":
        if (n.link) out.push([n.link, kinds.charade]);
        n.parts.forEach(walk);
        return;
      case "container":
        out.push([n.indicator, kinds.container]);
        walk(n.outer);
        walk(n.inner);
        return;
      case "reversal":
      case "deletion":
      case "homophone":
        out.push([n.indicator, kinds[n.op]]);
        walk(n.of);
        return;
      case "anagram":
        out.push([n.indicator, kinds.anagram]);
        n.of.forEach(walk);
        return;
      case "remove":
        out.push([n.indicator, kinds.remove]);
        walk(n.from);
        walk(n.take);
        return;
      case "select":
      case "hidden":
        out.push([n.indicator, kinds[n.op]]);
        return;
    }
  };
  walk(root);
  return out;
}

/** Stage-2 text: the device, with a compound clue's operations named. */
export function deviceDetail(clue: CrypticClue): string {
  const c = clue.construction;
  if (c.type === "compound") {
    const lit = clue.lit === "full" ? ", also an &lit (the whole clue is the definition)" : clue.lit === "semi" ? ", also a semi-&lit (the definition runs into the wordplay)" : "";
    return `${DEVICE_LABEL.compound}: ${treeOps(c.root).join(", ")}${lit}`;
  }
  return DEVICE_LABEL[c.type];
}

/** Stage-3 hint text. */
export function indicatorHint(clue: CrypticClue): string {
  const c = clue.construction;
  if (!clue.indicators.length) {
    return c.type === "double-definition"
      ? "There is no indicator: two definitions simply sit side by side."
      : c.type === "cryptic-definition"
        ? "There is no indicator: a cryptic definition has no wordplay to signal."
      : "There is no indicator word: the parts just follow one another.";
  }
  if (c.type === "compound") {
    const named = treeIndicatorKinds(c.root);
    return `${named.map(([ind, kind]) => `"${ind}" signals ${kind}`).join("; ")}.`;
  }
  const list = clue.indicators.map((i) => `"${i}"`).join(" and ");
  return `${list} ${clue.indicators.length > 1 ? "signal" : "signals"} the device: ${DEVICE_EXPLAINER[c.type]}.`;
}

/** Stage-5 hint: roughly a third of the letters (positions 0, 3, 6, ...). */
export function letterPattern(answer: string, enumeration: string): string {
  const lens = enumerationLengths(enumeration);
  const shown = [...answer].map((ch, i) => (i % 3 === 0 ? ch : "·"));
  const words: string[] = [];
  let k = 0;
  for (const n of lens) {
    words.push(shown.slice(k, k + n).join(" "));
    k += n;
  }
  return words.join("  /  ");
}

/** Teaching examples for the help card. They must never be a current round's answer. */
export const HELP_EXAMPLES: { device: Device; clue: string; answer: string; how: string }[] = [
  { device: "anagram", clue: "Friend: tame, in the wild (4)", answer: "MATE", how: "TAME rearranged; \"in the wild\" is the indicator." },
  { device: "hidden", clue: "Fruit in grape arbour (4)", answer: "PEAR", how: "graPE ARbour." },
  { device: "reversal", clue: "Daze nuts, sent back (4)", answer: "STUN", how: "NUTS backwards." },
  { device: "charade", clue: "Young swine: hog allowed (6)", answer: "PIGLET", how: "PIG (hog) + LET (allowed)." },
  { device: "container", clue: "Club holding ring is a vessel (4)", answer: "BOAT", how: "O (ring) inside BAT (club)." },
  { device: "deletion", clue: "Crow headless in argument (3)", answer: "ROW", how: "CROW without its first letter." },
  { device: "initials", clue: "Initially some unusual nights bring sunshine (3)", answer: "SUN", how: "Some Unusual Nights." },
  { device: "double-definition", clue: "Contest for a light (5)", answer: "MATCH", how: "A match is a contest, and a match gives a light." },
  { device: "homophone", clue: "Seven days, we hear, feeble (4)", answer: "WEAK", how: "Sounds like WEEK." },
  { device: "compound", clue: "First appearance: Underground, then day, going back (5)", answer: "DEBUT", how: "Nested operations: TUBE (Underground) + D (day) gives TUBED, which is then reversed. Each result feeds the next." },
  { device: "cryptic-definition", clue: "Something to hold in the dark, if you are brave (6)", answer: "CANDLE", how: "No wordplay: the whole clue is one misleading definition." },
];
