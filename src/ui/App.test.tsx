import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { App } from "./App";

test("home shows the lobby", () => {
  render(<App />);
  expect(screen.getByText("DUEL")).toBeTruthy();
  expect(screen.getByTestId("create-match").textContent).toContain("Quick duel");
  for (const item of ["Join with code", "Same keyboard", "Practice", "Leaderboards", "Settings"]) {
    expect(screen.getByText(item)).toBeTruthy();
  }
});
