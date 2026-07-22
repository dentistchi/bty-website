/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import TodayPersonalBrief from "./TodayPersonalBrief";

/**
 * Slice 3.1B-3J — Today Personal Brief: deterministic reminders + optional AI observation/suggestion.
 * The raw Reflection body never reaches this client (the DTO carries only generated sentences +
 * reminder DTOs). Renders nothing when there is neither a brief nor a reminder.
 */

function mockBrief(payload: unknown) {
  return vi.fn(async (url: string) => {
    if (String(url).includes("/api/me/today/brief")) return { ok: true, status: 200, json: async () => payload };
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TodayPersonalBrief", () => {
  it("renders nothing when there is neither a brief nor a reminder", async () => {
    // @ts-expect-error test shim
    global.fetch = mockBrief({ ok: true, consent: false, brief: null, reminders: [] });
    const { container } = render(<TodayPersonalBrief locale="en" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId("today-personal-brief")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("renders the AI observation + suggestion and the reminder list with deep links", async () => {
    // @ts-expect-error test shim
    global.fetch = mockBrief({
      ok: true,
      consent: true,
      brief: { yesterdayObservation: "Yesterday, alignment felt important.", todaySuggestion: "Ask one person to restate the goal." },
      reminders: [
        { stableId: "action:c1", category: "ACTION_DUE", title: "submit QR", state: "overdue", canonicalDeepLink: "/en/bty-arena" },
        { stableId: "req:a1", category: "REQUIRED_LEARNING", title: "OSHA", state: "incomplete_required", canonicalDeepLink: "/en/app?tab=foundry" },
      ],
    });
    render(<TodayPersonalBrief locale="en" />);
    await waitFor(() => expect(screen.getByTestId("today-personal-brief")).toBeTruthy());
    expect(screen.getByText("Yesterday, alignment felt important.")).toBeTruthy();
    expect(screen.getByText("Ask one person to restate the goal.")).toBeTruthy();
    const rows = screen.getAllByTestId("brief-reminder");
    expect(rows.length).toBe(2);
    const link = rows[0].querySelector("a");
    expect(link?.getAttribute("href")).toBe("/en/bty-arena");
    expect(rows[0].getAttribute("data-state")).toBe("overdue");
  });

  it("renders a FOLLOW_UP_DUE reminder (Slice 3.1B-3K) — checkpoint title in-line, deep link to the surface", async () => {
    // @ts-expect-error test shim
    global.fetch = mockBrief({
      ok: true,
      consent: false,
      brief: null,
      reminders: [
        {
          stableId: "followup:f1",
          category: "FOLLOW_UP_DUE",
          title: "7-day follow-up · Confirm Patient Understanding",
          state: "due_today",
          canonicalDeepLink: "/en/app?tab=foundry&followup=f1",
        },
      ],
    });
    render(<TodayPersonalBrief locale="en" />);
    await waitFor(() => expect(screen.getByTestId("brief-reminders")).toBeTruthy());
    const row = screen.getByTestId("brief-reminder");
    expect(row.getAttribute("data-category")).toBe("FOLLOW_UP_DUE");
    expect(row.textContent).toContain("7-day follow-up · Confirm Patient Understanding");
    // No category prefix is prepended (the checkpoint eyebrow lives inside the title).
    expect(row.textContent).not.toContain("Required training ·");
    expect(row.querySelector("a")?.getAttribute("href")).toBe("/en/app?tab=foundry&followup=f1");
  });

  it("shows reminders even when the brief is null (consent off / AI omitted)", async () => {
    // @ts-expect-error test shim
    global.fetch = mockBrief({
      ok: true,
      consent: false,
      brief: null,
      reminders: [{ stableId: "req:a1", category: "REQUIRED_LEARNING", title: "OSHA", state: "incomplete_required", canonicalDeepLink: "/en/app?tab=foundry" }],
    });
    render(<TodayPersonalBrief locale="en" />);
    await waitFor(() => expect(screen.getByTestId("brief-reminders")).toBeTruthy());
    expect(screen.queryByTestId("brief-ai")).toBeNull();
  });
});
