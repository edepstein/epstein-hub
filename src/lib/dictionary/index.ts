/**
 * Dictionary layers (docs/04):
 *  1. Gameplay membership (public/dictionaries/wc-membership-v2.txt, ~253k upper-case A-Z words):
 *     SCOWL size 95 (British -ise/-ize plus American spellings) merged with the public-domain
 *     ENABLE list and the Collins two-letter list; built by `pnpm build:membership`. This is a
 *     superset of the tile-game vocabulary, as Collins Scrabble Words is (it also accepts American
 *     spellings). If you hold a Collins Scrabble Words licence, drop it in
 *     data/dictionaries/licensed/csw.txt and rebuild. Minus the slur exclusions in exclusions.ts.
 *     NOT editorially approved; the version string carries "-candidate".
 *  2. Curated answer pools live with each game's rounds (UK spellings), never derived from this list.
 */
import { EXCLUDED_WORDS } from "./exclusions";

/** v2: ~253k-word membership (was 81,901). Saved attempts pinned to v1.x restart cleanly. */
export const MEMBERSHIP_VERSION = "wc-membership-v2-candidate";
export const DICTIONARY_URL = "/dictionaries/wc-membership-v2.txt";
export const DICTIONARY_SHA256 = "c0aa152a7fd22f63b25972e3dceeaa2991baa40c4548c6e79a0580544fbfb4c2";

export type Membership = ReadonlySet<string>;

export function buildMembership(text: string): Set<string> {
  const set = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const w = line.trim();
    if (w && /^[A-Z]+$/.test(w) && !EXCLUDED_WORDS.has(w)) set.add(w);
  }
  return set;
}

let cache: Promise<Set<string>> | null = null;

/** Browser loader; fetched once per page load and cached. */
export function loadMembership(): Promise<Set<string>> {
  if (!cache) {
    cache = fetch(DICTIONARY_URL, { cache: "force-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`Word list unavailable (${r.status})`);
        return r.text();
      })
      .then(buildMembership)
      .catch((e) => {
        cache = null;
        throw e;
      });
  }
  return cache;
}
