import type { ReactNode } from "react";
import type { FamilyContext } from "@/lib/auth/session";
import { NoAccess, SetupNeeded, SignedOut, Unavailable } from "./FamilyStates";

/** The state to render for anyone who is not an active member, or null for members. */
export function nonMemberState(ctx: FamilyContext, next: string): ReactNode | null {
  switch (ctx.kind) {
    case "setup-needed":
      return <SetupNeeded />;
    case "unavailable":
      return <Unavailable />;
    case "signed-out":
      return <SignedOut next={next} />;
    case "no-access":
      return <NoAccess revoked={ctx.revoked} email={ctx.email} />;
    case "member":
      return null;
  }
}

export function FamilyHero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <div className="hero">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {intro ? <p>{intro}</p> : null}
      </div>
      <span className="badge private">Private · invitation only</span>
    </div>
  );
}
