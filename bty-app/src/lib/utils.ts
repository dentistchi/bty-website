import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const COMEBACK_STORAGE_KEY = "bty_last_visit";
export const COMEBACK_DAYS_THRESHOLD = 3;

export function getLastVisit(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(COMEBACK_STORAGE_KEY);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

export function setLastVisit(ts: number = Date.now()): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COMEBACK_STORAGE_KEY, String(ts));
}

export function shouldShowComeback(): boolean {
  const last = getLastVisit();
  if (last === null) return false;
  const days = (Date.now() - last) / (24 * 60 * 60 * 1000);
  return days >= COMEBACK_DAYS_THRESHOLD;
}

// Practice log (오늘의 연습) — LocalStorage
export const PRACTICE_LOG_KEY = "bty_practice_log";

export type PracticeEntry = { date: string; type: "success" | "failure" };

export function getPracticeLog(): PracticeEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRACTICE_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PracticeEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendPracticeEntry(entry: PracticeEntry): void {
  const log = getPracticeLog();
  const today = entry.date;
  const withoutToday = log.filter((e) => e.date !== today);
  const next = [...withoutToday, { ...entry }].sort(
    (a, b) => a.date.localeCompare(b.date)
  );
  if (typeof window === "undefined") return;
  localStorage.setItem(PRACTICE_LOG_KEY, JSON.stringify(next));
}

// 자존감 테스트 결과 — AI 대화에서 참고용
export const SELF_ESTEEM_RESULT_KEY = "dear_self_esteem_result";

export type SelfEsteemLevel = "high" | "mid" | "low";

export type SelfEsteemResult = {
  score: number;
  maxScore: number;
  level: SelfEsteemLevel;
  strengthText: string;
  weakAreaIndices: number[];
  completedAt: string;
};

export function getSelfEsteemResult(): SelfEsteemResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SELF_ESTEEM_RESULT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SelfEsteemResult;
  } catch {
    return null;
  }
}

export function setSelfEsteemResult(result: SelfEsteemResult): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SELF_ESTEEM_RESULT_KEY, JSON.stringify(result));
}

// BTY 브릿지 표시 조건: Safe Mirror에서 AI 답장을 받았을 때
export const SAFE_MIRROR_POSITIVE_KEY = "dear_safe_mirror_positive";

export function getSafeMirrorPositive(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SAFE_MIRROR_POSITIVE_KEY) === "1";
}

export function setSafeMirrorPositive(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SAFE_MIRROR_POSITIVE_KEY, "1");
}
