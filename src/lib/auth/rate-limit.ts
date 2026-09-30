/**
 * Small fixed-window rate limiter for sign-in, invitation and acceptance endpoints.
 * In-process only: on a multi-instance host each instance counts separately, so the Supabase
 * Auth rate limits and the per-curator invite limit in Postgres remain the backstop
 * (documented in docs/FAMILY-SPACE.md).
 */
export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class RateLimiter {
  private hits = new Map<string, { start: number; count: number }>();
  constructor(
    private readonly rule: RateLimitRule,
    private readonly now: () => number = () => Date.now(),
    private readonly maxKeys = 10_000,
  ) {}

  check(key: string): RateLimitResult {
    const t = this.now();
    const entry = this.hits.get(key);
    if (!entry || t - entry.start >= this.rule.windowMs) {
      if (this.hits.size >= this.maxKeys) this.prune(t);
      this.hits.set(key, { start: t, count: 1 });
      return { allowed: true, remaining: this.rule.limit - 1, retryAfterSeconds: 0 };
    }
    if (entry.count >= this.rule.limit) {
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((entry.start + this.rule.windowMs - t) / 1000)) };
    }
    entry.count += 1;
    return { allowed: true, remaining: this.rule.limit - entry.count, retryAfterSeconds: 0 };
  }

  private prune(t: number) {
    for (const [k, v] of this.hits) if (t - v.start >= this.rule.windowMs) this.hits.delete(k);
    if (this.hits.size >= this.maxKeys) this.hits.clear();
  }
}

const g = globalThis as unknown as { __wcLimiters?: Record<string, RateLimiter> };

export function sharedLimiter(name: string, rule: RateLimitRule): RateLimiter {
  g.__wcLimiters ??= {};
  return (g.__wcLimiters[name] ??= new RateLimiter(rule));
}

export const LIMITS = {
  signInPerIp: { limit: 10, windowMs: 15 * 60_000 },
  signInPerEmail: { limit: 5, windowMs: 15 * 60_000 },
  verifyPerEmail: { limit: 10, windowMs: 15 * 60_000 },
  invitePerUser: { limit: 20, windowMs: 60 * 60_000 },
  acceptPerUser: { limit: 10, windowMs: 15 * 60_000 },
  replyPerUser: { limit: 30, windowMs: 10 * 60_000 },
  uploadPerUser: { limit: 30, windowMs: 10 * 60_000 },
} satisfies Record<string, RateLimitRule>;

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
