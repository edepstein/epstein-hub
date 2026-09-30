import { expect, test, type Page } from "@playwright/test";
import { clearProgress, expectNoHorizontalOverflow, feedback } from "./helpers";

const ROWS = "/play/hidden-word-trail/hwt-demo-1"; // pack weather-garden fixture: TREE/LEAF/RAIN/WIND rows

const cell = (page: Page, r: number, c: number) => page.getByTestId(`cell-${r}-${c}`);
async function tap(page: Page, cells: [number, number][]) {
  for (const [r, c] of cells) await cell(page, r, c).click();
}

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

test("tap a trail, rejected input keeps the trail, refresh restores, complete the serpentine round", async ({ page }) => {
  await page.goto("/games/hidden-word-trail");
  await page.getByTestId("round-hwt-demo-2").click();
  await expect(page.getByTestId("theme")).toContainText("Growing in the garden");

  // A jump is refused with a reason and the trail so far is kept.
  await tap(page, [[0, 0], [0, 1]]);
  await cell(page, 3, 3).click();
  await expect(feedback(page)).toContainText("does not touch");
  await expect(page.getByTestId("trail-text")).toContainText("GR");

  // A non-theme trail is rejected after submit, still editable.
  await cell(page, 0, 2).click();
  await page.getByRole("button", { name: "Submit trail" }).click();
  await expect(feedback(page)).toContainText("GRA is not one of this round's theme words");
  await expect(page.getByTestId("trail-text")).toContainText("GRA");

  // Tapping the last square steps back; tapping the previous square steps back again.
  await cell(page, 0, 2).click();
  await expect(page.getByTestId("trail-text")).not.toContainText("GRA");
  await tap(page, [[0, 2], [0, 3], [1, 3]]);
  await expect(page.getByTestId("trail-text")).toContainText("GRASS");
  await page.getByRole("button", { name: "Submit trail" }).click();
  await expect(feedback(page)).toContainText("GRASS found");
  await expect(page.getByTestId("cells-covered")).toHaveText("5 of 16");

  // Unsubmitted draft and progress survive a refresh.
  await tap(page, [[1, 2], [1, 1]]);
  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.reload();
  await expect(page.getByTestId("restored-banner")).toBeVisible();
  await expect(page.getByTestId("found-list")).toContainText("GRASS");
  await expect(page.getByTestId("trail-text")).toContainText("TR");
  await tap(page, [[1, 0], [2, 0]]);
  await page.getByRole("button", { name: "Submit trail" }).click();
  await expect(feedback(page)).toContainText("TREE found");

  await tap(page, [[2, 1], [2, 2], [2, 3], [3, 3], [3, 2], [3, 1], [3, 0]]);
  await page.getByRole("button", { name: "Submit trail" }).click();
  const result = page.getByTestId("result-panel");
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(page.getByTestId("cells-covered")).toHaveText("16 of 16");
});

test("a route that would strand the other words is explained and not accepted", async ({ page }) => {
  await page.goto(ROWS);
  await tap(page, [[0, 0], [0, 1], [1, 1], [0, 2]]);
  await page.getByRole("button", { name: "Submit trail" }).click();
  await expect(feedback(page)).toContainText("remaining theme words cannot fill");
  await expect(page.getByTestId("trail-text")).toContainText("TREE");
  await expect(page.getByTestId("cells-covered")).toHaveText("0 of 16");
});

test("keyboard only: arrows, Space, Backspace, Escape and Enter", async ({ page }) => {
  await page.goto(ROWS);
  await cell(page, 0, 0).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("trail-text")).not.toContainText("TR");
  await page.keyboard.press("ArrowLeft");
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Space");
    if (i < 3) await page.keyboard.press("ArrowRight");
  }
  await page.keyboard.press("Backspace");
  await expect(page.getByTestId("trail-text")).toContainText("TRE ·");
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");
  await expect(feedback(page)).toContainText("TREE found");
  await expect(cell(page, 0, 3)).toHaveAttribute("aria-label", /in found word TREE/);
  // Down to the second row and trace LEAF.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Home");
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Space");
    if (i < 3) await page.keyboard.press("ArrowRight");
  }
  await page.keyboard.press("Enter");
  await expect(feedback(page)).toContainText("LEAF found");
});

test("bonus words earn a free hint; hint ladder marks squares and reveals", async ({ page }) => {
  await page.goto("/play/hidden-word-trail/hwt-g1");
  const bonus: [number, number][][] = [
    [[1, 0], [2, 0], [3, 0], [2, 1]], // AMEN
    [[0, 2], [0, 1], [1, 1], [0, 0]], // CAPE
    [[3, 2], [3, 1], [3, 0], [2, 1]], // GLEN
  ];
  for (const p of bonus) {
    await tap(page, p);
    await page.getByRole("button", { name: "Submit trail" }).click();
    await expect(feedback(page)).toContainText("bonus credit");
  }
  await expect(feedback(page)).toContainText("earned a free hint");
  await expect(page.getByTestId("tokens")).toContainText("1 (1 unused)");
  // The same bonus word does not count twice.
  await tap(page, bonus[0]);
  await page.getByRole("button", { name: "Submit trail" }).click();
  await expect(feedback(page)).toContainText("Each bonus word counts once");
  await page.getByRole("button", { name: "Clear" }).click();

  await page.getByRole("button", { name: "Get a hint" }).click();
  const dialog = page.getByRole("dialog", { name: "A helpful nudge" });
  await dialog.getByRole("listitem").filter({ has: page.getByText("Starting square", { exact: true }) }).getByRole("button", { name: "Take hint" }).click();
  await expect(feedback(page)).toContainText("Paid for with bonus credits");
  await expect(page.getByTestId("hint-focus")).toBeVisible();
  await expect(page.locator(".hwt-cell.hinted")).toHaveCount(1);

  await page.getByRole("button", { name: "Get a hint" }).click();
  await dialog.getByRole("listitem").filter({ has: page.getByText("Half the trail", { exact: true }) }).getByRole("button", { name: "Take hint" }).click();
  await expect(page.locator(".hwt-cell.hinted")).toHaveCount(3);

  await page.getByRole("button", { name: "Get a hint" }).click();
  await dialog.getByRole("listitem").filter({ has: page.getByText("Reveal the word", { exact: true }) }).getByRole("button", { name: "Reveal" }).click();
  await expect(page.getByTestId("found-list")).toContainText("revealed");
  await expect(page.getByTestId("trail-progress")).toHaveText("1 of 4 theme words");

  await page.getByRole("button", { name: "Get a hint" }).click();
  await dialog.getByRole("listitem").filter({ has: page.getByText("Reveal everything", { exact: true }) }).getByRole("button", { name: "Reveal" }).click();
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "revealed");
  await expect(result).toContainText("0 of 4 theme words traced yourself");
});

test("drag across squares traces a trail", async ({ page }) => {
  await page.goto(ROWS);
  const box = async (r: number, c: number) => {
    const b = (await cell(page, r, c).boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const a = await box(2, 0);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (const c of [1, 2, 3]) {
    const p = await box(2, c);
    await page.mouse.move(p.x, p.y, { steps: 4 });
  }
  await page.mouse.up();
  await expect(page.getByTestId("trail-text")).toContainText("RAIN");
  await page.getByRole("button", { name: "Submit trail" }).click();
  await expect(feedback(page)).toContainText("RAIN found");
});

test("@mobile expert grid fits the phone without page overflow and plays by tapping", async ({ page }) => {
  await page.goto("/play/hidden-word-trail/hwt-e1");
  await expect(cell(page, 0, 0)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await tap(page, [[0, 0], [1, 1]]);
  await expect(page.getByTestId("trail-text")).toContainText("QU");
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByTestId("trail-text")).not.toContainText("QU");
});
