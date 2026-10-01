import { expect, test, type Page } from "@playwright/test";
import { clearProgress, expectNoHorizontalOverflow, feedback } from "./helpers";

const cardButton = (page: Page, n: number) => page.getByRole("navigation", { name: "Cards in this round" }).getByRole("button", { name: new RegExp(`^Card ${n},`) });
const answer = (page: Page) => page.getByRole("textbox", { name: /Answer for card/ });

async function solve(page: Page, n: number, word: string) {
  await cardButton(page, n).click();
  await answer(page).fill(word);
  await answer(page).press("Enter");
  await expect(page.getByTestId("card-explanation")).toContainText(word.toUpperCase());
}

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

test("wrong length, one-meaning word, card switching keeps drafts, hint, refresh restores, reverse-order completion", async ({ page }) => {
  await page.goto("/games/clue-pairs");
  await page.getByTestId("round-cp-demo-1").click();
  await expect(page.getByRole("heading", { level: 1, name: "Clue Pairs" })).toBeVisible();
  await expect(page.getByTestId("meaning-1")).toHaveText("A long-legged wading bird");
  await expect(page.getByText("One word · 5 letters")).toBeVisible();

  // Wrong length: explained, not counted, input kept.
  await answer(page).fill("swan");
  await answer(page).press("Enter");
  await expect(feedback(page)).toContainText("The answer has 5 letters; SWAN has 4");
  await expect(answer(page)).toHaveValue("SWAN");

  // Punctuation is rejected recoverably.
  await answer(page).fill("cr-ne");
  await answer(page).press("Enter");
  await expect(feedback(page)).toContainText("letters A to Z only");

  // A real word fitting only one meaning is a wrong guess and offers a report.
  await answer(page).fill("heron");
  await answer(page).press("Enter");
  await expect(feedback(page)).toContainText("HERON is not the answer for card 1");
  await expect(page.getByTestId("wrong-guesses")).toContainText("HERON");
  await page.getByRole("button", { name: "Report an answer issue" }).click();
  await expect(feedback(page)).toContainText("saved on this device");

  // Type on card 1, switch to card 2 and back: draft retained.
  await answer(page).fill("cra");
  await cardButton(page, 2).click();
  await expect(page.getByTestId("meaning-1")).toHaveText("The sound a dog makes");
  await expect(answer(page)).toHaveValue("");
  await cardButton(page, 1).click();
  await expect(answer(page)).toHaveValue("CRA");

  // Hint on card 5 (BEAM) only.
  await cardButton(page, 5).click();
  await page.getByRole("button", { name: "Get a hint" }).click();
  const dialog = page.getByRole("dialog", { name: "A helpful nudge" });
  await dialog.getByRole("listitem").filter({ has: page.getByText("First letter", { exact: true }) }).getByRole("button", { name: "Take hint" }).click();
  await expect(feedback(page)).toContainText("Card 5 starts with B.");
  await expect(page.getByTestId("card-hints")).toContainText("B _ _ _");

  // Solve card 5 first (reverse order), then refresh mid-round.
  await answer(page).fill("  beam ");
  await answer(page).press("Enter");
  await expect(page.getByTestId("card-explanation")).toContainText("narrow shaft of light");
  await expect(cardButton(page, 5)).toContainText("✓ Solved");
  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.reload();
  await expect(page.getByTestId("restored-banner")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Card 5 of 5" })).toBeVisible();
  await expect(cardButton(page, 5)).toContainText("✓ Solved");
  await expect(page.getByTestId("hints-used")).toHaveText("1");

  // Next card goes to the next unsolved card (wraps to card 1) without auto-advance.
  await page.getByRole("button", { name: "Next card" }).click();
  await expect(page.getByRole("heading", { name: "Card 1 of 5" })).toBeVisible();
  await expect(page.getByTestId("wrong-guesses")).toContainText("HERON");

  await solve(page, 4, "match");
  await solve(page, 3, "SOLE");
  await solve(page, 2, "bark");
  await solve(page, 1, "crane");

  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("All 5 cards complete, 1 with help");
  await expect(result).toContainText("100 of 100 points");
  await expect(result).toContainText("1 hint · 0 reveals");
});

test("keyboard only: tab to cards, type, Enter submits, Escape clears", async ({ page }) => {
  await page.goto("/play/clue-pairs/cp-g1");
  await cardButton(page, 1).focus();
  await page.keyboard.press("Tab"); // card 2
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Card 2 of 5" })).toBeVisible();
  await answer(page).focus();
  await page.keyboard.type("pal");
  await page.keyboard.press("Escape");
  await expect(answer(page)).toHaveValue("");
  await page.keyboard.type("palm");
  await page.keyboard.press("Enter");
  await expect(feedback(page)).toContainText("Solved: PALM");
  await expect(page.getByRole("button", { name: "Next card" })).toBeVisible();
  await page.getByRole("button", { name: "Next card" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Card 3 of 5" })).toBeVisible();
  for (const w of ["orange", "key", "duck"]) {
    await answer(page).focus();
    await page.keyboard.type(w);
    await page.keyboard.press("Enter");
    await expect(feedback(page)).toContainText(`Solved: ${w.toUpperCase()}`);
    if (w !== "duck") {
      await page.getByRole("button", { name: "Next card" }).focus();
      await page.keyboard.press("Enter");
    }
  }
  await cardButton(page, 1).focus();
  await page.keyboard.press("Enter");
  await answer(page).focus();
  await page.keyboard.type("ring");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("result-panel")).toContainText("All 5 cards solved without help");
});

test("DRAUGHT regression: DRAFT is refused for the air-current card; reveal card and reveal all are separate", async ({ page }) => {
  await page.goto("/play/clue-pairs/cp-e1");
  await expect(page.getByTestId("meaning-1")).toHaveText("A cold current of air in a room");
  await answer(page).fill("draft");
  await answer(page).press("Enter");
  await expect(feedback(page)).toContainText("The answer has 7 letters; DRAFT has 5");
  await answer(page).fill("draught");
  await answer(page).press("Enter");
  await expect(page.getByTestId("card-explanation")).toContainText("DRAFT does not fit");

  await cardButton(page, 2).click();
  await page.getByRole("button", { name: "Get a hint" }).click();
  const dialog = page.getByRole("dialog", { name: "A helpful nudge" });
  await dialog.getByRole("listitem").filter({ has: page.getByText("Reveal this card", { exact: true }) }).getByRole("button", { name: "Reveal" }).click();
  await expect(feedback(page)).toContainText("Card 2 revealed: PUNCH. It scores 0.");
  await expect(cardButton(page, 2)).toContainText("Revealed");
  await expect(cardButton(page, 3)).toContainText("6 letters");

  await page.getByRole("toolbar", { name: "Game tools" }).getByRole("button", { name: "Reveal answers" }).click();
  await page.getByRole("dialog", { name: "Reveal every remaining card?" }).getByRole("button", { name: "Reveal answers" }).click();
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "revealed");
  await expect(result).toContainText("You solved 1 of 5 cards");
  await expect(result).toContainText("20 of 100 points");
});

test("@mobile one card at a time fits a phone and plays", async ({ page }) => {
  await page.goto("/play/clue-pairs/cp-s2");
  await expect(page.getByTestId("meaning-1")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const box = await cardButton(page, 5).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: "test-results/clue-pairs-mobile.png" });
  await answer(page).fill("fair");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("card-explanation")).toContainText("FAIR");
  await expectNoHorizontalOverflow(page);
});

test("Master pairs: second senses are solvable and a full round completes", async ({ page }) => {
  await page.goto("/play/clue-pairs/cp-m1");
  await expect(page.getByTestId("meaning-2")).toContainText("summons");
  await answer(page).fill("brook");
  await answer(page).press("Enter");
  await expect(feedback(page)).toContainText("5");
  for (const [n, word] of [[1, "beck"], [2, "scruple"], [3, "gammon"], [4, "quire"], [5, "fluke"]] as const) {
    await cardButton(page, n).click();
    await answer(page).fill(word);
    await answer(page).press("Enter");
    await expect(page.getByTestId("card-explanation")).toBeVisible();
  }
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "completed");
});
