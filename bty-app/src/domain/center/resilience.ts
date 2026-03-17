/**
 * Center 회복 탄력성 — 일별/기간별 트렉 도메인 (§4 CENTER_PAGE_IMPROVEMENT_SPEC).
 * 진도 = `aggregateLetterRowsToDailyEntries`·`energyToLevel`. energy 1–5 권장; 그 밖 값은 구간 규칙으로 매핑(API에서 1–5 클램프 권장).
 * `periodDays`: 최신 일 기준 **포함** `periodDays`일 구간만 반환.
 * @see letter — 편지 본문 검증(`validateLetterBody`)은 제출 경로 전용.
 */

export type ResilienceDailyLevel = "high" | "mid" | "low";

/** 레벨 id 목록 (API·순회용). */
export const RESILIENCE_LEVEL_IDS: readonly ResilienceDailyLevel[] = ["low", "mid", "high"];

export type ResilienceDayEntry = {
  date: string; // YYYY-MM-DD
  level: ResilienceDailyLevel;
  source: "letter";
};

/** Letter row from DB (created_at ISO string, energy 1–5 or null). */
export type LetterRow = { energy: number | null; created_at: string };

/** energy 1–5 → low / mid / high. 없으면 mid. */
export function energyToLevel(energy: number | null | undefined): ResilienceDailyLevel {
  if (energy == null) return "mid";
  if (energy <= 2) return "low";
  if (energy >= 4) return "high";
  return "mid";
}

/**
 * Letter 행을 날짜별로 집계해 일별 트렉 엔트리 배열 반환.
 * 같은 날 여러 편지면 마지막 energy 사용 (created_at 오름차순 가정).
 * periodDays 있으면 해당 일수만큼 최근만 반환 (날짜 기준).
 */
export function aggregateLetterRowsToDailyEntries(
  rows: LetterRow[],
  options?: { periodDays?: number }
): ResilienceDayEntry[] {
  const byDate = new Map<string, { energy: number | null }>();
  for (const r of rows) {
    const date = (r.created_at as string).slice(0, 10);
    const energy = r.energy != null ? Number(r.energy) : null;
    const existing = byDate.get(date);
    if (!existing) {
      byDate.set(date, { energy });
    } else {
      byDate.set(date, { energy: energy ?? existing.energy });
    }
  }

  let entries: ResilienceDayEntry[] = Array.from(byDate.entries())
    .map(([date, { energy }]) => ({
      date,
      level: energyToLevel(energy),
      source: "letter" as const,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (options?.periodDays != null && options.periodDays > 0 && entries.length > 0) {
    const cutoff = new Date(entries[entries.length - 1].date + "T00:00:00Z");
    cutoff.setDate(cutoff.getDate() - options.periodDays + 1);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    entries = entries.filter((e) => e.date >= cutoffStr);
  }

  return entries;
}
