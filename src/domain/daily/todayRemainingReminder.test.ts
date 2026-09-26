import { describe, expect, it } from "vitest";
import {
  TODAY_REMAINING_REMINDER_ID,
  buildRemainingReminderNotification,
  nextRemainingReminderAt,
  reminderLocale,
  todayRemainingReminderRoute,
} from "@/domain/daily/todayRemainingReminder";
import { selectTodayOpenWork } from "@/domain/daily/todayOpenWork";

const local = (y: number, m: number, d: number, h: number, min = 0, s = 0, ms = 0) =>
  new Date(y, m - 1, d, h, min, s, ms);

describe("nextRemainingReminderAt — the next 08:00, device-local", () => {
  it("before 08:00 → today 08:00", () => {
    expect(nextRemainingReminderAt(local(2026, 9, 26, 7, 59, 59, 999))).toEqual(local(2026, 9, 26, 8));
    expect(nextRemainingReminderAt(local(2026, 9, 26, 0, 0))).toEqual(local(2026, 9, 26, 8));
  });

  it("exactly 08:00:00.000 is no longer ahead → tomorrow 08:00", () => {
    expect(nextRemainingReminderAt(local(2026, 9, 26, 8))).toEqual(local(2026, 9, 27, 8));
  });

  it("after 08:00 → tomorrow 08:00, across a month and a year end", () => {
    expect(nextRemainingReminderAt(local(2026, 9, 26, 8, 0, 0, 1))).toEqual(local(2026, 9, 27, 8));
    expect(nextRemainingReminderAt(local(2026, 9, 30, 23, 30))).toEqual(local(2026, 10, 1, 8));
    expect(nextRemainingReminderAt(local(2026, 12, 31, 12))).toEqual(local(2027, 1, 1, 8));
  });

  it("always lands on 08:00 wall-clock", () => {
    for (const h of [0, 5, 7, 8, 9, 12, 17, 23]) {
      const at = nextRemainingReminderAt(local(2026, 3, 8, h, 15));
      expect([at.getHours(), at.getMinutes(), at.getSeconds()]).toEqual([8, 0, 0]);
    }
  });
});

describe("the payload is content-free and locale-true", () => {
  it("EN / KO copy, fixed id, title BTY", () => {
    const en = buildRemainingReminderNotification("en", local(2026, 9, 26, 9));
    const ko = buildRemainingReminderNotification("ko", local(2026, 9, 26, 9));
    expect(en).toMatchObject({ id: TODAY_REMAINING_REMINDER_ID, title: "BTY", body: "You still have something waiting in Today." });
    expect(ko).toMatchObject({ id: TODAY_REMAINING_REMINDER_ID, title: "BTY", body: "Today에 아직 남아 있는 항목이 있습니다." });
    expect(en.schedule.at).toEqual(local(2026, 9, 27, 8));
  });

  it("carries nothing but the fixed sentence and the locale — no item, name or count", () => {
    const n = buildRemainingReminderNotification("en", local(2026, 9, 26, 9));
    expect(Object.keys(n).sort()).toEqual(["body", "extra", "id", "schedule", "title"]);
    expect(n.extra).toEqual({ kind: "today_remaining", locale: "en" });
    expect(Object.keys(n.schedule)).toEqual(["at"]);
  });

  it("route is canonical Today with the two markers, locale preserved; unknown locale → en", () => {
    expect(todayRemainingReminderRoute("ko")).toBe("/ko/app?tab=today&src=notification&focus=remaining");
    expect(todayRemainingReminderRoute("en")).toBe("/en/app?tab=today&src=notification&focus=remaining");
    expect(reminderLocale("ko")).toBe("ko");
    expect(reminderLocale("fr")).toBe("en");
    expect(reminderLocale(undefined)).toBe("en");
  });
});

describe("selectTodayOpenWork — the predicate Today renders from", () => {
  const r = (stableId: string, category = "REQUIRED_LEARNING") => ({
    stableId,
    category,
    state: "incomplete_required",
    title: `t-${stableId}`,
    canonicalDeepLink: "/en/app?tab=learn",
    note: "Source training",
  });

  it("empty brief → 0", () => {
    expect(selectTodayOpenWork([], []).openCount).toBe(0);
  });

  it("dedups reminders by stableId, counts follow-ups and shared reviews, ignores other hostAttention", () => {
    const w = selectTodayOpenWork(
      [r("a"), r("a"), r("b", "APPLY_DUE")],
      [
        { category: "FOLLOW_UP_OVERDUE", stableId: "f1" },
        { category: "FOLLOW_UP_NEEDED", stableId: "f2" },
        { category: "SHARED_REVIEW_DUE", stableId: "s1" },
        { category: "SOMETHING_NEW", stableId: "x" },
      ],
    );
    expect(w.items.map((i) => i.stableId)).toEqual(["a", "b"]);
    expect(w.items[1].context).toBe("Source training");
    expect(w.items[0].context).toBeNull();
    expect(w.followUps.map((f) => f.stableId)).toEqual(["f1", "f2"]);
    expect(w.sharedReviewsDue).toBe(1);
    expect(w.openCount).toBe(5);
  });

  it("host attention alone is enough to be open", () => {
    expect(selectTodayOpenWork([], [{ category: "FOLLOW_UP_NEEDED" }]).openCount).toBe(1);
  });
});
