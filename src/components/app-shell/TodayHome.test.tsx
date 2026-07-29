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

function stub(
  over: { reminders?: unknown[]; practices?: unknown[]; programs?: unknown[]; hostAttention?: unknown[]; actionReviews?: unknown[] } = {},
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/me/today/brief")) return json({ ok: true, reminders: over.reminders ?? [], hostAttention: over.hostAttention ?? [] });
      if (u.includes("/api/arena/action-review-queue")) return json({ items: over.actionReviews ?? [] });
      if (u.includes("/api/me/daily-trace")) return json({ dailyTrace: [] });
      if (u.includes("/api/arena/practice")) return json({ practices: over.practices ?? [] });
      if (u.includes("/api/bty/foundry/learning-path")) return json({ ok: true, programs: over.programs ?? [] });
      return json({});
    }),
  );
}

// UUID-ish ids so the shared sanitizer (parseHostDeepLink) accepts the canonical deepLink on click.
const EVENT_ID = "4dc5f309-1111-4222-8333-444444444444";
const OVERDUE_FOCUS = "9ab0c1d2-5555-4666-8777-888888888888";
const NEEDED_FOCUS = "1122aabb-6666-4777-8888-999999999999";
const SHARED_FOCUS = "33445566-7777-4888-8999-aaaaaaaaaaaa";
const overdue = {
  stableId: "FOLLOW_UP_OVERDUE:1",
  category: "FOLLOW_UP_OVERDUE",
  eventId: EVENT_ID,
  focusId: OVERDUE_FOCUS,
  participantDisplayName: "Jordan",
  trainingTitle: "Handling conflict",
  reason: "Follow-up is 2 days overdue",
  sourceTimestamp: "2026-07-27T00:00:00Z",
  deepLink: `/en/app?tab=foundry&event=${EVENT_ID}&section=followups&focus=${OVERDUE_FOCUS}`,
};
const needed = {
  stableId: "FOLLOW_UP_NEEDED:2",
  category: "FOLLOW_UP_NEEDED",
  eventId: EVENT_ID,
  focusId: NEEDED_FOCUS,
  participantDisplayName: "Sam",
  trainingTitle: "Difficult feedback",
  reason: "You flagged this response for follow-up",
  sourceTimestamp: "2026-07-28T00:00:00Z",
  deepLink: `/en/app?tab=foundry&event=${EVENT_ID}&section=shared-understanding&focus=${NEEDED_FOCUS}`,
};
const sharedDue = {
  stableId: "SHARED_REVIEW_DUE:3",
  category: "SHARED_REVIEW_DUE",
  eventId: EVENT_ID,
  focusId: SHARED_FOCUS,
  participantDisplayName: "Alex",
  trainingTitle: "Onboarding",
  reason: "Shared response awaiting first review",
  sourceTimestamp: "2026-07-28T00:00:00Z",
  deepLink: `/en/app?tab=foundry&event=${EVENT_ID}&section=shared-understanding&focus=${SHARED_FOCUS}`,
};

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

describe("TodayHome — Host leadership attention follow-ups (3.2G)", () => {
  it("renders overdue + needed follow-up rows with participant, tag, reason and control-room deep link", async () => {
    stub({ hostAttention: [overdue, needed] });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    const rows = await screen.findAllByTestId("today-followup-row");
    expect(rows).toHaveLength(2);
    const first = rows[0];
    expect(first.getAttribute("data-category")).toBe("FOLLOW_UP_OVERDUE");
    expect(first.textContent).toContain("Jordan");
    expect(first.textContent).toContain("Follow-up overdue");
    expect(first.textContent).toContain("Handling conflict");
    expect(first.textContent).toContain("Follow-up is 2 days overdue");
    // R2: the row is an app-shell command (button), NEVER a raw navigation anchor.
    expect(first.querySelector("a")).toBeNull();
    expect(first.querySelector("button[data-testid='today-followup-open']")).toBeTruthy();
  });

  it("(3.2G-R2) the follow-up row is a button, NOT a raw document-navigation anchor", async () => {
    stub({ hostAttention: [overdue] });
    render(<TodayHome locale="en" onNavigate={() => {}} onOpenLeadershipFollowUp={() => {}} />);
    const row = (await screen.findAllByTestId("today-followup-row"))[0];
    expect(row.querySelector("a")).toBeNull(); // no anchor at all
    const btn = row.querySelector("button[data-testid='today-followup-open']") as HTMLButtonElement | null;
    expect(btn).toBeTruthy();
    expect(btn!.getAttribute("type")).toBe("button");
    expect(btn!.getAttribute("href")).toBeNull();
  });

  it("(3.2G-R2) first activation calls the in-shell callback exactly once with the canonical structured target", async () => {
    const onOpen = vi.fn();
    const assign = vi.fn();
    // Fail loudly if any code path tries a hard navigation.
    const origLocation = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...origLocation, assign, href: origLocation.href } });
    try {
      stub({ hostAttention: [overdue] });
      render(<TodayHome locale="en" onNavigate={() => {}} onOpenLeadershipFollowUp={onOpen} />);
      const btn = await screen.findByTestId("today-followup-open");
      fireEvent.click(btn);
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onOpen).toHaveBeenCalledWith({ eventId: EVENT_ID, section: "followups", focusId: OVERDUE_FOCUS });
      expect(assign).not.toHaveBeenCalled(); // no window.location navigation
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: origLocation });
    }
  });

  it("(3.2G-R2) a FOLLOW_UP_NEEDED row carries its canonical shared-understanding section, not a guessed one", async () => {
    const onOpen = vi.fn();
    stub({ hostAttention: [needed] });
    render(<TodayHome locale="en" onNavigate={() => {}} onOpenLeadershipFollowUp={onOpen} />);
    fireEvent.click(await screen.findByTestId("today-followup-open"));
    expect(onOpen).toHaveBeenCalledWith({ eventId: EVENT_ID, section: "shared-understanding", focusId: NEEDED_FOCUS });
  });

  it("preserves the server (domain-priority) order — overdue before needed — without re-ranking", async () => {
    // Server ships them already sorted; the UI must render in array order (filter preserves it).
    stub({ hostAttention: [overdue, needed] });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    const rows = await screen.findAllByTestId("today-followup-row");
    expect(rows.map((r) => r.getAttribute("data-category"))).toEqual(["FOLLOW_UP_OVERDUE", "FOLLOW_UP_NEEDED"]);
  });

  it("no follow-up items → no follow-up list rendered (no empty shell)", async () => {
    stub({ hostAttention: [] });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    await screen.findByTestId("today-home");
    expect(screen.queryByTestId("today-followups")).toBeNull();
    expect(screen.queryByTestId("today-host-attention")).toBeNull();
  });

  it("SHARED_REVIEW_DUE stays a count in the reviews row and is NOT a follow-up row (no double-count)", async () => {
    stub({ hostAttention: [sharedDue] });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    await screen.findByTestId("today-attention");
    expect(screen.queryByTestId("today-followup-row")).toBeNull();
    expect(screen.getByTestId("attention-reviews").textContent).toContain("1 action plan awaiting your review");
  });

  it("reviews row still navigates IN-SHELL to Practice", async () => {
    const onNav = vi.fn();
    stub({ hostAttention: [overdue], actionReviews: [{ actionContractId: "c1" }] });
    render(<TodayHome locale="en" onNavigate={onNav} />);
    fireEvent.click(await screen.findByTestId("today-attention"));
    expect(onNav).toHaveBeenCalledWith("practice");
  });

  it("collapses to a preview of 3 with a Show more toggle", async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ ...overdue, stableId: `FOLLOW_UP_OVERDUE:${i}`, focusId: `f${i}`, deepLink: `/en/app?tab=foundry&event=e1&section=followups&focus=f${i}` }));
    stub({ hostAttention: many });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    expect((await screen.findAllByTestId("today-followup-row")).length).toBe(3);
    fireEvent.click(screen.getByTestId("today-followups-toggle"));
    expect(screen.getAllByTestId("today-followup-row").length).toBe(5);
  });

  it("KO copy parity for the follow-up tags + subtitle", async () => {
    stub({ hostAttention: [overdue] });
    render(<TodayHome locale="ko" onNavigate={() => {}} />);
    const section = await screen.findByTestId("today-host-attention");
    expect(section.textContent).toContain("후속 확인 지연");
    expect(section.textContent).toContain("오늘 관심을 기울여야 할 사람");
  });
});
