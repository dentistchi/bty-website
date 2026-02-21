import type { Scores, Pattern, Track } from "./score";

export type AssessmentResultV2 = {
  scores: Scores;
  pattern: Pattern;
  track: Track;
  reasons: string[];
};

const KEY = "bty_assessment_result_v2";

export function saveResultV2(r: AssessmentResultV2) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(r));
}

export function loadResultV2(): AssessmentResultV2 | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AssessmentResultV2;
  } catch {
    return null;
  }
}
