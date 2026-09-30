import type { Metadata } from "next";
import { BookEditor } from "@/components/family/BookEditor";
import { FamilyShell } from "@/components/family/FamilyShell";
import { PermissionDenied } from "@/components/family/FamilyStates";
import { FamilyHero, nonMemberState } from "@/components/family/gate";
import { FamilySettingsForm, InviteManager, MemberManager } from "@/components/family/ManagePanels";
import { PostActions } from "@/components/family/PostActions";
import { PrivatePhoto } from "@/components/family/PrivatePhoto";
import { getFamilyContext } from "@/lib/auth/session";
import { allowedPostActions, can } from "@/lib/family/authz";
import { getDraftBook, inviteState, listBookablePhotos, listForModeration, listInvites, listMembers, type PostItem } from "@/lib/family/repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Curate" };

function Queue({ title, posts, familyId, membership, empty }: { title: string; posts: PostItem[]; familyId: string; membership: { role: "viewer" | "contributor" | "curator"; status: "active" | "revoked" }; empty: string }) {
  return (
    <section className="family-panel" aria-label={title}>
      <h2>{title}</h2>
      {posts.length ? (
        posts.map((p) => (
          <article key={p.id} className="post" data-post-id={p.id}>
            <div className="post-header">
              <span className="avatar" aria-hidden="true">
                {p.authorName.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>{p.authorName}</strong>
                <small>{new Date(p.submittedAt ?? p.createdAt).toLocaleString("en-GB")}</small>
              </div>
            </div>
            {p.media.map((m) => (
              <div key={m.id}>
                <PrivatePhoto familyId={familyId} mediaId={m.id} alt={m.altText} width={m.width} height={m.height} />
                <p className="form-hint">Description: {m.altText}</p>
              </div>
            ))}
            {p.caption ? <p className="family-caption">{p.caption}</p> : null}
            <PostActions
              familyId={familyId}
              postId={p.id}
              version={p.version}
              actions={allowedPostActions(membership, { status: p.status, isAuthor: false }).filter((a): a is "approve" | "withdraw" => a === "approve" || a === "withdraw")}
            />
          </article>
        ))
      ) : (
        <p className="form-hint">{empty}</p>
      )}
    </section>
  );
}

export default async function ManagePage() {
  const ctx = await getFamilyContext();
  const hero = <FamilyHero eyebrow="For the family curator" title="Curate the family space" intro="Review contributions, arrange the Birthday Book and look after invitations and members." />;
  const gate = nonMemberState(ctx, "/family/manage");
  if (gate || ctx.kind !== "member") {
    return (
      <>
        {hero}
        {gate}
      </>
    );
  }
  if (!can(ctx.membership, "moderate")) {
    return (
      <>
        {hero}
        <FamilyShell ctx={ctx} current="manage">
          <PermissionDenied what="Curating is for the family curator. You can still read, favourite and reply to everything." />
        </FamilyShell>
      </>
    );
  }
  const { supabase, family } = ctx;
  const [queues, invites, members, draft, photos] = await Promise.all([
    listForModeration(supabase, family.id),
    listInvites(supabase, family.id),
    listMembers(supabase, family.id),
    getDraftBook(supabase, family.id),
    listBookablePhotos(supabase, family.id),
  ]);
  return (
    <>
      {hero}
      <FamilyShell ctx={ctx} current="manage">
        <div className="manage-grid">
          <Queue title="Waiting for review" posts={queues.submitted} familyId={family.id} membership={ctx.membership} empty="Nothing is waiting for review." />
          <Queue title="Published" posts={queues.published} familyId={family.id} membership={ctx.membership} empty="Nothing has been published yet." />
          {queues.withdrawn.length ? <Queue title="Withdrawn" posts={queues.withdrawn} familyId={family.id} membership={ctx.membership} empty="" /> : null}
          <div id="book">
            <BookEditor familyId={family.id} book={draft} photos={photos} />
          </div>
          <InviteManager familyId={family.id} invites={invites.map((i) => ({ ...i, state: inviteState(i) }))} />
          <MemberManager familyId={family.id} members={members} selfId={ctx.user.id} />
          <FamilySettingsForm familyId={family.id} initial={{ title: family.title, recipientName: family.recipientName, birthdayDate: family.birthdayDate, timezone: family.timezone }} />
        </div>
      </FamilyShell>
    </>
  );
}
