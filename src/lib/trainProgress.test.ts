import { describe, it, expect } from "vitest";
import { getUnlockedDayCount, getDayLockState } from "./trainProgress";
import { userDayKey } from "@/domain/daily/userDayKey";
import { TRAIN_START_DATE } from "./train28";

describe("trainProgress — getUnlockedDayCount (canonical 05:00-local basis, D1 STEP 1)", () => {
  it("Day 1 opens on the start date", () => {
    // 06:00Z on the start date is on/after the 05:00 open hour → still start day → Day 1.
    expect(getUnlockedDayCount(new Date(`${TRAIN_START_DATE}T06:00:00Z`), "UTC")).toBe(1);
  });

  it("counts by the 05:00 boundary, not device midnight", () => {
    // 02:00Z the day AFTER start is BEFORE the open hour → still counts as the start day → Day 1.
    const [y, m, d] = TRAIN_START_DATE.split("-").map(Number);
    const nextMidnightEarly = new Date(Date.UTC(y, m - 1, d + 1, 2, 0, 0));
    expect(getUnlockedDayCount(nextMidnightEarly, "UTC")).toBe(1);
    // 06:00Z the day after → past the open hour → Day 2.
    const nextMorning = new Date(Date.UTC(y, m - 1, d + 1, 6, 0, 0));
    expect(getUnlockedDayCount(nextMorning, "UTC")).toBe(2);
  });

  it("timezone shifts the boundary: same instant, different unlocked day across tz", () => {
    const [y, m, d] = TRAIN_START_DATE.split("-").map(Number);
    // 2nd day 20:00Z: in UTC that is day 2 (20:00 ≥ 05:00). In Asia/Seoul it is 05:00 the 3rd
    // local day → day 3. Confirms tz is honored via userDayKey.
    const instant = new Date(Date.UTC(y, m - 1, d + 1, 20, 0, 0));
    expect(getUnlockedDayCount(instant, "UTC")).toBe(2);
    expect(getUnlockedDayCount(instant, "Asia/Seoul")).toBe(3);
  });
});

describe("trainProgress — getDayLockState (canonical basis)", () => {
  const startDateISO = "2026-07-01";

  it("Day 1 unlocks once the calendar allows it", () => {
    const now = new Date("2026-07-01T06:00:00Z"); // start day, after open hour
    const r = getDayLockState({ day: 1, startDateISO, completionsByDay: {}, userTz: "UTC", now });
    expect(r.unlocked).toBe(true);
    expect(r.reason).toBe("today");
  });

  it("Day 2 needs the previous day complete", () => {
    const now = new Date("2026-07-02T06:00:00Z");
    const r = getDayLockState({ day: 2, startDateISO, completionsByDay: {}, userTz: "UTC", now });
    expect(r.unlocked).toBe(false);
    expect(r.reason).toBe("need-prev-complete");
  });

  it("Day 2 waits for the next 05:00 morning after completing Day 1", () => {
    // Day 1 completed on the 2nd calendar day (07-02) → calendar already allows Day 2, but the
    // morning gate holds until 05:00 the day AFTER the completion day (07-03T05:00Z).
    const completionsByDay = { "1": "2026-07-02T21:00:00Z" };
    const early = getDayLockState({
      day: 2,
      startDateISO,
      completionsByDay,
      userTz: "UTC",
      now: new Date("2026-07-02T22:00:00Z"),
    });
    expect(early.unlocked).toBe(false);
    expect(early.reason).toBe("wait-next-morning");
    expect(early.unlockAt).toBe("2026-07-03T05:00:00.000Z");

    // After 05:00 the next morning → ok.
    const ready = getDayLockState({
      day: 2,
      startDateISO,
      completionsByDay,
      userTz: "UTC",
      now: new Date("2026-07-03T06:00:00Z"),
    });
    expect(ready.unlocked).toBe(true);
    expect(ready.reason).toBe("ok");
  });

  it("day-basis matches userDayKey (no device-local drift)", () => {
    const now = new Date("2026-07-05T02:00:00Z"); // before open hour → user-day is 07-04
    expect(userDayKey(now, "UTC", 5)).toBe("2026-07-04");
    // passed = 07-04 − 07-01 = 3 → day ≤ 4 calendar-allowed.
    const r = getDayLockState({ day: 4, startDateISO, completionsByDay: { "3": "2026-07-03T21:00:00Z" }, userTz: "UTC", now });
    expect(r.reason).not.toBe("too-early");
  });
});
