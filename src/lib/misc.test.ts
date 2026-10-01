import { describe, expect, it } from "vitest";
import { createRng } from "./rng";
import { contentHash } from "./hash";
import { londonEditionDate } from "./edition";
import { fitsMultiset, normaliseWord } from "./text";
import { loadFamiliarSync, loadMembershipSync } from "./dictionary/node";

describe("shared helpers", () => {
  it("seeded RNG is deterministic", () => {
    expect(createRng(42).shuffle([1, 2, 3, 4, 5])).toEqual(createRng(42).shuffle([1, 2, 3, 4, 5]));
  });
  it("hash ignores key order", () => {
    expect(contentHash({ a: 1, b: [1, 2] })).toBe(contentHash({ b: [1, 2], a: 1 }));
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
  });
  it("edition date uses Europe/London, not UTC", () => {
    // 23:30 UTC on 30 June is 00:30 BST on 1 July in London.
    expect(londonEditionDate(new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-01");
    // In winter London equals UTC.
    expect(londonEditionDate(new Date("2026-12-31T23:30:00Z"))).toBe("2026-12-31");
  });
  it("normalises without silently stripping punctuation", () => {
    expect(normaliseWord("  hello ")).toEqual({ word: "HELLO", problem: null });
    expect(normaliseWord("don't").problem).toBe("non-letters");
  });
  it("multiset containment respects duplicate counts", () => {
    expect(fitsMultiset("AA", "AB")).toBe(false);
    expect(fitsMultiset("AA", "ABA")).toBe(true);
  });
  it("loads the membership list: two-letter tile words in, abbreviations and slurs out", () => {
    const m = loadMembershipSync();
    expect(m.size).toBeGreaterThan(250000);
    expect(m.has("EDUCATION")).toBe(true);
    expect(m.has("QI")).toBe(true);
    expect(m.has("ZA")).toBe(true);
    expect(m.has("CF")).toBe(false);
    expect(m.has("ORGANISE")).toBe(true);
    expect(m.has("ORGANIZE")).toBe(true);
    expect(m.has("COLOUR")).toBe(true);
    expect(m.has("NIGGER")).toBe(false);
    expect(loadFamiliarSync().has("ARSE")).toBe(false);
  });
});
