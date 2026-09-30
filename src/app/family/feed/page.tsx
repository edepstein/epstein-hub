import type { Metadata } from "next";
import Link from "next/link";
import { FamilyShell } from "@/components/family/FamilyShell";
import { FeedList } from "@/components/family/FeedList";
import { FamilyHero, nonMemberState } from "@/components/family/gate";
import { getFamilyContext } from "@/lib/auth/session";
import { can } from "@/lib/family/authz";
import { listFeed } from "@/lib/family/repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Family Window" };

export default async function FeedPage() {
  const ctx = await getFamilyContext();
  const hero = <FamilyHero eyebrow="The everyday moments matter" title="Family Window" intro="A quiet place to stay close. No followers, rankings or public posts." />;
  const gate = nonMemberState(ctx, "/family/feed");
  if (gate || ctx.kind !== "member") {
    return (
      <>
        {hero}
        {gate}
      </>
    );
  }
  const { posts, nextCursor } = await listFeed(ctx.supabase, ctx.family.id, { limit: 10 });
  return (
    <>
      {hero}
      <FamilyShell ctx={ctx} current="feed">
        {can(ctx.membership, "contribute") ? (
          <div className="toolbar">
            <Link className="btn" href="/family/contribute">
              Share a moment
            </Link>
          </div>
        ) : null}
        {posts.length ? (
          <FeedList
            familyId={ctx.family.id}
            userId={ctx.user.id}
            isCurator={ctx.membership.role === "curator"}
            timeZone={ctx.family.timezone}
            initialPosts={posts}
            initialCursor={nextCursor}
          />
        ) : (
          <div className="family-panel" data-state="empty">
            <h2>Family updates will appear here</h2>
            <p>Nothing has been shared yet. The Birthday Book is always here to browse.</p>
            <Link className="btn secondary" href="/family/book">
              Open the Birthday Book
            </Link>
          </div>
        )}
      </FamilyShell>
    </>
  );
}
