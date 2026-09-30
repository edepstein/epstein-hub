import Link from "next/link";
import { FamilyShell } from "@/components/family/FamilyShell";
import { FeedPost } from "@/components/family/FeedList";
import { FamilyHero, nonMemberState } from "@/components/family/gate";
import { getFamilyContext } from "@/lib/auth/session";
import { can } from "@/lib/family/authz";
import { birthdayGreeting } from "@/lib/family/birthday";
import { getLatestPost, getPublishedBook } from "@/lib/family/repo";

export const dynamic = "force-dynamic";

/**
 * Family home. Signed-out visitors and non-members see only "invitation required" (or setup
 * needed); members see the latest published update and ways into the Window and the Book.
 */
export default async function FamilyHome() {
  const ctx = await getFamilyContext();
  const gate = nonMemberState(ctx, "/family");
  if (gate || ctx.kind !== "member") {
    return (
      <>
        <FamilyHero eyebrow="Family space · invitation required" title="A private place for the family" intro="Photographs, messages and a birthday book, shared only with invited family members." />
        {gate}
      </>
    );
  }
  const { supabase, family, membership } = ctx;
  const [latest, book] = await Promise.all([getLatestPost(supabase, family.id), getPublishedBook(supabase, family.id)]);
  const greeting = birthdayGreeting(family);
  return (
    <>
      <FamilyHero eyebrow={greeting ? "Made with love" : "Your family space"} title={greeting ?? family.title} intro={greeting ? family.title : "A quiet place for family photographs and messages. No followers, rankings or public posts."} />
      <FamilyShell ctx={ctx} current="home">
        <h2 className="section-title">Latest from the family</h2>
        {latest ? (
          <div className="family-feed">
            <FeedPost post={latest} familyId={family.id} userId={ctx.user.id} isCurator={membership.role === "curator"} timeZone={family.timezone} />
            <p>
              <Link className="text-link" href="/family/feed">
                See all updates in the Family Window
              </Link>
            </p>
          </div>
        ) : (
          <div className="family-panel" data-state="empty">
            <h2>Family updates will appear here</h2>
            <p>When the family shares a photograph or a few words, you will find it here.</p>
            {can(membership, "contribute") ? (
              <Link className="btn" href="/family/contribute">
                Add the first update
              </Link>
            ) : null}
          </div>
        )}
        <h2 className="section-title">Something to enjoy</h2>
        <div className="cards">
          <Link className="card" href="/family/feed">
            <span className="icon" aria-hidden="true">
              ♡
            </span>
            <h2>Family Window</h2>
            <p>Photographs and short updates, newest first.</p>
          </Link>
          <Link className="card" href="/family/book">
            <span className="icon" aria-hidden="true">
              ✉
            </span>
            <h2>Birthday Book</h2>
            <p>{book ? `${book.chapters.length} ${book.chapters.length === 1 ? "chapter" : "chapters"} of messages and memories.` : "Being prepared by the family."}</p>
          </Link>
          <Link className="card" href="/">
            <span className="icon" aria-hidden="true">
              W
            </span>
            <h2>Today&apos;s puzzles</h2>
            <p>The Word Club puzzles, whenever you fancy one.</p>
          </Link>
        </div>
      </FamilyShell>
    </>
  );
}
