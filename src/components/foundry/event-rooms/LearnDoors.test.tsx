/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { LearnDoors } from "./LearnDoors";

afterEach(() => cleanup());

describe("LearnDoors — two-door first-time entry (B3A.1)", () => {
  it("always shows My learning; shows Create training ONLY when the user can create", () => {
    const { rerender } = render(
      <LearnDoors locale="en" canCreate={false} onOpenLearning={() => {}} onCreate={() => {}} />,
    );
    // R4-R5C6 renamed this door to what it actually opens (completed learning), so the
    // duplicate "start/continue" promise stopped competing with Required Learning. The door's
    // IDENTITY (always present, capability-gated siblings) is what this test guards.
    expect(screen.getByTestId("door-my-learning").textContent).toContain("Learning history");
    expect(screen.queryByTestId("door-create-training")).toBeNull(); // no capability → no create door

    rerender(<LearnDoors locale="en" canCreate onOpenLearning={() => {}} onCreate={() => {}} />);
    expect(screen.getByTestId("door-create-training").textContent).toContain("Create training");
    // no mode switch / role toggle exists
    expect(screen.queryByText(/host mode|learner mode|switch/i)).toBeNull();
  });

  it("routes each door to its action", () => {
    const onOpenLearning = vi.fn();
    const onCreate = vi.fn();
    render(<LearnDoors locale="en" canCreate onOpenLearning={onOpenLearning} onCreate={onCreate} />);
    fireEvent.click(screen.getByTestId("door-my-learning"));
    expect(onOpenLearning).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("door-create-training"));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("uses no internal architecture terms (Foundry/Program/Run/Module/Journey/lineage)", () => {
    render(<LearnDoors locale="en" canCreate onOpenLearning={() => {}} onCreate={() => {}} />);
    const text = screen.getByTestId("learn-doors").textContent ?? "";
    for (const term of ["Foundry", "Program", "Run", "Module", "Journey", "lineage", "Event room"]) {
      expect(text).not.toContain(term);
    }
  });
});
