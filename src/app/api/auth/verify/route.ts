import { LIMITS, sharedLimiter } from "@/lib/auth/rate-limit";
import { safeNextPath } from "@/lib/auth/redirect";
import { authPreflight } from "@/lib/auth/routes";
import { readJson } from "@/lib/family/api";
import { familyError, familyJson } from "@/lib/family/errors";
import { verifyCodeSchema } from "@/lib/family/validation";
import { createRequestSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** POST { email, code, next? }: verify the emailed one-time code and start a session. */
export async function POST(request: Request) {
  const early = authPreflight(request);
  if (early) return early;
  const body = await readJson(request, verifyCodeSchema);
  if (!body.ok) return body.response;
  const { email, code } = body.data;
  const limit = sharedLimiter("verify-email", LIMITS.verifyPerEmail).check(email);
  if (!limit.allowed) return familyError("rate_limited", { retryAfter: limit.retryAfterSeconds });
  const supabase = await createRequestSupabase();
  if (!supabase) return familyError("setup_needed");
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) {
    const status = (error as { status?: number }).status ?? 0;
    if (status >= 500 || error.name === "AuthRetryableFetchError") return familyError("service_unavailable");
    return familyError("invalid_input", { fields: { code: "That code is not right or has expired. Check the latest email, or send a new one." } });
  }
  return familyJson({ signedIn: true, next: safeNextPath(body.data.next) });
}
