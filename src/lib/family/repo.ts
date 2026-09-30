import type { SupabaseClient } from "@supabase/supabase-js";
import type { FamilyRole, MembershipStatus, PostStatus } from "./authz";

/**
 * Read helpers over the signed-in user's Supabase client. Every query is filtered by RLS as that
 * user; the explicit family_id filters are for correctness and index use, not for security.
 */

export interface MediaRef {
  id: string;
  altText: string;
  width: number | null;
  height: number | null;
  status: string;
  consent: string;
  downloadAllowed?: boolean;
}

export interface ReplyItem {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface PostItem {
  id: string;
  caption: string;
  status: PostStatus;
  version: number;
  authorId: string;
  authorName: string;
  createdAt: string;
  submittedAt: string | null;
  publishedAt: string | null;
  media: MediaRef[];
  replies: ReplyItem[];
  favourited: boolean;
}

export interface MemberItem {
  userId: string;
  displayName: string;
  role: FamilyRole;
  status: MembershipStatus;
  createdAt: string;
  revokedAt: string | null;
}

export interface InviteItem {
  id: string;
  email: string;
  displayName: string;
  role: FamilyRole;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export type Cursor = { publishedAt: string; id: string };

export function encodeCursor(c: Cursor): string {
  return Buffer.from(`${c.publishedAt}|${c.id}`, "utf8").toString("base64url");
}

export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const [publishedAt, id] = Buffer.from(raw, "base64url").toString("utf8").split("|");
    if (!publishedAt || !id || !/^[0-9TZ:.+ -]{10,40}$/.test(publishedAt) || Number.isNaN(Date.parse(publishedAt)) || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    return { publishedAt, id };
  } catch {
    return null;
  }
}

const POST_SELECT =
  "id, caption, status, version, author_id, created_at, submitted_at, published_at, family_post_media(position, family_media(id, alt_text, width, height, processing_status, consent_status))";

type Row = Record<string, unknown>;

export async function memberNames(supabase: SupabaseClient, familyId: string): Promise<Map<string, string>> {
  const { data } = await supabase.from("family_memberships").select("user_id, display_name").eq("family_id", familyId);
  return new Map((data ?? []).map((r: Row) => [String(r.user_id), String(r.display_name)]));
}

function toPost(r: Row, names: Map<string, string>): Omit<PostItem, "replies" | "favourited"> {
  const links = ((r.family_post_media as Row[] | null) ?? []).slice().sort((a, b) => Number(a.position) - Number(b.position));
  const media: MediaRef[] = [];
  for (const l of links) {
    const m = l.family_media as Row | null;
    if (!m || m.processing_status === "deleted") continue; // hidden (e.g. consent withdrawn): the text still shows
    media.push({
      id: String(m.id),
      altText: String(m.alt_text ?? ""),
      width: (m.width as number | null) ?? null,
      height: (m.height as number | null) ?? null,
      status: String(m.processing_status),
      consent: String(m.consent_status),
    });
  }
  return {
    id: String(r.id),
    caption: String(r.caption ?? ""),
    status: r.status as PostStatus,
    version: Number(r.version),
    authorId: String(r.author_id),
    authorName: names.get(String(r.author_id)) ?? "A family member",
    createdAt: String(r.created_at),
    submittedAt: (r.submitted_at as string | null) ?? null,
    publishedAt: (r.published_at as string | null) ?? null,
    media,
  };
}

async function decorate(supabase: SupabaseClient, familyId: string, rows: Row[], names: Map<string, string>, withReplies: boolean): Promise<PostItem[]> {
  const ids = rows.map((r) => String(r.id));
  const favourites = new Set<string>();
  const replies = new Map<string, ReplyItem[]>();
  const downloadable = new Set<string>();
  if (ids.length) {
    const [{ data: favs }, { data: reps }] = await Promise.all([
      supabase.from("family_favourites").select("post_id").in("post_id", ids),
      withReplies
        ? supabase.from("family_comments").select("id, post_id, author_id, body, created_at").eq("family_id", familyId).in("post_id", ids).is("deleted_at", null).order("created_at", { ascending: true })
        : Promise.resolve({ data: [] as Row[] }),
    ]);
    for (const f of favs ?? []) favourites.add(String((f as Row).post_id));
    const mediaIds = rows.flatMap((r) => ((r.family_post_media as Row[] | null) ?? []).map((l) => (l.family_media as Row | null)?.id).filter(Boolean));
    if (mediaIds.length) {
      const { data: flags } = await supabase.rpc("media_download_flags", { p_ids: mediaIds });
      for (const f of (flags ?? []) as Row[]) if (f.allowed) downloadable.add(String(f.media_id));
    }
    for (const c of (reps ?? []) as Row[]) {
      const list = replies.get(String(c.post_id)) ?? [];
      list.push({ id: String(c.id), authorId: String(c.author_id), authorName: names.get(String(c.author_id)) ?? "A family member", body: String(c.body), createdAt: String(c.created_at) });
      replies.set(String(c.post_id), list);
    }
  }
  return rows.map((r) => {
    const post = toPost(r, names);
    return {
      ...post,
      media: post.media.map((m) => ({ ...m, downloadAllowed: downloadable.has(m.id) })),
      replies: replies.get(String(r.id)) ?? [],
      favourited: favourites.has(String(r.id)),
    };
  });
}

/** Published posts, newest first, stable cursor pagination. */
export async function listFeed(supabase: SupabaseClient, familyId: string, opts: { cursor?: Cursor | null; limit?: number } = {}) {
  const limit = opts.limit ?? 10;
  let q = supabase.from("family_posts").select(POST_SELECT).eq("family_id", familyId).eq("status", "published");
  if (opts.cursor) {
    const ts = `"${opts.cursor.publishedAt}"`;
    q = q.or(`published_at.lt.${ts},and(published_at.eq.${ts},id.lt.${opts.cursor.id})`);
  }
  const { data, error } = await q.order("published_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  if (error) throw Object.assign(new Error("feed"), { code: error.code });
  const rows = (data ?? []) as Row[];
  const page = rows.slice(0, limit);
  const names = await memberNames(supabase, familyId);
  const posts = await decorate(supabase, familyId, page, names, true);
  const last = page[page.length - 1];
  const nextCursor = rows.length > limit && last ? encodeCursor({ publishedAt: String(last.published_at), id: String(last.id) }) : null;
  return { posts, nextCursor };
}

export async function getLatestPost(supabase: SupabaseClient, familyId: string): Promise<PostItem | null> {
  const { posts } = await listFeed(supabase, familyId, { limit: 1 });
  return posts[0] ?? null;
}

/** The signed-in contributor's own posts (drafts, submissions and outcomes). */
export async function listMyPosts(supabase: SupabaseClient, familyId: string, userId: string): Promise<PostItem[]> {
  const { data, error } = await supabase
    .from("family_posts")
    .select(POST_SELECT)
    .eq("family_id", familyId)
    .eq("author_id", userId)
    .neq("status", "deleted")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw Object.assign(new Error("mine"), { code: error.code });
  return decorate(supabase, familyId, (data ?? []) as Row[], await memberNames(supabase, familyId), false);
}

/** Curator moderation queues. */
export async function listForModeration(supabase: SupabaseClient, familyId: string) {
  const { data, error } = await supabase
    .from("family_posts")
    .select(POST_SELECT)
    .eq("family_id", familyId)
    .in("status", ["submitted", "published", "withdrawn"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw Object.assign(new Error("moderation"), { code: error.code });
  const posts = await decorate(supabase, familyId, (data ?? []) as Row[], await memberNames(supabase, familyId), false);
  return {
    submitted: posts.filter((p) => p.status === "submitted"),
    published: posts.filter((p) => p.status === "published"),
    withdrawn: posts.filter((p) => p.status === "withdrawn"),
  };
}

export async function listMembers(supabase: SupabaseClient, familyId: string): Promise<MemberItem[]> {
  const { data, error } = await supabase
    .from("family_memberships")
    .select("user_id, display_name, role, status, created_at, revoked_at")
    .eq("family_id", familyId)
    .order("created_at", { ascending: true });
  if (error) throw Object.assign(new Error("members"), { code: error.code });
  return ((data ?? []) as Row[]).map((r) => ({
    userId: String(r.user_id),
    displayName: String(r.display_name),
    role: r.role as FamilyRole,
    status: r.status as MembershipStatus,
    createdAt: String(r.created_at),
    revokedAt: (r.revoked_at as string | null) ?? null,
  }));
}

export async function listInvites(supabase: SupabaseClient, familyId: string): Promise<InviteItem[]> {
  const { data, error } = await supabase
    .from("family_invites")
    .select("id, invited_email, display_name, role, expires_at, accepted_at, revoked_at, created_at")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw Object.assign(new Error("invites"), { code: error.code });
  return ((data ?? []) as Row[]).map((r) => ({
    id: String(r.id),
    email: String(r.invited_email),
    displayName: String(r.display_name),
    role: r.role as FamilyRole,
    expiresAt: String(r.expires_at),
    acceptedAt: (r.accepted_at as string | null) ?? null,
    revokedAt: (r.revoked_at as string | null) ?? null,
    createdAt: String(r.created_at),
  }));
}

export type InviteState = "pending" | "accepted" | "revoked" | "expired";
export function inviteState(i: Pick<InviteItem, "acceptedAt" | "revokedAt" | "expiresAt">, now: Date = new Date()): InviteState {
  if (i.acceptedAt) return "accepted";
  if (i.revokedAt) return "revoked";
  if (Date.parse(i.expiresAt) <= now.getTime()) return "expired";
  return "pending";
}

// ------------------------------------------------------------------------------ Birthday Book
export interface BookEntrySnapshot {
  kind: "letter" | "photo" | "story";
  heading: string | null;
  body: string | null;
  mediaId: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
  credit: string | null;
}

export interface BookSnapshot {
  bookId: string;
  version: number;
  publishedAt: string;
  title: string;
  dedication: string | null;
  chapters: { title: string; entries: BookEntrySnapshot[] }[];
}

export async function getPublishedBook(supabase: SupabaseClient, familyId: string): Promise<BookSnapshot | null> {
  const { data: book } = await supabase.from("family_books").select("id, published_version").eq("family_id", familyId).maybeSingle();
  if (!book || !book.published_version) return null;
  const { data: snap, error } = await supabase
    .from("book_snapshots")
    .select("version, content, published_at")
    .eq("book_id", book.id)
    .eq("version", book.published_version)
    .maybeSingle();
  if (error || !snap) return null;
  const content = snap.content as { title: string; dedication: string | null; chapters: BookSnapshot["chapters"] };
  return { bookId: String(book.id), version: Number(snap.version), publishedAt: String(snap.published_at), title: content.title, dedication: content.dedication, chapters: content.chapters ?? [] };
}

export interface DraftEntry {
  id: string;
  kind: "letter" | "photo" | "story";
  heading: string | null;
  body: string | null;
  mediaId: string | null;
  credit: string | null;
  position: number;
}

export interface DraftBook {
  id: string;
  title: string;
  dedication: string | null;
  publishedVersion: number;
  updatedAt: string;
  chapters: { id: string; title: string; position: number; entries: DraftEntry[] }[];
}

export async function getDraftBook(supabase: SupabaseClient, familyId: string): Promise<DraftBook | null> {
  const { data: book } = await supabase.from("family_books").select("id, title, dedication, published_version, updated_at").eq("family_id", familyId).maybeSingle();
  if (!book) return null;
  const { data: chapters, error } = await supabase
    .from("book_chapters")
    .select("id, title, position, book_entries(id, kind, heading, body, media_id, contributor_credit, position)")
    .eq("book_id", book.id)
    .order("position", { ascending: true });
  if (error) throw Object.assign(new Error("book"), { code: error.code });
  return {
    id: String(book.id),
    title: String(book.title),
    dedication: (book.dedication as string | null) ?? null,
    publishedVersion: Number(book.published_version),
    updatedAt: String(book.updated_at),
    chapters: ((chapters ?? []) as Row[]).map((c) => ({
      id: String(c.id),
      title: String(c.title),
      position: Number(c.position),
      entries: ((c.book_entries as Row[] | null) ?? [])
        .map((e) => ({
          id: String(e.id),
          kind: e.kind as DraftEntry["kind"],
          heading: (e.heading as string | null) ?? null,
          body: (e.body as string | null) ?? null,
          mediaId: (e.media_id as string | null) ?? null,
          credit: (e.contributor_credit as string | null) ?? null,
          position: Number(e.position),
        }))
        .sort((a, b) => a.position - b.position),
    })),
  };
}

export async function getBookProgress(supabase: SupabaseClient, bookId: string, userId: string): Promise<number | null> {
  const { data } = await supabase.from("book_progress").select("chapter_index").eq("book_id", bookId).eq("user_id", userId).maybeSingle();
  return data ? Number(data.chapter_index) : null;
}

/** Ready photographs a curator can place in the book. */
export async function listBookablePhotos(supabase: SupabaseClient, familyId: string): Promise<MediaRef[]> {
  const { data } = await supabase
    .from("family_media")
    .select("id, alt_text, width, height, processing_status, consent_status")
    .eq("family_id", familyId)
    .eq("kind", "image")
    .eq("processing_status", "ready")
    .neq("consent_status", "withdrawn")
    .order("created_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as Row[]).map((m) => ({
    id: String(m.id),
    altText: String(m.alt_text ?? ""),
    width: (m.width as number | null) ?? null,
    height: (m.height as number | null) ?? null,
    status: String(m.processing_status),
    consent: String(m.consent_status),
  }));
}
