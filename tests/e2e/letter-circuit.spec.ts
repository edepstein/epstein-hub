import { expect, test, type Page } from "@playwright/test";
import { clearProgress, expectNoHorizontalOverflow, feedback } from "./helpers";

const ROUND = "/play/letter-circuit/lc-demo-1"; // pack cold-circuit fixture: sides ADT EFR CIL NOS

async function enter(page: Page, word: string) {
  const input = page.getByLabel("Your word");
  await input.fill(word);
  await input.press("Enter");
}

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

test("same-side and wrong-start rejections keep input; chain, refresh, completion and improving on it", async ({ page }) => {
  await page.goto("/games/letter-circuit");
  await page.getByTestId("round-lc-demo-1").click();
  const input = page.getByLabel("Your word");
  await expect(input).toBeVisible();

  await enter(page, "tad");
  await expect(feedback(page)).toContainText("T and A are both on the top side");
  await expect(input).toHaveValue("TAD");

  await enter(page, "cold");
  await expect(feedback(page)).toContainText("COLD accepted");
  await expect(page.getByTestId("chain")).toContainText("COLD");
  await expect(input).toHaveValue("D");
  await expect(page.getByTestId("next-start")).toHaveText("Next word starts with D");

  await enter(page, "train");
  await expect(feedback(page)).toContainText("must start with D, the last letter of COLD");
  await expect(input).toHaveValue("TRAIN");

  await enter(page, "draft");
  await expect(page.getByTestId("letters-used")).toHaveText("8 of 12 letters used");
  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.reload();
  await expect(page.getByTestId("restored-banner")).toBeVisible();
  await expect(page.getByTestId("chain")).toContainText("COLD");
  await expect(page.getByTestId("chain")).toContainText("DRAFT");
  await expect(input).toHaveValue("T");

  await enter(page, "train");
  await enter(page, "nest");
  const result = page.getByTestId("result-panel");
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("4 words");
  await expect(page.getByTestId("best")).toHaveText("4 words");

  await page.getByRole("button", { name: "Try for fewer words" }).click();
  await expect(result).toBeHidden();
  await expect(page.getByTestId("best")).toHaveText("4 words");
  await enter(page, "ancestor");
  await enter(page, "rifled");
  await expect(feedback(page)).toContainText("New best: 2 words");
  await expect(page.getByTestId("result-panel")).toContainText("matching par");
  await expect(page.getByTestId("best-chain")).toContainText("ANCESTOR → RIFLED");
});

test("tap letters, same-side tap is refused, bridge word and undo restore coverage", async ({ page }) => {
  await page.goto(ROUND);
  for (const l of ["C", "O", "L", "D"]) await page.locator(`[data-letter="${l}"]`).click();
  await expect(page.getByLabel("Your word")).toHaveValue("COLD");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("chain")).toContainText("COLD");
  // D is on the top side with A and T: tapping A next is refused with a reason.
  await page.locator('[data-letter="A"]').click({ force: true }); // aria-disabled, still tappable for the explanation
  await expect(feedback(page)).toContainText("same side as D");
  await expect(page.getByLabel("Your word")).toHaveValue("D");

  await enter(page, "draft");
  await enter(page, "train");
  await expect(page.getByTestId("remaining")).toContainText("Still to use: E, S");
  await page.getByRole("button", { name: "Undo last word" }).click();
  await expect(feedback(page)).toContainText("Removed TRAIN");
  await expect(page.getByTestId("remaining")).toContainText("Still to use: E, I, N, S");
  await expect(page.getByLabel("Your word")).toHaveValue("T");

  // A bridge word adds nothing new but is accepted.
  await enter(page, "told");
  await expect(feedback(page)).toContainText("bridge word with no new letters");
});

test("keyboard only: rules, typing, Escape resets to the required letter", async ({ page }) => {
  await page.goto(ROUND);
  await page.getByRole("button", { name: "How to play" }).focus();
  await page.keyboard.press("Enter");
  const rules = page.getByRole("dialog", { name: /How to play Letter Circuit/ });
  await expect(rules).toContainText("Par is the fewest words");
  await page.keyboard.press("Escape");
  await page.getByLabel("Your word").focus();
  await page.keyboard.type("cold");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Your word")).toHaveValue("D");
  await page.keyboard.type("ra");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Your word")).toHaveValue("D");
  await page.keyboard.type("raft");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("chain")).toContainText("DRAFT");
});

test("hint ladder follows the current chain end and marks played words", async ({ page }) => {
  await page.goto("/play/letter-circuit/lc-g1");
  await enter(page, "backers");
  await expect(page.getByTestId("chain")).toContainText("BACKERS");
  const dialog = page.getByRole("dialog", { name: "A helpful nudge" });
  await page.getByRole("button", { name: "Get a hint" }).click();
  await dialog.getByRole("listitem").filter({ has: page.getByText("Letters to aim for", { exact: true }) }).getByRole("button", { name: "Take hint" }).click();
  await expect(feedback(page)).toContainText("From S, try a");
  await page.getByRole("button", { name: "Get a hint" }).click();
  await dialog.getByRole("listitem").filter({ has: page.getByText("Show the word", { exact: true }) }).getByRole("button", { name: "Take hint" }).click();
  await expect(feedback(page)).toContainText("Suggested next word: S");
  await page.getByRole("button", { name: "Get a hint" }).click();
  await dialog.getByRole("listitem").filter({ has: page.getByText("Play it for me", { exact: true }) }).getByRole("button", { name: "Reveal" }).click();
  await expect(page.getByTestId("chain")).toContainText("played for you");
});

test("@mobile circuit fits a phone and plays", async ({ page }) => {
  await page.goto(ROUND);
  await expect(page.getByLabel("Your word")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.locator('[data-letter="C"]').click();
  await page.locator('[data-letter="O"]').click();
  await expect(page.getByLabel("Your word")).toHaveValue("CO");
});
