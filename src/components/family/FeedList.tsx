"use client";

import { useState } from "react";
import type { PostItem, ReplyItem } from "@/lib/family/repo";
import { familyFetch } from "./client-api";
import { PrivatePhoto } from "./PrivatePhoto";

function formatDate(iso: string | null, timeZone: string) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function FavouriteButton({ familyId, postId, initial }: { familyId: string; postId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn secondary fav-button"
        aria-pressed={on}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const next = !on;
          const r = await familyFetch(`/api/family/${familyId}/posts/${postId}/favourite`, { method: next ? "POST" : "DELETE" });
          if (r.ok) setOn(next);
          else setError(r.message);
          setBusy(false);
        }}
      >
        <span aria-hidden="true">{on ? "♥" : "♡"}</span> {on ? "Favourited" : "Favourite"}
      </button>
      {error ? (
        <span role="alert" className="form-error">
          {error}
        </span>
      ) : null}
    </>
  );
}

function Replies({ familyId, postId, initial, userId, isCurator, timeZone }: { familyId: string; postId: string; initial: ReplyItem[]; userId: string; isCurator: boolean; timeZone: string }) {
  const [replies, setReplies] = useState(initial);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const boxId = `reply-${postId}`;

  async function reload() {
    const r = await familyFetch<{ replies: ReplyItem[] }>(`/api/family/${familyId}/posts/${postId}/replies`);
    if (r.ok) setReplies(r.data.replies);
  }

  return (
    <div className="replies">
      {replies.length ? (
        <ul aria-label="Replies">
          {replies.map((r) => (
            <li key={r.id}>
              <small>
                {r.authorName} · {formatTime(r.createdAt, timeZone)}
              </small>
              {r.body}
              {r.authorId === userId || isCurator ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="link-button"
                    onClick={async () => {
                      const res = await familyFetch(`/api/family/${familyId}/replies/${r.id}`, { method: "DELETE" });
                      if (res.ok) {
                        setReplies((list) => list.filter((x) => x.id !== r.id));
                        setMessage({ tone: "ok", text: "Reply removed." });
                      } else setMessage({ tone: "error", text: res.message });
                    }}
                  >
                    Remove reply
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {open ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!draft.trim()) {
              setMessage({ tone: "error", text: "Write a reply first." });
              return;
            }
            setBusy(true);
            const r = await familyFetch(`/api/family/${familyId}/posts/${postId}/replies`, { method: "POST", json: { body: draft } });
            setBusy(false);
            if (r.ok) {
              setDraft("");
              setOpen(false);
              setMessage({ tone: "ok", text: "Reply shared with the family." });
              await reload();
            } else {
              setMessage({ tone: "error", text: r.fields?.body ?? r.message });
            }
          }}
        >
          <label htmlFor={boxId}>Your reply</label>
          <textarea id={boxId} value={draft} maxLength={1000} onChange={(e) => setDraft(e.target.value)} aria-describedby={`${boxId}-hint`} />
          <p id={`${boxId}-hint`} className="form-hint">
            Replies are seen by everyone in this family. {1000 - draft.length} characters left.
          </p>
          <div className="row">
            <button type="submit" className="btn" disabled={busy}>
              {busy ? "Sending…" : "Send reply"}
            </button>
            <button type="button" className="btn secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn secondary" onClick={() => setOpen(true)}>
          Reply
        </button>
      )}
      <p className="status-line" data-tone={message?.tone} role="status" aria-live="polite">
        {message?.text}
      </p>
    </div>
  );
}

export function FeedPost({ post, familyId, userId, isCurator, timeZone }: { post: PostItem; familyId: string; userId: string; isCurator: boolean; timeZone: string }) {
  return (
    <article className="post" aria-labelledby={`post-${post.id}-by`} data-post-id={post.id}>
      <div className="post-header">
        <span className="avatar" aria-hidden="true">
          {post.authorName.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <strong id={`post-${post.id}-by`}>{post.authorName}</strong>
          <small>{formatTime(post.publishedAt ?? post.createdAt, timeZone)}</small>
        </div>
      </div>
      {post.media.map((m) => (
        <PrivatePhoto key={m.id} familyId={familyId} mediaId={m.id} alt={m.altText} width={m.width} height={m.height} downloadAllowed={m.downloadAllowed} />
      ))}
      {post.caption ? <p className="family-caption">{post.caption}</p> : null}
      <div className="post-actions">
        <FavouriteButton familyId={familyId} postId={post.id} initial={post.favourited} />
      </div>
      <Replies familyId={familyId} postId={post.id} initial={post.replies} userId={userId} isCurator={isCurator} timeZone={timeZone} />
    </article>
  );
}

/** Chronological feed grouped by day, with an accessible "Load more" that keeps your place. */
export function FeedList({
  familyId,
  userId,
  isCurator,
  timeZone,
  initialPosts,
  initialCursor,
}: {
  familyId: string;
  userId: string;
  isCurator: boolean;
  timeZone: string;
  initialPosts: PostItem[];
  initialCursor: string | null;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  const days = posts.map((p) => formatDate(p.publishedAt, timeZone));
  return (
    <div className="family-feed">
      {posts.map((p, i) => {
        const header = i === 0 || days[i] !== days[i - 1] ? days[i] : null;
        return (
          <div key={p.id}>
            {header ? <h2 className="family-date-group">{header}</h2> : null}
            <FeedPost post={p} familyId={familyId} userId={userId} isCurator={isCurator} timeZone={timeZone} />
          </div>
        );
      })}
      {cursor ? (
        <div className="toolbar">
          <button
            type="button"
            className="btn secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const r = await familyFetch<{ posts: PostItem[]; nextCursor: string | null }>(`/api/family/${familyId}/posts?cursor=${encodeURIComponent(cursor)}`);
              setBusy(false);
              if (r.ok) {
                setPosts((list) => [...list, ...r.data.posts.filter((n) => !list.some((o) => o.id === n.id))]);
                setCursor(r.data.nextCursor);
                setAnnounce(`${r.data.posts.length} earlier ${r.data.posts.length === 1 ? "update" : "updates"} added below.`);
              } else setError(r.message);
            }}
          >
            {busy ? "Loading…" : "Load earlier updates"}
          </button>
          {error ? (
            <span role="alert" className="form-error">
              {error}
            </span>
          ) : null}
        </div>
      ) : posts.length ? (
        <p className="form-hint">You have reached the first update.</p>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
