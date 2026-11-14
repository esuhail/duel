import { useEffect, useRef, useState } from "react";
import { type MatchState, type PlayerId, other } from "../core/match";
import type { Progress } from "../games/types";
import { getGame } from "../games/registry";
import { slot } from "./arena";

/**
 * Live race shown inside the game: one lane per player (you on top), filling
 * as each of you scores. When the opponent's number jumps, a "+N" pops out
 * of their lane so you notice without looking away from your own game.
 */
export function VersusBar({ state, me, progress }: { state: MatchState; me: PlayerId; progress: Partial<Record<PlayerId, Progress>> }) {
  const cur = state.current!;
  const game = getGame(cur.gameId);
  return (
    <div className="versus" data-testid="versus">
      {[me, other(me)].map((p) => (
        <Lane
          key={p}
          name={p === me ? "You" : state.players[p]?.name ?? "?"}
          side={slot(p)}
          progress={progress[p]}
          done={cur.scores[p] !== undefined ? game.formatScore(cur.scores[p]!) : undefined}
          isOpponent={p !== me}
        />
      ))}
    </div>
  );
}

function Lane({ name, side, progress, done, isOpponent }: { name: string; side: string; progress?: Progress; done?: string; isOpponent: boolean }) {
  const [pop, setPop] = useState<{ id: number; text: string } | null>(null);
  const last = useRef<number | null>(null);
  const value = progress ? Number(progress.headline) : NaN;

  useEffect(() => {
    if (!isOpponent || Number.isNaN(value)) return;
    const prev = last.current;
    last.current = value;
    if (prev !== null && value !== prev) setPop({ id: Date.now(), text: `${value > prev ? "+" : ""}${value - prev}` });
  }, [value, isOpponent]);

  const fraction = done ? 1 : progress?.fraction ?? 0;
  return (
    <div className={`lane lane--${side} ${done ? "is-done" : ""}`} data-testid={isOpponent ? "versus-opponent" : "versus-me"}>
      <span className="lane__name">{name}</span>
      <span className="lane__track"><i style={{ transform: `scaleX(${fraction})` }} /></span>
      <span className="lane__value" key={done ?? progress?.headline}>
        {done ? `Done, ${done}` : progress ? `${progress.headline} ${progress.unit}` : "Starting"}
      </span>
      {pop && isOpponent && <span key={pop.id} className="lane__pop">{pop.text}</span>}
    </div>
  );
}
