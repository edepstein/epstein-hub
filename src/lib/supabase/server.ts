import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

/**
 * Supabase client bound to the current request's auth cookies (server only). Every query runs
 * as the signed-in user, so Postgres RLS is the enforcement layer. Server Components cannot
 * write cookies; the proxy (src/proxy.ts) refreshes and persists sessions before rendering.
 */
export async function createRequestSupabase(): Promise<SupabaseClient | null> {
  const env = getSupabaseEnv();
  if (!env) return null;
  const store = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: the proxy persists refreshed cookies instead.
        }
      },
    },
  });
}
