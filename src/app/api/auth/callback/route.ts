import { safeNextPath } from "@/lib/auth/redirect";
import { redirectTo } from "@/lib/auth/routes";
import { createRequestSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET ?code&next: PKCE magic-link landing (same browser that asked for the link). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  const supabase = await createRequestSupabase();
  if (!supabase) return redirectTo(request, "/sign-in");
  const code = url.searchParams.get("code");
  if (!code) return redirectTo(request, `/sign-in?error=link&next=${encodeURIComponent(next)}`);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return redirectTo(request, `/sign-in?error=link&next=${encodeURIComponent(next)}`);
  return redirectTo(request, next);
}
