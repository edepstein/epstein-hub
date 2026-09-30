import type { Metadata } from "next";
import Link from "next/link";
import { BookReader } from "@/components/family/BookReader";
import { FamilyShell } from "@/components/family/FamilyShell";
import { FamilyHero, nonMemberState } from "@/components/family/gate";
import { getFamilyContext } from "@/lib/auth/session";
import { can } from "@/lib/family/authz";
import { getBookProgress, getPublishedBook } from "@/lib/family/repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Birthday Book" };

export default async function BookPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getFamilyContext();
  const hero = <FamilyHero eyebrow="A keepsake to return to" title="Birthday Book" intro="Messages, memories and photographs collected by the family." />;
  const gate = nonMemberState(ctx, "/family/book");
  if (gate || ctx.kind !== "member") {
    return (
      <>
        {hero}
        {gate}
      </>
    );
  }
  const book = await getPublishedBook(ctx.supabase, ctx.family.id);
  const sp = await searchParams;
  let initial: number | null = null;
  const fromUrl = Number(Array.isArray(sp.chapter) ? sp.chapter[0] : sp.chapter);
  if (book) {
    if (Number.isInteger(fromUrl) && fromUrl >= 1 && fromUrl <= book.chapters.length) initial = fromUrl - 1;
    else initial = await getBookProgress(ctx.supabase, book.bookId, ctx.user.id);
  }
  return (
    <>
      {hero}
      <FamilyShell ctx={ctx} current="book">
        {book && book.chapters.length ? (
          <BookReader familyId={ctx.family.id} book={book} initialChapter={initial} />
        ) : (
          <div className="family-panel" data-state="empty">
            <h2>The Birthday Book is being prepared</h2>
            <p>The family is putting it together. It will appear here once it is ready.</p>
            {can(ctx.membership, "compose_book") ? (
              <Link className="btn" href="/family/manage#book">
                Arrange the book
              </Link>
            ) : null}
          </div>
        )}
      </FamilyShell>
    </>
  );
}
