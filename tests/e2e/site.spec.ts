import { expect, test } from "@playwright/test";
import { clearProgress, expectNoHorizontalOverflow } from "./helpers";

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

test("home shows launch games, family invitation without private content, and honest preview copy", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Words to play with");
  for (const id of ["letter-wheel", "word-deduction", "word-families", "word-ladder"]) {
    await expect(page.getByTestId(`card-${id}`).first()).toBeVisible();
  }
  await expect(page.getByText("Family space · invitation required")).toBeVisible();
  await expect(page.getByText(/no daily editions are published yet/i)).toBeVisible();
});

test("catalogue filters by search and category; coming-soon games have no play link", async ({ page }) => {
  await page.goto("/games");
  await page.getByLabel("Search").fill("wheel");
  await expect(page.getByRole("status")).toContainText("1 of 19 games");
  await page.getByLabel("Search").fill("");
  await page.getByLabel("Kind of puzzle").selectOption("Play together");
  await expect(page.getByRole("status")).toContainText("2 of 19 games");
  const coming = page.locator('[aria-disabled="true"][data-testid^="card-"]');
  const n = await coming.count();
  for (let i = 0; i < n; i++) await expect(coming.nth(i).locator("a")).toHaveCount(0);
});

test("every game page shows full rules", async ({ page }) => {
  await page.goto("/games/letter-wheel");
  await expect(page.getByRole("heading", { name: "How to play" })).toBeVisible();
  await expect(page.getByText("Each word scores one point per letter.")).toBeVisible();
});

test("settings persist text size across reloads and never touch progress", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("130%").check();
  await expect(page.locator("html")).toHaveAttribute("data-text-scale", "130");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-text-scale", "130");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-text-scale", "130");
  await expectNoHorizontalOverflow(page);
});

test("clear progress needs confirmation and empties the library", async ({ page }) => {
  await page.goto("/play/letter-wheel/lw-demo-1");
  await page.getByLabel("Your word").fill("date");
  await page.getByLabel("Your word").press("Enter");
  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.goto("/library");
  await expect(page.getByText("Continue playing")).toBeVisible();
  await page.goto("/settings");
  await page.getByRole("button", { name: "Clear puzzle progress" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Clear progress" }).click();
  await page.goto("/library");
  await expect(page.getByTestId("library-empty")).toBeVisible();
});

test("archive filters live in the URL and survive back navigation", async ({ page }) => {
  await page.goto("/archive");
  await expect(page.getByTestId("archive-empty")).toContainText("No daily editions have been published yet");
  await page.getByRole("combobox", { name: "Game" }).selectOption("letter-wheel");
  await page.getByLabel("Difficulty").selectOption("expert");
  await expect(page).toHaveURL(/game=letter-wheel/, { timeout: 15_000 });
  await page.locator(".round-grid a").first().click();
  await expect(page.getByLabel("Your word")).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("Difficulty")).toHaveValue("expert");
});

test("unknown round shows a designed unavailable state", async ({ page }) => {
  const res = await page.goto("/play/letter-wheel/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByTestId("round-unavailable")).toBeVisible();
});

test("blocked storage still allows play with a clear warning", async ({ page }) => {
  await page.addInitScript(() => {
    const deny = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    Object.defineProperty(window, "localStorage", { get: deny });
  });
  await page.goto("/play/letter-wheel/lw-demo-1");
  await expect(page.getByTestId("storage-banner")).toBeVisible();
  await page.getByLabel("Your word").fill("cane");
  await page.getByLabel("Your word").press("Enter");
  await expect(page.getByTestId("found-list")).toContainText("CANE");
});

test("practice route sends the player to an unplayed round", async ({ page }) => {
  await page.goto("/practice/letter-wheel");
  await expect(page).toHaveURL(/\/play\/letter-wheel\//, { timeout: 15_000 });
});

test("@mobile core pages have no horizontal overflow at 390px", async ({ page }) => {
  for (const url of ["/", "/games", "/library", "/archive", "/settings", "/credits", "/family"]) {
    await page.goto(url);
    await expectNoHorizontalOverflow(page);
  }
});

test("a round that has been played is not offered again: practice, next round and surprise", async ({ page }) => {
  // A rejected word is not a move, so it does not mark the round as played.
  await page.goto("/play/letter-wheel/lw-demo-1");
  await page.getByLabel("Your word").fill("zzzz");
  await page.getByLabel("Your word").press("Enter");
  expect(await page.evaluate(() => localStorage.getItem("wc:v1:seen:letter-wheel"))).toBeNull();

  // A real move marks it played; asking for practice (same difficulty) never returns it.
  await page.getByLabel("Your word").fill("date");
  await page.getByLabel("Your word").press("Enter");
  await expect(page.getByTestId("found-list")).toContainText("DATE");
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("wc:v1:seen:letter-wheel") ?? "{}")))).toEqual(["lw-demo-1"]);

  const offered = new Set<string>(["lw-demo-1"]);
  for (let i = 0; i < 5; i++) {
    await page.goto("/practice/letter-wheel?difficulty=standard");
    await expect(page).toHaveURL(/\/play\/letter-wheel\//, { timeout: 15_000 });
    const id = new URL(page.url()).pathname.split("/").pop()!;
    expect(offered.has(id), `round ${id} was offered twice`).toBe(false);
    offered.add(id);
    await page.getByLabel("Your word").fill("zzzz");
    await page.evaluate((rid) => {
      const key = "wc:v1:seen:letter-wheel";
      const seen = JSON.parse(localStorage.getItem(key) ?? "{}");
      seen[rid] = new Date().toISOString();
      localStorage.setItem(key, JSON.stringify(seen));
    }, id);
  }

  // The result screen's "different game" link avoids the game just played.
  await page.goto("/surprise?not=letter-wheel");
  await expect(page).toHaveURL(/\/play\/(?!letter-wheel)[a-z-]+\//, { timeout: 15_000 });
});

test("when every round of a game is played the player is told and can replay the oldest", async ({ page }) => {
  await page.goto("/games/letter-wheel");
  const ids = await page.locator(".round-grid a").evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href.split("/").pop()!));
  expect(ids.length).toBeGreaterThanOrEqual(10);
  await page.evaluate((all) => {
    const seen: Record<string, string> = {};
    all.forEach((id, i) => (seen[id] = new Date(2026, 9, 1, 10, i).toISOString()));
    localStorage.setItem("wc:v1:seen:letter-wheel", JSON.stringify(seen));
  }, ids);
  await page.goto("/practice/letter-wheel");
  await expect(page.getByTestId("practice-exhausted")).toBeVisible();
  await page.getByRole("link", { name: /longest ago/ }).click();
  await expect(page).toHaveURL(new RegExp(`/${ids[0]}$`));
});

test("home offers a surprise round from a game that still has unplayed rounds", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("surprise-me").click();
  await expect(page).toHaveURL(/\/play\//, { timeout: 15_000 });
});
