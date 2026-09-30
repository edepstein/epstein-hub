import { expect, test, type Page } from "@playwright/test";
import { clearProgress, expectNoHorizontalOverflow, feedback } from "./helpers";

const DEMO_CRANE = "/play/word-deduction/wd-demo-1"; // pack fixture "crane"
const DEMO_PLANT = "/play/word-deduction/wd-demo-2";
const DEMO_SHARE = "/play/word-deduction/wd-demo-3";

async function guess(page: Page, word: string) {
  const input = page.getByLabel("Your guess");
  await input.fill(word);
  await input.press("Enter");
}

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

test("rejected word costs nothing, feedback is exact, refresh restores, hint then solve", async ({ page }) => {
  await page.goto("/games/word-deduction");
  await page.getByTestId("round-wd-demo-1").click();
  const input = page.getByLabel("Your guess");
  await expect(input).toBeVisible();

  await guess(page, "xqzvw");
  await expect(feedback(page)).toContainText("not in this game's word list");
  await expect(feedback(page)).toHaveAttribute("data-ok", "false");
  await expect(input).toHaveValue("XQZVW");
  await expect(page.getByTestId("guesses-used")).toHaveText("0 of 6 guesses");

  await guess(page, "cran");
  await expect(feedback(page)).toContainText("exactly five letters");
  await expect(input).toHaveValue("CRAN");

  await guess(page, "eerie");
  await expect(page.getByTestId("guess-row-0")).toHaveAttribute("data-marks", "absent,absent,present,absent,correct");
  await expect(page.getByTestId("guess-row-0")).toContainText("E: absent; E: absent; R: elsewhere; I: absent; E: correct place");
  await expect(feedback(page)).toContainText("5 guesses left");
  await expect(input).toHaveValue("");
  await expect(page.getByTestId("guesses-used")).toHaveText("1 of 6 guesses");
  await expect(page.getByRole("button", { name: "E, correct place" })).toBeVisible();
  await expect(page.getByRole("button", { name: "I, absent" })).toBeVisible();

  await guess(page, "eerie");
  await expect(feedback(page)).toContainText("already guessed");
  await expect(page.getByTestId("guesses-used")).toHaveText("1 of 6 guesses");

  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.reload();
  await expect(page.getByTestId("restored-banner")).toBeVisible();
  await expect(page.getByTestId("guess-row-0")).toHaveAttribute("data-marks", "absent,absent,present,absent,correct");
  await expect(page.getByTestId("guesses-used")).toHaveText("1 of 6 guesses");

  await page.getByRole("button", { name: "Get a hint" }).click();
  const dialog = page.getByRole("dialog", { name: "A helpful nudge" });
  await dialog.getByRole("listitem").filter({ has: page.getByText("A letter you have not tried", { exact: true }) }).getByRole("button", { name: "Take hint" }).click();
  await expect(feedback(page)).toHaveText(/The answer contains (C|A|N)\./);
  await expect(page.getByTestId("hint-log")).toBeVisible();
  await expect(page.getByTestId("guesses-used")).toHaveText("1 of 6 guesses");

  await guess(page, "crane");
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("Solved in 2 guesses.");
  await expect(result).toContainText("1 hint · 0 reveals");
  await expect(page.getByTestId("answer-card")).toContainText("CRANE");
});

test("keyboard only: rules dialog, typed guesses and Enter to solve", async ({ page }) => {
  await page.goto("/play/word-deduction/wd-g1");
  await page.getByRole("button", { name: "How to play" }).focus();
  await page.keyboard.press("Enter");
  const rules = page.getByRole("dialog", { name: /How to play Word Deduction/ });
  await expect(rules).toContainText("Repeated letters are counted exactly");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "How to play" })).toBeFocused();

  await page.getByLabel("Your guess").focus();
  await page.keyboard.type("mouse");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Your guess")).toHaveValue("");
  await page.keyboard.type("mouse");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("guess-row-0")).toHaveAttribute("data-marks", "absent,correct,correct,correct,correct");
  await expect(page.getByLabel("Your guess")).toBeFocused();
  await page.keyboard.type("house");
  await page.keyboard.press("Enter");
  const result = page.getByTestId("result-panel");
  await expect(result).toContainText("Solved in 2 guesses.");
  await expect(result).toContainText("Unassisted");
  await expect(page.getByRole("heading", { name: "Solved in 2 guesses." })).toBeFocused();
});

test("touch: on-screen keyboard enters and submits a guess", async ({ page }) => {
  await page.goto(DEMO_PLANT);
  for (const k of "PLANX") await page.getByRole("button", { name: k, exact: true }).click();
  await expect(page.getByLabel("Your guess")).toHaveValue("PLANX");
  await page.getByRole("button", { name: "Delete letter" }).click();
  await page.getByRole("button", { name: "T", exact: true }).click();
  await page.getByRole("button", { name: "Enter", exact: true }).click();
  await expect(page.getByTestId("result-panel")).toHaveAttribute("data-outcome", "completed");
  await expect(page.getByTestId("guess-row-0")).toHaveAttribute("data-marks", "correct,correct,correct,correct,correct");
});

test("six misses: not solved, extra rows are assisted, then reveal flow on another round", async ({ page }) => {
  await page.goto(DEMO_SHARE);
  for (const w of ["eerie", "plant", "crane", "heart", "train", "slate"]) await guess(page, w);
  await expect(page.getByTestId("out-of-guesses")).toBeVisible();
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "failed");
  await expect(result).toContainText("Not solved in 6 guesses.");
  await expect(result).not.toContainText("SHARE");

  await page.getByRole("button", { name: /Keep guessing/ }).click();
  await expect(page.getByTestId("result-panel")).toBeHidden();
  await guess(page, "share");
  await expect(page.getByTestId("result-panel")).toContainText("Solved in 7 guesses, after the 6-guess limit.");
  await expect(page.getByTestId("guess-row-6")).toHaveAttribute("data-extension", "true");

  await page.goto(DEMO_CRANE);
  for (const w of ["eerie", "plant", "sheep", "heart", "train", "slate"]) await guess(page, w);
  await page.getByRole("button", { name: "Reveal the answer" }).click();
  await page.getByRole("dialog", { name: "Reveal the answer?" }).getByRole("button", { name: "Reveal it" }).click();
  await expect(page.getByTestId("result-panel")).toHaveAttribute("data-outcome", "revealed");
  await expect(page.getByTestId("answer-card")).toContainText("CRANE");
  await expect(page.getByTestId("answer-card")).toContainText("lifting heavy loads");
});

test("expert hard mode rejects a guess that ignores revealed letters, without cost", async ({ page }) => {
  await page.goto("/play/word-deduction/wd-e1");
  await expect(page.getByTestId("hard-mode-note")).toBeVisible();
  await guess(page, "night");
  await expect(page.getByTestId("guesses-used")).toHaveText("1 of 6 guesses");
  await guess(page, "bring");
  await expect(feedback(page)).toContainText("Hard mode");
  await expect(page.getByLabel("Your guess")).toHaveValue("BRING");
  await expect(page.getByTestId("guesses-used")).toHaveText("1 of 6 guesses");
  await page.getByRole("button", { name: "Switch hard mode off" }).click();
  await page.getByRole("dialog", { name: "Switch hard mode off?" }).getByRole("button", { name: "Switch it off" }).click();
  await expect(page.getByTestId("hard-mode")).toHaveText("Switched off");
  await guess(page, "bring");
  await expect(page.getByTestId("guesses-used")).toHaveText("2 of 6 guesses");
});

test("@mobile board and keyboard fit a phone screen and play", async ({ page }) => {
  await page.goto("/play/word-deduction/wd-s1");
  await expect(page.getByLabel("Your guess")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  for (const k of "TOWEL") await page.getByRole("button", { name: k, exact: true }).click();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("result-panel")).toHaveAttribute("data-outcome", "completed");
  await expectNoHorizontalOverflow(page);
});
