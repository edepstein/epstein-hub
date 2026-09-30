"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DraftBook, MediaRef } from "@/lib/family/repo";
import { familyFetch } from "./client-api";

type Msg = { tone: "ok" | "error"; text: string } | null;

/** Curator's Birthday Book composer: cover, chapters, entries, ordering and explicit publishing. */
export function BookEditor({ familyId, book, photos }: { familyId: string; book: DraftBook | null; photos: MediaRef[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [title, setTitle] = useState(book?.title ?? "");
  const [dedication, setDedication] = useState(book?.dedication ?? "");
  const [chapterTitle, setChapterTitle] = useState("");
  const [entry, setEntry] = useState({ chapterId: book?.chapters[0]?.id ?? "", kind: "letter" as "letter" | "story" | "photo", heading: "", body: "", mediaId: "", credit: "" });
  const [busy, setBusy] = useState(false);

  async function call(url: string, init: RequestInit & { json?: unknown }, done: string) {
    setBusy(true);
    const r = await familyFetch(url, init);
    setBusy(false);
    if (r.ok) {
      setMsg({ tone: "ok", text: done });
      router.refresh();
    } else setMsg({ tone: "error", text: r.fields ? Object.values(r.fields)[0] ?? r.message : r.message });
    return r.ok;
  }

  const base = `/api/family/${familyId}/book`;
  const photoLabel = (id: string | null) => photos.find((p) => p.id === id)?.altText ?? "Photograph";

  return (
    <section className="family-panel family-form" aria-labelledby="book-editor-title">
      <h2 id="book-editor-title">Birthday Book</h2>
      <p className="form-hint">
        Readers only see a published version. Edits here stay private until you publish again.
        {book ? ` Published version: ${book.publishedVersion || "none yet"}.` : ""}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void call(base, { method: "PUT", json: { title, dedication: dedication.trim() ? dedication : null } }, "Book cover saved.");
        }}
      >
        <label htmlFor="b-title">Book title</label>
        <input id="b-title" type="text" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        <label htmlFor="b-dedication">Dedication (the family&apos;s own words)</label>
        <textarea id="b-dedication" value={dedication} maxLength={2000} onChange={(e) => setDedication(e.target.value)} />
        <div className="toolbar">
          <button type="submit" className="btn secondary" disabled={busy}>
            {book ? "Save cover" : "Start the book"}
          </button>
        </div>
      </form>

      {book ? (
        <>
          <h3 className="section-title">Chapters</h3>
          {book.chapters.length === 0 ? <p className="form-hint">No chapters yet. Add the first one below.</p> : null}
          {book.chapters.map((c, ci) => (
            <div key={c.id} className="chapter-card">
              <h4>
                {ci + 1}. {c.title}
              </h4>
              <div className="small-btns">
                <button type="button" className="btn secondary" disabled={busy || ci === 0} onClick={() => void call(`${base}/chapters/${c.id}`, { method: "PATCH", json: { move: "up" } }, `Moved “${c.title}” up.`)}>
                  Move up
                </button>
                <button type="button" className="btn secondary" disabled={busy || ci === book.chapters.length - 1} onClick={() => void call(`${base}/chapters/${c.id}`, { method: "PATCH", json: { move: "down" } }, `Moved “${c.title}” down.`)}>
                  Move down
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => {
                    const t = window.prompt("New chapter title", c.title);
                    if (t && t.trim()) void call(`${base}/chapters/${c.id}`, { method: "PATCH", json: { title: t } }, "Chapter renamed.");
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Delete the chapter “${c.title}” and its entries from the draft? The published book is not changed until you publish again.`)) {
                      void call(`${base}/chapters/${c.id}`, { method: "DELETE" }, "Chapter deleted from the draft.");
                    }
                  }}
                >
                  Delete
                </button>
              </div>
              {c.entries.length ? (
                <ol>
                  {c.entries.map((e, ei) => (
                    <li key={e.id}>
                      <strong>{e.kind === "photo" ? "Photograph" : e.kind === "letter" ? "Letter" : "Story"}</strong>
                      {e.heading ? `: ${e.heading}` : ""}
                      {e.kind === "photo" ? ` (${photoLabel(e.mediaId)})` : e.body ? ` · ${e.body.slice(0, 80)}${e.body.length > 80 ? "…" : ""}` : ""}
                      {e.credit ? ` · ${e.credit}` : ""}
                      <div className="small-btns">
                        <button type="button" className="btn secondary" disabled={busy || ei === 0} onClick={() => void call(`${base}/entries/${e.id}`, { method: "PATCH", json: { move: "up" } }, "Entry moved up.")}>
                          Up
                        </button>
                        <button type="button" className="btn secondary" disabled={busy || ei === c.entries.length - 1} onClick={() => void call(`${base}/entries/${e.id}`, { method: "PATCH", json: { move: "down" } }, "Entry moved down.")}>
                          Down
                        </button>
                        <button type="button" className="btn secondary" disabled={busy} onClick={() => void call(`${base}/entries/${e.id}`, { method: "DELETE" }, "Entry removed from the draft.")}>
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="form-error">This chapter is empty. Add an entry before publishing.</p>
              )}
            </div>
          ))}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void call(`${base}/chapters`, { method: "POST", json: { title: chapterTitle } }, "Chapter added.").then((ok) => ok && setChapterTitle(""));
            }}
          >
            <label htmlFor="b-chapter">New chapter title</label>
            <input id="b-chapter" type="text" value={chapterTitle} maxLength={120} onChange={(e) => setChapterTitle(e.target.value)} />
            <div className="toolbar">
              <button type="submit" className="btn secondary" disabled={busy || !chapterTitle.trim()}>
                Add chapter
              </button>
            </div>
          </form>

          {book.chapters.length ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const json: Record<string, string> = { chapterId: entry.chapterId || book.chapters[0]!.id, kind: entry.kind };
                if (entry.heading.trim()) json.heading = entry.heading;
                if (entry.body.trim()) json.body = entry.body;
                if (entry.kind === "photo" && entry.mediaId) json.mediaId = entry.mediaId;
                if (entry.credit.trim()) json.credit = entry.credit;
                void call(`${base}/entries`, { method: "POST", json }, "Entry added to the draft.").then((ok) => ok && setEntry((x) => ({ ...x, heading: "", body: "", mediaId: "", credit: "" })));
              }}
            >
              <h3 className="section-title">Add an entry</h3>
              <label htmlFor="e-chapter">Chapter</label>
              <select id="e-chapter" value={entry.chapterId || book.chapters[0]!.id} onChange={(e) => setEntry({ ...entry, chapterId: e.target.value })}>
                {book.chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <label htmlFor="e-kind">Kind</label>
              <select id="e-kind" value={entry.kind} onChange={(e) => setEntry({ ...entry, kind: e.target.value as typeof entry.kind })}>
                <option value="letter">Letter or message</option>
                <option value="story">Memory or story</option>
                <option value="photo">Photograph</option>
              </select>
              <label htmlFor="e-heading">Heading (optional)</label>
              <input id="e-heading" type="text" value={entry.heading} maxLength={160} onChange={(e) => setEntry({ ...entry, heading: e.target.value })} />
              {entry.kind === "photo" ? (
                <>
                  <label htmlFor="e-photo">Photograph</label>
                  <select id="e-photo" value={entry.mediaId} onChange={(e) => setEntry({ ...entry, mediaId: e.target.value })} aria-describedby="e-photo-hint">
                    <option value="">Choose a photograph…</option>
                    {photos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.altText}
                        {p.consent === "approved" ? "" : " (permission recorded, not yet reviewed)"}
                      </option>
                    ))}
                  </select>
                  <p id="e-photo-hint" className="form-hint">
                    Photographs come from the family&apos;s uploads (use &ldquo;Share a moment&rdquo; to add one). Adding one here confirms you have reviewed its recorded permission.
                  </p>
                  <label htmlFor="e-body">Caption (optional)</label>
                </>
              ) : (
                <label htmlFor="e-body">Text</label>
              )}
              <textarea id="e-body" value={entry.body} maxLength={5000} onChange={(e) => setEntry({ ...entry, body: e.target.value })} />
              <label htmlFor="e-credit">From (as the family wants it credited, optional)</label>
              <input id="e-credit" type="text" value={entry.credit} maxLength={120} onChange={(e) => setEntry({ ...entry, credit: e.target.value })} />
              <div className="toolbar">
                <button type="submit" className="btn secondary" disabled={busy}>
                  Add entry
                </button>
              </div>
            </form>
          ) : null}

          <div className="toolbar">
            <button type="button" className="btn" disabled={busy} onClick={() => void call(`${base}/publish`, { method: "POST" }, "Published. Readers now see this version of the book.")}>
              Publish this version
            </button>
          </div>
        </>
      ) : null}
      <p className="status-line" data-tone={msg?.tone} role="status" aria-live="polite">
        {msg?.text}
      </p>
    </section>
  );
}
