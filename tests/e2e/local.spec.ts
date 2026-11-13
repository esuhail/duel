import { expect, test } from "@playwright/test";

test("same-keyboard reaction duel plays to a winner", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/#/local");
  await page.getByTestId("local-start").click();
  const over = page.getByTestId("match-over");
  const deadline = Date.now() + 100_000;
  while (!(await over.isVisible())) {
    if (Date.now() > deadline) throw new Error("local match did not finish");
    if (await page.locator(".duel--go").isVisible()) {
      await page.keyboard.press("a"); // P1 is always a bit faster
      await page.waitForTimeout(40);
      await page.keyboard.press("l");
    }
    await page.waitForTimeout(30);
  }
  await expect(page.locator(".over__title")).toHaveText("P1 wins");
});
