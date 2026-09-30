/**
 * Dictionary layers (docs/04):
 *  1. Candidate GB spellings: ESDB export, 81,901 upper-case A–Z words (public/dictionaries/gb-esdb-v1.txt).
 *  2. Gameplay membership: candidates minus the exclusion list below. NOT editorially approved yet;
 *     the version string carries "-candidate" so every round pins that fact.
 *  3. Curated answer pools live with each game's rounds, never derived from the whole list.
 */
import { EXCLUDED_WORDS } from "./exclusions";

export const MEMBERSHIP_VERSION = "gb-esdb-v1-candidate";
export const DICTIONARY_URL = "/dictionaries/gb-esdb-v1.txt";
export const DICTIONARY_SHA256 = "daf3a79020e327e63356e01529c1e8aca37d217dbf6a85edfc0ab27cf9a291ce";

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
