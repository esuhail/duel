/**
 * Privacy-friendly usage counting with GoatCounter (free, no cookies, no
 * personal data). Set VITE_GOATCOUNTER_CODE at build time to enable; without
 * it this is a no-op, so forks and local dev never report anything.
 *
 * Uses GoatCounter's pixel endpoint instead of its script: one GET per event,
 * nothing else loaded.
 */
const code = import.meta.env.VITE_GOATCOUNTER_CODE as string | undefined;

export function trackEvent(name: string) {
  if (!code || location.hostname === "localhost") return;
  const url = `https://${code}.goatcounter.com/count?p=${encodeURIComponent("/event/" + name)}&e=true&rnd=${Math.random()}`;
  new Image().src = url;
}
