"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MEMBERSHIP_VERSION } from "@/lib/dictionary";
import { newId } from "@/lib/ids";
import { matchKey, quarantine, readJson, removeFromIndex, upsertIndex, writeJson } from "@/lib/progress/storage";
import { commit, createMatch, GAME_ID, type CommitResult, type MatchState, type Membership, type MoveAction } from "./engine";
import { newEnvelope, restoreMatch, withDraft, withRequest, type MatchDraft, type MatchEnvelope } from "./snapshot";
import type { RulesVersion } from "./rules";

export type SaveStatus = "idle" | "saving" | "saved" | "unavailable" | "error";

export type RestoreNotice =
  | { kind: "none" }
  | { kind: "restored"; moves: number }
  | { kind: "corrupt"; reason: string }
  | { kind: "version-mismatch"; reason: string };

export interface LocalMatch {
  ready: boolean;
  state: MatchState | null;
  envelope: MatchEnvelope | null;
  notice: RestoreNotice;
  saveStatus: SaveStatus;
  saveMessage: string | null;
  externalChange: boolean;
  start(opts: { players: string[]; rulesVersion: RulesVersion }): { ok: boolean; message: string };
  /** Commit an action for the current seat at the current version. */
  act(action: MoveAction): CommitResult | null;
  setDraft(draft: MatchDraft | undefined): void;
  /** Leave the current match (it stays in the library as finished early) and return to setup. */
  leave(): void;
  reload(): void;
}

const KEY = matchKey(GAME_ID);

function summaryOf(state: MatchState): string {
  return state.players.map((p, i) => `${p.name} ${state.scores[i]}`).join(" · ");
}

function titleOf(state: MatchState): string {
  return `Local match · ${state.players.map((p) => p.name).join(" v ")} · rules ${state.rulesVersion}`;
}

function randomSeed(): number {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0];
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export function useLocalMatch(words: Membership): LocalMatch {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<MatchState | null>(null);
  const [envelope, setEnvelope] = useState<MatchEnvelope | null>(null);
  const [notice, setNotice] = useState<RestoreNotice>({ kind: "none" });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [externalChange, setExternalChange] = useState(false);
  const lastWritten = useRef<string | null>(null);
  const envRef = useRef<MatchEnvelope | null>(null);
  const stateRef = useRef<MatchState | null>(null);
  const setBoth = useCallback((st: MatchState | null, env: MatchEnvelope | null) => {
    stateRef.current = st;
    envRef.current = env;
    setState(st);
    setEnvelope(env);
  }, []);

  const persist = useCallback((env: MatchEnvelope, st: MatchState, indexToo: boolean) => {
    try {
      const raw = JSON.stringify(env);
      writeJson(KEY, env);
      lastWritten.current = raw;
      if (indexToo) {
        upsertIndex({
          gameId: GAME_ID,
          roundId: "match",
          attemptId: env.matchId,
          title: titleOf(st),
          difficulty: "standard",
          outcome: st.status === "finished" ? "completed" : "playing",
          assisted: st.hintsTaken.some((h) => h > 0),
          practice: true,
          summary: summaryOf(st),
          updatedAt: env.updatedAt,
        });
      }
      setSaveStatus("saved");
      setSaveMessage(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The latest move could not be saved.";
      setSaveStatus(/unavailable/i.test(msg) ? "unavailable" : "error");
      setSaveMessage(msg);
    }
  }, []);

  const load = useCallback(() => {
    setExternalChange(false);
    const r = readJson(KEY);
    if (r.status === "unavailable") {
      setSaveStatus("unavailable");
      setBoth(null, null);
      setReady(true);
      return;
    }
    if (r.status === "empty") {
      setBoth(null, null);
      setReady(true);
      return;
    }
    if (r.status === "unparseable") {
      quarantine(KEY, r.raw);
      setNotice({ kind: "corrupt", reason: "Your saved match could not be read, so it has been set aside. Start a new match below." });
      setBoth(null, null);
      setReady(true);
      return;
    }
    const restored = restoreMatch(r.value, words, MEMBERSHIP_VERSION);
    if (restored.status === "restored") {
      lastWritten.current = r.raw;
      setBoth(restored.state, restored.envelope);
      setNotice({ kind: "restored", moves: restored.envelope.actions.length });
      setSaveStatus("saved");
    } else {
      quarantine(KEY, r.raw);
      setNotice(
        restored.status === "corrupt"
          ? { kind: "corrupt", reason: `Your saved match could not be restored: ${restored.reason} It has been set aside, not deleted. Start a new match below.` }
          : { kind: "version-mismatch", reason: `${restored.reason} The saved match has been set aside unchanged. Start a new match below.` },
      );
      setBoth(null, null);
    }
    setReady(true);
  }, [words, setBoth]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue !== lastWritten.current) setExternalChange(true);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const start = useCallback<LocalMatch["start"]>(
    ({ players, rulesVersion }) => {
      const seed = randomSeed();
      const created = createMatch({ rulesVersion, dictionaryVersion: MEMBERSHIP_VERSION, players: players.map((name) => ({ name })), seed });
      if (!created.ok) return { ok: false, message: created.message };
      const now = new Date().toISOString();
      const env = newEnvelope({ matchId: newId("match"), rulesVersion, dictionaryVersion: MEMBERSHIP_VERSION, players: players.map((name) => ({ name })), seed, now });
      setBoth(created.state, env);
      setNotice({ kind: "none" });
      persist(env, created.state, true);
      return { ok: true, message: "Match started." };
    },
    [persist, setBoth],
  );

  const act = useCallback<LocalMatch["act"]>(
    (action) => {
      const st = stateRef.current;
      const env = envRef.current;
      if (!st || !env) return null;
      const req = { actionId: newId("act"), expectedVersion: st.version, action };
      const r = commit(st, req, words);
      if (r.status === "accepted") {
        const nextEnv = withRequest(env, req, new Date().toISOString());
        setBoth(r.state, nextEnv);
        persist(nextEnv, r.state, true);
      }
      return r;
    },
    [persist, words, setBoth],
  );

  const setDraft = useCallback<LocalMatch["setDraft"]>(
    (draft) => {
      const env = envRef.current;
      const st = stateRef.current;
      if (!env || !st) return;
      const next = withDraft(env, draft);
      envRef.current = next;
      setEnvelope(next);
      persist(next, st, false);
    },
    [persist],
  );

  const leave = useCallback(() => {
    const st = stateRef.current;
    const env = envRef.current;
    if (st && env) {
      try {
        upsertIndex({
          gameId: GAME_ID,
          roundId: "match",
          attemptId: env.matchId,
          title: titleOf(st),
          difficulty: "standard",
          outcome: st.status === "finished" ? "completed" : "abandoned",
          assisted: st.hintsTaken.some((h) => h > 0),
          practice: true,
          summary: summaryOf(st),
          updatedAt: new Date().toISOString(),
        });
        // Keep a copy of the previous match rather than silently deleting it.
        writeJson(`${KEY}:previous`, env);
      } catch {
        /* best effort */
      }
    } else {
      removeFromIndex(GAME_ID, "match");
    }
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    lastWritten.current = null;
    setBoth(null, null);
    setNotice({ kind: "none" });
  }, [setBoth]);

  return { ready, state, envelope, notice, saveStatus, saveMessage, externalChange, start, act, setDraft, leave, reload: load };
}
