import { z } from "zod";

export const SETTINGS_KEY = "wc:v1:settings";

export const settingsSchema = z.object({
  textScale: z.enum(["100", "115", "130", "150"]).default("100"),
  motion: z.enum(["system", "reduce", "full"]).default("system"),
  contrast: z.enum(["normal", "more"]).default("normal"),
  sound: z.boolean().default(false),
  showStreaks: z.boolean().default(false),
});
export type Settings = z.infer<typeof settingsSchema>;
export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

export function parseSettings(raw: unknown): Settings {
  const r = settingsSchema.safeParse(raw);
  return r.success ? r.data : DEFAULT_SETTINGS;
}

/** Inline, pre-hydration script so preferences apply before first paint. */
export const SETTINGS_BOOT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)})||"{}");var d=document.documentElement;if(s.textScale)d.dataset.textScale=s.textScale;if(s.motion&&s.motion!=="system")d.dataset.motion=s.motion;if(s.contrast==="more")d.dataset.contrast="more";}catch(e){}})();`;
