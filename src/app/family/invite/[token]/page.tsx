import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInvite } from "@/components/family/AcceptInvite";
import { SetupNeeded, Unavailable } from "@/components/family/FamilyStates";
import { FamilyHero } from "@/components/family/gate";
import { getSignedInUser } from "@/lib/auth/session";
import { isPlausibleInviteToken } from "@/lib/family/tokens";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Family invitation", referrer: "no-referrer" };

/**
 * Invitation landing. Shows nothing about the family before acceptance (anyone holding the link
 * could be reading it). Acceptance requires signing in with the invited email address.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const hero = <FamilyHero eyebrow="Family space" title="Your invitation" />;
  if (!isPlausibleInviteToken(token)) {
    return (
      <>
        {hero}
        <section className="family-panel family-state" data-state="invite-invalid">
          <h2>This invitation link is not valid</h2>
          <p>Check that you copied the whole link from the message, or ask the family curator to send a new invitation.</p>
        </section>
      </>
    );
  }
  const u = await getSignedInUser();
  if (u.kind === "setup-needed") {
    return (
      <>
        {hero}
        <SetupNeeded />
      </>
    );
  }
  if (u.kind === "unavailable") {
    return (
      <>
        {hero}
        <Unavailable />
      </>
    );
  }
  if (u.kind === "signed-out") {
    const next = `/family/invite/${token}`;
    return (
      <>
        {hero}
        <section className="family-panel family-state" data-state="invite-signed-out">
          <h2>Sign in to accept</h2>
          <p>To accept, sign in with the email address the invitation was sent to. We will email you a sign-in link and code; there is no password.</p>
          <div className="toolbar">
            <Link className="btn" href={`/sign-in?next=${encodeURIComponent(next)}`}>
              Sign in to accept
            </Link>
          </div>
        </section>
      </>
    );
  }
  return (
    <>
      {hero}
      <AcceptInvite token={token} email={u.user.email ?? null} />
    </>
  );
}
