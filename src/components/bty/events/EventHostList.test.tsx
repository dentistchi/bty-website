/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import EventHostList from "./EventHostList";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const ev = (id: string, title: string, state: string, count: number) => ({
  eventId: id, title, state, createdAt: "2026-07-28T00:00:00Z", opensAt: null, closesAt: "2026-07-29T00:00:00Z", participationCount: count,
});
function mockMine(...responses: Array<{ status: number; events?: unknown[] } | "throw">) {
  const fn = vi.fn();
  for (const r of responses) {
    if (r === "throw") fn.mockRejectedValueOnce(new Error("net"));
    else fn.mockResolvedValueOnce(new Response(JSON.stringify({ events: r.events ?? [] }), { status: r.status }));
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}
const noop = () => {};

describe("EventHostList (3.2E-EVENT-HOST)", () => {
  it("(1) shows a loading state first", async () => {
    mockMine({ status: 200, events: [] });
    render(<EventHostList locale="en" onBack={noop} onOpenCreate={noop} />);
    expect(screen.getByTestId("event-host-loading")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("event-host-empty")).toBeTruthy());
  });

  it("(2) empty state offers an Open-an-event action", async () => {
    mockMine({ status: 200, events: [] });
    const onOpenCreate = vi.fn();
    render(<EventHostList locale="en" onBack={noop} onOpenCreate={onOpenCreate} />);
    fireEvent.click(await screen.findByTestId("event-host-empty-create"));
    expect(onOpenCreate).toHaveBeenCalledTimes(1);
  });

  it("(3) renders 0 / 1 / multiple participation counts with honest copy", async () => {
    mockMine({ status: 200, events: [ev("e1", "Morning huddle", "ACTIVE", 2), ev("e2", "Standup", "ENDED", 1), ev("e3", "Kickoff", "CANCELLED", 0)] });
    render(<EventHostList locale="en" onBack={noop} onOpenCreate={noop} />);
    const rows = await screen.findAllByTestId("event-host-row");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByTestId("event-host-count").textContent).toBe("2 participations");
    expect(within(rows[1]).getByTestId("event-host-count").textContent).toBe("1 participation");
    expect(within(rows[2]).getByTestId("event-host-count").textContent).toBe("No participation recorded yet");
    // Honest states, no completion/behavior language.
    expect(rows[0].textContent).toMatch(/Active/);
    expect(screen.queryByText(/completion|behavior|mastery|sustained/i)).toBeNull();
  });

  it("(5) error → retry; (6) manual refresh updates the count while retaining the list", async () => {
    const fn = mockMine(
      "throw", // initial load fails
      { status: 200, events: [ev("e1", "Huddle", "ACTIVE", 1)] }, // retry succeeds
      { status: 200, events: [ev("e1", "Huddle", "ACTIVE", 2)] }, // refresh → count 2
    );
    render(<EventHostList locale="en" onBack={noop} onOpenCreate={noop} />);
    fireEvent.click(await screen.findByText(/Try again/i)); // retry
    expect((await screen.findByTestId("event-host-count")).textContent).toBe("1 participation");
    fireEvent.click(screen.getByTestId("event-host-refresh"));
    await waitFor(() => expect(screen.getByTestId("event-host-count").textContent).toBe("2 participations"));
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("(7) Back returns to Learn", async () => {
    mockMine({ status: 200, events: [] });
    const onBack = vi.fn();
    render(<EventHostList locale="en" onBack={onBack} onOpenCreate={noop} />);
    fireEvent.click(screen.getByTestId("event-host-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("(9) never renders participant IDs / internal identifiers", async () => {
    mockMine({ status: 200, events: [ev("e1", "Huddle", "ACTIVE", 3)] });
    render(<EventHostList locale="en" onBack={noop} onOpenCreate={noop} />);
    await screen.findByTestId("event-host-row");
    const txt = screen.getByTestId("event-host-list").textContent ?? "";
    // event id is used only as a React key, never shown.
    expect(txt).not.toContain("e1");
    expect(txt).not.toMatch(/creator|user_id|@|organization/i);
  });
});
