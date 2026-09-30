import { MEDIA_REJECTION_MESSAGES, type MediaRejection } from "./media";

// Every media rejection code must have an API error entry.
type _MediaCodesCovered = MediaRejection extends keyof typeof FAMILY_ERRORS ? true : never;
export const MEDIA_CODES_COVERED: _MediaCodesCovered = true;

/**
 * Stable family API error codes. The HTTP status follows docs/03: 400 malformed input,
 * 401 signed out, 403 not allowed, 404 absent or deliberately concealed, 409 conflict,
 * 422 valid request that cannot be applied, 429 rate limited, 503 unavailable/setup needed.
 * Messages are plain UK English, explain recovery and never reveal another family's data.
 */
export const FAMILY_ERRORS = {
  setup_needed: [503, "The family space has not been set up yet. The site owner needs to connect its private database and sign-in."],
  service_unavailable: [503, "The family space cannot be reached just now. Please try again in a moment."],
  csrf_failed: [403, "This request did not come from the Word Club site, so it was refused."],
  signed_out: [401, "Please sign in to use the family space."],
  forbidden: [403, "Your role in this family does not allow that."],
  access_revoked: [403, "Your access to this family space has been removed. Ask the family curator if you think this is a mistake."],
  not_found: [404, "That item could not be found. It may have been removed."],
  invalid_input: [400, "Some of the details were not valid. Check the highlighted fields and try again."],
  invalid_json: [400, "The request could not be read."],
  version_conflict: [409, "This was changed elsewhere. Reload to see the latest version before trying again."],
  duplicate: [409, "That has already been done."],
  invalid_transition: [422, "That step is not possible for this item in its current state."],
  invalid_reference: [422, "That photograph or item does not belong to this family."],
  rate_limited: [429, "Too many attempts. Please wait a few minutes and try again."],
  last_curator: [409, "A family needs at least one active curator. Make someone else a curator first."],
  invite_not_found: [404, "This invitation link is not valid. Check you copied the whole link, or ask for a new invitation."],
  invite_expired: [409, "This invitation has expired. Ask the family curator to send a new one."],
  invite_used: [409, "This invitation has already been used. If it was you, simply sign in; otherwise ask for a new invitation."],
  invite_revoked: [409, "This invitation was cancelled by the family curator. Ask them for a new one if needed."],
  invite_email_mismatch: [403, "This invitation was sent to a different email address. Sign in with the invited address, or ask for a new invitation."],
  email_unverified: [403, "Please confirm your email address by signing in with the emailed link or code, then try again."],
  book_empty: [422, "Add at least one chapter before publishing the book."],
  chapter_empty: [422, "Every chapter needs at least one entry before the book can be published."],
  media_not_ready: [422, "A photograph is still being checked, failed to upload or had its permission withdrawn."],
  consent_missing: [422, "A photograph has no recorded permission, so it cannot be published."],
  post_empty: [422, "Add a caption or a photograph before submitting."],
  upload_failed: [503, "The photograph could not be stored. Your caption and details are kept; please try again."],
  audio_not_enabled: [422, "Audio recordings are not switched on for this family yet. Please add a written message instead."],
  media_empty: [422, MEDIA_REJECTION_MESSAGES.media_empty],
  media_too_large: [422, MEDIA_REJECTION_MESSAGES.media_too_large],
  media_unsupported: [422, MEDIA_REJECTION_MESSAGES.media_unsupported],
  media_heic: [422, MEDIA_REJECTION_MESSAGES.media_heic],
  media_corrupt: [422, MEDIA_REJECTION_MESSAGES.media_corrupt],
  media_dimensions: [422, MEDIA_REJECTION_MESSAGES.media_dimensions],
  audio_too_long: [422, MEDIA_REJECTION_MESSAGES.audio_too_long],
} as const satisfies Record<string, readonly [number, string]>;

export type FamilyErrorCode = keyof typeof FAMILY_ERRORS;

export interface FamilyErrorBody {
  error: { code: FamilyErrorCode; message: string; fields?: Record<string, string> };
}

export const PRIVATE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  Vary: "Cookie",
};

export function errorStatus(code: FamilyErrorCode): number {
  return FAMILY_ERRORS[code][0];
}

export function errorBody(code: FamilyErrorCode, fields?: Record<string, string>): FamilyErrorBody {
  return { error: { code, message: FAMILY_ERRORS[code][1], ...(fields ? { fields } : {}) } };
}

export function familyError(code: FamilyErrorCode, init: { fields?: Record<string, string>; retryAfter?: number } = {}): Response {
  const headers: Record<string, string> = { ...PRIVATE_HEADERS };
  if (init.retryAfter) headers["Retry-After"] = String(init.retryAfter);
  return Response.json(errorBody(code, init.fields), { status: errorStatus(code), headers });
}

export function familyJson(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: PRIVATE_HEADERS });
}

const KNOWN = new Set(Object.keys(FAMILY_ERRORS));

/**
 * Map a PostgREST / Postgres error to a stable code. RPCs raise stable keys as the message;
 * SQLSTATEs cover RLS refusals, missing rows and constraint failures.
 */
export function mapDbError(err: { code?: string | null; message?: string | null } | null | undefined): FamilyErrorCode {
  if (!err) return "service_unavailable";
  const msg = (err.message ?? "").trim();
  if (KNOWN.has(msg)) return msg as FamilyErrorCode;
  switch (err.code) {
    case "42501":
      return "forbidden";
    case "P0002":
    case "PGRST116":
      return "not_found";
    case "23503":
      return "invalid_reference";
    case "23505":
      return "duplicate";
    case "23514":
    case "22P02":
    case "22023":
    case "22001":
      return "invalid_input";
    case "28000":
      return "signed_out";
    default:
      return "service_unavailable";
  }
}
