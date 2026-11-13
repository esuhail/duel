import { type Page, expect, test } from "@playwright/test";
import { playGame } from "./players";

/**
 * Two browser windows play a whole match against each other.
 * `?net=local` swaps WebRTC for BroadcastChannel, so the test is fast and
 * doesn't depend on the public PeerJS server, while still running the real
 * UI, host controller, guest client and protocol end to end.
 */
test("two players create, join and finish a match, then rematch", async ({ browser }) => {
  const ctx = await browser.newContext(); // both pages share BroadcastChannel
  const host = await ctx.newPage();
  const guest = await ctx.newPage();

  await host.goto("/?net=local#/");
  await host.getByTestId("name-input").fill("Alice");
  await host.getByTestId("create-match").click();
  const link = await host.getByTestId("invite-link").inputValue();

  await guest.goto(link);
  await guest.getByTestId("name-input").fill("Bob");
  await guest.getByTestId("join-match").click();
  await expect(host.getByTestId("lobby-status")).toHaveText("Bob joined!");
  await host.getByTestId("start-match").click();

  await playUntilOver([host, guest]);
  await expect(host.getByTestId("match-over")).toBeVisible();
  await expect(guest.getByTestId("match-over")).toBeVisible();

  // Both screens must agree on the final table.
  expect(await host.locator(".history").innerText()).toBe(await guest.locator(".history").innerText());

  await guest.getByTestId("rematch").click();
  await expect(host.getByTestId("rematch")).toContainText("they want one");
  await host.getByTestId("rematch").click();
  await expect(guest.getByTestId("intro")).toBeVisible();
});

async function playUntilOver(pages: Page[]) {
  const deadline = Date.now() + 100_000;
  while (Date.now() < deadline) {
    if (await pages[0]!.getByTestId("match-over").isVisible()) return;
    // Each page plays independently, in parallel, like two real people.
    await Promise.all(pages.map((p) => playGame(p)));
  }
  throw new Error("match did not finish");
}
