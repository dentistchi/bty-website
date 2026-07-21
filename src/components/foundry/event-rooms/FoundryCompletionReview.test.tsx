/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import FoundryCompletionReview from "./FoundryCompletionReview";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const REVIEW = {
  assignmentId: "a1",
  title: "배가 고파",
  contentType: "youtube",
  completedAt: "2026-07-20T19:45:22Z",
  completionState: "pass",
  responseText: "I noticed I avoid hard conversations.",
  reflection: {
    whatEmerged: "clarity",
    whereYouStretched: "candor",
    livingSentence: "I choose truth.",
    nextInvitation: "one honest talk",
  },
};

function mockFetch(ok: boolean, body: unknown) {
  global.fetch = vi.fn(async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
}

describe("FoundryCompletionReview", () => {
  it("renders the learner's own stored content + Completed status", async () => {
    mockFetch(true, { ok: true, review: REVIEW });
    render(<FoundryCompletionReview assignmentId="a1" locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("foundry-completion-review")).toBeTruthy());
    expect(screen.getByText("배가 고파")).toBeTruthy();
    expect(screen.getByTestId("review-response").textContent).toContain("avoid hard conversations");
    expect(screen.getByText("I choose truth.")).toBeTruthy();
    expect(screen.getByText(/Completed/)).toBeTruthy();
    // Never a join/name field.
    expect(screen.queryByText(/Join training/i)).toBeNull();
  });

  it("Back to Foundry invokes onBack", async () => {
    mockFetch(true, { ok: true, review: REVIEW });
    const onBack = vi.fn();
    render(<FoundryCompletionReview assignmentId="a1" locale="en" onBack={onBack} />);
    await waitFor(() => screen.getByTestId("review-back"));
    fireEvent.click(screen.getByTestId("review-back"));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("empty handling: no reflection recorded shows a calm line, no synthesis", async () => {
    mockFetch(true, { ok: true, review: { ...REVIEW, responseText: null, reflection: null } });
    render(<FoundryCompletionReview assignmentId="a1" locale="en" onBack={() => {}} />);
    await waitFor(() => screen.getByTestId("foundry-completion-review"));
    expect(screen.getByText("No reflection was recorded for this learning.")).toBeTruthy();
    expect(screen.queryByTestId("review-response")).toBeNull();
  });

  it("404/neutral shows a calm error (Back still available), never a Room join", async () => {
    mockFetch(false, { ok: false, error: "not_found" });
    render(<FoundryCompletionReview assignmentId="a1" locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("review-error")).toBeTruthy());
    expect(screen.getByTestId("review-back")).toBeTruthy();
  });
});
