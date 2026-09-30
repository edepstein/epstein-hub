import { dbFailure, isUuid, memberRoute, readJson } from "@/lib/family/api";
import { familyError, familyJson } from "@/lib/family/errors";
import { memberUpdateSchema } from "@/lib/family/validation";

export const dynamic = "force-dynamic";

/**
 * PATCH { role?, status?, displayName? }: curator changes a member's role, revokes or restores
 * access. Revocation takes effect on the member's next request (RLS checks status every query).
 */
export const PATCH = memberRoute<{ familyId: string; userId: string }>({ action: "manage_members" }, async ({ supabase, familyId }, request, { userId }) => {
  if (!isUuid(userId)) return familyError("not_found");
  const body = await readJson(request, memberUpdateSchema);
  if (!body.ok) return body.response;
  const patch: Record<string, string> = {};
  if (body.data.role) patch.role = body.data.role;
  if (body.data.status) patch.status = body.data.status;
  if (body.data.displayName) patch.display_name = body.data.displayName;
  const { data, error } = await supabase
    .from("family_memberships")
    .update(patch)
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .select("user_id, role, status, display_name")
    .maybeSingle();
  if (error) return dbFailure(error);
  if (!data) return familyError("not_found");
  return familyJson({ member: { userId: data.user_id, role: data.role, status: data.status, displayName: data.display_name } });
});
