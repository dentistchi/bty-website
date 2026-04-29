import type { Locale } from "@/lib/locale";

type Dict = Record<string, string>;

const en: Dict = {
  trackTitle: "28-Day Training",
  user: "user",
  ruleNote:
    "Rule: unlock requires (1) date >= 5am and (2) previous day completed. Even after completing today, next day stays locked until tomorrow 5am.",
  markComplete: "Mark today as complete",
  processing: "Processing...",
  locked: "Locked",
  today: "Today",
  done: "Done",
  startFocus: "Start 10-min focus",
  stop: "Stop",
  reset: "Reset",
  reflectionTitle: "Reflection (2–3 lines)",
  reflectionPlaceholder:
    "What did you do today? What was hardest? What will you do in 10 seconds tomorrow?",
  saveDraft: "Save draft (local)",
  coachChat: "Coach Chat",
  completion: "Completion",
  completionTitle: "Today's completion recap",
  notCompletedYet: "Not completed yet. Complete today to generate recap.",
  reinforcementQs: "3 reinforcement questions",
  lesson: "Lesson",
  actions: "Today's actions",
  whyItWorks: "Why it works",
  resistance: "Expected resistance",
  breakthrough: "Breakthrough strategy",
  evening: "Evening ritual",
  questions: "Today's questions",
};

const ko: Dict = {
  // 나중에 필요하면 채워도 되지만, 지금은 "영어 기본"이 목표라 최소만
  trackTitle: "28일 훈련",
  markComplete: "오늘 실천 완료",
};

export function t(locale: Locale, key: keyof typeof en): string {
  const dict = locale === "ko" ? { ...en, ...ko } : en;
  return dict[key] ?? en[key] ?? String(key);
}
