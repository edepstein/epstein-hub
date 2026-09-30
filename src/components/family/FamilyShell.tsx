import Link from "next/link";
import type { ReactNode } from "react";
import type { FamilyContext } from "@/lib/auth/session";
import { can, ROLE_LABELS } from "@/lib/family/authz";
import { SignOutButton } from "./SignOutButton";

type Member = Extract<FamilyContext, { kind: "member" }>;
export type FamilySection = "home" | "feed" | "book" | "contribute" | "manage";

/** Navigation and account line for signed-in members (role decides which entries appear). */
export function FamilyShell({ ctx, current, children }: { ctx: Member; current: FamilySection; children: ReactNode }) {
  const items: { key: FamilySection; href: string; label: string; show: boolean }[] = [
    { key: "home", href: "/family", label: "Family home", show: true },
    { key: "feed", href: "/family/feed", label: "Family Window", show: true },
    { key: "book", href: "/family/book", label: "Birthday Book", show: true },
    { key: "contribute", href: "/family/contribute", label: "Share a moment", show: can(ctx.membership, "contribute") },
    { key: "manage", href: "/family/manage", label: "Curate", show: can(ctx.membership, "moderate") },
  ];
  return (
    <>
      {ctx.family.isFictionalFixture ? (
        <p className="wc-banner" data-tone="warn" role="note">
          Development data: this family and everything in it is fictional test material, not a real family.
        </p>
      ) : null}
      <nav aria-label="Family space">
        <ul className="family-nav">
          {items
            .filter((i) => i.show)
            .map((i) => (
              <li key={i.key}>
                <Link href={i.href} aria-current={i.key === current ? "page" : undefined}>
                  {i.label}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
      <p className="family-account">
        <span>
          Signed in as {ctx.membership.displayName} ({ROLE_LABELS[ctx.membership.role]})
        </span>
        <SignOutButton />
      </p>
      {children}
    </>
  );
}
