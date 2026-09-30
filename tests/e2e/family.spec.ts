import path from "node:path";
import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./helpers";

/**
 * Family space without Supabase configuration (the build environment has no credentials).
 * Verifies explicit setup-needed states, private headers, that public pages leak nothing, and the
 * client-side contribution form checks. Signed-in journeys need the owner's Supabase project;
 * their database rules are proven by tests/family/rls.test.ts against real Postgres.
 */

const FIXTURES = path.join(__dirname, "..", "family", "fixtures");
const TOKEN = "A".repeat(43);
const FAMILY_ID = "00000000-0000-4000-8000-000000000001";

// Strings that must never appear on public pages (fixture content, guessed personal wording).
const PRIVATE_STRINGS = ["Fictional demonstration family", "Demo recipient", "FICTIONAL PLACEHOLDER", "Happy birthday", "Mum", "/api/family/", "family-media", "Birthday Book"];

test("family pages show an explicit setup-needed state with private, noindex headers", async ({ page }) => {
  for (const url of ["/family", "/family/feed", "/family/book", "/family/contribute", "/family/manage", `/family/invite/${TOKEN}`, "/sign-in"]) {
    const res = await page.goto(url);
    expect(res?.status(), url).toBe(200);
    const headers = res!.headers();
    expect(headers["cache-control"], url).toContain("no-store");
    expect(headers["cache-control"], url).toContain("private");
    expect(headers["x-robots-tag"], url).toContain("noindex");
    await expect(page.locator('[data-state="setup-needed"]'), url).toBeVisible();
    await expect(page.getByRole("heading", { name: "Setup needed" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('meta[property^="og:"]')).toHaveCount(0);
    // No fake login, feed or upload success anywhere.
    await expect(page.locator(".post")).toHaveCount(0);
    await expect(page.getByText(/signed in as/i)).toHaveCount(0);
  }
  const invite = await page.goto(`/family/invite/${TOKEN}`);
  expect(invite!.headers()["referrer-policy"]).toBe("no-referrer");
});

test("an invalid invitation link explains itself without touching the server", async ({ page }) => {
  await page.goto("/family/invite/not-a-token");
  await expect(page.locator('[data-state="invite-invalid"]')).toContainText("not valid");
});

test("family and auth APIs answer 503 setup_needed with no-store", async ({ request }) => {
  const checks: [string, string][] = [
    ["GET", "/api/family/me"],
    ["GET", `/api/family/${FAMILY_ID}/posts`],
    ["GET", `/api/family/${FAMILY_ID}/media/${FAMILY_ID}`],
    ["POST", "/api/family/invites/accept"],
    ["POST", "/api/auth/sign-in"],
  ];
  for (const [method, url] of checks) {
    const res = await request.fetch(url, { method, data: method === "POST" ? {} : undefined, headers: { origin: "http://127.0.0.1" } });
    expect(res.status(), url).toBe(503);
    expect(res.headers()["cache-control"], url).toContain("no-store");
    expect((await res.json()).error.code, url).toBe("setup_needed");
  }
});

test("public pages contain no private family content", async ({ page }) => {
  for (const url of ["/", "/games", "/library", "/archive"]) {
    const res = await page.goto(url);
    const html = await res!.text();
    for (const s of PRIVATE_STRINGS) expect(html, `${url} contains ${s}`).not.toContain(s);
    // Linking to the family space is fine; previews of it are not.
    await expect(page.locator('img[src*="/api/family/"]')).toHaveCount(0);
  }
});

test("contribution form checks files and fields in the browser and never pretends to save", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __revoked: string[]; __created: string[] };
    w.__revoked = [];
    w.__created = [];
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (o: Blob | MediaSource) => {
      const u = create(o);
      w.__created.push(u);
      return u;
    };
    URL.revokeObjectURL = (u: string) => {
      w.__revoked.push(u);
      revoke(u);
    };
  });
  const apiCalls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/family/")) apiCalls.push(r.url());
  });

  await page.goto("/family/contribute");
  const form = page.getByRole("form", { name: /Form preview/ });
  await expect(form).toBeVisible();

  // Nothing entered: caption or photo required, focus moves to the first problem.
  await form.getByRole("button", { name: "Submit for review" }).click();
  await expect(form.getByText("Add a caption or choose a photograph.")).toBeVisible();
  await expect(page.getByLabel("What is happening?")).toBeFocused();
  await expect(page.getByLabel("What is happening?")).toHaveAttribute("aria-invalid", "true");

  // A disguised non-image is refused by its bytes, not its name.
  await page.getByLabel(/Choose a photograph/).setInputFiles({ name: "holiday.jpg", mimeType: "image/jpeg", buffer: Buffer.from("#!/bin/sh\necho not a photo\n") });
  await expect(form.getByText("Only JPEG, PNG and WebP photographs can be added.")).toBeVisible();
  await expect(form.locator(".upload-preview img")).toHaveCount(0);

  // HEIC gets a specific, useful message.
  const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.alloc(20)]);
  await page.getByLabel(/Choose a photograph/).setInputFiles({ name: "IMG_0001.HEIC", mimeType: "image/heic", buffer: heic });
  await expect(form.getByText(/save or share it as a JPEG/)).toBeVisible();

  // A real PNG previews locally.
  await page.getByLabel(/Choose a photograph/).setInputFiles(path.join(FIXTURES, "tiny.png"));
  const preview = form.locator(".upload-preview img");
  await expect(preview).toBeVisible();
  const firstUrl = await preview.getAttribute("src");
  expect(firstUrl).toMatch(/^blob:/);

  // Choosing another photo revokes the previous preview URL.
  await page.getByLabel(/Choose a photograph/).setInputFiles(path.join(FIXTURES, "tiny.jpg"));
  await expect(preview).not.toHaveAttribute("src", firstUrl!);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __revoked: string[] }).__revoked)).toContain(firstUrl);

  // With a photo, description, permission and confirmation are required; text is kept.
  await page.getByLabel("What is happening?").fill("Tea in the garden");
  await form.getByRole("button", { name: "Submit for review" }).click();
  await expect(form.getByText("Describe the photograph for people who cannot see it.")).toBeVisible();
  await expect(form.getByText(/at least 10 characters/)).toBeVisible();
  await expect(form.getByText(/Confirm that everyone pictured/)).toBeVisible();
  await expect(page.getByLabel("What is happening?")).toHaveValue("Tea in the garden");
  await expect(page.getByLabel("Describe the photograph")).toBeFocused();

  // Keyboard-only completion of the remaining fields.
  await page.keyboard.type("A teapot on a garden table");
  await page.getByLabel("How do you have permission to share it?").fill("I took it; nobody else is in the picture.");
  await page.getByLabel(/Everyone pictured is happy/).focus();
  await page.keyboard.press("Space");
  await form.getByRole("button", { name: "Submit for review" }).click();
  await expect(form.getByRole("status")).toContainText("Saving is switched off");
  await expect(form.getByRole("status")).toContainText("Nothing was uploaded");
  await expect(page.getByLabel("What is happening?")).toHaveValue("Tea in the garden");
  expect(apiCalls).toEqual([]);
});

test("@mobile family pages and the form preview fit a 390px screen", async ({ page }) => {
  for (const url of ["/family", "/family/contribute", "/sign-in", `/family/invite/${TOKEN}`]) {
    await page.goto(url);
    await expectNoHorizontalOverflow(page);
  }
  await page.goto("/family/contribute");
  await page.getByLabel(/Choose a photograph/).setInputFiles(path.join(FIXTURES, "tiny.png"));
  await expect(page.locator(".upload-preview img")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
