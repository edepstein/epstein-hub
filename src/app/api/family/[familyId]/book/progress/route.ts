import { dbFailure, memberRoute, readJson } from "@/lib/family/api";
import { familyError, familyJson } from "@/lib/family/errors";
import { progressSchema } from "@/lib/family/validation";

export const dynamic = "force-dynamic";

/** PUT { chapterIndex }: remember the caller's reading position in the published book. */
export const PUT = memberRoute<{ familyId: string }>({ action: "read" }, async ({ supabase, user, familyId }, request) => {
  const body = await readJson(request, progressSchema);
  if (!body.ok) return body.response;
  const { data: book } = await supabase.from("family_books").select("id, published_version").eq("family_id", familyId).maybeSingle();
  if (!book || !book.published_version) return familyError("not_found");
  const { error } = await supabase
    .from("book_progress")
    .upsert({ family_id: familyId, user_id: user.id, book_id: book.id, chapter_index: body.data.chapterIndex, updated_at: new Date().toISOString() }, { onConflict: "user_id,book_id" });
  if (error) return dbFailure(error);
  return familyJson({ saved: true });
});
