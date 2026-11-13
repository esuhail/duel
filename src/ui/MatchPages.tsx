import { useEffect, useState } from "react";
import type { BestOf } from "../core/match";
import { loadName, saveName } from "./hooks";
import { MatchView } from "./MatchView";
import { navigate } from "./router";
import { joinRoom, leave, pendingError, startHosting, useSession } from "./session";

export function HostPage({ roomId }: { roomId: string }) {
  const session = useSession();
  useEffect(() => {
    const bestOf = (Number(sessionStorage.getItem("duel:bestOf")) || 3) as BestOf;
    void startHosting(roomId, loadName() || "Player 1", bestOf);
  }, [roomId]);
  const err = pendingError();
  if (err) return <ErrorScreen message={err} />;
  if (!session || session.roomId !== roomId) return <div className="screen"><p>Opening room…</p></div>;
  return <MatchView s={session} />;
}

export function JoinPage({ roomId }: { roomId: string }) {
  const session = useSession();
  const [name, setName] = useState(loadName);
  const [joined, setJoined] = useState(false);

  if (!joined || !session || session.roomId !== roomId) {
    return (
      <div className="screen">
        <h1>Duel</h1>
        <p>You've been challenged!</p>
        <label>
          Your name
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Player 2" data-testid="name-input" autoFocus />
        </label>
        <button
          className="btn"
          data-testid="join-match"
          onClick={() => {
            saveName(name || "Player 2");
            setJoined(true);
            void joinRoom(roomId, name.trim() || "Player 2");
          }}
        >
          Join match
        </button>
      </div>
    );
  }
  if (session.status === "rejected" || session.status === "lost") return <ErrorScreen message={session.error} />;
  if (!session.state) return <div className="screen"><p>Connecting to host…</p></div>;
  return <MatchView s={session} />;
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="screen">
      <h2>Couldn't connect</h2>
      <p data-testid="error">{message}</p>
      <button className="btn" onClick={() => { leave(); navigate("/"); }}>Home</button>
    </div>
  );
}
