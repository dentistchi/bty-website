/** @vitest-environment jsdom */
/**
 * TodayPersonalBrief — Field Action STAGE COUNTS (Slice 3.1B-3N-5D.1, Phase 3).
 * Operational, reviewer-authority-scoped counts render from /api/arena/action-review-queue's
 * stageCounts; they show even below cohort N=5 (responsibility-scoped, not anonymous analytics),
 * appear even when the actionable queue is empty, and never use prohibited evidence wording.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import TodayPersonalBrief from "./TodayPersonalBrief";

function stub(payload: { items?: unknown[]; stageCounts?: unknown }) {
  const brief = { ok: true, brief: null, reminders: [], hostAttention: [], actionStatus: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            String(url).includes("/api/arena/action-review-queue")
              ? { items: payload.items ?? [], stageCounts: payload.stageCounts }
              : brief,
          ),
      }),
    ),
  );
}

afterEach(() => cleanup());
beforeEach(() => vi.restoreAllMocks());

const PROHIBITED = /\b(applied|verified application|observed|sustained|behavior changed|capability mastered)\b/i;

describe("TodayPersonalBrief — Field Action stage counts", () => {
  it("renders the four operational counts even when the actionable queue is empty", async () => {
    stub({ items: [], stageCounts: { verificationPending: 2, needsRevision: 1, reviewedAccepted: 3, awaitingResolution: 0 } });
    render(<TodayPersonalBrief locale="en" />);
    await screen.findByTestId("action-review-stage-counts");
    expect(screen.getByTestId("stage-count-verificationPending").getAttribute("data-count")).toBe("2");
    expect(screen.getByTestId("stage-count-needsRevision").getAttribute("data-count")).toBe("1");
    expect(screen.getByTestId("stage-count-reviewedAccepted").getAttribute("data-count")).toBe("3");
    expect(screen.getByTestId("stage-count-awaitingResolution").getAttribute("data-count")).toBe("0");
    // no actionable queue rows
    expect(screen.queryByTestId("brief-action-reviews")).toBeNull();
  });

  it("shows a single reviewed plan below N=5 (no min-N suppression on operational counts)", async () => {
    stub({ items: [], stageCounts: { verificationPending: 0, needsRevision: 0, reviewedAccepted: 1, awaitingResolution: 0 } });
    render(<TodayPersonalBrief locale="en" />);
    await screen.findByTestId("action-review-stage-counts");
    expect(screen.getByTestId("stage-count-reviewedAccepted").getAttribute("data-count")).toBe("1");
    expect(screen.getByText("Reviewed action plans")).toBeTruthy();
  });

  it("uses no prohibited evidence wording (E3 label discipline)", async () => {
    stub({ items: [], stageCounts: { verificationPending: 1, needsRevision: 1, reviewedAccepted: 1, awaitingResolution: 1 } });
    render(<TodayPersonalBrief locale="en" />);
    const block = await screen.findByTestId("action-review-stage-counts");
    expect(block.textContent && PROHIBITED.test(block.textContent)).toBeFalsy();
  });

  it("omits the counts block entirely when all stages are zero", async () => {
    stub({ items: [], stageCounts: { verificationPending: 0, needsRevision: 0, reviewedAccepted: 0, awaitingResolution: 0 } });
    render(<TodayPersonalBrief locale="en" />);
    // brief is empty + no counts → whole surface renders null
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId("action-review-stage-counts")).toBeNull();
  });
});
