/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { LearnDoors } from "./LearnDoors";

afterEach(() => cleanup());

describe("LearnDoors", () => {
  it("always shows My learning; shows Create training ONLY when the user can create", () => {
    const onOpenQuickTraining = vi.fn();
    const { rerender } = render(
      <LearnDoors locale="en" canCreate={false} onOpenLearning={() => {}} onCreate={() => {}} onOpenQuickTraining={onOpenQuickTraining} />,
    );
    // R4-R5C6 renamed this door to what it actually opens (completed learning), so the
    // duplicate "start/continue" promise stopped competing with Required Learning. The door's
    // IDENTITY (always present, capability-gated siblings) is what this test guards.
    expect(screen.getByTestId("door-my-learning").textContent).toContain("Learning history");
    expect(screen.queryByTestId("door-create-training")).toBeNull(); // no capability → no create door
    expect(screen.queryByTestId("door-quick-training")).toBeNull();
    expect(screen.queryByTestId("training-creation")).toBeNull();

    rerender(<LearnDoors locale="en" canCreate onOpenLearning={() => {}} onCreate={() => {}} onOpenQuickTraining={onOpenQuickTraining} />);
    const group = within(screen.getByTestId("training-creation"));
    expect(group.getByRole("heading", { name: "Create training" })).toBeTruthy();
    expect(group.getByTestId("door-create-training").textContent).toContain("Build step by step");
    expect(group.getByTestId("door-quick-training").textContent).toContain("Use existing material");
    // no mode switch / role toggle exists
    expect(screen.queryByText(/host mode|learner mode|switch/i)).toBeNull();
  });

  it("routes each door to its action", () => {
    const onOpenLearning = vi.fn();
    const onCreate = vi.fn();
    const onOpenQuickTraining = vi.fn();
    const onOpenEvent = vi.fn();
    render(<LearnDoors locale="en" canCreate canOpenLiveEvent onOpenLearning={onOpenLearning} onCreate={onCreate} onOpenQuickTraining={onOpenQuickTraining} onOpenEvent={onOpenEvent} />);
    fireEvent.click(screen.getByTestId("door-my-learning"));
    expect(onOpenLearning).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("door-quick-training"));
    expect(onOpenQuickTraining).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
    const training = within(screen.getByTestId("training-creation"));
    expect(training.queryByTestId("door-open-event")).toBeNull();
    fireEvent.click(screen.getByTestId("door-open-event"));
    expect(onOpenEvent).toHaveBeenCalledTimes(1);
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
