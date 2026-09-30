import { expect, test, type Page } from "@playwright/test";
import { clearProgress, expectNoHorizontalOverflow, feedback } from "./helpers";

async function step(page: Page, word: string) {
  const input = page.getByLabel("Next word");
  await input.fill(word);
  await input.press("Enter");
}

async function takeHint(page: Page, label: string, button: "Take hint" | "Reveal") {
  await page.getByRole("button", { name: "Get a hint" }).click();
  const dialog = page.getByRole("dialog", { name: "A helpful nudge" });
  await dialog.getByRole("listitem").filter({ has: page.getByText(label, { exact: true }) }).getByRole("button", { name: button }).click();
}

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

test("COLD to WARM: rejections keep input, refresh restores, hints from the current word, completion", async ({ page }) => {
  await page.goto("/games/word-ladder");
  await page.getByTestId("round-wl-demo-1").click();
  const input = page.getByLabel("Next word");
  await expect(input).toBeVisible();
  await expect(page.getByTestId("target")).toContainText("Destination");
  await expect(page.getByTestId("optimum")).toHaveText("4");

  await step(page, "warm");
  await expect(feedback(page)).toContainText("changes 4 letters of COLD");
  await expect(input).toHaveValue("WARM");
  await expect(page.getByTestId("moves")).toHaveText("0 moves");

  await step(page, "cold");
  await expect(feedback(page)).toContainText("Change exactly one letter");
  await step(page, "colds");
  await expect(feedback(page)).toContainText("has 5");

  await step(page, "cord");
  await expect(page.getByTestId("step-1")).toHaveAttribute("data-word", "CORD");
  await expect(page.getByTestId("moves")).toHaveText("1 move");
  await expect(input).toHaveValue("");
  await step(page, "cold");
  await expect(feedback(page)).toContainText("already on your route");

  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.reload();
  await expect(page.getByTestId("restored-banner")).toBeVisible();
  await expect(page.getByTestId("step-1")).toHaveAttribute("data-word", "CORD");

  await step(page, "word");
  await expect(page.getByTestId("step-2")).toHaveAttribute("data-word", "WORD");
  await takeHint(page, "Next word", "Take hint");
  await expect(feedback(page)).toHaveText(/^From WORD, (WARD|WORM) is one step along a shortest remaining route\.$/);
  await takeHint(page, "Insert the next word", "Reveal");
  await expect(page.getByTestId("step-3")).toHaveAttribute("data-word", /^(WARD|WORM)$/);
  await expect(page.getByTestId("step-3")).toHaveClass(/assisted/);

  await step(page, "warm");
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("Reached WARM in 4 moves: the shortest possible.");
  await expect(result).toContainText("100 of 100 points");
  await expect(result).toContainText("2 hints · 0 reveals");
  await expect(page.getByTestId("reached")).toBeVisible();
  await expect(page.getByLabel("Next word")).toHaveCount(0);
});

test("keyboard only: rules, typed steps, Back one step and Enter to finish", async ({ page }) => {
  await page.goto("/play/word-ladder/wl-g1");
  await page.getByRole("button", { name: "How to play" }).focus();
  await page.keyboard.press("Enter");
  const rules = page.getByRole("dialog", { name: /How to play Word Ladder/ });
  await expect(rules).toContainText("60 points, plus 40");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "How to play" })).toBeFocused();

  await page.getByLabel("Next word").focus();
  await page.keyboard.type("big");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("step-1")).toHaveAttribute("data-word", "BIG");
  await page.getByRole("button", { name: "Back one step" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("step-1")).toHaveCount(0);
  await expect(page.getByLabel("Next word")).toBeFocused();
  for (const w of ["pin", "pun", "sun"]) {
    await page.keyboard.type(w);
    await page.keyboard.press("Enter");
  }
  const result = page.getByTestId("result-panel");
  await expect(result).toContainText("Reached SUN in 3 moves: the shortest possible.");
  await expect(result).toContainText("Unassisted");
  await expect(result).toContainText("1 step taken back");
});

test("touch: word bank, go back to an earlier rung with confirmation, then reveal", async ({ page }) => {
  await page.goto("/play/word-ladder/wl-g2");
  await page.getByText(/Show word bank/).click();
  await page.getByRole("button", { name: "CAP", exact: true }).click();
  await expect(page.getByLabel("Next word")).toHaveValue("CAP");
  await page.getByRole("button", { name: "Submit" }).click();
  await page.getByRole("button", { name: "CAT", exact: true }).click();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("moves")).toHaveText("2 moves");
  await expect(page.getByRole("button", { name: "CAP, already on your route" })).toBeVisible();

  await page.getByRole("button", { name: "Go back to CUP" }).click();
  const confirm = page.getByRole("dialog", { name: "Go back to an earlier word?" });
  await expect(confirm).toContainText("2 later steps will be removed");
  await confirm.getByRole("button", { name: "Go back" }).click();
  await expect(page.getByTestId("moves")).toHaveText("0 moves");
  await expect(page.getByTestId("step-1")).toHaveCount(0);

  await takeHint(page, "Which letter to change", "Take hint");
  await expect(page.getByText(/Hint: change the second letter of CUP/)).toBeVisible();
  await takeHint(page, "Reveal the whole route", "Reveal");
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "revealed");
  await expect(result).toContainText("No score for a revealed route");
  await expect(page.getByTestId("step-3")).toHaveAttribute("data-word", "HAT");
});

test("@mobile ladder fits a phone and plays a five-letter step", async ({ page }) => {
  await page.goto("/play/word-ladder/wl-s1");
  await expect(page.getByLabel("Next word")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByLabel("Next word").fill("steep");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("step-1")).toHaveAttribute("data-word", "STEEP");
  await expectNoHorizontalOverflow(page);
});
