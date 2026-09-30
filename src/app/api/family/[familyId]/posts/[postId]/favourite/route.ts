import { dbFailure, isUuid, memberRoute } from "@/lib/family/api";
import { familyError, familyJson } from "@/lib/family/errors";

export const dynamic = "force-dynamic";

type P = { familyId: string; postId: string };

/** POST: favourite a published post (private to the caller). Idempotent. */
export const POST = memberRoute<P>({ action: "favourite" }, async ({ supabase, user, familyId }, _request, { postId }) => {
  if (!isUuid(postId)) return familyError("not_found");
  const { error } = await supabase
    .from("family_favourites")
    .upsert({ family_id: familyId, user_id: user.id, post_id: postId }, { onConflict: "user_id,post_id", ignoreDuplicates: true });
  if (error) return error.code === "42501" ? familyError("not_found") : dbFailure(error);
  return familyJson({ favourited: true });
});

/** DELETE: remove the caller's favourite. Idempotent. */
export const DELETE = memberRoute<P>({ action: "favourite" }, async ({ supabase, user }, _request, { postId }) => {
  if (!isUuid(postId)) return familyError("not_found");
  const { error } = await supabase.from("family_favourites").delete().eq("user_id", user.id).eq("post_id", postId);
  if (error) return dbFailure(error);
  return familyJson({ favourited: false });
});
