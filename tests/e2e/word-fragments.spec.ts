import { expect, test, type Page } from "@playwright/test";
import { clearProgress, expectNoHorizontalOverflow, feedback } from "./helpers";

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

const trayTile = (page: Page, text: string) => page.getByTestId("tray").getByRole("button", { name: new RegExp(`^${text}, in the tray`) }).first();

async function placeFromTray(page: Page, text: string, lane: number) {
  await trayTile(page, text).click();
  await page.getByRole("button", { name: `Place ${text} in answer ${lane}` }).click();
}

async function takeHint(page: Page, label: string, button: "Take hint" | "Reveal") {
  await page.getByRole("button", { name: "Get a hint" }).click();
  const dialog = page.getByRole("dialog", { name: "A helpful nudge" });
  await dialog.getByRole("listitem").filter({ has: page.getByText(label, { exact: true }) }).getByRole("button", { name: button }).click();
}

test("select-then-place builds the board; incomplete and wrong boards are refused; refresh restores; completes", async ({ page }) => {
  await page.goto("/games/word-fragments");
  await page.getByTestId("round-wf-demo-1").click();
  await expect(page.getByTestId("tray").getByRole("button")).toHaveCount(7);

  await placeFromTray(page, "NOTE", 1);
  await placeFromTray(page, "BANK", 1);
  await expect(page.getByTestId("lane-1-letters")).toContainText("NOTEBANK · 8 of 8 letters");
  await page.getByRole("button", { name: "Submit board" }).click();
  await expect(feedback(page)).toContainText("5 fragments still in the tray");

  // Reorder inside the lane: select BANK and move it earlier.
  await page.getByTestId("lane-1").getByRole("button", { name: /^BANK, answer 1 position 2/ }).click();
  await page.getByRole("button", { name: "Move BANK earlier in answer 1" }).click();
  await expect(page.getByTestId("lane-1-letters")).toContainText("BANKNOTE");

  await placeFromTray(page, "RAIN", 2);
  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.reload();
  await expect(page.getByTestId("restored-banner")).toBeVisible();
  await expect(page.getByTestId("lane-1-letters")).toContainText("BANKNOTE");
  await expect(page.getByTestId("lane-2-letters")).toContainText("RAIN");
  await expect(page.getByTestId("tray").getByRole("button")).toHaveCount(4);

  await placeFromTray(page, "BOW", 2);
  await placeFromTray(page, "SUN", 3);
  await placeFromTray(page, "FLOW", 3);
  await placeFromTray(page, "ER", 3);
  await page.getByRole("button", { name: "Submit board" }).click();
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("100 points");
  await expect(result).toContainText("SUN + FLOW + ER = SUNFLOWER");
});

test("lane check counts as assistance, undo after checking, too-long rejected, return all needs confirmation", async ({ page }) => {
  await page.goto("/play/word-fragments/wf-g1");
  await placeFromTray(page, "SUN", 1);
  await placeFromTray(page, "SHINE", 1);
  await page.getByRole("button", { name: "Check answer 1 (counts as assistance)" }).click();
  await expect(feedback(page)).toContainText("SUNSHINE is an accepted answer");
  await page.getByRole("button", { name: "Undo last move" }).click();
  await expect(page.getByTestId("lane-1-letters")).toContainText("SUN · 3 of 8");

  await placeFromTray(page, "FOOT", 2);
  await trayTile(page, "SHINE").click();
  await page.getByRole("button", { name: "Place SHINE in answer 2" }).click();
  await expect(feedback(page)).toContainText("would make 9 letters");
  await expect(page.getByTestId("selected-tile")).toContainText("SHINE");

  await page.getByRole("button", { name: "Return all to tray" }).click();
  await page.getByRole("dialog", { name: "Return every fragment to the tray?" }).getByRole("button", { name: "Return them" }).click();
  await expect(page.getByTestId("tray").getByRole("button")).toHaveCount(6);
  await expect(page.getByTestId("placed-count")).toHaveText("0 of 6 fragments placed");
});

test("hints move fragments visibly and lock a lane; reveal is honest", async ({ page }) => {
  await page.goto("/play/word-fragments/wf-s1");
  await placeFromTray(page, "CAR", 1);
  await takeHint(page, "Which lane next", "Take hint");
  await expect(feedback(page)).toContainText("Try answer 1 next");
  await takeHint(page, "First fragment", "Take hint");
  await expect(feedback(page)).toContainText("GAR starts answer 1");
  await takeHint(page, "Complete a lane", "Reveal");
  await expect(feedback(page)).toContainText("GAR + DEN = GARDEN");
  await expect(page.getByTestId("lane-1")).toContainText("Locked by hint");
  await expect(page.getByTestId("lane-1-letters")).toContainText("GARDEN");
  await takeHint(page, "Reveal the board", "Reveal");
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "revealed");
  await expect(result).toContainText("0 points");
});

test("keyboard only: identical-looking tiles on an expert board", async ({ page }) => {
  await page.goto("/play/word-fragments/wf-e1");
  const pairs: [string, number][] = [
    ["MON", 1],
    ["KEY", 1],
    ["DON", 2],
    ["KEY", 2],
    ["TUR", 3],
    ["KEY", 3],
    ["HOC", 4],
    ["KEY", 4],
  ];
  for (const [text, lane] of pairs) {
    await trayTile(page, text).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: `Place ${text} in answer ${lane}` }).focus();
    await page.keyboard.press("Enter");
  }
  await page.getByRole("button", { name: "Submit board" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("result-panel")).toHaveAttribute("data-outcome", "completed");
  await expect(page.locator("#result-heading")).toBeFocused();
});

test("@mobile board fits a phone and tiles can be tapped into place", async ({ page }) => {
  await page.goto("/play/word-fragments/wf-e4");
  await expectNoHorizontalOverflow(page);
  await placeFromTray(page, "BUT", 1);
  await expect(page.getByTestId("lane-1-letters")).toContainText("BUT · 3 of 9");
  await expectNoHorizontalOverflow(page);
});

test("master board: long answers load, a wrong sharing-out is refused, and the unique allocation completes", async ({ page }) => {
  await page.goto("/play/word-fragments/wf-m1");
  await expect(page.getByTestId("tray").getByRole("button")).toHaveCount(16);
  const lanes: string[][] = [
    ["IN", "SA", "LUBR", "IOUS"],
    ["SA", "LUBR", "IOUS"],
    ["LU", "CU", "BR", "ATI", "ON"],
    ["LU", "GU", "BRI", "OUS"],
  ];
  // Misleading: the same chunks spell INSALUBRIOUS from lane 2's pieces too, so swap two fragments first.
  await placeFromTray(page, "SA", 1);
  await placeFromTray(page, "IN", 1);
  await expect(page.getByTestId("lane-1-letters")).toContainText("SAIN");
  await page.getByRole("button", { name: "Undo last move" }).click();
  await page.getByRole("button", { name: "Undo last move" }).click();
  for (const [i, texts] of lanes.entries()) for (const t of texts) await placeFromTray(page, t, i + 1);
  await expect(page.getByTestId("lane-1-letters")).toContainText("INSALUBRIOUS · 12 of 12 letters");
  await page.getByRole("button", { name: "Submit board" }).click();
  await expect(page.getByTestId("result-panel")).toHaveAttribute("data-outcome", "completed");
});
