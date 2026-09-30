import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IMAGE_MAX_BYTES, processImage, readExif, sniffMime, validateAudio, wavDurationSeconds } from "./media";

const fixture = (name: string) => new Uint8Array(readFileSync(path.join(__dirname, "../../../tests/family/fixtures", name)));
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const contains = (hay: Uint8Array, needle: string) => Buffer.from(hay).includes(Buffer.from(needle, "latin1"));

/** Big-endian EXIF APP1 with Orientation, a GPS IFD pointer and a GPS latitude marker string. */
function exifApp1(orientation: number): Uint8Array {
  const tiff = [
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    0x00, 0x02,
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00,
    0x88, 0x25, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x26,
    0x00, 0x00, 0x00, 0x00,
    ...ascii("GPSLAT51.5N"),
  ];
  const body = [...ascii("Exif"), 0, 0, ...tiff];
  const len = body.length + 2;
  return Uint8Array.from([0xff, 0xe1, len >> 8, len & 0xff, ...body]);
}

function withSegmentsAfterSoi(jpeg: Uint8Array, ...segs: Uint8Array[]): Uint8Array {
  return Uint8Array.from([...jpeg.subarray(0, 2), ...segs.flatMap((s) => [...s]), ...jpeg.subarray(2)]);
}

describe("sniffMime", () => {
  it("identifies formats by bytes, not names", () => {
    expect(sniffMime(fixture("tiny.jpg"))).toBe("image/jpeg");
    expect(sniffMime(fixture("tiny.png"))).toBe("image/png");
    expect(sniffMime(fixture("tiny.webp"))).toBe("image/webp");
    expect(sniffMime(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffMime(new TextEncoder().encode("GIF89a...."))).toBeNull();
    expect(sniffMime(Uint8Array.from([0, 0, 0, 24, ...ascii("ftypheic"), 0, 0, 0, 0]))).toBe("image/heic");
    expect(sniffMime(Uint8Array.from([0x4d, 0x5a, 0x90, 0]))).toBeNull(); // Windows executable
  });
});

describe("processImage", () => {
  it("accepts JPEG, PNG and WebP and reads dimensions", () => {
    for (const f of ["tiny.jpg", "tiny.png", "tiny.webp"]) {
      const r = processImage(fixture(f));
      expect(r.ok, f).toBe(true);
      if (r.ok) expect([r.value.width, r.value.height], f).toEqual([40, 30]);
    }
  });

  it("strips EXIF including GPS from JPEG but keeps the orientation", () => {
    const withExif = withSegmentsAfterSoi(fixture("tiny.jpg"), exifApp1(6), Uint8Array.from([0xff, 0xfe, 0x00, 0x0d, ...ascii("secret note")]));
    expect(readExif(withExif.subarray(6)).hasGps).toBe(true);
    const r = processImage(withExif);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.hadGps).toBe(true);
    expect(r.value.metadataRemoved).toBe(true);
    expect(contains(r.value.bytes, "GPSLAT")).toBe(false);
    expect(contains(r.value.bytes, "secret note")).toBe(false);
    // Orientation 6 rotates 90 degrees, so display dimensions swap; a minimal EXIF keeps it.
    expect([r.value.width, r.value.height]).toEqual([30, 40]);
    const again = processImage(r.value.bytes);
    expect(again.ok && again.value.hadGps).toBe(false);
    expect(again.ok && [again.value.width, again.value.height]).toEqual([30, 40]);
  });

  it("removes PNG text chunks", () => {
    const png = fixture("tiny.png");
    expect(contains(png, "private note")).toBe(true);
    const r = processImage(png);
    expect(r.ok && r.value.metadataRemoved).toBe(true);
    expect(r.ok && contains(r.value.bytes, "private note")).toBe(false);
    expect(r.ok && contains(r.value.bytes, "IEND")).toBe(true);
  });

  it("rejects oversized, empty, unsupported, HEIC and truncated files with stable codes", () => {
    expect(processImage(new Uint8Array(0))).toEqual({ ok: false, code: "media_empty" });
    const big = new Uint8Array(IMAGE_MAX_BYTES + 1);
    big.set(fixture("tiny.jpg"));
    expect(processImage(big)).toEqual({ ok: false, code: "media_too_large" });
    expect(processImage(new TextEncoder().encode("#!/bin/sh\necho hi"))).toEqual({ ok: false, code: "media_unsupported" });
    expect(processImage(Uint8Array.from([0, 0, 0, 24, ...ascii("ftypheic"), 0, 0, 0, 0]))).toEqual({ ok: false, code: "media_heic" });
    const jpg = fixture("tiny.jpg");
    expect(processImage(jpg.subarray(0, 40))).toEqual({ ok: false, code: "media_corrupt" });
    const png = fixture("tiny.png");
    expect(processImage(png.subarray(0, png.length - 12))).toEqual({ ok: false, code: "media_corrupt" });
    // A JPEG header glued to a script is not a photograph.
    expect(processImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...ascii("<script>")]))).toEqual({ ok: false, code: "media_corrupt" });
  });

  it("rejects absurd pixel dimensions", () => {
    const png = Uint8Array.from(fixture("tiny.png"));
    // IHDR width at byte 16: set to 30,000 (the CRC is not checked by the parser).
    png[16] = 0;
    png[17] = 0;
    png[18] = 0x75;
    png[19] = 0x30;
    expect(processImage(png)).toEqual({ ok: false, code: "media_dimensions" });
  });
});

describe("audio", () => {
  function wav(seconds: number): Uint8Array {
    const byteRate = 8000;
    const dataSize = seconds * byteRate;
    const h = new DataView(new ArrayBuffer(44));
    const w = (o: number, s: string) => s.split("").forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)));
    w(0, "RIFF");
    h.setUint32(4, 36 + dataSize, true);
    w(8, "WAVE");
    w(12, "fmt ");
    h.setUint32(16, 16, true);
    h.setUint16(20, 1, true);
    h.setUint16(22, 1, true);
    h.setUint32(24, 8000, true);
    h.setUint32(28, byteRate, true);
    h.setUint16(32, 1, true);
    h.setUint16(34, 8, true);
    w(36, "data");
    h.setUint32(40, dataSize, true);
    return new Uint8Array(h.buffer);
  }

  it("measures WAV duration and enforces 10 minutes", () => {
    expect(wavDurationSeconds(wav(90))).toBe(90);
    expect(validateAudio(wav(90))).toEqual({ ok: true, value: { mime: "audio/wav", durationSeconds: 90 } });
    expect(validateAudio(wav(601))).toEqual({ ok: false, code: "audio_too_long" });
  });

  it("rejects non-audio and oversize files", () => {
    expect(validateAudio(fixture("tiny.jpg"))).toEqual({ ok: false, code: "media_unsupported" });
    expect(validateAudio(new Uint8Array(30 * 1024 * 1024 + 1).fill(0x49))).toEqual({ ok: false, code: "media_too_large" });
    expect(validateAudio(Uint8Array.from([...ascii("ID3"), 3, 0, 0]), 700)).toEqual({ ok: false, code: "audio_too_long" });
  });
});
