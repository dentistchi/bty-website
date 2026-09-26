"use client";

import { useEffect } from "react";
import { selectTodayOpenWork, type BriefReminder } from "@/domain/daily/todayOpenWork";
import { fetchTodayBrief } from "@/lib/bty/daily/todayBriefClient";
import {
  bindTodayRemainingReminder,
  syncTodayRemainingReminder,
} from "@/lib/native/todayRemainingReminder";

/**
 * TODAY REMAINING REMINDER — shell-level binding, so a return to the foreground re-checks Today
 * whichever tab is open (an item finished under Learn must still cancel the reminder).
 *
 * `enabled` is false for the Teams runtime, and the adapter is inert off the BTY iPhone app, so in a
 * browser or Teams this registers nothing and calls no plugin. The resume check reads the brief with
 * the same client and the same selector a Today load uses; a failed read decides nothing.
 */
export function useTodayRemainingReminder(locale: "en" | "ko", enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    return bindTodayRemainingReminder({
      locale,
      onResume: () => {
        void (async () => {
          const brief = await fetchTodayBrief<BriefReminder, { category: string }>(locale);
          if (!brief) return;
          const { openCount } = selectTodayOpenWork(brief.reminders, brief.hostAttention);
          await syncTodayRemainingReminder({ openCount, locale });
        })();
      },
    });
  }, [locale, enabled]);
}
