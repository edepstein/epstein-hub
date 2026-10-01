/**
 * Compound clues: a nested construction tree whose every node is recomputed mechanically.
 *
 * A node either produces letters from a clue phrase (a "part") or operates on the letters
 * produced by its children. The checker evaluates the tree bottom-up, so an editor can see that
 * "anagram of X inside a reversed charade" really yields the answer, that every indicator is on
 * the house list for exactly the operation it is used for, that containers and charades read in
 * the order the indicator promises, that anagram fodder is literal clue text (never a synonym),
 * and that no word of the clue is left unaccounted for. What cannot be proved (synonyms,
 * homophones, definitions) is returned as an editorial checklist.
 */
import { ABBREVIATIONS, findPhrase, normaliseLetters, reverse, sortLetters, type Span } from "./clue-text";

export type SelectHow = "initials" | "finals" | "odd" | "even" | "middle" | "edges";
export type DeleteKind = "first" | "last" | "ends" | "middle";

export interface PartNode {
  op: "part";
  /** Exact clue phrase. */
  source: string;
  letters: string;
  via: "literal" | "synonym" | "abbreviation";
}

export type Node =
  | PartNode
  | { op: "charade"; parts: Node[]; /** positional word such as "after" or "before", optional */ link?: string; /** parts are listed in answer order; true when the clue gives them the other way round */ swapped?: boolean }
  | { op: "container"; outer: Node; inner: Node; at: number; indicator: string }
  | { op: "reversal"; of: Node; indicator: string }
  | { op: "anagram"; of: Node[]; letters: string; indicator: string }
  | { op: "deletion"; of: Node; remove: DeleteKind; indicator: string }
  | { op: "remove"; from: Node; take: Node; mode: "contiguous" | "letters"; indicator: string }
  | { op: "select"; source: string; how: SelectHow; indicator: string }
  | { op: "hidden"; fodder: string; letters: string; indicator: string }
  | { op: "homophone"; of: Node; letters: string; note: string; indicator: string };

/** Indicator lists per operation. Ximenean house rules: each phrase must mean exactly that operation. */
export const ANAGRAM_INDICATORS = [
  "upset", "broken", "mixture", "reorganised", "shift", "moves", "out", "wrecked", "shaken up", "scrambled", "changed", "bent", "around",
  "awkward", "awkwardly", "bizarre", "bizarrely", "confused", "crazy", "cooked", "damaged", "dancing", "disturbed", "drunk", "erratic",
  "fancy", "flustered", "garbled", "haphazard", "in a mess", "in pieces", "incorrectly", "jumbled", "mad", "mangled", "messy", "mixed",
  "novel", "odd", "off", "poor", "poorly", "random", "ravaged", "rebuilt", "reformed", "refined", "restless", "revised", "rioting", "rocky",
  "rough", "ruined", "sadly", "smashed", "spilt", "stirred", "strange", "stupidly", "terribly", "tortured", "treated", "troubled",
  "tumbling", "tangled", "turbulent", "unruly", "unusual", "wandering", "wild", "wildly", "woven", "worked", "wrong", "wrongly", "badly",
  "in ruins", "arranged", "rearranged", "organised", "dreadful", "dreadfully", "extraordinary", "variable", "variously", "shuffled",
  "tossed", "twisted", "warped", "wobbly", "shattered", "splintered", "fluid", "engineered", "converted", "manoeuvred", "disorderly",
  "disrupted", "distressed", "excited", "exotic", "freshly", "hybrid", "in motion", "naughty", "reckless", "remodelled", "resolved",
  "reshaped", "revolting", "rotten", "ridiculous", "unsettled", "vandalised", "volatile", "abnormal", "abused", "adapted", "altered",
  "amended", "anyhow", "artful", "ill", "foolish", "loose", "perverse", "rubbish", "sick", "silly", "sorted", "unorthodox", "upturned",
] as const;
export const HIDDEN_INDICATORS = [
  "found in", "hidden in", "served in", "in", "some", "part of", "seen in", "within", "inside", "held in", "from", "among", "amid",
  "contained in", "buried in", "concealed in", "harbouring", "housing", "carrying", "featuring", "displaying", "showing",
  "revealed by", "excerpt from", "extract from", "a piece of", "a bit of", "partly", "partially", "held by", "kept by", "taken from",
  "found within", "sampling", "some of", "a little of", "a part of", "a selection of", "a section of", "embraced by", "caught in",
] as const;
export const REVERSAL_INDICATORS = [
  "returned", "sent back", "turned over", "in reverse", "going back", "back", "reflected", "reversed", "backing", "retiring", "recalled",
  "recalling", "overturned", "upturned", "withdrawn", "withdrawing", "retreating", "returning", "set back", "taken back", "brought back",
  "coming back", "looking back", "in retreat", "backed", "turned back", "reflecting", "revolutionary", "revolutionised", "on reflection",
  "turned round", "round the wrong way", "the wrong way", "going west", "about", "inverted", "flipped", "flipping", "reverted",
] as const;
export const CONTAINER_OUTER_FIRST = [
  "receives", "swallowing", "absorbing", "around", "holding", "taking in", "about", "boxing", "embracing", "containing", "capturing",
  "clutching", "grasping", "grabbing", "gripping", "hugging", "housing", "harbouring", "keeping", "enclosing", "surrounding", "wrapping",
  "wearing", "welcoming", "admitting", "accepting", "entertaining", "engulfing", "devouring", "eating", "consuming", "drinking",
  "ingesting", "pocketing", "sheltering", "trapping", "stopping", "clothing", "dressing", "framing", "bracketing", "flanking",
  "circling", "ringing", "nursing", "carrying", "protecting", "covering", "cradling", "restraining", "imprisoning", "arresting",
  "gathering", "collecting", "has", "having", "swallows", "holds", "takes in", "takes", "hides", "hiding", "concealing", "feeding",
  "bearing", "bagging", "catching", "cuddling", "embraces", "includes", "including", "involving", "lodging", "sporting", "sandwiching",
] as const;
export const CONTAINER_INNER_FIRST = [
  "in", "inside", "within", "entering", "boarding", "penetrating", "going into", "getting into", "held by", "swallowed by", "caught by",
  "captured by", "grabbed by", "gripped by", "hugged by", "embraced by", "taken in by", "absorbed by", "welcomed by", "entertained by",
  "interrupting", "splitting", "dividing", "cutting", "piercing", "breaking", "invading", "occupying", "amid", "amidst", "filling",
  "lodging in", "stuck in", "trapped by", "kept by", "housed in", "boxed in", "lodged in", "hiding in", "going through", "penetrates",
  "enters", "boards", "invades", "pierces", "splits", "occupies", "stops", "sheltering in", "inserted in", "put into", "stuffed in",
  "set in", "placed in", "located in", "caught in", "gets into", "going in", "stuck inside", "tucked into", "wrapped in", "cradled by",
] as const;
export const DELETION_INDICATORS: Record<DeleteKind, readonly string[]> = {
  first: ["headless", "beheaded", "topless", "decapitated", "leaderless", "losing its head", "losing head", "unopened", "without a head", "off the top"],
  last: ["endless", "unfinished", "curtailed", "cut short", "docked", "tailless", "endlessly", "without end", "unending", "unfinishing", "ending early"],
  ends: ["edgeless", "peeled", "shelled", "skinned", "husked", "topped and tailed", "borderless", "stripped of its edges", "trimmed at both ends"],
  middle: ["heartless", "without heart", "losing heart", "disheartened", "coreless", "cored", "gutless", "gutted", "empty-hearted"],
};
export const REMOVE_FROM_FIRST = [
  "without", "losing", "dropping", "missing", "shedding", "minus", "leaving out", "lacking", "short of", "deprived of", "dismissing",
  "discarding", "ejecting", "evicting", "excluding", "omitting", "ignoring", "skipping", "forgoing", "sacking", "firing", "banishing",
  "expelling", "freed of", "free of", "free from", "not having", "shorn of", "stripped of", "relieved of", "rid of", "dispensing with",
  "without any", "less", "bereft of", "devoid of", "needing no", "refusing", "rejecting", "declining", "avoiding",
] as const;
export const REMOVE_TAKE_FIRST = ["leaving", "deserting", "quitting", "exiting", "escaping", "fleeing", "departing", "vacating", "abandons", "leaves", "flees", "quits"] as const;
export const SELECT_INDICATORS: Record<SelectHow, readonly string[]> = {
  initials: [
    "initially", "at first", "leaders of", "heads of", "first of", "openers of", "starts of", "primarily", "at the start", "first sign of",
    "first signs of", "opening", "originally", "to start", "for starters", "head of", "leader of", "start of", "beginning of", "opener of",
    "front of", "first", "firstly", "to begin with", "in the beginning",
  ],
  finals: ["finally", "at last", "ultimately", "tails of", "last of", "closers of", "at the end", "in the end", "end of", "tail of", "back of", "closing", "in conclusion", "lastly", "last", "finishers of", "finish of", "finishes of"],
  odd: ["oddly", "odd bits of", "odd letters of", "odd characters of", "odd parts of", "odds of", "oddments of", "odd pieces of", "oddly enough"],
  even: ["evenly", "even bits of", "even letters of", "even characters of", "even parts of", "evens of", "even pieces of"],
  middle: ["heart of", "centre of", "core of", "middle of", "kernel of", "at heart", "midst of", "nucleus of", "centrally", "essentially", "heartily"],
  edges: ["edges of", "borders of", "extremes of", "limits of", "outskirts of", "extremities of", "boundaries of", "outsides of", "extremely", "shell of", "outer parts of"],
};
export const HOMOPHONE_INDICATORS = [
  "we hear", "sounds like", "reportedly", "on the radio", "they say", "i hear", "we're told", "in conversation", "aloud", "out loud",
  "audibly", "in audition", "for the audience", "broadcast", "overheard", "heard", "announced", "when spoken", "said", "spoken", "as spoken",
  "vocal", "verbally", "orally", "in speech", "by the sound of it", "to the listener", "for the listener", "on the air", "in an address",
  "it's said", "it is said", "we are told", "to the audience", "on the phone", "in the auditorium", "aired", "declared", "uttered",
  "pronounced", "voiced", "recited", "sounding", "to be heard", "as they say",
] as const;
export const CHARADE_JOIN = ["with", "and", "by", "then", "next to", "beside", "alongside", "before", "joining", "meeting", "touching", "adjoining", "adding", "plus", "leading", "ahead of", "preceding", "in front of", "going before", "followed by", "trailed by", "pursued by", "chased by", "tailed by"] as const;
export const CHARADE_SWAP = ["after", "following", "behind", "trailing", "pursuing", "chasing", "succeeding", "coming after", "going after", "tailing", "in pursuit of", "preceded by", "led by"] as const;

/** Words that may sit between a phrase and its indicator. */
export const ADJACENT_WORDS = new Set(["a", "an", "the", "of", "and", "with", "to", "its", "his", "her", "their", "in", "for", "some", "one's", "that"]);
/** Words that may appear in a compound clue without being definition, indicator or material. */
export const LINK_WORDS = new Set([
  "a", "an", "the", "of", "and", "to", "for", "in", "is", "are", "as", "it", "its", "his", "her", "their", "this", "that", "these", "those",
  "with", "by", "on", "at", "from", "so", "then", "thus", "who", "which", "when", "where", "makes", "make", "making", "gives", "give",
  "giving", "produces", "producing", "yields", "yielding", "gets", "get", "getting", "turns", "needs", "needing", "shows", "showing",
  "being", "be", "been", "was", "were", "has", "have", "having", "provides", "providing", "displays", "displaying", "brings", "bringing",
  "becomes", "become", "becoming", "forms", "forming", "results", "resulting", "creates", "creating", "delivers", "delivering", "offers",
  "offering", "supplies", "supplying", "s", "d", "ll", "t", "ve", "re", "m", "that's", "it's", "here's", "there's", "he's", "she's", "what's", "one's", "or", "but", "if", "us",
  "i", "we", "you", "one", "after", "before", "now", "yes", "no", "not", "all", "any", "some", "such", "our", "my", "your", "me", "them",
]);

export type TreeOp = "anagram" | "charade" | "container" | "reversal" | "deletion" | "subtraction" | "selection" | "hidden" | "homophone";

const OP_NAME: Record<Node["op"], string> = {
  part: "part",
  charade: "charade",
  container: "container",
  reversal: "reversal",
  anagram: "anagram",
  deletion: "deletion",
  remove: "subtraction",
  select: "selection of letters",
  hidden: "hidden word",
  homophone: "homophone",
};

const SELECT_NAME: Record<SelectHow, string> = {
  initials: "first letters",
  finals: "last letters",
  odd: "odd-numbered letters",
  even: "even-numbered letters",
  middle: "middle letter(s)",
  edges: "outer letters",
};

export function selectLetters(source: string, how: SelectHow): string {
  const words = source.split(/\s+/).map(normaliseLetters).filter(Boolean);
  const all = words.join("");
  switch (how) {
    case "initials":
      return words.map((w) => w[0]).join("");
    case "finals":
      return words.map((w) => w[w.length - 1]).join("");
    case "odd":
      return [...all].filter((_, i) => i % 2 === 0).join("");
    case "even":
      return [...all].filter((_, i) => i % 2 === 1).join("");
    case "middle": {
      if (all.length < 3) return "";
      const mid = Math.floor(all.length / 2);
      return all.length % 2 ? all[mid] : all.slice(mid - 1, mid + 1);
    }
    case "edges":
      return all.length < 2 ? "" : all[0] + all[all.length - 1];
  }
}

export function deleteLetters(letters: string, kind: DeleteKind): string | null {
  switch (kind) {
    case "first":
      return letters.length >= 2 ? letters.slice(1) : null;
    case "last":
      return letters.length >= 2 ? letters.slice(0, -1) : null;
    case "ends":
      return letters.length >= 3 ? letters.slice(1, -1) : null;
    case "middle": {
      if (letters.length < 3) return null;
      const mid = Math.floor(letters.length / 2);
      return letters.length % 2 ? letters.slice(0, mid) + letters.slice(mid + 1) : letters.slice(0, mid - 1) + letters.slice(mid + 1);
    }
  }
}

export function removeLetters(from: string, take: string, mode: "contiguous" | "letters"): string | null {
  if (mode === "contiguous") {
    const i = from.indexOf(take);
    return i < 0 || !take ? null : from.slice(0, i) + from.slice(i + take.length);
  }
  const chars = [...from];
  for (const ch of take) {
    const i = chars.indexOf(ch);
    if (i < 0) return null;
    chars.splice(i, 1);
  }
  return chars.join("");
}

/** Every clue phrase the tree draws letters from (for highlighting the wordplay material). */
export function treeSources(n: Node): string[] {
  switch (n.op) {
    case "part":
      return [n.source];
    case "charade":
      return n.parts.flatMap(treeSources);
    case "container":
      return [...treeSources(n.outer), ...treeSources(n.inner)];
    case "reversal":
    case "deletion":
    case "homophone":
      return treeSources(n.of);
    case "anagram":
      return n.of.flatMap(treeSources);
    case "remove":
      return [...treeSources(n.from), ...treeSources(n.take)];
    case "select":
      return [n.source];
    case "hidden":
      return [n.fodder];
  }
}

/** Every indicator phrase the tree uses, in tree order. */
export function treeIndicators(n: Node): string[] {
  switch (n.op) {
    case "part":
      return [];
    case "charade":
      return [...(n.link ? [n.link] : []), ...n.parts.flatMap(treeIndicators)];
    case "container":
      return [n.indicator, ...treeIndicators(n.outer), ...treeIndicators(n.inner)];
    case "reversal":
    case "deletion":
    case "homophone":
      return [n.indicator, ...treeIndicators(n.of)];
    case "anagram":
      return [n.indicator, ...n.of.flatMap(treeIndicators)];
    case "remove":
      return [n.indicator, ...treeIndicators(n.from), ...treeIndicators(n.take)];
    case "select":
    case "hidden":
      return [n.indicator];
  }
}

/** Distinct operation names, outermost first. */
export function treeOps(n: Node): string[] {
  const out: string[] = [];
  const walk = (x: Node) => {
    if (x.op !== "part") {
      const name = x.op === "select" ? SELECT_NAME[x.how] === "first letters" ? "initial letters" : "selection of letters" : OP_NAME[x.op];
      if (!out.includes(name)) out.push(name);
    }
    switch (x.op) {
      case "charade":
        x.parts.forEach(walk);
        break;
      case "container":
        walk(x.outer);
        walk(x.inner);
        break;
      case "reversal":
      case "deletion":
      case "homophone":
        walk(x.of);
        break;
      case "anagram":
        x.of.forEach(walk);
        break;
      case "remove":
        walk(x.from);
        walk(x.take);
        break;
    }
  };
  walk(n);
  return out;
}

const countOps = (n: Node): number => {
  switch (n.op) {
    case "part":
      return 0;
    case "charade":
      return 1 + n.parts.reduce((a, p) => a + countOps(p), 0);
    case "container":
      return 1 + countOps(n.outer) + countOps(n.inner);
    case "reversal":
    case "deletion":
    case "homophone":
      return 1 + countOps(n.of);
    case "anagram":
      return 1 + n.of.reduce((a, p) => a + countOps(p), 0);
    case "remove":
      return 1 + countOps(n.from) + countOps(n.take);
    case "select":
    case "hidden":
      return 1;
  }
};

/** Letters a tree produces, without checking anything else (null when an operation is impossible). */
export function treeLetters(n: Node): string | null {
  switch (n.op) {
    case "part":
      return n.letters;
    case "charade": {
      const p = n.parts.map(treeLetters);
      return p.some((x) => x === null) ? null : p.join("");
    }
    case "container": {
      const o = treeLetters(n.outer);
      const i = treeLetters(n.inner);
      return o === null || i === null ? null : o.slice(0, n.at) + i + o.slice(n.at);
    }
    case "reversal": {
      const x = treeLetters(n.of);
      return x === null ? null : reverse(x);
    }
    case "anagram":
    case "homophone":
    case "hidden":
      return n.letters;
    case "deletion": {
      const x = treeLetters(n.of);
      return x === null ? null : deleteLetters(x, n.remove);
    }
    case "remove": {
      const a = treeLetters(n.from);
      const b = treeLetters(n.take);
      return a === null || b === null ? null : removeLetters(a, b, n.mode);
    }
    case "select":
      return selectLetters(n.source, n.how) || null;
  }
}

export interface TreeClueInput {
  text: string;
  answer: string;
  definition: string;
  indicators: string[];
  lit?: "full" | "semi";
}

interface Res {
  letters: string;
  literal: boolean;
  range: Span | null;
}

const union = (rs: (Span | null)[]): Span | null => {
  const ok = rs.filter((r): r is Span => !!r);
  if (!ok.length || ok.length !== rs.length) return null;
  return { start: Math.min(...ok.map((r) => r.start)), end: Math.max(...ok.map((r) => r.end)) };
};

const words = (s: string) => s.toLowerCase().match(/[a-z]+/g) ?? [];

export function verifyCompound(clue: TreeClueInput, root: Node, where: string): { problems: string[]; editorial: string[] } {
  const problems: string[] = [];
  const editorial: string[] = [];
  const { text, answer } = clue;
  const spans: { label: "definition" | "source" | "indicator"; phrase: string; span: Span }[] = [];
  const used: string[] = [];
  const hasHidden = (n: Node): boolean => JSON.stringify(n).includes('"op":"hidden"');

  const locate = (label: "definition" | "source" | "indicator", phrase: string): Span | null => {
    const found = findPhrase(text, phrase);
    if (found.length === 0) {
      problems.push(`${where}: ${label} "${phrase}" is not a whole phrase in the clue text`);
      return null;
    }
    if (found.length > 1) {
      problems.push(`${where}: ${label} "${phrase}" appears more than once; highlighting would be ambiguous`);
      return null;
    }
    spans.push({ label, phrase, span: found[0] });
    return found[0];
  };

  const gapOk = (a: number, b: number) => {
    const w = words(text.slice(a, b));
    return w.every((x) => ADJACENT_WORDS.has(x));
  };
  /** An indicator must touch its operand, allowing only small link words between. */
  const touches = (what: string, ind: Span | null, range: Span | null) => {
    if (!ind || !range) return;
    const ok = ind.end <= range.start ? gapOk(ind.end, range.start) : range.end <= ind.start ? gapOk(range.end, ind.start) : false;
    if (!ok) problems.push(`${where}: ${what} indicator "${text.slice(ind.start, ind.end)}" must sit directly beside what it operates on`);
  };
  const indicator = (phrase: string, list: readonly string[], label: string): Span | null => {
    used.push(phrase.toLowerCase());
    if (!list.includes(phrase.toLowerCase())) problems.push(`${where}: "${phrase}" is not a house ${label} indicator`);
    return locate("indicator", phrase);
  };

  const ev = (n: Node, path: string): Res => {
    switch (n.op) {
      case "part": {
        const range = locate("source", n.source);
        const src = normaliseLetters(n.source);
        if (!/^[A-Z]+$/.test(n.letters)) problems.push(`${path}: letters must be A-Z (got "${n.letters}")`);
        if (n.via === "literal") {
          if (src !== n.letters) problems.push(`${path}: "${n.source}" does not spell ${n.letters}`);
        } else if (n.via === "abbreviation") {
          const allowed = ABBREVIATIONS[n.source.toLowerCase()];
          if (!allowed || !allowed.includes(n.letters)) problems.push(`${path}: ${n.letters} for "${n.source}" is not in the house abbreviation list`);
        } else {
          editorial.push(`${path}: confirm "${n.source}" can mean ${n.letters}`);
        }
        return { letters: n.letters, literal: n.via === "literal", range };
      }
      case "charade": {
        if (n.parts.length < 2) problems.push(`${path}: a charade needs at least two parts`);
        const rs = n.parts.map((p, i) => ev(p, `${path}.parts[${i}]`));
        const link = n.link ? indicator(n.link, n.swapped ? CHARADE_SWAP : CHARADE_JOIN, n.swapped ? "reversed-order charade" : "charade") : null;
        const range = union([...rs.map((r) => r.range), ...(n.link ? [link] : [])]);
        if (n.swapped) {
          if (n.parts.length !== 2) problems.push(`${path}: a reversed-order charade has exactly two parts`);
          if (!n.link) problems.push(`${path}: a reversed-order charade needs its positional word`);
          const a = rs[0]?.range;
          const b = rs[1]?.range;
          if (a && b && link) {
            if (!(b.end <= link.start && link.end <= a.start && gapOk(b.end, link.start) && gapOk(link.end, a.start))) problems.push(`${path}: the clue must give the second part, then "${n.link}", then the first part`);
          }
        } else {
          for (let i = 1; i < rs.length; i++) {
            const a = rs[i - 1].range;
            const b = rs[i].range;
            if (!a || !b) continue;
            if (a.end > b.start) problems.push(`${path}: charade parts must appear in answer order in the clue`);
            else if (link && link.start >= a.end && link.end <= b.start) {
              if (!(gapOk(a.end, link.start) && gapOk(link.end, b.start))) problems.push(`${path}: "${n.link}" must sit directly between its parts`);
            } else if (!gapOk(a.end, b.start)) problems.push(`${path}: charade parts ${i} and ${i + 1} must sit side by side`);
          }
          if (link && !rs.slice(1).some((r, i) => rs[i].range && r.range && link.start >= rs[i].range!.end && link.end <= r.range!.start)) problems.push(`${path}: "${n.link}" must sit between two of its parts`);
        }
        return { letters: rs.map((r) => r.letters).join(""), literal: rs.every((r) => r.literal), range };
      }
      case "container": {
        const o = ev(n.outer, `${path}.outer`);
        const i = ev(n.inner, `${path}.inner`);
        if (n.at < 1 || n.at >= o.letters.length) problems.push(`${path}: insertion point ${n.at} must be strictly inside ${o.letters}`);
        const outerFirst = (CONTAINER_OUTER_FIRST as readonly string[]).includes(n.indicator.toLowerCase());
        const innerFirst = (CONTAINER_INNER_FIRST as readonly string[]).includes(n.indicator.toLowerCase());
        used.push(n.indicator.toLowerCase());
        if (!outerFirst && !innerFirst) problems.push(`${path}: "${n.indicator}" is not a house container indicator`);
        const ind = locate("indicator", n.indicator);
        if (ind && o.range && i.range) {
          if (outerFirst) {
            if (!(o.range.end <= ind.start && ind.end <= i.range.start && gapOk(o.range.end, ind.start) && gapOk(ind.end, i.range.start))) problems.push(`${path}: "${n.indicator}" needs the outer part first, then the indicator, then the inner part, side by side`);
          } else if (innerFirst) {
            if (!(i.range.end <= ind.start && ind.end <= o.range.start && gapOk(i.range.end, ind.start) && gapOk(ind.end, o.range.start))) problems.push(`${path}: "${n.indicator}" needs the inner part first, then the indicator, then the outer part, side by side`);
          }
        }
        return { letters: o.letters.slice(0, n.at) + i.letters + o.letters.slice(n.at), literal: o.literal && i.literal, range: union([o.range, i.range]) };
      }
      case "reversal": {
        const c = ev(n.of, `${path}.of`);
        const ind = indicator(n.indicator, REVERSAL_INDICATORS, "reversal");
        touches("reversal", ind, c.range);
        return { letters: reverse(c.letters), literal: c.literal, range: union([c.range, ind]) };
      }
      case "anagram": {
        const rs = n.of.map((p, k) => ev(p, `${path}.of[${k}]`));
        if (rs.some((r) => !r.literal)) problems.push(`${path}: anagram fodder must be literal clue text (no synonyms or abbreviations)`);
        const fodder = rs.map((r) => r.letters).join("");
        if (sortLetters(fodder) !== sortLetters(n.letters)) problems.push(`${path}: ${n.letters} is not an anagram of ${fodder}`);
        if (fodder === n.letters) problems.push(`${path}: anagram result equals its fodder`);
        const range = union(rs.map((r) => r.range));
        for (let k = 1; k < rs.length; k++) {
          const a = rs[k - 1].range;
          const b = rs[k].range;
          if (a && b && !(a.end <= b.start && gapOk(a.end, b.start))) problems.push(`${path}: anagram fodder must read as one run of clue words`);
        }
        const ind = indicator(n.indicator, ANAGRAM_INDICATORS, "anagram");
        touches("anagram", ind, range);
        return { letters: n.letters, literal: false, range: union([range, ind]) };
      }
      case "deletion": {
        const c = ev(n.of, `${path}.of`);
        const made = deleteLetters(c.letters, n.remove);
        if (made === null) problems.push(`${path}: cannot remove the ${n.remove} letter(s) of ${c.letters}`);
        const ind = indicator(n.indicator, DELETION_INDICATORS[n.remove] ?? [], `${n.remove}-letter deletion`);
        touches("deletion", ind, c.range);
        return { letters: made ?? "", literal: c.literal, range: union([c.range, ind]) };
      }
      case "remove": {
        const a = ev(n.from, `${path}.from`);
        const b = ev(n.take, `${path}.take`);
        const made = removeLetters(a.letters, b.letters, n.mode);
        if (made === null) problems.push(`${path}: ${b.letters} cannot be taken ${n.mode === "contiguous" ? "as a block" : "letter by letter"} out of ${a.letters}`);
        const fromFirst = (REMOVE_FROM_FIRST as readonly string[]).includes(n.indicator.toLowerCase());
        const takeFirst = (REMOVE_TAKE_FIRST as readonly string[]).includes(n.indicator.toLowerCase());
        used.push(n.indicator.toLowerCase());
        if (!fromFirst && !takeFirst) problems.push(`${path}: "${n.indicator}" is not a house subtraction indicator`);
        const ind = locate("indicator", n.indicator);
        if (ind && a.range && b.range) {
          if (fromFirst && !(a.range.end <= ind.start && ind.end <= b.range.start && gapOk(a.range.end, ind.start) && gapOk(ind.end, b.range.start))) problems.push(`${path}: "${n.indicator}" needs the original first, then the indicator, then what is removed`);
          if (takeFirst && !(b.range.end <= ind.start && ind.end <= a.range.start && gapOk(b.range.end, ind.start) && gapOk(ind.end, a.range.start))) problems.push(`${path}: "${n.indicator}" needs what is removed first, then the indicator, then the original`);
        }
        return { letters: made ?? "", literal: a.literal && b.literal, range: union([a.range, b.range]) };
      }
      case "select": {
        const range = locate("source", n.source);
        const made = selectLetters(n.source, n.how);
        if (!made) problems.push(`${path}: "${n.source}" is too short for ${SELECT_NAME[n.how]}`);
        const ind = indicator(n.indicator, SELECT_INDICATORS[n.how] ?? [], SELECT_NAME[n.how]);
        touches("letter-selection", ind, range);
        return { letters: made, literal: true, range: union([range, ind]) };
      }
      case "hidden": {
        const range = locate("source", n.fodder);
        const f = normaliseLetters(n.fodder);
        if (!f.includes(n.letters)) problems.push(`${path}: ${n.letters} is not inside "${n.fodder}" (${f})`);
        if (f === n.letters) problems.push(`${path}: hidden fodder must be longer than what is hidden`);
        if (n.fodder.split(/\s+/).map(normaliseLetters).includes(n.letters)) problems.push(`${path}: ${n.letters} appears as a whole word in the fodder`);
        const ind = indicator(n.indicator, HIDDEN_INDICATORS, "hidden-word");
        touches("hidden-word", ind, range);
        return { letters: n.letters, literal: true, range: union([range, ind]) };
      }
      case "homophone": {
        const c = ev(n.of, `${path}.of`);
        if (!n.note.trim()) problems.push(`${path}: homophones need a recorded UK pronunciation note`);
        if (c.letters === n.letters) problems.push(`${path}: homophone source is the answer itself`);
        editorial.push(`${path}: confirm ${n.letters} and ${c.letters} sound the same in standard UK English (${n.note})`);
        const ind = indicator(n.indicator, HOMOPHONE_INDICATORS, "homophone");
        touches("homophone", ind, c.range);
        return { letters: n.letters, literal: false, range: union([c.range, ind]) };
      }
    }
  };

  const res = ev(root, "root");
  if (res.letters !== answer) problems.push(`${where}: the construction tree makes ${res.letters || "nothing"}, not ${answer}`);
  if (countOps(root) < 2 && !clue.lit) problems.push(`${where}: a compound clue combines at least two operations`);
  if (!hasHidden(root) && normaliseLetters(text).includes(answer)) problems.push(`${where}: the answer appears inside the clue text`);

  // Definition position and the &lit variants.
  const defSpan = locate("definition", clue.definition);
  const stripped = text.replace(/[^A-Za-z]+$/, "");
  const lead = text.length - text.replace(/^[^A-Za-z]+/, "").length;
  const atStart = !!defSpan && defSpan.start === lead;
  const atEnd = !!defSpan && defSpan.end === stripped.length;
  if (defSpan) {
    if (clue.lit === "full") {
      if (!(atStart && atEnd)) problems.push(`${where}: an &lit clue's definition is the whole clue`);
    } else if (!atStart && !atEnd) problems.push(`${where}: definition "${clue.definition}" must be at the start or end of the clue`);
    else if (atStart && atEnd) problems.push(`${where}: the definition is the whole clue; mark it lit: "full" if the wordplay also defines`);
  }
  if (normaliseLetters(clue.definition).includes(answer)) problems.push(`${where}: definition contains the answer itself`);

  // Indicators listed on the clue must be exactly those the tree uses.
  const listed = clue.indicators.map((x) => x.toLowerCase()).sort();
  const actual = [...used].sort();
  if (JSON.stringify(listed) !== JSON.stringify(actual)) problems.push(`${where}: clue.indicators (${listed.join(" | ")}) must equal the tree's indicators (${actual.join(" | ")})`);

  // Overlaps. In &lit clues the definition legitimately overlaps wordplay.
  const wp = spans.filter((s) => s.label !== "definition").sort((a, b) => a.span.start - b.span.start);
  for (let i = 1; i < wp.length; i++) if (wp[i].span.start < wp[i - 1].span.end) problems.push(`${where}: "${wp[i - 1].phrase}" and "${wp[i].phrase}" overlap`);
  if (!clue.lit && defSpan) for (const s of wp) if (s.span.start < defSpan.end && defSpan.start < s.span.end) problems.push(`${where}: "${s.phrase}" overlaps the definition`);
  if (clue.lit === "semi" && defSpan) {
    const inside = wp.filter((s) => s.span.start >= defSpan.start && s.span.end <= defSpan.end).length;
    const outside = wp.filter((s) => s.span.end <= defSpan.start || s.span.start >= defSpan.end).length;
    if (!inside || !outside) problems.push(`${where}: a semi-&lit definition must overlap some wordplay and leave some wordplay outside it`);
  }

  // Every word must be accounted for.
  const covered = (a: number, b: number) =>
    wp.some((s) => a >= s.span.start && b <= s.span.end) || (clue.lit !== "full" && !!defSpan && a >= defSpan.start && b <= defSpan.end);
  for (const m of text.matchAll(/[A-Za-z]+/g)) {
    const a = m.index ?? 0;
    const b = a + m[0].length;
    if (!covered(a, b) && !LINK_WORDS.has(m[0].toLowerCase().replace("’", "'"))) problems.push(`${where}: the word "${m[0]}" is not part of the definition, an indicator or the wordplay`);
  }
  editorial.push(`${where}: confirm ${clue.lit === "full" ? "the whole clue works as an &lit definition" : clue.lit === "semi" ? "the semi-&lit definition reads naturally as a definition" : "the definition is fair"} and the surface reads naturally`);
  return { problems, editorial };
}

/** Plain-English steps for the solved parse card. */
export function describeTree(root: Node, answer: string): string {
  const steps: string[] = [];
  const ref = (n: Node): string => {
    if (n.op === "part") {
      if (n.via === "literal") return n.letters;
      if (n.via === "abbreviation") return `${n.letters} (short for "${n.source}")`;
      return `${n.letters} ("${n.source}")`;
    }
    return (treeLetters(n) ?? "?").toString();
  };
  const walk = (n: Node): void => {
    switch (n.op) {
      case "part":
        return;
      case "charade":
        n.parts.forEach(walk);
        steps.push(`${n.parts.map(ref).join(" + ")}${n.swapped ? ` (the clue gives them the other way round: "${n.link}")` : ""} = ${treeLetters(n)}`);
        return;
      case "container": {
        walk(n.outer);
        walk(n.inner);
        const o = treeLetters(n.outer) ?? "";
        steps.push(`${ref(n.inner)} goes inside ${ref(n.outer)}: ${o.slice(0, n.at)}(${treeLetters(n.inner)})${o.slice(n.at)} = ${treeLetters(n)}`);
        return;
      }
      case "reversal":
        walk(n.of);
        steps.push(`${ref(n.of)} written backwards gives ${treeLetters(n)}`);
        return;
      case "anagram":
        n.of.forEach(walk);
        steps.push(`Rearrange ${n.of.map(ref).join(" + ")} to make ${n.letters}`);
        return;
      case "deletion":
        walk(n.of);
        steps.push(`${ref(n.of)} without its ${n.remove === "ends" ? "first and last letters" : n.remove === "middle" ? "middle letter" : `${n.remove} letter`} gives ${treeLetters(n)}`);
        return;
      case "remove":
        walk(n.from);
        walk(n.take);
        steps.push(`${ref(n.from)} without ${ref(n.take)}${n.mode === "letters" ? " (those letters, wherever they sit)" : ""} leaves ${treeLetters(n)}`);
        return;
      case "select":
        steps.push(`Take the ${SELECT_NAME[n.how]} of "${n.source}": ${treeLetters(n)}`);
        return;
      case "hidden": {
        const f = normaliseLetters(n.fodder);
        const i = f.indexOf(n.letters);
        steps.push(`${n.letters} is hidden in "${n.fodder}": ${f.slice(0, i).toLowerCase()}[${n.letters}]${f.slice(i + n.letters.length).toLowerCase()}`);
        return;
      }
      case "homophone":
        walk(n.of);
        steps.push(`${ref(n.of)} sounds like ${n.letters} (${n.note})`);
        return;
    }
  };
  walk(root);
  return steps.map((s, i) => `Step ${i + 1}: ${s}.`).join(" ") + ` The result is ${answer}.`;
}
