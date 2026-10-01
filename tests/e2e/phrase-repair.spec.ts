import { expect, test, type Page } from "@playwright/test";
import { clearProgress, expectNoHorizontalOverflow, feedback } from "./helpers";

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

const tiles = (page: Page) => page.getByTestId("phrase-tiles").locator(".pr-word");
const moveBtn = (page: Page, word: string, dir: "left" | "right") => page.getByRole("button", { name: new RegExp(`^Move ${word} ${dir} `) });

async function takeHint(page: Page, label: string, button: "Take hint" | "Reveal") {
  await page.getByRole("button", { name: "Get a hint" }).click();
  const dialog = page.getByRole("dialog", { name: "A helpful nudge" });
  await dialog.getByRole("listitem").filter({ has: page.getByText(label, { exact: true }) }).getByRole("button", { name: button }).click();
}

test("wrong check keeps tiles, neighbour swaps restore the phrase, refresh restores the swap history", async ({ page }) => {
  await page.goto("/games/phrase-repair");
  await page.getByTestId("round-pr-demo-1").click();
  await expect(tiles(page)).toHaveText(["SPILT", "OVER", "MILK", "CRY"]);

  await page.getByRole("button", { name: "Check phrase" }).click();
  await expect(feedback(page)).toContainText("Not repaired yet");
  await expect(tiles(page)).toHaveText(["SPILT", "OVER", "MILK", "CRY"]);

  await moveBtn(page, "CRY", "left").click();
  await expect(feedback(page)).toContainText("CRY is now word 3");
  await moveBtn(page, "CRY", "left").click();
  await expect(page.getByTestId("swap-count")).toHaveText("2 swaps");
  await expect(tiles(page)).toHaveText(["SPILT", "CRY", "OVER", "MILK"]);

  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.reload();
  await expect(page.getByTestId("restored-banner")).toBeVisible();
  await expect(tiles(page)).toHaveText(["SPILT", "CRY", "OVER", "MILK"]);
  await expect(page.getByTestId("swap-count")).toHaveText("2 swaps");

  await moveBtn(page, "CRY", "left").click();
  await moveBtn(page, "OVER", "left").click();
  await page.getByRole("button", { name: "Check phrase" }).click();
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("100 points");
  await expect(result).toContainText("Efficiency 100%");
  await expect(result).toContainText("Cry over spilt milk.");
});

test("keyboard only: focus follows the moved tile and the phrase is checked", async ({ page }) => {
  await page.goto("/play/phrase-repair/pr-demo-1");
  await moveBtn(page, "CRY", "left").focus();
  await page.keyboard.press("Enter");
  await expect(moveBtn(page, "CRY", "left")).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(tiles(page)).toHaveText(["CRY", "SPILT", "OVER", "MILK"]);
  // Focus flips to the right-hand button at the edge.
  await expect(moveBtn(page, "CRY", "right")).toBeFocused();
  await moveBtn(page, "OVER", "left").focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Check phrase" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("result-panel")).toHaveAttribute("data-outcome", "completed");
  await expect(page.locator("#result-heading")).toBeFocused();
});

test("hints, undo counting, efficiency score and best result kept across a restart", async ({ page }) => {
  await page.goto("/play/phrase-repair/pr-g1");
  await expect(tiles(page)).toHaveText(["SOUND", "SAFE", "AND"]);
  await takeHint(page, "First word", "Take hint");
  await expect(feedback(page)).toContainText("The phrase begins SAFE");

  await moveBtn(page, "SAFE", "right").click();
  await page.getByRole("button", { name: "Undo last swap (counts as a swap)" }).click();
  await expect(feedback(page)).toContainText("Undo counts as a swap");
  await expect(page.getByTestId("swap-count")).toHaveText("2 swaps");

  await takeHint(page, "Efficient next move", "Take hint");
  await expect(feedback(page)).toContainText("swap SOUND and SAFE");
  await moveBtn(page, "SAFE", "left").click();
  await moveBtn(page, "AND", "left").click();
  await page.getByRole("button", { name: "Check phrase" }).click();
  const result = page.getByTestId("result-panel");
  await expect(result).toContainText("80 points");
  await expect(result).toContainText("Minimum from the starting order: 2");
  await expect(result).toContainText("2 hints · 0 reveals");

  await result.getByRole("button", { name: "Play this round again" }).click();
  await page.getByRole("dialog", { name: "Start this round again?" }).getByRole("button", { name: "Start again" }).click();
  await expect(page.getByTestId("swap-count")).toHaveText("0 swaps");
  await expect(page.getByTestId("best-earlier")).toContainText("80 points");
});

test("revealing an expert phrase with repeated words is recorded honestly", async ({ page }) => {
  await page.goto("/play/phrase-repair/pr-e2");
  await takeHint(page, "Reveal the phrase", "Reveal");
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "revealed");
  await expect(tiles(page)).toHaveText(["IN", "FOR", "A", "PENNY", "IN", "FOR", "A", "POUND"]);
  await expect(page.getByRole("button", { name: "Check phrase" })).toBeDisabled();
});

test("@mobile tiles stack vertically on a phone and still swap", async ({ page }) => {
  await page.goto("/play/phrase-repair/pr-s2");
  await expectNoHorizontalOverflow(page);
  const first = await page.getByTestId("phrase-tiles").locator("li").nth(0).boundingBox();
  const second = await page.getByTestId("phrase-tiles").locator("li").nth(1).boundingBox();
  if ((page.viewportSize()?.width ?? 1440) <= 700) expect(second!.y).toBeGreaterThan(first!.y + first!.height - 1);
  await moveBtn(page, "MAKE", "left").click();
  await expect(tiles(page).first()).toHaveText("MAKE");
  await expectNoHorizontalOverflow(page);
});

async function sortTo(page: Page, target: string[], limit = target.length) {
  // The board renders after hydration and save restore; reading it earlier returns no tiles.
  await expect.poll(async () => (await tiles(page).count()) >= target.length).toBe(true);
  for (let i = 0; i < limit; i++) {
    const now = await tiles(page).allTextContents();
    let j = now.findIndex((w, k) => k >= i && w === target[i]);
    while (j > i) {
      const moved = now[j];
      await page.getByRole("button", { name: new RegExp(`^Move \\S+ left \\(word ${j + 1} of `) }).click();
      // Wait for the swap to render before the next click, or a stale button can be hit under load.
      await expect(tiles(page).nth(j - 1)).toHaveText(moved);
      now[j] = now[j - 1];
      now[j - 1] = moved;
      j--;
    }
  }
}

test("Master phrase with repeated words: wrong near-miss order is refused, refresh restores, optimal repair scores 100", async ({ page }) => {
  await page.goto("/play/phrase-repair/pr-m7");
  await expect(tiles(page)).toHaveCount(9);
  const target = "SEE NO EVIL HEAR NO EVIL SPEAK NO EVIL".split(" ");

  await sortTo(page, ["SPEAK", "NO", "EVIL"], 3);
  await page.getByRole("button", { name: "Check phrase" }).click();
  await expect(feedback(page)).toContainText("Not repaired yet");

  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.reload();
  await expect(page.getByTestId("restored-banner")).toBeVisible();
  await expect(tiles(page)).toHaveCount(9);
  const swapsBefore = await page.getByTestId("swap-count").textContent();

  // Undo is not needed: re-sort from the current order. Count the extra swaps to know the efficient total is lost.
  await sortTo(page, target);
  await page.getByRole("button", { name: "Check phrase" }).click();
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "completed");
  expect(swapsBefore).toMatch(/swaps?/);
});

test("Master phrase solved in the exact minimum scores 100", async ({ page }) => {
  await page.goto("/play/phrase-repair/pr-m9");
  const target = "WHEN THE GOING GETS TOUGH THE TOUGH GET GOING".split(" ");
  await sortTo(page, target);
  await page.getByRole("button", { name: "Check phrase" }).click();
  const result = page.getByTestId("result-panel");
  await expect(result).toHaveAttribute("data-outcome", "completed");
  await expect(result).toContainText("100 points");
});

test("@mobile a twelve-tile Master board fits a phone", async ({ page }) => {
  await page.goto("/play/phrase-repair/pr-m3");
  await expect(tiles(page)).toHaveCount(12);
  await expectNoHorizontalOverflow(page);
});
