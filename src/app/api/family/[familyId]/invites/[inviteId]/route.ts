import { dbFailure, isUuid, memberRoute } from "@/lib/family/api";
import { familyError, familyJson } from "@/lib/family/errors";

export const dynamic = "force-dynamic";

/** DELETE: revoke a pending invitation (curator). */
export const DELETE = memberRoute<{ familyId: string; inviteId: string }>({ action: "invite" }, async ({ supabase, familyId }, _request, { inviteId }) => {
  if (!isUuid(inviteId)) return familyError("not_found");
  const { count, error } = await supabase
    .from("family_invites")
    .update({ revoked_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", inviteId)
    .eq("family_id", familyId)
    .is("accepted_at", null)
    .is("revoked_at", null);
  if (error) return dbFailure(error);
  if (!count) return familyError("invalid_transition");
  return familyJson({ revoked: true });
});
