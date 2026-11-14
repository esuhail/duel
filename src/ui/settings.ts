/** Player settings, saved on the device. */
import { useSyncExternalStore } from "react";

export interface Settings {
  sound: boolean;
  /** 0..1 */
  volume: number;
  /** CRT scanlines over the screen. */
  scanlines: boolean;
}

const KEY = "duel:settings";
const DEFAULTS: Settings = { sound: true, volume: 0.5, scanlines: true };

function load(): Settings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

let current = load();
const subs = new Set<() => void>();
const apply = () => {
  document.documentElement.dataset.scanlines = current.scanlines ? "on" : "off";
};
apply();

export const getSettings = () => current;

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  localStorage.setItem(KEY, JSON.stringify(current));
  apply();
  subs.forEach((f) => f());
}

export const useSettings = () =>
  useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => current);
