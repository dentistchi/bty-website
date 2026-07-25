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

// Re-query on every poll — the primary node changes element type (button<->a) across kinds,
// so a held reference goes stale. Returns the settled primary-action element.
async function primaryKind(kind: string): Promise<HTMLElement> {
  await waitFor(() => expect(screen.getByTestId("today-primary-action").getAttribute("data-kind")).toBe(kind));
  return screen.getByTestId("today-primary-action");
}

const dueReminder = {
  stableId: "act:1",
  category: "ACTION_DUE",
  title: "submit proof",
  state: "due_today",
  canonicalDeepLink: "/en/app?tab=today&fieldActionContract=abc",
};

describe("TodayHome — always exactly one primary CTA", () => {
  it("Test 6/7 — empty day with NOTHING available renders exactly ONE CTA: Find a program", async () => {
    stub({ reminders: [], practices: [], programs: [] });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    const cta = await primaryKind("find_program");
    expect(screen.getAllByTestId("today-primary-action").length).toBe(1); // never more than one
    expect(cta.textContent).toContain("Find a program");
  });

  it("Test 3 — an available practice (no active program) renders Start practice", async () => {
    stub({ reminders: [], practices: [{ id: "p1" }], programs: [] });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    const cta = await primaryKind("start_practice");
    expect(cta.textContent).toContain("Start practice");
    expect(cta.textContent).toContain("Practice one real-world decision.");
  });

  it("Test 2 — an active program outranks an available practice (Continue learning)", async () => {
    stub({ reminders: [], practices: [{ id: "p1" }], programs: [{ completion_pct: 40 }] });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    const cta = await primaryKind("continue_program");
    expect(cta.textContent).toContain("Continue learning");
  });

  it("a fully-complete program is NOT 'active' (100% → falls through to practice/find)", async () => {
    stub({ reminders: [], practices: [], programs: [{ completion_pct: 100 }] });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    await primaryKind("find_program");
  });

  it("Test 1 — due work outranks every fallback (reminder CTA with its deep link)", async () => {
    stub({ reminders: [dueReminder], practices: [{ id: "p1" }], programs: [{ completion_pct: 40 }] });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    const cta = await primaryKind("reminder");
    expect(cta.getAttribute("href")).toBe("/en/app?tab=today&fieldActionContract=abc");
    expect(screen.getAllByTestId("today-primary-action").length).toBe(1);
  });

  it("Test 8 — fallback CTAs navigate IN-SHELL (Practice / Learn) via onNavigate", async () => {
    const onNav = vi.fn();
    // Practice fallback → practice tab.
    stub({ reminders: [], practices: [{ id: "p1" }], programs: [] });
    const { unmount } = render(<TodayHome locale="en" onNavigate={onNav} />);
    fireEvent.click(await primaryKind("start_practice"));
    expect(onNav).toHaveBeenCalledWith("practice");
    unmount();
    onNav.mockReset();
    // Find-a-program fallback → learn tab.
    stub({ reminders: [], practices: [], programs: [] });
    render(<TodayHome locale="en" onNavigate={onNav} />);
    fireEvent.click(await primaryKind("find_program"));
    expect(onNav).toHaveBeenCalledWith("learn");
  });

  it("Test 9 — EN/KO copy parity for the empty-day fallbacks", async () => {
    stub({ reminders: [], practices: [{ id: "p1" }], programs: [] });
    const { unmount } = render(<TodayHome locale="ko" onNavigate={() => {}} />);
    const koPractice = await primaryKind("start_practice");
    expect(koPractice.textContent).toContain("연습 시작");
    expect(koPractice.textContent).toContain("현실에서 필요한 판단 하나를 연습하세요.");
    unmount();
    stub({ reminders: [], practices: [], programs: [] });
    render(<TodayHome locale="ko" onNavigate={() => {}} />);
    const koFind = await primaryKind("find_program");
    expect(koFind.textContent).toContain("프로그램 찾기");
  });
});
