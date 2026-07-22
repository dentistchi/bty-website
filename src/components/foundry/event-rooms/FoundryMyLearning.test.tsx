/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import FoundryMyLearning from "./FoundryMyLearning";

/**
 * Slice 3.1B-3H — My Learning (learner-owned private surface). Reads the owner-scoped
 * GET /api/bty/foundry/history and shows ONLY an explicit DTO allow-list: title, date,
 * content type, and the learner's own Private Reflection labelled as private. It must NOT
 * render Host review notes, AI reflection bodies, scores, or any other field even if the
 * payload happens to carry them.
 */

function mockHistory(history: unknown[]) {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, history }) }));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FoundryMyLearning", () => {
  it("renders the owner's own completed trainings with the private reflection + private label", async () => {
    // @ts-expect-error test shim
    global.fetch = mockHistory([
      { eventId: "e1", eventTitle: "배가 고파", contentType: "youtube", completedAt: "2026-07-22T04:00:00Z", responseText: "MY PRIVATE REFLECTION BODY" },
      { eventId: "e2", eventTitle: "OSHA basics", contentType: "document", completedAt: "2026-07-21T04:00:00Z", responseText: "PDF reflection" },
    ]);
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getAllByTestId("my-learning-item").length).toBe(2));
    expect(screen.getByText("배가 고파")).toBeTruthy();
    expect(screen.getByText("MY PRIVATE REFLECTION BODY")).toBeTruthy();
    // private labelling is present
    expect(screen.getAllByText("My private reflection").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Only you can see this reflection.").length).toBeGreaterThan(0);
    // content type rendered (Video / PDF)
    expect(screen.getByText("PDF")).toBeTruthy();
  });

  it("does NOT render Host review notes or AI reflection bodies even if present in the payload (DTO allow-list)", async () => {
    // @ts-expect-error test shim
    global.fetch = mockHistory([
      {
        eventId: "e1",
        eventTitle: "T",
        contentType: "youtube",
        completedAt: "2026-07-22T04:00:00Z",
        responseText: "the learner's own words",
        hostReviewNote: "HOST NOTE SHOULD NOT APPEAR",
        aiReflection: { livingSentence: "AI SENTENCE SHOULD NOT APPEAR" },
        score: 99,
      },
    ]);
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("my-learning-item")).toBeTruthy());
    expect(screen.getByText("the learner's own words")).toBeTruthy();
    expect(screen.queryByText("HOST NOTE SHOULD NOT APPEAR")).toBeNull();
    expect(screen.queryByText("AI SENTENCE SHOULD NOT APPEAR")).toBeNull();
    expect(screen.queryByText(/99/)).toBeNull();
  });

  it("shows a useful empty state when the learner has no completed trainings", async () => {
    // @ts-expect-error test shim
    global.fetch = mockHistory([]);
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("my-learning-empty")).toBeTruthy());
    expect(screen.getByText("No completed trainings yet.")).toBeTruthy();
  });

  it("renders Korean private copy", async () => {
    // @ts-expect-error test shim
    global.fetch = mockHistory([{ eventId: "e1", eventTitle: "T", contentType: "document", completedAt: "2026-07-22T04:00:00Z", responseText: "비공개 성찰" }]);
    render(<FoundryMyLearning locale="ko" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText("비공개 성찰")).toBeTruthy());
    expect(screen.getAllByText("나의 비공개 성찰").length).toBeGreaterThan(0);
    expect(screen.getAllByText("이 성찰은 본인만 볼 수 있습니다.").length).toBeGreaterThan(0);
  });
});
