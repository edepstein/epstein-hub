import { clientIp, LIMITS, sharedLimiter } from "@/lib/auth/rate-limit";
import { safeNextPath } from "@/lib/auth/redirect";
import { authPreflight, siteOrigin } from "@/lib/auth/routes";
import { readJson } from "@/lib/family/api";
import { familyError, familyJson } from "@/lib/family/errors";
import { signInSchema } from "@/lib/family/validation";
import { createRequestSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST { email, next? }: send a passwordless sign-in email (link plus one-time code) through
 * Supabase Auth. The response is the same whether or not the address belongs to a family, so it
 * never reveals membership.
 */
export async function POST(request: Request) {
  const early = authPreflight(request);
  if (early) return early;
  const body = await readJson(request, signInSchema);
  if (!body.ok) return body.response;
  const { email } = body.data;
  const next = safeNextPath(body.data.next);

  const ipCheck = sharedLimiter("sign-in-ip", LIMITS.signInPerIp).check(clientIp(request));
  const emailCheck = sharedLimiter("sign-in-email", LIMITS.signInPerEmail).check(email);
  if (!ipCheck.allowed || !emailCheck.allowed) {
    return familyError("rate_limited", { retryAfter: Math.max(ipCheck.retryAfterSeconds, emailCheck.retryAfterSeconds) });
  }

  const supabase = await createRequestSupabase();
  if (!supabase) return familyError("setup_needed");
  const redirect = new URL("/api/auth/callback", siteOrigin(request));
  redirect.searchParams.set("next", next);
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect.toString(), shouldCreateUser: true } });
  if (error) {
    const status = (error as { status?: number }).status ?? 0;
    if (status === 429) return familyError("rate_limited", { retryAfter: 60 });
    if (status >= 500 || error.name === "AuthRetryableFetchError") return familyError("service_unavailable");
    // Other refusals (e.g. sign-ups disabled) get the same neutral answer.
  }
  return familyJson({ sent: true, message: "If that address can receive email, a sign-in link and code are on their way." });
}
