/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import FoundryMyLearning from "./FoundryMyLearning";

/**
 * Slice 3.1B-3I — Foundry → My Learning is a LEARNING record: the primary artifact is the learner's
 * own Shared Understanding (not the Private Reflection, which now lives in Center). It links to the
 * exact Center reflection via ?tab=center&view=reflections&entry=<entryId>. Private Reflection body
 * (responseText) must NOT appear here; Host notes never appear. Explicit DTO allow-list.
 */

function mockHistory(history: unknown[]) {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, history }) }));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FoundryMyLearning (Slice 3.1B-3I)", () => {
  it("shows the learner's own Shared Understanding as the primary artifact — NOT the Private Reflection", async () => {
    // @ts-expect-error test shim
    global.fetch = mockHistory([
      {
        entryId: "p1",
        eventTitle: "배가 고파",
        contentType: "youtube",
        completedAt: "2026-07-22T04:00:00Z",
        sharedUnderstanding: "MY SHARED UNDERSTANDING ANSWER",
        responseText: "MY PRIVATE REFLECTION BODY",
      },
    ]);
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("my-learning-shared")).toBeTruthy());
    expect(screen.getByText("MY SHARED UNDERSTANDING ANSWER")).toBeTruthy();
    // Private Reflection body must NOT render in Foundry.
    expect(screen.queryByText("MY PRIVATE REFLECTION BODY")).toBeNull();
  });

  it("links 'View my private reflection in Center' to the exact Center entry", async () => {
    // @ts-expect-error test shim
    global.fetch = mockHistory([
      { entryId: "prog-123", eventTitle: "T", contentType: "document", completedAt: "2026-07-22T04:00:00Z", sharedUnderstanding: "understood", responseText: "private" },
    ]);
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    const link = (await screen.findByTestId("view-reflection-in-center")) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/en/app?tab=center&view=reflections&entry=prog-123");
  });

  it("shows a calm note when a training had no shared understanding (does not fall back to the private reflection)", async () => {
    // @ts-expect-error test shim
    global.fetch = mockHistory([
      { entryId: "p1", eventTitle: "T", contentType: "youtube", completedAt: "2026-07-22T04:00:00Z", sharedUnderstanding: null, responseText: "PRIVATE" },
    ]);
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("my-learning-item")).toBeTruthy());
    expect(screen.getByText("No shared understanding was recorded for this training.")).toBeTruthy();
    expect(screen.queryByText("PRIVATE")).toBeNull();
  });

  it("empty state when the learner has no completed trainings", async () => {
    // @ts-expect-error test shim
    global.fetch = mockHistory([]);
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("my-learning-empty")).toBeTruthy());
  });

  it("does not render Host review notes even if present (DTO allow-list)", async () => {
    // @ts-expect-error test shim
    global.fetch = mockHistory([
      { entryId: "p1", eventTitle: "T", contentType: "youtube", completedAt: "2026-07-22T04:00:00Z", sharedUnderstanding: "understood", responseText: "private", hostReviewNote: "HOST NOTE" },
    ]);
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("my-learning-item")).toBeTruthy());
    expect(screen.queryByText("HOST NOTE")).toBeNull();
  });
});
