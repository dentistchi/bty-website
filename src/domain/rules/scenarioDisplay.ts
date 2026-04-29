/**
 * 시나리오 난이도·길이 메타 → 표시용 i18n 키 (순수). 랭킹·XP와 무관.
 */

/** Arena 시나리오 코드 ID: 소문자 시작, [a-z0-9_], 1–128자. */
const ARENA_SCENARIO_CODE_RE = /^[a-z][a-z0-9_]{0,127}$/;

export function isValidArenaScenarioCodeId(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const s = raw.trim();
  if (s.length === 0 || s.length > 128) return false;
  return ARENA_SCENARIO_CODE_RE.test(s);
}

export function scenarioDifficultyDisplayKey(
  difficulty: string | null | undefined
): "scenario_difficulty_easy" | "scenario_difficulty_medium" | "scenario_difficulty_hard" {
  const d = String(difficulty ?? "medium")
    .trim()
    .toLowerCase();
  if (
    d === "easy" ||
    d === "beginner" ||
    d === "low"
  ) {
    return "scenario_difficulty_easy";
  }
  if (
    d === "hard" ||
    d === "advanced" ||
    d === "high"
  ) {
    return "scenario_difficulty_hard";
  }
  return "scenario_difficulty_medium";
}

/** 예상 분(메타) → 길이 밴드 키. */
export function scenarioDurationBandDisplayKey(
  estimatedMinutes: number | null | undefined
): "scenario_duration_short" | "scenario_duration_medium" | "scenario_duration_long" {
  const m =
    estimatedMinutes == null || !Number.isFinite(Number(estimatedMinutes))
      ? 10
      : Math.max(0, Number(estimatedMinutes));
  if (m <= 5) return "scenario_duration_short";
  if (m <= 20) return "scenario_duration_medium";
  return "scenario_duration_long";
}
