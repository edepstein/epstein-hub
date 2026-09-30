import { dbFailure, isUuid, memberRoute, readJson } from "@/lib/family/api";
import { familyError, familyJson } from "@/lib/family/errors";
import { chapterPatchSchema } from "@/lib/family/validation";

export const dynamic = "force-dynamic";

type P = { familyId: string; chapterId: string };

/** PATCH { title?, move? }: rename or reorder a draft chapter (curator). */
export const PATCH = memberRoute<P>({ action: "compose_book" }, async ({ supabase, familyId }, request, { chapterId }) => {
  if (!isUuid(chapterId)) return familyError("not_found");
  const body = await readJson(request, chapterPatchSchema);
  if (!body.ok) return body.response;
  if (body.data.title) {
    const { count, error } = await supabase.from("book_chapters").update({ title: body.data.title }, { count: "exact" }).eq("id", chapterId).eq("family_id", familyId);
    if (error) return dbFailure(error);
    if (!count) return familyError("not_found");
  }
  if (body.data.move) {
    const { error } = await supabase.rpc("move_book_chapter", { p_chapter_id: chapterId, p_direction: body.data.move === "up" ? -1 : 1 });
    if (error) return dbFailure(error);
  }
  return familyJson({ saved: true });
});

/** DELETE: remove a draft chapter and its entries (curator). Published snapshots are unaffected. */
export const DELETE = memberRoute<P>({ action: "compose_book" }, async ({ supabase, familyId }, _request, { chapterId }) => {
  if (!isUuid(chapterId)) return familyError("not_found");
  const { count, error } = await supabase.from("book_chapters").delete({ count: "exact" }).eq("id", chapterId).eq("family_id", familyId);
  if (error) return dbFailure(error);
  if (!count) return familyError("not_found");
  return familyJson({ deleted: true });
});
