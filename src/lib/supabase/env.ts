/**
 * Supabase configuration. Only public values are read here: the project URL and the
 * publishable (anon) key. The app never uses a service-role key.
 * Returns null when the family space is not configured, which every family page and API
 * turns into an explicit "setup needed" state (never a fake login).
 */
export interface SupabaseEnv {
  url: string;
  key: string;
}

type Env = Record<string, string | undefined>;

export function getSupabaseEnv(env: Env = process.env): SupabaseEnv | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  if (!url || !key) return null;
  try {
    const u = new URL(url);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return null;
  } catch {
    return null;
  }
  return { url, key };
}

export function isFamilyConfigured(): boolean {
  return getSupabaseEnv() !== null;
}

/** Canonical public origin for auth redirects and CSRF checks (falls back to the request origin). */
export function configuredSiteOrigin(env: Env = process.env): string | null {
  const raw = env.FAMILY_SITE_ORIGIN?.trim() || env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}
