"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";

/**
 * A family photograph served only through the authenticated media proxy. Click or Enter
 * enlarges it in a modal (Escape closes, focus returns). If the photo is no longer available
 * (withdrawn, access changed, network), the surrounding text stays and a retry is offered.
 */
export function PrivatePhoto({
  familyId,
  mediaId,
  alt,
  width,
  height,
  downloadAllowed = false,
}: {
  familyId: string;
  mediaId: string;
  alt: string;
  width?: number | null;
  height?: number | null;
  downloadAllowed?: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [open, setOpen] = useState(false);
  const src = `/api/family/${familyId}/media/${mediaId}${attempt ? `?r=${attempt}` : ""}`;

  if (state === "failed") {
    return (
      <div className="photo-frame">
        <div className="photo-missing" role="status">
          <p>
            This photograph could not be shown. It may have been withdrawn, or the connection dropped.
            <br />
            <span className="sr-only">Description: </span>
            {alt}
          </p>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setState("loading");
              setAttempt((a) => a + 1);
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <figure className="photo-frame" style={{ margin: "0 0 18px" }}>
      <button type="button" className="photo-button" onClick={() => setOpen(true)} aria-label={`Enlarge photograph: ${alt}`}>
        {state === "loading" ? (
          <span className="photo-loading" aria-hidden="true">
            Loading photograph…
          </span>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element -- private, authenticated, never optimised or cached */}
        <img
          key={attempt}
          src={src}
          alt={alt}
          width={width ?? undefined}
          height={height ?? undefined}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          style={state === "loading" ? { position: "absolute", opacity: 0, width: 1, height: 1 } : undefined}
          onLoad={() => setState("ready")}
          onError={() => setState("failed")}
        />
        <span className="photo-hint">Select to enlarge</span>
      </button>
      {downloadAllowed ? (
        <p className="form-hint">
          <a className="text-link" href={`/api/family/${familyId}/media/${mediaId}?download=1`}>
            Download photo
          </a>{" "}
          (saves a copy on this device; the family has allowed this).
        </p>
      ) : null}
      <Dialog open={open} onClose={() => setOpen(false)} title="Photograph">
        <div className="photo-dialog">
          {/* eslint-disable-next-line @next/next/no-img-element -- private, authenticated */}
          <img src={src} alt={alt} referrerPolicy="no-referrer" />
          <p>{alt}</p>
        </div>
      </Dialog>
    </figure>
  );
}
