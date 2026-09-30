import { dbFailure, memberRoute, readJson } from "@/lib/family/api";
import { can } from "@/lib/family/authz";
import { familyJson } from "@/lib/family/errors";
import { getBookProgress, getDraftBook, getPublishedBook } from "@/lib/family/repo";
import { bookSchema } from "@/lib/family/validation";

export const dynamic = "force-dynamic";

/** GET: the published Birthday Book snapshot and the caller's reading position; ?draft=1 for curators. */
export const GET = memberRoute<{ familyId: string }>({ action: "read" }, async ({ supabase, user, familyId, membership }, request) => {
  const draft = new URL(request.url).searchParams.get("draft") === "1" && can(membership, "compose_book");
  const published = await getPublishedBook(supabase, familyId);
  const progress = published ? await getBookProgress(supabase, published.bookId, user.id) : null;
  return familyJson({ published, progress, draft: draft ? await getDraftBook(supabase, familyId) : undefined });
});

/** PUT { title, dedication }: create or update the book's cover details (curator). */
export const PUT = memberRoute<{ familyId: string }>({ action: "compose_book" }, async ({ supabase, familyId }, request) => {
  const body = await readJson(request, bookSchema);
  if (!body.ok) return body.response;
  const { title, dedication } = body.data;
  const { data: existing } = await supabase.from("family_books").select("id").eq("family_id", familyId).maybeSingle();
  if (existing) {
    const patch: Record<string, unknown> = { title };
    if (dedication !== undefined) patch.dedication = dedication || null;
    const { error } = await supabase.from("family_books").update(patch).eq("id", existing.id);
    if (error) return dbFailure(error);
    return familyJson({ book: { id: existing.id } });
  }
  const { data, error } = await supabase.from("family_books").insert({ family_id: familyId, title, dedication: dedication || null }).select("id").single();
  if (error) return dbFailure(error);
  return familyJson({ book: { id: data.id } }, 201);
});
