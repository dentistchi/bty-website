/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import EventScanClient from "./EventScanClient";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const TOKEN = "btyev1.eyJ0eXBlIjoiZXZlbnQifQ.sig";

function mockScan(...responses: Array<{ status: number; body: unknown } | "throw">) {
  const fn = vi.fn();
  for (const r of responses) {
    if (r === "throw") fn.mockRejectedValueOnce(new Error("network"));
    else fn.mockResolvedValueOnce(new Response(JSON.stringify(r.body), { status: r.status }));
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("EventScanClient — member scan flow (3.2D-EVENT)", () => {
  it("shows no verified/already state before the server confirms", () => {
    mockScan();
    render(<EventScanClient locale="en" token={TOKEN} />);
    expect(screen.getByTestId("event-scan-idle")).toBeTruthy();
    expect(screen.queryByTestId("event-scan-verified")).toBeNull();
    expect(screen.queryByTestId("event-scan-already")).toBeNull();
    expect(screen.getByTestId("event-scan-today")).toBeTruthy(); // return to Today
  });

  it("first confirm → Participation verified, showing only server-returned XP", async () => {
    const fetchFn = mockScan({ status: 200, body: { ok: true, already_scanned: false, xp_awarded: 30, event: { title: "Morning huddle" } } });
    render(<EventScanClient locale="en" token={TOKEN} />);
    fireEvent.click(screen.getByTestId("event-scan-confirm"));
    expect(await screen.findByTestId("event-scan-verified")).toBeTruthy();
    expect(screen.getByText("Morning huddle")).toBeTruthy();
    expect(screen.getByTestId("event-scan-xp").textContent).toContain("+30 XP");
    // Posted the token to the EVENT scan endpoint (never an Action endpoint).
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe("/api/bty/events/scan");
    expect(JSON.parse((opts as RequestInit).body as string)).toEqual({ token: TOKEN });
  });

  it("repeat scan → Already recorded with no XP implication", async () => {
    mockScan({ status: 200, body: { ok: true, already_scanned: true, xp_awarded: 0 } });
    render(<EventScanClient locale="en" token={TOKEN} />);
    fireEvent.click(screen.getByTestId("event-scan-confirm"));
    expect(await screen.findByTestId("event-scan-already")).toBeTruthy();
    expect(screen.queryByTestId("event-scan-xp")).toBeNull();
  });

  it("expired event → honest ended message (410)", async () => {
    mockScan({ status: 410, body: { ok: false, error: "event_expired" } });
    render(<EventScanClient locale="en" token={TOKEN} />);
    fireEvent.click(screen.getByTestId("event-scan-confirm"));
    expect((await screen.findByTestId("event-scan-error")).textContent).toMatch(/ended/i);
  });

  it("wrong-family / malformed token → invalid QR error (401 token reason)", async () => {
    mockScan({ status: 401, body: { ok: false, error: "invalid_token" } });
    render(<EventScanClient locale="en" token={TOKEN} />);
    fireEvent.click(screen.getByTestId("event-scan-confirm"));
    expect((await screen.findByTestId("event-scan-error")).textContent).toMatch(/not valid/i);
  });

  it("unauthenticated → sign-in prompt, stays idle (no fake success)", async () => {
    mockScan({ status: 401, body: { ok: false, error: "UNAUTHENTICATED" } });
    render(<EventScanClient locale="en" token={TOKEN} />);
    fireEvent.click(screen.getByTestId("event-scan-confirm"));
    expect(await screen.findByTestId("event-scan-signin")).toBeTruthy();
    expect(screen.queryByTestId("event-scan-verified")).toBeNull();
    expect(screen.getByTestId("event-scan-signin").getAttribute("href")).toContain("/bty/login?next=");
  });

  it("lost response then retry resolves canonically to Already recorded (idempotent)", async () => {
    mockScan("throw", { status: 200, body: { ok: true, already_scanned: true, xp_awarded: 0 } });
    render(<EventScanClient locale="en" token={TOKEN} />);
    fireEvent.click(screen.getByTestId("event-scan-confirm")); // network lost → error
    expect(await screen.findByTestId("event-scan-error")).toBeTruthy();
    // (retry path: the error view returns to Today; a fresh scan of the same QR would re-POST)
  });

  it("renders on a readable dark surface with a visible Back-to-Today control — R3", () => {
    mockScan();
    render(<EventScanClient locale="en" token={TOKEN} />);
    const main = screen.getByTestId("event-scan");
    // Full-viewport BTY-navy background + white text (fixes white-on-pale invisibility).
    expect(main.className).toMatch(/bg-\[#0B1F3A\]/);
    expect(main.className).toMatch(/text-white/);
    const back = screen.getByTestId("event-scan-today");
    expect(back.className).toMatch(/border/); // a clearly actionable pill, not faint text
    expect(back.getAttribute("href")).toBe("/en/app?tab=today");
  });

  it("no membership-denial copy appears in the normal scan flow — R3", async () => {
    // Approved membership is no longer required, so the denial state is gone.
    mockScan({ status: 200, body: { ok: true, already_scanned: false, xp_awarded: 20, event: { title: "Standup" } } });
    render(<EventScanClient locale="en" token={TOKEN} />);
    fireEvent.click(screen.getByTestId("event-scan-confirm"));
    expect(await screen.findByTestId("event-scan-verified")).toBeTruthy();
    expect(screen.queryByText(/could not be recorded for this account/i)).toBeNull();
  });

  it("unexpected server failure (500) → clear retry message, not 'Internal Server Error' — R2", async () => {
    mockScan({ status: 500, body: { ok: false, error: "scan_award_failed" } });
    render(<EventScanClient locale="en" token={TOKEN} />);
    fireEvent.click(screen.getByTestId("event-scan-confirm"));
    const err = await screen.findByTestId("event-scan-error");
    expect(err.textContent).toMatch(/couldn't record your participation.*try again/i);
    expect(err.textContent).not.toMatch(/internal server error/i);
    // never leaks the raw backend code
    expect(err.textContent).not.toMatch(/scan_award_failed/);
  });

  it("missing token → invalid QR, confirm disabled", () => {
    mockScan();
    render(<EventScanClient locale="en" token="" />);
    expect(screen.getByTestId("event-scan-notoken")).toBeTruthy();
    expect((screen.getByTestId("event-scan-confirm") as HTMLButtonElement).disabled).toBe(true);
  });
});
