/**
 * TODAY REMAINING REMINDER — the one local notification the native iPhone app may hold. PURE.
 *
 * ONE-SHOT, ONE ID. There is never more than one: a fixed identifier, replaced on every reconcile
 * and cancelled by that identifier alone (never "cancel all" — other notifications are not ours).
 *
 * CONTENT-FREE BY CONSTRUCTION. The payload carries a fixed sentence and the locale, nothing
 * else — no item title, no person's name, no training, no count. A lock screen is a public place.
 */

/** The single identifier this feature ever schedules or cancels. iOS stores it as "\(id)". */
export const TODAY_REMAINING_REMINDER_ID = 81_001;

/** Local hour the reminder fires at. */
export const TODAY_REMAINING_REMINDER_HOUR = 8;

export type ReminderLocale = "en" | "ko";

export function reminderLocale(value: unknown): ReminderLocale {
  return value === "ko" ? "ko" : "en";
}

const COPY: Record<ReminderLocale, { title: string; body: string }> = {
  en: { title: "BTY", body: "You still have something waiting in Today." },
  ko: { title: "BTY", body: "Today에 아직 남아 있는 항목이 있습니다." },
};

/**
 * The next 08:00 in the DEVICE's local timezone: today's if it is still ahead, otherwise
 * tomorrow's. 08:00:00.000 exactly is no longer "ahead" — it rolls to tomorrow. Built with the
 * local-calendar constructor, so a DST transition shifts the instant, never the wall-clock hour.
 */
export function nextRemainingReminderAt(now: Date): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), TODAY_REMAINING_REMINDER_HOUR, 0, 0, 0);
  if (now.getTime() < today.getTime()) return today;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, TODAY_REMAINING_REMINDER_HOUR, 0, 0, 0);
}

/** The canonical Today route a tap opens, locale preserved, with the two provenance markers. */
export function todayRemainingReminderRoute(locale: ReminderLocale): string {
  return `/${locale}/app?tab=today&src=notification&focus=remaining`;
}

export type RemainingReminderNotification = {
  id: number;
  title: string;
  body: string;
  schedule: { at: Date };
  extra: { kind: "today_remaining"; locale: ReminderLocale };
};

export function buildRemainingReminderNotification(locale: ReminderLocale, now: Date): RemainingReminderNotification {
  return {
    id: TODAY_REMAINING_REMINDER_ID,
    title: COPY[locale].title,
    body: COPY[locale].body,
    schedule: { at: nextRemainingReminderAt(now) },
    extra: { kind: "today_remaining", locale },
  };
}
