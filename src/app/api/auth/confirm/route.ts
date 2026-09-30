import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNextPath } from "@/lib/auth/redirect";
import { redirectTo } from "@/lib/auth/routes";
import { createRequestSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TYPES = new Set<EmailOtpType>(["email", "magiclink", "signup", "invite"]);

/**
 * GET ?token_hash&type&next: server-side email-link verification. Works when the link is opened
 * on a different device from the one that asked for it (recommended email template: see
 * docs/FAMILY-SPACE.md).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  const supabase = await createRequestSupabase();
  if (!supabase) return redirectTo(request, "/sign-in");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  if (!tokenHash || !type || !TYPES.has(type)) return redirectTo(request, `/sign-in?error=link&next=${encodeURIComponent(next)}`);
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) return redirectTo(request, `/sign-in?error=link&next=${encodeURIComponent(next)}`);
  return redirectTo(request, next);
}
