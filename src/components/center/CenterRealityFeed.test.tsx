/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import CenterRealityFeed from "./CenterRealityFeed";

/**
 * Slice 3.1B-3J — Center Personal Reality Feed: reflections render DIRECTLY on the first screen
 * (no subview), grouped; the canonical consent toggle reads/writes the preference; ?entry focuses
 * the exact record. Explicit DTO allow-list. Owner-scoped reads (server-enforced).
 */

const patchBodies: unknown[] = [];

function mockFetch(opts: { history?: unknown[]; consent?: boolean; patchOk?: boolean }) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/api/bty/foundry/history")) return { ok: true, status: 200, json: async () => ({ ok: true, history: opts.history ?? [] }) };
    if (u.includes("/api/me/conversation-preferences")) {
      if (init?.method === "PATCH") {
        patchBodies.push(JSON.parse(String(init.body)));
        const ok = opts.patchOk !== false;
        return { ok, status: ok ? 200 : 500, json: async () => (ok ? { ok: true } : { error: "boom" }) };
      }
      return { ok: true, status: 200, json: async () => ({ personalizeTodayFromReflections: opts.consent ?? false }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  patchBodies.length = 0;
});

describe("CenterRealityFeed", () => {
  it("renders reflections directly on the first screen with privacy copy (no subview)", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch({ history: [{ entryId: "p1", eventTitle: "배가 고파", contentType: "youtube", completedAt: "2026-07-22T04:00:00Z", responseText: "MY REFLECTION" }] });
    render(<CenterRealityFeed locale="en" />);
    await waitFor(() => expect(screen.getByTestId("center-reflection-item")).toBeTruthy());
    expect(screen.getByText("MY REFLECTION")).toBeTruthy();
    expect(screen.getByText("Your reflections are private. Only you can see them.")).toBeTruthy();
    // at least one day-group renders
    expect(document.querySelector('[data-testid^="center-group-"]')).toBeTruthy();
  });

  it("the consent toggle reflects the stored preference and writes a partial PATCH on tap", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch({ consent: false, history: [] });
    render(<CenterRealityFeed locale="en" />);
    const toggle = await screen.findByTestId("center-consent-toggle");
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("false"));
    fireEvent.click(toggle);
    await waitFor(() => expect(patchBodies.length).toBe(1));
    expect(patchBodies[0]).toEqual({ personalizeTodayFromReflections: true });
  });

  // Slice 3.1B-3J.1 — the consent switch is a compact accessible setting row with a fixed-px track +
  // pinned thumb that cannot overflow, in either state, at any width.
  it("thumb stays within the track in OFF and ON states (pinned left + bounded translate)", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch({ consent: false, history: [] });
    render(<CenterRealityFeed locale="en" />);
    const toggle = await screen.findByTestId("center-consent-toggle");
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("false"));
    const track = screen.getByTestId("center-consent-track");
    const thumb = screen.getByTestId("center-consent-thumb");
    // Track 44px, thumb 20px, pinned at left 2px. OFF: no translate → right edge 22px ≤ 44px.
    expect(track.className).toContain("w-[44px]");
    expect(track.className).toContain("h-[24px]");
    expect(thumb.className).toContain("left-[2px]");
    expect(thumb.className).toContain("h-[20px]");
    expect(thumb.className).toContain("w-[20px]");
    expect(thumb.className).toContain("translate-x-0");
    // ON: translate 20px → right edge 2+20+20 = 42px ≤ 44px (still inside).
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
    expect(thumb.className).toContain("translate-x-[20px]");
  });

  it("the switch never shrinks in the flex row and stays semantically a switch", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch({ consent: false, history: [] });
    render(<CenterRealityFeed locale="en" />);
    const toggle = await screen.findByTestId("center-consent-toggle");
    expect(toggle.getAttribute("role")).toBe("switch");
    expect(screen.getByTestId("center-consent-track").className).toContain("shrink-0");
    // Not a large filled card: no rounded/bg box container drives the setting row.
    expect(toggle.className).not.toMatch(/rounded-2xl|bg-white\/\[0\.02\]/);
  });

  it("renders the KO consent label without overlapping the switch", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch({ consent: false, history: [] });
    render(<CenterRealityFeed locale="ko" />);
    await screen.findByTestId("center-consent-toggle");
    expect(screen.getByText("Today 개인화")).toBeTruthy();
    expect(screen.getByText("어제의 비공개 성찰을 바탕으로 짧은 Today 안내를 만듭니다.")).toBeTruthy();
  });

  it("restores the prior visual state when the PATCH fails", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch({ consent: false, history: [], patchOk: false });
    render(<CenterRealityFeed locale="en" />);
    const toggle = await screen.findByTestId("center-consent-toggle");
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("false"));
    fireEvent.click(toggle);
    // Optimistic ON, then reverts to OFF on the 500.
    await waitFor(() => expect(patchBodies.length).toBe(1));
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("false"));
  });

  it("rapid taps during a save do not queue a false state (single PATCH)", async () => {
    let release: (() => void) | null = null;
    const gate = new Promise<void>((r) => (release = () => r()));
    // @ts-expect-error test shim
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/bty/foundry/history")) return { ok: true, status: 200, json: async () => ({ ok: true, history: [] }) };
      if (u.includes("/api/me/conversation-preferences")) {
        if (init?.method === "PATCH") {
          patchBodies.push(JSON.parse(String(init.body)));
          await gate; // hold the save open so extra taps land mid-flight
          return { ok: true, status: 200, json: async () => ({ ok: true }) };
        }
        return { ok: true, status: 200, json: async () => ({ personalizeTodayFromReflections: false }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    render(<CenterRealityFeed locale="en" />);
    const toggle = await screen.findByTestId("center-consent-toggle");
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("false"));
    fireEvent.click(toggle); // starts the save (optimistic ON)
    fireEvent.click(toggle); // ignored while saving
    fireEvent.click(toggle); // ignored while saving
    expect(patchBodies.length).toBe(1); // extra taps produced no extra writes
    release!();
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
  });

  it("focuses the exact deep-linked entry (?entry=<id>)", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch({ history: [
      { entryId: "p1", eventTitle: "A", contentType: "youtube", completedAt: "2026-07-22T04:00:00Z", responseText: "one" },
      { entryId: "p2", eventTitle: "B", contentType: "document", completedAt: "2026-07-22T05:00:00Z", responseText: "two" },
    ] });
    render(<CenterRealityFeed locale="en" focusEntryId="p2" />);
    await waitFor(() => expect(screen.getAllByTestId("center-reflection-item").length).toBe(2));
    const focused = screen.getAllByTestId("center-reflection-item").find((el) => el.getAttribute("data-entry-id") === "p2");
    expect(focused?.getAttribute("data-focused")).toBe("1");
  });

  it("non-judgmental empty state; Korean privacy copy", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch({ history: [] });
    render(<CenterRealityFeed locale="ko" />);
    await waitFor(() => expect(screen.getByTestId("center-feed-empty")).toBeTruthy());
    expect(screen.getByText("나의 성찰은 비공개이며 본인만 볼 수 있습니다.")).toBeTruthy();
  });
});
