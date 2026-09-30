import { dbFailure, memberRoute } from "@/lib/family/api";
import { familyError, familyJson } from "@/lib/family/errors";

export const dynamic = "force-dynamic";

/** POST: publish the draft book as a new immutable version (curator). */
export const POST = memberRoute<{ familyId: string }>({ action: "compose_book" }, async ({ supabase, familyId }) => {
  const { data: book } = await supabase.from("family_books").select("id").eq("family_id", familyId).maybeSingle();
  if (!book) return familyError("book_empty");
  const { data, error } = await supabase.rpc("publish_family_book", { p_book_id: book.id });
  if (error) return dbFailure(error);
  return familyJson({ version: data });
});
