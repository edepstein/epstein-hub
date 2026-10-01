import { expect, test, type Page } from "@playwright/test";
import { clearProgress, expectNoHorizontalOverflow, feedback } from "./helpers";
import data from "../../src/games/letter-set/content/rounds.json";

// Pack "article" fixture: A C E I L R T, required R.
const ARTICLE = "/play/letter-set/ls-demo-2";
const ARTICLE_TARGETS = ["ARTICLE", "RATE", "TEAR", "CARE", "RACE", "RARE", "RARER", "TRAILER", "RETIRE", "RETREAT", "TRIAL", "TRACE", "CLEAR"];

async function enter(page: Page, word: string) {
  const input = page.getByLabel("Your word");
  await input.fill(word);
  await input.press("Enter");
}

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

test("catalogue to round: rejections keep input with reasons, valid words score, duplicates do not, refresh restores", async ({ page }) => {
  await page.goto("/games/letter-set");
  await page.getByTestId("round-ls-demo-1").click();
  await expect(page.getByRole("heading", { level: 1, name: "Letter Set" })).toBeVisible();
  const input = page.getByLabel("Your word");
  await expect(page.getByTestId("required-caption")).toContainText("Required letter: P");

  await enter(page, "pat");
  await expect(feedback(page)).toContainText("at least 4 letters");
  await expect(input).toHaveValue("PAT");

  await enter(page, "pizza");
  await expect(feedback(page)).toContainText("I and Z are not in this set");
  await expect(input).toHaveValue("PIZZA");

  await enter(page, "tears");
  await expect(feedback(page)).toContainText("This word needs P");
  await expect(input).toHaveValue("TEARS");

  // Repeated letters are allowed: TRANSPARENT is an all-letter word.
  await enter(page, "transparent");
  await expect(feedback(page)).toContainText("TRANSPARENT scores 18");
  await expect(feedback(page)).toContainText("All-letter word");
  await expect(input).toHaveValue("");
  await expect(page.getByTestId("all-letter-area")).toContainText("TRANSPARENT");
  await expect(page.getByTestId("score")).toHaveText("18 points");

  await enter(page, "pepper");
  await expect(page.getByTestId("score")).toHaveText("24 points");

  await enter(page, "transparent");
  await expect(feedback(page)).toContainText("Already found");
  await expect(page.getByTestId("score")).toHaveText("24 points");
  await expect(page.getByTestId("target-progress")).toHaveText("2 of 16 everyday words");

  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.reload();
  await expect(page.getByTestId("restored-banner")).toBeVisible();
  await expect(page.getByTestId("found-list")).toContainText("PEPPER");
  await expect(page.getByTestId("score")).toHaveText("24 points");
  await expect(page.getByTestId("target-progress")).toHaveText("2 of 16 everyday words");
});

test("tap letters (repeating one), shuffle keeps the required letter, hints and reveal, complete and continue", async ({ page }) => {
  await page.goto(ARTICLE);
  // Touch-style entry with a repeated letter: R, A, R, E.
  for (const l of ["R", "A", "R", "E"]) {
    await page.getByRole("button", { name: new RegExp(`^${l}(,|$)`) }).click();
  }
  await expect(page.getByLabel("Your word")).toHaveValue("RARE");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("found-list")).toContainText("RARE");

  const garden = page.getByRole("group", { name: /Letter garden/ });
  const before = await garden.getByRole("button").allTextContents();
  await page.getByRole("button", { name: "Shuffle" }).click();
  await expect(feedback(page)).toContainText("R stays in the middle");
  const after = await garden.getByRole("button").allTextContents();
  expect(after.at(-1)).toBe("R");
  expect([...after].sort()).toEqual([...before].sort());

  await page.getByRole("button", { name: "Get a hint" }).click();
  const dialog = page.getByRole("dialog", { name: "A helpful nudge" });
  await dialog.getByRole("listitem").filter({ has: page.getByText("Length and first letter", { exact: true }) }).getByRole("button", { name: "Take hint" }).click();
  await expect(feedback(page)).toContainText("An everyday word of 4 letters begins with");
  await expect(page.getByRole("button", { name: "Get a hint" })).toBeFocused();

  await page.getByRole("button", { name: "Get a hint" }).click();
  await dialog.getByRole("listitem").filter({ has: page.getByText("Definition", { exact: true }) }).getByRole("button", { name: "Take hint" }).click();
  await expect(feedback(page)).toContainText("word means:");

  await page.getByRole("button", { name: "Get a hint" }).click();
  await dialog.getByRole("listitem").filter({ has: page.getByText("Reveal a word", { exact: true }) }).getByRole("button", { name: "Reveal" }).click();
  await expect(feedback(page)).toContainText("scores 0");
  await expect(page.getByTestId("found-list")).toContainText("revealed · 0");

  for (const w of ARTICLE_TARGETS) {
    const already = await page.getByTestId("found-list").textContent();
    if (already?.split(/\s|\+|·/).includes(w)) continue;
    await enter(page, w);
  }
  const result = page.getByTestId("result-panel");
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("2 hints · 1 reveal");
  await expect(page.getByTestId("target-progress")).toHaveText("13 of 13 everyday words");
  await expect(page.getByTestId("complete-note")).toBeVisible();

  // Play continues after completion: a bonus word still scores.
  await enter(page, "crate");
  await expect(feedback(page)).toContainText("bonus word");
  await expect(page.getByTestId("found-list")).toContainText("CRATE");
});

test("keyboard only: rules dialog explains repeats, type, Escape clears, Enter submits", async ({ page }) => {
  await page.goto("/play/letter-set/ls-g1");
  await page.getByRole("button", { name: "How to play" }).focus();
  await page.keyboard.press("Enter");
  const rules = page.getByRole("dialog", { name: /How to play Letter Set/ });
  await expect(rules).toBeVisible();
  await expect(rules).toContainText("as many times as you like");
  await page.keyboard.press("Escape");
  await expect(rules).toBeHidden();
  await expect(page.getByRole("button", { name: "How to play" })).toBeFocused();

  await page.getByLabel("Your word").focus();
  await page.keyboard.type("kitten");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Your word")).toHaveValue("");
  await page.keyboard.type("kitten");
  await page.keyboard.press("Backspace");
  await expect(page.getByLabel("Your word")).toHaveValue("KITTE");
  await page.keyboard.type("n");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("found-list")).toContainText("KITTEN");
  await page.keyboard.type("kitchenette");
  await page.keyboard.press("Enter");
  await expect(feedback(page)).toContainText("KITCHENETTE scores 18");
});

test("finish early shows an honest partial result, then continue", async ({ page }) => {
  await page.goto("/play/letter-set/ls-e2");
  await enter(page, "gear");
  await page.getByRole("button", { name: "Finish and see result" }).click();
  const result = page.getByTestId("result-panel");
  await expect(result).toContainText("You found 1 of 19 everyday words");
  await expect(result).toContainText("left unexplored");
  await page.getByRole("button", { name: "Continue finding words" }).click();
  await expect(result).toBeHidden();
});

test("master garden loads with target wording, rejects a non-required word, and a full solve completes", async ({ page }) => {
  const master = (data.rounds as { id: string; payload: { required: string; targets: { word: string }[] } }[]).find((r) => r.id === "ls-m8")!; // HAUBERK, K required
  await page.goto("/play/letter-set/ls-m8");
  await expect(page.getByTestId("target-progress")).toHaveText(`0 of ${master.payload.targets.length} target words`);
  const input = page.getByLabel("Your word");
  await input.fill("hubba");
  await input.press("Enter");
  await expect(feedback(page)).toContainText("This word needs K");
  await expect(input).toHaveValue("HUBBA");
  await page.getByRole("button", { name: "Get a hint" }).click();
  const dialog = page.getByRole("dialog", { name: "A helpful nudge" });
  await dialog.getByRole("listitem").filter({ has: page.getByText("Length and first letter", { exact: true }) }).getByRole("button", { name: "Take hint" }).click();
  await expect(feedback(page)).toContainText("A target word of");
  for (const t of master.payload.targets) {
    await input.fill(t.word);
    await input.press("Enter");
  }
  const result = page.getByTestId("result-panel");
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("Every target word found");
});

test("@mobile garden fits a phone screen and plays", async ({ page }) => {
  await page.goto("/play/letter-set/ls-s3");
  await expect(page.getByLabel("Your word")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByLabel("Your word").fill("bubble");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("found-list")).toContainText("BUBBLE");
});
