/** @vitest-environment jsdom */
/**
 * STAB-06-FIX-03 (U3): terminal completion surface renders the report confirmation
 * and advances only on the explicit "Next scenario" CTA (no auto-next).
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArenaActionCompleted } from "./ArenaActionCompleted";

describe("ArenaActionCompleted", () => {
  afterEach(() => cleanup());

  it("renders title, lead, and an enabled Next CTA (en)", () => {
    render(<ArenaActionCompleted locale="en" onNext={vi.fn()} />);
    expect(screen.getByTestId("arena-action-completed")).toBeTruthy();
    expect(screen.getByText("Action reported")).toBeTruthy();
    expect(screen.getByText("Your XP has been applied.")).toBeTruthy();
    const btn = screen.getByTestId("arena-action-completed-next") as HTMLButtonElement;
    expect(btn.textContent).toBe("Next scenario");
    expect(btn.disabled).toBe(false);
  });

  it("renders ko copy", () => {
    render(<ArenaActionCompleted locale="ko" onNext={vi.fn()} />);
    expect(screen.getByText("행동 보고됨")).toBeTruthy();
    expect(screen.getByTestId("arena-action-completed-next").textContent).toBe("다음 시나리오로");
  });

  it("invokes onNext exactly once when CTA is clicked", () => {
    const onNext = vi.fn();
    render(<ArenaActionCompleted locale="en" onNext={onNext} />);
    fireEvent.click(screen.getByTestId("arena-action-completed-next"));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("disables the CTA while nextLoading", () => {
    const onNext = vi.fn();
    render(<ArenaActionCompleted locale="en" onNext={onNext} nextLoading />);
    const btn = screen.getByTestId("arena-action-completed-next") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onNext).not.toHaveBeenCalled();
  });
});
