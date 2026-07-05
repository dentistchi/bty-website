/**
 * userDayStartInstant — the UTC instant at which the user-day containing `instant` began.
 *
 * Companion to {@link userDayKey} (D1 FINAL LOCK). The user-day rolls at `openHour` (05:00)
 * user-local, DST-safe IANA tz. This returns the exact UTC instant of that 05:00-local
 * boundary for the user-day `instant` falls in — the instant form of userDayKey, for building
 * time-window bounds against stored UTC timestamps.
 *
 * Pure domain function — no `Date.now()`, no I/O. `Intl` (ECMA-402) is a pure built-in; it
 * yields the DST-correct wall-clock offset for `userTz` at the boundary instant. openHour=5 is
 * unambiguous in practically every zone/date (DST flips at 02:00/03:00), so no gap/overlap.
 *
 * Fixed-point property: `userDayKey(userDayStartInstant(t, tz), tz) === userDayKey(t, tz)`.
 *
 * @param instant  a UTC instant.
 * @param userTz   a valid IANA tz id (invalid ids make `Intl` throw — validate upstream).
 * @param openHour local hour the day rolls over (default 5).
 * @returns        the UTC `Date` of the start (openHour:00:00 local) of the user-day.
 */
import { userDayKey } from "./userDayKey";

function wallPartsInTz(instant: Date, userTz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: userTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (t: string): number => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
}

function offsetMsAt(utc: number, userTz: string): number {
  const w = wallPartsInTz(new Date(utc), userTz);
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - utc; // ms the zone is ahead of UTC
}

/** The UTC instant of openHour:00:00 user-local on the calendar date `dayKey` ("YYYY-MM-DD"). */
export function dayKeyToStartInstant(dayKey: string, userTz: string, openHour = 5): Date {
  const [y, mo, d] = dayKey.split("-").map(Number);
  // Solve for the UTC instant whose wall-clock in `userTz` is openHour:00:00 on (y-mo-d).
  // Pretend the target wall time is UTC, then correct by the zone offset. Refine once so the
  // offset is read AT the estimate, not at the UTC guess — this fixes the spring-forward day
  // where openHour-UTC and openHour-local fall on opposite sides of the DST change.
  const asIfUtc = Date.UTC(y, mo - 1, d, openHour, 0, 0);
  const firstEstimate = asIfUtc - offsetMsAt(asIfUtc, userTz);
  return new Date(asIfUtc - offsetMsAt(firstEstimate, userTz));
}

export function userDayStartInstant(instant: Date, userTz: string, openHour = 5): Date {
  return dayKeyToStartInstant(userDayKey(instant, userTz, openHour), userTz, openHour);
}
