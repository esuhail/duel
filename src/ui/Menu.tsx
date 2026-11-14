import { useEffect, useRef } from "react";
import { sfx } from "../audio/sfx";
import { navigate } from "./router";

export interface MenuItem {
  label: string;
  hint?: string;
  onSelect: () => void;
  testId?: string;
  primary?: boolean;
}

/**
 * Arcade-style vertical menu. Arrow keys (or W/S) move a cursor, Enter picks,
 * hovering moves the cursor too. The cursor *is* keyboard focus, so screen
 * readers and Tab work without extra code.
 */
export function Menu({ items, label }: { items: MenuItem[]; label: string }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const i = refs.current.findIndex((b) => b === document.activeElement);
      const move = (d: number) => {
        e.preventDefault();
        const next = (i < 0 ? 0 : i + d + items.length) % items.length;
        refs.current[next]?.focus();
        sfx("move");
      };
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") move(i < 0 ? 0 : 1);
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") move(i < 0 ? 0 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length]);

  return (
    <nav className="menu" aria-label={label}>
      {items.map((it, i) => (
        <button
          key={it.label}
          ref={(el) => (refs.current[i] = el)}
          className={it.primary ? "menu__item menu__item--primary" : "menu__item"}
          onMouseEnter={(e) => {
            if (document.activeElement !== e.currentTarget) {
              e.currentTarget.focus({ preventScroll: true });
              sfx("move");
            }
          }}
          onClick={() => {
            sfx("select");
            it.onSelect();
          }}
          data-testid={it.testId}
        >
          <span className="menu__label">{it.label}</span>
          {it.hint && <span className="menu__hint">{it.hint}</span>}
        </button>
      ))}
    </nav>
  );
}

/** Sub-screen frame: title, Back button, Esc goes back. */
export function Screen({ title, children, back = "/" }: { title: string; children: React.ReactNode; back?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLInputElement)) {
        sfx("back");
        navigate(back);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back]);
  return (
    <div className="sub">
      <header className="sub__head">
        <button className="key sub__back" onClick={() => { sfx("back"); navigate(back); }}>Back</button>
        <h1 className="sub__title">{title}</h1>
      </header>
      <div className="sub__body">{children}</div>
    </div>
  );
}
