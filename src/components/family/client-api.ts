"use client";

export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; status: number; code: string; message: string; fields?: Record<string, string> };

const OFFLINE = "You appear to be offline or the site could not be reached. Nothing was lost; try again when you are connected.";

/** Same-origin JSON/FormData call to the family API with stable error handling. */
export async function familyFetch<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<ApiResult<T>> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  let body = rest.body;
  if (json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(json);
  }
  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers, body, credentials: "same-origin", cache: "no-store" });
  } catch {
    return { ok: false, status: 0, code: "network", message: OFFLINE };
  }
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON (e.g. a platform error page) */
  }
  if (res.ok) return { ok: true, status: res.status, data: payload as T };
  const err = (payload as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null)?.error;
  if (res.status === 413) {
    return { ok: false, status: 413, code: "media_too_large", message: "This photograph is too large for the server to accept. Choose a smaller copy." };
  }
  return {
    ok: false,
    status: res.status,
    code: err?.code ?? "unknown",
    message: err?.message ?? "Something went wrong. Nothing was lost; please try again.",
    fields: err?.fields,
  };
}

export function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
