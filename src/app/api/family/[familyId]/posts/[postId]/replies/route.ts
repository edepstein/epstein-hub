import { LIMITS } from "@/lib/auth/rate-limit";
import { dbFailure, isUuid, memberRoute, readJson } from "@/lib/family/api";
import { familyError, familyJson } from "@/lib/family/errors";
import { memberNames } from "@/lib/family/repo";
import { replySchema } from "@/lib/family/validation";

export const dynamic = "force-dynamic";

type P = { familyId: string; postId: string };

/** GET: replies on a published post. */
export const GET = memberRoute<P>({ action: "read" }, async ({ supabase, familyId }, _request, { postId }) => {
  if (!isUuid(postId)) return familyError("not_found");
  const { data, error } = await supabase
    .from("family_comments")
    .select("id, author_id, body, created_at")
    .eq("family_id", familyId)
    .eq("post_id", postId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) return dbFailure(error);
  const names = await memberNames(supabase, familyId);
  return familyJson({
    replies: (data ?? []).map((r) => ({ id: r.id, authorId: r.author_id, authorName: names.get(r.author_id) ?? "A family member", body: r.body, createdAt: r.created_at })),
  });
});

/** POST { body }: text reply from any active member on a published post. */
export const POST = memberRoute<P>({ action: "reply", rateLimit: { name: "reply", rule: LIMITS.replyPerUser } }, async ({ supabase, user, familyId }, request, { postId }) => {
  if (!isUuid(postId)) return familyError("not_found");
  const body = await readJson(request, replySchema);
  if (!body.ok) return body.response;
  const { data, error } = await supabase
    .from("family_comments")
    .insert({ family_id: familyId, post_id: postId, author_id: user.id, body: body.data.body })
    .select("id, created_at")
    .single();
  // RLS refuses replies to posts that are not published (or not in this family): conceal as 404.
  if (error) return error.code === "42501" || error.code === "23503" ? familyError("not_found") : dbFailure(error);
  return familyJson({ reply: { id: data.id, createdAt: data.created_at } }, 201);
});
