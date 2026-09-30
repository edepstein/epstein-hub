/** The fictional fixture SQL applies cleanly to the real schema and never reaches a reader. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import demo from "../../reference/build-pack-v3/content/birthday-demo.json";
import { buildFixtureSql, validateFixture } from "../../src/lib/family/fixture-import";
import { asActor, postgresUnavailableReason, startCluster, type TestCluster } from "./pg-harness";

const skip = postgresUnavailableReason();
const CURATOR = "00000000-0000-4000-8000-000000000701";
const VIEWER = "00000000-0000-4000-8000-000000000702";

describe.skipIf(!!skip)("fictional fixture import", () => {
  let db: TestCluster;
  beforeAll(async () => {
    db = await startCluster();
    await db.client.query("insert into auth.users (id, email, email_confirmed_at) values ($1, 'c@example.test', now()), ($2, 'v@example.test', now())", [CURATOR, VIEWER]);
    validateFixture(demo);
    await db.client.query(buildFixtureSql(demo, { curatorUserId: CURATOR, viewerUserId: VIEWER }));
  }, 120_000);
  afterAll(async () => {
    await db?.stop();
  });

  it("creates a family flagged as a fictional fixture with labelled content", async () => {
    const fam = await db.client.query("select title, is_fictional_fixture from families");
    expect(fam.rows).toEqual([{ title: "Fictional demonstration family", is_fictional_fixture: true }]);
    const posts = await db.client.query("select caption, status from family_posts");
    expect(posts.rows.every((p) => p.status === "draft" && /fictional|placeholder/i.test(p.caption))).toBe(true);
    const entries = await db.client.query("select heading, body from book_entries");
    expect(entries.rows.length).toBeGreaterThan(0);
    expect(entries.rows.every((e) => /fictional|placeholder|demonstration/i.test(`${e.heading} ${e.body}`))).toBe(true);
  });

  it("shows the reader nothing: drafts stay private and the book is unpublished", async () => {
    const r = await asActor(db.client, { id: VIEWER, label: "viewer" }, async (q) => ({
      posts: (await q("select * from family_posts")).rows,
      snapshots: (await q("select * from book_snapshots")).rows,
      chapters: (await q("select * from book_chapters")).rows,
    }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ posts: [], snapshots: [], chapters: [] });
  });
});
