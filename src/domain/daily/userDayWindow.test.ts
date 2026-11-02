import { describe, expect, it } from "vitest";
import { userDayWindow } from "./userDayWindow";
import { userDayStartInstant } from "./userDayStartInstant";
import { userDayKey } from "./userDayKey";

describe("canonical user-day window", () => {
  it("reproduces the former empty fall-back window without treating it as a valid day", () => {
    const start = userDayStartInstant(new Date("2026-10-31T20:00:00Z"), "America/Los_Angeles", 5);
    const formerEnd = userDayStartInstant(new Date(start.getTime() + 86400000 + 1), "America/Los_Angeles", 5);
    expect(formerEnd.toISOString()).toBe(start.toISOString());
    expect(userDayWindow(new Date("2026-10-31T20:00:00Z"), "America/Los_Angeles").end.toISOString()).toBe("2026-11-01T13:00:00.000Z");
  });
  it.each([
    ["2026-10-31T20:00:00Z", "America/Los_Angeles", "2026-10-31T12:00:00.000Z", "2026-11-01T13:00:00.000Z", 25],
    ["2026-03-07T20:00:00Z", "America/Los_Angeles", "2026-03-07T13:00:00.000Z", "2026-03-08T12:00:00.000Z", 23],
    ["2026-11-01T12:59:59Z", "America/Los_Angeles", "2026-10-31T12:00:00.000Z", "2026-11-01T13:00:00.000Z", 25],
    ["2026-11-01T13:00:00Z", "America/Los_Angeles", "2026-11-01T13:00:00.000Z", "2026-11-02T13:00:00.000Z", 24],
    ["2026-10-31T20:00:00Z", "UTC", "2026-10-31T05:00:00.000Z", "2026-11-01T05:00:00.000Z", 24],
    ["2026-12-31T20:00:00Z", "Asia/Seoul", "2026-12-31T20:00:00.000Z", "2027-01-01T20:00:00.000Z", 24],
  ])("preserves calendar boundaries: %s in %s", (instant, timezone, start, end, hours) => {
    const window = userDayWindow(new Date(instant as string), timezone as string);
    expect(window.start.toISOString()).toBe(start); expect(window.end.toISOString()).toBe(end);
    expect((window.end.getTime() - window.start.getTime()) / 3600000).toBe(hours);
    expect(window.start.getTime()).toBeLessThanOrEqual(Date.parse(instant as string));
    expect(window.end.getTime()).toBeGreaterThan(Date.parse(instant as string));
  });
  it.each(["America/Los_Angeles", "Australia/Lord_Howe", "Europe/Berlin", "Asia/Kathmandu", "Pacific/Auckland"])(
    "keeps both exact endpoints on different canonical day keys in %s", timezone => {
      for (const instant of ["2026-03-07T20:00:00Z", "2026-04-04T20:00:00Z", "2026-10-03T20:00:00Z", "2026-10-31T20:00:00Z"]) {
        const window = userDayWindow(new Date(instant), timezone);
        expect(userDayKey(window.start, timezone, 5)).toBe(userDayKey(new Date(instant), timezone, 5));
        expect(userDayKey(window.end, timezone, 5)).not.toBe(userDayKey(window.start, timezone, 5));
        expect(userDayKey(new Date(window.end.getTime() - 1), timezone, 5)).toBe(userDayKey(window.start, timezone, 5));
      }
    },
  );
});
