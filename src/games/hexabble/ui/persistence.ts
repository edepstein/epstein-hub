/**
 * Device-local persistence for one Hexabble match (matchKey('hexabble')), built on the shared
 * storage helpers. The snapshot is validated on every read; anything unreadable is moved aside
 * with `quarantine` (never silently deleted) and the player is told why.
 */
import {
  StorageError,
  matchKey,
  quarantine,
  readJson,
  upsertIndex,
  writeJson,
} from "@/lib/progress/storage";
import { validateSnapshot, type MatchSnapshot } from "../engine";

export const HEXABBLE_KEY = matchKey("hexabble");
const BOARD_PREF_KEY = "wc:v1:settings:hexabble-board";

export type LoadResult =
  | { kind: "empty" }
  | { kind: "unavailable" }
  | { kind: "restored"; snapshot: MatchSnapshot }
  | { kind: "corrupt"; reason: string; setAside: boolean };

export function loadMatch(): LoadResult {
  const r = readJson(HEXABBLE_KEY);
  if (r.status === "unavailable") return { kind: "unavailable" };
  if (r.status === "empty") return { kind: "empty" };
  if (r.status === "unparseable") {
    const aside = quarantine(HEXABBLE_KEY, r.raw);
    return { kind: "corrupt", reason: "The saved match could not be read.", setAside: aside !== null };
  }
  const check = validateSnapshot(r.value);
  if (check.ok) return { kind: "restored", snapshot: check.snapshot };
  const aside = quarantine(HEXABBLE_KEY, r.raw);
  return { kind: "corrupt", reason: check.reason, setAside: aside !== null };
}

export type SaveOutcome = { ok: true } | { ok: false; kind: "unavailable" | "quota" | "unknown"; message: string };

export function saveMatch(snapshot: MatchSnapshot): SaveOutcome {
  try {
    writeJson(HEXABBLE_KEY, snapshot);
  } catch (e) {
    if (e instanceof StorageError) return { ok: false, kind: e.kind, message: e.message };
    return { ok: false, kind: "unknown", message: "The latest move could not be saved." };
  }
  try {
    const s = snapshot.state;
    const names = s.players.map((p) => p.name);
    upsertIndex({
      gameId: "hexabble",
      roundId: "match",
      attemptId: snapshot.matchId,
      title: `Local match: ${names.join(" v ")}`,
      difficulty: "standard",
      outcome: s.over ? "completed" : "playing",
      assisted: false,
      practice: true,
      summary: `${s.mode === "friendly" ? "Friendly" : "Challenge"} checking · ${s.players.map((p) => `${p.name} ${p.score}`).join(", ")}${s.over ? " · finished" : ""}`,
      updatedAt: snapshot.updatedAt,
    });
  } catch {
    /* The match itself is saved; the library index is a convenience. */
  }
  return { ok: true };
}

export type BoardMode = "readable" | "fit";

export function readBoardPref(): BoardMode | null {
  try {
    const v = window.localStorage.getItem(BOARD_PREF_KEY);
    return v === "readable" || v === "fit" ? v : null;
  } catch {
    return null;
  }
}

export function writeBoardPref(mode: BoardMode) {
  try {
    window.localStorage.setItem(BOARD_PREF_KEY, mode);
  } catch {
    /* per-viewer convenience only */
  }
}
