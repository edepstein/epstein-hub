"use client";

/**
 * Hexabble local match: setup, pass-the-device handover, board with keyboard roving focus,
 * rack (click, keyboard or drag), special-face and exchange dialogs, live move preview,
 * history, results and device-local save/restore. Route: /play/hexabble/match.
 * The `bundle` prop is ignored: a match is not an authored round.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { PlayProps } from "../play-types";
import { definition } from "./definition";
import { EMPTY_DRAFT, buildSnapshot, createMatch, type MatchSnapshot, type MatchState, type WordList } from "./engine";
import { useMembership } from "@/hooks/useMembership";
import type { SaveStatus } from "@/hooks/useGameSession";
import { MEMBERSHIP_VERSION } from "@/lib/dictionary";
import { newId } from "@/lib/ids";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { RulesView } from "@/components/game/RulesView";
import { SaveIndicator } from "@/components/game/SaveIndicator";
import { Setup, type SetupValues } from "./ui/Setup";
import { MatchView, type Session } from "./ui/MatchView";
import { loadMatch, saveMatch } from "./ui/persistence";
import "./hexabble.css";


type Notice = null | { kind: "restored"; over: boolean } | { kind: "corrupt"; reason: string; setAside: boolean } | { kind: "unavailable" };

function randomSeed(): number {
  const c = globalThis.crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

export default function Play(props: PlayProps) {
  void props; // matches are not authored rounds
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<"setup" | "match">("setup");
  const [notice, setNotice] = useState<Notice>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [setupValues, setSetupValues] = useState<SetupValues>({ names: ["", ""], mode: "friendly", privacy: true });
  const [replace, setReplace] = useState<SetupValues | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const membership = useMembership();
  const words: WordList | null = membership.words;

  useEffect(() => {
    const r = loadMatch();
    if (r.kind === "restored") {
      const s = r.snapshot;
      setSession({
        matchId: s.matchId,
        createdAt: s.createdAt,
        privacy: s.privacy,
        // Always hide the rack again after a reload, so nobody sees it by accident.
        handover: s.privacy && !s.state.over,
        state: s.state as MatchState,
        draft: s.draft,
      });
      setSetupValues({ names: s.state.players.map((p) => p.name), mode: s.state.mode, privacy: s.privacy });
      setView("match");
      setNotice({ kind: "restored", over: s.state.over });
      setSaveStatus("saved");
    } else if (r.kind === "corrupt") {
      setNotice({ kind: "corrupt", reason: r.reason, setAside: r.setAside });
    } else if (r.kind === "unavailable") {
      setNotice({ kind: "unavailable" });
      setSaveStatus("unavailable");
    }
    setLoaded(true);
  }, []);

  // ---- autosave (debounced; flushed on page hide) ----
  const pending = useRef<MatchSnapshot | null>(null);
  const flush = useCallback(() => {
    const snap = pending.current;
    if (!snap) return;
    pending.current = null;
    const r = saveMatch(snap);
    if (r.ok) {
      setSaveStatus("saved");
      setSaveMessage(null);
    } else {
      setSaveStatus(r.kind === "unavailable" ? "unavailable" : "error");
      setSaveMessage(r.message);
    }
  }, []);
  const firstSave = useRef(true);
  useEffect(() => {
    if (!session) return;
    if (firstSave.current && notice?.kind === "restored") {
      // Nothing changed yet; do not rewrite the restored save.
      firstSave.current = false;
      return;
    }
    firstSave.current = false;
    pending.current = buildSnapshot({
      state: session.state,
      draft: session.draft,
      matchId: session.matchId,
      createdAt: session.createdAt,
      updatedAt: new Date().toISOString(),
      privacy: session.privacy,
      handover: session.handover,
      dictionaryVersion: MEMBERSHIP_VERSION,
    });
    setSaveStatus((s) => (s === "unavailable" ? s : "saving"));
    const t = setTimeout(flush, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, flush]);
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      flush();
    };
  }, [flush]);

  const startMatch = useCallback((v: SetupValues) => {
    const state = createMatch({ names: v.names, mode: v.mode, seed: randomSeed() });
    setSession({ matchId: newId("hx"), createdAt: new Date().toISOString(), privacy: v.privacy, handover: v.privacy, state, draft: EMPTY_DRAFT });
    setSetupValues({ names: state.players.map((p) => p.name), mode: v.mode, privacy: v.privacy });
    setNotice((n) => (n?.kind === "unavailable" ? n : null));
    setView("match");
  }, []);

  const requestStart = useCallback(
    (v: SetupValues) => {
      if (session) setReplace(v);
      else startMatch(v);
    },
    [session, startMatch],
  );

  const style = useMemo(() => ({ "--accent": definition.theme.accent, "--wash": definition.theme.wash }) as CSSProperties, []);
  const saved = session !== null;

  return (
    <div data-game="hexabble" style={style} className="game-root hx-root">
      <div className="hero">
        <div>
          <div className="eyebrow">{definition.theme.kicker} · local pass-and-play</div>
          <h1>Hexabble</h1>
          <p>{definition.tagline} Two to four people take turns on this one device; there is no computer opponent.</p>
        </div>
        <span className="badge">Untimed · one shared device</span>
      </div>

      <div className="toolbar" role="toolbar" aria-label="Match tools">
        <Link className="text-button" href="/games/hexabble" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
          About Hexabble
        </Link>
        <button type="button" className="text-button" onClick={() => setRulesOpen(true)}>
          How to play
        </button>
        <SaveIndicator status={saveStatus} message={saveMessage} />
      </div>

      {notice?.kind === "restored" && view === "match" ? (
        <div className="wc-banner" data-tone="info" data-testid="hx-restored">
          {notice.over ? "Welcome back. Your finished match was restored from this device." : "Welcome back. Your match was restored from this device, including any tiles you had not placed yet."}
        </div>
      ) : null}
      {notice?.kind === "corrupt" ? (
        <div className="wc-banner" data-tone="error" role="alert" data-testid="hx-corrupt">
          Your saved match could not be restored. {notice.reason}{" "}
          {notice.setAside ? "It has been set aside on this device rather than deleted." : ""} You can start a new match below.
        </div>
      ) : null}
      {notice?.kind === "unavailable" || saveStatus === "unavailable" ? (
        <div className="wc-banner" data-tone="warn" data-testid="hx-storage">
          Saving is unavailable in this browser (private mode or blocked storage). You can still play, but the match lasts only until you leave
          the page.
        </div>
      ) : null}
      {saveStatus === "error" && saveMessage ? (
        <div className="wc-banner" data-tone="error" role="alert">
          {saveMessage} The match carries on; keep this page open.
        </div>
      ) : null}
      {membership.status === "error" ? (
        <div className="wc-banner" data-tone="error" role="alert" data-testid="wordlist-error">
          The word list could not be loaded ({membership.error}). You can look at the board, but moves cannot be checked until it loads.
          <span className="spacer" />
          <button type="button" className="btn small" onClick={membership.retry}>
            Try again
          </button>
        </div>
      ) : null}

      <div className="hx-frame">
        {!loaded ? (
          <div className="hx-muted" role="status">
            Loading your match…
          </div>
        ) : view === "setup" || !session ? (
          <Setup
            key={setupValues.names.join("|")}
            initial={setupValues}
            onStart={requestStart}
            onResume={saved ? () => setView("match") : null}
            resumeLabel={session?.state.over ? "Back to the finished match" : "Back to the saved match"}
            onRules={() => setRulesOpen(true)}
          />
        ) : (
          <MatchView
            session={session}
            setSession={setSession}
            words={words}
            wordsStatus={membership.status}
            onRules={() => setRulesOpen(true)}
            onNewMatch={() => setView("setup")}
            onRematch={() => requestStart({ names: session.state.players.map((p) => p.name), mode: session.state.mode, privacy: session.privacy })}
          />
        )}
      </div>

      <Dialog open={rulesOpen} onClose={() => setRulesOpen(false)} title="How to play Hexabble" closeLabel="Back to the match">
        <RulesView rules={definition.rules} />
      </Dialog>
      <ConfirmDialog
        open={replace !== null}
        onClose={() => setReplace(null)}
        title="Replace the saved match?"
        body={
          session?.state.over
            ? "This device keeps one Hexabble match. Starting a new one replaces the finished match between " +
              session.state.players.map((p) => p.name).join(", ") +
              ", including its final result."
            : "This device keeps one Hexabble match. Starting a new one ends the saved match between " +
              (session?.state.players.map((p) => p.name).join(", ") ?? "") +
              " and it cannot be recovered. Choose Cancel to keep it."
        }
        confirmLabel="Start the new match"
        onConfirm={() => {
          if (replace) startMatch(replace);
        }}
      />
    </div>
  );
}
