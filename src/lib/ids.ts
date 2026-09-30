export function newId(prefix = "a"): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return `${prefix}_${c.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
}
