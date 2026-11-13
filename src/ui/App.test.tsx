import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { App } from "./App";

test("home lists practice games", () => {
  render(<App />);
  expect(screen.getByText("Duel!")).toBeTruthy();
  expect(screen.getByText(/Reaction/)).toBeTruthy();
});
