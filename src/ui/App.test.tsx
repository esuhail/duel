import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { App } from "./App";

test("home shows the lobby", () => {
  render(<App />);
  expect(screen.getByText("DUEL")).toBeTruthy();
  expect(screen.getByText("Quick duel")).toBeTruthy();
  expect(screen.getByText("Reaction")).toBeTruthy();
});
