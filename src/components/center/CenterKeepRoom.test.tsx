/** @vitest-environment jsdom */
/**
 * Center Promise Loop STEP 1A — Center Daily Keep room.
 *
 * Asserts: the writing surface renders when no keep exists for today; saving a line
 * POSTs to the Center-owned /api/bty/center/keep (and NEVER an Arena / action-contract
 * endpoint) and moves to the held state; the server is the source of truth (the kept
 * line is not written to localStorage); an existing keep-for-today opens directly in
 * the held state.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CenterKeepRoom from "@/components/center/CenterKeepRoom";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("CenterKeepRoom (Center Daily Keep, STEP 1A)", () => {
  it("shows the writing surface when no keep exists for today", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ line: null, keptToday: false }), { status: 200 }),
      ),
    );

    render(<CenterKeepRoom locale="en" />);

    await waitFor(() => {
      expect(document.querySelector("[data-center-keep-input]")).toBeTruthy();
    });
    expect(
      screen.getByText("Write one line you want to carry honestly today."),
    ).toBeTruthy();
  });

  it("saves via POST /api/bty/center/keep (never Arena), shows held state, no localStorage", async () => {
    const calls: { url: string; method: string }[] = [];
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        calls.push({ url: String(url), method });
        if (method === "GET") {
          return new Response(JSON.stringify({ line: null, keptToday: false }), { status: 200 });
        }
        return new Response(JSON.stringify({ ok: true, keptToday: true }), { status: 200 });
      }),
    );

    render(<CenterKeepRoom locale="en" />);

    const input = (await waitFor(() => {
      const el = document.querySelector("[data-center-keep-input]");
      expect(el).toBeTruthy();
      return el;
    })) as HTMLTextAreaElement;

    fireEvent.change(input, { target: { value: "Stay honest with myself." } });
    fireEvent.click(document.querySelector("[data-center-keep-save]")!);

    await waitFor(() => {
      expect(document.querySelector("[data-center-keep-held]")).toBeTruthy();
    });
    expect(screen.getByText("Held for today.")).toBeTruthy();
    expect(screen.getByText(/Stay honest with myself\./)).toBeTruthy();

    // POST went to the Center-owned keep endpoint...
    const post = calls.find((c) => c.method === "POST");
    expect(post?.url).toContain("/api/bty/center/keep");
    // ...and NO Arena / action-contract endpoint was ever touched.
    expect(calls.some((c) => /arena|action-contract/.test(c.url))).toBe(false);
    // Server is the source of truth — the kept line is not persisted to localStorage.
    expect(setItem).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("Stay honest"),
    );
  });

  it("opens in the held state when a keep already exists for today", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ line: "Return to myself with honesty.", keptToday: true }),
            { status: 200 },
          ),
      ),
    );

    render(<CenterKeepRoom locale="en" />);

    await waitFor(() => {
      expect(document.querySelector("[data-center-keep-held]")).toBeTruthy();
    });
    expect(screen.getByText(/Return to myself with honesty\./)).toBeTruthy();
    expect(document.querySelector("[data-center-keep-input]")).toBeFalsy();
  });
});
