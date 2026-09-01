/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import SavedForLater, { type SavedCapture } from "./SavedForLater";

/**
 * Saved for later — the one decision (Slice T2).
 *
 * These tests assert the ABSENCE of task-manager affordances as firmly as the presence of the two
 * controls, because the entire risk of adding a decision to this surface is that it quietly turns
 * into an inbox with a backlog to drive down.
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
  triageChoice: null,
  triagedAt: null,
  ...over,
});

/** `triage` controls what the write endpoint answers; the read always succeeds. */
function stub(items: SavedCapture[], triage: { ok: boolean } = { ok: true }) {
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/triage")) {
        const body = JSON.parse(String(init?.body ?? "{}"));
        calls.push({ url: u, body });
        if (!triage.ok) return new Response(JSON.stringify({ ok: false, error: "SERVER_ERROR" }), { status: 500 });
        const id = decodeURIComponent(u.split("/action-capture/")[1].split("/triage")[0]);
        const base = items.find((i) => i.id === id)!;
        return new Response(
          JSON.stringify({ ok: true, changed: true, capture: { ...base, triageChoice: body.choice, triagedAt: "2026-09-01T00:00:00Z" } }),
          { status: 200 },
        );
      }
      if (u.includes("/api/bty/action-capture/mine")) {
        return new Response(JSON.stringify({ ok: true, items }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }),
  );
  return calls;
}

async function renderReady(items: SavedCapture[], triage?: { ok: boolean }) {
  const calls = stub(items, triage);
  render(<SavedForLater locale="en" />);
  await screen.findByTestId("saved-list");
  return calls;
}

describe("19+23. the controls appear exactly where a decision is still open", () => {
  it("an undecided card offers Soon and Later", async () => {
    await renderReady([item()]);
    const card = screen.getByTestId("saved-item");
    expect(within(card).getByTestId("saved-triage-soon").textContent).toBe("Soon");
    expect(within(card).getByTestId("saved-triage-later").textContent).toBe("Later");
  });

  it("a decided card offers no triage control at all — V1 has no undo and no re-triage", async () => {
    await renderReady([item({ id: "a", triageChoice: "soon", triagedAt: "2026-09-01T00:00:00Z" })]);
    expect(screen.queryByTestId("saved-triage-controls")).toBeNull();
    expect(screen.queryByTestId("saved-triage-soon")).toBeNull();
  });
});

describe("20+21+22. the three places", () => {
  it("puts each card in its own section and hides the sections that are empty", async () => {
    await renderReady([
      item({ id: "n1" }),
      item({ id: "s1", triageChoice: "soon", triagedAt: "2026-09-01T00:00:00Z" }),
    ]);
    expect(within(screen.getByTestId("saved-group-new")).getAllByTestId("saved-item")).toHaveLength(1);
    expect(within(screen.getByTestId("saved-group-soon")).getAllByTestId("saved-item")).toHaveLength(1);
    // No "Later (0)", no empty heading, no zero anywhere.
    expect(screen.queryByTestId("saved-group-later")).toBeNull();
  });

  it("choosing Soon moves the card into Soon and sends the decision once", async () => {
    const calls = await renderReady([item({ id: "cap-1" })]);
    fireEvent.click(screen.getByTestId("saved-triage-soon"));

    await waitFor(() => expect(screen.getByTestId("saved-group-soon")).toBeTruthy());
    expect(within(screen.getByTestId("saved-group-soon")).getByTestId("saved-item")).toBeTruthy();
    expect(screen.queryByTestId("saved-group-new")).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ choice: "soon" });
    expect(calls[0].url).toContain("/api/bty/action-capture/cap-1/triage");
  });

  it("choosing Later moves the card into Later", async () => {
    await renderReady([item({ id: "cap-1" })]);
    fireEvent.click(screen.getByTestId("saved-triage-later"));
    await waitFor(() => expect(screen.getByTestId("saved-group-later")).toBeTruthy());
    expect(screen.queryByTestId("saved-group-new")).toBeNull();
  });
});

describe("24. a failed decision never loses the card", () => {
  it("rolls the card back to where it was, keeps its controls, and says so quietly", async () => {
    await renderReady([item({ id: "cap-1" })], { ok: false });

    fireEvent.click(screen.getByTestId("saved-triage-soon"));

    await screen.findByTestId("saved-triage-error");
    // Back in New, still undecided, still actionable — pressing again IS the recovery.
    expect(within(screen.getByTestId("saved-group-new")).getByTestId("saved-item")).toBeTruthy();
    expect(screen.queryByTestId("saved-group-soon")).toBeNull();
    expect(screen.getByTestId("saved-triage-soon")).toBeTruthy();
    expect(screen.getByTestId("saved-triage-error").textContent).toBe("That didn't save.");
  });
});

describe("25+26. everything that already worked still works", () => {
  it("keeps Open in Teams on a decided card", async () => {
    await renderReady([item({ triageChoice: "later", triagedAt: "2026-09-01T00:00:00Z" })]);
    const link = screen.getByTestId("saved-open");
    expect(link.getAttribute("href")).toBe("https://teams.microsoft.com/l/message/1");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("keeps loading, empty and error as distinct states", async () => {
    stub([]);
    render(<SavedForLater locale="en" />);
    expect(screen.getByTestId("saved-loading")).toBeTruthy();
    await screen.findByTestId("saved-empty");
    expect(screen.queryByTestId("saved-list")).toBeNull();
    expect(screen.queryByTestId("saved-error")).toBeNull();
    cleanup();

    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    render(<SavedForLater locale="en" />);
    await screen.findByTestId("saved-error");
    expect(screen.getByTestId("saved-retry")).toBeTruthy();
  });
});

describe("27. it is still not a task manager", () => {
  it("renders no count, badge, deadline, checkbox or completion control", async () => {
    await renderReady([
      item({ id: "n1" }),
      item({ id: "s1", triageChoice: "soon", triagedAt: "2026-09-01T00:00:00Z" }),
      item({ id: "l1", triageChoice: "later", triagedAt: "2026-09-01T00:00:00Z" }),
    ]);
    const view = screen.getByTestId("saved-view");

    expect(view.querySelector('input[type="checkbox"]')).toBeNull();
    // Section headings name a place; a number would turn them into a backlog to drive down.
    for (const key of ["new", "soon", "later"]) {
      const heading = within(screen.getByTestId(`saved-group-${key}`)).getAllByText(/./)[0];
      expect(heading.textContent).not.toMatch(/\d/);
    }
    const text = view.textContent ?? "";
    for (const forbidden of ["Done", "Complete", "Clear", "Dismiss", "Delete", "Overdue", "Due", "Deadline", "XP", "Undo", "Priority"]) {
      expect(text, `must not say "${forbidden}"`).not.toContain(forbidden);
    }
  });
});
