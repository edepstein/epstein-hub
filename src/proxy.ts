import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Next 16 proxy (formerly middleware), limited to the private family routes. It refreshes the
 * Supabase session and writes rotated auth cookies before Server Components render, so a
 * refreshed refresh-token is never lost. It makes no authorisation decisions: those happen in
 * the pages/APIs and in Postgres RLS on every request.
 */
export async function proxy(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  try {
    await supabase.auth.getUser();
  } catch {
    // Auth service unreachable: pages render their own unavailable state.
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/family/:path*", "/family", "/sign-in", "/api/family/:path*", "/api/auth/:path*"],
};
