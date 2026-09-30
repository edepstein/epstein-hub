import type { Metadata } from "next";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <div className="hero">
        <div>
          <div className="eyebrow">Make it comfortable</div>
          <h1>Settings</h1>
          <p>Preferences change how Word Club looks and moves. They never change answers, rules or difficulty.</p>
        </div>
      </div>
      <SettingsForm />
    </>
  );
}
