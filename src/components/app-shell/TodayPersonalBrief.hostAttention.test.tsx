/** @vitest-environment jsdom */
/**
 * TodayPersonalBrief — LEADERSHIP ATTENTION section (Slice 3.1B-3L, tests 27–33).
 * The Host section renders separately from DON'T MISS TODAY, only when items exist; it shows the
 * first 3 with an in-place "Show all N" expansion (session-local, NOT a dismissal); every row is a
 * deep-link anchor (read-only navigation — no review buttons in Today).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import TodayPersonalBrief from "./TodayPersonalBrief";

function mockBrief(payload: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) }),
  );
}

const learnerReminder = {
  stableId: "followup:abc",
  category: "FOLLOW_UP_DUE",
  title: "7-day follow-up · Consent",
  state: "overdue",
  canonicalDeepLink: "/en/app?tab=foundry&followup=abc",
};

function hostItem(n: number, category = "SHARED_REVIEW_DUE") {
  return {
    stableId: `host-shared-review:pr${n}`,
    category,
    eventId: "e1",
    focusId: `pr${n}`,
    participantDisplayName: `Person ${n}`,
    trainingTitle: "Consent Conversations",
    reason: "A learner's shared understanding is ready for review",
    sourceTimestamp: `2026-07-1${n}T06:00:00.000Z`,
    deepLink: `/en/app?tab=foundry&event=e1&section=shared-understanding&focus=pr${n}`,
  };
}

afterEach(() => cleanup());
beforeEach(() => vi.restoreAllMocks());

describe("TodayPersonalBrief — Leadership Attention", () => {
  it("(30) does not render the section for a non-Host (hostAttention empty)", async () => {
    mockBrief({ ok: true, brief: null, reminders: [learnerReminder], hostAttention: [] });
    render(<TodayPersonalBrief locale="en" />);
    await screen.findByTestId("brief-reminders");
    expect(screen.queryByTestId("brief-host-attention")).toBeNull();
  });

  it("(27) renders LEADERSHIP ATTENTION separately from DON'T MISS TODAY", async () => {
    mockBrief({ ok: true, brief: null, reminders: [learnerReminder], hostAttention: [hostItem(1)] });
    render(<TodayPersonalBrief locale="en" />);
    await screen.findByTestId("brief-host-attention");
    // Both sections present and distinct.
    expect(screen.getByTestId("brief-reminders")).toBeTruthy();
    expect(screen.getByText("LEADERSHIP ATTENTION")).toBeTruthy();
    // Host row is a deep-link anchor (read-only navigation), NOT a review button.
    const row = screen.getByTestId("host-attention-row");
    const anchor = row.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("/en/app?tab=foundry&event=e1&section=shared-understanding&focus=pr1");
    expect(row.querySelector("button")).toBeNull();
  });

  it("(31,32) shows the first 3 items, then reveals all on Show all N", async () => {
    const items = [hostItem(1), hostItem(2), hostItem(3), hostItem(4), hostItem(5)];
    mockBrief({ ok: true, brief: null, reminders: [], hostAttention: items });
    render(<TodayPersonalBrief locale="en" />);
    await screen.findByTestId("brief-host-attention");
    expect(screen.getAllByTestId("host-attention-row")).toHaveLength(3);
    fireEvent.click(screen.getByTestId("host-attention-toggle"));
    await waitFor(() => expect(screen.getAllByTestId("host-attention-row")).toHaveLength(5));
    // Toggle is reversible presentation (Show less) — never a dismissal.
    expect(screen.getByTestId("host-attention-toggle").textContent).toContain("Show less");
  });

  it("(33) exposes no dismissal control on a row (no remove/dismiss/hide affordance)", async () => {
    mockBrief({ ok: true, brief: null, reminders: [], hostAttention: [hostItem(1)] });
    render(<TodayPersonalBrief locale="en" />);
    const row = await screen.findByTestId("host-attention-row");
    // The only interactive element inside a row is the navigation anchor.
    expect(row.querySelectorAll("button")).toHaveLength(0);
    expect(row.textContent?.toLowerCase()).not.toContain("dismiss");
  });

  it("renders nothing when brief, reminders, and hostAttention are all empty", async () => {
    mockBrief({ ok: true, brief: null, reminders: [], hostAttention: [] });
    const { container } = render(<TodayPersonalBrief locale="en" />);
    await waitFor(() => expect(container.querySelector('[data-testid="today-personal-brief"]')).toBeNull());
  });
});
