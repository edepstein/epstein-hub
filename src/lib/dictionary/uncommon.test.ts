import { describe, expect, it } from "vitest";
import { loadFamiliarSync, loadMembershipSync, loadUncommonSync } from "./node";

describe("authoring layers", () => {
  it("uncommon layer is disjoint from the familiar layer and inside membership", () => {
    const familiar = loadFamiliarSync();
    const membership = loadMembershipSync();
    const uncommon = loadUncommonSync();
    expect(uncommon.size).toBeGreaterThan(30000);
    let outside = 0;
    for (const w of uncommon) {
      expect(familiar.has(w)).toBe(false);
      if (!membership.has(w)) outside++;
    }
    expect(outside).toBe(0);
    expect(uncommon.has("KNAVE")).toBe(true);
    expect(uncommon.has("CRAP")).toBe(false);
  });
});
