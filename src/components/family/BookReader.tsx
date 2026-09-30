"use client";

import { useEffect, useRef, useState } from "react";
import type { BookEntrySnapshot, BookSnapshot } from "@/lib/family/repo";
import { familyFetch } from "./client-api";
import { PrivatePhoto } from "./PrivatePhoto";

/**
 * Published Birthday Book: cover, contents, one chapter at a time as a two-page spread
 * (stacked on phones), large previous/next buttons, or continuous reading. The reading position
 * is saved to the server for this member and restored next time.
 */
export function BookReader({ familyId, book, initialChapter }: { familyId: string; book: BookSnapshot; initialChapter: number | null }) {
  const total = book.chapters.length;
  // -1 is the cover; 0..n-1 are chapters.
  const [index, setIndex] = useState(() => (initialChapter === null ? -1 : Math.min(Math.max(initialChapter, 0), total - 1)));
  const [continuous, setContinuous] = useState(false);
  const [saveNote, setSaveNote] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    if (index < 0) return;
    const t = setTimeout(async () => {
      const r = await familyFetch(`/api/family/${familyId}/book/progress`, { method: "PUT", json: { chapterIndex: index } });
      setSaveNote(r.ok ? "" : "Your place could not be saved this time; it will be kept for this visit.");
    }, 400);
    return () => clearTimeout(t);
  }, [index, familyId]);

  const go = (i: number) => {
    setIndex(i);
    const url = new URL(window.location.href);
    if (i >= 0) url.searchParams.set("chapter", String(i + 1));
    else url.searchParams.delete("chapter");
    window.history.replaceState(null, "", url);
  };

  const contents = (
    <nav className="family-panel book-contents" aria-labelledby="contents-title">
      <h2 id="contents-title">Contents</h2>
      <ol>
        {book.chapters.map((c, i) => (
          <li key={i}>
            <button type="button" aria-current={i === index ? "true" : undefined} onClick={() => { setContinuous(false); go(i); }}>
              {c.title}
            </button>{" "}
            <small>
              ({c.entries.length} {c.entries.length === 1 ? "item" : "items"})
            </small>
          </li>
        ))}
      </ol>
      <div className="toolbar">
        <button type="button" className="btn secondary" aria-pressed={continuous} onClick={() => setContinuous((v) => !v)}>
          {continuous ? "Read one chapter at a time" : "Read it all on one page"}
        </button>
      </div>
    </nav>
  );

  if (continuous) {
    return (
      <>
        {contents}
        {book.chapters.map((c, i) => (
          <article key={i} className="book book-spread" aria-labelledby={`ch-${i}`} style={{ marginBottom: 24 }}>
            <Spread familyId={familyId} title={c.title} entries={c.entries} headingId={`ch-${i}`} />
          </article>
        ))}
      </>
    );
  }

  return (
    <>
      {contents}
      {index < 0 ? (
        <article className="book book-spread" aria-labelledby="book-cover-title">
          <div className="book-page book-cover">
            <div className="eyebrow">A keepsake to return to</div>
            <h2 id="book-cover-title" ref={headingRef} tabIndex={-1}>
              {book.title}
            </h2>
          </div>
          <div className="book-page book-cover">
            {book.dedication ? <blockquote>{book.dedication}</blockquote> : <p className="form-hint">Open the first chapter to begin.</p>}
          </div>
        </article>
      ) : (
        <article className="book book-spread" aria-labelledby="chapter-title">
          <Spread familyId={familyId} title={book.chapters[index]!.title} entries={book.chapters[index]!.entries} headingId="chapter-title" headingRef={headingRef} />
        </article>
      )}
      <div className="book-nav">
        <button type="button" className="btn secondary" disabled={index <= -1} onClick={() => go(index - 1)}>
          {index === 0 ? "Back to the cover" : "Previous chapter"}
        </button>
        <span aria-live="polite">{index < 0 ? "Cover" : `Chapter ${index + 1} of ${total}`}</span>
        <button type="button" className="btn" disabled={index >= total - 1} onClick={() => go(index + 1)}>
          {index < 0 ? "Open the first chapter" : "Next chapter"}
        </button>
      </div>
      {saveNote ? <p className="form-hint">{saveNote}</p> : null}
    </>
  );
}

function Spread({
  familyId,
  title,
  entries,
  headingId,
  headingRef,
}: {
  familyId: string;
  title: string;
  entries: BookEntrySnapshot[];
  headingId: string;
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
}) {
  // Facing pages: photographs on the left page, words on the right (stacked on phones).
  const photos = entries.filter((e) => e.kind === "photo");
  const words = entries.filter((e) => e.kind !== "photo");
  const left = photos.length ? photos : words.slice(0, Math.ceil(words.length / 2));
  const right = photos.length ? words : words.slice(Math.ceil(words.length / 2));
  return (
    <>
      <div className="book-page">
        <h2 id={headingId} ref={headingRef} tabIndex={-1}>
          {title}
        </h2>
        {left.map((e, i) => (
          <Entry key={`l${i}`} familyId={familyId} entry={e} />
        ))}
      </div>
      <div className="book-page">
        {right.map((e, i) => (
          <Entry key={`r${i}`} familyId={familyId} entry={e} />
        ))}
      </div>
    </>
  );
}

function Entry({ familyId, entry }: { familyId: string; entry: BookEntrySnapshot }) {
  return (
    <section className="book-entry">
      {entry.heading ? <h3>{entry.heading}</h3> : null}
      {entry.kind === "photo" && entry.mediaId ? (
        <PrivatePhoto familyId={familyId} mediaId={entry.mediaId} alt={entry.altText ?? "Family photograph"} width={entry.width} height={entry.height} />
      ) : null}
      {entry.body ? <div className="body">{entry.body}</div> : null}
      {entry.credit ? <p className="credit">From {entry.credit}</p> : null}
    </section>
  );
}
