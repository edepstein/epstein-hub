import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/components/family/family.css";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false, nocache: true },
};

export default function SignInLayout({ children }: { children: ReactNode }) {
  return (
    <div data-game="family" className="family-root">
      {children}
    </div>
  );
}
