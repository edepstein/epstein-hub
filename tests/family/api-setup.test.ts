/**
 * Without Supabase configuration every family and auth API must answer with an explicit
 * "setup needed" state (503 setup_needed, private no-store), never a fake success.
 */
import { beforeAll, describe, expect, it } from "vitest";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
type Glob = (patterns: string[]) => Record<string, () => Promise<Record<string, unknown>>>;
// Vite's import.meta.glob (vitest), typed locally because the app tsconfig has no vite types.
const modules = (import.meta as unknown as { glob: Glob }).glob(["../../src/app/api/family/**/route.ts", "../../src/app/api/auth/**/route.ts"]);
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const ID = "00000000-0000-4000-8000-000000000001";

describe("family and auth APIs without Supabase configuration", () => {
  beforeAll(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("finds the route modules", () => {
    expect(Object.keys(modules).length).toBeGreaterThanOrEqual(20);
  });

  for (const [file, load] of Object.entries(modules)) {
    it(`${file.replace("../../src/app", "")} reports setup needed`, async () => {
      const mod = await load();
      const handlers = METHODS.filter((m) => typeof mod[m] === "function");
      expect(handlers.length, file).toBeGreaterThan(0);
      for (const method of handlers) {
        const url = `http://127.0.0.1:3202${file.replace("../../src/app", "").replace("/route.ts", "").replace(/\[[^\]]+\]/g, ID)}`;
        const req = new Request(url, {
          method,
          headers: { origin: "http://127.0.0.1:3202", "content-type": "application/json" },
          body: method === "GET" ? undefined : "{}",
        });
        const res = await (mod[method] as Handler)(req, { params: Promise.resolve({ familyId: ID, postId: ID, mediaId: ID, inviteId: ID, userId: ID, replyId: ID, chapterId: ID, entryId: ID }) });
        if (/auth\/(callback|confirm)/.test(file)) {
          expect(res.status, `${method} ${file}`).toBe(303);
          expect(res.headers.get("location")).toContain("/sign-in");
          continue;
        }
        expect(res.status, `${method} ${file}`).toBe(503);
        expect(res.headers.get("cache-control")).toContain("no-store");
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe("setup_needed");
      }
    });
  }
});
