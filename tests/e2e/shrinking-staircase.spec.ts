import { expect, test, type Page } from "@playwright/test";
import { clearProgress, expectNoHorizontalOverflow, feedback } from "./helpers";

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

async function answer(page: Page, rung: number, word: string) {
  const input = page.getByLabel(`Answer for rung ${rung}`);
  await input.fill(word);
  await input.press("Enter");
}

async function takeHint(page: Page, label: string, button: "Take hint" | "Reveal") {
  await page.getByRole("button", { name: "Get a hint" }).click();
  const dialog = page.getByRole("dialog", { name: "A helpful nudge" });
  await dialog.getByRole("listitem").filter({ has: page.getByText(label, { exact: true }) }).getByRole("button", { name: button }).click();
}

test("game page to round: added letter rejected with input kept, refresh restores, completion scores 100", async ({ page }) => {
  await page.goto("/games/shrinking-staircase");
  await page.getByTestId("round-sc-demo-1").click();
  await expect(page.getByTestId("rung-1")).toContainText("The quality or character of a sound");

  const input = page.getByLabel("Answer for rung 1");
  await input.fill("tune");
  await input.press("Enter");
  await expect(feedback(page)).toContainText("U is not in STONE");
  await expect(input).toHaveValue("TUNE");

  await input.fill("note");
  await input.press("Enter");
  await expect(feedback(page)).toContainText("not the answer to this clue");
  await expect(input).toHaveValue("NOTE");

  await answer(page, 1, "tone");
  await expect(page.getByTestId("rung-1")).toContainText("TONE");
  await expect(page.getByTestId("rung-1")).toContainText("removed S");
  await expect(page.getByTestId("score")).toHaveText("33 of 100 points");

  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.reload();
  await expect(page.getByTestId("restored-banner")).toBeVisible();
  await expect(page.getByTestId("rung-1")).toContainText("TONE");
  await expect(page.getByTestId("rung-progress")).toHaveText("Rung 2 of 3");

  await answer(page, 2, "one");
  await answer(page, 3, "on");
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("100 of 100 points");
  await expect(result).toContainText("Unassisted");
  await result.getByText("How it works").click();
  await expect(result).toContainText("STONE − S → TONE");
});

test("hints follow the chain, a filled rung scores 0 and revising clears dependent rungs", async ({ page }) => {
  await page.goto("/play/shrinking-staircase/sc-e3");
  await takeHint(page, "Letter to remove", "Take hint");
  await expect(feedback(page)).toContainText("one of the two Ts");
  await takeHint(page, "Fill this rung", "Reveal");
  await expect(page.getByTestId("rung-1")).toContainText("PARENT");
  await expect(page.getByTestId("rung-1")).toContainText("filled by hint");

  await answer(page, 2, "taper");
  await answer(page, 3, "tape");
  await expect(page.getByTestId("rung-progress")).toHaveText("Rung 4 of 5");

  await page.getByRole("button", { name: "Revise rung 2, TAPER" }).click();
  const confirm = page.getByRole("dialog", { name: "Revise rung 2?" });
  await expect(confirm).toContainText("1 answer below it will be cleared");
  await confirm.getByRole("button", { name: "Reopen this rung" }).click();
  await expect(page.getByLabel("Answer for rung 2")).toHaveValue("TAPER");
  await expect(page.getByTestId("rung-3")).toContainText("opens when the rung above is solved");

  await answer(page, 2, "taper");
  await answer(page, 3, "tape");
  await answer(page, 4, "tap");
  await answer(page, 5, "at");
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("80 of 100 points");
  await expect(result).toContainText("1 hint · 1 reveal");
});

test("keyboard only: rules, answering, hint dialog and revise confirmation", async ({ page }) => {
  await page.goto("/play/shrinking-staircase/sc-g1");
  await page.getByRole("button", { name: "How to play" }).focus();
  await page.keyboard.press("Enter");
  const rules = page.getByRole("dialog", { name: /How to play Shrinking Staircase/ });
  await expect(rules).toContainText("remove exactly one letter");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "How to play" })).toBeFocused();

  await page.getByLabel("Answer for rung 1").focus();
  await page.keyboard.type("spot");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Answer for rung 2")).toBeFocused();
  await page.keyboard.type("top");
  await page.keyboard.press("Enter");
  await expect(feedback(page)).toContainText("not the answer to this clue");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Answer for rung 2")).toHaveValue("");

  await page.getByRole("button", { name: "Revise rung 1, SPOT" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Revise rung 1?" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("rung-1")).toContainText("SPOT");

  await page.getByLabel("Answer for rung 2").focus();
  await page.keyboard.type("pot");
  await page.keyboard.press("Enter");
  // Wait for focus to advance before typing, otherwise keystrokes can land in rung 2 under load.
  await expect(page.getByLabel("Answer for rung 3")).toBeFocused();
  await page.keyboard.type("to");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("result-panel")).toHaveAttribute("data-outcome", "completed");
  await expect(page.locator("#result-heading")).toBeFocused();
});

test("revealing the whole staircase is recorded honestly", async ({ page }) => {
  await page.goto("/play/shrinking-staircase/sc-s2");
  await answer(page, 1, "irate");
  await takeHint(page, "Reveal the whole staircase", "Reveal");
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "revealed");
  await expect(result).toContainText("25 of 100 points");
  await expect(page.getByTestId("rung-4")).toContainText("AT");
});

test("@mobile tiles build an answer by tapping and the staircase fits a phone", async ({ page }) => {
  await page.goto("/play/shrinking-staircase/sc-g1");
  for (const l of ["S", "P", "O", "T"]) {
    await page.getByRole("group", { name: /Letters of SPORT/ }).getByRole("button", { name: new RegExp(`^${l}$`) }).first().click();
  }
  await expect(page.getByLabel("Answer for rung 1")).toHaveValue("SPOT");
  await expect(page.getByTestId("draft-preview")).toContainText("removes R");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("rung-1")).toContainText("SPOT");
  await expectNoHorizontalOverflow(page);
});
