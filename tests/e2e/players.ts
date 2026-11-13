import type { Page } from "@playwright/test";
import { WORDS } from "../../src/games/unscramble/words";

/**
 * Bots for the e2e test. Each call makes one move in whatever game is on
 * screen, or waits a beat. The "weak" bot is deliberately slower and makes a
 * memory mistake earlier, so rounds don't tie forever.
 */
export async function playGame(page: Page, weak: boolean) {
  if (await page.getByTestId("reaction-pad").isVisible()) {
    const go = page.locator(".reaction--go");
    if (await go.isVisible()) {
      if (weak) await page.waitForTimeout(60);
      await go.dispatchEvent("pointerdown");
    } else await page.waitForTimeout(30);
    return;
  }

  if (await page.getByTestId("math-problem").isVisible()) {
    const text = await page.getByTestId("math-problem").innerText().catch(() => "");
    const m = text.match(/(\d+)\s*([+−×])\s*(\d+)/);
    if (m) {
      const [a, b] = [Number(m[1]), Number(m[3])];
      const ans = m[2] === "+" ? a + b : m[2] === "−" ? a - b : a * b;
      for (const d of String(ans)) await page.getByTestId(`key-${d}`).dispatchEvent("pointerdown");
      await page.waitForTimeout(weak ? 600 : 150);
    }
    return;
  }

  if (await page.getByTestId("target").isVisible()) {
    if (weak) await page.waitForTimeout(150);
    await page.getByTestId("target").dispatchEvent("pointerdown").catch(() => {});
    return;
  }

  if (await page.getByTestId("unscramble-tiles").isVisible()) {
    const letters = (await page.getByTestId("unscramble-tiles").locator(".tile").allInnerTexts()).map((s) => s.trim().toLowerCase());
    const key = [...letters].sort().join("");
    const word = WORDS.find((w) => [...w].sort().join("") === key);
    if (!word) return;
    const used = new Set<number>();
    for (const ch of word) {
      const i = letters.findIndex((l, j) => l === ch && !used.has(j));
      used.add(i);
      await page.getByTestId(`tile-${i}`).dispatchEvent("pointerdown");
    }
    await page.waitForTimeout(weak ? 1500 : 300);
    return;
  }

  if (await page.getByTestId("memory-status").isVisible()) {
    const seq = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>(".memory__pads");
      return root?.dataset.stage === "input" ? (window as unknown as { __seq: string[] }).__seq.slice() : null;
    });
    const status = await page.getByTestId("memory-status").innerText().catch(() => "");
    if (seq && status.includes("Your turn: 0/")) {
      const limit = weak ? 3 : 5;
      for (const [i, c] of seq.entries()) {
        const wrong = seq.length > limit && i === seq.length - 1;
        const color = wrong ? (c === "red" ? "blue" : "red") : c;
        await page.getByTestId(`pad-${color}`).dispatchEvent("pointerdown");
      }
    }
    await page.waitForTimeout(100);
    return;
  }

  await page.waitForTimeout(200);
}

/**
 * Install before the page loads (page.addInitScript). Records the memory
 * game's flashes into window.__seq so the bot can repeat them.
 */
export function memoryRecorder() {
  const w = window as unknown as { __seq: string[] };
  w.__seq = [];
  let last: Element | null = null;
  new MutationObserver(() => {
    const root = document.querySelector<HTMLElement>(".memory__pads");
    if (!root) return;
    const stage = root.dataset.stage;
    if (stage === "between") {
      w.__seq = [];
      last = null;
    }
    if (stage !== "show") return;
    const lit = root.querySelector(".pad--lit");
    if (lit && lit !== last) w.__seq.push(lit.getAttribute("aria-label")!);
    last = lit;
  }).observe(document, { subtree: true, attributes: true, childList: true });
}
