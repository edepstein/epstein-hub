import { dbFailure, memberRoute, readJson } from "@/lib/family/api";
import { familyJson } from "@/lib/family/errors";
import { familySettingsSchema } from "@/lib/family/validation";

export const dynamic = "force-dynamic";

/** GET: the family's own settings for members. */
export const GET = memberRoute<{ familyId: string }>({ action: "read" }, async ({ supabase, familyId, membership }) => {
  const { data, error } = await supabase
    .from("families")
    .select("id, title, recipient_name, birthday_date, timezone")
    .eq("id", familyId)
    .single();
  if (error) return dbFailure(error);
  return familyJson({
    family: { id: data.id, title: data.title, recipientName: data.recipient_name, birthdayDate: data.birthday_date, timezone: data.timezone },
    membership: { role: membership.role, displayName: membership.displayName },
  });
});

/**
 * PATCH (curator): title, recipient name, birthday date and time zone. The recipient's name and
 * date are only ever what the family types here; nothing is guessed.
 */
export const PATCH = memberRoute<{ familyId: string }>({ action: "edit_family" }, async ({ supabase, familyId }, request) => {
  const body = await readJson(request, familySettingsSchema);
  if (!body.ok) return body.response;
  const patch: Record<string, string | null> = {};
  if (body.data.title !== undefined) patch.title = body.data.title;
  if (body.data.recipientName !== undefined) patch.recipient_name = body.data.recipientName;
  if (body.data.birthdayDate !== undefined) patch.birthday_date = body.data.birthdayDate;
  if (body.data.timezone !== undefined) patch.timezone = body.data.timezone;
  const { error } = await supabase.from("families").update(patch).eq("id", familyId);
  if (error) return dbFailure(error);
  return familyJson({ saved: true });
});
