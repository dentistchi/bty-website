/** @vitest-environment jsdom */
/** App Shell V1 Phase 6 — Practice landing: Arena practice + Field Actions + Live/QR placeholders. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// Mock the heavy in-shell subviews — this test only proves the landing wiring, not their internals.
vi.mock("@/components/app-shell/ArenaRoom", () => ({
  ArenaRoom: () => <div data-testid="arena-room-mock">arena</div>,
}));
vi.mock("@/components/app-shell/FieldActionsFocus", () => ({
  default: ({ onBack }: { onBack: () => void }) => (
    <div data-testid="field-actions-focus-mock">
      <button data-testid="fa-mock-back" onClick={onBack}>back</button>
    </div>
  ),
}));

import PracticeLanding from "./PracticeLanding";

afterEach(cleanup);

const base = {
  locale: "en",
  lockedTag: "tag",
  lockedBody: "body",
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

  it("Field Actions opens the focused in-shell surface (never navigates to generic Today)", () => {
    render(<PracticeLanding {...base} />);
    fireEvent.click(screen.getByTestId("practice-field-actions"));
    // In-shell subview mounts; the landing is replaced, no Today/route navigation.
    expect(screen.getByTestId("field-actions-focus-mock")).toBeTruthy();
    expect(screen.queryByTestId("practice-landing")).toBeNull();
    // Back returns to the Practice landing.
    fireEvent.click(screen.getByTestId("fa-mock-back"));
    expect(screen.getByTestId("practice-landing")).toBeTruthy();
  });

  it("deep-link focus opens the focused Field Actions surface directly", () => {
    render(<PracticeLanding {...base} initialFieldActionId="abc-1234-5678-9012-3456" />);
    expect(screen.getByTestId("field-actions-focus-mock")).toBeTruthy();
    expect(screen.queryByTestId("practice-landing")).toBeNull();
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
