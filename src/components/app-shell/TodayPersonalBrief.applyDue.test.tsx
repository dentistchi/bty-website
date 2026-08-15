/** @vitest-environment jsdom */
/**
 * SLICE 3.2R-R2 — how "Apply this week" reads on the learner's Today.
 *
 * The UX gate for this slice is that the card is a bridge back to reality, not another to-do.
 * Four parts of that are testable and are tested here: the learner's own sentence is the title,
 * a closed window never renders as a red failure, there is no completion control of any kind,
 * and EN/KO both say the same thing.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import TodayPersonalBrief from "./TodayPersonalBrief";

const DECISION = "Next time I will say the owner's name out loud before we break.";

function reminder(over: Record<string, unknown> = {}) {
  return {
    stableId: "apply:w-1",
    category: "APPLY_DUE",
    title: DECISION,
    state: "active",
    canonicalDeepLink: "/en/app?tab=me&view=my-learning&entry=prog-1",
    note: "Huddle ownership",
    ...over,
  };
}

function stub(reminders: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      const body = u.includes("/api/me/today/brief")
        ? { ok: true, reminders, brief: null, hostAttention: [], actionStatus: [], hostActionReviews: [] }
        : { ok: true };
      return { ok: true, status: 200, json: async () => body } as Response;
    }),
  );
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => vi.restoreAllMocks());

describe("Today — Apply this week", () => {
  it("shows the learner's OWN sentence as the item, under an 'Apply this week' eyebrow", async () => {
    stub([reminder()]);
    render(<TodayPersonalBrief locale="en" />);
    const row = await screen.findByTestId("brief-reminder");
    expect(row.getAttribute("data-category")).toBe("APPLY_DUE");
    expect(row.textContent).toContain(DECISION);
    expect(row.textContent).toContain("Apply this week");
  });

  it("names the training it came from, quietly", async () => {
    stub([reminder()]);
    render(<TodayPersonalBrief locale="en" />);
    expect((await screen.findByTestId("brief-apply-source")).textContent).toBe("Huddle ownership");
  });

  it("an OPEN window reads 'This week', not 'Upcoming'", async () => {
    stub([reminder({ state: "active" })]);
    render(<TodayPersonalBrief locale="en" />);
    const row = await screen.findByTestId("brief-reminder");
    expect(row.textContent).toContain("This week");
    expect(row.textContent).not.toMatch(/upcoming/i);
  });

  it("the LAST day reads 'Last day', not 'Due today'", async () => {
    stub([reminder({ state: "due_today" })]);
    render(<TodayPersonalBrief locale="en" />);
    expect((await screen.findByTestId("brief-reminder")).textContent).toContain("Last day");
  });

  it("a CLOSED window is never red and never says 'Overdue'", async () => {
    /*
      Today does not project closed windows, so this state should not arrive — but if it ever did,
      rendering the learner's own commitment as a red compliance breach is the failure mode this
      whole surface is built to avoid. Defence in depth.
    */
    stub([reminder({ state: "overdue" })]);
    render(<TodayPersonalBrief locale="en" />);
    const row = await screen.findByTestId("brief-reminder");
    expect(row.textContent).toContain("Window closed");
    expect(row.textContent).not.toMatch(/overdue/i);
    expect(row.innerHTML).not.toMatch(/text-red|border-red/);
  });

  it("there is NO completion control — no checkbox, no button, no 'Done'", async () => {
    stub([reminder()]);
    render(<TodayPersonalBrief locale="en" />);
    const row = await screen.findByTestId("brief-reminder");
    expect(within(row).queryByRole("checkbox")).toBeNull();
    expect(within(row).queryByRole("button")).toBeNull();
    expect(row.textContent).not.toMatch(/done|complete|mark|finish|✓/i);
  });

  it("carries no score, XP, percentage or compliance language", async () => {
    stub([reminder()]);
    render(<TodayPersonalBrief locale="en" />);
    const row = await screen.findByTestId("brief-reminder");
    expect(row.textContent).not.toMatch(/\bXP\b|score|points|%|\d\s*\/\s*\d|required|must|failed|missed/i);
  });

  it("opens the learner's own record, never Arena", async () => {
    stub([reminder()]);
    render(<TodayPersonalBrief locale="en" />);
    const link = (await screen.findByTestId("brief-reminder")).querySelector("a")!;
    expect(link.getAttribute("href")).toContain("tab=me");
    expect(link.getAttribute("href")).not.toContain("arena");
  });

  it("KO says the same thing", async () => {
    stub([reminder({ state: "active" })]);
    render(<TodayPersonalBrief locale="ko" />);
    const row = await screen.findByTestId("brief-reminder");
    expect(row.textContent).toContain("이번 주에 적용하기");
    expect(row.textContent).toContain("이번 주");
    expect(row.textContent).toContain(DECISION);
  });

  it("KO — a closed window is calm there too", async () => {
    stub([reminder({ state: "overdue" })]);
    render(<TodayPersonalBrief locale="ko" />);
    const row = await screen.findByTestId("brief-reminder");
    expect(row.textContent).toContain("적용 기간 종료");
    expect(row.textContent).not.toContain("기한 지남");
  });

  it("an unrelated category is completely unaffected by the new rendering", async () => {
    stub([
      { stableId: "action:1", category: "ACTION_DUE", title: "Ship the thing", state: "overdue", canonicalDeepLink: "/x" },
    ]);
    render(<TodayPersonalBrief locale="en" />);
    const row = await screen.findByTestId("brief-reminder");
    expect(row.textContent).toContain("Overdue"); // the generic chip is untouched
    expect(row.innerHTML).toMatch(/text-red/);
  });
});
