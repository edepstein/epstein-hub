import { expect, test, type Page } from "@playwright/test";
import { clearProgress, expectNoHorizontalOverflow, feedback } from "./helpers";

const caseCard = (page: Page) => page.getByTestId("active-case");

async function choose(page: Page, text: string) {
  await caseCard(page).getByRole("radio", { name: text, exact: false }).check();
}

async function takeHint(page: Page, label: string, button: "Take hint" | "Reveal" = "Take hint") {
  await page.getByRole("button", { name: "Get a hint" }).click();
  const dialog = page.getByRole("dialog", { name: "A helpful nudge" });
  await dialog.getByRole("listitem").filter({ has: page.getByText(label, { exact: true }) }).getByRole("button", { name: button }).click();
}

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

test("fixture file: neutral retry, definition-only 80, weak evidence revised, refresh restores, complete with no auto-advance", async ({ page }) => {
  await page.goto("/games/definition-detective");
  await page.getByTestId("round-dd-demo-1").click();
  await expect(page.getByRole("heading", { level: 1, name: "Definition Detective" })).toBeVisible();
  await expect(page.getByTestId("sentence")).toContainText("she wanted the promotion but dreaded leaving her team");

  // A definition is required first.
  await choose(page, "wanted the promotion but dreaded leaving her team");
  await page.getByRole("button", { name: "Check definition and evidence" }).click();
  await expect(feedback(page)).toContainText("Choose a definition first");

  // Wrong definition: neutral retry; the option is marked as tried.
  await choose(page, "Feeling completely indifferent");
  await page.getByRole("button", { name: "Check definition and evidence" }).click();
  await expect(feedback(page)).toContainText("does not fit this sentence");
  await expect(feedback(page)).toHaveAttribute("data-ok", "false");
  await expect(caseCard(page)).toContainText("tried, does not fit");

  // Right definition with weak evidence keeps 80.
  await choose(page, "Having conflicting feelings");
  await choose(page, "Nora felt");
  await page.getByRole("button", { name: "Check definition and evidence" }).click();
  await expect(feedback(page)).toContainText("That phrase is weaker support");
  await expect(page.getByTestId("case-score-a")).toHaveText("80");

  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.reload();
  await expect(page.getByTestId("restored-banner")).toBeVisible();
  await expect(page.getByTestId("case-score-a")).toHaveText("80");
  await expect(caseCard(page)).toContainText("✓ correct");

  await choose(page, "wanted the promotion but dreaded leaving her team");
  await page.getByRole("button", { name: "Check evidence" }).click();
  await expect(page.getByTestId("case-score-a")).toHaveText("100");
  await expect(page.getByTestId("learn-more")).toContainText("Learn more");
  // No automatic advance.
  await expect(caseCard(page)).toHaveAttribute("data-case", "a");

  await page.getByRole("button", { name: "Go to case 2" }).click();
  await choose(page, "Make less severe");
  await page.getByRole("button", { name: "Check definition and evidence" }).click();
  await expect(page.getByTestId("case-score-b")).toHaveText("80");
  await page.getByTestId("case-tab-c").click();
  await choose(page, "Showing careful attention to detail");
  await choose(page, "caught even a misplaced comma");
  await page.getByRole("button", { name: "Check definition and evidence" }).click();
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("93 of 100 points");
  await expect(result).toContainText("definition only; evidence still open");
});

test("hint ladder: pointer, rule out with reason, reveal scores 0 and is labelled revealed", async ({ page }) => {
  await page.goto("/play/definition-detective/dd-g1");
  await choose(page, "Eager and quick to volunteer"); // a selection that a hint must not change
  await takeHint(page, "Where to look");
  await expect(feedback(page)).toContainText("What did it take to get Tom to agree?");
  await expect(caseCard(page).getByRole("radio", { name: "Eager and quick to volunteer" })).toBeChecked();
  await takeHint(page, "Rule out a definition");
  await expect(feedback(page)).toContainText("does not fit");
  await expect(caseCard(page)).toContainText("ruled out by a hint");
  await takeHint(page, "Reveal the answer", "Reveal");
  await expect(feedback(page)).toContainText("scores 0");
  await expect(page.getByTestId("case-score-a")).toHaveText("0");
  await expect(page.getByTestId("case-tab-a")).toContainText("revealed");
});

test("keyboard only: rules, choose with arrows and Space, submit with Enter", async ({ page }) => {
  await page.goto("/play/definition-detective/dd-s2");
  await page.getByRole("button", { name: "How to play" }).focus();
  await page.keyboard.press("Enter");
  const rules = page.getByRole("dialog", { name: /How to play Definition Detective/ });
  await expect(rules).toContainText("Right definition: 80 points");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "How to play" })).toBeFocused();

  const target = caseCard(page).getByRole("radio", { name: "Careful not to reveal private information" });
  const first = caseCard(page).locator('input[name="def-a"]').first();
  await first.focus();
  for (let i = 0; i < 4 && !(await target.isChecked()); i++) {
    if (i === 0) await page.keyboard.press("Space");
    else await page.keyboard.press("ArrowDown");
  }
  await expect(target).toBeChecked();
  await page.keyboard.press("Enter");
  await expect(feedback(page)).toContainText("Right definition");
  await expect(page.getByTestId("case-score-a")).toHaveText("80");
});

test("@mobile case card fits a phone and long definitions wrap", async ({ page }) => {
  await page.goto("/play/definition-detective/dd-e1");
  await expect(page.getByTestId("sentence")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await choose(page, "Give official permission for");
  await page.getByRole("button", { name: "Check definition and evidence" }).click();
  await expect(page.getByTestId("case-score-a")).toHaveText("80");
});
