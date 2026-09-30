import type { Metadata } from "next";
import { ContributeForm } from "@/components/family/ContributeForm";
import { FamilyShell } from "@/components/family/FamilyShell";
import { PermissionDenied } from "@/components/family/FamilyStates";
import { FamilyHero, nonMemberState } from "@/components/family/gate";
import { PostActions } from "@/components/family/PostActions";
import { PrivatePhoto } from "@/components/family/PrivatePhoto";
import { getFamilyContext } from "@/lib/auth/session";
import { allowedPostActions, can, POST_STATUS_LABELS } from "@/lib/family/authz";
import { listMyPosts } from "@/lib/family/repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Share a moment" };

export default async function ContributePage() {
  const ctx = await getFamilyContext();
  const hero = <FamilyHero eyebrow="For invited family members" title="Share a small moment" intro="A photograph and a few words can make someone's day. Please check that everyone pictured is happy to be shared." />;
  const gate = nonMemberState(ctx, "/family/contribute");
  if (gate || ctx.kind !== "member") {
    return (
      <>
        {hero}
        {gate}
        {ctx.kind === "setup-needed" ? (
          <>
            <p className="form-hint">This is how the contribution form will work once the family space is set up. Saving is switched off; nothing leaves this device.</p>
            <ContributeForm familyId={null} previewOnly />
          </>
        ) : null}
      </>
    );
  }
  if (!can(ctx.membership, "contribute")) {
    return (
      <>
        {hero}
        <FamilyShell ctx={ctx} current="contribute">
          <PermissionDenied what="Readers can enjoy everything, favourite updates and reply. Adding photographs is for contributors; ask the family curator if you would like to contribute." />
        </FamilyShell>
      </>
    );
  }
  const mine = await listMyPosts(ctx.supabase, ctx.family.id, ctx.user.id);
  return (
    <>
      {hero}
      <FamilyShell ctx={ctx} current="contribute">
        <ContributeForm familyId={ctx.family.id} />
        <section className="family-panel" aria-labelledby="mine-title">
          <h2 id="mine-title">Your contributions</h2>
          {mine.length ? (
            mine.map((p) => (
              <article key={p.id} className="post" data-post-id={p.id}>
                <p>
                  <span className="status-pill" data-status={p.status}>
                    {POST_STATUS_LABELS[p.status]}
                  </span>
                </p>
                {p.media.map((m) => (
                  <PrivatePhoto key={m.id} familyId={ctx.family.id} mediaId={m.id} alt={m.altText} width={m.width} height={m.height} />
                ))}
                {p.caption ? <p className="family-caption">{p.caption}</p> : null}
                <PostActions
                  familyId={ctx.family.id}
                  postId={p.id}
                  version={p.version}
                  actions={allowedPostActions(ctx.membership, { status: p.status, isAuthor: true }).filter((a): a is "submit" | "unsubmit" | "delete" => a === "submit" || a === "unsubmit" || a === "delete")}
                />
              </article>
            ))
          ) : (
            <p className="form-hint">Nothing yet. Drafts you save and updates you submit appear here with their review status.</p>
          )}
        </section>
      </FamilyShell>
    </>
  );
}
