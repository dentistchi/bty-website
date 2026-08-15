/** @vitest-environment jsdom */
/**
 * SLICE 3.2R-R2.6 — the Apply card on the surface the learner actually sees.
 *
 * MEASURED after the first live R2 completion: Today showed APPLY THIS WEEK and the learner's own
 * decision sentence, and nothing else — no training title, no timing chip.
 *
 * The server had been sending both all along (`note` = source training title, `state` = the
 * classified window). R2's UI tests were written against `TodayPersonalBrief`, which renders both
 * correctly and **is not mounted anywhere** — `BtyDailyAppShell` renders `TodayHome`. So eleven
 * green tests described a surface no learner can reach, while the mounted one narrowed `note` away
 * in its `normalizeTodayItems` map and rendered eyebrow + title only.
 *
 * These tests are pinned to the MOUNTED component for that reason.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import TodayHome from "./TodayHome";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

/** Records every non-GET request, so "opening Today writes nothing" is a measurement. */
const writes: string[] = [];

function stub(reminders: unknown[]) {
  writes.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = (init?.method ?? "GET").toUpperCase();
      if (method !== "GET") writes.push(`${method} ${u}`);
      if (u.includes("/api/me/today/brief")) return json({ ok: true, reminders, hostAttention: [] });
      if (u.includes("/api/arena/action-review-queue")) return json({ items: [] });
      if (u.includes("/api/me/daily-trace")) return json({ dailyTrace: [] });
      if (u.includes("/api/arena/practice")) return json({ practices: [] });
      if (u.includes("/api/bty/foundry/learning-path")) return json({ ok: true, programs: [] });
      return json({});
    }),
  );
}

const PROGRESS_A = "95c4adf6-54fd-4b7b-9473-f6ba13b49733";
const PROGRESS_B = "7c2a1b40-2222-4333-8444-555555555555";

/** The Founder's live row, verbatim: window `6435c742` on progress `95c4adf6`. */
const DECISION_A =
  "At my next huddle, I will name one owner and one deadline for every open action item before we end.";
const TITLE_A = "Establishing Action Ownership in Huddles";

const DECISION_B = "When a shift handover starts, I will read the open items back out loud.";
const TITLE_B = "Closing the Handover Gap";

const applyItem = (over: Record<string, unknown> = {}) => ({
  stableId: "apply:6435c742-73eb-4579-9a1d-58bfb64b22d4",
  category: "APPLY_DUE",
  title: DECISION_A,
  state: "active",
  sourceTimestamp: "2026-08-22T05:00:00-07:00",
  roleContext: "learner",
  canonicalDeepLink: `/en/app?tab=me&view=my-learning&entry=${PROGRESS_A}`,
  note: TITLE_A,
  ...over,
});

const card = async () => {
  const items = await screen.findAllByTestId("today-item");
  return items.find((n) => n.getAttribute("data-category") === "APPLY_DUE")!;
};

describe("the Apply card carries its provenance and its timing", () => {
  it("renders exactly three lines: eyebrow → decision → training title", async () => {
    stub([applyItem()]);
    render(<TodayHome locale="en" />);
    const c = await card();
    const text = c.textContent ?? "";
    // Order is the product contract: the learner's own sentence stays primary.
    expect(text.indexOf("Apply this week")).toBeLessThan(text.indexOf(DECISION_A));
    expect(text.indexOf(DECISION_A)).toBeLessThan(text.indexOf(TITLE_A));
    expect(within(c).getByTestId("today-item-context").textContent).toBe(TITLE_A);
    // R2.6-R1: and NOTHING after it while the window is open.
    expect(within(c).queryByTestId("today-item-timing")).toBeNull();
  });

  it("an open window carries NO timing chip — the eyebrow already says it", async () => {
    /*
      Founder decision after seeing the first live card: "This week" under APPLY THIS WEEK repeats
      itself, and a status pill on a commitment is what makes Today read like a task manager.
    */
    for (const locale of ["en", "ko"]) {
      cleanup();
      stub([applyItem({ state: "active" })]);
      render(<TodayHome locale={locale} />);
      const c = await card();
      expect(within(c).queryByTestId("today-item-timing"), locale).toBeNull();
      // The words must not reappear anywhere else on the card either.
      expect((c.textContent ?? "").match(locale === "ko" ? /이번 주/g : /[Tt]his week/g), locale).toHaveLength(1);
    }
  });

  it("the decision sentence is rendered EXACTLY, never truncated or reworded", async () => {
    stub([applyItem()]);
    render(<TodayHome locale="en" />);
    expect(await screen.findByText(DECISION_A)).toBeTruthy();
  });

  it("Korean renders the Korean eyebrow and the Korean Last-day chip", async () => {
    stub([applyItem({ state: "due_today" })]);
    render(<TodayHome locale="ko" />);
    const c = await card();
    expect(c.textContent).toContain("이번 주에 적용하기");
    expect(within(c).getByTestId("today-item-timing").textContent).toBe("마지막 날");
  });

  it("a window with no title snapshot renders no context line, and still no chip", async () => {
    stub([applyItem({ note: null })]);
    render(<TodayHome locale="en" />);
    const c = await card();
    expect(within(c).queryByTestId("today-item-context")).toBeNull();
    expect(within(c).queryByTestId("today-item-timing")).toBeNull();
  });
});

describe("PART 4 — two apply items stay distinguishable", () => {
  const two = [
    applyItem(),
    applyItem({
      stableId: "apply:b1b1b1b1-3333-4444-8555-666666666666",
      title: DECISION_B,
      note: TITLE_B,
      canonicalDeepLink: `/en/app?tab=me&view=my-learning&entry=${PROGRESS_B}`,
    }),
  ];

  it("each decision shows ITS OWN training title", async () => {
    stub(two);
    render(<TodayHome locale="en" />);
    await screen.findByText(DECISION_A);
    const cards = screen.getAllByTestId("today-item").filter((n) => n.getAttribute("data-category") === "APPLY_DUE");
    expect(cards).toHaveLength(2);
    const a = cards.find((n) => (n.textContent ?? "").includes(DECISION_A))!;
    const b = cards.find((n) => (n.textContent ?? "").includes(DECISION_B))!;
    expect(within(a).getByTestId("today-item-context").textContent).toBe(TITLE_A);
    expect(within(b).getByTestId("today-item-context").textContent).toBe(TITLE_B);
    // Provenance must not depend on the sentences differing — the titles carry it.
    expect(within(a).getByTestId("today-item-context").textContent).not.toBe(
      within(b).getByTestId("today-item-context").textContent,
    );
  });

  it("each card deep-links to its OWN learning record", async () => {
    stub(two);
    render(<TodayHome locale="en" />);
    await screen.findByText(DECISION_B);
    const cards = screen.getAllByTestId("today-item").filter((n) => n.getAttribute("data-category") === "APPLY_DUE");
    const hrefs = cards.map((n) => n.getAttribute("href") ?? "");
    expect(hrefs.some((h) => h.includes(PROGRESS_A))).toBe(true);
    expect(hrefs.some((h) => h.includes(PROGRESS_B))).toBe(true);
    expect(new Set(hrefs).size).toBe(2);
  });

  it("two identical sentences from different trainings are still two distinct cards", async () => {
    /* Dedup is by stableId, never by title text — the same commitment can come from two trainings. */
    stub([applyItem(), applyItem({ stableId: "apply:cccccccc-4444-4555-8666-777777777777", note: TITLE_B })]);
    render(<TodayHome locale="en" />);
    await screen.findAllByText(DECISION_A);
    const cards = screen.getAllByTestId("today-item").filter((n) => n.getAttribute("data-category") === "APPLY_DUE");
    expect(cards).toHaveLength(2);
    expect(cards.map((n) => within(n).getByTestId("today-item-context").textContent).sort()).toEqual(
      [TITLE_A, TITLE_B].sort(),
    );
  });
});

describe("PART 5 — timing copy", () => {
  it("an open window shows no timing at all, on every day of it", async () => {
    stub([applyItem({ state: "active" })]);
    render(<TodayHome locale="en" />);
    expect(within(await card()).queryByTestId("today-item-timing")).toBeNull();
  });

  it("Last day exists ONLY for due_today — the no-follow-up case, unchanged", async () => {
    /*
      With a 7-day follow-up, day 7 is the day the follow-up becomes due and the server suppresses
      the Apply item entirely, so this label is unreachable there. It stays for followUpDays = 0
      and for longer follow-ups, where it says something the eyebrow does not.
    */
    stub([applyItem({ state: "due_today" })]);
    render(<TodayHome locale="en" />);
    expect(within(await card()).getByTestId("today-item-timing").textContent).toBe("Last day");
  });

  it("a chip, when it appears, is never the red overdue tone", async () => {
    for (const state of ["due_today", "overdue"]) {
      cleanup();
      stub([applyItem({ state })]);
      render(<TodayHome locale="en" />);
      const chip = within(await card()).getByTestId("today-item-timing");
      expect(chip.className, state).not.toMatch(/red/);
      expect(chip.textContent, state).not.toMatch(/overdue/i);
    }
  });
});

describe("PART 3D — day 7 with a 7-day follow-up", () => {
  /*
    The server owns this: `applyDue()` drops the window once its follow-up is due today or overdue,
    and the FOLLOW_UP_DUE item takes its place. Pinned end-to-end in `todayApplyDue.test.ts`; this
    asserts the shell renders that handoff without inventing an Apply card of its own.
  */
  const followUp = {
    stableId: "followup:c034bbf0",
    category: "FOLLOW_UP_DUE",
    title: "What actually happened after Establishing Action Ownership in Huddles?",
    state: "due_today",
    sourceTimestamp: "2026-08-22T05:00:00-07:00",
    roleContext: "learner",
    canonicalDeepLink: `/en/app?tab=me&view=my-learning&entry=${PROGRESS_A}`,
  };

  it("the Apply card is gone and the follow-up is shown — with no 'Last day' anywhere", async () => {
    stub([followUp]);
    render(<TodayHome locale="en" />);
    const items = await screen.findAllByTestId("today-item");
    expect(items.some((n) => n.getAttribute("data-category") === "APPLY_DUE")).toBe(false);
    expect(items.some((n) => n.getAttribute("data-category") === "FOLLOW_UP_DUE")).toBe(true);
    expect(document.body.textContent).not.toContain("Last day");
    expect(screen.queryByTestId("today-item-timing")).toBeNull();
  });
});

describe("PART 3 — the card is not a task manager", () => {
  it("no checkbox, no Done, no XP, no percent, no streak, no Applied, no red", async () => {
    stub([applyItem()]);
    render(<TodayHome locale="en" />);
    const c = await card();
    expect(c.querySelector("input[type=checkbox]")).toBeNull();
    expect(c.querySelector("button")).toBeNull();
    expect(c.textContent ?? "").not.toMatch(/\bDone\b|\bComplete\b|\bXP\b|%|streak|Applied|Overdue/i);
    expect(c.className).not.toMatch(/red/);
  });

  it("the card is a link to the learner's own record — following it establishes nothing", async () => {
    stub([applyItem()]);
    render(<TodayHome locale="en" />);
    const c = await card();
    expect(c.tagName).toBe("A");
    expect(c.getAttribute("href")).toContain("view=my-learning");
    expect(c.getAttribute("href")).not.toContain("bty-arena");
  });

  it("rendering Today issues NO write of any kind", async () => {
    stub([applyItem()]);
    render(<TodayHome locale="en" />);
    await card();
    await waitFor(() => expect(writes).toEqual([]));
  });
});

describe("PART 3G — private reflection cannot reach the card", () => {
  it("the shell renders ONLY the mapped fields, so stray payload text never appears", async () => {
    /*
      The server guarantee is the real one — `applyDue()` names `decision_response_text` and no
      other column, pinned over the serialized payload in `todayApplyDue.test.ts`. This is the
      second line: even handed private text, the card has nowhere to put it.
    */
    const PRIVATE = "I was too nervous to speak up and I felt like a fraud.";
    stub([
      applyItem({
        response_text: PRIVATE,
        learner_reflection_text: PRIVATE,
        reflection: PRIVATE,
      }),
    ]);
    render(<TodayHome locale="en" />);
    await card();
    expect(document.body.textContent).not.toContain(PRIVATE);
    expect(document.body.textContent).not.toContain("fraud");
  });
});

describe("PART 6K — other Today categories are untouched", () => {
  const other = {
    stableId: "REQUIRED_LEARNING:xyz",
    category: "REQUIRED_LEARNING",
    title: "Finish your assigned training",
    state: "incomplete_required",
    sourceTimestamp: null,
    roleContext: "learner",
    canonicalDeepLink: "/en/app?tab=learn",
    note: "should never render here",
  };

  it("a non-apply item gets no timing chip and no context line", async () => {
    stub([other]);
    render(<TodayHome locale="en" />);
    const items = await screen.findAllByTestId("today-item");
    const c = items.find((n) => n.getAttribute("data-category") === "REQUIRED_LEARNING")!;
    expect(within(c).queryByTestId("today-item-timing")).toBeNull();
    expect(within(c).queryByTestId("today-item-context")).toBeNull();
    expect(c.textContent).not.toContain("should never render here");
  });

  it("apply and non-apply coexist, each rendering its own way", async () => {
    stub([other, applyItem()]);
    render(<TodayHome locale="en" />);
    await screen.findByText(DECISION_A);
    expect(screen.getAllByTestId("today-item")).toHaveLength(2);
    expect(screen.getAllByTestId("today-item-context")).toHaveLength(1);
    expect(screen.queryAllByTestId("today-item-timing")).toHaveLength(0);
  });
});
