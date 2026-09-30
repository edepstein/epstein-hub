import { z } from "zod";
import { attemptSchema, type StoredAttempt } from "./attempt";

/**
 * Device-local persistence for PUBLIC puzzle attempts and settings only.
 * Private family data must never be written here.
 */
export const KEY_PREFIX = "wc:v1";
const INDEX_KEY = `${KEY_PREFIX}:index`;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

export type StorageHealth = "ok" | "unavailable" | "quota";

export class StorageError extends Error {
  constructor(
    public readonly kind: "unavailable" | "quota" | "unknown",
    message: string,
  ) {
    super(message);
  }
}

let injected: KeyValueStore | null | undefined;
/** For tests: inject an in-memory store (or null to simulate unavailable storage). */
export function setStoreForTesting(store: KeyValueStore | null | undefined) {
  injected = store;
}

export function getStore(): KeyValueStore | null {
  if (injected !== undefined) return injected;
  try {
    if (typeof window === "undefined") return null;
    const s = window.localStorage;
    const probe = `${KEY_PREFIX}:probe`;
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function storageHealth(): StorageHealth {
  return getStore() ? "ok" : "unavailable";
}

function write(key: string, value: string) {
  const s = getStore();
  if (!s) throw new StorageError("unavailable", "Saving is unavailable in this browser. Progress lasts until you leave the page.");
  try {
    s.setItem(key, value);
  } catch (e) {
    const name = (e as { name?: string })?.name ?? "";
    if (/quota/i.test(name) || /quota/i.test(String(e))) {
      throw new StorageError("quota", "This browser's storage is full, so the latest move is not saved.");
    }
    throw new StorageError("unknown", "The latest move could not be saved.");
  }
}

export const attemptKey = (gameId: string, roundId: string) => `${KEY_PREFIX}:attempt:${gameId}:${roundId}`;
export const draftKey = (gameId: string, roundId: string) => `${KEY_PREFIX}:draft:${gameId}:${roundId}`;
export const matchKey = (gameId: string) => `${KEY_PREFIX}:match:${gameId}`;
const corruptKey = (key: string) => `${KEY_PREFIX}:corrupt:${key}`;

export type ReadResult =
  | { status: "empty" }
  | { status: "ok"; value: unknown; raw: string }
  | { status: "unparseable"; raw: string }
  | { status: "unavailable" };

export function readJson(key: string): ReadResult {
  const s = getStore();
  if (!s) return { status: "unavailable" };
  let raw: string | null;
  try {
    raw = s.getItem(key);
  } catch {
    return { status: "unavailable" };
  }
  if (raw == null) return { status: "empty" };
  try {
    return { status: "ok", value: JSON.parse(raw), raw };
  } catch {
    return { status: "unparseable", raw };
  }
}

export function writeJson(key: string, value: unknown) {
  write(key, JSON.stringify(value));
}

export function removeKey(key: string) {
  try {
    getStore()?.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Move a corrupt record aside (never silently delete history) and return the quarantine key. */
export function quarantine(key: string, raw: string): string | null {
  const target = corruptKey(key) + `:${Date.now()}`;
  try {
    write(target, raw);
    removeKey(key);
    return target;
  } catch {
    return null;
  }
}

/* ---------------- Library index ---------------- */

export const indexEntrySchema = z.object({
  gameId: z.string(),
  roundId: z.string(),
  attemptId: z.string(),
  title: z.string(),
  difficulty: z.enum(["gentle", "standard", "expert"]),
  outcome: z.enum(["playing", "completed", "failed", "revealed", "abandoned"]),
  assisted: z.boolean(),
  practice: z.boolean(),
  summary: z.string().optional(),
  updatedAt: z.string(),
});
export type IndexEntry = z.infer<typeof indexEntrySchema>;

export function readIndex(): IndexEntry[] {
  const r = readJson(INDEX_KEY);
  if (r.status !== "ok") return [];
  const parsed = z.array(indexEntrySchema).safeParse(r.value);
  return parsed.success ? parsed.data : [];
}

export function upsertIndex(entry: IndexEntry) {
  const list = readIndex().filter((e) => !(e.gameId === entry.gameId && e.roundId === entry.roundId));
  list.unshift(entry);
  writeJson(INDEX_KEY, list.slice(0, 500));
}

export function removeFromIndex(gameId: string, roundId: string) {
  const list = readIndex().filter((e) => !(e.gameId === gameId && e.roundId === roundId));
  try {
    writeJson(INDEX_KEY, list);
  } catch {
    /* ignore */
  }
}

export function saveAttempt(attempt: StoredAttempt, title: string) {
  writeJson(attemptKey(attempt.gameId, attempt.roundId), attempt);
  upsertIndex({
    gameId: attempt.gameId,
    roundId: attempt.roundId,
    attemptId: attempt.attemptId,
    title,
    difficulty: attempt.mode,
    outcome: attempt.outcome,
    assisted: attempt.assisted,
    practice: attempt.practice,
    summary: attempt.summary,
    updatedAt: attempt.updatedAt,
  });
}

export function isValidAttemptShape(value: unknown): value is StoredAttempt {
  return attemptSchema.safeParse(value).success;
}

/** Remove all Word Club puzzle progress on this device (settings kept unless asked). */
export function clearAllProgress(includeSettings = false) {
  const s = getStore();
  if (!s) return;
  const keys: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k && k.startsWith(KEY_PREFIX) && (includeSettings || !k.startsWith(`${KEY_PREFIX}:settings`))) keys.push(k);
  }
  keys.forEach((k) => s.removeItem(k));
}

export function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    key: (i) => Array.from(m.keys())[i] ?? null,
    get length() {
      return m.size;
    },
  };
}
