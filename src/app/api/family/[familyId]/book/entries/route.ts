import { dbFailure, memberRoute, readJson } from "@/lib/family/api";
import { familyError, familyJson } from "@/lib/family/errors";
import { entryCreateSchema } from "@/lib/family/validation";

export const dynamic = "force-dynamic";

/**
 * POST { chapterId, kind, heading?, body?, mediaId?, credit? }: add an entry to a draft chapter
 * (curator). Placing a photograph in the book is the curator's review of its recorded
 * permission, so the photo's consent is marked approved; a photo without any recorded
 * permission is refused.
 */
export const POST = memberRoute<{ familyId: string }>({ action: "compose_book" }, async ({ supabase, familyId }, request) => {
  const body = await readJson(request, entryCreateSchema);
  if (!body.ok) return body.response;
  const { chapterId, kind, heading, body: text, mediaId, credit } = body.data;

  const { data: chapter } = await supabase.from("book_chapters").select("id").eq("id", chapterId).eq("family_id", familyId).maybeSingle();
  if (!chapter) return familyError("not_found");

  if (kind === "photo" && mediaId) {
    const { data: media } = await supabase
      .from("family_media")
      .select("id, processing_status, consent_status")
      .eq("id", mediaId)
      .eq("family_id", familyId)
      .maybeSingle();
    if (!media) return familyError("invalid_reference");
    if (media.processing_status !== "ready" || media.consent_status === "withdrawn") return familyError("media_not_ready");
    const { data: consent } = await supabase.from("consent_records").select("id").eq("media_id", mediaId).is("withdrawn_at", null).limit(1).maybeSingle();
    if (!consent) return familyError("consent_missing");
    if (media.consent_status !== "approved") {
      const { error } = await supabase.from("family_media").update({ consent_status: "approved" }).eq("id", mediaId);
      if (error) return dbFailure(error);
    }
  }

  const { data: last } = await supabase.from("book_entries").select("position").eq("chapter_id", chapterId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("book_entries")
    .insert({
      family_id: familyId,
      chapter_id: chapterId,
      kind,
      heading: heading || null,
      body: kind === "photo" ? text || null : text,
      media_id: kind === "photo" ? mediaId : null,
      contributor_credit: credit || null,
      position: (last ? Number(last.position) : -1) + 1,
    })
    .select("id")
    .single();
  if (error) return dbFailure(error);
  return familyJson({ entry: { id: data.id } }, 201);
});
