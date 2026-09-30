import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

export default function Page() {
  return (
    <>
      <div className="hero">
        <div>
          <h1>Terms</h1>
        </div>
      </div>
      <div className="prose" dangerouslySetInnerHTML={{ __html: '<p>Word Club is a private, non-commercial project. The puzzles are original and provided for enjoyment. Please do not republish them without permission.</p><p>Family content belongs to the people who shared it and is visible only to invited family members.</p>' }} />
    </>
  );
}
