import { expect, test, type Page } from "@playwright/test";
import { clearProgress, expectNoHorizontalOverflow, feedback } from "./helpers";

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

async function answer(page: Page, stage: number, word: string) {
  const input = page.getByLabel(`Answer for stage ${stage}`);
  await input.fill(word);
  await input.press("Enter");
}

async function takeHint(page: Page, label: string, button: "Take hint" | "Reveal") {
  await page.getByRole("button", { name: "Get a hint" }).click();
  const dialog = page.getByRole("dialog", { name: "A helpful nudge" });
  await dialog.getByRole("listitem").filter({ has: page.getByText(label, { exact: true }) }).getByRole("button", { name: button }).click();
}

test("exchange-one is rejected with the input kept; refresh restores; the relay completes", async ({ page }) => {
  await page.goto("/games/anagram-relay");
  await page.getByTestId("round-ar-demo-1").click();
  await expect(page.getByTestId("suggested-letter")).toContainText("N");

  const input = page.getByLabel("Answer for stage 1");
  await input.fill("alert");
  await input.press("Enter");
  await expect(feedback(page)).toContainText("swaps S for L");
  await expect(input).toHaveValue("ALERT");

  await input.fill("stare");
  await input.press("Enter");
  await expect(feedback(page)).toContainText("must grow by one letter");

  await answer(page, 1, "astern");
  await expect(page.getByTestId("stage-1")).toContainText("ASTERN");
  await expect(page.getByTestId("stage-1")).toContainText("added N");
  await expect(page.getByTestId("score")).toHaveText("33 of 100 points");

  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.reload();
  await expect(page.getByTestId("restored-banner")).toBeVisible();
  await expect(page.getByTestId("stage-progress")).toHaveText("Stage 2 of 3");

  await answer(page, 2, "parents");
  await answer(page, 3, "partners");
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("100 of 100 points");
  await expect(result).toContainText("Letters added: N, P, R");
});

test("tile mode: choose the added letter and tap tiles, no dragging", async ({ page }) => {
  await page.goto("/play/anagram-relay/ar-g1");
  await page.getByRole("button", { name: "Choose the added letter" }).click();
  await page.getByRole("button", { name: "Add H" }).click();
  const tiles = page.getByRole("group", { name: /Tiles: EAR plus H/ });
  for (const l of ["H", "A", "R", "E"]) await tiles.getByRole("button", { name: new RegExp(`^${l}(,|$)`) }).first().click();
  await expect(page.getByLabel("Answer for stage 1")).toHaveValue("HARE");
  await expect(page.getByTestId("draft-preview")).toContainText("adds H");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("stage-1")).toContainText("HARE");
});

test("hints, branch choice, revise with dependent clearing and reveal", async ({ page }) => {
  await page.goto("/play/anagram-relay/ar-e2");
  await takeHint(page, "Letter to add", "Take hint");
  await expect(feedback(page)).toContainText("add D to RANGE");
  await answer(page, 1, "danger");
  await answer(page, 2, "enraged");
  await expect(page.getByTestId("stage-2")).toContainText("ENRAGED");
  await takeHint(page, "Letter to add", "Take hint");
  await expect(feedback(page)).toContainText("add N to ENRAGED");

  await page.getByRole("button", { name: "Revise stage 1, DANGER" }).click();
  const confirm = page.getByRole("dialog", { name: "Revise stage 1?" });
  await expect(confirm).toContainText("1 later answer will be cleared");
  await confirm.getByRole("button", { name: "Reopen this stage" }).click();
  await expect(page.getByLabel("Answer for stage 1")).toHaveValue("DANGER");
  await expect(page.getByTestId("stage-2")).toContainText("opens after the stage above");

  await answer(page, 1, "danger");
  await answer(page, 2, "angered");
  await takeHint(page, "Reveal the whole relay", "Reveal");
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "revealed");
  await expect(result).toContainText("67 of 100 points");
  await expect(page.getByTestId("stage-3")).toContainText("ENDANGER");
});

test("keyboard only: complete a standard relay", async ({ page }) => {
  await page.goto("/play/anagram-relay/ar-s2");
  await page.getByRole("button", { name: "How to play" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: /How to play Anagram Relay/ })).toContainText("add exactly one more");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "How to play" })).toBeFocused();

  await page.getByLabel("Answer for stage 1").focus();
  await page.keyboard.type("email");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Answer for stage 2")).toBeFocused();
  await page.keyboard.type("claims");
  await page.keyboard.press("Enter");
  await expect(feedback(page)).toContainText("leaves out E");
  await page.keyboard.press("Escape");
  await page.keyboard.type("malice");
  await page.keyboard.press("Enter");
  await page.keyboard.type("miracle");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("result-panel")).toHaveAttribute("data-outcome", "completed");
  await expect(page.locator("#result-heading")).toBeFocused();
});

test("@mobile relay fits a phone and the alphabet picker is usable", async ({ page }) => {
  await page.goto("/play/anagram-relay/ar-s1");
  await page.getByRole("button", { name: "Choose the added letter" }).click();
  await page.getByRole("button", { name: "Add H" }).click();
  await expect(page.getByRole("button", { name: "Change added letter (H)" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByLabel("Answer for stage 1").fill("heart");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("stage-1")).toContainText("HEART");
  await expectNoHorizontalOverflow(page);
});

test("Master relay hides the added letter, rejects a rival, restores after refresh and completes all four stages", async ({ page }) => {
  await page.goto("/play/anagram-relay/ar-m1");
  await expect(page.getByTestId("suggested-letter")).toHaveCount(0);
  await expect(page.getByText("Recast with a newcomer: in name only")).toBeVisible();

  await answer(page, 1, "virtual");
  await expect(feedback(page)).toContainText("not the answer to this clue");
  await answer(page, 1, "titular");
  await answer(page, 2, "tutorial");
  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.reload();
  await expect(page.getByTestId("restored-banner")).toBeVisible();

  await answer(page, 3, "mutilator");
  await answer(page, 4, "stimulator");
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("100 of 100 points");
});
