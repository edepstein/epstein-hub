import { describe, expect, it } from "vitest";
import { checkRequestOrigin, isSameOriginMutation } from "./csrf";
import { RateLimiter } from "./rate-limit";
import { safeNextPath } from "./redirect";

describe("isSameOriginMutation", () => {
  const base = { requestUrl: "https://wordclub.example/api/family/x/posts", host: "wordclub.example", forwardedProto: "https" };
  it("allows safe methods without checks", () => {
    expect(isSameOriginMutation({ ...base, method: "GET", origin: "https://evil.example", secFetchSite: "cross-site" })).toBe(true);
  });
  it("allows same-origin mutations", () => {
    expect(isSameOriginMutation({ ...base, method: "POST", origin: "https://wordclub.example", secFetchSite: "same-origin" })).toBe(true);
    expect(isSameOriginMutation({ ...base, method: "DELETE", origin: null, secFetchSite: "same-origin" })).toBe(true);
    expect(isSameOriginMutation({ ...base, requestUrl: "http://internal:3000/api", method: "POST", origin: "https://family.example", secFetchSite: null, allowedOrigin: "https://family.example" })).toBe(true);
  });
  it("refuses cross-site, null and missing origins", () => {
    expect(isSameOriginMutation({ ...base, method: "POST", origin: "https://evil.example", secFetchSite: "cross-site" })).toBe(false);
    expect(isSameOriginMutation({ ...base, method: "POST", origin: "null", secFetchSite: null })).toBe(false);
    expect(isSameOriginMutation({ ...base, method: "PATCH", origin: null, secFetchSite: null })).toBe(false);
    expect(isSameOriginMutation({ ...base, method: "POST", origin: null, secFetchSite: "same-site" })).toBe(false);
    expect(isSameOriginMutation({ ...base, method: "POST", origin: "https://wordclub.example.evil.example", secFetchSite: null })).toBe(false);
  });
  it("reads headers from a Request", () => {
    const ok = new Request("http://127.0.0.1:3202/api/family/me", { method: "POST", headers: { origin: "http://127.0.0.1:3202" } });
    const bad = new Request("http://127.0.0.1:3202/api/family/me", { method: "POST", headers: { origin: "http://attacker.test" } });
    expect(checkRequestOrigin(ok, null)).toBe(true);
    expect(checkRequestOrigin(bad, null)).toBe(false);
  });
});

describe("RateLimiter", () => {
  it("limits within a window and resets after it", () => {
    let t = 0;
    const rl = new RateLimiter({ limit: 2, windowMs: 1000 }, () => t);
    expect(rl.check("a").allowed).toBe(true);
    expect(rl.check("a").allowed).toBe(true);
    const third = rl.check("a");
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBe(1);
    expect(rl.check("b").allowed).toBe(true);
    t = 1000;
    expect(rl.check("a").allowed).toBe(true);
  });
  it("bounds memory", () => {
    const rl = new RateLimiter({ limit: 1, windowMs: 10_000 }, () => 0, 3);
    for (const k of ["a", "b", "c", "d", "e"]) expect(rl.check(k).allowed).toBe(true);
  });
});

describe("safeNextPath", () => {
  it("keeps family paths", () => {
    expect(safeNextPath("/family")).toBe("/family");
    expect(safeNextPath("/family/invite/abc_DEF-123")).toBe("/family/invite/abc_DEF-123");
    expect(safeNextPath("/family/book?chapter=2")).toBe("/family/book?chapter=2");
  });
  it("rejects open redirects and other sections", () => {
    for (const bad of [null, "", "https://evil.example/family", "//evil.example", "/\\evil.example", "/%2F%2Fevil.example", "/games", "/familyx", "javascript:alert(1)", "/family\n", " //evil"]) {
      expect(safeNextPath(bad as string | null)).toBe("/family");
    }
  });
});
