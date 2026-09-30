import { LIMITS } from "@/lib/auth/rate-limit";
import { dbFailure, readJson, userRoute } from "@/lib/family/api";
import { familyJson } from "@/lib/family/errors";
import { acceptInviteSchema } from "@/lib/family/validation";

export const dynamic = "force-dynamic";

/**
 * POST { token }: accept an invitation as the signed-in user. The database checks the token hash,
 * expiry, single use, revocation, and that the account's confirmed email is the invited one.
 */
export const POST = userRoute({ rateLimit: { name: "accept", rule: LIMITS.acceptPerUser } }, async ({ supabase }, request) => {
  const body = await readJson(request, acceptInviteSchema);
  if (!body.ok) return body.response;
  const { data, error } = await supabase.rpc("accept_family_invite", { p_token: body.data.token });
  if (error) return dbFailure(error);
  return familyJson({ familyId: data });
});
