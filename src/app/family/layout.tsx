import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/components/family/family.css";

// Private area: never indexed, never given private titles, descriptions or share images.
export const metadata: Metadata = {
  title: "Family space",
  description: "A private, invitation-only family space.",
  robots: { index: false, follow: false, nocache: true },
  openGraph: null,
  twitter: null,
};

export default function FamilyLayout({ children }: { children: ReactNode }) {
  return (
    <div data-game="family" className="family-root">
      {children}
    </div>
  );
}
