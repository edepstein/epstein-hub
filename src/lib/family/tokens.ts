import { createHash, randomBytes } from "node:crypto";

/** Invitation secrets: 32 random bytes, base64url. Only the sha256 hex digest is stored. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isPlausibleInviteToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(token);
}

export const INVITE_MAX_DAYS = 30;
export const INVITE_DEFAULT_DAYS = 7;

export function inviteExpiry(days: number, now: Date = new Date()): Date {
  const d = Math.min(INVITE_MAX_DAYS, Math.max(1, Math.round(days)));
  // Stay a minute inside the database's 30-day ceiling to allow for clock skew.
  const ms = d * 86_400_000 - (d === INVITE_MAX_DAYS ? 60_000 : 0);
  return new Date(now.getTime() + ms);
}
