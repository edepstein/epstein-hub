import { expect, test, type Page } from "@playwright/test";
import { clearProgress, expectNoHorizontalOverflow, feedback } from "./helpers";
import { analysePlacement, commit, createMatch, type MatchState, type MoveAction, type Placement } from "../../src/games/shared-word-board/engine";
import { newEnvelope, withRequest, type MatchEnvelope } from "../../src/games/shared-word-board/snapshot";
import type { RulesVersion } from "../../src/games/shared-word-board/rules";
import { MEMBERSHIP_VERSION } from "../../src/lib/dictionary";
import { loadFamiliarSync, loadMembershipSync } from "../../src/lib/dictionary/node";

const URL = "/play/shared-word-board/match";
const KEY = "wc:v1:match:shared-word-board";
const membership = loadMembershipSync();
const familiar = [...loadFamiliarSync()].filter((w) => membership.has(w));

/* ---------------- Node-side match building (same pure engine as the page) ---------------- */

interface Crafted {
  env: MatchEnvelope;
  state: MatchState;
}

function craft(rulesVersion: RulesVersion, seed: number, names = ["Ann", "Ben"]): Crafted {
  const c = createMatch({ rulesVersion, dictionaryVersion: MEMBERSHIP_VERSION, players: names.map((name) => ({ name })), seed });
  if (!c.ok) throw new Error(c.message);
  const env = newEnvelope({ matchId: `match_e2e_${seed}`, rulesVersion, dictionaryVersion: MEMBERSHIP_VERSION, players: names.map((name) => ({ name })), seed, now: "2026-09-30T10:00:00.000Z" });
  return { env, state: c.state };
}

let seq = 0;
function apply(m: Crafted, action: MoveAction): Crafted {
  const req = { actionId: `e2e-${++seq}`, expectedVersion: m.state.version, action };
  const r = commit(m.state, req, membership);
  if (r.status !== "accepted") throw new Error(`${r.code}: ${r.message}`);
  return { state: r.state, env: withRequest(m.env, req, "2026-09-30T10:01:00.000Z") };
}

const lettersOf = (s: MatchState, seat: number) => s.racks[seat].map((id) => s.tiles[id].letter);

/** A familiar word of 3-5 letters spelt from rack letters only (no blanks). */
function wordFrom(letters: (string | null)[], min = 3, max = 5): string | null {
  const pool = letters.filter((l): l is string => !!l);
  const candidates = familiar.filter((w) => w.length >= min && w.length <= max).sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
  for (const w of candidates) {
    const p = pool.slice();
    if ([...w].every((ch) => {
      const i = p.indexOf(ch);
      if (i < 0) return false;
      p.splice(i, 1);
      return true;
    }))
      return w;
  }
  return null;
}

function placementsFor(s: MatchState, seat: number, word: string, row: number, col: number, dir: "across" | "down" = "across"): Placement[] {
  const avail = s.racks[seat].slice();
  return [...word].map((ch, i) => {
    const idx = avail.findIndex((id) => s.tiles[id].letter === ch);
    const tileId = avail.splice(idx, 1)[0];
    return dir === "across" ? { tileId, row, column: col + i } : { tileId, row: row + i, column: col };
  });
}

/** Seed whose first player can open with a word across the centre. */
function openingMatch(rulesVersion: RulesVersion, from = 1): { m: Crafted; word: string } {
  for (let seed = from; seed < from + 500; seed++) {
    const m = craft(rulesVersion, seed);
    const word = wordFrom(lettersOf(m.state, 0), 3, 4);
    if (word) return { m, word };
  }
  throw new Error("no opening found");
}

/** A two-tile move by the current player lying parallel to the opening word, forming three or more words. */
function findCrossing(s: MatchState, row0: number, col0: number, len: number): { placements: Placement[]; letters: string[] } | null {
  const seat = s.current;
  const rack = s.racks[seat];
  for (const r of [row0 + 1, row0 - 1])
    for (let c = col0; c < col0 + len - 1; c++)
      for (const a of rack)
        for (const b of rack) {
          if (a === b || !s.tiles[a].letter || !s.tiles[b].letter) continue;
          const ps = [
            { tileId: a, row: r, column: c },
            { tileId: b, row: r, column: c + 1 },
          ];
          const an = analysePlacement(s, seat, ps, membership);
          if (an.legal && an.words.length >= 3) return { placements: ps, letters: [s.tiles[a].letter!, s.tiles[b].letter!] };
        }
  return null;
}

async function loadMatch(page: Page, env: MatchEnvelope) {
  await page.goto("/");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(env)] as const);
  await page.goto(URL);
}

/* ---------------- Page helpers ---------------- */

const square = (page: Page, r: number, c: number) => page.locator(`[data-cell="${r}-${c}"]`);

async function reveal(page: Page, name: string) {
  await expect(page.getByTestId("handover")).toContainText(`Pass the device to ${name}`);
  await page.getByRole("button", { name: `I am ${name}: show my rack` }).click();
  await expect(page.getByTestId("rack")).toBeVisible();
}

async function rackLetters(page: Page): Promise<string[]> {
  return page.getByTestId("rack").locator("button").evaluateAll((els) => els.map((e) => e.getAttribute("data-letter") ?? ""));
}

async function clickPlace(page: Page, letter: string, r: number, c: number) {
  await page.getByTestId("rack").locator(`button[data-letter="${letter}"]`).first().click();
  await square(page, r, c).click();
}

async function scoreOf(page: Page, seat: number) {
  return (await page.getByTestId(`score-${seat}`).locator("strong").last().textContent())?.trim();
}

test.beforeEach(async ({ page }) => {
  await clearProgress(page);
});

test("setup, invalid move keeps state, legal first move by clicks, handover and library entry", async ({ page }) => {
  await page.goto("/games/shared-word-board");
  await page.getByRole("link", { name: "Set up or resume a local match" }).click();
  await expect(page.getByTestId("setup")).toBeVisible();
  await expect(page.getByTestId("online-note")).toContainText("Online play needs the server set up");
  await expect(page.getByText("Rules 1.1 candidate · proposed, not yet balanced")).toBeVisible();

  const names = page.locator(".swb-name input");
  await names.nth(0).fill("Ann");
  await names.nth(1).fill("Ann");
  await page.getByRole("button", { name: "Start the match" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "different name" })).toBeVisible();
  await names.nth(1).fill("Ben");
  await page.getByRole("button", { name: "Start the match" }).click();

  // Racks are hidden until the player chooses to show theirs.
  await expect(page.getByTestId("rack")).toHaveCount(0);
  await reveal(page, "Ann");
  let rack = await rackLetters(page);
  // Racks are dealt at random, and a rare all-consonant rack has no word at all. Start a fresh
  // match until the opening rack can make a word, so the test is deterministic in what it checks.
  for (let attempt = 0; attempt < 8 && !wordFrom(rack, 2, 5); attempt++) {
    await clearProgress(page);
    await page.goto("/play/shared-word-board/match");
    await names.nth(0).fill("Ann");
    await names.nth(1).fill("Ben");
    await page.getByRole("button", { name: "Start the match" }).click();
    await reveal(page, "Ann");
    rack = await rackLetters(page);
  }
  expect(rack).toHaveLength(7);
  await expect(page.getByTestId("bag-count")).toContainText("18");

  // Invalid: two tiles in the corner, away from the centre star.
  await clickPlace(page, rack[0], 0, 0);
  await clickPlace(page, rack[1], 0, 1);
  await expect(page.getByTestId("preview-reason")).toContainText("must cover the centre star");
  await page.getByRole("button", { name: "Submit move" }).click();
  await expect(feedback(page)).toContainText("The first move must cover the centre star at row 5, column 5");
  await expect(square(page, 0, 0)).toHaveClass(/draft/);
  expect(await scoreOf(page, 0)).toBe("0");
  await expect(page.getByTestId("bag-count")).toContainText("18");
  await expect(page.getByTestId("turn-status")).toContainText("Ann, it is your turn");
  await page.getByRole("button", { name: "Recall tiles" }).click();
  await expect(page.getByTestId("rack").locator("button")).toHaveCount(7);

  // Legal: a familiar word from the rack across the centre (rules 1.0: one point per letter).
  const word = wordFrom(rack, 2, 5);
  expect(word, `a word from ${rack.join("")}`).toBeTruthy();
  for (let i = 0; i < word!.length; i++) await clickPlace(page, word![i], 4, 4 + i);
  await expect(page.getByTestId("preview-total")).toHaveText(`This move scores ${word!.length}`);
  await page.getByRole("button", { name: "Submit move" }).click();
  await expect(feedback(page)).toContainText(`Ann scores ${word!.length}`);
  await expect(feedback(page)).toContainText("Pass the device to Ben");
  expect(await scoreOf(page, 0)).toBe(String(word!.length));
  await expect(page.getByTestId("history")).toContainText(`Ann: ${word} ${word!.length}`);
  await expect(page.getByTestId("rack")).toHaveCount(0);
  await expect(page.getByTestId("handover")).toContainText("Pass the device to Ben");
  await expect(square(page, 4, 4)).toHaveClass(/played/);
  await expect(page.getByTestId("bag-count")).toContainText(String(18 - word!.length));

  await page.goto("/library");
  const entry = page.locator("a.round-card", { hasText: "Shared Word Board" });
  await expect(entry).toContainText("Local match · Ann v Ben");
  await entry.click();
  await expect(page).toHaveURL(/\/play\/shared-word-board\/match$/);
  await expect(page.getByTestId("restored-banner")).toBeVisible();
});

test("keyboard-only opening move under the 1.1 candidate rules", async ({ page }) => {
  const { m, word } = openingMatch("1.1-candidate", 100);
  const expected = analysePlacement(m.state, 0, placementsFor(m.state, 0, word, 4, 4), membership);
  expect(expected.legal).toBe(true);
  await loadMatch(page, m.env);
  await expect(page.getByTestId("handover")).toBeVisible();

  const tabTo = async (predicate: string, limit = 80) => {
    for (let i = 0; i < limit; i++) {
      await page.keyboard.press("Tab");
      if (await page.evaluate((p) => new Function("el", `return ${p}`)(document.activeElement), predicate)) return;
    }
    throw new Error(`could not tab to ${predicate}`);
  };
  await tabTo(`el && el.textContent && el.textContent.includes("show my rack")`);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("rack")).toBeVisible();
  // The board is a single tab stop whose roving focus starts on the centre star.
  await tabTo(`el && el.getAttribute("data-cell") === "4-4"`);
  await page.keyboard.press("ArrowUp");
  await expect(square(page, 3, 4)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(square(page, 4, 4)).toBeFocused();
  for (const ch of word.toLowerCase()) await page.keyboard.press(ch);
  await expect(square(page, 4, 4 + word.length)).toBeFocused();
  await expect(page.getByTestId("preview-total")).toHaveText(`This move scores ${expected.score}`);
  await expect(page.getByTestId("move-preview")).toContainText(expected.words[0].explanation);
  // Backspace takes the last tile back; retype it.
  await page.keyboard.press("Backspace");
  await expect(square(page, 4, 4 + word.length - 1)).not.toHaveClass(/draft/);
  await page.keyboard.press(word[word.length - 1].toLowerCase());
  await tabTo(`el && el.textContent === "Submit move"`);
  await page.keyboard.press("Enter");
  await expect(feedback(page)).toContainText(`Ann scores ${expected.score}`);
  expect(await scoreOf(page, 0)).toBe(String(expected.score));
  await expect(page.getByTestId("handover")).toContainText("Pass the device to Ben");
});

test("a crossing move scores every word it forms; an unconnected move is refused", async ({ page }) => {
  let found: { m: Crafted; crossing: NonNullable<ReturnType<typeof findCrossing>>; word: string } | null = null;
  for (let seed = 1; seed < 800 && !found; seed++) {
    const m0 = craft("1.0", seed);
    const word = wordFrom(lettersOf(m0.state, 0), 3, 4);
    if (!word) continue;
    const m1 = apply(m0, { type: "place", seat: 0, placements: placementsFor(m0.state, 0, word, 4, 4) });
    const crossing = findCrossing(m1.state, 4, 4, word.length);
    if (crossing) found = { m: m1, crossing, word };
  }
  expect(found).not.toBeNull();
  const { m, crossing } = found!;
  const expected = analysePlacement(m.state, 1, crossing.placements, membership);

  await loadMatch(page, m.env);
  await expect(page.getByTestId("restored-banner")).toContainText("1 saved move");
  await reveal(page, "Ben");

  // Not connected: a lone pair in the corner.
  await clickPlace(page, crossing.letters[0], 0, 0);
  await clickPlace(page, crossing.letters[1], 0, 1);
  await page.getByRole("button", { name: "Submit move" }).click();
  await expect(feedback(page)).toContainText("must join the tiles already on the board");
  expect(await scoreOf(page, 1)).toBe("0");
  // Clicking a placed tile takes it back.
  await square(page, 0, 0).click();
  await square(page, 0, 1).click();
  await expect(page.getByTestId("rack").locator("button")).toHaveCount(7);

  for (let i = 0; i < 2; i++) await clickPlace(page, crossing.letters[i], crossing.placements[i].row, crossing.placements[i].column);
  await expect(page.getByTestId("preview-total")).toHaveText(`This move scores ${expected.score}`);
  for (const w of expected.words) await expect(page.getByTestId("move-preview")).toContainText(`${w.word} (${w.direction}) ${w.score}`);
  await page.getByRole("button", { name: "Submit move" }).click();
  await expect(feedback(page)).toContainText(`Ben scores ${expected.score}`);
  expect(await scoreOf(page, 1)).toBe(String(expected.score));
  for (const w of expected.words) await expect(page.getByTestId("history")).toContainText(`${w.word} ${w.score}`);
});

test("exchange, pass and the pass-count end with final rack adjustments, then rematch", async ({ page }) => {
  const { m: m0, word } = openingMatch("1.0", 300);
  let m = apply(m0, { type: "place", seat: 0, placements: placementsFor(m0.state, 0, word, 4, 4) });
  await loadMatch(page, m.env);

  // Ben exchanges two tiles.
  await reveal(page, "Ben");
  const bag = (await page.getByTestId("bag-count").textContent())!.replace(/\D/g, "");
  await page.getByRole("button", { name: "Exchange…" }).click();
  const dlg = page.getByRole("dialog", { name: "Exchange tiles" });
  const tiles = dlg.getByRole("group", { name: "Tiles to exchange" }).getByRole("button");
  await tiles.nth(0).click();
  await tiles.nth(1).click();
  await dlg.getByRole("button", { name: "Exchange 2 tiles" }).click();
  await expect(feedback(page)).toContainText("Ben exchanges 2 tiles");
  await expect(page.getByTestId("bag-count")).toContainText(bag);
  await expect(page.getByTestId("history")).toContainText("Ben exchanged 2 tiles");

  // Ann passes.
  await reveal(page, "Ann");
  await page.getByRole("button", { name: "Pass…" }).click();
  await page.getByRole("dialog", { name: "Pass this turn?" }).getByRole("button", { name: "Pass", exact: true }).click();
  await expect(feedback(page)).toContainText("Ann passes");
  await expect(page.getByText("2 of 6")).toBeVisible();

  // Four more passes are already recorded elsewhere: load that position and make the sixth.
  m = apply(m, { type: "pass", seat: 1 });
  for (let i = 0; i < 4; i++) m = apply(m, { type: "pass", seat: m.state.current });
  const last = commit(m.state, { actionId: "final", expectedVersion: m.state.version, action: { type: "pass", seat: m.state.current } }, membership);
  expect(last.state.status).toBe("finished");
  const end = last.state.end!;
  await loadMatch(page, m.env);
  const who = m.state.players[m.state.current].name;
  await reveal(page, who);
  await page.getByRole("button", { name: "Pass…" }).click();
  await page.getByRole("dialog", { name: "Pass this turn?" }).getByRole("button", { name: "Pass", exact: true }).click();
  const result = page.getByTestId("final-result");
  await expect(result).toBeVisible();
  const winners = end.winners.map((s) => last.state.players[s].name);
  await expect(result.getByRole("heading")).toContainText(winners.length > 1 ? "shared win" : `${winners[0]} wins with ${end.finalScores[end.winners[0]]}`);
  await expect(result).toContainText("passed or exchanged three times in a row");
  for (const [seat, a] of end.adjustments.entries()) {
    const row = result.getByRole("row", { name: new RegExp(`^${last.state.players[seat].name}`) });
    await expect(row).toContainText(String(-a.rackPenalty));
    await expect(row.locator("td").last()).toHaveText(String(end.finalScores[seat]));
  }
  await expect(page.getByTestId("rack")).toHaveCount(0);

  await page.getByRole("button", { name: "Rematch with the same players" }).click();
  await expect(page.getByTestId("handover")).toContainText("Pass the device to Ann");
  expect(await scoreOf(page, 0)).toBe("0");
});

test("resigning in a two-player match ends it with the other player winning", async ({ page }) => {
  const { m } = openingMatch("1.0", 500);
  await loadMatch(page, m.env);
  await reveal(page, "Ann");
  await page.getByRole("button", { name: "Resign…" }).click();
  await page.getByRole("dialog", { name: "Resign, Ann?" }).getByRole("button", { name: "Resign" }).click();
  await expect(page.getByTestId("final-result").getByRole("heading")).toHaveText("Ben wins by resignation");
});

test("refresh mid-turn restores the match and the unsubmitted tiles; a corrupt save is set aside", async ({ page }) => {
  const { m, word } = openingMatch("1.0", 700);
  await loadMatch(page, m.env);
  await reveal(page, "Ann");
  await clickPlace(page, word[0], 4, 4);
  await clickPlace(page, word[1], 4, 5);
  await expect(page.getByTestId("save-indicator")).toContainText("Saved");
  await page.reload();
  // Racks are hidden again after a reload until the player shows theirs.
  await expect(page.getByTestId("restored-banner")).toBeVisible();
  await expect(page.getByTestId("rack")).toHaveCount(0);
  await expect(square(page, 4, 4)).not.toHaveClass(/draft/);
  await reveal(page, "Ann");
  await expect(square(page, 4, 4)).toHaveClass(/draft/);
  await expect(square(page, 4, 5)).toHaveClass(/draft/);
  await expect(page.getByTestId("rack").locator("button")).toHaveCount(5);
  for (let i = 2; i < word.length; i++) await clickPlace(page, word[i], 4, 4 + i);
  await page.getByRole("button", { name: "Submit move" }).click();
  await expect(feedback(page)).toContainText(`Ann scores ${word.length}`);
  await page.reload();
  await expect(page.getByTestId("restored-banner")).toContainText("1 saved move");
  expect(await scoreOf(page, 0)).toBe(String(word.length));

  // Corrupt save: set aside with a clear message and a fresh setup.
  await page.evaluate((k) => localStorage.setItem(k, "{not json"), KEY);
  await page.reload();
  await expect(page.getByTestId("corrupt-banner")).toContainText("could not be read");
  await expect(page.getByTestId("setup")).toBeVisible();
  // A save from another rule set version is never reinterpreted.
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify({ ...m.env, rulesHash: "0000000000000000" })] as const);
  await page.reload();
  await expect(page.getByTestId("corrupt-banner")).toContainText("different version of its rules");
  await expect(page.getByTestId("setup")).toBeVisible();
});

test("@mobile board is usable at 390px with taps and no page overflow", async ({ page }) => {
  await page.goto(URL);
  await page.locator(".swb-name input").nth(0).fill("Ann");
  await page.locator(".swb-name input").nth(1).fill("Ben");
  await page.getByText("Rules 1.1 candidate").click();
  await page.getByRole("button", { name: "Start the match" }).click();
  await reveal(page, "Ann");
  await expectNoHorizontalOverflow(page);
  const box = await square(page, 4, 4).boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(28);
  const rackBox = await page.getByTestId("rack").locator("button").first().boundingBox();
  expect(rackBox!.width).toBeGreaterThanOrEqual(44);
  expect(rackBox!.height).toBeGreaterThanOrEqual(44);
  const rack = await rackLetters(page);
  const first = rack.find((l) => l !== "?")!;
  await clickPlace(page, first, 4, 4);
  await expect(square(page, 4, 4)).toHaveClass(/draft/);
  await expect(page.getByTestId("move-preview")).toContainText(/Not ready yet|This move scores/);
  await page.getByRole("button", { name: "Bigger squares" }).click();
  const big = await square(page, 4, 4).boundingBox();
  expect(big!.width).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Recall tiles" }).click();
  await expect(page.getByTestId("rack").locator("button")).toHaveCount(7);
});
