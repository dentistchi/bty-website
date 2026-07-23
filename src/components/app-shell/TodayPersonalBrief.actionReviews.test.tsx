/** @vitest-environment jsdom */
/**
 * TodayPersonalBrief — ACTION REVIEWS section (Slice 3.1B-3N Phase 5B, tests 34–41).
 * Renders only when the actor has reviewable items; top-3 + Show all N / Show less; every row is an
 * in-shell deep-link anchor (?tab=today&actionReview=<id>) — NO decision buttons in Today.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import TodayPersonalBrief from "./TodayPersonalBrief";

const learnerReminder = {
  stableId: "followup:abc",
  category: "FOLLOW_UP_DUE",
  title: "7-day follow-up",
  state: "overdue",
  canonicalDeepLink: "/en/app?tab=foundry&followup=abc",
};

function stub(reviews: unknown[]) {
  const brief = { ok: true, brief: null, reminders: [learnerReminder], hostAttention: [], actionStatus: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(String(url).includes("/api/arena/action-reviews") ? { items: reviews } : brief),
      }),
    ),
  );
}

function reviewItem(n: number) {
  return {
    actionContractId: `c${n}`,
    learnerLabel: `Learner ${n}`,
    actionSummary: "Do the thing",
    submittedAt: `2026-07-0${n}T00:00:00Z`,
    originalDeadline: `2026-07-1${n}T00:00:00Z`,
    verificationMode: "hybrid",
    statusLabel: "Awaiting your review",
  };
}

afterEach(() => cleanup());
beforeEach(() => vi.restoreAllMocks());

describe("TodayPersonalBrief — Action reviews", () => {
  it("(34) omits the section when there are zero reviewable items", async () => {
    stub([]);
    render(<TodayPersonalBrief locale="en" />);
    await screen.findByTestId("brief-reminders");
    expect(screen.queryByTestId("brief-action-reviews")).toBeNull();
  });

  it("(34) renders ACTION REVIEWS with its own heading when items exist", async () => {
    stub([reviewItem(1)]);
    render(<TodayPersonalBrief locale="en" />);
    await screen.findByTestId("brief-action-reviews");
    expect(screen.getByText("ACTION REVIEWS")).toBeTruthy();
  });

  it("(37)(39) each row is an in-shell anchor and has NO decision button", async () => {
    stub([reviewItem(1)]);
    render(<TodayPersonalBrief locale="en" />);
    await screen.findByTestId("brief-action-reviews");
    const row = screen.getByTestId("action-review-row");
    const anchor = row.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("/en/app?tab=today&actionReview=c1");
    expect(row.querySelector("button")).toBeNull();
    // no Approve / Request revision affordance anywhere in Today
    expect(screen.queryByText(/approve/i)).toBeNull();
    expect(screen.queryByText(/revision/i)).toBeNull();
  });

  it("(35)(36) shows top 3, expands to all N, and collapses again", async () => {
    stub([1, 2, 3, 4, 5].map(reviewItem));
    render(<TodayPersonalBrief locale="en" />);
    await screen.findByTestId("brief-action-reviews");
    expect(screen.getAllByTestId("action-review-row")).toHaveLength(3);
    fireEvent.click(screen.getByTestId("action-review-toggle"));
    expect(screen.getAllByTestId("action-review-row")).toHaveLength(5);
    fireEvent.click(screen.getByTestId("action-review-toggle"));
    expect(screen.getAllByTestId("action-review-row")).toHaveLength(3);
  });

  it("(40) does not disturb the reminders section", async () => {
    stub([reviewItem(1)]);
    render(<TodayPersonalBrief locale="en" />);
    await screen.findByTestId("brief-action-reviews");
    expect(screen.getByTestId("brief-reminders")).toBeTruthy();
  });
});
