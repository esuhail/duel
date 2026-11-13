import { expect, test } from "@playwright/test";
import { memoryRecorder, playGame } from "./players";

for (const id of ["reaction", "math", "targets", "unscramble", "memory"]) {
  test(`practice ${id} ends with a score`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(memoryRecorder);
    await page.goto(`/#/practice/${id}`);
    await page.getByRole("button", { name: "Play" }).click();
    const score = page.getByTestId("practice-score");
    const deadline = Date.now() + 75_000;
    while (!(await score.isVisible())) {
      if (Date.now() > deadline) throw new Error("game never finished");
      await playGame(page, false);
    }
    await expect(score).not.toBeEmpty();
    console.log(id, await score.innerText());
  });
}
