/**
 * Apply Window timing copy — ONE authority for two surfaces (Slice 3.2R-R2.6).
 *
 * The label was previously defined only inside `TodayPersonalBrief`, which is not mounted. When
 * the same chip was needed on the surface the learner actually sees, copying the mapping would
 * have created two definitions of the same product rule — and the rule is exact:
 *
 *   active     → "This week"     the window is open, days remain
 *   due_today  → "Last day"      the last BTY day of the window
 *   overdue    → "Window closed" NEVER "Overdue". The learner committed to something and the
 *                                period ended; they did not fail, and nothing was missed.
 *
 * `due_today` is only reachable for a training with NO 7-day follow-up. With one configured, the
 * follow-up becomes due on the same BTY day and suppresses the Apply item entirely — so "Last day"
 * is never shown for the 7-day case, by construction rather than by copy.
 *
 * Presentation only: no state is decided here. The state arrives already classified from
 * `classifyApplyWindow` in the domain.
 */
import type { ReminderState } from "@/domain/daily/todayReminders";

const LABEL: Record<string, { en: string; ko: string }> = {
  active: { en: "This week", ko: "이번 주" },
  due_today: { en: "Last day", ko: "마지막 날" },
  overdue: { en: "Window closed", ko: "적용 기간 종료" },
};

/** The Apply Window's timing chip. Unknown states fall back to the open-window label. */
export function applyStateLabel(state: ReminderState | string, locale: string): string {
  const entry = LABEL[state] ?? LABEL.active!;
  return locale === "ko" ? entry.ko : entry.en;
}

/**
 * An Apply Window is NEVER red, in any state — see the module note. `due_today` is the only
 * state that earns emphasis, and it is the calm amber every other "today" item uses.
 */
export function applyStateTone(state: ReminderState | string): string {
  return state === "due_today"
    ? "text-[#E5B769] border-[#C9A66B]/35"
    : "text-white/50 border-white/12";
}
