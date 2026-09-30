"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_SETTINGS, SETTINGS_KEY, parseSettings, type Settings } from "@/lib/settings";
import { readJson, writeJson } from "@/lib/progress/storage";

interface Ctx {
  settings: Settings;
  update(patch: Partial<Settings>): void;
  reset(): void;
  saved: boolean;
}

const SettingsContext = createContext<Ctx>({ settings: DEFAULT_SETTINGS, update() {}, reset() {}, saved: false });

function applyToDocument(s: Settings) {
  const d = document.documentElement;
  d.dataset.textScale = s.textScale;
  if (s.motion === "system") delete d.dataset.motion;
  else d.dataset.motion = s.motion;
  if (s.contrast === "more") d.dataset.contrast = "more";
  else delete d.dataset.contrast;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const r = readJson(SETTINGS_KEY);
    const s = r.status === "ok" ? parseSettings(r.value) : DEFAULT_SETTINGS;
    setSettings(s);
    applyToDocument(s);
  }, []);

  const persist = useCallback((s: Settings) => {
    applyToDocument(s);
    try {
      writeJson(SETTINGS_KEY, s);
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, []);

  const update = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    persist(DEFAULT_SETTINGS);
  }, [persist]);

  return <SettingsContext.Provider value={{ settings, update, reset, saved }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
