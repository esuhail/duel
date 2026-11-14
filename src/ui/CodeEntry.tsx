import { useEffect, useState } from "react";
import { sfx } from "../audio/sfx";
import { CODE_ALPHABET, CODE_LENGTH, normalizeCode } from "../net/transport";
import { Screen } from "./Menu";
import { navigate } from "./router";

/** Punch in a friend's 4-letter room code; a full code joins straight away. */
export function CodeEntry() {
  const [code, setCode] = useState("");

  const press = (k: string) => {
    sfx("key");
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

  useEffect(() => {
    if (code.length === CODE_LENGTH) {
      sfx("select");
      navigate(`/join/${code}`);
    }
  }, [code]);

  return (
    <Screen title="Join with code">
      <div className="join">
        <p className="lead">Type the 4 letters your friend sees.</p>
        <div className="code code--input" data-testid="code-input">
          {Array.from({ length: CODE_LENGTH }, (_, i) => (
            <span key={`${i}${code[i] ?? ""}`} className={i === code.length ? "code__cell is-next" : code[i] ? "code__cell is-filled" : "code__cell"}>{code[i] ?? ""}</span>
          ))}
        </div>
        <div className="keypad">
          {[...CODE_ALPHABET, "⌫"].map((k) => (
            <button key={k} className="keycap" onPointerDown={(e) => { e.preventDefault(); press(k); }} aria-label={k === "⌫" ? "Delete" : k}>
              {k}
            </button>
          ))}
        </div>
      </div>
    </Screen>
  );
}
