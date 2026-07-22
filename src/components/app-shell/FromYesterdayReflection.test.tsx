/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import FromYesterdayReflection from "./FromYesterdayReflection";

/**
 * Slice 3.1B-3I — Today "From yesterday" card. NO AI. Collapsed by default: the raw reflection
 * appears ONLY after the learner taps View. Renders nothing when there is no eligible reflection.
 * Shows an additional count and links to the exact Center entry.
 */

function mockReflection(reflection: unknown) {
  return vi.fn(async (url: string) => {
    if (String(url).includes("/api/me/today/yesterday-reflection"))
      return { ok: true, status: 200, json: async () => ({ ok: true, reflection }) };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FromYesterdayReflection (Today)", () => {
  it("renders nothing when there is no eligible yesterday reflection", async () => {
    // @ts-expect-error test shim
    global.fetch = mockReflection(null);
    const { container } = render(<FromYesterdayReflection locale="en" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId("from-yesterday-reflection")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("shows the card collapsed — raw text hidden until the learner taps View", async () => {
    // @ts-expect-error test shim
    global.fetch = mockReflection({ entryId: "p1", eventTitle: "T", contentType: "youtube", completedAt: "2026-07-22T04:00:00Z", responseText: "YESTERDAY PRIVATE TEXT", additionalCount: 0 });
    render(<FromYesterdayReflection locale="en" />);
    await waitFor(() => expect(screen.getByTestId("from-yesterday-reflection")).toBeTruthy());
    expect(screen.getByText("FROM YESTERDAY")).toBeTruthy();
    expect(screen.getByText("You left a private reflection yesterday.")).toBeTruthy();
    // collapsed: raw text is NOT shown yet
    expect(screen.queryByTestId("from-yesterday-body")).toBeNull();
    // tap View → text appears
    fireEvent.click(screen.getByTestId("from-yesterday-view"));
    expect(screen.getByTestId("from-yesterday-body").textContent).toBe("YESTERDAY PRIVATE TEXT");
  });

  it("links to the exact Center entry and shows an additional count when multiple exist", async () => {
    // @ts-expect-error test shim
    global.fetch = mockReflection({ entryId: "prog-9", eventTitle: "T", contentType: "document", completedAt: "2026-07-22T04:00:00Z", responseText: "x", additionalCount: 2 });
    render(<FromYesterdayReflection locale="en" />);
    const center = (await screen.findByTestId("from-yesterday-center")) as HTMLAnchorElement;
    expect(center.getAttribute("href")).toBe("/en/app?tab=center&view=reflections&entry=prog-9");
    expect(screen.getByTestId("from-yesterday-more").textContent).toContain("2 more reflections");
  });

  it("a session-local Dismiss hides the card (no persistence)", async () => {
    // @ts-expect-error test shim
    global.fetch = mockReflection({ entryId: "p1", eventTitle: "T", contentType: "youtube", completedAt: "2026-07-22T04:00:00Z", responseText: "x", additionalCount: 0 });
    render(<FromYesterdayReflection locale="en" />);
    await waitFor(() => expect(screen.getByTestId("from-yesterday-reflection")).toBeTruthy());
    fireEvent.click(screen.getByTestId("from-yesterday-dismiss"));
    expect(screen.queryByTestId("from-yesterday-reflection")).toBeNull();
  });
});
