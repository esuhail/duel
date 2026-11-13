import { useState } from "react";
import { THEMES, setTheme, useTheme } from "./theme";

/** Temporary style switcher, used while picking a direction. */
export function ThemePicker() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <div className={open ? "picker is-open" : "picker"}>
      {open && (
        <ul className="picker__list">
          {THEMES.map((t) => (
            <li key={t.id}>
              <button className={theme === t.id ? "picker__opt is-on" : "picker__opt"} onClick={() => setTheme(t.id)} data-testid={`theme-${t.id}`}>
                <span className="picker__swatch">{t.swatch.map((c) => <i key={c} style={{ background: c }} />)}</span>
                <span className="picker__name">{t.name}</span>
                <span className="picker__note">{t.note}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="picker__toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        Style: {THEMES.find((t) => t.id === theme)!.name}
      </button>
    </div>
  );
}
