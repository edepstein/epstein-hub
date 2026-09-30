import { expect, type Page } from "@playwright/test";

/** Fails if the page body scrolls horizontally (layout overflow). */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

export async function clearProgress(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("wc:")) localStorage.removeItem(k);
  });
}

export function feedback(page: Page) {
  return page.getByTestId("feedback");
}
