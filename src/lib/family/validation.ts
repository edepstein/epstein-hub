import { z } from "zod";
import { INVITE_DEFAULT_DAYS, INVITE_MAX_DAYS } from "./tokens";

/** Input schemas for the family API. Unknown keys are rejected (privileged records). */

const trimmed = (max: number, label: string) =>
  z
    .string({ error: `${label} is required.` })
    .transform((s) => s.trim())
    .pipe(z.string().max(max, `${label} must be ${max} characters or fewer.`));

const required = (min: number, max: number, label: string, minMessage?: string) =>
  z
    .string({ error: `${label} is required.` })
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(min, minMessage ?? (min <= 1 ? `${label} is required.` : `${label} needs at least ${min} characters.`))
        .max(max, `${label} must be ${max} characters or fewer.`),
    );

export const emailSchema = z
  .string({ error: "Enter an email address." })
  .transform((s) => s.trim().toLowerCase())
  .pipe(z.email("Enter a valid email address, like name@example.com.").max(254));

export const uuidSchema = z.uuid("Not a valid identifier.");

export const createPostSchema = z
  .strictObject({
    caption: trimmed(500, "Caption"),
    mediaIds: z.array(uuidSchema).max(4, "Up to four photographs per update.").default([]),
    submit: z.boolean().default(false),
    clientRequestId: uuidSchema.optional(),
  })
  .refine((v) => v.caption.length > 0 || v.mediaIds.length > 0, { message: "Add a caption or a photograph.", path: ["caption"] });

export const postActionSchema = z.strictObject({
  action: z.enum(["update", "submit", "unsubmit", "delete", "approve", "withdraw"]),
  caption: trimmed(500, "Caption").optional(),
  version: z.number().int().positive(),
});

export const uploadFieldsSchema = z.strictObject({
  altText: required(1, 300, "A description of the photograph", "Describe the photograph for people who cannot see it."),
  permissionBasis: required(10, 500, "Permission", "Say how you have permission to share this (at least 10 characters)."),
  peopleConfirmed: z.literal("true", { error: "Confirm that everyone pictured is happy for the family to see this." }),
  downloadAllowed: z.enum(["true", "false"]).default("false"),
  restrictions: trimmed(500, "Restrictions").optional(),
  clientRequestId: uuidSchema.optional(),
});

export const replySchema = z.strictObject({
  body: required(1, 1000, "Reply", "Write a reply first."),
});

export const inviteSchema = z.strictObject({
  email: emailSchema,
  displayName: required(1, 80, "Name", "Enter the name the family knows them by."),
  role: z.enum(["viewer", "contributor", "curator"], { error: "Choose a role." }),
  expiresInDays: z.number().int().min(1).max(INVITE_MAX_DAYS).default(INVITE_DEFAULT_DAYS),
});

export const acceptInviteSchema = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/, "This invitation link is not valid."),
});

export const memberUpdateSchema = z
  .strictObject({
    role: z.enum(["viewer", "contributor", "curator"]).optional(),
    status: z.enum(["active", "revoked"]).optional(),
    displayName: required(1, 80, "Name").optional(),
  })
  .refine((v) => v.role || v.status || v.displayName, { message: "Nothing to change." });

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker (YYYY-MM-DD).")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "That date does not exist.");

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const familySettingsSchema = z
  .strictObject({
    title: required(1, 120, "Family space title").optional(),
    recipientName: z.union([required(1, 80, "Name"), z.literal(null)]).optional(),
    birthdayDate: z.union([isoDate, z.literal(null)]).optional(),
    timezone: z.string().refine(isValidTimeZone, "Choose a valid time zone.").optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to change." });

export const bookSchema = z.strictObject({
  title: required(1, 120, "Book title"),
  dedication: z.union([trimmed(2000, "Dedication"), z.literal(null)]).optional(),
});

export const chapterCreateSchema = z.strictObject({ title: required(1, 120, "Chapter title") });
export const chapterPatchSchema = z
  .strictObject({ title: required(1, 120, "Chapter title").optional(), move: z.enum(["up", "down"]).optional() })
  .refine((v) => v.title || v.move, { message: "Nothing to change." });

export const entryCreateSchema = z
  .strictObject({
    chapterId: uuidSchema,
    kind: z.enum(["letter", "photo", "story"]),
    heading: trimmed(160, "Heading").optional(),
    body: trimmed(5000, "Text").optional(),
    mediaId: uuidSchema.optional(),
    credit: trimmed(120, "Credit").optional(),
  })
  .refine((v) => (v.kind === "photo" ? !!v.mediaId : !!v.body && v.body.length > 0), {
    message: "A photo entry needs a photograph; letters and stories need text.",
    path: ["body"],
  });

export const entryPatchSchema = z
  .strictObject({
    heading: trimmed(160, "Heading").optional(),
    body: trimmed(5000, "Text").optional(),
    credit: trimmed(120, "Credit").optional(),
    move: z.enum(["up", "down"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to change." });

export const progressSchema = z.strictObject({ chapterIndex: z.number().int().min(0).max(500) });

export const signInSchema = z.strictObject({ email: emailSchema, next: z.string().max(300).optional() });
export const verifyCodeSchema = z.strictObject({
  email: emailSchema,
  code: z
    .string()
    .transform((s) => s.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^\d{6,10}$/, "Enter the code from the email (digits only).")),
  next: z.string().max(300).optional(),
});

/** Flatten zod issues to { field: message } for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "form";
    out[key] ??= issue.message;
  }
  return out;
}
