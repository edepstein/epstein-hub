import { describe, expect, it } from "vitest";
import { allowedPostActions, can, canChangeMember, FAMILY_ROLES, type FamilyAction } from "./authz";
import { errorBody, errorStatus, FAMILY_ERRORS, mapDbError } from "./errors";
import { assertFixtureImportAllowed, buildFixtureSql, FixtureImportRefused, labelFictional, validateFixture } from "./fixture-import";
import { decodeCursor, encodeCursor, inviteState } from "./repo";
import { generateInviteToken, hashInviteToken, inviteExpiry, isPlausibleInviteToken } from "./tokens";
import { createPostSchema, entryCreateSchema, familySettingsSchema, fieldErrors, inviteSchema, uploadFieldsSchema, verifyCodeSchema } from "./validation";
import demo from "../../../reference/build-pack-v3/content/birthday-demo.json";

const active = (role: "viewer" | "contributor" | "curator") => ({ role, status: "active" as const });

describe("role capabilities (mirror of RLS)", () => {
  it("grants by minimum role", () => {
    const table: [FamilyAction, boolean, boolean, boolean][] = [
      ["read", true, true, true],
      ["reply", true, true, true],
      ["favourite", true, true, true],
      ["contribute", false, true, true],
      ["moderate", false, false, true],
      ["invite", false, false, true],
      ["manage_members", false, false, true],
      ["compose_book", false, false, true],
    ];
    for (const [action, v, c, k] of table) {
      expect([can(active("viewer"), action), can(active("contributor"), action), can(active("curator"), action)], action).toEqual([v, c, k]);
    }
  });
  it("revoked or missing memberships can do nothing", () => {
    for (const role of FAMILY_ROLES) expect(can({ role, status: "revoked" }, "read")).toBe(false);
    expect(can(null, "read")).toBe(false);
  });
  it("post actions follow authorship and status", () => {
    expect(allowedPostActions(active("contributor"), { status: "draft", isAuthor: true })).toEqual(["edit", "submit", "delete"]);
    expect(allowedPostActions(active("contributor"), { status: "submitted", isAuthor: true })).toEqual(["edit", "unsubmit", "delete"]);
    expect(allowedPostActions(active("contributor"), { status: "published", isAuthor: true })).toEqual([]);
    expect(allowedPostActions(active("contributor"), { status: "draft", isAuthor: false })).toEqual([]);
    expect(allowedPostActions(active("viewer"), { status: "draft", isAuthor: true })).toEqual([]);
    expect(allowedPostActions(active("curator"), { status: "submitted", isAuthor: false })).toEqual(["edit", "delete", "approve", "withdraw"]);
    expect(allowedPostActions(active("curator"), { status: "published", isAuthor: false })).toEqual(["edit", "delete", "withdraw"]);
    expect(allowedPostActions(active("curator"), { status: "deleted", isAuthor: false })).toEqual([]);
  });
  it("only active curators change members", () => {
    expect(canChangeMember({ userId: "a", role: "curator", status: "active" }, "b")).toBe(true);
    expect(canChangeMember({ userId: "a", role: "contributor", status: "active" }, "a")).toBe(false);
    expect(canChangeMember({ userId: "a", role: "curator", status: "revoked" }, "b")).toBe(false);
  });
});

describe("errors", () => {
  it("uses only the documented status codes", () => {
    const allowed = new Set([400, 401, 403, 404, 409, 422, 429, 503]);
    for (const [code, [status, message]] of Object.entries(FAMILY_ERRORS)) {
      expect(allowed.has(status), code).toBe(true);
      expect(message, code).not.toMatch(/—/); // no em dashes in user-facing copy
    }
    expect(errorStatus("setup_needed")).toBe(503);
    expect(errorBody("signed_out").error.code).toBe("signed_out");
  });
  it("maps database errors to stable codes", () => {
    expect(mapDbError({ code: "P0001", message: "invite_expired" })).toBe("invite_expired");
    expect(mapDbError({ code: "42501", message: "new row violates row-level security policy" })).toBe("forbidden");
    expect(mapDbError({ code: "23503", message: "fk" })).toBe("invalid_reference");
    expect(mapDbError({ code: "23505", message: "dup" })).toBe("duplicate");
    expect(mapDbError({ code: "P0002", message: "not_found" })).toBe("not_found");
    expect(mapDbError({ code: "XX000", message: "boom" })).toBe("service_unavailable");
    expect(mapDbError(null)).toBe("service_unavailable");
  });
});

describe("invite tokens", () => {
  it("are random, url-safe and stored only as sha256", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).not.toBe(b);
    expect(isPlausibleInviteToken(a)).toBe(true);
    expect(hashInviteToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(isPlausibleInviteToken("short")).toBe(false);
    expect(isPlausibleInviteToken("../../etc/passwd/../../../../../../../")).toBe(false);
  });
  it("clamps expiry to 1..30 days", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    expect(inviteExpiry(7, now).toISOString()).toBe("2026-10-08T00:00:00.000Z");
    expect(inviteExpiry(0, now).toISOString()).toBe("2026-10-02T00:00:00.000Z");
    expect(inviteExpiry(99, now).getTime()).toBeLessThan(now.getTime() + 30 * 86_400_000);
  });
  it("derives invite state", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    expect(inviteState({ acceptedAt: null, revokedAt: null, expiresAt: "2026-10-02T00:00:00Z" }, now)).toBe("pending");
    expect(inviteState({ acceptedAt: null, revokedAt: null, expiresAt: "2026-09-30T00:00:00Z" }, now)).toBe("expired");
    expect(inviteState({ acceptedAt: "x", revokedAt: null, expiresAt: "2026-09-30T00:00:00Z" }, now)).toBe("accepted");
    expect(inviteState({ acceptedAt: null, revokedAt: "x", expiresAt: "2026-10-02T00:00:00Z" }, now)).toBe("revoked");
  });
});

describe("feed cursor", () => {
  it("round-trips and rejects tampering", () => {
    const c = { publishedAt: "2026-09-30T12:00:00.123456+00:00", id: "00000000-0000-4000-8000-000000000001" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(decodeCursor("not-a-cursor")).toBeNull();
    expect(decodeCursor(Buffer.from('2026-01-01",id.gt.0|00000000-0000-4000-8000-000000000001').toString("base64url"))).toBeNull();
  });
});

describe("validation", () => {
  it("requires a caption or photograph and rejects unknown keys", () => {
    expect(createPostSchema.safeParse({ caption: "  " }).success).toBe(false);
    expect(createPostSchema.safeParse({ caption: "Hello", authorId: "x" }).success).toBe(false);
    const ok = createPostSchema.parse({ caption: "  Hello  " });
    expect(ok).toEqual({ caption: "Hello", mediaIds: [], submit: false });
    expect(createPostSchema.safeParse({ caption: "x".repeat(501) }).success).toBe(false);
  });
  it("requires alt text, a real permission statement and confirmation for uploads", () => {
    const r = uploadFieldsSchema.safeParse({ altText: "", permissionBasis: "yes", peopleConfirmed: "false" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const f = fieldErrors(r.error);
      expect(Object.keys(f).sort()).toEqual(["altText", "peopleConfirmed", "permissionBasis"]);
      expect(f.permissionBasis).toMatch(/at least 10 characters/);
    }
    expect(uploadFieldsSchema.safeParse({ altText: "A cake", permissionBasis: "I took this photo myself", peopleConfirmed: "true" }).success).toBe(true);
  });
  it("normalises invite email and limits roles and expiry", () => {
    expect(inviteSchema.parse({ email: " Aunt@Example.COM ", displayName: "Aunt", role: "viewer" })).toEqual({ email: "aunt@example.com", displayName: "Aunt", role: "viewer", expiresInDays: 7 });
    expect(inviteSchema.safeParse({ email: "no", displayName: "A", role: "viewer" }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "a@b.co", displayName: "A", role: "admin" }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "a@b.co", displayName: "A", role: "viewer", expiresInDays: 31 }).success).toBe(false);
  });
  it("validates family settings dates and zones", () => {
    expect(familySettingsSchema.safeParse({ birthdayDate: "2026-02-30" }).success).toBe(false);
    expect(familySettingsSchema.safeParse({ birthdayDate: "2026-02-28", timezone: "Europe/London" }).success).toBe(true);
    expect(familySettingsSchema.safeParse({ timezone: "Mars/Olympus" }).success).toBe(false);
    expect(familySettingsSchema.safeParse({ recipientName: null }).success).toBe(true);
    expect(familySettingsSchema.safeParse({}).success).toBe(false);
  });
  it("book entries need text or a photograph", () => {
    const chapterId = "00000000-0000-4000-8000-000000000001";
    expect(entryCreateSchema.safeParse({ chapterId, kind: "letter" }).success).toBe(false);
    expect(entryCreateSchema.safeParse({ chapterId, kind: "photo" }).success).toBe(false);
    expect(entryCreateSchema.safeParse({ chapterId, kind: "letter", body: "Dear..." }).success).toBe(true);
  });
  it("accepts spaced codes", () => {
    expect(verifyCodeSchema.parse({ email: "a@b.co", code: "123 456" }).code).toBe("123456");
    expect(verifyCodeSchema.safeParse({ email: "a@b.co", code: "12ab56" }).success).toBe(false);
  });
});

describe("fixture importer guards", () => {
  it("refuses production and non-local databases", () => {
    expect(() => assertFixtureImportAllowed({ NODE_ENV: "production" }, "postgresql://127.0.0.1/db")).toThrow(FixtureImportRefused);
    expect(() => assertFixtureImportAllowed({ VERCEL_ENV: "production" }, "postgresql://127.0.0.1/db")).toThrow(FixtureImportRefused);
    expect(() => assertFixtureImportAllowed({}, "postgresql://db.abcd.supabase.co/postgres")).toThrow(/non-local/);
    expect(() => assertFixtureImportAllowed({}, undefined)).toThrow(FixtureImportRefused);
    expect(() => assertFixtureImportAllowed({ NODE_ENV: "development" }, "postgresql://127.0.0.1:54322/postgres")).not.toThrow();
  });
  it("refuses fixtures that are not explicitly fictional", () => {
    expect(() => validateFixture({ ...demo, fictional: false })).toThrow(/not marked fictional/);
    expect(() => validateFixture({ ...demo, productionImportAllowed: true })).toThrow(FixtureImportRefused);
    expect(() => validateFixture(demo)).not.toThrow();
  });
  it("labels everything fictional and never publishes", () => {
    validateFixture(demo);
    const sql = buildFixtureSql(demo, { curatorUserId: "00000000-0000-4000-8000-000000000101" });
    expect(sql).toContain("is_fictional_fixture");
    expect(sql).not.toMatch(/'published'/);
    expect(sql).not.toMatch(/publish_family_book/);
    expect(labelFictional("Happy birthday")).toBe("[Fictional] Happy birthday");
    expect(() => buildFixtureSql(demo, { curatorUserId: "x'; drop table families; --" })).toThrow(FixtureImportRefused);
  });
});
