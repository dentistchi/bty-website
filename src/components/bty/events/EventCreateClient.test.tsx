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

  it("in-shell back is a callback button (no route navigation) — R1", () => {
    const onBack = vi.fn();
    render(<EventCreateClient locale="en" onBack={onBack} />);
    const back = screen.getByTestId("event-create-back");
    expect(back.tagName).toBe("BUTTON");
    expect(back.getAttribute("href")).toBeNull();
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe("LearnDoors — Host 'Open an event' in-shell entry (3.2D-EVENT-R1)", () => {
  it("is a callback BUTTON (no href/target — never leaves the app), gated on creator + handler", () => {
    const onOpenEvent = vi.fn();
    // Not a creator → hidden.
    const { rerender } = render(<LearnDoors locale="en" canCreate={false} onOpenLearning={() => {}} onCreate={() => {}} onOpenEvent={onOpenEvent} />);
    expect(screen.queryByTestId("door-open-event")).toBeNull();
    // Creator but no handler → hidden (no dead route).
    rerender(<LearnDoors locale="en" canCreate onOpenLearning={() => {}} onCreate={() => {}} />);
    expect(screen.queryByTestId("door-open-event")).toBeNull();
    // Creator + handler → an in-shell button.
    rerender(<LearnDoors locale="en" canCreate onOpenLearning={() => {}} onCreate={() => {}} onOpenEvent={onOpenEvent} />);
    const door = screen.getByTestId("door-open-event");
    expect(door.tagName).toBe("BUTTON");
    expect(door.getAttribute("href")).toBeNull();
    expect(door.getAttribute("target")).toBeNull();
    fireEvent.click(door);
    expect(onOpenEvent).toHaveBeenCalledTimes(1);
  });

  it("the 'My events' door is a creator-gated in-shell button firing onOpenMyEvents — 3.2E", () => {
    const onOpenMyEvents = vi.fn();
    const { rerender } = render(<LearnDoors locale="en" canCreate={false} onOpenLearning={() => {}} onCreate={() => {}} onOpenMyEvents={onOpenMyEvents} />);
    expect(screen.queryByTestId("door-my-events")).toBeNull(); // not a creator
    rerender(<LearnDoors locale="en" canCreate onOpenLearning={() => {}} onCreate={() => {}} />);
    expect(screen.queryByTestId("door-my-events")).toBeNull(); // no handler
    rerender(<LearnDoors locale="en" canCreate onOpenLearning={() => {}} onCreate={() => {}} onOpenMyEvents={onOpenMyEvents} />);
    const door = screen.getByTestId("door-my-events");
    expect(door.tagName).toBe("BUTTON");
    expect(door.getAttribute("href")).toBeNull();
    fireEvent.click(door);
    expect(onOpenMyEvents).toHaveBeenCalledTimes(1);
  });
});
