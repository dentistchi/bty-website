import { describe, it, expect } from "vitest";
import { userDayKey } from "./userDayKey";

describe("userDayKey (D1 FINAL LOCK — 05:00 user-local, DST-safe IANA)", () => {
  it("rolls the day at 05:00 local, not midnight", () => {
    // 2026-07-03T19:59Z == 04:59 KST (UTC+9) → before 05:00 → previous local day.
    expect(userDayKey(new Date("2026-07-03T19:59:00Z"), "Asia/Seoul", 5)).toBe("2026-07-03");
    // 2026-07-03T20:01Z == 05:01 KST → on/after 05:00 → new local day.
    expect(userDayKey(new Date("2026-07-03T20:01:00Z"), "Asia/Seoul", 5)).toBe("2026-07-04");
  });

  it("UTC fallback basis (documented device-tz-unavailable path)", () => {
    expect(userDayKey(new Date("2026-07-04T04:00:00Z"), "UTC", 5)).toBe("2026-07-03"); // 04:00 UTC < 05
    expect(userDayKey(new Date("2026-07-04T06:00:00Z"), "UTC", 5)).toBe("2026-07-04"); // 06:00 UTC >= 05
  });

  it("same instant yields different day keys across timezones", () => {
    const t = new Date("2026-07-04T10:00:00Z");
    expect(userDayKey(t, "Asia/Seoul", 5)).toBe("2026-07-04"); // 19:00 KST
    expect(userDayKey(t, "America/Los_Angeles", 5)).toBe("2026-07-03"); // 03:00 PDT (UTC-7) < 05 → prev
  });

  it("crosses month/year boundaries correctly on the pre-open-hour rollback", () => {
    // 2027-01-01T02:00 KST → before 05:00 → 2026-12-31.
    expect(userDayKey(new Date("2026-12-31T17:00:00Z"), "Asia/Seoul", 5)).toBe("2026-12-31");
  });

  it("is DST-safe (LA offset differs by season, boundary still 05:00 local)", () => {
    // Winter PST (UTC-8): 2026-01-15T12:30Z == 04:30 PST → before 05:00 → 2026-01-14.
    expect(userDayKey(new Date("2026-01-15T12:30:00Z"), "America/Los_Angeles", 5)).toBe("2026-01-14");
    // Summer PDT (UTC-7): 2026-07-15T11:30Z == 04:30 PDT → before 05:00 → 2026-07-14.
    expect(userDayKey(new Date("2026-07-15T11:30:00Z"), "America/Los_Angeles", 5)).toBe("2026-07-14");
  });
});
