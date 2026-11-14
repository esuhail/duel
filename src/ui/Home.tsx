import { useState } from "react";
import { GAMES } from "../games/registry";
import { newRoomId } from "../net/transport";
import { loadName, saveName } from "./hooks";
import { Menu } from "./Menu";
import { navigate } from "./router";

/** Main menu. Your name sits above it because every mode uses it. */
export function Home() {
  const [name, setName] = useState(loadName);
  const keep = () => saveName(name || "P1");

  const items = [
    {
      label: "Quick duel",
      hint: "Open a room and invite a friend",
      primary: true,
      testId: "create-match",
      onSelect: () => {
        keep();
        sessionStorage.setItem("duel:bestOf", "3");
        navigate(`/host/${newRoomId()}`);
      },
    },
    { label: "Join with code", hint: "Got 4 letters from a friend?", testId: "menu-join", onSelect: () => { keep(); navigate("/join"); } },
    { label: "Same keyboard", hint: "Two players, one device", testId: "menu-local", onSelect: () => navigate("/local") },
    { label: "Practice", hint: "Solo runs, beat your best", testId: "menu-practice", onSelect: () => { keep(); navigate("/practice"); } },
    { label: "Leaderboards", hint: "World records and your bests", testId: "menu-records", onSelect: () => navigate("/records") },
    { label: "Settings", hint: "Sound and screen", testId: "menu-settings", onSelect: () => navigate("/settings") },
  ];

  return (
    <div className="home">
      <div className="home__brand">
        <h1 className="title-stamp" aria-label="Duel">DUEL</h1>
        <ol className="how">
          <li><span><b>Quick duel</b> opens a room with a 4-letter code.</span></li>
          <li><span>Your friend picks Join with code, or scans the QR.</span></li>
          <li><span>Best of 3 rounds of 20 to 60 second minigames. Same puzzle for both of you.</span></li>
        </ol>
        <p className="how__games">{GAMES.length} games: {GAMES.map((g) => g.name).join(", ")}.</p>
      </div>
      <div className="home__play">
        <label className="player-name">
          <span className="lead">Player name</span>
          <input
            value={name}
            maxLength={12}
            onChange={(e) => setName(e.target.value)}
            onBlur={keep}
            placeholder="P1"
            data-testid="name-input"
            autoComplete="nickname"
            spellCheck={false}
          />
        </label>
        <Menu label="Main menu" items={items} />
        <p className="menu__keys kbd-hint">Arrow keys to move, Enter to pick</p>
      </div>
    </div>
  );
}
