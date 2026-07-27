/** @vitest-environment jsdom */
/**
 * App Shell + Today Simplification V1 — Today empty-state primary-action patch.
 * Today must ALWAYS render exactly ONE actionable primary CTA, including when nothing is due:
 * continue an in-progress program → start an available practice → find a program (always valid).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TodayHome from "./TodayHome";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

function stub(over: { reminders?: unknown[]; practices?: unknown[]; programs?: unknown[] } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/me/today/brief")) return json({ ok: true, reminders: over.reminders ?? [], hostAttention: [] });
      if (u.includes("/api/arena/action-review-queue")) return json({ items: [] });
      if (u.includes("/api/me/daily-trace")) return json({ dailyTrace: [] });
      if (u.includes("/api/arena/practice")) return json({ practices: over.practices ?? [] });
      if (u.includes("/api/bty/foundry/learning-path")) return json({ ok: true, programs: over.programs ?? [] });
      return json({});
    }),
  );
}

// The Today empty state (0 actionable items) carries the calm suggestion CTA. Its
// wording distinguishes continue-program / start-practice / find-program.
async function emptyContains(text: string): Promise<HTMLElement> {
  await waitFor(() => expect(screen.getByTestId("today-empty").textContent).toContain(text));
  return screen.getByTestId("today-empty");
}

const dueReminder = {
  stableId: "act:1",
  category: "ACTION_DUE",
  title: "submit proof",
  state: "due_today",
  canonicalDeepLink: "/en/app?tab=today&fieldActionContract=abc",
};

describe("TodayHome — Today action list + calm empty state (B3A.2B)", () => {
  it("empty day with NOTHING available → calm empty CTA: Find a program", async () => {
    stub({ reminders: [], practices: [], programs: [] });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    await emptyContains("Find a program");
    expect(screen.queryByTestId("today-item")).toBeNull(); // no action items
  });

  it("an available practice (no active program) → Start practice", async () => {
    stub({ reminders: [], practices: [{ id: "p1" }], programs: [] });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    const cta = await emptyContains("Start practice");
    expect(cta.textContent).toContain("Practice one real-world decision.");
  });

  it("an active program outranks an available practice (Continue learning)", async () => {
    stub({ reminders: [], practices: [{ id: "p1" }], programs: [{ completion_pct: 40 }] });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    await emptyContains("Continue learning");
  });

  it("a fully-complete program is NOT 'active' (100% → falls through to find)", async () => {
    stub({ reminders: [], practices: [], programs: [{ completion_pct: 100 }] });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    await emptyContains("Find a program");
  });

  it("due work appears as a Today item with its deep link (not the empty state)", async () => {
    stub({ reminders: [dueReminder], practices: [{ id: "p1" }], programs: [{ completion_pct: 40 }] });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("today-item").getAttribute("href")).toBe("/en/app?tab=today&fieldActionContract=abc"));
    expect(screen.queryByTestId("today-empty")).toBeNull();
  });

  it("empty-state CTA navigates IN-SHELL (Practice / Learn) via onNavigate", async () => {
    const onNav = vi.fn();
    stub({ reminders: [], practices: [{ id: "p1" }], programs: [] });
    const { unmount } = render(<TodayHome locale="en" onNavigate={onNav} />);
    fireEvent.click(await emptyContains("Start practice"));
    expect(onNav).toHaveBeenCalledWith("practice");
    unmount();
    onNav.mockReset();
    stub({ reminders: [], practices: [], programs: [] });
    render(<TodayHome locale="en" onNavigate={onNav} />);
    fireEvent.click(await emptyContains("Find a program"));
    expect(onNav).toHaveBeenCalledWith("learn");
  });

  it("EN/KO copy parity for the empty-day suggestion", async () => {
    stub({ reminders: [], practices: [{ id: "p1" }], programs: [] });
    const { unmount } = render(<TodayHome locale="ko" onNavigate={() => {}} />);
    const koPractice = await emptyContains("연습 시작");
    expect(koPractice.textContent).toContain("현실에서 필요한 판단 하나를 연습하세요.");
    unmount();
    stub({ reminders: [], practices: [], programs: [] });
    render(<TodayHome locale="ko" onNavigate={() => {}} />);
    await emptyContains("프로그램 찾기");
  });

  it("no 'Show everything' control exists anymore", async () => {
    stub({ reminders: [dueReminder] });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    await screen.findByTestId("today-home");
    expect(screen.queryByTestId("today-show-everything-toggle")).toBeNull();
  });
});
