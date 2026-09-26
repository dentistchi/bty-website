/**
 * CLIENT read of `GET /api/me/today/brief` — the one request Today's list and the native reminder
 * both decide from. Extracted from TodayHome so a foreground resume reads the brief with exactly the
 * same query (locale + device timezone) and the same failure semantics as a Today load.
 *
 * `null` means NOT KNOWN — HTTP failure, `ok !== true`, or a thrown fetch. It never means empty;
 * an empty Today is `{ reminders: [], hostAttention: [] }`.
 */

export function deviceTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export type TodayBriefRead<R, H> = { reminders: R[]; hostAttention: H[] };

export async function fetchTodayBrief<R, H>(locale: "en" | "ko"): Promise<TodayBriefRead<R, H> | null> {
  const qs = new URLSearchParams({ locale });
  const tz = deviceTz();
  if (tz) qs.set("tz", tz);
  try {
    const res = await fetch(`/api/me/today/brief?${qs.toString()}`, { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const d = (await res.json()) as { ok?: boolean; reminders?: R[]; hostAttention?: H[] };
    if (!d?.ok) return null;
    return {
      reminders: Array.isArray(d.reminders) ? d.reminders : [],
      hostAttention: Array.isArray(d.hostAttention) ? d.hostAttention : [],
    };
  } catch {
    return null;
  }
}
