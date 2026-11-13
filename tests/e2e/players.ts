import type { Page } from "@playwright/test";

/** If a game is on screen, play it (badly but legally). Otherwise wait a beat. */
export async function playGame(page: Page) {
  const pad = page.getByTestId("reaction-pad");
  if (await pad.isVisible()) {
    const go = page.locator(".reaction--go");
    if (await go.isVisible()) await go.dispatchEvent("pointerdown");
    else await page.waitForTimeout(50);
    return;
  }
  await page.waitForTimeout(200);
}
