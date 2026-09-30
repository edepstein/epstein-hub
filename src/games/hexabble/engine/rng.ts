/**
 * Serialisable seeded randomness for bag order. The generator state is a single uint32 kept
 * in the match state (never a function), so a snapshot fully determines every later draw.
 * Same mulberry32 step as src/lib/rng.ts.
 */
export function nextRandom(state: number): { value: number; state: number } {
  const a = (state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: a };
}

/** Fisher–Yates shuffle (the source algorithm) driven by the serialisable state. */
export function shuffleWithState<T>(items: readonly T[], state: number): { items: T[]; state: number } {
  const out = items.slice();
  let s = state >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    const n = nextRandom(s);
    s = n.state;
    const j = Math.floor(n.value * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { items: out, state: s };
}
