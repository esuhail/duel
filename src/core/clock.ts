/**
 * Clock sync (a simplified NTP / Cristian's algorithm).
 *
 * Two devices' clocks can disagree by seconds. To start a round at the same
 * instant on both, the guest estimates `offset = hostClock - guestClock`:
 *   guest sends ping at local t0, host stamps hostTime, guest receives at t1.
 *   Assuming the trip is symmetric, hostTime happened at local (t0 + t1) / 2.
 * Error is at most half the round trip, so we take several samples and keep
 * the one with the smallest round trip.
 */
export interface ClockSample {
  t0: number;
  hostTime: number;
  t1: number;
}

export function estimateOffset(samples: ClockSample[]): { offset: number; rtt: number } | null {
  if (samples.length === 0) return null;
  const best = samples.reduce((a, b) => (b.t1 - b.t0 < a.t1 - a.t0 ? b : a));
  return { offset: best.hostTime - (best.t0 + best.t1) / 2, rtt: best.t1 - best.t0 };
}

/** Wall-clock ms with sub-ms precision; never jumps backwards like Date.now() can. */
export const now = () => performance.timeOrigin + performance.now();
