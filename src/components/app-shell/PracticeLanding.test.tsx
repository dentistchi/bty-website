/** @vitest-environment jsdom */
/** App Shell V1 Phase 6 — Practice landing: Arena practice + Field Actions + Live/QR placeholders. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

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

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const base = {
  locale: "en",
  lockedTag: "tag",
  lockedBody: "body",
};

describe("PracticeLanding", () => {
  it("shows Clinical cases directly between Practice situations and Action plans", () => {
    render(<PracticeLanding {...base} />);
    const doors = within(screen.getByTestId("practice-landing")).getAllByRole("button");
    expect(doors.map(door => door.dataset.testid)).toEqual([
      "practice-arena-entry", "practice-clinical-entry", "practice-field-actions", "practice-live",
    ]);
    expect(doors[0].textContent).toContain("Practice situations");
    expect(doors[1].textContent).toContain("Clinical cases");
    expect(doors[1].textContent).toContain("Interview a patient, order tests, and decide treatment.");
    expect(doors[2].textContent).toContain("Action plans");
    expect(doors[3].textContent).toContain("Live sessions");
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });

  it.each([ ["en", "Clinical cases", "Back"], ["ko", "임상 케이스", "뒤로"] ])(
    "%s opens the real encounter in-shell and Back restores the landing",
    async (locale, title, back) => {
      vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => Response.json(
        init?.method === "POST" ? { ok: true, status: "active" } : { ok: true, traces: [] },
      )));
      const location = window.location.href;
      render(<PracticeLanding {...base} locale={locale} />);
      const entry = screen.getByTestId("practice-clinical-entry");
      expect(entry.textContent).toContain(title);
      if (locale === "ko") expect(entry.textContent).toContain("환자를 문진하고 검사한 뒤 치료를 결정합니다.");
      fireEvent.click(entry);
      expect(screen.queryByTestId("practice-landing")).toBeNull();
      expect(within(screen.getByTestId("practice-clinical")).getByText("I fell earlier today and broke my two front teeth.")).toBeTruthy();
      await screen.findByText("Saved to server");
      expect(screen.getByLabelText("Clinical encounter message")).toBeTruthy();
      expect(window.location.href).toBe(location);
      expect(screen.queryAllByRole("tab")).toHaveLength(0);
      expect(screen.getByTestId("practice-clinical-back").textContent).toContain(back);
      fireEvent.click(screen.getByTestId("practice-clinical-back"));
      expect(screen.getByTestId("practice-landing")).toBeTruthy();
      expect(screen.queryByLabelText("Clinical encounter message")).toBeNull();
    },
  );

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
