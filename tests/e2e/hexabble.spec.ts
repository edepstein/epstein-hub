import { expect, test, type Page } from "@playwright/test";
import { tileById } from "../../src/games/hexabble/engine/tiles";
import { clearProgress, expectNoHorizontalOverflow, feedback } from "./helpers";

const ROUTE = "/play/hexabble/match";
const KEY = "wc:v1:match:hexabble";

type Snap = {
  state: { current: number; bag: string[]; players: { name: string; rack: string[]; score: number }[]; history: unknown[] };
  draft: { placements: unknown[]; selected: string | null };
};

async function readSnap(page: Page): Promise<Snap | null> {
  return page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, KEY);
}

/**
 * Test-only: rearrange the saved match so the active player's rack starts with `tokens`
 * (letters, or "*" for a Wild), swapping with the bag/other racks so every tile stays unique.
 * Then reload, which also exercises restore.
 */
async function rigRack(page: Page, tokens: string) {
  await expect.poll(async () => (await readSnap(page)) !== null).toBe(true);
  const snap = (await readSnap(page))!;
  const s = snap.state;
  const rack = s.players[s.current].rack;
  const matches = (id: string, tok: string) => {
    const t = tileById(id)!;
    return tok === "*" ? t.kind === "wild" : t.kind === "letter" && t.letter === tok;
  };
  [...tokens].forEach((tok, i) => {
    if (matches(rack[i], tok)) return;
    const inRack = rack.findIndex((id, j) => j > i && matches(id, tok));
    if (inRack > i) {
      [rack[i], rack[inRack]] = [rack[inRack], rack[i]];
      return;
    }
    const pools = [s.bag, ...s.players.filter((_, p) => p !== s.current).map((p) => p.rack)];
    for (const pool of pools) {
      const j = pool.findIndex((id) => matches(id, tok));
      if (j >= 0) {
        [rack[i], pool[j]] = [pool[j], rack[i]];
        return;
      }
    }
    throw new Error(`No ${tok} tile available`);
  });
  snap.draft = { placements: [], selected: null };
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(snap)] as const);
  await page.reload();
  await expect(page.getByTestId("hx-restored")).toBeVisible();
}

async function startMatch(page: Page, names: string[], mode: "Friendly" | "Challenge" = "Friendly") {
  await page.goto(ROUTE);
  await expect(page.getByTestId("hx-setup")).toBeVisible();
  if (names.length !== 2) await page.getByRole("button", { name: `${names.length} players` }).click();
  for (const [i, n] of names.entries()) await page.getByLabel(`Player ${i + 1} name`).fill(n);
  await page.getByRole("radio", { name: new RegExp(`${mode} checking`) }).check();
  await page.getByRole("button", { name: "Start match" }).click();
  await expect(page.getByTestId("hx-handover")).toBeVisible();
}

async function reveal(page: Page, name: string) {
  await page.getByRole("button", { name: `Show ${name}'s tiles` }).click();
  await expect(page.getByTestId("hx-rack")).toBeVisible();
}

const rackTile = (page: Page, letter: string) => page.getByTestId("hx-rack").getByRole("button", { name: new RegExp(`^${letter},`) }).first();
const cell = (page: Page, q: number, r: number) => page.locator(`[data-cell="${q},${r}"]`);

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

test("keyboard-only legal opening scores, records history and hands over", async ({ page }) => {
  await startMatch(page, ["Mum", "Ed"]);
  await rigRack(page, "CAT");
  await expect(page.getByTestId("hx-handover")).toContainText("Mum's turn");
  await page.getByRole("button", { name: "Show Mum's tiles" }).press("Enter");
  await expect(rackTile(page, "C")).toBeFocused();

  // Select C with the keyboard: focus jumps to the centre space; Enter places it.
  await rackTile(page, "C").press("Enter");
  await expect(cell(page, 0, 0)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(cell(page, 0, 0)).toHaveAttribute("aria-label", /unsubmitted tile C/);
  // Move down and type letters to place matching rack tiles.
  await page.keyboard.press("ArrowDown");
  await expect(cell(page, 0, 1)).toBeFocused();
  await page.keyboard.press("a");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("t");
  await expect(page.getByTestId("hx-preview")).toContainText("CAT");
  await expect(page.getByTestId("hx-preview-total")).toContainText("10");
  await expect(page.getByTestId("hx-preview")).toContainText("✓ valid");

  await page.getByTestId("hx-place").focus();
  await page.keyboard.press("Enter");
  await expect(feedback(page)).toContainText("Mum scored 10");
  await expect(page.getByTestId("hx-handover")).toContainText("Ed's turn");
  await expect(page.getByTestId("hx-handover")).toContainText("Mum scored 10 (CAT)");
  await reveal(page, "Ed");
  await expect(page.getByTestId("hx-score-0")).toHaveText("10");
  await expect(page.getByTestId("hx-history")).toContainText("Mum scored 10: CAT 10");
  await expect(cell(page, 0, 1)).toHaveAttribute("aria-label", /placed tile A/);
  await expect(page.getByTestId("hx-bag")).toContainText("91");

  // The Library lists the match.
  await page.goto("/library");
  await expect(page.getByText("Local match: Mum v Ed")).toBeVisible();
});

test("click placement, Friendly rejection keeps state, and a Wild face chosen in a dialog", async ({ page }) => {
  await startMatch(page, ["Ann", "Bob"]);
  await rigRack(page, "CT*A");
  await reveal(page, "Ann");

  // Invalid: CT down from the centre.
  await rackTile(page, "C").click();
  await cell(page, 0, 0).click();
  await rackTile(page, "T").click();
  await cell(page, 0, 1).click();
  await expect(page.getByTestId("hx-preview")).toContainText("not in the word list");
  await page.getByTestId("hx-place").click();
  await expect(feedback(page)).toContainText('"CT" is not in the word list');
  await expect(page.getByTestId("hx-score-0")).toHaveText("0");
  await expect(page.getByTestId("hx-turn")).toContainText("Ann");
  await expect(cell(page, 0, 1)).toHaveAttribute("aria-label", /unsubmitted tile T/);

  // Revise: return T by selecting it on the board, then add a Wild as A and T below.
  await cell(page, 0, 1).click();
  await expect(cell(page, 0, 1)).toHaveAttribute("aria-label", /empty/);
  await page.getByTestId("hx-rack").getByRole("button", { name: /^Wild tile/ }).click();
  await cell(page, 0, 1).click();
  const dialog = page.getByRole("dialog", { name: /Choose a letter for your Wild tile/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "A", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await rackTile(page, "T").click();
  await cell(page, 0, 2).click();
  await expect(page.getByTestId("hx-preview-total")).toContainText("8"); // (3 + 0 + 1) x 2
  await page.getByTestId("hx-place").click();
  await expect(feedback(page)).toContainText("Ann scored 8");
  await reveal(page, "Bob");
  await expect(page.getByTestId("hx-score-0")).toHaveText("8");
  await expect(cell(page, 0, 1)).toHaveAttribute("aria-label", /placed tile A \(Wild/);
});

test("exchange and pass use the turn and appear in history", async ({ page }) => {
  await startMatch(page, ["Mum", "Ed"]);
  await reveal(page, "Mum");
  await page.getByRole("button", { name: "Exchange tiles" }).click();
  const dialog = page.getByRole("dialog", { name: "Exchange tiles" });
  const tiles = dialog.getByRole("group", { name: "Tiles to exchange" }).getByRole("button");
  await tiles.nth(0).click();
  await tiles.nth(1).press("Enter");
  await expect(tiles.nth(1)).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Exchange 2 tiles" }).click();
  await expect(feedback(page)).toContainText("Mum exchanged 2 tiles");
  await reveal(page, "Ed");
  await expect(page.getByTestId("hx-bag")).toContainText("94");
  await page.getByRole("button", { name: "Pass turn" }).click();
  await page.getByRole("dialog", { name: "Pass this turn?" }).getByRole("button", { name: "Pass" }).click();
  await expect(feedback(page)).toContainText("Ed passed");
  await reveal(page, "Mum");
  await expect(page.getByTestId("hx-history")).toContainText("Ed passed");
  await expect(page.getByTestId("hx-history")).toContainText("Mum exchanged 2 tiles");
});

test("Challenge checking: preview hides validity and an invalid word loses the turn", async ({ page }) => {
  await startMatch(page, ["Mum", "Ed"], "Challenge");
  await rigRack(page, "CT");
  await reveal(page, "Mum");
  await rackTile(page, "C").click();
  await cell(page, 0, 0).click();
  await rackTile(page, "T").click();
  await cell(page, 0, 1).click();
  await expect(page.getByTestId("hx-preview")).toContainText("Projected score");
  await expect(page.getByTestId("hx-preview")).not.toContainText("not in the word list");
  await page.getByTestId("hx-place").click();
  await expect(feedback(page)).toContainText("Challenge upheld");
  await expect(page.getByTestId("hx-handover")).toContainText("Mum's word was not allowed");
  await reveal(page, "Ed");
  await expect(page.getByTestId("hx-history")).toContainText("Mum lost the turn. Not allowed: CT");
});

test("refresh mid-move restores the match exactly, including unsubmitted tiles", async ({ page }) => {
  await startMatch(page, ["Mum", "Ed"]);
  await rigRack(page, "CAT");
  await reveal(page, "Mum");
  await rackTile(page, "C").click();
  await cell(page, 0, 0).click();
  await rackTile(page, "A").click();
  await cell(page, 0, 1).click();
  await expect.poll(async () => (await readSnap(page))?.draft.placements.length).toBe(2);
  await expect(page.getByTestId("save-indicator")).toContainText("Saved on this device");
  const before = (await readSnap(page))!.state;

  await page.reload();
  await expect(page.getByTestId("hx-restored")).toBeVisible();
  await expect(page.getByTestId("hx-handover")).toBeVisible(); // rack hidden again after reload
  await reveal(page, "Mum");
  await expect(cell(page, 0, 0)).toHaveAttribute("aria-label", /unsubmitted tile C/);
  await expect(cell(page, 0, 1)).toHaveAttribute("aria-label", /unsubmitted tile A/);
  await expect(rackTile(page, "T")).toBeVisible();
  expect((await readSnap(page))!.state).toEqual(before);
  await rackTile(page, "T").click();
  await cell(page, 0, 2).click();
  await page.getByTestId("hx-place").click();
  await expect(feedback(page)).toContainText("Mum scored 10");
});

test("a corrupt save is set aside with an explanation and a new match can start", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((k) => localStorage.setItem(k, "{not json"), KEY);
  await page.goto(ROUTE);
  await expect(page.getByTestId("hx-corrupt")).toContainText("could not be restored");
  await expect(page.getByTestId("hx-corrupt")).toContainText("set aside");
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.some((k) => k.startsWith("wc:v1:corrupt:wc:v1:match:hexabble"))).toBe(true);
  expect(keys).not.toContain(KEY);

  // A well-formed but impossible snapshot (duplicated tile) is also refused.
  await startMatch(page, ["Mum", "Ed"]);
  await expect.poll(async () => (await readSnap(page)) !== null).toBe(true);
  const snap = (await readSnap(page))!;
  snap.state.bag.push(snap.state.players[0].rack[0]);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(snap)] as const);
  await page.reload();
  await expect(page.getByTestId("hx-corrupt")).toContainText("Tiles are missing or duplicated");
  await page.getByRole("button", { name: "Start match" }).click();
  await expect(page.getByTestId("hx-handover")).toBeVisible();
});

test("ending the match shows the final result, which survives a refresh", async ({ page }) => {
  await startMatch(page, ["Mum", "Ed"]);
  await rigRack(page, "CAT");
  await reveal(page, "Mum");
  for (const [l, r] of [["C", 0], ["A", 1], ["T", 2]] as const) {
    await rackTile(page, l).click();
    await cell(page, 0, r).click();
  }
  await page.getByTestId("hx-place").click();
  await reveal(page, "Ed");
  await page.getByRole("button", { name: "End game" }).click();
  await page.getByRole("dialog", { name: "End the match now?" }).getByRole("button", { name: "End the match" }).click();
  const results = page.getByTestId("hx-results");
  await expect(results).toContainText("Final result: Mum wins");
  await expect(results.getByRole("row", { name: /Mum/ })).toContainText("10");
  await expect(page.getByTestId("hx-turn")).toContainText("Match over");
  await expect(page.getByTestId("hx-history")).toContainText("Match over. The players agreed to end the match.");

  await page.reload();
  await expect(page.getByTestId("hx-restored")).toContainText("finished match");
  await expect(page.getByTestId("hx-results")).toContainText("Final result: Mum wins");
  await page.goto("/library");
  await expect(page.getByText(/Local match: Mum v Ed/)).toBeVisible();
});

test("New match never silently replaces the saved match", async ({ page }) => {
  await startMatch(page, ["Mum", "Ed"]);
  await rigRack(page, "CAT");
  await reveal(page, "Mum");
  await page.getByRole("button", { name: "New match" }).click();
  await expect(page.getByTestId("hx-setup")).toBeVisible();
  await page.getByLabel("Player 1 name").fill("Gran");
  await page.getByRole("button", { name: "Start match" }).click();
  const confirm = page.getByRole("dialog", { name: "Replace the saved match?" });
  await expect(confirm).toContainText("cannot be recovered");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  expect((await readSnap(page))!.state.players[0].name).toBe("Mum");
  await page.getByRole("button", { name: "Back to the saved match" }).click();
  await expect(page.getByTestId("hx-turn")).toContainText("Mum");

  await page.getByRole("button", { name: "New match" }).click();
  await page.getByLabel("Player 1 name").fill("Gran");
  await page.getByRole("button", { name: "Start match" }).click();
  await page.getByRole("dialog", { name: "Replace the saved match?" }).getByRole("button", { name: "Start the new match" }).click();
  await expect(page.getByTestId("hx-handover")).toContainText("Gran's turn");
  await expect.poll(async () => (await readSnap(page))?.state.players[0].name).toBe("Gran");
});

test("@mobile readable board scrolls in its own viewport at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startMatch(page, ["Mum", "Ed"]);
  await rigRack(page, "CAT");
  await reveal(page, "Mum");
  await expect(page.getByRole("button", { name: "Readable" })).toHaveAttribute("aria-pressed", "true");
  await expectNoHorizontalOverflow(page);
  const vp = page.getByTestId("hx-viewport");
  const dims = await vp.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, sl: el.scrollLeft, w: el.getBoundingClientRect().width }));
  expect(dims.sw).toBeGreaterThan(dims.cw);
  expect(dims.sl).toBeGreaterThan(0); // centred on the start space
  expect(dims.w).toBeLessThanOrEqual(390);
  // The centre cell is large enough to tap and visible without page-level panning.
  const box = (await cell(page, 0, 0).boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);

  for (const [l, r] of [["C", 0], ["A", 1], ["T", 2]] as const) {
    await rackTile(page, l).click();
    await cell(page, 0, r).click();
  }
  await page.getByTestId("hx-place").click();
  await expect(feedback(page)).toContainText("Mum scored 10");
  await expectNoHorizontalOverflow(page);

  await reveal(page, "Ed");
  await page.getByRole("button", { name: "Fit" }).click();
  const fit = await vp.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
  expect(fit.sw).toBeLessThanOrEqual(fit.cw + 1);
  await expectNoHorizontalOverflow(page);
});
