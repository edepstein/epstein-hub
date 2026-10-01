import { expect, test } from "@playwright/test";
import { clearProgress, expectNoHorizontalOverflow, feedback } from "./helpers";
import data from "../../src/games/letter-wheel/content/rounds.json";

const ROUND = "/play/letter-wheel/lw-demo-1"; // pack "education" fixture: centre A
const TARGETS = ["EDUCATION", "ACTION", "AUCTION", "CAUTION", "DANCE", "DATE", "CANE", "CANED"];

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

test("home to round, invalid entry keeps input, valid word scores, refresh restores", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Start with Letter Wheel/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Letter Wheel" })).toBeVisible();
  await page.getByTestId("round-lw-demo-1").click();
  const input = page.getByLabel("Your word");
  await expect(input).toBeVisible();

  await input.fill("cat");
  await input.press("Enter");
  await expect(feedback(page)).toContainText("at least 4 letters");
  await expect(input).toHaveValue("CAT");

  await input.fill("duct");
  await input.press("Enter");
  await expect(feedback(page)).toContainText("centre letter A");

  await input.fill("action");
  await input.press("Enter");
  await expect(feedback(page)).toContainText("ACTION scores 6");
  await expect(input).toHaveValue("");
  await expect(page.getByTestId("found-list")).toContainText("ACTION");
  await expect(page.getByTestId("score")).toHaveText("6 points");

  await input.fill("action");
  await input.press("Enter");
  await expect(feedback(page)).toContainText("already found");
  await expect(page.getByTestId("score")).toHaveText("6 points");

  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.reload();
  await expect(page.getByTestId("restored-banner")).toBeVisible();
  await expect(page.getByTestId("found-list")).toContainText("ACTION");
  await expect(page.getByTestId("score")).toHaveText("6 points");
});

test("tap letters, take hints, reveal and complete the round", async ({ page }) => {
  await page.goto(ROUND);
  // Touch-style entry: tap D, A, T, E on the wheel.
  for (const l of ["D", "A", "T", "E"]) {
    await page.getByRole("button", { name: new RegExp(`^${l}(,|$)`) }).first().click();
  }
  await expect(page.getByLabel("Your word")).toHaveValue("DATE");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("found-list")).toContainText("DATE");

  await page.getByRole("button", { name: "Get a hint" }).click();
  const dialog = page.getByRole("dialog", { name: "A helpful nudge" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("listitem").filter({ has: page.getByText("Starting letter", { exact: true }) }).getByRole("button", { name: "Take hint" }).click();
  await expect(feedback(page)).toContainText("starts with");
  // Focus returns to the opener.
  await expect(page.getByRole("button", { name: "Get a hint" })).toBeFocused();

  await page.getByRole("button", { name: "Get a hint" }).click();
  await dialog.getByRole("listitem").filter({ has: page.getByText("Reveal a word", { exact: true }) }).getByRole("button", { name: "Reveal" }).click();
  await expect(feedback(page)).toContainText("scores 0");

  const input = page.getByLabel("Your word");
  for (const w of TARGETS) {
    const already = await page.getByTestId("found-list").textContent();
    if (already?.includes(w)) continue;
    await input.fill(w);
    await input.press("Enter");
  }
  const result = page.getByTestId("result-panel");
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("1 hint · 1 reveal");
  await expect(page.getByTestId("target-progress")).toHaveText("8 of 8 everyday words");
});

test("keyboard only: rules dialog, word entry, Escape clears", async ({ page }) => {
  await page.goto(ROUND);
  await page.getByRole("button", { name: "How to play" }).focus();
  await page.keyboard.press("Enter");
  const rules = page.getByRole("dialog", { name: /How to play Letter Wheel/ });
  await expect(rules).toBeVisible();
  await expect(rules).toContainText("nine-letter word");
  await page.keyboard.press("Escape");
  await expect(rules).toBeHidden();
  await expect(page.getByRole("button", { name: "How to play" })).toBeFocused();

  await page.getByLabel("Your word").focus();
  await page.keyboard.type("dance");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Your word")).toHaveValue("");
  await page.keyboard.type("dance");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("found-list")).toContainText("DANCE");
});

test("corrupt save is set aside with an explanation", async ({ page }) => {
  await page.goto(ROUND);
  await page.evaluate(() => localStorage.setItem("wc:v1:attempt:letter-wheel:lw-demo-1", "{broken"));
  await page.reload();
  await expect(page.getByTestId("corrupt-banner")).toBeVisible();
  const input = page.getByLabel("Your word");
  await input.fill("date");
  await input.press("Enter");
  await expect(page.getByTestId("found-list")).toContainText("DATE");
  const quarantined = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("wc:v1:corrupt:")).length);
  expect(quarantined).toBe(1);
});

test("finish early shows an honest partial result and library entry", async ({ page }) => {
  await page.goto("/play/letter-wheel/lw-g1");
  const input = page.getByLabel("Your word");
  await input.fill("yard");
  await input.press("Enter");
  await page.getByRole("button", { name: "Finish and see result" }).click();
  await expect(page.getByTestId("result-panel")).toContainText("You found 1 of 20 everyday words");
  await page.goto("/library");
  await expect(page.getByText("Gentle wheel 1")).toBeVisible();
});

test("master wheel loads with target wording, definition hint, and a full solve completes", async ({ page }) => {
  const master = (data.rounds as { id: string; payload: { targets: string[] } }[]).find((r) => r.id === "lw-m5")!; // DEFEATISM, centre F
  await page.goto("/play/letter-wheel/lw-m5");
  await expect(page.getByTestId("target-progress")).toHaveText(`0 of ${master.payload.targets.length} target words`);
  await page.getByRole("button", { name: "Get a hint" }).click();
  const dialog = page.getByRole("dialog", { name: "A helpful nudge" });
  await dialog.getByRole("listitem").filter({ has: page.getByText("Definition of a rarer word", { exact: true }) }).getByRole("button", { name: "Take hint" }).click();
  await expect(feedback(page)).toContainText("means:");
  const input = page.getByLabel("Your word");
  await input.fill("fade");
  await input.press("Enter");
  await expect(page.getByTestId("found-list")).toContainText("FADE");
  for (const w of master.payload.targets) {
    await input.fill(w);
    await input.press("Enter");
  }
  const result = page.getByTestId("result-panel");
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("Every target word found");
  await expect(result).toContainText("1 hint");
});

test("@mobile wheel fits a phone screen and plays", async ({ page }) => {
  await page.goto(ROUND);
  await expect(page.getByLabel("Your word")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByLabel("Your word").fill("cane");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("found-list")).toContainText("CANE");
});
