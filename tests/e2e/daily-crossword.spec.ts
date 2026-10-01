import { expect, test, type Page } from "@playwright/test";
import { clearProgress, expectNoHorizontalOverflow, feedback } from "./helpers";

// dc-gq1 solution:  PRICE / S#V#N / ALOFT / L#R#E / MAYOR
const GQ1 = "/play/daily-crossword/dc-gq1";
const cell = (page: Page, r: number, c: number) => page.locator(`input[data-cell="${r},${c}"]`);
const rowText = async (page: Page, r: number, cols: number[]) => {
  const out: string[] = [];
  for (const c of cols) out.push(await cell(page, r, c).inputValue());
  return out.join("");
};

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

test("typing advances, Backspace retreats, arrows and Space steer, clue list stays in sync, refresh restores", async ({ page }) => {
  await page.goto("/games/daily-crossword");
  await page.getByTestId("round-dc-gq1").click();
  await expect(page.getByTestId("xw-bar")).toContainText("1 Across (5)");
  await expect(page.getByTestId("xw-active-clue")).toHaveText("What you pay for something");

  await cell(page, 0, 0).focus();
  await page.keyboard.type("prixe");
  expect(await rowText(page, 0, [0, 1, 2, 3, 4])).toBe("PRIXE");
  // Backspace clears the current (last, filled) square, then steps back and clears.
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  expect(await rowText(page, 0, [0, 1, 2, 3, 4])).toBe("PRI");
  await expect(cell(page, 0, 3)).toBeFocused();
  await page.keyboard.type("ce");
  expect(await rowText(page, 0, [0, 1, 2, 3, 4])).toBe("PRICE");

  // Arrow down onto a down-only square switches to that entry; the list follows.
  await page.keyboard.press("ArrowDown");
  await expect(cell(page, 1, 4)).toBeFocused();
  await expect(page.getByTestId("xw-bar")).toContainText("3 Down (5)");
  await expect(page.getByTestId("xw-bar")).toContainText("Row 2, column 5");
  await expect(page.locator('.xw-clue[aria-current="true"]')).toContainText("Go into a room");
  await expect(cell(page, 1, 4)).toHaveAttribute("aria-label", /Row 2, column 5\. 3 Down, letter 2 of 5\. empty/);

  // Space toggles direction on a crossing square.
  await cell(page, 0, 0).click();
  await expect(page.getByTestId("xw-bar")).toContainText("1 Down (5)");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("xw-bar")).toContainText("1 Across (5)");
  // Tapping the selected square again switches direction too.
  await cell(page, 0, 0).click();
  await expect(page.getByTestId("xw-bar")).toContainText("1 Down (5)");

  // Clicking a clue in the list jumps to its first empty square.
  await page.getByRole("button", { name: /Head of a town council/ }).click();
  await expect(cell(page, 4, 0)).toBeFocused();
  await page.keyboard.type("m");
  await expect(cell(page, 4, 1)).toBeFocused();

  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.reload();
  await expect(page.getByTestId("restored-banner")).toBeVisible();
  expect(await rowText(page, 0, [0, 1, 2, 3, 4])).toBe("PRICE");
  await expect(cell(page, 4, 0)).toHaveValue("M");
  await expect(page.getByTestId("xw-bar")).toContainText("5 Across");
  await expect(page.getByTestId("xw-progress")).toHaveText("6 of 21 squares");
});

test("clue-form entry rejects wrong length, paste fills an answer, wrong full grid is not success, check and reveal are recorded", async ({ page }) => {
  await page.goto(GQ1);
  const answer = page.getByLabel(/Answer the selected clue/);
  await answer.fill("cost");
  await answer.press("Enter");
  await expect(feedback(page)).toContainText("1 Across needs 5 letters (5); you entered 4");
  await expect(answer).toHaveValue("COST");
  await answer.fill("price");
  await answer.press("Enter");
  await expect(feedback(page)).toContainText("Entered PRICE in 1 Across");
  await expect(answer).toHaveValue("");

  // Paste a whole answer into the grid on 4 Across.
  await page.getByRole("button", { name: /High up in the air/ }).click();
  await cell(page, 2, 0).evaluate((el) => {
    const dt = new DataTransfer();
    dt.setData("text/plain", "aloft");
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  expect(await rowText(page, 2, [0, 1, 2, 3, 4])).toBe("ALOFT");

  for (const [clue, text] of [
    [/Head of a town council/, "MEYOR"],
    [/Sacred song/, "PSALM"],
    [/Creamy white/, "IVORY"],
    [/Go into a room/, "ENTER"],
  ] as const) {
    await page.getByRole("button", { name: clue }).click();
    await answer.fill(text);
    await answer.press("Enter");
  }
  await expect(feedback(page)).toContainText("some entries need another look");
  await expect(page.getByTestId("result-panel")).toHaveCount(0);

  // Row 5, column 2 is only in 5 Across, so nothing crossing exposed the E. Check the word to locate it.
  await page.getByRole("button", { name: /Head of a town council/ }).click();
  await page.getByRole("button", { name: "Check word" }).click();
  await expect(feedback(page)).toContainText("Checked 5 Across: 1 letter wrong");
  await expect(page.locator('.xw-cell[data-check="wrong"] input')).toHaveValue("E");
  await expect(page.getByTestId("xw-checks")).toHaveText("1");

  await cell(page, 4, 1).click();
  await page.getByRole("button", { name: "Reveal letter" }).click();
  const result = page.getByTestId("result-panel");
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("complete, with some help");
  await expect(result).toContainText("1 hint · 1 reveal");
});

test("keyboard only: Tab through clues and complete a cryptic grid unassisted", async ({ page }) => {
  await page.goto("/play/daily-crossword/dc-gc1");
  await page.getByRole("button", { name: "How to play" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: /How to play Daily Crossword/ })).toContainText("Tab and Shift+Tab");
  await page.keyboard.press("Escape");

  // Reach the grid by Tab from the zoom controls.
  await page.getByRole("button", { name: "Zoom in" }).focus();
  await page.keyboard.press("Tab");
  await expect(cell(page, 0, 0)).toBeFocused();
  const answers = ["SPOON", "ALTER", "LANCE", "SNAIL", "OFTEN", "NERVE"];
  for (const [i, a] of answers.entries()) {
    await page.keyboard.press("Home"); // down answers start on an already-filled square
    await page.keyboard.type(a.toLowerCase());
    if (i < answers.length - 1) await page.keyboard.press("Tab");
  }
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("Cryptic crossword complete, unassisted.");
  await result.getByText("How it works").click();
  await expect(result).toContainText("Rearrange the letters of SNOOP to make SPOON.");
  await expect(result).toContainText("ALTER is hidden in \"metal terminal\"");
});

test("reveal the whole grid needs confirmation and ends as revealed", async ({ page }) => {
  await page.goto("/play/daily-crossword/dc-sq2");
  await page.getByRole("button", { name: "Reveal grid" }).click();
  await page.getByRole("dialog", { name: "Reveal the whole grid?" }).getByRole("button", { name: "Reveal the grid" }).click();
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "revealed");
  await expect(cell(page, 2, 0)).toHaveValue("G");
});

test("@mobile large grid zooms inside its own frame without page overflow", async ({ page }) => {
  await page.goto("/play/daily-crossword/dc-eq1");
  await expect(page.getByTestId("xw-grid")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const before = (await page.getByTestId("xw-grid").boundingBox())!.width;
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByTestId("xw-zoom")).toHaveText("150%");
  const after = (await page.getByTestId("xw-grid").boundingBox())!.width;
  expect(after).toBeGreaterThan(before * 1.4);
  await expectNoHorizontalOverflow(page);
  await cell(page, 0, 0).focus();
  await page.keyboard.type("eagle");
  await expect(cell(page, 0, 4)).toHaveValue("E");
});
