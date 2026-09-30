import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { z } from "zod";
import { checkRequestOrigin } from "@/lib/auth/csrf";
import { sharedLimiter, type RateLimitRule } from "@/lib/auth/rate-limit";
import { getSignedInUser, toMembership, type MembershipRow } from "@/lib/auth/session";
import { configuredSiteOrigin, getSupabaseEnv } from "@/lib/supabase/env";
import { can, type FamilyAction } from "./authz";
import { familyError, mapDbError, type FamilyErrorCode } from "./errors";
import { fieldErrors, uuidSchema } from "./validation";

export interface UserApiContext {
  supabase: SupabaseClient;
  user: User;
}

export interface MemberApiContext extends UserApiContext {
  familyId: string;
  membership: MembershipRow;
}

type Params = Record<string, string>;
type RouteArgs<P extends Params> = { params: Promise<P> };

interface CommonOptions {
  /** Per-user rate limit for this endpoint. */
  rateLimit?: { name: string; rule: RateLimitRule };
}

/** Log an operational failure without private payloads (no captions, emails, tokens). */
export function logFamilyFailure(route: string, code: string | undefined) {
  console.error(`[family-api] ${route} failed: ${code ?? "unknown"}`);
}

async function preflight(request: Request): Promise<Response | null> {
  if (!getSupabaseEnv()) return familyError("setup_needed");
  if (!checkRequestOrigin(request, configuredSiteOrigin())) return familyError("csrf_failed");
  return null;
}

/** Route wrapper for endpoints that need a signed-in user but no family membership yet. */
export function userRoute<P extends Params>(
  options: CommonOptions,
  handler: (ctx: UserApiContext, request: Request, params: P) => Promise<Response>,
) {
  return async (request: Request, args: RouteArgs<P>): Promise<Response> => {
    const early = await preflight(request);
    if (early) return early;
    const u = await getSignedInUser();
    if (u.kind === "setup-needed") return familyError("setup_needed");
    if (u.kind === "unavailable") return familyError("service_unavailable");
    if (u.kind === "signed-out") return familyError("signed_out");
    if (options.rateLimit) {
      const r = sharedLimiter(options.rateLimit.name, options.rateLimit.rule).check(u.user.id);
      if (!r.allowed) return familyError("rate_limited", { retryAfter: r.retryAfterSeconds });
    }
    try {
      return await handler({ supabase: u.supabase, user: u.user }, request, await args.params);
    } catch (e) {
      logFamilyFailure(new URL(request.url).pathname.replace(/[0-9a-f-]{36}/g, ":id"), (e as { code?: string }).code);
      return familyError("service_unavailable");
    }
  };
}

/**
 * Route wrapper for /api/family/[familyId]/...: setup check, same-origin check for mutations,
 * verified user, active membership of THIS family (a client-supplied family id is never trusted),
 * then an early role check. RLS re-checks every query the handler makes.
 */
export function memberRoute<P extends Params & { familyId: string }>(
  options: CommonOptions & { action: FamilyAction },
  handler: (ctx: MemberApiContext, request: Request, params: P) => Promise<Response>,
) {
  return userRoute<P>({}, async ({ supabase, user }, request, params) => {
    if (!uuidSchema.safeParse(params.familyId).success) return familyError("not_found");
    const { data, error } = await supabase
      .from("family_memberships")
      .select("family_id, user_id, role, status, display_name")
      .eq("family_id", params.familyId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return familyError(mapDbError(error));
    if (!data) return familyError("not_found");
    const membership = toMembership(data);
    if (membership.status !== "active") return familyError("access_revoked");
    if (!can(membership, options.action)) return familyError("forbidden");
    if (options.rateLimit) {
      const r = sharedLimiter(options.rateLimit.name, options.rateLimit.rule).check(user.id);
      if (!r.allowed) return familyError("rate_limited", { retryAfter: r.retryAfterSeconds });
    }
    return handler({ supabase, user, familyId: params.familyId, membership }, request, params);
  });
}

/** Parse and validate a JSON body; returns the data or a ready 400 response. */
export async function readJson<S extends z.ZodType>(request: Request, schema: S): Promise<{ ok: true; data: z.output<S> } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: familyError("invalid_json") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, response: familyError("invalid_input", { fields: fieldErrors(parsed.error) }) };
  return { ok: true, data: parsed.data };
}

export function dbFailure(error: { code?: string | null; message?: string | null } | null): Response {
  const code: FamilyErrorCode = mapDbError(error);
  if (code === "service_unavailable") logFamilyFailure("db", error?.code ?? undefined);
  return familyError(code);
}

export function isUuid(value: string | undefined): value is string {
  return !!value && uuidSchema.safeParse(value).success;
}
