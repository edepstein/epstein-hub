import { isUuid, logFamilyFailure, memberRoute } from "@/lib/family/api";
import { familyError, PRIVATE_HEADERS } from "@/lib/family/errors";
import { processImage } from "@/lib/family/media";

export const dynamic = "force-dynamic";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * GET: authenticated media proxy. Membership and visibility are re-checked on every request
 * (the media row and the storage object are both read under the caller's RLS), so revoking a
 * member or withdrawing a post takes effect immediately. The bytes are re-validated and
 * metadata-stripped again on the way out, served with nosniff and a sandbox CSP, never cached.
 * ?download=1 is honoured only when the recorded permission allows downloads.
 */
export const GET = memberRoute<{ familyId: string; mediaId: string }>({ action: "read" }, async ({ supabase, familyId }, request, { mediaId }) => {
  if (!isUuid(mediaId)) return familyError("not_found");
  const { data: media, error } = await supabase
    .from("family_media")
    .select("id, kind, mime_type, processing_status, storage_path")
    .eq("id", mediaId)
    .eq("family_id", familyId)
    .maybeSingle();
  if (error || !media || media.processing_status !== "ready" || media.kind !== "image") return familyError("not_found");

  const { data: blob, error: dlErr } = await supabase.storage.from("family-media").download(media.storage_path as string);
  if (dlErr || !blob) {
    logFamilyFailure("media.download", (dlErr as { statusCode?: string } | null)?.statusCode);
    return familyError("not_found");
  }
  const checked = processImage(new Uint8Array(await blob.arrayBuffer()));
  if (!checked.ok || checked.value.mime !== media.mime_type) {
    logFamilyFailure("media.revalidate", checked.ok ? "mime_mismatch" : checked.code);
    return familyError("not_found");
  }

  const wantsDownload = new URL(request.url).searchParams.get("download") === "1";
  let disposition = `inline; filename="photo.${EXT[media.mime_type as string] ?? "img"}"`;
  if (wantsDownload) {
    const { data: flags } = await supabase.rpc("media_download_flags", { p_ids: [mediaId] });
    const allowed = Array.isArray(flags) && flags.some((f: { media_id: string; allowed: boolean }) => f.media_id === mediaId && f.allowed);
    if (!allowed) return familyError("forbidden");
    disposition = `attachment; filename="family-photo.${EXT[media.mime_type as string] ?? "img"}"`;
  }

  return new Response(checked.value.bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      ...PRIVATE_HEADERS,
      "Content-Type": media.mime_type as string,
      "Content-Length": String(checked.value.bytes.length),
      "Content-Disposition": disposition,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Referrer-Policy": "no-referrer",
    },
  });
});
