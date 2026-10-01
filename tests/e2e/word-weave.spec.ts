import { expect, test, type Page } from "@playwright/test";
import { clearProgress, expectNoHorizontalOverflow, feedback } from "./helpers";

const cell = (page: Page, r: number, c: number) => page.getByTestId(`cell-${r}-${c}`);

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

test("type across, whole-lane entry, wrong grid stays, refresh restores, check lane, complete", async ({ page }) => {
  await page.goto("/games/word-weave");
  await page.getByTestId("round-wv-demo-1").click();
  await cell(page, 1, 0).click();
  await page.keyboard.type("CRANE");
  await expect(cell(page, 1, 4)).toHaveValue("E");
  await expect(cell(page, 1, 2)).toHaveValue("A");

  await page.getByRole("button", { name: /outer covering of a tree trunk/ }).click();
  await expect(page.getByTestId("current-clue")).toContainText("Down");
  const whole = page.getByLabel(/Whole answer for/);
  await whole.fill("bar");
  await whole.press("Enter");
  await expect(feedback(page)).toContainText("needs 4 letters");
  await expect(whole).toHaveValue("BAR");
  await whole.fill("bark");
  await whole.press("Enter");
  await expect(feedback(page)).toContainText("Entered BARK");
  await expect(cell(page, 3, 2)).toHaveValue("K");

  await page.getByRole("button", { name: "Submit grid" }).click();
  await expect(feedback(page)).toContainText("3 squares still empty");

  await page.getByRole("button", { name: /light frame flown on a string/ }).click();
  await whole.fill("kits");
  await whole.press("Enter");
  await page.getByRole("button", { name: "Submit grid" }).click();
  await expect(feedback(page)).toContainText("Not yet: at least one square is wrong");
  await expect(cell(page, 3, 5)).toHaveValue("S");

  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.reload();
  await expect(page.getByTestId("restored-banner")).toBeVisible();
  await expect(cell(page, 3, 5)).toHaveValue("S");
  await expect(page.getByTestId("filled")).toHaveText("11 of 11 squares filled");

  await page.getByRole("button", { name: /light frame flown on a string/ }).click();
  await page.getByRole("button", { name: "Check this lane" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Check the lane" }).click();
  await expect(feedback(page)).toContainText("1 square marked wrong");
  await expect(cell(page, 3, 5)).toHaveAttribute("aria-label", /marked wrong/);
  await cell(page, 3, 5).click();
  await page.keyboard.type("E");
  await page.getByRole("button", { name: "Submit grid" }).click();
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("100 of 100");
});

test("keyboard only: arrows, Space switches direction at a crossing, Enter submits", async ({ page }) => {
  await page.goto("/play/word-weave/wv-demo-2");
  await cell(page, 1, 0).focus();
  await page.keyboard.type("SOLE");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(cell(page, 1, 1)).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("current-clue")).toContainText("Down");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.type("BOAT");
  await expect(cell(page, 3, 1)).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("current-clue")).toContainText("Across");
  await page.keyboard.type("TIME");
  await page.keyboard.press("Backspace");
  await expect(cell(page, 3, 4)).toHaveValue("");
  await page.keyboard.type("E");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("result-panel")).toHaveAttribute("data-outcome", "completed");
});

test("word bank, suggested lane, revealed letter and reveal everything", async ({ page }) => {
  await page.goto("/play/word-weave/wv-g1");
  const dialog = page.getByRole("dialog", { name: "A helpful nudge" });
  const take = async (label: string, button = "Take hint") => {
    await page.getByRole("button", { name: "Get a hint" }).click();
    await dialog.getByRole("listitem").filter({ has: page.getByText(label, { exact: true }) }).getByRole("button", { name: button }).click();
  };
  await take("Word bank");
  await expect(page.getByTestId("word-bank")).toContainText("EMAIL");
  await take("Suggest a lane");
  await expect(feedback(page)).toContainText("Try ");
  await expect(page.getByText("· suggested")).toBeVisible();
  await take("Reveal a letter", "Reveal");
  await expect(page.getByTestId("revealed-count")).toHaveText("1");
  await take("Reveal everything", "Reveal");
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "revealed");
  await expect(result).toContainText("0 of 100");
});

test("@mobile expert weave keeps the page from overflowing and accepts typing", async ({ page }) => {
  await page.goto("/play/word-weave/wv-e1");
  await expect(cell(page, 0, 0)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await cell(page, 0, 0).click();
  await page.keyboard.type("PAT");
  await expect(cell(page, 0, 2)).toHaveValue("T");
});
