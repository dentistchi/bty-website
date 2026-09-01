/** @vitest-environment jsdom */
/**
 * Center → Today personalization, the toggle that could not be turned on (Slice A0.2).
 *
 * TWO FAULTS, and the second one hid the first:
 *   the read/write route builds its client in a factory that had no bearer transport, so in the
 *   Teams tab both calls 401'd;
 *   and the UI collapsed every read failure into `setConsent(false)`, so a refusal rendered as a
 *   confident OFF and the switch looked simply broken.
 *
 * The transport is repaired centrally (`bearerTransport.test.ts`). These assert the surface: a
 * preference we could not read is never shown as OFF, and a failed save says so.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import CenterRealityFeed from "@/components/center/CenterRealityFeed";

const PREFS = "/api/me/conversation-preferences";

/** Records PATCH bodies so the write contract can be asserted. */
let patched: unknown[];

function stub(prefsGet: () => Response, prefsPatch: () => Response = () => new Response("{}", { status: 200 })) {
  patched = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.includes(PREFS)) {
        if (init?.method === "PATCH") {
          patched.push(JSON.parse(String(init.body)));
          return prefsPatch();
        }
        return prefsGet();
      }
      // Everything else the feed loads is irrelevant here.
      return new Response(JSON.stringify({ ok: true, entries: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

const on = () =>
  new Response(JSON.stringify({ personalizeTodayFromReflections: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
const off = () =>
  new Response(JSON.stringify({ personalizeTodayFromReflections: false }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const toggle = () => screen.getByTestId("center-consent-toggle");

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("reading the preference", () => {
  it("(1) OFF is rendered as OFF, and the switch is usable", async () => {
    stub(off);
    render(<CenterRealityFeed locale="en" />);
    await waitFor(() => expect(toggle().getAttribute("aria-checked")).toBe("false"));
    expect(toggle().hasAttribute("disabled")).toBe(false);
    expect(screen.queryByTestId("center-consent-error")).toBeNull();
  });

  it("(2) ON is rendered as ON", async () => {
    stub(on);
    render(<CenterRealityFeed locale="en" />);
    await waitFor(() => expect(toggle().getAttribute("aria-checked")).toBe("true"));
  });

  it("(3) a FAILED READ never masquerades as OFF", async () => {
    // The exact Teams symptom: a 401 used to render a confident, valid-looking OFF.
    stub(() => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }));
    render(<CenterRealityFeed locale="en" />);
    await waitFor(() => expect(screen.getByTestId("center-consent-error")).toBeTruthy());
    expect(screen.getByTestId("center-consent-error").textContent).toContain("Couldn't load this setting.");
    // Unknown, not off — and not offered as a switch that would lie.
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    expect(toggle().hasAttribute("disabled")).toBe(true);
  });

  it("(3b) a rejected read is also surfaced, not swallowed", async () => {
    stub(() => {
      throw new Error("network");
    });
    render(<CenterRealityFeed locale="en" />);
    await waitFor(() => expect(screen.getByTestId("center-consent-error")).toBeTruthy());
  });

  it("(3c) Retry re-reads and recovers", async () => {
    let first = true;
    stub(() => {
      if (first) {
        first = false;
        return new Response("{}", { status: 401 });
      }
      return on();
    });
    render(<CenterRealityFeed locale="en" />);
    await waitFor(() => expect(screen.getByTestId("center-consent-retry")).toBeTruthy());
    fireEvent.click(screen.getByTestId("center-consent-retry"));
    await waitFor(() => expect(toggle().getAttribute("aria-checked")).toBe("true"));
    expect(screen.queryByTestId("center-consent-error")).toBeNull();
  });
});

describe("writing the preference", () => {
  it("(4/10) enabling sends the owner's own preference and updates the switch", async () => {
    stub(off);
    render(<CenterRealityFeed locale="en" />);
    await waitFor(() => expect(toggle().getAttribute("aria-checked")).toBe("false"));
    fireEvent.click(toggle());
    await waitFor(() => expect(toggle().getAttribute("aria-checked")).toBe("true"));
    // No user id is ever sent — ownership is the session, server-side.
    expect(patched).toEqual([{ personalizeTodayFromReflections: true }]);
    expect(JSON.stringify(patched)).not.toContain("user_id");
  });

  it("(5) disabling works the same way", async () => {
    stub(on);
    render(<CenterRealityFeed locale="en" />);
    await waitFor(() => expect(toggle().getAttribute("aria-checked")).toBe("true"));
    fireEvent.click(toggle());
    await waitFor(() => expect(toggle().getAttribute("aria-checked")).toBe("false"));
    expect(patched).toEqual([{ personalizeTodayFromReflections: false }]);
  });

  it("(11/12) a failed save rolls the switch back AND says so", async () => {
    stub(off, () => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }));
    render(<CenterRealityFeed locale="en" />);
    await waitFor(() => expect(toggle().getAttribute("aria-checked")).toBe("false"));
    fireEvent.click(toggle());
    await waitFor(() => expect(screen.getByTestId("center-consent-error")).toBeTruthy());
    expect(screen.getByTestId("center-consent-error").textContent).toContain("Couldn't save that.");
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    // The saving state ended — the control is usable again, never stuck.
    expect(toggle().hasAttribute("disabled")).toBe(false);
  });

  it("(14/15) the request carries ONLY the boolean — no reflection text, no XP, no contract", async () => {
    stub(off);
    render(<CenterRealityFeed locale="en" />);
    await waitFor(() => expect(toggle().getAttribute("aria-checked")).toBe("false"));
    fireEvent.click(toggle());
    await waitFor(() => expect(patched.length).toBe(1));
    expect(Object.keys(patched[0] as object)).toEqual(["personalizeTodayFromReflections"]);
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) =>
      String(c[0]),
    );
    for (const forbidden of ["/xp", "core_xp", "action-contract", "/arena/", "leadership-engine"]) {
      expect(calls.some((u) => u.includes(forbidden)), `toggling must not call ${forbidden}`).toBe(false);
    }
  });
});
