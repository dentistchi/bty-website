/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import EventHostDetail from "./EventHostDetail";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const QR = "https://w.example/en/bty/events/scan?ev=btyev1.abc.def";
function detail(over: Record<string, unknown> = {}, participants: unknown[] = []) {
  return {
    event: { eventId: "e1", title: "Morning huddle", state: "ACTIVE", createdAt: "2026-07-28T00:00:00Z", closesAt: "2026-07-29T00:00:00Z", participationCount: participants.length, qr: { available: true, payload: QR }, ...over },
    participants,
  };
}
function mockDetail(...responses: Array<{ status: number; body?: unknown } | "throw">) {
  const fn = vi.fn();
  for (const r of responses) {
    if (r === "throw") fn.mockRejectedValueOnce(new Error("net"));
    else fn.mockResolvedValueOnce(new Response(JSON.stringify(r.body ?? {}), { status: r.status }));
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}
const noop = () => {};

describe("EventHostDetail (3.2E-EVENT-HOST-R1)", () => {
  it("loading → renders title/state and the reopened QR (encoded, not shown as raw text)", async () => {
    mockDetail({ status: 200, body: detail() });
    render(<EventHostDetail locale="en" eventId="e1" onBack={noop} />);
    expect(screen.getByTestId("event-detail-loading")).toBeTruthy();
    expect((await screen.findByTestId("event-detail-title")).textContent).toBe("Morning huddle");
    expect(screen.getByTestId("event-detail-state").textContent).toBe("Active");
    // QR present; the raw payload lives only in an sr-only node (not visible body text).
    expect(screen.getByTestId("event-detail-qr")).toBeTruthy();
    expect(screen.getByTestId("event-detail-qr-url").textContent).toBe(QR);
  });

  it("empty roster shows the honest empty copy", async () => {
    mockDetail({ status: 200, body: detail({ participationCount: 0 }, []) });
    render(<EventHostDetail locale="en" eventId="e1" onBack={noop} />);
    expect(await screen.findByTestId("event-detail-roster-empty")).toBeTruthy();
    expect(screen.getByTestId("event-detail-count").textContent).toBe("No participation recorded yet");
  });

  it("renders a roster with human names + time, and a fallback for a null name — no raw ids", async () => {
    mockDetail({ status: 200, body: detail({}, [
      { displayName: "Alex", participatedAt: "2026-07-28T01:00:00Z" },
      { displayName: null, participatedAt: "2026-07-28T02:00:00Z" },
    ]) });
    render(<EventHostDetail locale="en" eventId="e1" onBack={noop} />);
    const rows = await screen.findAllByTestId("event-detail-participant");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Alex");
    expect(rows[1].textContent).toContain("Participant"); // null → generic fallback
    expect(screen.getByTestId("event-detail-count").textContent).toBe("2 participations");
    const blob = screen.getByTestId("event-host-detail").textContent ?? "";
    expect(blob).not.toMatch(/user_id|@|creator|organization/i);
  });

  it("ENDED event with no QR shows an unavailable state (no QR image)", async () => {
    mockDetail({ status: 200, body: detail({ state: "ENDED", qr: { available: false } }, []) });
    render(<EventHostDetail locale="en" eventId="e1" onBack={noop} />);
    expect(await screen.findByTestId("event-detail-qr-unavailable")).toBeTruthy();
    expect(screen.queryByTestId("event-detail-qr-url")).toBeNull();
  });

  it("manual refresh updates roster + count together, retaining content", async () => {
    const fn = mockDetail(
      { status: 200, body: detail({}, [{ displayName: "Alex", participatedAt: "2026-07-28T01:00:00Z" }]) },
      { status: 200, body: detail({}, [
        { displayName: "Alex", participatedAt: "2026-07-28T01:00:00Z" },
        { displayName: "Bo", participatedAt: "2026-07-28T02:00:00Z" },
      ]) },
    );
    render(<EventHostDetail locale="en" eventId="e1" onBack={noop} />);
    expect(await screen.findByTestId("event-detail-count")).toBeTruthy();
    fireEvent.click(screen.getByTestId("event-detail-refresh"));
    await waitFor(() => expect(screen.getByTestId("event-detail-count").textContent).toBe("2 participations"));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("error → retry; Back invokes onBack", async () => {
    mockDetail("throw");
    const onBack = vi.fn();
    render(<EventHostDetail locale="en" eventId="e1" onBack={onBack} />);
    expect(await screen.findByTestId("event-detail-error")).toBeTruthy();
    fireEvent.click(screen.getByTestId("event-detail-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
