import { expect, test, type Page } from "@playwright/test";
import { clearProgress, expectNoHorizontalOverflow, feedback } from "./helpers";

const input = (page: Page) => page.getByLabel(/Missing word for board/);

async function enter(page: Page, word: string) {
  await input(page).fill(word);
  await input(page).press("Enter");
}

async function takeHint(page: Page, label: string, button: "Take hint" | "Reveal" = "Take hint") {
  await page.getByRole("button", { name: "Get a hint" }).click();
  const dialog = page.getByRole("dialog", { name: "A helpful nudge" });
  await dialog.getByRole("listitem").filter({ has: page.getByText(label, { exact: true }) }).getByRole("button", { name: button }).click();
}

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

test("canonical board: wrong length, whole compound and spaces are explained; LIGHT solves; refresh restores", async ({ page }) => {
  await page.goto("/games/missing-links");
  await page.getByTestId("round-ml-demo-1").click();
  await expect(page.getByRole("heading", { level: 1, name: "Missing Links" })).toBeVisible();
  await expect(page.getByTestId("enumeration")).toHaveText("missing word: 5 letters");
  // Reading order: answer box before the branches, each branch says which side the blank is on.
  const board = page.getByTestId("active-board");
  await expect(board.getByRole("listitem").first()).toContainText("DAY then blank");
  await expect(board.getByRole("listitem").nth(2)).toContainText("Blank before HOUSE");

  await enter(page, "lights");
  await expect(feedback(page)).toContainText("The missing word has 5 letters; LIGHTS has 6.");
  await expect(input(page)).toHaveValue("LIGHTS");

  await enter(page, "lighthouse");
  await expect(feedback(page)).toContainText("Type only the missing word, not the whole compound");

  await enter(page, "li ght");
  await expect(feedback(page)).toContainText("without spaces");

  await enter(page, "green");
  await expect(feedback(page)).toContainText("GREEN");
  await expect(feedback(page)).toHaveAttribute("data-ok", "false");
  await expect(page.getByTestId("guesses")).toContainText("GREEN");
  await expect(page.getByTestId("save-indicator")).toContainText("Saved");

  await page.reload();
  await expect(page.getByTestId("restored-banner")).toBeVisible();
  await expect(page.getByTestId("guesses")).toContainText("GREEN");

  await enter(page, "light");
  await expect(feedback(page)).toContainText("LIGHT is the link: DAYLIGHT, MOONLIGHT and LIGHTHOUSE");
  await expect(page.getByTestId("board-outcome")).toContainText("Solved with LIGHT");
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("100 of 100 points");
  await page.getByTestId("explanation").getByText("View explanation").click();
  await expect(page.getByTestId("explanation")).toContainText("LIGHTHOUSE: A tower with a light to guide ships");
});

test("three-board round: partial fit, which branches failed, hints, reveal, bank tap and an alternate link", async ({ page }) => {
  await page.goto("/play/missing-links/ml-g1");
  // Board 1 is TEA with a visible Gentle bank; tapping a bank word fills the box without submitting.
  await page.getByTestId("word-bank").getByRole("button", { name: "JAM" }).click();
  await expect(input(page)).toHaveValue("JAM");
  await input(page).press("Enter");
  await expect(feedback(page)).toContainText("JAM");
  await page.getByTestId("word-bank").getByRole("button", { name: "TEA" }).click();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("board-outcome")).toContainText("Solved with TEA");
  // No automatic advance: move on explicitly.
  await expect(page.getByTestId("active-board")).toHaveAttribute("data-board", "1");
  await page.getByRole("button", { name: "Go to board 2" }).click();

  await enter(page, "foot");
  await expect(feedback(page)).toContainText("FOOT makes a word in 2 of 3 branches, but the link must complete every branch");
  await page.getByRole("button", { name: "Show which branches failed" }).click();
  await expect(page.getByTestId("guesses")).toContainText("FOOTFLAKE is not a word here");

  await takeHint(page, "First letter");
  await expect(feedback(page)).toContainText("Board 2: the link begins with S.");
  await takeHint(page, "One completed branch");
  await expect(feedback(page)).toContainText("Board 2: ____BALL is SNOWBALL");
  await expect(page.getByTestId("active-board")).toHaveAttribute("data-board", "2");
  await expect(input(page)).toHaveValue("");
  await enter(page, "snow");
  await expect(feedback(page)).toContainText("with help");

  await page.getByTestId("board-tab-3").click();
  await takeHint(page, "Reveal the link", "Reveal");
  await expect(page.getByTestId("board-outcome")).toContainText("Revealed: ACHE");
  const result = page.getByTestId("result-panel");
  await expect(result).toBeVisible();
  await expect(result).toContainText("200 of 300 points");
  await expect(result).toContainText("Board 1: solved after 1 wrong guess, unaided");
  await expect(result).toContainText("Board 2: solved after 1 wrong guess, with 2 hints");
  await expect(result).toContainText("Board 3: revealed (0 points)");
});

test("standard round: hidden bank counts as help; GATE is accepted as an alternative to DOOR", async ({ page }) => {
  await page.goto("/play/missing-links/ml-s2");
  await expect(page.getByTestId("word-bank")).toHaveCount(0);
  await enter(page, "gate");
  await expect(feedback(page)).toContainText("accepted alternative to DOOR");
  await expect(page.getByTestId("board-outcome")).toContainText("Solved with GATE");
  await page.getByTestId("board-tab-2").click();
  await page.getByRole("button", { name: "Show word bank (counts as help)" }).click();
  await expect(page.getByTestId("word-bank")).toBeVisible();
  await expect(feedback(page)).toContainText("marked as helped");
});

test("keyboard only: rules, board switching and solving", async ({ page }) => {
  await page.goto("/play/missing-links/ml-g2");
  await page.getByRole("button", { name: "How to play" }).focus();
  await page.keyboard.press("Enter");
  const rules = page.getByRole("dialog", { name: /How to play Missing Links/ });
  await expect(rules).toContainText("HOUSELIGHT is not LIGHTHOUSE");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "How to play" })).toBeFocused();

  await input(page).focus();
  await page.keyboard.type("rain");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("board-outcome")).toContainText("Solved with RAIN");
  await page.getByTestId("board-tab-2").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("active-board")).toHaveAttribute("data-board", "2");
  await input(page).focus();
  await page.keyboard.type("birth");
  await page.keyboard.press("Escape");
  await expect(input(page)).toHaveValue("");
  await page.keyboard.type("birth");
  await page.keyboard.press("Enter");
  await page.getByTestId("board-tab-3").focus();
  await page.keyboard.press("Enter");
  await input(page).focus();
  await page.keyboard.type("horse");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("result-panel")).toContainText("All 3 links solved unaided.");
});

test("@mobile bridge boards stack on a phone", async ({ page }) => {
  await page.goto("/play/missing-links/ml-e1");
  await expect(input(page)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await enter(page, "mother");
  await expect(page.getByTestId("board-outcome")).toContainText("Solved with MOTHER");
});

test("master round: loads with four branches per board, a wrong link is explained, all three boards solve", async ({ page }) => {
  await page.goto("/games/missing-links");
  await page.getByTestId("round-ml-m1").click();
  await expect(page.getByTestId("active-board").getByRole("listitem")).toHaveCount(4);
  await expect(page.getByTestId("enumeration")).toHaveText("missing word: 6 letters");
  await enter(page, "master");
  await expect(feedback(page)).toHaveAttribute("data-ok", "false");
  await enter(page, "wright");
  await expect(page.getByTestId("board-outcome")).toContainText("Solved with WRIGHT");
  await page.getByTestId("board-tab-2").click();
  await enter(page, "monger");
  await expect(page.getByTestId("board-outcome")).toContainText("Solved with MONGER");
  await page.getByTestId("board-tab-3").click();
  await enter(page, "hood");
  await expect(page.getByTestId("result-panel")).toHaveAttribute("data-outcome", "completed");
});
