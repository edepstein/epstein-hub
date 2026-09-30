"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameEngine, Outcome, ResultSummary, RoundMeta, Transition } from "@/lib/engine/types";
import { newAttempt, restoreAttempt, sessionOptionsFor, withAction, type StoredAttempt } from "@/lib/progress/attempt";
import {
  StorageError,
  attemptKey,
  draftKey,
  getStore,
  quarantine,
  readJson,
  removeKey,
  saveAttempt,
  writeJson,
  KEY_PREFIX,
} from "@/lib/progress/storage";
import { newId } from "@/lib/ids";
import { seedFrom } from "@/lib/rng";

export type SaveStatus = "idle" | "saving" | "saved" | "unavailable" | "error";
export type RestoreInfo =
  | { kind: "new" }
  | { kind: "restored"; actions: number }
  | { kind: "corrupt"; reason: string; quarantinedAs: string | null }
  | { kind: "version-mismatch"; reason: string }
  | { kind: "storage-unavailable" };

export interface Feedback {
  ok: boolean;
  code: string;
  message: string;
  /** Monotonic counter so identical consecutive messages are still announced. */
  seq: number;
}

export interface GameSession<S, A, D> {
  ready: boolean;
  state: S;
  meta: RoundMeta;
  attempt: StoredAttempt | null;
  outcome: Outcome;
  result: ResultSummary | null;
  saveStatus: SaveStatus;
  saveMessage: string | null;
  restoreInfo: RestoreInfo;
  feedback: Feedback | null;
  /** Another tab changed this attempt; reload to see it. */
  externalChange: boolean;
  dispatch(action: A): Transition<S>;
  /** Show a message without committing an action (e.g. draft analysis rejected client-side). */
  announce(message: string, ok?: boolean, code?: string): void;
  draft: D | undefined;
  setDraft(d: D | undefined): void;
  /** Start a fresh attempt at the same round. Keeps the previous attempt in history. */
  restart(): void;
  reloadFromStorage(): void;
}

const historyKey = (gameId: string, roundId: string) => `${KEY_PREFIX}:history:${gameId}:${roundId}`;

function archiveAttempt(attempt: StoredAttempt) {
  try {
    const r = readJson(historyKey(attempt.gameId, attempt.roundId));
    const list = r.status === "ok" && Array.isArray(r.value) ? (r.value as unknown[]) : [];
    list.unshift(attempt);
    writeJson(historyKey(attempt.gameId, attempt.roundId), list.slice(0, 20));
  } catch {
    /* history is best effort */
  }
}

export function useGameSession<R, S, A, D = unknown>(opts: {
  engine: GameEngine<R, S, A>;
  round: R;
  meta: RoundMeta;
  title: string;
  practice?: boolean;
  /** Called for every accepted action; e.g. to clear a draft. */
  onAccepted?(t: Transition<S>): void;
}): GameSession<S, A, D> {
  const { engine, round, meta, title } = opts;
  const practice = opts.practice ?? meta.status !== "published";
  const key = attemptKey(meta.gameId, meta.id);
  const dKey = draftKey(meta.gameId, meta.id);

  const initialState = useMemo(
    () => engine.initialise(round, sessionOptionsFor(meta, seedFrom(meta.id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meta.id, meta.contentHash],
  );

  const [ready, setReady] = useState(false);
  const [state, setState] = useState<S>(initialState);
  const [attempt, setAttempt] = useState<StoredAttempt | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [restoreInfo, setRestoreInfo] = useState<RestoreInfo>({ kind: "new" });
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [draft, setDraftState] = useState<D | undefined>(undefined);
  const [externalChange, setExternalChange] = useState(false);
  const seq = useRef(0);
  const stateRef = useRef(state);
  const attemptRef = useRef(attempt);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);

  const persist = useCallback(
    (a: StoredAttempt) => {
      setSaveStatus("saving");
      try {
        saveAttempt(a, title);
        setSaveStatus("saved");
        setSaveMessage(null);
      } catch (e) {
        const err = e instanceof StorageError ? e : new StorageError("unknown", "The latest move could not be saved.");
        setSaveStatus(err.kind === "unavailable" ? "unavailable" : "error");
        setSaveMessage(err.message);
      }
    },
    [title],
  );

  const startFresh = useCallback(
    (info: RestoreInfo) => {
      const attemptId = newId("att");
      const seed = seedFrom(attemptId);
      const fresh = newAttempt(meta, attemptId, seed, practice, new Date().toISOString());
      const s = engine.initialise(round, sessionOptionsFor(meta, seed));
      stateRef.current = s;
      attemptRef.current = fresh;
      setState(s);
      setAttempt(fresh);
      setRestoreInfo(info);
      setDraftState(undefined);
      setFeedback(null);
      if (getStore()) setSaveStatus("idle");
      else {
        setSaveStatus("unavailable");
        setSaveMessage("Saving is unavailable in this browser. Progress lasts until you leave the page.");
      }
      return fresh;
    },
    [engine, meta, practice, round],
  );

  const load = useCallback(() => {
    if (!getStore()) {
      startFresh({ kind: "storage-unavailable" });
      setReady(true);
      return;
    }
    const r = readJson(key);
    if (r.status === "empty") {
      startFresh({ kind: "new" });
    } else if (r.status === "unparseable") {
      const q = quarantine(key, r.raw);
      startFresh({ kind: "corrupt", reason: "Your saved progress for this puzzle was damaged, so a fresh attempt has started.", quarantinedAs: q });
    } else if (r.status === "unavailable") {
      startFresh({ kind: "storage-unavailable" });
    } else {
      const res = restoreAttempt(engine, round, meta, r.value);
      if (res.status === "restored") {
        stateRef.current = res.state;
        attemptRef.current = res.attempt;
        setState(res.state);
        setAttempt(res.attempt);
        setRestoreInfo(res.attempt.actions.length ? { kind: "restored", actions: res.attempt.actions.length } : { kind: "new" });
        setSaveStatus("saved");
        const d = readJson(dKey);
        setDraftState(d.status === "ok" ? (d.value as D) : undefined);
      } else if (res.status === "version-mismatch") {
        archiveAttempt(res.attempt);
        removeKey(key);
        startFresh({ kind: "version-mismatch", reason: res.reason });
      } else {
        const q = quarantine(key, r.raw);
        startFresh({ kind: "corrupt", reason: `${res.reason} A fresh attempt has started; the damaged record was set aside.`, quarantinedAs: q });
      }
    }
    setExternalChange(false);
    setReady(true);
  }, [dKey, engine, key, meta, round, startFresh]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.id, meta.contentHash]);

  // Cross-tab reconciliation: never silently overwrite newer work.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || e.newValue == null) return;
      try {
        const other = JSON.parse(e.newValue) as StoredAttempt;
        const mine = attemptRef.current;
        if (!mine || other.attemptId !== mine.attemptId || other.revision > mine.revision) setExternalChange(true);
      } catch {
        setExternalChange(true);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const dispatch = useCallback(
    (action: A): Transition<S> => {
      const t = engine.apply(stateRef.current, action);
      seq.current += 1;
      setFeedback({ ok: t.ok, code: t.code, message: t.message, seq: seq.current });
      if (!t.ok) return t;
      stateRef.current = t.state;
      setState(t.state);
      const current = attemptRef.current;
      if (current) {
        const at = new Date().toISOString();
        const outcome = engine.outcome(t.state);
        const res = engine.result(t.state);
        const assisted = res ? res.assistance.hints + res.assistance.reveals > 0 : isAssistAction(action);
        const next = withAction(current, { id: newId("act"), at, action }, outcome, assisted, res?.scoreText ?? res?.headline);
        attemptRef.current = next;
        setAttempt(next);
        persist(next);
      }
      opts.onAccepted?.(t);
      return t;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, persist],
  );

  const announce = useCallback((message: string, ok = false, code = "notice") => {
    seq.current += 1;
    setFeedback({ ok, code, message, seq: seq.current });
  }, []);

  const setDraft = useCallback(
    (d: D | undefined) => {
      setDraftState(d);
      try {
        if (d === undefined || d === null || (typeof d === "string" && d === "")) removeKey(dKey);
        else writeJson(dKey, d);
      } catch {
        /* drafts are best effort */
      }
    },
    [dKey],
  );

  const restart = useCallback(() => {
    const current = attemptRef.current;
    if (current && current.actions.length) archiveAttempt(current);
    removeKey(key);
    removeKey(dKey);
    const fresh = startFresh({ kind: "new" });
    persist(fresh);
    seq.current += 1;
    setFeedback({ ok: true, code: "restarted", message: "A fresh attempt has started. Your previous attempt is kept in your history.", seq: seq.current });
  }, [dKey, key, persist, startFresh]);

  const outcome = engine.outcome(state);
  const result = useMemo(() => engine.result(state), [engine, state]);

  return {
    ready,
    state,
    meta,
    attempt,
    outcome,
    result,
    saveStatus,
    saveMessage,
    restoreInfo,
    feedback,
    externalChange,
    dispatch,
    announce,
    draft,
    setDraft,
    restart,
    reloadFromStorage: load,
  };
}

function isAssistAction(action: unknown): boolean {
  const t = (action as { type?: string } | null)?.type ?? "";
  return /hint|reveal/i.test(t);
}
