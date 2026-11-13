/**
 * Visual themes. Each theme is a CSS file that overrides the design tokens
 * in styles.css (colours, fonts, keycaps) plus a few rules of its own.
 * The app's markup never changes between themes; only `data-theme` on <html>.
 */
import { useSyncExternalStore } from "react";
import "./themes/arcade.css";
import "./themes/swiss.css";
import "./themes/riso.css";

export const THEMES = [
  { id: "broadcast", name: "Broadcast", note: "Current: obsidian, lime vs vermilion, hard shadows", swatch: ["#0d0d0f", "#ccff00", "#ff2a00"] },
  { id: "arcade", name: "Arcade CRT", note: "Pixel type, neon glow, synthwave grid", swatch: ["#0b0420", "#2de2e6", "#ff3864"] },
  { id: "swiss", name: "Swiss Sports", note: "White, flat, giant condensed numbers", swatch: ["#fafafa", "#0038ff", "#ff2d1a"] },
  { id: "riso", name: "Riso Print", note: "Two-ink print, halftone, misregistration", swatch: ["#e9e8e3", "#00838a", "#ff48b0"] },
] as const;
export type ThemeId = (typeof THEMES)[number]["id"];

const KEY = "duel:theme";
const isTheme = (x: string | null): x is ThemeId => THEMES.some((t) => t.id === x);

function initial(): ThemeId {
  const fromUrl = new URLSearchParams(location.search).get("theme");
  if (isTheme(fromUrl)) return fromUrl;
  const saved = localStorage.getItem(KEY);
  return isTheme(saved) ? saved : "broadcast";
}

let current: ThemeId = initial();
const subs = new Set<() => void>();
document.documentElement.dataset.theme = current;

export function setTheme(t: ThemeId) {
  current = t;
  localStorage.setItem(KEY, t);
  document.documentElement.dataset.theme = t;
  subs.forEach((f) => f());
}

export const useTheme = () =>
  useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => current);
