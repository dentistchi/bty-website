import { userDayKey } from "./userDayKey";
import { dayKeyToStartInstant } from "./userDayStartInstant";

/** Exact canonical user-day bounds, including 23/25-hour DST days. Pure; no I/O. */
export function userDayWindow(instant: Date, userTz: string, openHour = 5): { start: Date; end: Date } {
  const key = userDayKey(instant, userTz, openHour);
  const [year, month, day] = key.split("-").map(Number);
  // Advance the calendar key, not the UTC instant: +24h can still be inside
  // the same local day when clocks fall back.
  const nextKey = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  return { start: dayKeyToStartInstant(key, userTz, openHour), end: dayKeyToStartInstant(nextKey, userTz, openHour) };
}
