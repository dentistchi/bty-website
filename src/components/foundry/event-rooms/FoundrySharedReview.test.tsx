/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import FoundrySharedReview from "./FoundrySharedReview";

/**
 * Slice 3.1B-3G CHECKPOINT 4 — Host review UI: renders ONLY when a shared question is configured
 * AND a response was submitted (never a legacy backlog); shows the educational framing (not field
 * proof / not an employee score); exposes the four statuses with Korean labels; posts a review;
 * and NEVER shows private Reflection (the endpoint never returns it, and the component has no field
 * for it).
 */
function mockFetch(view: unknown, onReview?: (body: unknown) => void) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/review") && init?.method === "POST") {
      onReview?.(JSON.parse(String(init.body ?? "{}")));
      return { ok: true, status: 200, json: async () => ({ ok: true, ...(view as object), responses: [{ ...(view as { responses: unknown[] }).responses[0] as object, reviewStatus: "ALIGNED" }] }) };
    }
    return { ok: true, status: 200, json: async () => view };
  });
}

const submittedView = {
  ok: true,
  eventId: "ev-1",
  sharedQuestion: "Explain the sterilization standard.",
  responses: [
    {
      participantId: "p1", displayName: "Hanbit", completed: true,
      sharedResponse: "Confirm PPE and sterilize instruments before every procedure.",
      submittedAt: "2026-07-22T00:00:00Z", reviewStatus: "NOT_REVIEWED", reviewNote: null, reviewedAt: null,
    },
  ],
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("FoundrySharedReview (Host UI)", () => {
  it("renders the review surface with the four Korean statuses + educational framing", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch(submittedView);
    render(<FoundrySharedReview eventId="ev-1" locale="ko" />);
    await screen.findByTestId("host-shared-review");
    expect(screen.getByTestId("review-framing").textContent).toContain("직원 성과 점수가 아닙니다");
    expect(screen.getByTestId("review-status-ALIGNED").textContent).toBe("교육 기준과 일치");
    expect(screen.getByTestId("review-status-PARTIALLY_CLEAR").textContent).toBe("일부 불명확");
    expect(screen.getByTestId("review-status-FOLLOW_UP_NEEDED").textContent).toBe("후속 확인 필요");
    // current status defaults to 검토 전
    expect(screen.getByTestId("current-status").textContent).toContain("검토 전");
    // The submitted shared response is shown; there is NO private-reflection element anywhere.
    expect(screen.getByTestId("host-shared-review").textContent).toContain("Confirm PPE");
  });

  it("does NOT render when there is no shared question", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch({ ok: true, eventId: "ev-1", sharedQuestion: null, responses: [] });
    const { container } = render(<FoundrySharedReview eventId="ev-1" locale="en" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(container.querySelector('[data-testid="host-shared-review"]')).toBeNull();
  });

  it("does NOT render when the shared question exists but NO response was submitted (no backlog)", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch({ ok: true, eventId: "ev-1", sharedQuestion: "Q?", responses: [] });
    const { container } = render(<FoundrySharedReview eventId="ev-1" locale="en" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(container.querySelector('[data-testid="host-shared-review"]')).toBeNull();
  });

  it("posts a review status (ALIGNED) for the participant", async () => {
    let posted: Record<string, unknown> | null = null;
    // @ts-expect-error test shim
    global.fetch = mockFetch(submittedView, (b) => { posted = b as Record<string, unknown>; });
    render(<FoundrySharedReview eventId="ev-1" locale="en" />);
    await screen.findByTestId("host-shared-review");
    fireEvent.click(screen.getByTestId("review-status-ALIGNED"));
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted!.status).toBe("ALIGNED");
  });
});
