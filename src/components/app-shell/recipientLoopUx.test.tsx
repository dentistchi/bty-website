/** @vitest-environment jsdom */
/**
 * The recipient lane must not disappear when a request fails (Slice A1-VIS-R3).
 *
 * ★ THE SILENCE THAT HID A REAL BUG. `NeedsYourResponse` mapped EVERY failure to `setItems([])`,
 * and an empty list renders nothing. So while the route was refusing `403 consent_required` for
 * every Teams-first person, this lane simply was not there — and the fault was only visible
 * because the HOST lane showed an error. A question someone is waiting on must not vanish because
 * a request failed.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const H = vi.hoisted(() => ({ getSession: vi.fn(async () => ({ data: { session: null }, error: null })) }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: H.getSession } } }));

import NeedsYourResponse from "./NeedsYourResponse";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const ITEM = {
  announcementId: "6cfccb92-fac6-43d1-b6e9-deeb0d5437b5",
  hostFraming: "Pay",
  hostDisplay: null,
  sourceUrl: "https://teams.microsoft.com/l/message/19:chat@unq.gbl.spaces/1",
  response: null,
  respondedAt: null,
};

function stub(seq: { status: number; body?: unknown }[]) {
  const calls: string[] = [];
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(String(url));
      const s = seq[Math.min(i++, seq.length - 1)];
      return new Response(JSON.stringify(s.body ?? {}), {
        status: s.status,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return calls;
}

describe("★ 22+23. an empty list and a failure are different things", () => {
  it("★ 22. a 200 with no items renders nothing — no card, no error", async () => {
    stub([{ status: 200, body: { items: [] } }]);
    render(<NeedsYourResponse locale="en" />);
    await waitFor(() => expect(screen.queryByTestId("needs-your-response")).toBeNull());
    expect(screen.queryByTestId("needs-your-response-error")).toBeNull();
  });

  it("★ 23. a 500 shows a concise error with Retry — it is NOT hidden as empty", async () => {
    stub([{ status: 500 }]);
    render(<NeedsYourResponse locale="en" />);
    const err = await screen.findByTestId("needs-your-response-error");
    expect(err.textContent).toContain("Couldn't load what needs your response.");
    expect(screen.getByText("Retry")).toBeTruthy();
  });

  it("★ 23. a 403 is an error too, and never an Arena consent prompt", async () => {
    stub([{ status: 403, body: { error: "whatever" } }]);
    render(<NeedsYourResponse locale="en" />);
    await waitFor(() => expect(screen.getByTestId("needs-your-response-error")).toBeTruthy());
    expect(screen.queryByText(/Accept the BTY terms/)).toBeNull();
    expect(document.querySelector('a[href*="legal/accept"]')).toBeNull();
  });

  it("a network failure is an error, not silence", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    render(<NeedsYourResponse locale="en" />);
    await waitFor(() => expect(screen.getByTestId("needs-your-response-error")).toBeTruthy());
  });

  it("a 200 with an item renders the response card", async () => {
    stub([{ status: 200, body: { items: [ITEM] } }]);
    render(<NeedsYourResponse locale="en" />);
    const card = await screen.findByTestId("announcement-item");
    expect(card.textContent).toContain("Pay");
    expect(screen.getByTestId("announcement-got-it")).toBeTruthy();
  });
});

describe("★ a 401 re-reads the session and retries exactly once", () => {
  it("recovers when the token had rotated", async () => {
    H.getSession.mockClear();
    const calls = stub([{ status: 401 }, { status: 200, body: { items: [ITEM] } }]);
    render(<NeedsYourResponse locale="en" />);
    await waitFor(() => expect(screen.getByTestId("announcement-item")).toBeTruthy());
    expect(calls).toHaveLength(2);
    expect(H.getSession).toHaveBeenCalledTimes(1);
  });

  it("a second 401 is an error — no loop, no polling", async () => {
    const calls = stub([{ status: 401 }, { status: 401 }]);
    render(<NeedsYourResponse locale="en" />);
    await waitFor(() => expect(screen.getByTestId("needs-your-response-error")).toBeTruthy());
    expect(calls).toHaveLength(2);
    await new Promise((r) => setTimeout(r, 60));
    expect(calls).toHaveLength(2);
  });

  it("Retry re-runs the same session-aware path", async () => {
    H.getSession.mockClear();
    stub([{ status: 500 }, { status: 401 }, { status: 200, body: { items: [ITEM] } }]);
    render(<NeedsYourResponse locale="en" />);
    await waitFor(() => expect(screen.getByTestId("needs-your-response-error")).toBeTruthy());
    fireEvent.click(screen.getByText("Retry"));
    await waitFor(() => expect(screen.getByTestId("announcement-item")).toBeTruthy());
    expect(H.getSession).toHaveBeenCalled();
  });
});

describe("★ after answering, the controls are gone and cannot be used twice", () => {
  it("a settled response shows the committed state and no action buttons", async () => {
    stub([{ status: 200, body: { items: [{ ...ITEM, response: "ACKNOWLEDGED", respondedAt: "2026-09-02T22:00:00Z" }] } }]);
    render(<NeedsYourResponse locale="en" />);
    const answered = await screen.findByTestId("announcement-answered");
    expect(answered.textContent).toContain("You said: Got it");
    expect(screen.queryByTestId("announcement-got-it")).toBeNull();
    expect(screen.queryByTestId("announcement-question")).toBeNull();
    expect(screen.queryByTestId("announcement-help")).toBeNull();
  });

  it("the Teams source link survives the answered state", async () => {
    stub([{ status: 200, body: { items: [{ ...ITEM, response: "HELP_NEEDED" }] } }]);
    render(<NeedsYourResponse locale="en" />);
    const link = (await screen.findByTestId("announcement-source-link")) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(ITEM.sourceUrl);
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("★ 21. no identity of any kind reaches the recipient's own view", async () => {
    stub([{ status: 200, body: { items: [ITEM] } }]);
    render(<NeedsYourResponse locale="en" />);
    await waitFor(() => expect(screen.getByTestId("announcement-item")).toBeTruthy());
    const text = screen.getByTestId("needs-your-response").textContent ?? "";
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(text).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
  });
});

describe("★ 24. Today re-entry refreshes, without polling", () => {
  it("★ a changed refreshKey re-reads once", async () => {
    const calls = stub([{ status: 200, body: { items: [] } }]);
    const { rerender } = render(<NeedsYourResponse locale="en" refreshKey={0} />);
    await waitFor(() => expect(calls).toHaveLength(1));
    rerender(<NeedsYourResponse locale="en" refreshKey={1} />);
    await waitFor(() => expect(calls).toHaveLength(2));
    // ...and an unchanged key does not.
    rerender(<NeedsYourResponse locale="en" refreshKey={1} />);
    await new Promise((r) => setTimeout(r, 40));
    expect(calls).toHaveLength(2);
  });

  it("★ there is no interval, visibility listener or realtime channel", () => {
    // Comments stripped: the guard must target real code, never prose that mentions the thing.
    const src = readFileSync("src/components/app-shell/NeedsYourResponse.tsx", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const banned of ["setInterval", "visibilitychange", "channel(", "realtime", "location.reload"]) {
      expect(src, banned).not.toContain(banned);
    }
  });

  it("★ the shell bumps the key only on a real Today tab press", () => {
    const shell = readFileSync("src/components/app-shell/BtyDailyAppShell.tsx", "utf8");
    expect(shell).toMatch(/if \(key === "today"\) setTodayRefreshKey\(\(k\) => k \+ 1\);/);
    expect(shell).toMatch(/refreshKey=\{todayRefreshKey\}/);
  });
});

import { readFileSync } from "node:fs";
