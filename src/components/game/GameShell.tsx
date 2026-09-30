"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { GameDefinition } from "@/games/types";
import { DIFFICULTY_LABEL, type HintOffer, type RoundMeta } from "@/lib/engine/types";
import type { GameSession } from "@/hooks/useGameSession";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { HintDialog } from "./HintDialog";
import { LiveFeedback } from "./LiveFeedback";
import { ResultPanel } from "./ResultPanel";
import { RulesView } from "./RulesView";
import { SaveIndicator } from "./SaveIndicator";
import { nextPracticeRound, type SiblingRound } from "@/lib/progress/next-round";

/**
 * Shared game chrome: themed hero, toolbar (rules, hints, restart, save state),
 * restore/corruption/storage banners, board stage, live feedback, side panel
 * and result panel. Game modules supply the board and side content.
 */
export function GameShell<S, A, D>({
  game,
  session,
  children,
  side,
  hintOffers,
  onTakeHint,
  hintLog,
  siblings = [],
  showResult = true,
  extraTools,
  statusSlot,
}: {
  game: GameDefinition;
  session: GameSession<S, A, D>;
  children: ReactNode;
  side?: ReactNode;
  hintOffers?: HintOffer[];
  onTakeHint?(tier: number): void;
  hintLog?: string[];
  siblings?: SiblingRound[];
  showResult?: boolean;
  extraTools?: ReactNode;
  /** Rendered under the board, above live feedback (e.g. draft preview). */
  statusSlot?: ReactNode;
}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const meta: RoundMeta = session.meta;
  const finished = session.outcome !== "playing";
  const resultRef = useRef<HTMLDivElement>(null);
  const wasFinished = useRef<boolean | null>(null);

  useEffect(() => {
    if (!session.ready) return;
    if (wasFinished.current === false && finished) {
      resultRef.current?.querySelector<HTMLElement>("#result-heading")?.focus();
    }
    wasFinished.current = finished;
  }, [finished, session.ready]);

  const [next, setNext] = useState<{ next: SiblingRound | null; exhausted: boolean }>({ next: null, exhausted: false });
  useEffect(() => {
    if (finished) setNext(nextPracticeRound(game.id, meta.id, siblings, meta.difficulty));
  }, [finished, game.id, meta.id, meta.difficulty, siblings]);

  const style = useMemo(() => ({ "--accent": game.theme.accent, "--wash": game.theme.wash }) as CSSProperties, [game.theme]);
  const statusLabel = meta.status === "published" ? "Daily edition" : meta.status === "demo" ? "Practice · original demo round" : "Practice round";

  return (
    <div data-game={game.id} style={style} className="game-root">
      <div className="hero">
        <div>
          <div className="eyebrow">
            {game.theme.kicker} <span className="sample-label">· {statusLabel}</span>
          </div>
          <h1>{game.title}</h1>
          <p>
            {meta.title ? <strong>{meta.title}</strong> : null}
            {meta.title ? " · " : null}
            {DIFFICULTY_LABEL[meta.difficulty]} · {game.tagline}
          </p>
        </div>
        <span className="badge">Untimed · take your time</span>
      </div>

      <div className="toolbar" role="toolbar" aria-label="Game tools">
        <Link className="text-button" href={`/games/${game.id}`} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
          Rounds &amp; difficulty
        </Link>
        {onTakeHint ? (
          <button type="button" className="btn secondary" onClick={() => setHintsOpen(true)} disabled={finished}>
            Get a hint
          </button>
        ) : null}
        <button type="button" className="text-button" onClick={() => setRulesOpen(true)}>
          How to play
        </button>
        {extraTools}
        <button type="button" className="text-button" onClick={() => setRestartOpen(true)}>
          Restart
        </button>
        <SaveIndicator status={session.saveStatus} message={session.saveMessage} />
      </div>

      <SessionBanners session={session} />

      <div className="game-layout">
        <section className="playbox" aria-label={`${game.title} board`}>
          <div className="board-heading">
            <span>{game.theme.strap}</span>
            <span className="board-emblem" aria-hidden="true">
              {game.theme.emblem}
            </span>
          </div>
          <div className="puzzle-stage">
            {session.ready ? children : <div className="empty" role="status">Loading your puzzle…</div>}
          </div>
          {statusSlot}
          <LiveFeedback feedback={session.feedback} />
          {showResult && finished && session.result ? (
            <div ref={resultRef}>
              <ResultPanel
                result={session.result}
                gameId={game.id}
                nextHref={next.next ? `/play/${game.id}/${next.next.id}` : null}
                exhausted={next.exhausted}
                onReplay={() => setRestartOpen(true)}
              />
            </div>
          ) : null}
        </section>
        <aside className="sidebox" aria-label="Progress and details">
          {side}
          <div className="side-section">
            <h3>Rules in brief</h3>
            <p style={{ margin: 0 }}>{game.rules.summary}</p>
            <button type="button" className="text-button small" style={{ marginTop: 10 }} onClick={() => setRulesOpen(true)}>
              Full rules
            </button>
          </div>
          <p style={{ fontSize: ".8rem", color: "var(--muted)" }}>
            Round {meta.id} · rules v{meta.rulesVersion}
            {meta.dictionaryVersion ? ` · words ${meta.dictionaryVersion}` : ""}
          </p>
        </aside>
      </div>

      <Dialog open={rulesOpen} onClose={() => setRulesOpen(false)} title={`How to play ${game.title}`} closeLabel="Back to the puzzle">
        <RulesView rules={game.rules} />
      </Dialog>
      {onTakeHint ? (
        <HintDialog open={hintsOpen} onClose={() => setHintsOpen(false)} offers={hintOffers ?? []} onTake={onTakeHint} log={hintLog} />
      ) : null}
      <ConfirmDialog
        open={restartOpen}
        onClose={() => setRestartOpen(false)}
        title="Start this round again?"
        body="Your current attempt is kept in your history, and a fresh attempt at the same round begins."
        confirmLabel="Start again"
        onConfirm={() => session.restart()}
      />
    </div>
  );
}

export function SessionBanners<S, A, D>({ session }: { session: GameSession<S, A, D> }) {
  const info = session.restoreInfo;
  return (
    <>
      {session.externalChange ? (
        <div className="wc-banner" data-tone="warn" role="alert">
          This puzzle was updated in another tab or window.
          <span className="spacer" />
          <button type="button" className="btn small" onClick={() => session.reloadFromStorage()}>
            Load the latest progress
          </button>
        </div>
      ) : null}
      {info.kind === "restored" ? (
        <div className="wc-banner" data-tone="info" data-testid="restored-banner">
          Welcome back. Your progress was restored ({info.actions} saved move{info.actions === 1 ? "" : "s"}).
        </div>
      ) : null}
      {info.kind === "corrupt" ? (
        <div className="wc-banner" data-tone="error" role="alert" data-testid="corrupt-banner">
          {info.reason}
        </div>
      ) : null}
      {info.kind === "version-mismatch" ? (
        <div className="wc-banner" data-tone="warn" role="alert">
          {info.reason} A fresh attempt at the corrected round has started.
        </div>
      ) : null}
      {info.kind === "storage-unavailable" || session.saveStatus === "unavailable" ? (
        <div className="wc-banner" data-tone="warn" data-testid="storage-banner">
          Saving is unavailable in this browser (private mode or blocked storage). You can still play; progress lasts until you leave the page.
        </div>
      ) : null}
      {session.saveStatus === "error" && session.saveMessage ? (
        <div className="wc-banner" data-tone="error" role="alert">
          {session.saveMessage}
        </div>
      ) : null}
    </>
  );
}
