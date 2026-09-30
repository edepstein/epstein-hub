import { LIMITS } from "@/lib/auth/rate-limit";
import { configuredSiteOrigin } from "@/lib/supabase/env";
import { dbFailure, memberRoute, readJson } from "@/lib/family/api";
import { familyJson } from "@/lib/family/errors";
import { inviteState, listInvites } from "@/lib/family/repo";
import { generateInviteToken, hashInviteToken, inviteExpiry } from "@/lib/family/tokens";
import { inviteSchema } from "@/lib/family/validation";

export const dynamic = "force-dynamic";

/** GET: curator's invitation list with states (the raw token is never retrievable again). */
export const GET = memberRoute<{ familyId: string }>({ action: "invite" }, async ({ supabase, familyId }) => {
  const invites = await listInvites(supabase, familyId);
  return familyJson({ invites: invites.map((i) => ({ ...i, state: inviteState(i) })) });
});

/**
 * POST { email, displayName, role, expiresInDays }: creates a single-use invitation and returns
 * its link ONCE for the curator to send personally. Only the token's hash is stored.
 */
export const POST = memberRoute<{ familyId: string }>(
  { action: "invite", rateLimit: { name: "invite", rule: LIMITS.invitePerUser } },
  async ({ supabase, user, familyId }, request) => {
    const body = await readJson(request, inviteSchema);
    if (!body.ok) return body.response;
    const { email, displayName, role, expiresInDays } = body.data;
    const token = generateInviteToken();
    const expiresAt = inviteExpiry(expiresInDays);
    const { data, error } = await supabase
      .from("family_invites")
      .insert({ family_id: familyId, invited_email: email, display_name: displayName, role, token_hash: hashInviteToken(token), expires_at: expiresAt.toISOString(), invited_by: user.id })
      .select("id, expires_at")
      .single();
    if (error) return dbFailure(error);
    const origin = configuredSiteOrigin() ?? new URL(request.url).origin;
    return familyJson({ invite: { id: data.id, expiresAt: data.expires_at, url: `${origin}/family/invite/${token}` } }, 201);
  },
);
