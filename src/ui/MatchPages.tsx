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
  if (!session || session.roomId !== roomId) return <div className="home"><p className="waiting">Opening room {roomId}</p></div>;
  return <MatchView s={session} />;
}

export function JoinPage({ roomId }: { roomId: string }) {
  const session = useSession();
  const [name, setName] = useState(loadName);
  const [joined, setJoined] = useState(false);

  if (!joined || !session || session.roomId !== roomId) {
    return (
      <div className="home">
        <h1 className="title-stamp">DUEL</h1>
        <p className="lead">You've been challenged. Room</p>
        <div className="code">{roomId.split("").map((c, i) => <span key={i} className="code__cell">{c}</span>)}</div>
        <label className="name-field name-field--big">
          Your name
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Player 2" data-testid="name-input" autoFocus />
        </label>
        <button
          className="trigger"
          data-testid="join-match"
          onClick={() => {
            saveName(name || "Player 2");
            setJoined(true);
            void joinRoom(roomId, name.trim() || "Player 2");
          }}
        >
          Join room
        </button>
        <a className="textlink" href="#/">Back</a>
      </div>
    );
  }
  if (session.status === "rejected" || session.status === "lost") return <ErrorScreen message={session.error} />;
  if (!session.state) return <div className="home"><p className="waiting">Connecting to room {roomId}</p></div>;
  return <MatchView s={session} />;
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="home">
      <h2 className="title-stamp title-stamp--small">No signal</h2>
      <p className="lead" data-testid="error">{message}</p>
      <button className="trigger" onClick={() => { leave(); navigate("/"); }}>Home</button>
    </div>
  );
}
