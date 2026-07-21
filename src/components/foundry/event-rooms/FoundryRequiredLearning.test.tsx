/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import FoundryRequiredLearning from "./FoundryRequiredLearning";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ASSIGNED = {
  assignmentId: "a-req",
  eventId: "e-req",
  status: "assigned" as const,
  title: "Safety Basics",
  assignedAt: "2026-07-01T00:00:00Z",
  completedAt: null,
  roomUrl: "https://app.example/f/btyfr1.req",
  participationMode: "assigned_overlay" as const,
};
const COMPLETED = {
  assignmentId: "a-done",
  eventId: "e-done",
  status: "completed" as const,
  title: "Onboarding Care",
  assignedAt: "2026-06-01T00:00:00Z",
  completedAt: "2026-06-10T00:00:00Z",
  roomUrl: "https://app.example/f/btyfr1.done",
  participationMode: "assigned_overlay" as const,
};

function mockFetch(assignments: unknown[]) {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ ok: true, assignments }),
  })) as unknown as typeof fetch;
}

describe("FoundryRequiredLearning — learner surface", () => {
  it("Gate B: with only a completed item, Required shows the INTENTIONAL empty state (not an error)", async () => {
    mockFetch([COMPLETED]);
    render(<FoundryRequiredLearning locale="en" />);
    await waitFor(() => expect(screen.getByTestId("foundry-required-learning")).toBeTruthy());
    expect(screen.getByTestId("required-empty")).toBeTruthy();
    expect(screen.getByText("Nothing required right now")).toBeTruthy();
    // Completed section present with a safe View link to the same Room URL.
    expect(screen.getByText("Onboarding Care")).toBeTruthy();
    const view = screen.getByText("View learning").closest("a");
    expect(view?.getAttribute("href")).toBe(COMPLETED.roomUrl);
  });

  it("an assigned item renders under Required with a same-origin Start link; no Completed section", async () => {
    mockFetch([ASSIGNED]);
    render(<FoundryRequiredLearning locale="en" />);
    await waitFor(() => expect(screen.getByText("Safety Basics")).toBeTruthy());
    const start = screen.getByText("Start learning").closest("a");
    expect(start?.getAttribute("href")).toBe(ASSIGNED.roomUrl);
    // No optimistic completion: an assigned item never renders as Completed.
    expect(screen.queryByText("Completed")).toBeNull();
    expect(screen.queryByTestId("required-empty")).toBeNull();
  });

  it("Korean copy renders for the empty state", async () => {
    mockFetch([]);
    render(<FoundryRequiredLearning locale="ko" />);
    await waitFor(() => expect(screen.getByText("지금 필요한 학습이 없습니다")).toBeTruthy());
    expect(screen.getByText("필수 학습")).toBeTruthy();
  });

  it("renders nothing before the first response resolves (bounded hold, no skeleton)", () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    const { container } = render(<FoundryRequiredLearning locale="en" />);
    expect(container.querySelector('[data-testid="foundry-required-learning"]')).toBeNull();
  });
});
