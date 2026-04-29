import type { AssessmentResult } from "./types";

const KEY = "bty_assessment_result_v1";

export function saveResult(r: AssessmentResult) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(r));
}

export function loadResult(): AssessmentResult | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AssessmentResult;
  } catch {
    return null;
  }
}

export function clearResult() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
