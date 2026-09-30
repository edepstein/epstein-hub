import { checkRequestOrigin } from "./csrf";
import { configuredSiteOrigin, getSupabaseEnv } from "@/lib/supabase/env";
import { familyError } from "@/lib/family/errors";

/** Shared preconditions for /api/auth mutations: configured service and same-origin request. */
export function authPreflight(request: Request): Response | null {
  if (!getSupabaseEnv()) return familyError("setup_needed");
  if (!checkRequestOrigin(request, configuredSiteOrigin())) return familyError("csrf_failed");
  return null;
}

export function siteOrigin(request: Request): string {
  return configuredSiteOrigin() ?? new URL(request.url).origin;
}

/** Redirect within this site; the path must already be sanitised with safeNextPath. */
export function redirectTo(request: Request, path: string): Response {
  return new Response(null, { status: 303, headers: { Location: new URL(path, siteOrigin(request)).toString(), "Cache-Control": "private, no-store" } });
}
