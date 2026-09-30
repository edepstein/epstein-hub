/**
 * Private-space test matrix (docs/05) against the real migrations on a throwaway Postgres 16.
 * Family A: curator, contributor, second contributor, viewer. Family B: curator, contributor.
 * Plus an authenticated outsider, a puzzle editor with no membership and an anonymous caller.
 */
import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asActor, postgresUnavailableReason, startCluster, type Actor, type TestCluster } from "./pg-harness";

const skip = postgresUnavailableReason();
if (skip) console.warn(`[family rls] skipped: ${skip}`);

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A_CUR: Actor = { id: uuid(101), label: "A curator" };
const A_CON: Actor = { id: uuid(102), label: "A contributor" };
const A_CON2: Actor = { id: uuid(103), label: "A contributor 2" };
const A_VIEW: Actor = { id: uuid(104), label: "A viewer" };
const B_CUR: Actor = { id: uuid(201), label: "B curator" };
const B_CON: Actor = { id: uuid(202), label: "B contributor" };
const OUTSIDER: Actor = { id: uuid(301), label: "outsider" };
const EDITOR: Actor = { id: uuid(302), label: "puzzle editor" };
const UNVERIFIED: Actor = { id: uuid(303), label: "unverified" };
const ANON: Actor = { id: null, label: "anonymous" };

const email = (a: Actor) => `${a.label.replace(/\s+/g, "-").toLowerCase()}@example.test`;
const token = () => randomBytes(32).toString("base64url");
const hash = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");

describe.skipIf(!!skip)("family RLS and RPC matrix", () => {
  let db: TestCluster;
  let familyA = "";
  let familyB = "";

  const as = <T,>(actor: Actor, fn: Parameters<typeof asActor<T>>[2]) => asActor<T>(db.client, actor, fn);
  const rows = async (actor: Actor, sql: string, params?: unknown[]) => {
    const r = await as(actor, (q) => q(sql, params));
    if (!r.ok) throw new Error(`${actor.label}: ${r.error.message}`);
    return r.value.rows;
  };
  const fails = async (actor: Actor, sql: string, params?: unknown[]) => {
    const r = await as(actor, (q) => q(sql, params));
    expect(r.ok, `${actor.label} should fail: ${sql}`).toBe(false);
    return r.ok ? { code: "", message: "" } : r.error;
  };

  async function invite(curator: Actor, family: string, who: Actor, role: string, opts: { expires?: string } = {}) {
    const t = token();
    await rows(
      curator,
      `insert into family_invites (family_id, invited_email, display_name, role, token_hash, expires_at, invited_by)
       values ($1, $2, $3, $4, $5, now() + ${opts.expires ?? "interval '7 days'"}, $6) returning id`,
      [family, email(who), who.label, role, hash(t), curator.id],
    );
    return t;
  }

  beforeAll(async () => {
    db = await startCluster();
    const c = db.client;
    for (const a of [A_CUR, A_CON, A_CON2, A_VIEW, B_CUR, B_CON, OUTSIDER, EDITOR]) {
      await c.query("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())", [a.id, email(a)]);
    }
    await c.query("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, null)", [UNVERIFIED.id, email(UNVERIFIED)]);
    await c.query("insert into editor_roles (user_id, role) values ($1, 'admin')", [EDITOR.id]);
    familyA = (await c.query("select bootstrap_family('Family A', $1, 'A curator') as id", [A_CUR.id])).rows[0].id;
    familyB = (await c.query("select bootstrap_family('Family B', $1, 'B curator') as id", [B_CUR.id])).rows[0].id;

    // Members join through real invitations.
    for (const [who, role] of [
      [A_CON, "contributor"],
      [A_CON2, "contributor"],
      [A_VIEW, "viewer"],
    ] as const) {
      const t = await invite(A_CUR, familyA, who, role);
      await rows(who, "select accept_family_invite($1)", [t]);
    }
    const tb = await invite(B_CUR, familyB, B_CON, "contributor");
    await rows(B_CON, "select accept_family_invite($1)", [tb]);
  }, 120_000);

  afterAll(async () => {
    await db?.stop();
  });

  // ---------------------------------------------------------------- anonymous and outsiders
  describe("anonymous and unrelated accounts", () => {
    it("anonymous callers have no privileges on any family table", async () => {
      for (const t of ["families", "family_memberships", "family_invites", "family_posts", "family_media", "family_comments", "book_snapshots", "audit_events", "consent_records"]) {
        const e = await fails(ANON, `select * from ${t}`);
        expect(e.code).toBe("42501");
      }
      expect(await rows(ANON, "select * from storage.objects")).toHaveLength(0);
    });

    it("anonymous callers cannot execute family RPCs", async () => {
      expect((await fails(ANON, "select accept_family_invite('x')")).code).toBe("42501");
      expect((await fails(ANON, "select has_family_role($1, 'viewer')", [familyA])).code).toBe("42501");
    });

    it("an authenticated outsider and a puzzle editor see nothing", async () => {
      for (const a of [OUTSIDER, EDITOR]) {
        expect(await rows(a, "select * from families")).toHaveLength(0);
        expect(await rows(a, "select * from family_posts")).toHaveLength(0);
        expect(await rows(a, "select * from family_memberships")).toHaveLength(0);
      }
      expect(await rows(EDITOR, "select role from editor_roles")).toEqual([{ role: "admin" }]);
      expect(await rows(A_CUR, "select * from editor_roles")).toHaveLength(0);
    });

    it("spoofed family ids in writes fail", async () => {
      const e = await fails(OUTSIDER, "insert into family_posts (family_id, author_id, caption) values ($1, $2, 'x')", [familyA, OUTSIDER.id]);
      expect(e.code).toBe("42501");
      // Spoofing someone else's author id fails even for a real contributor.
      await fails(A_CON, "insert into family_posts (family_id, author_id, caption) values ($1, $2, 'x')", [familyA, A_CON2.id]);
    });
  });

  // ---------------------------------------------------------------- invitations and roles
  describe("invitations and role changes", () => {
    it("records accepted memberships with the invited role", async () => {
      const r = await rows(A_CUR, "select user_id, role from family_memberships where family_id = $1 order by user_id", [familyA]);
      expect(r.map((x) => [x.user_id, x.role])).toEqual([
        [A_CUR.id, "curator"],
        [A_CON.id, "contributor"],
        [A_CON2.id, "contributor"],
        [A_VIEW.id, "viewer"],
      ]);
    });

    it("stores only a hash of the token", async () => {
      const t = await invite(A_CUR, familyA, OUTSIDER, "viewer");
      const r = await rows(A_CUR, "select token_hash from family_invites where token_hash = $1", [hash(t)]);
      expect(r).toHaveLength(1);
      const all = await db.client.query("select * from family_invites");
      expect(JSON.stringify(all.rows)).not.toContain(t);
    });

    it("rejects reused, expired, revoked, unknown and wrong-email invitations", async () => {
      const t = await invite(A_CUR, familyA, OUTSIDER, "viewer");
      // Wrong account (email mismatch): the link alone is not enough.
      expect((await fails(A_VIEW, "select accept_family_invite($1)", [t])).message).toBe("invite_email_mismatch");
      await rows(OUTSIDER, "select accept_family_invite($1)", [t]);
      expect((await fails(OUTSIDER, "select accept_family_invite($1)", [t])).message).toBe("invite_used");

      const expired = await invite(A_CUR, familyA, OUTSIDER, "viewer");
      await db.client.query("set session_replication_role = replica");
      await db.client.query("update family_invites set created_at = now() - interval '9 days', expires_at = now() - interval '1 day' where token_hash = $1", [hash(expired)]);
      await db.client.query("set session_replication_role = origin");
      expect((await fails(OUTSIDER, "select accept_family_invite($1)", [expired])).message).toBe("invite_expired");

      const revoked = await invite(A_CUR, familyA, OUTSIDER, "viewer");
      await rows(A_CUR, "update family_invites set revoked_at = now() where token_hash = $1", [hash(revoked)]);
      expect((await fails(OUTSIDER, "select accept_family_invite($1)", [revoked])).message).toBe("invite_revoked");

      expect((await fails(OUTSIDER, "select accept_family_invite($1)", [token()])).message).toBe("invite_not_found");

      const unverified = await invite(A_CUR, familyA, UNVERIFIED, "viewer");
      expect((await fails(UNVERIFIED, "select accept_family_invite($1)", [unverified])).message).toBe("email_unverified");

      // Clean up the outsider's membership for later tests.
      await rows(A_CUR, "update family_memberships set status = 'revoked' where family_id = $1 and user_id = $2", [familyA, OUTSIDER.id]);
    });

    it("contributors and viewers cannot invite, and invites are curator-only reads", async () => {
      for (const a of [A_CON, A_VIEW]) {
        const e = await fails(
          a,
          `insert into family_invites (family_id, invited_email, display_name, role, token_hash, expires_at, invited_by)
           values ($1, 'x@example.test', 'X', 'curator', $2, now() + interval '1 day', $3)`,
          [familyA, hash(token()), a.id],
        );
        expect(e.code).toBe("42501");
        expect(await rows(a, "select * from family_invites")).toHaveLength(0);
      }
    });

    it("contributors cannot elevate themselves or others", async () => {
      expect(await rows(A_CON, "update family_memberships set role = 'curator' where user_id = $1 returning *", [A_CON.id])).toHaveLength(0);
      expect(await rows(A_VIEW, "update family_memberships set role = 'contributor' where user_id = $1 returning *", [A_VIEW.id])).toHaveLength(0);
      expect((await fails(A_CON, "insert into family_memberships (family_id, user_id, role, display_name) values ($1, $2, 'curator', 'x')", [familyA, OUTSIDER.id])).code).toBe("42501");
      expect((await fails(A_CON, "update family_memberships set family_id = $1 where user_id = $2", [familyB, A_CON.id])).code).toBe("42501");
      const r = await rows(A_CUR, "select role from family_memberships where user_id = $1", [A_CON.id]);
      expect(r[0].role).toBe("contributor");
    });

    it("curators cannot touch another family", async () => {
      expect(await rows(A_CUR, "select * from families where id = $1", [familyB])).toHaveLength(0);
      expect(await rows(A_CUR, "update families set title = 'hijack' where id = $1 returning *", [familyB])).toHaveLength(0);
      expect(await rows(A_CUR, "update family_memberships set status = 'revoked' where family_id = $1 returning *", [familyB])).toHaveLength(0);
      const e = await fails(
        A_CUR,
        `insert into family_invites (family_id, invited_email, display_name, role, token_hash, expires_at, invited_by)
         values ($1, 'x@example.test', 'X', 'viewer', $2, now() + interval '1 day', $3)`,
        [familyB, hash(token()), A_CUR.id],
      );
      expect(e.code).toBe("42501");
    });

    it("keeps at least one active curator", async () => {
      expect((await fails(A_CUR, "update family_memberships set role = 'viewer' where family_id = $1 and user_id = $2", [familyA, A_CUR.id])).message).toBe("last_curator");
    });

    it("rejects invite expiry beyond 30 days", async () => {
      await fails(
        A_CUR,
        `insert into family_invites (family_id, invited_email, display_name, role, token_hash, expires_at, invited_by)
         values ($1, 'y@example.test', 'Y', 'viewer', $2, now() + interval '31 days', $3)`,
        [familyA, hash(token()), A_CUR.id],
      );
    });
  });

  // ---------------------------------------------------------------- posts, media, moderation
  describe("contribution, moderation and media", () => {
    let mediaId = "";
    let postId = "";

    it("viewers cannot post or upload", async () => {
      expect((await fails(A_VIEW, "insert into family_posts (family_id, author_id, caption) values ($1, $2, 'hello')", [familyA, A_VIEW.id])).code).toBe("42501");
      expect(
        (await fails(A_VIEW, "insert into family_media (family_id, owner_id, kind, mime_type, byte_size) values ($1, $2, 'image', 'image/jpeg', 100)", [familyA, A_VIEW.id])).code,
      ).toBe("42501");
      expect((await fails(A_VIEW, "insert into storage.objects (bucket_id, name) values ('family-media', $1)", [`${familyA}/${uuid(999)}`])).code).toBe("42501");
    });

    it("a contributor reserves media, uploads the object, records consent and drafts a post", async () => {
      mediaId = (await rows(A_CON, "insert into family_media (family_id, owner_id, kind, mime_type, byte_size) values ($1, $2, 'image', 'image/jpeg', 2048) returning id", [familyA, A_CON.id]))[0].id;
      await rows(A_CON, "insert into storage.objects (bucket_id, name, owner) values ('family-media', $1, $2)", [`${familyA}/${mediaId}`, A_CON.id]);
      await rows(A_CON, "update family_media set processing_status = 'ready', width = 800, height = 600, alt_text = 'Two people at a table' where id = $1", [mediaId]);
      await rows(A_CON, "insert into consent_records (family_id, media_id, recorded_by, permission_basis, people_pictured_confirmed) values ($1, $2, $3, 'Taken by me; both people agreed to share with the family', true)", [familyA, mediaId, A_CON.id]);
      postId = (await rows(A_CON, "insert into family_posts (family_id, author_id, caption) values ($1, $2, 'Secret draft caption') returning id", [familyA, A_CON.id]))[0].id;
      await rows(A_CON, "insert into family_post_media (post_id, family_id, media_id) values ($1, $2, $3)", [postId, familyA, mediaId]);
    });

    it("contributors cannot self-approve consent or touch another family's object path", async () => {
      expect((await fails(A_CON, "update family_media set consent_status = 'approved' where id = $1", [mediaId])).code).toBe("42501");
      expect((await fails(A_CON, "insert into storage.objects (bucket_id, name) values ('family-media', $1)", [`${familyB}/${mediaId}`])).code).toBe("42501");
      // The immutable family_id cannot be rewritten (no column privilege).
      expect((await fails(A_CON, "update family_media set family_id = $1 where id = $2", [familyB, mediaId])).code).toBe("42501");
    });

    it("drafts are private to their author", async () => {
      for (const a of [A_CON2, A_VIEW, B_CUR, OUTSIDER]) {
        expect(await rows(a, "select * from family_posts where id = $1", [postId])).toHaveLength(0);
        expect(await rows(a, "select * from family_media where id = $1", [mediaId])).toHaveLength(0);
        expect(await rows(a, "select * from storage.objects where name = $1", [`${familyA}/${mediaId}`])).toHaveLength(0);
      }
      expect(await rows(A_CON, "select * from storage.objects where name = $1", [`${familyA}/${mediaId}`])).toHaveLength(1);
      // Another contributor cannot edit or delete it either.
      expect(await rows(A_CON2, "update family_posts set caption = 'x' where id = $1 returning *", [postId])).toHaveLength(0);
    });

    it("contributors cannot publish their own post", async () => {
      expect((await fails(A_CON, "update family_posts set status = 'published' where id = $1", [postId])).code).toBe("42501");
      expect((await fails(A_CON, "select moderate_family_post($1, 'approve', null)", [postId])).message).toBe("forbidden");
      await rows(A_CON, "update family_posts set status = 'submitted' where id = $1", [postId]);
    });

    it("curators of another family cannot moderate", async () => {
      // B's curator cannot even see the post: it is concealed as not found.
      expect((await fails(B_CUR, "select moderate_family_post($1, 'approve', null)", [postId])).message).toBe("not_found");
    });

    it("rejects a stale version and then publishes", async () => {
      const [{ version }] = await rows(A_CUR, "select version from family_posts where id = $1", [postId]);
      expect((await fails(A_CUR, "select moderate_family_post($1, 'approve', $2)", [postId, version - 1])).message).toBe("version_conflict");
      await rows(A_CUR, "select moderate_family_post($1, 'approve', $2)", [postId, version]);
      const [p] = await rows(A_VIEW, "select status, published_at, reviewed_by from family_posts where id = $1", [postId]);
      expect(p.status).toBe("published");
      expect(p.published_at).not.toBeNull();
      expect(p.reviewed_by).toBe(A_CUR.id);
      expect(await rows(A_VIEW, "select consent_status from family_media where id = $1", [mediaId])).toEqual([{ consent_status: "approved" }]);
      expect(await rows(A_VIEW, "select name from storage.objects where name = $1", [`${familyA}/${mediaId}`])).toHaveLength(1);
      // Family B still sees nothing.
      expect(await rows(B_CUR, "select * from family_posts")).toHaveLength(0);
      expect(await rows(B_CUR, "select * from storage.objects")).toHaveLength(0);
    });

    it("contributors cannot edit a published post", async () => {
      expect(await rows(A_CON, "update family_posts set caption = 'changed' where id = $1 returning *", [postId])).toHaveLength(0);
    });

    it("cross-family media attachment fails", async () => {
      const bPost = (await rows(B_CON, "insert into family_posts (family_id, author_id, caption) values ($1, $2, 'b') returning id", [familyB, B_CON.id]))[0].id;
      // Attaching A's media to B's post: composite FK / RLS reject it whichever family id is claimed.
      await fails(B_CON, "insert into family_post_media (post_id, family_id, media_id) values ($1, $2, $3)", [bPost, familyB, mediaId]);
      await fails(B_CON, "insert into family_post_media (post_id, family_id, media_id) values ($1, $2, $3)", [bPost, familyA, mediaId]);
      await fails(B_CUR, "insert into book_entries (family_id, chapter_id, kind, media_id, position) values ($1, gen_random_uuid(), 'photo', $2, 0)", [familyB, mediaId]);
      // Even the superuser cannot make the link: the composite foreign key refuses it.
      const err = await db.client.query("insert into family_post_media (post_id, family_id, media_id) values ($1, $2, $3)", [bPost, familyB, mediaId]).catch((e) => e);
      expect(err.code).toBe("23503");
    });

    it("members reply to published posts only; replies stay in the family", async () => {
      await rows(A_VIEW, "insert into family_comments (family_id, post_id, author_id, body) values ($1, $2, $3, 'Lovely photograph')", [familyA, postId, A_VIEW.id]);
      expect(await rows(A_CON2, "select body from family_comments where post_id = $1", [postId])).toEqual([{ body: "Lovely photograph" }]);
      expect(await rows(B_CUR, "select * from family_comments")).toHaveLength(0);
      const draft = (await rows(A_CON2, "insert into family_posts (family_id, author_id, caption) values ($1, $2, 'd') returning id", [familyA, A_CON2.id]))[0].id;
      expect((await fails(A_VIEW, "insert into family_comments (family_id, post_id, author_id, body) values ($1, $2, $3, 'x')", [familyA, draft, A_VIEW.id])).code).toBe("42501");
      await fails(A_VIEW, "insert into family_comments (family_id, post_id, author_id, body) values ($1, $2, $3, 'x')", [familyA, postId, A_CON.id]);
      // Only the author (or a curator) can remove a reply, and only by soft delete.
      expect(await rows(A_CON, "update family_comments set deleted_at = now() where post_id = $1 returning *", [postId])).toHaveLength(0);
      expect((await fails(A_VIEW, "update family_comments set body = 'edited' where post_id = $1", [postId])).code).toBe("42501");
    });

    it("favourites are private to their owner and survive only while the post is visible", async () => {
      await rows(A_VIEW, "insert into family_favourites (family_id, user_id, post_id) values ($1, $2, $3)", [familyA, A_VIEW.id, postId]);
      expect(await rows(A_VIEW, "select post_id from family_favourites")).toEqual([{ post_id: postId }]);
      expect(await rows(A_CUR, "select * from family_favourites")).toHaveLength(0);
      await fails(A_CON, "insert into family_favourites (family_id, user_id, post_id) values ($1, $2, $3)", [familyA, A_VIEW.id, postId]);
    });

    it("withdrawal hides the post, its media and the stored object from viewers", async () => {
      await rows(A_CUR, "select moderate_family_post($1, 'withdraw', null)", [postId]);
      expect(await rows(A_VIEW, "select * from family_posts where id = $1", [postId])).toHaveLength(0);
      expect(await rows(A_VIEW, "select * from family_media where id = $1", [mediaId])).toHaveLength(0);
      expect(await rows(A_VIEW, "select * from storage.objects where name = $1", [`${familyA}/${mediaId}`])).toHaveLength(0);
      expect(await rows(A_VIEW, "select p.id from family_favourites f join family_posts p on p.id = f.post_id")).toHaveLength(0);
      await rows(A_CUR, "select moderate_family_post($1, 'approve', null)", [postId]);
      expect(await rows(A_VIEW, "select id from family_posts where id = $1", [postId])).toHaveLength(1);
    });

    it("revoked members lose access on their next query", async () => {
      expect(await rows(A_VIEW, "select id from family_posts")).toHaveLength(1);
      await rows(A_CUR, "update family_memberships set status = 'revoked' where family_id = $1 and user_id = $2", [familyA, A_VIEW.id]);
      expect(await rows(A_VIEW, "select * from family_posts")).toHaveLength(0);
      expect(await rows(A_VIEW, "select * from families")).toHaveLength(0);
      expect(await rows(A_VIEW, "select * from storage.objects")).toHaveLength(0);
      expect(await rows(A_VIEW, "select * from family_favourites")).toHaveLength(0);
      await fails(A_VIEW, "insert into family_comments (family_id, post_id, author_id, body) values ($1, $2, $3, 'x')", [familyA, postId, A_VIEW.id]);
      // Their own membership row stays readable so the UI can explain the revocation.
      expect(await rows(A_VIEW, "select status from family_memberships where user_id = $1", [A_VIEW.id])).toEqual([{ status: "revoked" }]);
      await rows(A_CUR, "update family_memberships set status = 'active' where family_id = $1 and user_id = $2", [familyA, A_VIEW.id]);
      expect(await rows(A_VIEW, "select id from family_posts")).toHaveLength(1);
    });

    it("consent withdrawal removes media from viewers", async () => {
      await rows(A_CON, "update consent_records set withdrawn_at = now() where media_id = $1", [mediaId]);
      await rows(A_CON, "update family_media set consent_status = 'withdrawn' where id = $1", [mediaId]);
      expect(await rows(A_VIEW, "select * from family_media where id = $1", [mediaId])).toHaveLength(0);
      expect(await rows(A_VIEW, "select * from storage.objects where name = $1", [`${familyA}/${mediaId}`])).toHaveLength(0);
      expect(await rows(A_CUR, "select consent_status from family_media where id = $1", [mediaId])).toEqual([{ consent_status: "withdrawn" }]);
    });

    it("audit trail is curator-only and holds no captions or tokens", async () => {
      const events = await rows(A_CUR, "select * from audit_events where family_id = $1", [familyA]);
      expect(events.length).toBeGreaterThan(5);
      expect(events.map((e) => e.action)).toEqual(expect.arrayContaining(["invite.created", "invite.accepted", "post.submitted", "post.published", "post.withdrawn", "membership.revoked"]));
      const text = JSON.stringify(events);
      expect(text).not.toContain("Secret draft caption");
      expect(text).not.toContain("@example.test");
      expect(await rows(A_VIEW, "select * from audit_events")).toHaveLength(0);
      expect(await rows(A_CON, "select * from audit_events")).toHaveLength(0);
      expect((await fails(A_CUR, "insert into audit_events (family_id, action, target_type) values ($1, 'x', 'y')", [familyA])).code).toBe("42501");
    });
  });

  // ---------------------------------------------------------------- Birthday Book
  describe("Birthday Book", () => {
    let bookId = "";
    let photoId = "";

    it("only curators compose the book", async () => {
      expect((await fails(A_CON, "insert into family_books (family_id, title) values ($1, 'Book')", [familyA])).code).toBe("42501");
      bookId = (await rows(A_CUR, "insert into family_books (family_id, title, dedication) values ($1, 'Birthday book', 'Dedication supplied by the family') returning id", [familyA]))[0].id;
      await fails(A_CON, "insert into book_chapters (family_id, book_id, title, position) values ($1, $2, 'x', 0)", [familyA, bookId]);
      await fails(B_CUR, "insert into book_chapters (family_id, book_id, title, position) values ($1, $2, 'x', 0)", [familyB, bookId]);
    });

    it("refuses to publish an empty chapter and publishes atomically", async () => {
      const ch1 = (await rows(A_CUR, "insert into book_chapters (family_id, book_id, title, position) values ($1, $2, 'Letters', 0) returning id", [familyA, bookId]))[0].id;
      const ch2 = (await rows(A_CUR, "insert into book_chapters (family_id, book_id, title, position) values ($1, $2, 'Photographs', 1) returning id", [familyA, bookId]))[0].id;
      expect((await fails(A_CUR, "select publish_family_book($1)", [bookId])).message).toBe("chapter_empty");
      await rows(A_CUR, "insert into book_entries (family_id, chapter_id, kind, heading, body, position) values ($1, $2, 'letter', 'A letter', 'Letter text', 0)", [familyA, ch1]);
      photoId = (await rows(A_CUR, "insert into family_media (family_id, owner_id, kind, mime_type, byte_size) values ($1, $2, 'image', 'image/png', 500) returning id", [familyA, A_CUR.id]))[0].id;
      await rows(A_CUR, "update family_media set processing_status = 'ready', width = 10, height = 10, alt_text = 'A garden', consent_status = 'approved' where id = $1", [photoId]);
      await rows(A_CUR, "insert into book_entries (family_id, chapter_id, kind, media_id, position) values ($1, $2, 'photo', $3, 0)", [familyA, ch2, photoId]);
      await rows(A_CUR, "select move_book_chapter($1, -1)", [ch2]);
      expect((await fails(A_CON, "select publish_family_book($1)", [bookId])).message).toBe("forbidden");
      expect((await rows(A_CUR, "select publish_family_book($1) as v", [bookId]))[0].v).toBe(1);
    });

    it("viewers read the published snapshot, not the drafts", async () => {
      expect(await rows(A_VIEW, "select * from book_chapters")).toHaveLength(0);
      const [snap] = await rows(A_VIEW, "select version, content from book_snapshots where book_id = $1", [bookId]);
      expect(snap.version).toBe(1);
      expect(snap.content.chapters.map((c: { title: string }) => c.title)).toEqual(["Photographs", "Letters"]);
      expect(await rows(A_VIEW, "select id from family_media where id = $1", [photoId])).toHaveLength(1);
      expect(await rows(B_CUR, "select * from book_snapshots")).toHaveLength(0);
      // Later draft edits do not leak until the next publish.
      await rows(A_CUR, "update book_chapters set title = 'Renamed draft' where book_id = $1 and position = 0", [bookId]);
      const [again] = await rows(A_VIEW, "select content from book_snapshots where book_id = $1 order by version desc limit 1", [bookId]);
      expect(again.content.chapters[0].title).toBe("Photographs");
    });

    it("reading progress is per user", async () => {
      await rows(A_VIEW, "insert into book_progress (family_id, user_id, book_id, chapter_index) values ($1, $2, $3, 1)", [familyA, A_VIEW.id, bookId]);
      await fails(A_VIEW, "insert into book_progress (family_id, user_id, book_id, chapter_index) values ($1, $2, $3, 1)", [familyA, A_CON.id, bookId]);
      expect(await rows(A_CON, "select * from book_progress")).toHaveLength(0);
      expect(await rows(A_VIEW, "select chapter_index from book_progress")).toEqual([{ chapter_index: 1 }]);
    });
  });

  // ---------------------------------------------------------------- retries, soft deletes, downloads
  describe("retries, soft deletes and download flags", () => {
    it("authors soft-delete their own drafts through a PostgREST-style RETURNING update", async () => {
      const id = (await rows(A_CON2, "insert into family_posts (family_id, author_id, caption) values ($1, $2, 'to delete') returning id", [familyA, A_CON2.id]))[0].id;
      const r = await rows(A_CON2, "with u as (update family_posts set status = 'deleted' where id = $1 returning *) select count(*)::int as n from u", [id]);
      expect(r[0].n).toBe(1);
      expect(await rows(A_CUR, "select status from family_posts where id = $1", [id])).toEqual([{ status: "deleted" }]);
      expect((await fails(A_CUR, "select moderate_family_post($1, 'approve', null)", [id])).message).toBe("invalid_transition");
      expect((await fails(A_CUR, "update family_posts set caption = 'revive' where id = $1", [id])).message).toBe("post_deleted");
      expect(await rows(A_VIEW, "select * from family_posts where id = $1", [id])).toHaveLength(0);
    });

    it("a repeated client request id cannot create a duplicate post or media item", async () => {
      const rid = "00000000-0000-4000-8000-00000000abcd";
      await rows(A_CON, "insert into family_posts (family_id, author_id, caption, client_request_id) values ($1, $2, 'once', $3)", [familyA, A_CON.id, rid]);
      expect((await fails(A_CON, "insert into family_posts (family_id, author_id, caption, client_request_id) values ($1, $2, 'twice', $3)", [familyA, A_CON.id, rid])).code).toBe("23505");
      await rows(A_CON, "insert into family_media (family_id, owner_id, kind, mime_type, byte_size, client_request_id) values ($1, $2, 'image', 'image/png', 10, $3)", [familyA, A_CON.id, rid]);
      expect((await fails(A_CON, "insert into family_media (family_id, owner_id, kind, mime_type, byte_size, client_request_id) values ($1, $2, 'image', 'image/png', 10, $3)", [familyA, A_CON.id, rid])).code).toBe("23505");
    });

    it("download permission follows the latest active consent record and family visibility", async () => {
      const m = (await rows(A_CON, "insert into family_media (family_id, owner_id, kind, mime_type, byte_size) values ($1, $2, 'image', 'image/webp', 10) returning id", [familyA, A_CON.id]))[0].id;
      await rows(A_CON, "update family_media set processing_status = 'ready', width = 1, height = 1, alt_text = 'x' where id = $1", [m]);
      await rows(A_CON, "insert into consent_records (family_id, media_id, recorded_by, permission_basis, people_pictured_confirmed, download_allowed) values ($1, $2, $3, 'My own photograph of the garden', true, true)", [familyA, m, A_CON.id]);
      const p = (await rows(A_CON, "insert into family_posts (family_id, author_id, caption, status) values ($1, $2, 'garden', 'submitted') returning id", [familyA, A_CON.id]))[0].id;
      await rows(A_CON, "insert into family_post_media (post_id, family_id, media_id) values ($1, $2, $3)", [p, familyA, m]);
      expect(await rows(A_VIEW, "select * from media_download_flags($1)", [[m]])).toHaveLength(0); // not published yet
      await rows(A_CUR, "select moderate_family_post($1, 'approve', null)", [p]);
      expect(await rows(A_VIEW, "select allowed from media_download_flags($1)", [[m]])).toEqual([{ allowed: true }]);
      expect(await rows(B_CUR, "select * from media_download_flags($1)", [[m]])).toHaveLength(0);
      expect(await rows(A_VIEW, "select * from consent_records")).toHaveLength(0);
    });

    it("orphan cleanup is owner-only (service role / SQL editor)", async () => {
      expect((await fails(A_CUR, "select cleanup_orphan_family_media()")).code).toBe("42501");
      await db.client.query("update family_media set created_at = now() - interval '2 days' where processing_status = 'reserved'");
      const r = await db.client.query("select cleanup_orphan_family_media() as n");
      expect(r.rows[0].n).toBeGreaterThanOrEqual(1);
    });
  });
});
