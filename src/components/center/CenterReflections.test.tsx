/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import CenterReflections from "./CenterReflections";

/**
 * Slice 3.1B-3I — Center is the canonical home of the learner's Private Reflections. Owner-scoped
 * read (GET /api/bty/foundry/history). Shows date, title, content type, and the learner's OWN
 * Private Reflection with a clear privacy label. Deep-link (?entry=<id>) focuses the exact record.
 * Read-only. Explicit DTO allow-list.
 */

function mockHistory(history: unknown[]) {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, history }) }));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CenterReflections", () => {
  it("renders the owner's private reflections with date, title, content type, and privacy label", async () => {
    // @ts-expect-error test shim
    global.fetch = mockHistory([
      { entryId: "p1", eventTitle: "배가 고파", contentType: "youtube", completedAt: "2026-07-22T04:00:00Z", responseText: "MY PRIVATE REFLECTION" },
    ]);
    render(<CenterReflections locale="en" />);
    await waitFor(() => expect(screen.getByTestId("center-reflection-item")).toBeTruthy());
    expect(screen.getByText("배가 고파")).toBeTruthy();
    expect(screen.getByText("MY PRIVATE REFLECTION")).toBeTruthy();
    expect(screen.getByText("Only you can see these reflections.")).toBeTruthy();
    expect(screen.getByText("My reflections")).toBeTruthy();
  });

  it("focuses the exact deep-linked entry (?entry=<id>)", async () => {
    // @ts-expect-error test shim
    global.fetch = mockHistory([
      { entryId: "p1", eventTitle: "A", contentType: "youtube", completedAt: "2026-07-22T04:00:00Z", responseText: "one" },
      { entryId: "p2", eventTitle: "B", contentType: "document", completedAt: "2026-07-21T04:00:00Z", responseText: "two" },
    ]);
    render(<CenterReflections locale="en" focusEntryId="p2" />);
    await waitFor(() => expect(screen.getAllByTestId("center-reflection-item").length).toBe(2));
    const items = screen.getAllByTestId("center-reflection-item");
    const focused = items.find((el) => el.getAttribute("data-entry-id") === "p2");
    const notFocused = items.find((el) => el.getAttribute("data-entry-id") === "p1");
    expect(focused?.getAttribute("data-focused")).toBe("1");
    expect(notFocused?.getAttribute("data-focused")).toBeNull();
  });

  it("renders a non-judgmental empty state", async () => {
    // @ts-expect-error test shim
    global.fetch = mockHistory([]);
    render(<CenterReflections locale="en" />);
    await waitFor(() => expect(screen.getByTestId("center-reflections-empty")).toBeTruthy());
    expect(screen.getByText("No reflections yet.")).toBeTruthy();
  });

  it("renders Korean privacy copy", async () => {
    // @ts-expect-error test shim
    global.fetch = mockHistory([{ entryId: "p1", eventTitle: "T", contentType: "document", completedAt: "2026-07-22T04:00:00Z", responseText: "성찰" }]);
    render(<CenterReflections locale="ko" />);
    await waitFor(() => expect(screen.getByText("나의 성찰")).toBeTruthy());
    expect(screen.getByText("이 성찰은 본인만 볼 수 있습니다.")).toBeTruthy();
  });
});
