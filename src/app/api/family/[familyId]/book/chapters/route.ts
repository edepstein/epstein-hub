import { dbFailure, memberRoute, readJson } from "@/lib/family/api";
import { familyError, familyJson } from "@/lib/family/errors";
import { chapterCreateSchema } from "@/lib/family/validation";

export const dynamic = "force-dynamic";

/** POST { title }: append a chapter to the draft book (curator). */
export const POST = memberRoute<{ familyId: string }>({ action: "compose_book" }, async ({ supabase, familyId }, request) => {
  const body = await readJson(request, chapterCreateSchema);
  if (!body.ok) return body.response;
  const { data: book } = await supabase.from("family_books").select("id").eq("family_id", familyId).maybeSingle();
  if (!book) return familyError("invalid_transition");
  const { data: last } = await supabase.from("book_chapters").select("position").eq("book_id", book.id).order("position", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("book_chapters")
    .insert({ family_id: familyId, book_id: book.id, title: body.data.title, position: (last ? Number(last.position) : -1) + 1 })
    .select("id")
    .single();
  if (error) return dbFailure(error);
  return familyJson({ chapter: { id: data.id } }, 201);
});
