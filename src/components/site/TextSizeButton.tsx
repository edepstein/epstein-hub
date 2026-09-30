"use client";

import { useSettings } from "@/components/settings/SettingsProvider";

const ORDER = ["100", "115", "130", "150"] as const;

export function TextSizeButton() {
  const { settings, update } = useSettings();
  const i = ORDER.indexOf(settings.textScale);
  const nextScale = ORDER[(i + 1) % ORDER.length];
  return (
    <button
      type="button"
      className="text-button"
      aria-label={`Text size ${settings.textScale}%. Change to ${nextScale}%`}
      onClick={() => update({ textScale: nextScale })}
    >
      A+ <span className="sr-only">text size</span>
      <small aria-hidden="true" style={{ marginLeft: 4 }}>{settings.textScale}%</small>
    </button>
  );
}
