import type { Metadata } from "next";
import { LibraryView } from "./LibraryView";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage() {
  return (
    <>
      <div className="hero">
        <div>
          <div className="eyebrow">Your collection</div>
          <h1>Library</h1>
          <p>Puzzles you have started or finished on this device. Nothing here is shared, and family content never appears in it.</p>
        </div>
        <span className="badge">Saved on this device</span>
      </div>
      <LibraryView />
    </>
  );
}
