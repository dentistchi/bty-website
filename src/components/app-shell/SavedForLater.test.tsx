/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import BtyDailyAppShell from "./BtyDailyAppShell";
import SavedForLater, { type SavedCapture } from "./SavedForLater";

/**
 * R1B-C2-R1 — Today → Saved for later (relocated from Me).
 *
 * Saved != Promised. These tests assert the ABSENCE of commitment language and affordances as
 * firmly as they assert the presence of the item, because the whole risk of this surface is that
 * it quietly becomes a to-do list.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const item = (over: Partial<SavedCapture> = {}): SavedCapture => ({
  id: "cap-1",
  sourceType: "teams_message",
  previewText: "Can you confirm the vendor quote?",
  sourceUrl: "https://teams.microsoft.com/l/message/1",
  sourceMetadata: { provider: "teams", sender_display: "Ana" },
  status: "captured",
  capturedAt: "2026-08-28T00:00:00Z",
  ...over,
});

function stubCaptures(items: SavedCapture[] | "error") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/bty/action-capture/mine")) {
        if (items === "error") return new Response("{}", { status: 500 });
        return new Response(JSON.stringify({ ok: true, items }), { status: 200 });
      }
      if (u.includes("/api/auth/session")) return new Response(JSON.stringify({ ok: true, user: { email: "f@x.test" } }), { status: 200 });
      if (u.includes("/api/me/today/brief")) return new Response(JSON.stringify({ ok: true, reminders: [] }), { status: 200 });
      return new Response("{}", { status: 200 });
    }),
  );
}

describe("Today → Saved for later — the measured Today focused-view grammar", () => {
  it("1+3. Today exposes a quiet Saved for later entry, and there is still no fifth tab", async () => {
    stubCaptures([item()]);
    render(<BtyDailyAppShell locale="en" />);
    const tabs = await screen.findByRole("navigation", { name: /App navigation/i });
    expect(within(tabs).getAllByRole("button").map((b) => b.textContent?.trim()))
      .toEqual(["Today", "Learn", "Practice", "Me"]);

    const entry = await screen.findByTestId("today-saved-entry");
    expect(entry.textContent ?? "").toContain("Saved for later");
    // A destination, never a backlog: no count, no badge, no digit of any kind.
    expect(entry.textContent ?? "").not.toMatch(/\d/);
  });

  it("opens the focused lane and 10. Back returns to Today via the existing grammar", async () => {
    stubCaptures([item()]);
    render(<BtyDailyAppShell locale="en" />);
    await screen.findByRole("navigation", { name: /App navigation/i });
    fireEvent.click(await screen.findByTestId("today-saved-entry"));

    expect(await screen.findByTestId("saved-view")).toBeTruthy();
    const back = screen.getByTestId("saved-back");
    expect(back.textContent ?? "").toContain("Today");
    fireEvent.click(back);
    expect(await screen.findByTestId("today-home")).toBeTruthy();
  });

  it("2+12. Me NO LONGER exposes Saved for later, and its remaining nav is intact", async () => {
    stubCaptures([item()]);
    render(<BtyDailyAppShell locale="en" />);
    const tabs = await screen.findByRole("navigation", { name: /App navigation/i });
    fireEvent.click(within(tabs).getByText("Me"));
    await screen.findByTestId("me-home");

    expect(screen.queryByTestId("me-row-saved"), "the Me row is gone").toBeNull();
    expect(screen.queryByTestId("me-saved-view")).toBeNull();
    expect(screen.getByTestId("me-home").textContent ?? "").not.toMatch(/Saved for later/i);
    // The rows that remain still work.
    for (const id of ["me-row-learned", "me-row-center", "me-account-row"]) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
  });

  it("9. a capture is NOT rendered as a Today action/reminder item", async () => {
    stubCaptures([item()]);
    render(<BtyDailyAppShell locale="en" />);
    await screen.findByTestId("today-saved-entry");
    // The preview text belongs to the focused lane only — never to Today's own item list.
    expect(screen.queryByText("Can you confirm the vendor quote?")).toBeNull();
    expect(screen.queryByTestId("today-item")).toBeNull();
  });

  it("8. Today's own loaders are independent — Today fetches NO capture endpoint", async () => {
    stubCaptures([item()]);
    render(<BtyDailyAppShell locale="en" />);
    await screen.findByTestId("today-saved-entry");
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .map((c) => String(c[0]));
    expect(calls.some((u) => u.includes("/api/me/today/brief")), "Today still loads its own brief").toBe(true);
    expect(
      calls.some((u) => u.includes("/api/bty/action-capture")),
      "Today must not read captures until the lane is opened",
    ).toBe(false);
  });
});

describe("Saved for later — the item", () => {
  it("shows the preview and the Teams context", async () => {
    stubCaptures([item()]);
    render(<SavedForLater locale="en" />);
    expect(await screen.findByText("Can you confirm the vendor quote?")).toBeTruthy();
    expect(screen.getByTestId("saved-context").textContent ?? "").toContain("Teams · Ana");
  });

  it("falls back to a quiet label when there is no preview — never a synthesized task", async () => {
    stubCaptures([item({ previewText: null })]);
    render(<SavedForLater locale="en" />);
    expect(await screen.findByText("Saved Teams message")).toBeTruthy();
    // The ids that DO exist are never promoted into a title.
    expect(screen.queryByText(/teams:/i)).toBeNull();
  });

  it("shows Open in Teams ONLY when a URL was stored", async () => {
    stubCaptures([item()]);
    const { unmount } = render(<SavedForLater locale="en" />);
    const link = await screen.findByTestId("saved-open");
    expect(link.getAttribute("href")).toBe("https://teams.microsoft.com/l/message/1");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("target")).toBe("_blank");
    unmount();

    cleanup();
    stubCaptures([item({ sourceUrl: null })]);
    render(<SavedForLater locale="en" />);
    await screen.findByTestId("saved-item");
    expect(screen.queryByTestId("saved-open"), "no dead button").toBeNull();
  });
});

describe("Saved != Promised — no commitment affordance exists", () => {
  it("renders no deadline, priority, completion control, XP or Arena/Host/verification language", async () => {
    stubCaptures([item()]);
    const { container } = render(<SavedForLater locale="en" />);
    await screen.findByTestId("saved-item");

    expect(container.querySelector('input[type="checkbox"]'), "no completion checkbox").toBeNull();

    const text = container.textContent ?? "";
    for (const forbidden of [
      "Due", "due", "Overdue", "overdue", "Deadline", "deadline", "Priority", "priority",
      "Complete", "Mark as", "XP", "Action plan", "Arena", "Practice", "Verify", "Verification",
      "Host", "Review", "Evidence", "Today",
    ]) {
      expect(text, `must not say "${forbidden}"`).not.toContain(forbidden);
    }
  });
});

describe("Saved for later — loading / empty / error", () => {
  it("shows the loading state, then the list", async () => {
    stubCaptures([item()]);
    render(<SavedForLater locale="en" />);
    expect(screen.getByTestId("saved-loading")).toBeTruthy();
    expect(await screen.findByTestId("saved-list")).toBeTruthy();
  });

  it("empty state is minimal and does not teach the feature or mention Teams integration", async () => {
    stubCaptures([]);
    render(<SavedForLater locale="en" />);
    const empty = await screen.findByTestId("saved-empty");
    expect(empty.textContent ?? "").toContain("Nothing saved for later.");
    expect(empty.textContent?.length ?? 0).toBeLessThan(40);
  });

  it("fails calmly and never implies an Action Contract failed; retry recovers", async () => {
    stubCaptures("error");
    render(<SavedForLater locale="en" />);
    const err = await screen.findByTestId("saved-error");
    expect(err.textContent ?? "").toContain("Saved items could not be loaded.");
    expect(err.textContent ?? "").not.toContain("Action");
    expect(err.textContent ?? "").not.toContain("contract");

    stubCaptures([item()]);
    fireEvent.click(screen.getByTestId("saved-retry"));
    await waitFor(() => expect(screen.getByTestId("saved-list")).toBeTruthy());
  });
});

describe("A capture NEVER reaches Today", () => {
  it("Today renders no captured item even when one exists", async () => {
    // Today reads /api/me/today/brief; the capture API is a different surface entirely.
    stubCaptures([item()]);
    render(<BtyDailyAppShell locale="en" />);
    await screen.findByRole("navigation", { name: /App navigation/i });
    expect(screen.queryByText("Can you confirm the vendor quote?"), "Today must not show a capture").toBeNull();
    expect(screen.queryByTestId("saved-item")).toBeNull();
  });
});
