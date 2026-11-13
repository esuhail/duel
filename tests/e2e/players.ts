import type { Page } from "@playwright/test";

/**
 * Bots for the e2e test. If a game is on screen, make one move (legally,
 * not necessarily well); otherwise wait a beat. Called in a loop.
 */
export async function playGame(page: Page) {
  if (await page.getByTestId("reaction-pad").isVisible()) {
    const go = page.locator(".reaction--go");
    if (await go.isVisible()) await go.dispatchEvent("pointerdown");
    else await page.waitForTimeout(50);
    return;
  }
  if (await page.getByTestId("math-problem").isVisible()) {
    const text = await page.getByTestId("math-problem").innerText();
    const m = text.match(/(\d+)\s*([+−×])\s*(\d+)/);
    if (m) {
      const [a, b] = [Number(m[1]), Number(m[3])];
      const ans = m[2] === "+" ? a + b : m[2] === "−" ? a - b : a * b;
      for (const d of String(ans)) await page.getByTestId(`key-${d}`).dispatchEvent("pointerdown");
    }
    return;
  }
  const target = page.getByTestId("target");
  if (await target.isVisible()) {
    await target.dispatchEvent("pointerdown").catch(() => {});
    return;
  }
  await page.waitForTimeout(200);
}
