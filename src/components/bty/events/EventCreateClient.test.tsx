/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import EventCreateClient from "./EventCreateClient";
import { LearnDoors } from "@/components/foundry/event-rooms/LearnDoors";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function futureLocal(hours = 24): string {
  const d = new Date(Date.now() + hours * 3600 * 1000);
  // datetime-local wants "YYYY-MM-DDTHH:mm"
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fill() {
  fireEvent.change(screen.getByTestId("event-title"), { target: { value: "Morning huddle" } });
  fireEvent.change(screen.getByTestId("event-type"), { target: { value: "huddle" } });
  fireEvent.change(screen.getByTestId("event-xp"), { target: { value: "30" } });
  fireEvent.change(screen.getByTestId("event-until"), { target: { value: futureLocal() } });
}
function mockCreate(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("EventCreateClient — Host create flow (3.2D-EVENT)", () => {
  it("on success renders the canonical QR from the server response, title, no internal id", async () => {
    const qrUrl = "https://w.example/en/bty/events/scan?ev=btyev1.abc.def";
    const fetchFn = mockCreate(200, { event: { id: "SECRET-EVENT-ID", title: "Morning huddle" }, token: "btyev1.abc.def", qrUrl });
    render(<EventCreateClient locale="en" />);
    fill();
    fireEvent.click(screen.getByTestId("event-create-submit"));
    expect(await screen.findByTestId("event-create-done")).toBeTruthy();
    expect(screen.getByTestId("event-create-qr-url").textContent).toBe(qrUrl);
    expect(screen.getByText("Morning huddle")).toBeTruthy();
    // internal event id is never surfaced
    expect(screen.queryByText(/SECRET-EVENT-ID/)).toBeNull();
    // posted to the EVENT create endpoint
    expect(String(fetchFn.mock.calls[0][0])).toContain("/api/bty/events");
  });

  it("does not fabricate a created state before the server confirms", () => {
    mockCreate(200, {});
    render(<EventCreateClient locale="en" />);
    fill();
    // before clicking submit, no done view
    expect(screen.queryByTestId("event-create-done")).toBeNull();
  });

  it("blocks submit on empty title (no network call)", () => {
    const fetchFn = mockCreate(200, {});
    render(<EventCreateClient locale="en" />);
    fireEvent.change(screen.getByTestId("event-type"), { target: { value: "huddle" } });
    fireEvent.change(screen.getByTestId("event-until"), { target: { value: futureLocal() } });
    fireEvent.click(screen.getByTestId("event-create-submit"));
    expect(screen.getByTestId("event-create-error").textContent).toMatch(/event name/i);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("rejects out-of-range participation XP", () => {
    mockCreate(200, {});
    render(<EventCreateClient locale="en" />);
    fill();
    fireEvent.change(screen.getByTestId("event-xp"), { target: { value: "5" } });
    fireEvent.click(screen.getByTestId("event-create-submit"));
    expect(screen.getByTestId("event-create-error").textContent).toMatch(/10 to 100/i);
  });

  it("rejects a past open-until time", () => {
    mockCreate(200, {});
    render(<EventCreateClient locale="en" />);
    fill();
    fireEvent.change(screen.getByTestId("event-until"), { target: { value: "2000-01-01T00:00" } });
    fireEvent.click(screen.getByTestId("event-create-submit"));
    expect(screen.getByTestId("event-create-error").textContent).toMatch(/future/i);
  });

  it("surfaces the canonical leader-track denial (403)", async () => {
    mockCreate(403, { error: "LEADER_TRACK_REQUIRED" });
    render(<EventCreateClient locale="en" />);
    fill();
    fireEvent.click(screen.getByTestId("event-create-submit"));
    expect((await screen.findByTestId("event-create-error")).textContent).toMatch(/not authorized/i);
  });

  it("shows a calm error on server failure (500)", async () => {
    mockCreate(500, { error: "event_insert_failed" });
    render(<EventCreateClient locale="en" />);
    fill();
    fireEvent.click(screen.getByTestId("event-create-submit"));
    expect((await screen.findByTestId("event-create-error")).textContent).toMatch(/went wrong/i);
  });
});

describe("LearnDoors — Host 'Open an event' entry (3.2D-EVENT)", () => {
  it("shows the event door only to creators and links to the create page", () => {
    const { rerender } = render(<LearnDoors locale="en" canCreate={false} onOpenLearning={() => {}} onCreate={() => {}} />);
    expect(screen.queryByTestId("door-open-event")).toBeNull();
    rerender(<LearnDoors locale="en" canCreate onOpenLearning={() => {}} onCreate={() => {}} />);
    const door = screen.getByTestId("door-open-event");
    expect(door.getAttribute("href")).toBe("/en/bty/events/new");
  });
});
