import { LIMITS } from "@/lib/auth/rate-limit";
import { dbFailure, logFamilyFailure, memberRoute } from "@/lib/family/api";
import { familyError, familyJson } from "@/lib/family/errors";
import { IMAGE_MAX_BYTES, processImage, sniffMime } from "@/lib/family/media";
import { fieldErrors, uploadFieldsSchema } from "@/lib/family/validation";

export const dynamic = "force-dynamic";

const BUCKET = "family-media";
const FORM_OVERHEAD = 64 * 1024;

/**
 * POST multipart { file, altText, permissionBasis, peopleConfirmed, downloadAllowed,
 * restrictions?, clientRequestId? }: validates the real bytes, strips metadata, stores the
 * object privately at <familyId>/<mediaId>, and records the stated permission. Retrying with the
 * same clientRequestId reuses the same media record (no duplicates).
 */
export const POST = memberRoute<{ familyId: string }>(
  { action: "contribute", rateLimit: { name: "upload", rule: LIMITS.uploadPerUser } },
  async ({ supabase, user, familyId }, request) => {
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > IMAGE_MAX_BYTES + FORM_OVERHEAD) return familyError("media_too_large");

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return familyError("invalid_input", { fields: { file: "The upload could not be read. Please try again." } });
    }
    const file = form.get("file");
    if (!(file instanceof Blob)) return familyError("invalid_input", { fields: { file: "Choose a photograph to upload." } });
    const fields: Record<string, string> = {};
    for (const key of ["altText", "permissionBasis", "peopleConfirmed", "downloadAllowed", "restrictions", "clientRequestId"]) {
      const v = form.get(key);
      if (typeof v === "string" && v !== "") fields[key] = v;
    }
    const parsed = uploadFieldsSchema.safeParse(fields);
    if (!parsed.success) return familyError("invalid_input", { fields: fieldErrors(parsed.error) });
    const meta = parsed.data;

    if (file.size > IMAGE_MAX_BYTES) return familyError("media_too_large");
    const original = new Uint8Array(await file.arrayBuffer());
    const kind = sniffMime(original);
    if (kind && kind.startsWith("audio/")) return familyError("audio_not_enabled");
    const processed = processImage(original);
    if (!processed.ok) return familyError(processed.code);
    const img = processed.value;

    // Reuse an earlier reservation from the same retry, or reserve a new media id.
    let mediaId: string | null = null;
    if (meta.clientRequestId) {
      const { data: existing, error } = await supabase
        .from("family_media")
        .select("id, processing_status, width, height")
        .eq("owner_id", user.id)
        .eq("client_request_id", meta.clientRequestId)
        .maybeSingle();
      if (error) return dbFailure(error);
      if (existing?.processing_status === "ready") {
        return familyJson({ media: { id: existing.id, width: existing.width, height: existing.height }, duplicate: true });
      }
      if (existing && existing.processing_status !== "deleted") {
        mediaId = existing.id;
        if (existing.processing_status === "failed") {
          await supabase.from("family_media").update({ processing_status: "reserved" }).eq("id", existing.id);
        }
      }
    }
    if (!mediaId) {
      const { data: reserved, error } = await supabase
        .from("family_media")
        .insert({ family_id: familyId, owner_id: user.id, kind: "image", mime_type: img.mime, byte_size: img.bytes.length, client_request_id: meta.clientRequestId ?? null })
        .select("id")
        .single();
      if (error) return dbFailure(error);
      mediaId = reserved.id as string;
    }

    const path = `${familyId}/${mediaId}`;
    const { error: storeErr } = await supabase.storage.from(BUCKET).upload(path, img.bytes, { contentType: img.mime, upsert: false, cacheControl: "0" });
    const alreadyStored = storeErr && /exists|duplicate/i.test(storeErr.message);
    if (storeErr && !alreadyStored) {
      logFamilyFailure("uploads.storage", (storeErr as { statusCode?: string }).statusCode);
      await supabase.from("family_media").update({ processing_status: "failed" }).eq("id", mediaId);
      return familyError("upload_failed");
    }

    const { error: readyErr } = await supabase
      .from("family_media")
      .update({ processing_status: "ready", width: img.width, height: img.height, alt_text: meta.altText, byte_size: img.bytes.length })
      .eq("id", mediaId);
    if (readyErr) return dbFailure(readyErr);

    const { error: consentErr } = await supabase.from("consent_records").insert({
      family_id: familyId,
      media_id: mediaId,
      recorded_by: user.id,
      permission_basis: meta.permissionBasis,
      people_pictured_confirmed: true,
      download_allowed: meta.downloadAllowed === "true",
      restrictions: meta.restrictions ?? null,
    });
    if (consentErr) return dbFailure(consentErr);

    return familyJson({ media: { id: mediaId, width: img.width, height: img.height, metadataRemoved: img.metadataRemoved, locationRemoved: img.hadGps } }, 201);
  },
);
