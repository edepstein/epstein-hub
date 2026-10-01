/**
 * Builds the gameplay membership list (public/dictionaries/wc-membership-v2.txt) from the
 * sources in data/dictionaries/sources. See that folder's README for licences.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8").split(/\s+/).map((w) => w.trim().toUpperCase()).filter(Boolean);
const sources: { name: string; words: string[] }[] = [
  { name: "scowl95-bza", words: read("data/dictionaries/sources/scowl95-bza.txt") },
  { name: "enable1", words: read("data/dictionaries/sources/enable1.txt") },
];
const licensed = "data/dictionaries/licensed/csw.txt";
if (existsSync(licensed)) sources.push({ name: "licensed-csw", words: read(licensed) });

const twoLetter = new Set(read("data/dictionaries/sources/collins-two-letter.txt"));
const out = new Set<string>();
for (const s of sources) {
  for (const w of s.words) {
    if (!/^[A-Z]{2,24}$/.test(w)) continue;
    if (w.length === 2 && !twoLetter.has(w)) continue;
    out.add(w);
  }
}
for (const w of twoLetter) out.add(w);
const list = [...out].sort();
const text = list.join("\n") + "\n";
writeFileSync("public/dictionaries/wc-membership-v2.txt", text);
const sha = createHash("sha256").update(text).digest("hex");
writeFileSync(
  "public/dictionaries/wc-membership-v2.manifest.json",
  JSON.stringify(
    {
      version: "wc-membership-v2",
      wordCount: list.length,
      sha256: sha,
      sources: sources.map((s) => ({ name: s.name, rawCount: s.words.length })),
      twoLetterWords: [...twoLetter].length,
      licensedCswIncluded: sources.some((s) => s.name === "licensed-csw"),
      editoriallyApproved: false,
      note: "Candidate list. Includes American spellings, as Collins Scrabble Words does; puzzle answers use UK spellings. Not a copy of Collins Scrabble Words.",
    },
    null,
    2,
  ) + "\n",
);
console.log(`wc-membership-v2: ${list.length} words, sha256 ${sha}`);
