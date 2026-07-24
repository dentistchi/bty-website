/** @vitest-environment jsdom */
/**
 * TodayPersonalBrief — learner revision-note projection (Slice 3.1B-3N-5C).
 * A REJECTED (needs_revision) Action Contract carries the Host's owner-scoped revision note
 * into the learner's existing "DON'T MISS TODAY" surface. Approve/other categories carry none.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import TodayPersonalBrief from "./TodayPersonalBrief";

function stubBrief(reminders: unknown[]) {
  const brief = { ok: true, brief: null, reminders, hostAttention: [], actionStatus: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(String(url).includes("/api/arena/action-review-queue") ? { items: [] } : brief),
      }),
    ),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TodayPersonalBrief — revision note", () => {
  it("renders the Host revision note under a needs_revision reminder", async () => {
    stubBrief([
      {
        stableId: "action:c1",
        category: "ACTION_REVISION",
        title: "Hold a check-in",
        state: "needs_revision",
        canonicalDeepLink: "/en/app?tab=arena",
        note: "Please name a specific date.",
      },
    ]);
    render(<TodayPersonalBrief locale="en" />);
    const noteEl = await screen.findByTestId("brief-reminder-revision-note");
    expect(noteEl.textContent).toContain("Please name a specific date.");
  });

  it("does not render a revision-note block for non-revision reminders", async () => {
    stubBrief([
      {
        stableId: "action:c2",
        category: "ACTION_DUE",
        title: "Do the thing",
        state: "overdue",
        canonicalDeepLink: "/en/app?tab=arena",
        note: null,
      },
    ]);
    render(<TodayPersonalBrief locale="en" />);
    await screen.findByTestId("brief-reminders");
    expect(screen.queryByTestId("brief-reminder-revision-note")).toBeNull();
  });
});
