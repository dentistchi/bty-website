import { describe, it, expect } from "vitest";
import { userDayKey } from "./userDayKey";
import { userDayStartInstant, dayKeyToStartInstant } from "./userDayStartInstant";

describe("userDayStartInstant (D1 — UTC instant of the 05:00-local user-day start)", () => {
  it("UTC: start is 05:00Z of the current user-day", () => {
    expect(userDayStartInstant(new Date("2026-07-02T09:00:00Z"), "UTC", 5).toISOString()).toBe(
      "2026-07-02T05:00:00.000Z",
    );
    // 02:00Z is before the 05:00 open hour → belongs to the previous user-day.
    expect(userDayStartInstant(new Date("2026-07-04T02:00:00Z"), "UTC", 5).toISOString()).toBe(
      "2026-07-03T05:00:00.000Z",
    );
  });

  it("Asia/Seoul: 05:00 KST maps to 20:00Z the previous UTC date", () => {
    // 2026-07-04T10:00Z == 19:00 KST → user-day 07-04, which started 05:00 KST = 07-03T20:00Z.
    expect(
      userDayStartInstant(new Date("2026-07-04T10:00:00Z"), "Asia/Seoul", 5).toISOString(),
    ).toBe("2026-07-03T20:00:00.000Z");
  });

  it("America/Los_Angeles spring-forward day: 05:00 PDT = 12:00Z (two-pass DST correction)", () => {
    // 2026-03-08 is the US spring-forward day (02:00→03:00). 05:00 local is already PDT (UTC-7),
    // so the user-day start is 12:00Z — NOT 13:00Z that a naive single-pass offset would give.
    expect(
      dayKeyToStartInstant("2026-03-08", "America/Los_Angeles", 5).toISOString(),
    ).toBe("2026-03-08T12:00:00.000Z");
  });

  it("fixed-point: userDayKey(userDayStartInstant(t)) === userDayKey(t)", () => {
    const cases: Array<[string, string]> = [
      ["2026-07-04T10:00:00Z", "Asia/Seoul"],
      ["2026-07-04T02:00:00Z", "UTC"],
      ["2026-03-08T12:30:00Z", "America/Los_Angeles"],
      ["2026-01-15T11:30:00Z", "America/Los_Angeles"],
    ];
    for (const [iso, tz] of cases) {
      const t = new Date(iso);
      expect(userDayKey(userDayStartInstant(t, tz, 5), tz, 5)).toBe(userDayKey(t, tz, 5));
    }
  });
});
