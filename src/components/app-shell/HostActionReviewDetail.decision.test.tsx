/** @vitest-environment jsdom */
/**
 * HostActionReviewDetail — decision controls (Slice 3.1B-3N-5C, Refinement 5 UI: 21–25).
 * Buttons appear only for an authorized, reviewable action; controls disable while pending;
 * cancel performs no mutation; a failed request does not show success; a stale/already-resolved
 * response shows calm stale copy (no optimistic terminal state).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import HostActionReviewDetail from "./HostActionReviewDetail";

const DETAIL = {
  actionContractId: "c1",
  learnerLabel: "Nickname",
  actionSummary: "Do the thing",
  submittedAt: "2026-07-01T00:00:00Z",
  originalDeadline: "2026-07-05T00:00:00Z",
  verificationMode: "hybrid",
  statusLabel: "Awaiting your review",
  who: "the team",
  what: "hold a check-in",
  how: "in person",
  stepWhen: "Monday",
};

function mockFetch(handlers: { get?: unknown; post?: () => Promise<Response> | Response }) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return Promise.resolve(handlers.post ? handlers.post() : new Response(null, { status: 200 }));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ item: "get" in handlers ? handlers.get : DETAIL }),
      } as Response);
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("HostActionReviewDetail — decision controls", () => {
  it("shows Approve + Request revision only after a reviewable detail loads", async () => {
    mockFetch({});
    render(<HostActionReviewDetail locale="en" actionContractId="c1" onBack={() => {}} />);
    expect(await screen.findByTestId("host-action-review-approve")).toBeTruthy();
    expect(screen.getByTestId("host-action-review-request-revision")).toBeTruthy();
  });

  it("does NOT show decision controls when the detail is unavailable (not authorized/reviewable)", async () => {
    mockFetch({ get: null });
    render(<HostActionReviewDetail locale="en" actionContractId="c1" onBack={() => {}} />);
    expect(await screen.findByTestId("host-action-review-notfound")).toBeTruthy();
    expect(screen.queryByTestId("host-action-review-approve")).toBeNull();
  });

  it("cancel on the approve confirmation performs no POST", async () => {
    const fetchSpy = vi.fn();
    mockFetch({ post: () => { fetchSpy(); return new Response(JSON.stringify({ ok: true }), { status: 200 }); } });
    render(<HostActionReviewDetail locale="en" actionContractId="c1" onBack={() => {}} />);
    fireEvent.click(await screen.findByTestId("host-action-review-approve"));
    fireEvent.click(screen.getByTestId("host-action-review-approve-confirm-btn").parentElement!.querySelector('[data-testid="host-action-review-cancel"]')!);
    expect(fetchSpy).not.toHaveBeenCalled();
    // back to the two decision buttons, no mutation
    expect(screen.getByTestId("host-action-review-approve")).toBeTruthy();
  });

  it("request revision requires a note (client) — empty submit shows validation, no POST", async () => {
    const postSpy = vi.fn(() => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    mockFetch({ post: postSpy });
    render(<HostActionReviewDetail locale="en" actionContractId="c1" onBack={() => {}} />);
    fireEvent.click(await screen.findByTestId("host-action-review-request-revision"));
    fireEvent.click(screen.getByTestId("host-action-review-revision-submit"));
    expect(screen.getByTestId("host-action-review-note-validation")).toBeTruthy();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("approve success calls onBack (returns to queue → refetch)", async () => {
    const onBack = vi.fn();
    mockFetch({ post: () => new Response(JSON.stringify({ ok: true, resultingStatus: "approved" }), { status: 200 }) });
    render(<HostActionReviewDetail locale="en" actionContractId="c1" onBack={onBack} />);
    fireEvent.click(await screen.findByTestId("host-action-review-approve"));
    fireEvent.click(screen.getByTestId("host-action-review-approve-confirm-btn"));
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
  });

  it("stale/already-resolved (409) shows calm stale copy and does not declare success", async () => {
    const onBack = vi.fn();
    mockFetch({ post: () => new Response(JSON.stringify({ ok: false, error: "ALREADY_RESOLVED" }), { status: 409 }) });
    render(<HostActionReviewDetail locale="en" actionContractId="c1" onBack={onBack} />);
    fireEvent.click(await screen.findByTestId("host-action-review-approve"));
    fireEvent.click(screen.getByTestId("host-action-review-approve-confirm-btn"));
    expect(await screen.findByTestId("host-action-review-stale")).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
  });

  it("network failure does not show success; error surfaces and decision controls return", async () => {
    const onBack = vi.fn();
    mockFetch({ post: () => new Response(JSON.stringify({ error: "SERVER_ERROR" }), { status: 500 }) });
    render(<HostActionReviewDetail locale="en" actionContractId="c1" onBack={onBack} />);
    fireEvent.click(await screen.findByTestId("host-action-review-approve"));
    fireEvent.click(screen.getByTestId("host-action-review-approve-confirm-btn"));
    expect(await screen.findByTestId("host-action-review-error")).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
  });

  // ===== Slice 3.1B-3N-5C.4: iOS post-action viewport =====
  it("revision note uses a 16px font (text-base) + decision buttons carry touch-manipulation", async () => {
    mockFetch({});
    render(<HostActionReviewDetail locale="en" actionContractId="c1" onBack={() => {}} />);
    expect((await screen.findByTestId("host-action-review-approve")).className).toContain("touch-manipulation");
    expect(screen.getByTestId("host-action-review-request-revision").className).toContain("touch-manipulation");
    fireEvent.click(screen.getByTestId("host-action-review-request-revision"));
    const note = await screen.findByTestId("host-action-review-revision-note");
    expect(note.className).toContain("text-base");
    expect(note.className).not.toContain("text-sm");
    expect(screen.getByTestId("host-action-review-revision-submit").className).toContain("touch-manipulation");
  });

  it("request-revision success BLURS the note before onBack (iOS zoom reset); approve shares the same path", async () => {
    const onBack = vi.fn();
    mockFetch({ post: () => new Response(JSON.stringify({ ok: true, resultingStatus: "rejected" }), { status: 200 }) });
    render(<HostActionReviewDetail locale="en" actionContractId="c1" onBack={onBack} />);
    fireEvent.click(await screen.findByTestId("host-action-review-request-revision"));
    const note = (await screen.findByTestId("host-action-review-revision-note")) as HTMLTextAreaElement;
    fireEvent.change(note, { target: { value: "Name the exact date." } });
    note.focus();
    const blurSpy = vi.spyOn(note, "blur");
    fireEvent.click(screen.getByTestId("host-action-review-revision-submit"));
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
    expect(blurSpy).toHaveBeenCalled();
  });
});
