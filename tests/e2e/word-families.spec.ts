import { expect, test, type Page } from "@playwright/test";
import { clearProgress, expectNoHorizontalOverflow, feedback } from "./helpers";

const tile = (page: Page, label: string) => page.getByTestId("wf-board").getByRole("button", { name: label, exact: true });

async function pick(page: Page, labels: string[]) {
  for (const l of labels) await tile(page, l).click();
}

async function check(page: Page) {
  await page.getByRole("button", { name: "Check group" }).click();
}

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

test("select, wrong and repeated groups, one away, solve, refresh restores, hint, complete", async ({ page }) => {
  await page.goto("/games/word-families");
  await page.getByTestId("round-wf-demo-1").click();
  await expect(page.getByRole("heading", { level: 1, name: "Word Families" })).toBeVisible();
  await expect(page.getByTestId("wf-board").getByRole("button")).toHaveCount(16);

  // Underfilled selection: no mistake, selection kept.
  await pick(page, ["ROBIN", "CRANE", "EAGLE"]);
  await expect(page.getByTestId("selection-count")).toHaveText("3 of 4 selected");
  await check(page);
  await expect(feedback(page)).toContainText("you have selected 3");
  await expect(page.getByTestId("mistakes")).toContainText("0 of 4");
  await expect(tile(page, "ROBIN")).toHaveAttribute("aria-pressed", "true");

  // A fifth tile is refused with a reason.
  await pick(page, ["OPAL", "SAGE"]);
  await expect(feedback(page)).toContainText("already have 4 tiles selected");
  await expect(tile(page, "SAGE")).toHaveAttribute("aria-pressed", "false");

  // One away (three birds + OPAL) costs one mistake and keeps the selection.
  await check(page);
  await expect(feedback(page)).toContainText("One away");
  await expect(page.getByTestId("mistakes")).toContainText("1 of 4");
  await expect(tile(page, "OPAL")).toHaveAttribute("aria-pressed", "true");

  // The same group again costs nothing.
  await check(page);
  await expect(feedback(page)).toContainText("tried this group");
  await expect(page.getByTestId("mistakes")).toContainText("1 of 4");
  await expect(page.getByTestId("tried-list")).toContainText("OPAL");

  // Deselect OPAL, add SWAN: correct.
  await tile(page, "OPAL").click();
  await tile(page, "SWAN").click();
  await check(page);
  await expect(feedback(page)).toContainText("Correct: Birds");
  const solved = page.getByTestId("solved-groups");
  await expect(solved).toContainText("Birds");
  await expect(solved).toContainText("CRANE is also a lifting machine");
  await expect(page.getByTestId("wf-board").getByRole("button")).toHaveCount(12);
  await expect(page.getByTestId("groups-progress")).toHaveText("1 of 4 groups");

  // Shuffle keeps the selection.
  await pick(page, ["FLUTE", "OBOE"]);
  await page.getByRole("button", { name: "Shuffle" }).click();
  await expect(feedback(page)).toContainText("selection and solved groups are unchanged");
  await expect(tile(page, "FLUTE")).toHaveAttribute("aria-pressed", "true");

  // Refresh mid-round: solved group, mistakes and selection are restored.
  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.reload();
  await expect(page.getByTestId("restored-banner")).toBeVisible();
  await expect(page.getByTestId("solved-groups")).toContainText("Birds");
  await expect(page.getByTestId("mistakes")).toContainText("1 of 4");
  await expect(tile(page, "FLUTE")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("selection-count")).toHaveText("2 of 4 selected");

  // Hint: names a category for an unsolved group.
  await page.getByRole("button", { name: "Get a hint" }).click();
  const dialog = page.getByRole("dialog", { name: "A helpful nudge" });
  await dialog.getByRole("listitem").filter({ has: page.getByText("Name a category", { exact: true }) }).getByRole("button", { name: "Take hint" }).click();
  await expect(feedback(page)).toContainText("One group is: Musical instruments.");
  await expect(page.getByTestId("hints-used")).toHaveText("1");

  await pick(page, ["CELLO", "HARP"]);
  await check(page);
  await pick(page, ["RUBY", "OPAL", "PEARL", "JADE"]);
  await check(page);
  await pick(page, ["BASIL", "THYME", "SAGE", "MINT"]);
  await check(page);

  const result = page.getByTestId("result-panel");
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("All 4 groups solved");
  await expect(result).toContainText("1 hint · 0 reveals");
  await expect(result).toContainText("1 mistake");
});

test("keyboard only: arrows move, Space selects, Enter checks, Escape clears", async ({ page }) => {
  await page.goto("/play/word-families/wf-g1");
  const board = page.getByTestId("wf-board");
  await expect(board.getByRole("button")).toHaveCount(12);
  // Tab into the board (single tab stop), from the Shuffle-free toolbar region.
  await page.getByRole("button", { name: "How to play" }).focus();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => document.activeElement?.classList.contains("wf-tile"))) break;
  }
  const focusedLabel = () => page.evaluate(() => document.activeElement?.textContent?.replace("✓", "").trim() ?? "");

  async function selectByKeys(targets: string[]) {
    // Walk the whole board with ArrowRight/Home, pressing Space on each target.
    await page.keyboard.press("Home");
    const count = await board.getByRole("button").count();
    for (let i = 0; i < count; i++) {
      if (targets.includes(await focusedLabel())) await page.keyboard.press("Space");
      await page.keyboard.press("ArrowRight");
    }
  }

  await selectByKeys(["COW", "SHEEP"]);
  await expect(page.getByTestId("selection-count")).toHaveText("2 of 4 selected");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("selection-count")).toHaveText("0 of 4 selected");

  await selectByKeys(["COW", "SHEEP", "PIG", "GOAT"]);
  await page.keyboard.press("Enter");
  await expect(feedback(page)).toContainText("Correct: Farm animals");
  // Focus returns to the board.
  await expect(page.locator(".wf-tile:focus")).toHaveCount(1);

  await selectByKeys(["WHISK", "LADLE", "SPATULA", "COLANDER"]);
  await page.keyboard.press("Enter");
  await expect(feedback(page)).toContainText("Correct: Kitchen utensils");
  await selectByKeys(["APPLE", "PEAR", "PLUM", "CHERRY"]);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("result-panel")).toContainText("All 3 groups solved without a mistake");
});

test("using every mistake offers continue; reveal answers ends as revealed", async ({ page }) => {
  await page.goto("/play/word-families/wf-s1");
  const wrong = [
    ["FOOT", "SNAP", "THAMES", "NEEDLE"],
    ["SNOW", "POKER", "SEVERN", "THREAD"],
    ["BASKET", "BRIDGE", "TRENT", "THIMBLE"],
    ["MEAT", "RUMMY", "MERSEY", "PIN"],
  ];
  for (const w of wrong) {
    await pick(page, w);
    await check(page);
    await page.getByRole("button", { name: "Clear selection" }).click();
  }
  await expect(page.getByTestId("mistakes")).toContainText("4 of 4");
  const panel = page.getByTestId("budget-panel");
  await expect(panel).toBeVisible();
  await expect(page.getByRole("button", { name: "Check group" })).toBeDisabled();
  await panel.getByRole("button", { name: "Continue" }).click();
  await expect(feedback(page)).toContainText("assisted continuation");
  await expect(panel).toBeHidden();

  await pick(page, ["FOOT", "SNOW", "BASKET", "MEAT"]);
  await check(page);
  await expect(page.getByTestId("solved-groups")).toContainText("Words before BALL");

  await page.getByRole("toolbar", { name: "Game tools" }).getByRole("button", { name: "Reveal answers" }).click();
  const confirm = page.getByRole("dialog", { name: "Reveal every remaining group?" });
  await confirm.getByRole("button", { name: "Reveal answers" }).click();
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "revealed");
  await expect(result).toContainText("You found 1 of 4 groups");
  await expect(page.getByTestId("solved-groups")).toContainText("In a sewing kit");
  await expect(page.getByTestId("solved-groups").getByText("Revealed")).toHaveCount(3);
});

test("@mobile the longest real terms stay readable inside their tiles at phone width", async ({ page }) => {
  // wf-e2 has GRAPEFRUIT/MOUSTACHE/SIDEBURNS/TANGERINE; wf-e4 PREMOLAR/FREIGHT; wf-g1 COLANDER; wf-demo-2 FULL STOP.
  for (const id of ["wf-e4", "wf-g1", "wf-demo-2", "wf-e2"]) {
    await page.goto(`/play/word-families/${id}`);
    const board = page.getByTestId("wf-board");
    await expect(board.getByRole("button").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const problems = await board.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>("button.wf-tile")]
        .map((b) => {
          const label = b.querySelector<HTMLElement>(".wf-label")!;
          const fs = parseFloat(getComputedStyle(b).fontSize);
          const r = b.getBoundingClientRect();
          return { text: label.textContent, over: label.scrollWidth > b.clientWidth, fs, h: r.height, w: r.width };
        })
        .filter((x) => x.over || x.fs < 11 || x.h < 44 || x.w < 44),
    );
    expect(problems, id).toEqual([]);
  }
  await page.screenshot({ path: "test-results/word-families-mobile-long.png", fullPage: true });
  await tile(page, "MOUSTACHE").click();
  await expect(tile(page, "MOUSTACHE")).toHaveAttribute("aria-pressed", "true");
});

test("@mobile demo board with FULL STOP fits and plays", async ({ page }) => {
  await page.goto("/play/word-families/wf-demo-2");
  await expectNoHorizontalOverflow(page);
  await pick(page, ["COMMA", "COLON", "DASH", "FULL STOP"]);
  await check(page);
  await expect(page.getByTestId("solved-groups")).toContainText("Punctuation marks");
});
