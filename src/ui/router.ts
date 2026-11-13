import { useEffect, useState } from "react";

/**
 * Hash routing (#/room/abc) instead of path routing (/room/abc): static hosts
 * like GitHub Pages return 404 for unknown paths, but never see the hash.
 */
export function useHashRoute(): string[] {
  const parse = () => window.location.hash.replace(/^#\/?/, "").split("?")[0]!.split("/").filter(Boolean);
  const [parts, setParts] = useState(parse);
  useEffect(() => {
    const on = () => setParts(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return parts;
}

export const navigate = (path: string) => {
  window.location.hash = path;
};
