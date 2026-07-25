/** @vitest-environment jsdom */
/** App Shell V1 Phase 6 — Practice landing: Arena practice + Field Actions + Live/QR placeholders. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// Mock the heavy in-shell Arena runtime — this test only proves the landing wiring, not the player.
vi.mock("@/components/app-shell/ArenaRoom", () => ({
  ArenaRoom: () => <div data-testid="arena-room-mock">arena</div>,
}));

import PracticeLanding from "./PracticeLanding";

afterEach(cleanup);

const base = {
  locale: "en",
  lockedTag: "tag",
  lockedBody: "body",
  onGoFieldActions: () => {},
};

describe("PracticeLanding", () => {
  it("shows Arena practice + Field Actions, and Live Experiences as a Coming next placeholder", () => {
    render(<PracticeLanding {...base} />);
    expect(screen.getByTestId("practice-arena-entry")).toBeTruthy();
    expect(screen.getByTestId("practice-field-actions")).toBeTruthy();
    const live = screen.getByTestId("practice-live");
    expect(live.textContent).toContain("Coming next");
    expect(live.hasAttribute("disabled")).toBe(true);
  });

  it("Arena practice opens the in-shell Arena runtime in place (no navigation)", () => {
    render(<PracticeLanding {...base} />);
    fireEvent.click(screen.getByTestId("practice-arena-entry"));
    expect(screen.getByTestId("arena-room-mock")).toBeTruthy();
    // A back control returns to the landing.
    fireEvent.click(screen.getByTestId("practice-arena-back"));
    expect(screen.getByTestId("practice-landing")).toBeTruthy();
  });

  it("Field Actions is reachable (routes to Today via callback)", () => {
    const onGoFieldActions = vi.fn();
    render(<PracticeLanding {...base} onGoFieldActions={onGoFieldActions} />);
    fireEvent.click(screen.getByTestId("practice-field-actions"));
    expect(onGoFieldActions).toHaveBeenCalledOnce();
  });

  it("QR entry respects permissions — hidden unless authorized", () => {
    const { rerender } = render(<PracticeLanding {...base} qrAuthorized={false} />);
    expect(screen.queryByTestId("practice-qr")).toBeNull();
    rerender(<PracticeLanding {...base} qrAuthorized />);
    expect(screen.getByTestId("practice-qr")).toBeTruthy();
  });

  it("does not expose internal runtime-state vocabulary on the landing", () => {
    const { container } = render(<PracticeLanding {...base} />);
    expect(container.textContent).not.toMatch(/pending_outcome|complete_verified|arena_run|reexposure|scenario_signal/i);
  });
});
