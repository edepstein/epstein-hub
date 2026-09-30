import { dbFailure, isUuid, memberRoute } from "@/lib/family/api";
import { familyError, familyJson } from "@/lib/family/errors";

export const dynamic = "force-dynamic";

/** DELETE: the reply's author (or a curator) removes it (soft delete). */
export const DELETE = memberRoute<{ familyId: string; replyId: string }>({ action: "reply" }, async ({ supabase, familyId }, _request, { replyId }) => {
  if (!isUuid(replyId)) return familyError("not_found");
  const { count, error } = await supabase
    .from("family_comments")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", replyId)
    .eq("family_id", familyId)
    .is("deleted_at", null);
  if (error) return dbFailure(error);
  if (!count) return familyError("not_found");
  return familyJson({ deleted: true });
});
