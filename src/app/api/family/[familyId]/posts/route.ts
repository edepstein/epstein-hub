import { dbFailure, memberRoute, readJson } from "@/lib/family/api";
import { can } from "@/lib/family/authz";
import { familyError, familyJson } from "@/lib/family/errors";
import { decodeCursor, listFeed, listForModeration, listMyPosts } from "@/lib/family/repo";
import { createPostSchema } from "@/lib/family/validation";

export const dynamic = "force-dynamic";

/** GET: published feed (cursor), or ?scope=mine (own drafts) / ?scope=review (curator queue). */
export const GET = memberRoute<{ familyId: string }>({ action: "read" }, async ({ supabase, user, familyId, membership }, request) => {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "feed";
  if (scope === "mine") {
    if (!can(membership, "contribute")) return familyError("forbidden");
    return familyJson({ posts: await listMyPosts(supabase, familyId, user.id) });
  }
  if (scope === "review") {
    if (!can(membership, "moderate")) return familyError("forbidden");
    return familyJson(await listForModeration(supabase, familyId));
  }
  const rawCursor = url.searchParams.get("cursor");
  const cursor = decodeCursor(rawCursor);
  if (rawCursor && !cursor) return familyError("invalid_input");
  return familyJson(await listFeed(supabase, familyId, { cursor, limit: 10 }));
});

/** POST: create a draft (or submit for review) from the caller's own verified media. */
export const POST = memberRoute<{ familyId: string }>({ action: "contribute" }, async ({ supabase, user, familyId }, request) => {
  const body = await readJson(request, createPostSchema);
  if (!body.ok) return body.response;
  const { caption, mediaIds, submit, clientRequestId } = body.data;

  if (clientRequestId) {
    const { data: existing } = await supabase
      .from("family_posts")
      .select("id, status, version")
      .eq("author_id", user.id)
      .eq("client_request_id", clientRequestId)
      .maybeSingle();
    if (existing) return familyJson({ post: existing, duplicate: true }, 200);
  }

  if (mediaIds.length) {
    // Media must be the caller's own, in this family, and successfully processed.
    const { data: media, error } = await supabase
      .from("family_media")
      .select("id, processing_status")
      .eq("family_id", familyId)
      .eq("owner_id", user.id)
      .in("id", mediaIds);
    if (error) return dbFailure(error);
    if ((media ?? []).length !== mediaIds.length) return familyError("invalid_reference");
    if ((media ?? []).some((m) => m.processing_status !== "ready")) return familyError("media_not_ready");
  }

  const { data: post, error } = await supabase
    .from("family_posts")
    .insert({ family_id: familyId, author_id: user.id, caption, status: "draft", client_request_id: clientRequestId ?? null })
    .select("id, status, version")
    .single();
  if (error) return dbFailure(error);

  if (mediaIds.length) {
    const { error: linkErr } = await supabase
      .from("family_post_media")
      .insert(mediaIds.map((media_id, position) => ({ post_id: post.id, family_id: familyId, media_id, position })));
    if (linkErr) {
      await supabase.from("family_posts").update({ status: "deleted" }).eq("id", post.id);
      return dbFailure(linkErr);
    }
  }

  if (submit) {
    const { data: submitted, error: subErr } = await supabase
      .from("family_posts")
      .update({ status: "submitted" })
      .eq("id", post.id)
      .select("id, status, version")
      .single();
    if (subErr) return dbFailure(subErr);
    return familyJson({ post: submitted }, 201);
  }
  return familyJson({ post }, 201);
});
