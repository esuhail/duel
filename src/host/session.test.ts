/**
 * Integration test: a real HostController and GuestClient talking over the
 * in-memory transport, with fake timers so 30-second waits take no time.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { GameRule } from "../core/match";
import { GuestClient } from "../net/guestClient";
import { MemoryNetwork } from "../net/memoryTransport";
import { HostController } from "./hostController";

const GAMES: GameRule[] = [
  { id: "a", better: "higher" },
  { id: "b", better: "lower" },
];

let seed = 1;
async function setup() {
  const net = new MemoryNetwork();
  const t = net.transport();
  const host = new HostController({
    endpoint: await t.host("room1"),
    hostName: "Ann",
    bestOf: 3,
    games: GAMES,
    now: () => Date.now(),
    randomSeed: () => seed++,
  });
  const guest = new GuestClient({ transport: t, roomId: "room1", name: "Bob", token: "tok", now: () => Date.now() });
  await guest.connect();
  await vi.advanceTimersByTimeAsync(1000);
  return { net, t, host, guest };
}

/** Both players submit scores that make `who` win the current round. */
function scoreRound(host: HostController, guest: GuestClient, who: "host" | "guest") {
  const cur = host.state.current!;
  const better = GAMES.find((g) => g.id === cur.gameId)!.better;
  const [good, bad] = better === "higher" ? [10, 1] : [1, 10];
  host.submitScore(cur.round, cur.attempt, who === "host" ? good : bad);
  guest.submitScore(cur.round, cur.attempt, who === "guest" ? good : bad);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("host + guest over memory transport", () => {
  test("join syncs both sides", async () => {
    const { host, guest } = await setup();
    expect(host.state.players.guest?.name).toBe("Bob");
    expect(guest.status).toBe("connected");
    expect(guest.state).toEqual(host.state);
  });

  test("a full best-of-3 ends identically on both screens", async () => {
    const { host, guest } = await setup();
    host.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(guest.state!.current).toEqual(host.state.current); // same game + seed
    scoreRound(host, guest, "guest");
    await vi.advanceTimersByTimeAsync(100);
    expect(host.state.phase).toBe("roundResult");
    expect(guest.state!.history).toEqual(host.state.history);

    await vi.advanceTimersByTimeAsync(host.timing.resultMs); // host starts round 2 by itself
    expect(guest.state!.current!.round).toBe(2);
    scoreRound(host, guest, "guest");
    await vi.advanceTimersByTimeAsync(host.timing.resultMs + 100);
    expect(host.state.phase).toBe("matchOver");
    expect(guest.state!.phase).toBe("matchOver");
    expect(guest.state!.winner).toBe("guest");
  });

  test("clock offset is estimated from ping/pong", async () => {
    const { guest } = await setup();
    // Same fake clock on both sides, so the offset should be ~0.
    expect(Math.abs(guest.offset)).toBeLessThan(5);
  });

  test("a third player is rejected", async () => {
    const { t } = await setup();
    const eve = new GuestClient({ transport: t, roomId: "room1", name: "Eve", token: "other", now: () => Date.now() });
    await eve.connect();
    await vi.advanceTimersByTimeAsync(500);
    expect(eve.status).toBe("rejected");
  });

  test("guest drops mid-round, rejoins, and the round is replayed", async () => {
    const { net, host, guest } = await setup();
    host.start();
    await vi.advanceTimersByTimeAsync(100);
    const before = host.state.current!;
    net.dropAll();
    await vi.advanceTimersByTimeAsync(10);
    expect(host.state.players.guest!.connected).toBe(false);
    expect(guest.status).toBe("reconnecting");

    await vi.advanceTimersByTimeAsync(3000); // guest retries after 2 s
    expect(guest.status).toBe("connected");
    expect(host.state.players.guest!.connected).toBe(true);
    expect(host.state.current!.attempt).toBe(before.attempt + 1);
    expect(host.state.current!.seed).not.toBe(before.seed);
    expect(guest.state!.current).toEqual(host.state.current);

    await vi.advanceTimersByTimeAsync(31_000); // the forfeit timer was cancelled
    expect(host.state.phase).not.toBe("matchOver");
  });

  test("guest who never comes back forfeits after 30 s", async () => {
    const { net, host, guest } = await setup();
    host.start();
    await vi.advanceTimersByTimeAsync(100);
    guest.dispose();
    net.dropAll();
    await vi.advanceTimersByTimeAsync(29_000);
    expect(host.state.phase).not.toBe("matchOver");
    await vi.advanceTimersByTimeAsync(2_000);
    expect(host.state.phase).toBe("matchOver");
    expect(host.state.winner).toBe("host");
    expect(host.state.endReason).toBe("forfeit");
  });

  test("rematch request reaches the host; rematch restarts", async () => {
    const { host, guest } = await setup();
    host.start();
    for (let i = 0; i < 2; i++) {
      await vi.advanceTimersByTimeAsync(100);
      scoreRound(host, guest, "host");
      await vi.advanceTimersByTimeAsync(host.timing.resultMs + 100);
    }
    expect(guest.state!.phase).toBe("matchOver");
    guest.requestRematch();
    await vi.advanceTimersByTimeAsync(100);
    expect(host.state.rematchRequested).toEqual(["guest"]);
    host.rematch();
    await vi.advanceTimersByTimeAsync(100);
    expect(guest.state!.phase).toBe("countdown");
    expect(guest.state!.players.host.wins).toBe(0);
  });

  test("live progress travels both ways, outside the event log", async () => {
    const { host, guest } = await setup();
    host.start();
    await vi.advanceTimersByTimeAsync(100);
    const { round, attempt } = host.state.current!;
    const p = { fraction: 0.4, headline: "6", unit: "solved", detail: "No mistakes" };
    guest.reportProgress(round, attempt, p);
    host.reportProgress(round, attempt, { ...p, headline: "9" });
    await vi.advanceTimersByTimeAsync(50);
    expect(host.progress.guest).toEqual({ round, attempt, p });
    expect(guest.progress.host?.p.headline).toBe("9");
    expect(guest.state).toEqual(host.state); // match state untouched
  });
});
