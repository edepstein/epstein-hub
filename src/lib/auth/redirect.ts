/**
 * Safe post-sign-in redirect: only same-site paths inside the family space are allowed.
 * Anything else (absolute URLs, protocol-relative //host, backslashes, encoded tricks) falls
 * back to /family.
 */
const ALLOWED_PREFIXES = ["/family"];

export function safeNextPath(raw: string | null | undefined, fallback = "/family"): string {
  if (!raw || typeof raw !== "string") return fallback;
  let value = raw.trim();
  try {
    // Reject values that only look safe before decoding (e.g. "/%2F%2Fevil.example").
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || decoded.includes("\\")) return fallback;
  } catch {
    return fallback;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return fallback;
  let url: URL;
  try {
    url = new URL(value, "https://word-club.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "https://word-club.invalid") return fallback;
  value = url.pathname + url.search;
  if (!ALLOWED_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) return fallback;
  return value;
}
