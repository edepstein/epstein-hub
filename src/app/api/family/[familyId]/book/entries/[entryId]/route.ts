import { dbFailure, isUuid, memberRoute, readJson } from "@/lib/family/api";
import { familyError, familyJson } from "@/lib/family/errors";
import { entryPatchSchema } from "@/lib/family/validation";

export const dynamic = "force-dynamic";

type P = { familyId: string; entryId: string };

/** PATCH { heading?, body?, credit?, move? }: edit or reorder a draft entry (curator). */
export const PATCH = memberRoute<P>({ action: "compose_book" }, async ({ supabase, familyId }, request, { entryId }) => {
  if (!isUuid(entryId)) return familyError("not_found");
  const body = await readJson(request, entryPatchSchema);
  if (!body.ok) return body.response;
  const { move, heading, body: text, credit } = body.data;
  const patch: Record<string, string | null> = {};
  if (heading !== undefined) patch.heading = heading || null;
  if (text !== undefined) patch.body = text;
  if (credit !== undefined) patch.contributor_credit = credit || null;
  if (Object.keys(patch).length) {
    const { count, error } = await supabase.from("book_entries").update(patch, { count: "exact" }).eq("id", entryId).eq("family_id", familyId);
    if (error) return dbFailure(error);
    if (!count) return familyError("not_found");
  }
  if (move) {
    const { error } = await supabase.rpc("move_book_entry", { p_entry_id: entryId, p_direction: move === "up" ? -1 : 1 });
    if (error) return dbFailure(error);
  }
  return familyJson({ saved: true });
});

/** DELETE: remove a draft entry (curator). */
export const DELETE = memberRoute<P>({ action: "compose_book" }, async ({ supabase, familyId }, _request, { entryId }) => {
  if (!isUuid(entryId)) return familyError("not_found");
  const { count, error } = await supabase.from("book_entries").delete({ count: "exact" }).eq("id", entryId).eq("family_id", familyId);
  if (error) return dbFailure(error);
  if (!count) return familyError("not_found");
  return familyJson({ deleted: true });
});
