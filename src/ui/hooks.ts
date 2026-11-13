import { useEffect, useState } from "react";
import { now } from "../core/clock";

/** Re-renders every `ms` and returns the current clock time. */
export function useNow(ms = 100): number {
  const [t, setT] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setT(now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}

const NAME_KEY = "duel:name";
export const loadName = () => localStorage.getItem(NAME_KEY) ?? "";
export const saveName = (n: string) => localStorage.setItem(NAME_KEY, n.trim().slice(0, 20));
