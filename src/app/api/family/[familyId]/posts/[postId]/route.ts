import { dbFailure, isUuid, memberRoute, readJson } from "@/lib/family/api";
import { allowedPostActions, type PostStatus } from "@/lib/family/authz";
import { familyError, familyJson } from "@/lib/family/errors";
import { postActionSchema } from "@/lib/family/validation";

export const dynamic = "force-dynamic";

type P = { familyId: string; postId: string };

/**
 * PATCH { action, version, caption? }: author edits/submits/unsubmits/deletes own drafts;
 * curator approves/withdraws/deletes (moderate_family_post RPC). Version guards concurrent edits.
 */
export const PATCH = memberRoute<P>({ action: "read" }, async ({ supabase, user, familyId, membership }, request, { postId }) => {
  if (!isUuid(postId)) return familyError("not_found");
  const body = await readJson(request, postActionSchema);
  if (!body.ok) return body.response;
  const { action, version, caption } = body.data;

  const { data: post, error } = await supabase
    .from("family_posts")
    .select("id, status, version, author_id")
    .eq("id", postId)
    .eq("family_id", familyId)
    .maybeSingle();
  if (error) return dbFailure(error);
  if (!post) return familyError("not_found");
  const allowed = allowedPostActions(membership, { status: post.status as PostStatus, isAuthor: post.author_id === user.id });
  const need = action === "update" ? "edit" : action;
  if (!allowed.includes(need)) return familyError(post.author_id === user.id || membership.role === "curator" ? "invalid_transition" : "forbidden");
  if (post.version !== version) return familyError("version_conflict");

  if (action === "approve" || action === "withdraw" || (action === "delete" && membership.role === "curator" && post.author_id !== user.id)) {
    const { data, error: rpcErr } = await supabase.rpc("moderate_family_post", { p_post_id: postId, p_action: action, p_version: version });
    if (rpcErr) return dbFailure(rpcErr);
    return familyJson({ post: { id: postId, version: data } });
  }

  const patch: Record<string, unknown> = {};
  if (action === "update") {
    if (caption === undefined) return familyError("invalid_input", { fields: { caption: "Nothing to change." } });
    patch.caption = caption;
  }
  if (action === "submit") {
    patch.status = "submitted";
    if (caption !== undefined) patch.caption = caption;
  }
  if (action === "unsubmit") patch.status = "draft";
  if (action === "delete") {
    // A deleted row is no longer readable, so do not ask for it back; check the count instead.
    const { count, error: delErr } = await supabase
      .from("family_posts")
      .update({ status: "deleted" }, { count: "exact" })
      .eq("id", postId)
      .eq("version", version);
    if (delErr) return dbFailure(delErr);
    if (!count) return familyError("version_conflict");
    return familyJson({ post: { id: postId, status: "deleted" } });
  }

  const { data: updated, error: upErr } = await supabase
    .from("family_posts")
    .update(patch)
    .eq("id", postId)
    .eq("version", version)
    .select("id, status, version")
    .maybeSingle();
  if (upErr) return dbFailure(upErr);
  if (!updated) return familyError("version_conflict");
  return familyJson({ post: updated });
});
