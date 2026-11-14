import { useState } from "react";
import { sfx } from "../audio/sfx";
import { loadName, saveName } from "./hooks";
import { Screen } from "./Menu";
import { records } from "./results";
import { updateSettings, useSettings } from "./settings";

export function SettingsScreen() {
  const s = useSettings();
  const [name, setName] = useState(loadName);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <Screen title="Settings">
      <div className="settings">
        <label className="setting">
          <span className="setting__label">Player name</span>
          <span className="setting__hint">Shown to opponents and on the leaderboard.</span>
          <input className="setting__input" value={name} maxLength={12} onChange={(e) => setName(e.target.value)} onBlur={() => saveName(name)} spellCheck={false} />
        </label>

        <div className="setting">
          <span className="setting__label">Sound</span>
          <button className={s.sound ? "toggle is-on" : "toggle"} role="switch" aria-checked={s.sound} onClick={() => { updateSettings({ sound: !s.sound }); if (!s.sound) setTimeout(() => sfx("select"), 0); }}>
            {s.sound ? "On" : "Off"}
          </button>
        </div>

        <label className="setting">
          <span className="setting__label">Volume <span className="setting__value">{Math.round(s.volume * 100)}%</span></span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.volume}
            disabled={!s.sound}
            onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
            onPointerUp={() => sfx("correct", 3)}
            onKeyUp={() => sfx("key")}
          />
        </label>

        <div className="setting">
          <span className="setting__label">Scanlines</span>
          <span className="setting__hint">The CRT line effect over the screen.</span>
          <button className={s.scanlines ? "toggle is-on" : "toggle"} role="switch" aria-checked={s.scanlines} onClick={() => { sfx("key"); updateSettings({ scanlines: !s.scanlines }); }}>
            {s.scanlines ? "On" : "Off"}
          </button>
        </div>

        <div className="setting">
          <span className="setting__label">Personal bests</span>
          <span className="setting__hint">Clears {name || "this player"}'s bests on this device. World records stay.</span>
          <button
            className={confirmReset ? "key key--danger" : "key"}
            onClick={() => {
              if (!confirmReset) { sfx("error"); setConfirmReset(true); return; }
              records.clear(name || "Player");
              setConfirmReset(false);
              sfx("back");
            }}
          >
            {confirmReset ? "Tap again to clear" : "Clear my bests"}
          </button>
        </div>
      </div>
    </Screen>
  );
}
