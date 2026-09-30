import { authPreflight } from "@/lib/auth/routes";
import { familyJson } from "@/lib/family/errors";
import { createRequestSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** POST: end the session on this device. */
export async function POST(request: Request) {
  const early = authPreflight(request);
  if (early) return early;
  const supabase = await createRequestSupabase();
  if (supabase) await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  return familyJson({ signedOut: true });
}
