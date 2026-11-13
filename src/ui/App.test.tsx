import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { App } from "./App";

test("home shows the lobby", () => {
  render(<App />);
  expect(screen.getByText("DUEL")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Quick duel" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Reaction" })).toBeTruthy();
});
