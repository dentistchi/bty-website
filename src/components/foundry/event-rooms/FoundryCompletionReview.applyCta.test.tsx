/** @vitest-environment jsdom */
/**
 * FoundryCompletionReview — "Apply this in real life" CTA (Slice 3.1B-3N-5C.3 Gate-0 fix).
 * This is the ACTUAL physical-device completed-learning detail (reached via "Review Learning").
 * A present, owned, completed review is the only precondition; the CTA opens the Today-owned
 * Field Action producer in the same shell, keyed on assignmentId. No /bty-arena.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import FoundryCompletionReview from "./FoundryCompletionReview";

function mockReview(review: unknown | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: review != null,
        json: () => Promise.resolve(review != null ? { ok: true, review } : { ok: false, error: "not_found" }),
      } as Response),
    ),
  );
}

const OWNED_COMPLETED = {
  assignmentId: "assign-1",
  eventId: "event-1",
  title: "Leadership Attention Device Test",
  contentType: "youtube",
  completedAt: "2026-07-22T00:00:00Z",
  completionState: "pass",
  responseText: "My reflection.",
  reflection: null,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("FoundryCompletionReview — Apply CTA", () => {
  it("renders the CTA for a completed learner-owned assignment, keyed on assignmentId (no /bty-arena)", async () => {
    mockReview(OWNED_COMPLETED);
    render(<FoundryCompletionReview assignmentId="assign-1" locale="en" onBack={() => {}} />);
    const cta = await screen.findByTestId("completion-review-apply-cta");
    expect(cta.getAttribute("href")).toBe("/en/app?tab=today&fieldActionAssignment=assign-1");
    expect(cta.getAttribute("href")).not.toContain("/bty-arena");
    expect(cta.textContent).toContain("Apply this in real life");
  });

  it("does NOT render the CTA when the review is unavailable (not owned / not completed → 404)", async () => {
    mockReview(null);
    render(<FoundryCompletionReview assignmentId="assign-1" locale="en" onBack={() => {}} />);
    expect(await screen.findByTestId("review-error")).toBeTruthy();
    expect(screen.queryByTestId("completion-review-apply-cta")).toBeNull();
  });

  it("KO locale renders the localized CTA", async () => {
    mockReview(OWNED_COMPLETED);
    render(<FoundryCompletionReview assignmentId="assign-1" locale="ko" onBack={() => {}} />);
    const cta = await screen.findByTestId("completion-review-apply-cta");
    expect(cta.textContent).toContain("현실에서 적용하기");
  });
});
