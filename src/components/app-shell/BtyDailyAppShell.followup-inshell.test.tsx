/** @vitest-environment jsdom */
/**
 * 3.2G-R2 — First-tap in-shell follow-up entry (shell composition).
 *
 * The controlling device failure: from a mounted Today, the FIRST tap on a leadership follow-up row
 * escaped through the web path (raw anchor hard navigation / pre-hydration activation) instead of
 * opening inside the already-mounted four-tab shell. This test mounts the REAL shell and proves the
 * exact sequence WITHOUT any document navigation or second tap:
 *   mounted Today → first row activation → control room rendered → Back → Today rendered again.
 * A raw <a href> would be an inert no-op in jsdom (no in-shell state change) — so the control room
 * appearing on the first click is meaningful proof that activation drives the mounted shell.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import BtyDailyAppShell from "./BtyDailyAppShell";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const EVENT_ID = "4dc5f309-1111-4222-8333-444444444444";
const FOCUS_ID = "9ab0c1d2-5555-4666-8777-888888888888";
const followUp = {
  stableId: "FOLLOW_UP_OVERDUE:1",
  category: "FOLLOW_UP_OVERDUE",
  eventId: EVENT_ID,
  focusId: FOCUS_ID,
  participantDisplayName: "Hojin Kim",
  trainingTitle: "배가 고파",
  reason: "Follow-up is 2 days overdue",
  sourceTimestamp: "2026-07-27T00:00:00Z",
  deepLink: `/en/app?tab=foundry&event=${EVENT_ID}&section=followups&focus=${FOCUS_ID}`,
};

function stub() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      const body =
        u.includes("/api/auth/session")
          ? { ok: true, user: { email: "ywamer2022@gmail.com" } }
          : u.includes("/api/me/today/brief")
            ? { ok: true, reminders: [], hostAttention: [followUp] }
            : u.includes("/api/bty/foundry/events") && !u.match(/events\/[^/?]+/)
              ? { events: [] }
              : /\/api\/bty\/foundry\/events\/[^/?]+$/.test(u)
                ? {
                    event: { id: EVENT_ID, title: "배가 고파", status: "open", join_url: "https://x/f/t", created_at: "2026-07-27T00:00:00Z", closed_at: null, training: null, document: null },
                    participants: [],
                    joined_count: 0,
                    completed_count: 0,
                  }
                : u.includes("/api/bty/foundry/modules")
                  ? { drafts: [] }
                  : { ok: true, event: null, rows: [], responses: [], items: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

describe("3.2G-R2 — first-tap in-shell follow-up entry (shell composition)", () => {
  it("mounted Today → first tap → control room in-shell → Back → Today, no document navigation", async () => {
    stub();
    render(<BtyDailyAppShell locale="en" />);

    // Today is the default tab; the follow-up row appears after the brief resolves — as a BUTTON.
    const open = await screen.findByTestId("today-followup-open");
    expect(open.tagName).toBe("BUTTON");
    expect(open.closest("[data-testid='today-followup-row']")?.querySelector("a")).toBeNull();

    // First activation (no retry). A raw anchor would not change any in-shell state in jsdom.
    fireEvent.click(open);

    // The control room opens IN-SHELL on the first tap (its "←" Back affordance appears).
    await waitFor(() => expect(screen.getByText(/←/)).toBeTruthy());
    // R4: the control room resolves to real content — never an empty Learn body / Foundry home.
    await waitFor(() => expect(screen.getByText("배가 고파")).toBeTruthy());
    expect(screen.queryByText(/Required learning|My learning/i)).toBeNull();
    // No URL was used as transport: no deep-link query serialized to the address bar.
    expect(window.location.search).toBe("");
    expect(window.location.pathname).toBe("/");

    // Back returns to Today in-shell (R1 origin-aware return preserved) — the follow-up row is back.
    fireEvent.click(screen.getByText(/←/));
    await waitFor(() => expect(screen.getByTestId("today-followup-open")).toBeTruthy());
  });

  it("R4: the first control-bound surface is never an empty body (resolving or control content)", async () => {
    stub();
    render(<BtyDailyAppShell locale="en" />);
    fireEvent.click(await screen.findByTestId("today-followup-open"));
    // Immediately after activation the control room shows either its resolving surface or content —
    // and the back affordance — but never the retired empty/aria-hidden body or the Foundry home.
    await waitFor(() => {
      const resolving = screen.queryByTestId("control-room-resolving");
      const content = screen.queryByText("배가 고파");
      expect(Boolean(resolving) || Boolean(content)).toBe(true);
    });
    expect(screen.queryByText(/Required learning|My learning/i)).toBeNull();
  });
});
