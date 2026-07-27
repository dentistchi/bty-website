/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import LearnHeader from "./LearnHeader";

afterEach(() => cleanup());

/**
 * Slice 3.2C-B3A.2 — Learn information hygiene: the header carries only identity.
 * The duplicate "My learning" pill and the internal "Powered by BTY Foundry" line
 * are removed (My learning lives in the single LearnDoors entry below).
 */
describe("LearnHeader — B3A.2 hygiene", () => {
  it("shows the Learn identity but NOT a duplicate My-learning pill or Foundry footer", () => {
    render(<LearnHeader locale="en" onOpenMyLearning={() => {}} />);
    expect(screen.getByTestId("learn-header")).toBeTruthy();
    expect(screen.queryByTestId("learn-my-learning")).toBeNull(); // no duplicate pill
    const text = screen.getByTestId("learn-header").textContent ?? "";
    expect(text).not.toContain("Powered by BTY Foundry");
    expect(text).not.toContain("Foundry");
  });
});
