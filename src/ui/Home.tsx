import { useEffect, useState } from "react";
import { GAMES } from "../games/registry";
import { CODE_ALPHABET, CODE_LENGTH, newRoomId, normalizeCode } from "../net/transport";
import { loadName, saveName } from "./hooks";
import { navigate } from "./router";

/**
 * The lobby: a title, a 4-letter code you can punch in, and one button.
 * Typing on a physical keyboard works too; the on-screen keys are for phones
 * (and avoid the phone keyboard covering half the screen).
 */
export function Home() {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState("");

  const press = (k: string) => {
    if (k === "⌫") return setCode((c) => c.slice(0, -1));
    setCode((c) => normalizeCode(c + k));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
      if (e.key === "Backspace") press("⌫");
      else if (e.key.length === 1 && CODE_ALPHABET.includes(e.key.toUpperCase())) press(e.key.toUpperCase());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A full code joins immediately: no extra button to find.
  useEffect(() => {
    if (code.length === CODE_LENGTH) {
      saveName(name || "P2");
      navigate(`/join/${code}`);
    }
  }, [code, name]);

  const quickDuel = () => {
    saveName(name || "P1");
    sessionStorage.setItem("duel:bestOf", "3");
    navigate(`/host/${newRoomId()}`);
  };

  return (
    <div className="home">
      <div className="home__brand">
        <h1 className="title-stamp" aria-label="Duel">DUEL</h1>
        <ol className="how">
          <li><span><b>Quick duel</b> opens a room with a 4-letter code.</span></li>
          <li><span>Your friend punches in the code or scans the QR.</span></li>
          <li><span>Best of 3 rounds of 20 to 60 second minigames. Same puzzle for both of you.</span></li>
        </ol>
        <p className="how__games">{GAMES.length} games: {GAMES.map((g) => g.name).join(", ")}.</p>
      </div>
      <div className="home__play">

      <section className="join" aria-label="Join a room">
        <p className="lead">Got a code? Punch it in.</p>
        <div className="code code--input" data-testid="code-input">
          {Array.from({ length: CODE_LENGTH }, (_, i) => (
            <span key={i} className={i === code.length ? "code__cell is-next" : "code__cell"}>{code[i] ?? ""}</span>
          ))}
        </div>
        <div className="keypad">
          {[...CODE_ALPHABET, "⌫"].map((k) => (
            <button key={k} className="keycap" onPointerDown={(e) => { e.preventDefault(); press(k); }} aria-label={k === "⌫" ? "Delete" : k}>
              {k}
            </button>
          ))}
        </div>
      </section>

      <button className="trigger trigger--huge" onClick={quickDuel} data-testid="create-match">Quick duel</button>

      </div>
      <footer className="home__more">
        <label className="name-field">
          Name
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="P1" data-testid="name-input" />
        </label>
        <a href="#/local" className="textlink">Same keyboard</a>
        <span className="home__practice">
          Practice:{" "}
          {GAMES.map((g) => (
            <a key={g.id} href={`#/practice/${g.id}`} className="textlink">{g.name}</a>
          ))}
        </span>
      </footer>
    </div>
  );
}
