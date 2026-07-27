/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";

import FoundryRequiredLearning from "./FoundryRequiredLearning";

const onOpenReview = vi.fn();

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
  it("Gate B: only a completed item → Required empty state + a COLLAPSED Completed disclosure (count only)", async () => {
    mockFetch([COMPLETED]);
    render(<FoundryRequiredLearning locale="en" onOpenReview={onOpenReview} />);
    await waitFor(() => expect(screen.getByTestId("foundry-required-learning")).toBeTruthy());
    expect(screen.getByTestId("required-empty")).toBeTruthy();
    expect(screen.getByText("Nothing required right now")).toBeTruthy();
    // Completed is a compact disclosure showing the count; cards NOT rendered while collapsed.
    expect(screen.getByTestId("completed-disclosure").textContent).toContain("Completed (1)");
    expect(screen.queryByTestId("completed-list")).toBeNull();
    expect(screen.queryByText("Onboarding Care")).toBeNull();
  });

  it("Completed collapsed by default; expand reveals cards + Review learning (never links to the Room); collapse hides", async () => {
    mockFetch([COMPLETED]);
    render(<FoundryRequiredLearning locale="en" onOpenReview={onOpenReview} />);
    const disc = await screen.findByTestId("completed-disclosure");
    expect(disc.getAttribute("aria-expanded")).toBe("false"); // collapsed by default (accessible)
    fireEvent.click(disc);
    expect(screen.getByTestId("completed-disclosure").getAttribute("aria-expanded")).toBe("true");
    await screen.findByTestId("completed-list");
    const anchors = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
    expect(anchors.some((h) => h.includes("/f/"))).toBe(false); // review never links to the anonymous Room
    fireEvent.click(screen.getByText("Review learning"));
    expect(onOpenReview).toHaveBeenCalledWith("a-done");
    fireEvent.click(screen.getByTestId("completed-disclosure")); // collapse again
    expect(screen.queryByTestId("completed-list")).toBeNull();
  });

  it("Required 'Start learning' opens the Room with a sanitized return-to-Foundry target", async () => {
    mockFetch([ASSIGNED]);
    render(<FoundryRequiredLearning locale="en" onOpenReview={onOpenReview} />);
    await waitFor(() => expect(screen.getByText("Safety Basics")).toBeTruthy());
    const start = screen.getByText("Start learning").closest("a");
    const href = start?.getAttribute("href") ?? "";
    expect(href.startsWith(ASSIGNED.roomUrl)).toBe(true);
    expect(href).toContain(`return=${encodeURIComponent("/en/app?tab=foundry")}`);
    expect(screen.queryByText("Completed")).toBeNull();
    expect(screen.queryByTestId("required-empty")).toBeNull();
  });

  it("B3A.2C hygiene: NO account email block and NO duplicate My-learning pill in the content area", async () => {
    mockFetch([COMPLETED], "ywamer2022@gmail.com");
    render(<FoundryRequiredLearning locale="en" />);
    await waitFor(() => screen.getByTestId("foundry-required-learning"));
    expect(screen.queryByTestId("foundry-learning-account")).toBeNull();
    expect(screen.queryByTestId("foundry-account-email")).toBeNull();
    expect(screen.queryByText("Learning account:", { exact: false })).toBeNull();
    expect(screen.queryByTestId("open-my-learning")).toBeNull(); // no duplicate My-learning control
    expect(screen.queryByText("Switch")).toBeNull();
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
