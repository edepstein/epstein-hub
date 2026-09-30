/**
 * Private media validation: identify the real format from the file bytes (never the filename or
 * the browser-declared type), read dimensions, and remove metadata that can reveal location or
 * device details. Pure functions over Uint8Array, shared by the upload API and the media proxy.
 *
 * Metadata approach (no native re-encoder dependency, see DECISIONS "Batch 8"):
 *  - JPEG: drop APP1 (EXIF/XMP, including GPS), APP3-APP13, APP15 and COM segments; keep JFIF
 *    (APP0), ICC colour profiles (APP2 "ICC_PROFILE") and Adobe (APP14). The EXIF orientation is
 *    preserved by writing back a minimal EXIF block holding only the Orientation tag, so phone
 *    photos do not turn sideways.
 *  - PNG: drop tEXt, zTXt, iTXt, eXIf and tIME chunks.
 *  - WebP: drop EXIF and XMP chunks and clear their VP8X flags.
 * Pixel data is copied unchanged.
 */

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const AUDIO_MAX_BYTES = 30 * 1024 * 1024;
export const AUDIO_MAX_SECONDS = 10 * 60;
export const IMAGE_MAX_DIMENSION = 20_000;
export const IMAGE_MAX_PIXELS = 60_000_000;
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageMime = (typeof IMAGE_MIME_TYPES)[number];

export type MediaRejection =
  | "media_empty"
  | "media_too_large"
  | "media_unsupported"
  | "media_heic"
  | "media_corrupt"
  | "media_dimensions"
  | "audio_too_long";

export const MEDIA_REJECTION_MESSAGES: Record<MediaRejection, string> = {
  media_empty: "The file is empty. Choose the photograph again.",
  media_too_large: "This photograph is larger than 10 MB. Choose a smaller copy or export it at a lower size.",
  media_unsupported: "Only JPEG, PNG and WebP photographs can be added. Other file types are refused.",
  media_heic: "This looks like an iPhone HEIC photo. Please save or share it as a JPEG first, then try again.",
  media_corrupt: "The file could not be read as a photograph. It may be damaged; try exporting it again.",
  media_dimensions: "This photograph is too large in pixels. Please resize it to under 20,000 pixels a side.",
  audio_too_long: "Recordings can be up to 10 minutes long.",
};

export interface ImageInfo {
  mime: ImageMime;
  width: number;
  height: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; code: MediaRejection };

const u16be = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
const u32be = (b: Uint8Array, i: number) => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
const u16le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8);
const u24le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);
const u32le = (b: Uint8Array, i: number) => (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Identify the container from magic bytes. */
export function sniffMime(b: Uint8Array): ImageMime | "image/heic" | "audio/mpeg" | "audio/mp4" | "audio/ogg" | "audio/wav" | "audio/webm" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG" && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WAVE") return "audio/wav";
  if (b.length >= 12 && ascii(b, 4, 4) === "ftyp") {
    const brand = ascii(b, 8, 4);
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1", "heim", "heis", "avif"].includes(brand)) return "image/heic";
    if (["M4A ", "M4B ", "mp42", "isom", "mp41", "dash"].includes(brand)) return "audio/mp4";
  }
  if (b.length >= 4 && ascii(b, 0, 4) === "OggS") return "audio/ogg";
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "audio/webm";
  if (b.length >= 3 && ascii(b, 0, 3) === "ID3") return "audio/mpeg";
  if (b.length >= 2 && b[0] === 0xff && (b[1]! & 0xe0) === 0xe0) return "audio/mpeg";
  return null;
}

// ------------------------------------------------------------------------------------ JPEG
interface JpegParse {
  width: number;
  height: number;
  orientation: number;
  hadGps: boolean;
  stripped: Uint8Array;
}

/** Read the EXIF orientation (and whether GPS data exists) from an APP1 payload. */
export function readExif(payload: Uint8Array): { orientation: number; hasGps: boolean } {
  const none = { orientation: 1, hasGps: false };
  if (payload.length < 14 || ascii(payload, 0, 4) !== "Exif") return none;
  const t = 6;
  const order = ascii(payload, t, 2);
  if (order !== "II" && order !== "MM") return none;
  const le = order === "II";
  const r16 = (i: number) => (le ? u16le(payload, i) : u16be(payload, i));
  const r32 = (i: number) => (le ? u32le(payload, i) : u32be(payload, i));
  if (t + 8 > payload.length) return none;
  const ifd = t + r32(t + 4);
  if (ifd + 2 > payload.length) return none;
  const count = r16(ifd);
  let orientation = 1;
  let hasGps = false;
  for (let k = 0; k < count; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > payload.length) break;
    const tag = r16(e);
    if (tag === 0x0112) {
      const v = r16(e + 8);
      if (v >= 1 && v <= 8) orientation = v;
    }
    if (tag === 0x8825) hasGps = true;
  }
  return { orientation, hasGps };
}

function orientationSegment(orientation: number): Uint8Array {
  // APP1: "Exif\0\0" + big-endian TIFF header + one IFD entry (Orientation, SHORT, 1).
  const body = [
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    0x00, 0x01,
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ];
  const len = body.length + 2;
  return Uint8Array.from([0xff, 0xe1, len >> 8, len & 0xff, ...body]);
}

function parseJpeg(b: Uint8Array): JpegParse | null {
  if (!(b[0] === 0xff && b[1] === 0xd8)) return null;
  const keep: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  let width = 0;
  let height = 0;
  let orientation = 1;
  let hadGps = false;
  let sawSos = false;
  let insertAt = 1; // index in keep[] after which to place the orientation segment
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    while (i < b.length && b[i] === 0xff) i++; // fill bytes
    if (i >= b.length) return null;
    const marker = b[i]!;
    const segStart = i - 1;
    i++;
    if (marker === 0xd9) {
      keep.push(b.subarray(segStart, i));
      break;
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      keep.push(b.subarray(segStart, i));
      continue;
    }
    if (i + 2 > b.length) return null;
    const len = u16be(b, i);
    if (len < 2 || i + len > b.length) return null;
    const payload = b.subarray(i + 2, i + len);
    const segEnd = i + len;
    if (marker === 0xda) {
      // Start of scan: the rest is entropy-coded data (and any later markers). Keep verbatim.
      keep.push(b.subarray(segStart));
      sawSos = true;
      break;
    }
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (payload.length < 5) return null;
      height = u16be(payload, 1);
      width = u16be(payload, 3);
    }
    let drop = false;
    if (marker === 0xe1) {
      const exif = readExif(payload);
      if (exif.orientation !== 1) orientation = exif.orientation;
      if (exif.hasGps) hadGps = true;
      drop = true;
    } else if (marker === 0xe2) {
      drop = !(payload.length >= 12 && ascii(payload, 0, 11) === "ICC_PROFILE");
    } else if (marker >= 0xe3 && marker <= 0xef && marker !== 0xee) {
      drop = true;
    } else if (marker === 0xfe) {
      drop = true;
    }
    if (!drop) {
      keep.push(b.subarray(segStart, segEnd));
      if (marker === 0xe0) insertAt = keep.length;
    }
    i = segEnd;
  }
  if (!sawSos || width <= 0 || height <= 0) return null;
  if (orientation !== 1) keep.splice(insertAt, 0, orientationSegment(orientation));
  const swap = orientation >= 5 && orientation <= 8;
  return { width: swap ? height : width, height: swap ? width : height, orientation, hadGps, stripped: concat(keep) };
}

// ------------------------------------------------------------------------------------- PNG
const PNG_DROP = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);

function parsePng(b: Uint8Array): { width: number; height: number; stripped: Uint8Array; hadMetadata: boolean } | null {
  const keep: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  let width = 0;
  let height = 0;
  let first = true;
  let sawEnd = false;
  let hadMetadata = false;
  while (i + 12 <= b.length) {
    const len = u32be(b, i);
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (len > 0x7fffffff || end > b.length || !/^[A-Za-z]{4}$/.test(type)) return null;
    if (first) {
      if (type !== "IHDR" || len < 8) return null;
      width = u32be(b, i + 8);
      height = u32be(b, i + 12);
      first = false;
    }
    if (PNG_DROP.has(type)) hadMetadata = true;
    else keep.push(b.subarray(i, end));
    i = end;
    if (type === "IEND") {
      sawEnd = true;
      break;
    }
  }
  if (!sawEnd || width <= 0 || height <= 0) return null;
  return { width, height, stripped: concat(keep), hadMetadata };
}

// ------------------------------------------------------------------------------------ WebP
function parseWebp(b: Uint8Array): { width: number; height: number; stripped: Uint8Array; hadMetadata: boolean } | null {
  const riffSize = u32le(b, 4);
  const end = Math.min(b.length, 8 + riffSize);
  if (8 + riffSize > b.length + 1) return null;
  const chunks: Uint8Array[] = [];
  let i = 12;
  let width = 0;
  let height = 0;
  let vp8xIndex = -1;
  let hadMetadata = false;
  let sawImage = false;
  while (i + 8 <= end) {
    const type = ascii(b, i, 4);
    const size = u32le(b, i + 4);
    const padded = size + (size & 1);
    if (i + 8 + size > end) return null;
    const data = b.subarray(i + 8, i + 8 + size);
    const whole = b.subarray(i, Math.min(end, i + 8 + padded));
    if (type === "VP8X") {
      if (size < 10) return null;
      width = u24le(data, 4) + 1;
      height = u24le(data, 7) + 1;
      vp8xIndex = chunks.length;
      chunks.push(Uint8Array.from(whole));
    } else if (type === "EXIF" || type === "XMP ") {
      hadMetadata = true;
    } else {
      if (type === "VP8 ") {
        if (size < 10 || !(data[3] === 0x9d && data[4] === 0x01 && data[5] === 0x2a)) return null;
        if (!width) {
          width = u16le(data, 6) & 0x3fff;
          height = u16le(data, 8) & 0x3fff;
        }
        sawImage = true;
      } else if (type === "VP8L") {
        if (size < 5 || data[0] !== 0x2f) return null;
        if (!width) {
          const bits = u32le(data, 1);
          width = (bits & 0x3fff) + 1;
          height = ((bits >>> 14) & 0x3fff) + 1;
        }
        sawImage = true;
      } else if (type === "ANMF") {
        sawImage = true;
      }
      chunks.push(whole);
    }
    i += 8 + padded;
  }
  if (!sawImage || width <= 0 || height <= 0) return null;
  if (vp8xIndex >= 0) {
    const c = chunks[vp8xIndex]!;
    c[8] = c[8]! & ~0x0c; // clear EXIF (0x08) and XMP (0x04) flags
  }
  const body = concat(chunks);
  const header = new Uint8Array(12);
  header.set(b.subarray(0, 4), 0);
  const size = 4 + body.length;
  header[4] = size & 0xff;
  header[5] = (size >>> 8) & 0xff;
  header[6] = (size >>> 16) & 0xff;
  header[7] = (size >>> 24) & 0xff;
  header.set(b.subarray(8, 12), 8);
  return { width, height, stripped: concat([header, body]), hadMetadata };
}

export interface ProcessedImage extends ImageInfo {
  bytes: Uint8Array;
  /** True when location/device/text metadata was found and removed. */
  metadataRemoved: boolean;
  hadGps: boolean;
}

/** Validate an uploaded photograph and return a metadata-free copy. */
export function processImage(bytes: Uint8Array, maxBytes = IMAGE_MAX_BYTES): Result<ProcessedImage> {
  if (bytes.length === 0) return { ok: false, code: "media_empty" };
  if (bytes.length > maxBytes) return { ok: false, code: "media_too_large" };
  const mime = sniffMime(bytes);
  if (mime === "image/heic") return { ok: false, code: "media_heic" };
  if (mime !== "image/jpeg" && mime !== "image/png" && mime !== "image/webp") return { ok: false, code: "media_unsupported" };
  let out: ProcessedImage | null = null;
  if (mime === "image/jpeg") {
    const p = parseJpeg(bytes);
    if (p) out = { mime, width: p.width, height: p.height, bytes: p.stripped, metadataRemoved: p.stripped.length !== bytes.length, hadGps: p.hadGps };
  } else if (mime === "image/png") {
    const p = parsePng(bytes);
    if (p) out = { mime, width: p.width, height: p.height, bytes: p.stripped, metadataRemoved: p.hadMetadata, hadGps: false };
  } else {
    const p = parseWebp(bytes);
    if (p) out = { mime, width: p.width, height: p.height, bytes: p.stripped, metadataRemoved: p.hadMetadata, hadGps: p.hadMetadata };
  }
  if (!out) return { ok: false, code: "media_corrupt" };
  if (out.width > IMAGE_MAX_DIMENSION || out.height > IMAGE_MAX_DIMENSION || out.width * out.height > IMAGE_MAX_PIXELS) {
    return { ok: false, code: "media_dimensions" };
  }
  return { ok: true, value: out };
}

// ----------------------------------------------------------------------------------- Audio
export type AudioMime = "audio/mpeg" | "audio/mp4" | "audio/ogg" | "audio/wav" | "audio/webm";

/** WAV duration from the fmt/data chunks; null when not determinable. */
export function wavDurationSeconds(b: Uint8Array): number | null {
  if (sniffMime(b) !== "audio/wav") return null;
  let i = 12;
  let byteRate = 0;
  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4);
    const size = u32le(b, i + 4);
    if (type === "fmt " && size >= 16 && i + 8 + 12 <= b.length) byteRate = u32le(b, i + 8 + 8);
    if (type === "data") return byteRate > 0 ? size / byteRate : null;
    i += 8 + size + (size & 1);
  }
  return null;
}

/**
 * Audio validation for the (not yet enabled) Audio Postcards module: real container type,
 * 30 MB and 10-minute limits. Duration is measured for WAV; for compressed formats the caller
 * must supply a server-measured duration before audio can be enabled.
 */
export function validateAudio(bytes: Uint8Array, measuredSeconds: number | null = null): Result<{ mime: AudioMime; durationSeconds: number | null }> {
  if (bytes.length === 0) return { ok: false, code: "media_empty" };
  if (bytes.length > AUDIO_MAX_BYTES) return { ok: false, code: "media_too_large" };
  const mime = sniffMime(bytes);
  if (mime !== "audio/mpeg" && mime !== "audio/mp4" && mime !== "audio/ogg" && mime !== "audio/wav" && mime !== "audio/webm") {
    return { ok: false, code: "media_unsupported" };
  }
  const duration = mime === "audio/wav" ? wavDurationSeconds(bytes) : measuredSeconds;
  if (duration !== null && duration > AUDIO_MAX_SECONDS) return { ok: false, code: "audio_too_long" };
  return { ok: true, value: { mime, durationSeconds: duration === null ? null : Math.ceil(duration) } };
}
