/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import FoundryEventRooms from "./FoundryEventRooms";

/**
 * Real render on the installed-app Foundry-tab surface path (the exact node the
 * BtyDailyAppShell mounts for `tab === "foundry"`). Proves a non-host learner sees
 * their required-learning surface inside the tab, and that mounting it fires no
 * regression in the existing host/non-host branch.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function routeFetch(map: Record<string, { status: number; body: unknown }>) {
  global.fetch = vi.fn(async (url: string) => {
    const key = Object.keys(map).find((k) => url.includes(k));
    const hit = key ? map[key] : { status: 404, body: {} };
    return {
      ok: hit.status >= 200 && hit.status < 300,
      status: hit.status,
      json: async () => hit.body,
    };
  }) as unknown as typeof fetch;
}

describe("FoundryEventRooms — required-learning surface on the Foundry tab", () => {
  it("a non-host learner sees their Completed assignment inside the Foundry tab", async () => {
    routeFetch({
      "/api/bty/foundry/events": { status: 403, body: { error: "foundry_host_required" } },
      "/api/bty/foundry/modules": { status: 403, body: { error: "foundry_host_required" } },
      "/api/bty/foundry/assignments/mine": {
        status: 200,
        body: {
          ok: true,
          assignments: [
            {
              assignmentId: "a-done",
              eventId: "5e543327",
              status: "completed",
              title: "Onboarding Care",
              assignedAt: "2026-06-01T00:00:00Z",
              completedAt: "2026-06-10T00:00:00Z",
              roomUrl: "https://app.example/f/btyfr1.done",
              participationMode: "assigned_overlay",
            },
          ],
        },
      },
    });

    render(<FoundryEventRooms locale="en" />);

    // The learner surface mounts inside the tab, with the completed item and the
    // intentional empty Required state (Required: 0 / Completed: 1 — the live baseline).
    await waitFor(() => expect(screen.getByTestId("foundry-required-learning")).toBeTruthy());
    expect(screen.getByTestId("required-empty")).toBeTruthy();
    // Completed is collapsed by default (B3A.2C): the count shows; expand to see the card.
    expect(screen.getByTestId("completed-disclosure").textContent).toContain("Completed (1)");
    fireEvent.click(screen.getByTestId("completed-disclosure"));
    expect(await screen.findByText("Onboarding Care")).toBeTruthy();
  });
});
