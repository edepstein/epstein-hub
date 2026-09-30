import Link from "next/link";
import { SetupNeeded, Unavailable } from "@/components/family/FamilyStates";
import { FamilyHero } from "@/components/family/gate";
import { SignInForm } from "@/components/family/SignInForm";
import { SignOutButton } from "@/components/family/SignOutButton";
import { safeNextPath } from "@/lib/auth/redirect";
import { getSignedInUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  const hero = <FamilyHero eyebrow="Family space" title="Sign in" intro="The family space is private. Sign in with the email address your invitation was sent to." />;
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
  if (u.kind === "user") {
    return (
      <>
        {hero}
        <section className="family-panel family-state" data-state="signed-in">
          <h2>You are signed in</h2>
          <p>Signed in as {u.user.email}.</p>
          <div className="toolbar">
            <Link className="btn" href={next}>
              Continue
            </Link>
            <SignOutButton />
          </div>
        </section>
      </>
    );
  }
  return (
    <>
      {hero}
      <SignInForm next={next} linkError={sp.error === "link"} />
    </>
  );
}
