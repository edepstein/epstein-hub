/**
 * The "everyday word" pool used to prove par and to choose hint words. It is derived
 * mechanically (so the validator can recompute it) from the ESDB membership list and the
 * SCOWL size-35 familiarity layer: 3 to 8 letters, no simple superlatives, minus a small
 * editorial blocklist. Gameplay acceptance still uses the full membership list.
 */
export const POOL_VERSION = "circuit-pool-v1 (ESDB membership ∩ size-35, 3-8 letters)";
export const POOL_MAX_LENGTH = 8;

export const POOL_BLOCKLIST = new Set([
  "ARSE", "PISS", "CRAP", "TURD", "SHIT", "DAMN", "HELL", "PORN", "SEXY", "NAZI", "RAPE", "RAPED", "RAPIST", "SLUT", "BITCH", "PRAT", "TWAT",
  "WANK", "BOOB", "BOOBS", "NUDE", "DICK", "COCK", "COCKS", "FART", "PUKE", "PUS", "ANUS", "TIT", "TITS", "GOD", "JESUS", "SKYED", "EKED", "YUK",
  "IKON", "IKONS", "LARVAS", "BABYISH", "GAOL", "GAOLS", "DOPA", "HON", "HONS",
]);

export function isSimpleSuperlative(word: string, familiar: ReadonlySet<string>): boolean {
  if (word.endsWith("IEST") && familiar.has(`${word.slice(0, -4)}Y`)) return true;
  return word.endsWith("EST") && (familiar.has(word.slice(0, -3)) || familiar.has(word.slice(0, -2)));
}

export function everydayPool(familiar: ReadonlySet<string>, membership: ReadonlySet<string>, minLength = 3): string[] {
  const out: string[] = [];
  for (const w of familiar) {
    if (w.length < minLength || w.length > POOL_MAX_LENGTH || !membership.has(w) || POOL_BLOCKLIST.has(w) || isSimpleSuperlative(w, familiar)) continue;
    out.push(w);
  }
  return out.sort();
}

/**
 * Master pool (Master rounds only): the everyday layer plus the "uncommon but respectable" layer
 * (SCOWL size 60), still intersected with the ESDB membership list, 3 to 10 letters, no simple
 * superlatives, minus the same blocklist and the shared exclusions. Existing rounds keep the
 * everyday pool; a round opts in with `pool: "master"` in its payload.
 */
export const MASTER_POOL_VERSION = "circuit-master-pool-v1 (ESDB membership ∩ (size-35 ∪ size-60), 3-10 letters)";
export const MASTER_POOL_MAX_LENGTH = 10;

export function masterPool(familiar: ReadonlySet<string>, uncommon: ReadonlySet<string>, membership: ReadonlySet<string>, excluded: ReadonlySet<string>, minLength = 3): string[] {
  const union = new Set<string>([...familiar, ...uncommon]);
  const out: string[] = [];
  for (const w of union) {
    if (w.length < minLength || w.length > MASTER_POOL_MAX_LENGTH || !membership.has(w) || POOL_BLOCKLIST.has(w) || excluded.has(w) || isSimpleSuperlative(w, union)) continue;
    out.push(w);
  }
  return out.sort();
}
