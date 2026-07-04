/**
 * userDayKey — the canonical BTY "which day is this?" key (STEP 1C / D1 FINAL LOCK).
 *
 * D1 FINAL LOCK (Commander-ratified): storage = UTC instants; experience = user-local day;
 * day boundary (open-hour) = 05:00 user-local; DST-safe IANA tz identifiers only (never fixed
 * offsets). A moment BEFORE the open-hour belongs to the PREVIOUS local day.
 *
 * EXCEPTION (do NOT use this util there): leaderboard / weekly / season stay UTC-locked.
 *
 * Pure domain function — no I/O, no `Date.now()`, no side effects. `Intl` (ECMA-402) is a pure
 * built-in; it applies the correct wall-clock offset for `userTz` at `instant`, including DST.
 *
 * @param instant  a UTC instant (the stored truth).
 * @param userTz   a valid IANA tz id (e.g. "Asia/Seoul", "America/Los_Angeles", "UTC" for the
 *                 documented fallback). Invalid ids make `Intl` throw — resolve/validate upstream.
 * @param openHour local hour the day rolls over (default 5 = 05:00).
 * @returns        the day key as "YYYY-MM-DD" (the local calendar date of the day the instant is in).
 */
export function userDayKey(instant: Date, userTz: string, openHour = 5): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: userTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23", // 00..23 so "24:xx" never appears
  }).formatToParts(instant);

  const get = (t: string): number => Number(parts.find((p) => p.type === t)?.value);
  let y = get("year");
  let mo = get("month");
  let d = get("day");
  const h = get("hour");

  // Before the open-hour → this local wall-clock moment belongs to the previous local day.
  if (h < openHour) {
    // Pure calendar subtraction on the LOCAL date (UTC math avoids any tz interference here).
    const prev = new Date(Date.UTC(y, mo - 1, d) - 86_400_000);
    y = prev.getUTCFullYear();
    mo = prev.getUTCMonth() + 1;
    d = prev.getUTCDate();
  }

  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
