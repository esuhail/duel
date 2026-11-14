import { type Page, expect, test } from "@playwright/test";
import { memoryRecorder, playGame } from "./players";

/**
 * Two browser windows play a whole match against each other.
 * `?net=local` swaps WebRTC for BroadcastChannel, so the test is fast and
 * doesn't depend on the public PeerJS server, while still running the real
 * UI, host controller, guest client and protocol end to end.
 */
test.setTimeout(480_000);

test("two players create, join and finish a match, then rematch", async ({ browser }) => {
  const ctx = await browser.newContext(); // both pages share BroadcastChannel
  const host = await ctx.newPage();
  const guest = await ctx.newPage();
  await ctx.addInitScript(memoryRecorder);

  await host.goto("/?net=local#/");
  await host.getByTestId("name-input").fill("Alice");
  await host.getByTestId("create-match").click();
  const link = await host.getByTestId("invite-link").inputValue();

  await guest.goto(link);
  await guest.getByTestId("name-input").fill("Bob");
  await guest.getByTestId("join-match").click();
  await expect(host.getByTestId("lobby-status")).toHaveText("Bob joined!");
  await host.getByTestId("start-match").click();

  // Live progress: once both are playing, each screen shows the other's lane updating.
  await expect(guest.getByTestId("versus-opponent")).toContainText("Alice", { timeout: 20_000 });
  await expect(host.getByTestId("versus-opponent")).toContainText("Bob");
  await expect(host.getByTestId("versus-opponent")).toContainText(/\d/, { timeout: 30_000 });

  await playUntilOver([host, guest]);
  await expect(host.getByTestId("match-over")).toBeVisible();
  await expect(guest.getByTestId("match-over")).toBeVisible();

  // Both screens must agree on the final table.
  expect(await host.locator(".history").innerText()).toBe(await guest.locator(".history").innerText());

  await guest.getByTestId("rematch").click();
  await expect(host.getByTestId("rematch")).toContainText("they're in");
  await host.getByTestId("rematch").click();
  await expect(guest.getByTestId("intro")).toBeVisible();
});

async function playUntilOver(pages: Page[]) {
  const deadline = Date.now() + 400_000;
  // Each page runs its own loop, like two people playing independently.
  // (A shared loop would make both bots exactly as fast as the slower one,
  // and every round would tie.)
  await Promise.all(
    pages.map(async (page, i) => {
      while (!(await page.getByTestId("match-over").isVisible())) {
        if (Date.now() > deadline) {
          const st = await page.evaluate(() => (window as unknown as { __duel: () => unknown }).__duel());
          throw new Error("match did not finish: " + JSON.stringify(st));
        }
        await playGame(page, i === 1);
      }
    }),
  );
}
