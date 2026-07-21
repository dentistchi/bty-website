/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";

const switchAccount = vi.fn(async (..._a: unknown[]) => ({ ok: true, failed: [] as string[] }));
vi.mock("@/lib/native/accountSession", () => ({
  switchAccount: (...a: unknown[]) => switchAccount(...a),
}));

import FoundryRequiredLearning from "./FoundryRequiredLearning";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
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

/** Route-aware mock: session endpoint returns the email; assignments endpoint the list. */
function mockFetch(assignments: unknown[], email: string | null = "ywamer2022@gmail.com") {
  global.fetch = vi.fn(async (url: string) => {
    if (url.includes("/api/auth/session")) {
      return { ok: true, json: async () => (email ? { ok: true, user: { email } } : { ok: false }) };
    }
    return { ok: true, json: async () => ({ ok: true, assignments }) };
  }) as unknown as typeof fetch;
}

describe("FoundryRequiredLearning — learner surface", () => {
  it("Gate B: with only a completed item, Required shows the INTENTIONAL empty state (not an error)", async () => {
    mockFetch([COMPLETED]);
    render(<FoundryRequiredLearning locale="en" />);
    await waitFor(() => expect(screen.getByTestId("foundry-required-learning")).toBeTruthy());
    expect(screen.getByTestId("required-empty")).toBeTruthy();
    expect(screen.getByText("Nothing required right now")).toBeTruthy();
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
    expect(screen.queryByText("Completed")).toBeNull();
    expect(screen.queryByTestId("required-empty")).toBeNull();
  });

  it("shows the compact 'Learning account' line with the authenticated email", async () => {
    mockFetch([COMPLETED], "ywamer2022@gmail.com");
    render(<FoundryRequiredLearning locale="en" />);
    await waitFor(() =>
      expect(screen.getByTestId("foundry-account-email").textContent).toBe("ywamer2022@gmail.com"),
    );
    expect(screen.getByText("Learning account:", { exact: false })).toBeTruthy();
  });

  it("the Foundry 'Switch' calls the SAME shared switchAccount(returnTab=foundry)", async () => {
    mockFetch([COMPLETED]);
    render(<FoundryRequiredLearning locale="en" />);
    await waitFor(() => screen.getByTestId("foundry-learning-account"));
    fireEvent.click(screen.getByText("Switch"));
    await waitFor(() =>
      expect(switchAccount).toHaveBeenCalledWith({ locale: "en", returnTab: "foundry" }),
    );
  });

  it("Korean copy renders for the empty state", async () => {
    mockFetch([], null);
    render(<FoundryRequiredLearning locale="ko" />);
    await waitFor(() => expect(screen.getByText("지금 필요한 학습이 없습니다")).toBeTruthy());
    expect(screen.getByText("필수 학습")).toBeTruthy();
  });

  it("renders nothing before the first assignments response resolves (bounded hold)", () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    const { container } = render(<FoundryRequiredLearning locale="en" />);
    expect(container.querySelector('[data-testid="foundry-required-learning"]')).toBeNull();
  });
});
