import { expect, test, type Page } from "@playwright/test";
import { clearProgress, expectNoHorizontalOverflow, feedback } from "./helpers";

const DEMO1 = "/play/cryptic-workshop/cw-demo-1"; // SILENT / WREN / STRESSED (gentle)
const DEMO2 = "/play/cryptic-workshop/cw-demo-2"; // STALE / STOP / ROSE (standard)

const answerBox = (page: Page) => page.locator("#cw-input");
const tab = (page: Page, n: number) => page.getByRole("tab", { name: new RegExp(`^Clue ${n}`) });

async function answer(page: Page, text: string) {
  await answerBox(page).fill(text);
  await answerBox(page).press("Enter");
}

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

test("catalogue to round: wrong length and wrong answer keep input, correct answer opens the parse, refresh restores", async ({ page }) => {
  await page.goto("/games/cryptic-workshop");
  await page.getByTestId("round-cw-demo-1").click();
  await expect(page.getByTestId("cw-clue")).toContainText("Quiet: listen, upset (6)");
  await expect(page.getByTestId("cw-clue")).toContainText("01 / ANAGRAM"); // gentle names the device

  await answer(page, "quiet");
  await expect(feedback(page)).toContainText("asks for 6 letters; QUIET has 5");
  await expect(answerBox(page)).toHaveValue("QUIET");

  await answer(page, "listen");
  await expect(feedback(page)).toContainText("LISTEN is not the answer to clue 1");
  await expect(answerBox(page)).toHaveValue("LISTEN");

  await answer(page, "silent");
  await expect(feedback(page)).toContainText("SILENT is right");
  const parse = page.getByTestId("cw-parse");
  await expect(parse).toContainText("✓ Solved: SILENT");
  await expect(parse).toContainText("Rearrange the letters of LISTEN to make SILENT.");
  await expect(parse).toContainText("“upset”");
  await expect(tab(page, 1)).toContainText("✓ solved");
  await expect(page.getByTestId("cw-score")).toHaveText("33 of 100");

  // Advance only through Next.
  await page.getByRole("button", { name: "Next clue" }).click();
  await expect(tab(page, 2)).toHaveAttribute("aria-selected", "true");
  await answerBox(page).fill("WR");

  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.reload();
  await expect(page.getByTestId("restored-banner")).toBeVisible();
  await expect(tab(page, 1)).toContainText("✓ solved");
  await expect(tab(page, 2)).toHaveAttribute("aria-selected", "true");
  await expect(answerBox(page)).toHaveValue("WR");
  await expect(page.getByTestId("cw-score")).toHaveText("33 of 100");
});

test("progressive hints, device practice, reveal with confirmation and an assisted result", async ({ page }) => {
  await page.goto(DEMO2);
  await expect(page.getByTestId("cw-clue")).toContainText("WHAT IS THE TRICK?");

  // Stage 1 via the inline ladder: the definition is marked in the clue.
  await page.getByRole("button", { name: "Next hint: Identify the definition" }).click();
  await expect(page.locator("mark[data-mark=definition]")).toHaveText(/Not fresh/);
  await expect(page.getByTestId("cw-notes")).toContainText('The definition is "Not fresh".');

  // Device practice: a wrong guess is recorded and costs nothing, a right one names the device.
  await page.getByRole("button", { name: "Hidden word" }).click();
  await expect(feedback(page)).toContainText("Not a hidden word clue");
  await page.getByRole("button", { name: "Anagram", exact: true }).click();
  await expect(feedback(page)).toContainText("Yes: clue 1 is an anagram clue.");
  await expect(page.getByTestId("cw-clue")).toContainText("01 / ANAGRAM");

  // Stage 3 via the shell's hint dialog: the device step is skipped because it is known.
  await page.getByRole("button", { name: "Get a hint" }).click();
  const dialog = page.getByRole("dialog", { name: "A helpful nudge" });
  await dialog.getByRole("listitem").filter({ hasText: "Highlight the indicator" }).getByRole("button", { name: "Take hint" }).click();
  await expect(page.locator("mark[data-mark=indicator]")).toHaveText(/broken/);
  await answer(page, "stale");
  await expect(page.getByTestId("cw-parse")).toContainText("STALE");

  // Clue 2: reveal needs confirmation and scores 0.
  await tab(page, 2).click();
  await page.getByRole("button", { name: "Reveal the answer" }).click();
  const confirm = page.getByRole("dialog", { name: "Reveal clue 2?" });
  await expect(confirm).toContainText("score 0");
  await confirm.getByRole("button", { name: "Reveal the answer" }).click();
  await expect(page.getByTestId("cw-parse")).toContainText("Revealed: STOP");
  await expect(tab(page, 2)).toContainText("revealed");

  await tab(page, 3).click();
  await answer(page, "rose");
  const result = page.getByTestId("result-panel");
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("2 of 3 clues solved, 1 revealed.");
  await expect(result).toContainText("67 of 100");
  await expect(result).toContainText("2 hints · 1 reveal");
});

test("keyboard only: tabs with arrow keys, answers with Enter, complete a gentle workshop", async ({ page }) => {
  await page.goto("/play/cryptic-workshop/cw-g1");
  await tab(page, 1).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab(page, 2)).toBeFocused();
  await expect(tab(page, 2)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Tab");
  // Focus moves into the panel; reach the answer box by keyboard.
  await answerBox(page).focus();
  await page.keyboard.type("tin");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "✓ Solved: TIN" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Next clue" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(tab(page, 3)).toBeFocused();
  await answerBox(page).focus();
  await page.keyboard.type("trap");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(tab(page, 1)).toBeFocused();
  await answerBox(page).focus();
  await page.keyboard.type("peach");
  await page.keyboard.press("Enter");
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("all 3 clues solved without hints");
  await expect(result).toContainText("100 of 100");
});

test("reveal all remaining ends the workshop as revealed", async ({ page }) => {
  await page.goto("/play/cryptic-workshop/cw-e2");
  await answer(page, "canoe");
  await page.getByRole("button", { name: "Reveal all remaining" }).click();
  await page.getByRole("dialog", { name: "Reveal every remaining clue?" }).getByRole("button", { name: "Reveal all remaining" }).click();
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "revealed");
  await expect(result).toContainText("1 of 3 clues solved, 2 revealed.");
  await result.getByText("How it works").click();
  await expect(result).toContainText("KNIGHT sounds like NIGHT");
});

test("@mobile workshop fits a phone and plays", async ({ page }) => {
  await page.goto(DEMO1);
  await expect(page.getByTestId("cw-clue")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: /Next hint/ }).click();
  await answer(page, "silent");
  await expect(page.getByTestId("cw-parse")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
