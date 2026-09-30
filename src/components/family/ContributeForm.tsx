"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IMAGE_MAX_BYTES, MEDIA_REJECTION_MESSAGES, sniffMime } from "@/lib/family/media";
import { familyFetch, newRequestId } from "./client-api";

/** Files above this are resized in the browser first (keeps uploads within hosting body limits). */
export const RESIZE_ABOVE_BYTES = 4 * 1024 * 1024;
const MAX_EDGE = 2560;

type Stage = "idle" | "checking" | "uploading" | "saving" | "done" | "failed";
type Fields = { caption: string; altText: string; permissionBasis: string; peopleConfirmed: boolean; downloadAllowed: boolean; restrictions: string };
const EMPTY: Fields = { caption: "", altText: "", permissionBasis: "", peopleConfirmed: false, downloadAllowed: false, restrictions: "" };

async function resizeInBrowser(file: Blob): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.86));
  } catch {
    return null;
  }
}

/** Client-side checks mirror the server's (the server re-validates the real bytes). */
export async function checkChosenFile(file: File): Promise<{ ok: true } | { ok: false; message: string }> {
  if (file.size === 0) return { ok: false, message: MEDIA_REJECTION_MESSAGES.media_empty };
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const kind = sniffMime(head);
  if (kind === "image/heic") return { ok: false, message: MEDIA_REJECTION_MESSAGES.media_heic };
  if (kind !== "image/jpeg" && kind !== "image/png" && kind !== "image/webp") return { ok: false, message: MEDIA_REJECTION_MESSAGES.media_unsupported };
  return { ok: true };
}

export function ContributeForm({ familyId, previewOnly = false }: { familyId: string | null; previewOnly?: boolean }) {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [file, setFile] = useState<Blob | null>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stage, setStage] = useState<Stage>("idle");
  const [status, setStatus] = useState<{ tone: "ok" | "error" | undefined; text: string }>({ tone: undefined, text: "" });
  const [lastIntent, setLastIntent] = useState<"draft" | "submit">("submit");
  const mediaRequest = useRef<string>(newRequestId());
  const postRequest = useRef<string>(newRequestId());
  const uploaded = useRef<{ file: Blob; mediaId: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Revoke preview object URLs when replaced or when leaving the page.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const busy = stage === "checking" || stage === "uploading" || stage === "saving";
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0] ?? null;
    setErrors((x) => ({ ...x, file: "" }));
    setFileNote(null);
    setFile(null);
    setPreview(null);
    uploaded.current = null;
    mediaRequest.current = newRequestId();
    if (!chosen) return;
    setStage("checking");
    const check = await checkChosenFile(chosen);
    if (!check.ok) {
      setErrors((x) => ({ ...x, file: check.message }));
      setStage("idle");
      return;
    }
    let use: Blob = chosen;
    if (chosen.size > RESIZE_ABOVE_BYTES) {
      const smaller = await resizeInBrowser(chosen);
      if (smaller && smaller.size < chosen.size) {
        use = smaller;
        setFileNote(`This photograph was large, so a smaller copy (${(smaller.size / 1048576).toFixed(1)} MB) will be uploaded.`);
      } else if (chosen.size > IMAGE_MAX_BYTES) {
        setErrors((x) => ({ ...x, file: MEDIA_REJECTION_MESSAGES.media_too_large }));
        setStage("idle");
        return;
      }
    }
    setFile(use);
    setPreview(URL.createObjectURL(use));
    setStage("idle");
  }

  function validate(intent: "draft" | "submit"): Record<string, string> {
    const e: Record<string, string> = {};
    if (!file && !fields.caption.trim()) e.caption = "Add a caption or choose a photograph.";
    if (fields.caption.length > 500) e.caption = "Caption must be 500 characters or fewer.";
    if (file) {
      if (!fields.altText.trim()) e.altText = "Describe the photograph for people who cannot see it.";
      if (fields.permissionBasis.trim().length < 10) e.permissionBasis = "Say how you have permission to share this (at least 10 characters).";
      if (!fields.peopleConfirmed) e.peopleConfirmed = "Confirm that everyone pictured is happy for the family to see this.";
    }
    void intent;
    return e;
  }

  async function send(intent: "draft" | "submit") {
    setLastIntent(intent);
    const e = validate(intent);
    setErrors(e);
    if (Object.keys(e).length) {
      setStatus({ tone: "error", text: "Please correct the highlighted fields." });
      const first = Object.keys(e)[0];
      document.getElementById(`c-${first}`)?.focus();
      return;
    }
    if (previewOnly || !familyId) {
      setStatus({ tone: "error", text: "Saving is switched off until the family space is set up. Nothing was uploaded or saved." });
      return;
    }
    const mediaIds: string[] = [];
    if (file) {
      if (uploaded.current?.file === file) {
        mediaIds.push(uploaded.current.mediaId);
      } else {
        setStage("uploading");
        setStatus({ tone: undefined, text: "Uploading and checking the photograph…" });
        const form = new FormData();
        form.set("file", file, "photo");
        form.set("altText", fields.altText);
        form.set("permissionBasis", fields.permissionBasis);
        form.set("peopleConfirmed", String(fields.peopleConfirmed));
        form.set("downloadAllowed", String(fields.downloadAllowed));
        if (fields.restrictions.trim()) form.set("restrictions", fields.restrictions);
        form.set("clientRequestId", mediaRequest.current);
        const up = await familyFetch<{ media: { id: string; locationRemoved?: boolean } }>(`/api/family/${familyId}/uploads`, { method: "POST", body: form });
        if (!up.ok) {
          setStage("failed");
          setErrors(up.fields ?? (up.code.startsWith("media_") ? { file: up.message } : {}));
          setStatus({ tone: "error", text: `${up.message} Your caption and details are still here.` });
          return;
        }
        uploaded.current = { file, mediaId: up.data.media.id };
        mediaIds.push(up.data.media.id);
      }
    }
    setStage("saving");
    setStatus({ tone: undefined, text: intent === "submit" ? "Sending for review…" : "Saving your draft…" });
    const r = await familyFetch<{ post: { status: string } }>(`/api/family/${familyId}/posts`, {
      method: "POST",
      json: { caption: fields.caption, mediaIds, submit: intent === "submit", clientRequestId: postRequest.current },
    });
    if (!r.ok) {
      setStage("failed");
      if (r.fields) setErrors(r.fields);
      setStatus({ tone: "error", text: `${r.message} Your caption and details are still here.` });
      return;
    }
    setStage("done");
    setStatus({
      tone: "ok",
      text:
        r.data.post.status === "submitted"
          ? "Sent to the curator for review. It will appear in the Family Window once approved; you can follow its status below."
          : "Saved as a private draft. Only you can see it until you submit it.",
    });
    setFields(EMPTY);
    setFile(null);
    setPreview(null);
    setFileNote(null);
    uploaded.current = null;
    mediaRequest.current = newRequestId();
    postRequest.current = newRequestId();
    if (fileInput.current) fileInput.current.value = "";
    router.refresh();
  }

  const err = (k: string) =>
    errors[k] ? (
      <p id={`c-${k}-error`} className="form-error">
        {errors[k]}
      </p>
    ) : null;
  const described = (k: string, hint?: string) => [hint, errors[k] ? `c-${k}-error` : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <form
      className="family-panel family-form"
      aria-labelledby="contribute-title"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void send("submit");
      }}
    >
      <h2 id="contribute-title">{previewOnly ? "Form preview: saving is switched off" : "Share a moment"}</h2>
      <p className="form-hint">A photograph and a few words in your own voice. The curator reviews each update before the family sees it.</p>

      <div className="upload-zone">
        <label htmlFor="c-file">Choose a photograph (optional)</label>
        <input
          ref={fileInput}
          id="c-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onFile}
          aria-invalid={errors.file ? true : undefined}
          aria-describedby={described("file", "c-file-hint")}
        />
        <p id="c-file-hint" className="form-hint">
          JPEG, PNG or WebP, up to 10 MB. Location and camera details are removed before it is stored.
        </p>
        {err("file")}
        {fileNote ? <p className="form-hint">{fileNote}</p> : null}
        {preview ? (
          <div className="upload-preview">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object-URL preview only */}
            <img src={preview} alt="Preview of the photograph you chose" />
            <p className="form-hint">Preview only: nothing is shared until you save or submit.</p>
          </div>
        ) : null}
      </div>

      <label htmlFor="c-caption">What is happening?</label>
      <textarea
        id="c-caption"
        value={fields.caption}
        maxLength={500}
        onChange={set("caption")}
        aria-invalid={errors.caption ? true : undefined}
        aria-describedby={described("caption", "c-caption-hint")}
      />
      <p id="c-caption-hint" className="form-hint">
        In your own words. {500 - fields.caption.length} characters left.
      </p>
      {err("caption")}

      {file ? (
        <>
          <label htmlFor="c-altText">Describe the photograph</label>
          <input
            id="c-altText"
            type="text"
            value={fields.altText}
            maxLength={300}
            onChange={set("altText")}
            aria-invalid={errors.altText ? true : undefined}
            aria-describedby={described("altText", "c-alt-hint")}
          />
          <p id="c-alt-hint" className="form-hint">
            For anyone using a screen reader, e.g. &ldquo;Two people laughing at a garden table&rdquo;.
          </p>
          {err("altText")}

          <label htmlFor="c-permissionBasis">How do you have permission to share it?</label>
          <textarea
            id="c-permissionBasis"
            value={fields.permissionBasis}
            maxLength={500}
            onChange={set("permissionBasis")}
            aria-invalid={errors.permissionBasis ? true : undefined}
            aria-describedby={described("permissionBasis", "c-perm-hint")}
          />
          <p id="c-perm-hint" className="form-hint">
            For example: &ldquo;I took it, and both people in it said yes.&rdquo; This is kept with the photo for the curator.
          </p>
          {err("permissionBasis")}

          <label className="check">
            <input id="c-peopleConfirmed" type="checkbox" checked={fields.peopleConfirmed} onChange={set("peopleConfirmed")} aria-invalid={errors.peopleConfirmed ? true : undefined} aria-describedby={described("peopleConfirmed")} />
            <span>Everyone pictured is happy for this family to see it.</span>
          </label>
          {err("peopleConfirmed")}

          <label className="check">
            <input id="c-downloadAllowed" type="checkbox" checked={fields.downloadAllowed} onChange={set("downloadAllowed")} />
            <span>Family members may download a copy (otherwise they can only view it here).</span>
          </label>

          <label htmlFor="c-restrictions">Anything the curator should know? (optional)</label>
          <input id="c-restrictions" type="text" value={fields.restrictions} maxLength={500} onChange={set("restrictions")} />
        </>
      ) : null}

      <div className="toolbar">
        <button type="submit" className="btn" disabled={busy}>
          {stage === "uploading" ? "Uploading…" : stage === "saving" ? "Saving…" : "Submit for review"}
        </button>
        <button type="button" className="btn secondary" disabled={busy} onClick={() => void send("draft")}>
          Save as draft
        </button>
        {stage === "failed" ? (
          <button type="button" className="btn secondary" onClick={() => void send(lastIntent)}>
            Try again
          </button>
        ) : null}
      </div>
      <p className="status-line" data-tone={status.tone} role="status" aria-live="polite">
        {status.text}
      </p>
    </form>
  );
}
