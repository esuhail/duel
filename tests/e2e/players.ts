import type { Locator, Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const DICT = readFileSync(new URL("../../src/games/anagrams/words.txt", import.meta.url), "utf8").split(" ");
/** Per page: which letter set we're on and how many of its words we've entered. */
const anagramState = new WeakMap<Page, { key: string; next: number }>();

/** The element can vanish when the game's timer ends mid-move; that's fine. */
const tap = (l: Locator) => l.dispatchEvent("pointerdown", undefined, { timeout: 1000 }).catch(() => {});

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
      await tap(go);
    } else await page.waitForTimeout(30);
    return;
  }

  if (await page.getByTestId("math-problem").isVisible()) {
    const text = await page.getByTestId("math-problem").innerText().catch(() => "");
    const m = text.match(/(\d+)\s*([+−×])\s*(\d+)/);
    if (m) {
      const [a, b] = [Number(m[1]), Number(m[3])];
      const ans = m[2] === "+" ? a + b : m[2] === "−" ? a - b : a * b;
      for (const d of String(ans)) await tap(page.getByTestId(`key-${d}`));
      await page.waitForTimeout(weak ? 600 : 150);
    }
    return;
  }

  if (await page.getByTestId("target").isVisible()) {
    if (weak) await page.waitForTimeout(150);
    await tap(page.getByTestId("target"));
    return;
  }

  if (await page.getByTestId("anagrams-tiles").isVisible()) {
    const letters = await page.getByTestId("anagrams-tiles").locator(".tile").evaluateAll((els) => els.map((e) => e.getAttribute("data-letter") ?? ""));
    const key = [...letters].sort().join("");
    const pool = (w: string) => [...w].every((ch, _i, arr) => arr.filter((c) => c === ch).length <= letters.filter((c) => c === ch).length);
    const answers = DICT.filter((w) => pool(w)).sort((a, b) => b.length - a.length);
    const st = anagramState.get(page);
    const state = st && st.key === key ? st : { key, next: 0 };
    anagramState.set(page, state);
    const limit = weak ? 5 : 14;
    if (state.next < Math.min(limit, answers.length)) {
      // The weak bot starts from the short end, so it scores fewer points.
      const word = weak ? answers[answers.length - 1 - state.next]! : answers[state.next]!;
      state.next++;
      await page.keyboard.type(word);
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(weak ? 900 : 250);
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
        await tap(page.getByTestId(`pad-${color}`));
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
