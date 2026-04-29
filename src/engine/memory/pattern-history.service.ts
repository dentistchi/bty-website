/**
 * Arena — AIR 활성 로그 기반 패턴 내레이션 (시나리오 프롬프트 주입용).
 * DB: `le_activation_log.type` (AIR flag), `le_activation_log.scenario_type` (시나리오 축).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatBehaviorPatternNarrativeLines,
  getBehaviorPatterns,
} from "@/engine/integrity/behavior-pattern.service";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

const PATTERN_HISTORY_LIMIT = 5;

export type AirFlagRow = {
  flag_type: string;
  scenario_type: string | null;
};

/** 알려진 flag_type → 한국어 동사구 (문장 중간에 끼움). */
const FLAG_NARRATIVE_KO: Record<string, string> = {
  micro_win: "마이크로 승리 활성을 선택했습니다",
  reset: "리셋 활성을 선택했습니다",
};

function scenarioLabel(scenarioType: string | null | undefined): string {
  const s = typeof scenarioType === "string" ? scenarioType.trim() : "";
  return s !== "" ? s : "일반";
}

/**
 * 단일 AIR 플래그 행을 한국어 한 문장으로 변환한다.
 */
export function narrativeForAirFlag(row: AirFlagRow): string {
  const scenario = scenarioLabel(row.scenario_type);
  const body = FLAG_NARRATIVE_KO[row.flag_type] ?? `AIR 활성(${row.flag_type})을 기록했습니다`;
  return `${scenario} 맥락에서 ${body}.`;
}

/**
 * 최근 AIR 활성 로그 최대 5건(`created_at` 내림차순) — 문장 단위 배열 (RAG·멘토 맥락용).
 */
export async function getPatternNarrativeLines(
  userId: string,
  supabase?: SupabaseClient,
): Promise<string[]> {
  const client = supabase ?? (await getSupabaseServerClient());

  const { data: rows, error } = await client
    .from("le_activation_log")
    .select("type, scenario_type")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(PATTERN_HISTORY_LIMIT);

  if (error) throw new Error(error.message);
  if (!rows?.length) return [];

  return rows.map((r) =>
    narrativeForAirFlag({
      flag_type: typeof r.type === "string" ? r.type : "unknown",
      scenario_type:
        r.scenario_type != null && typeof r.scenario_type === "string"
          ? r.scenario_type
          : null,
    }),
  );
}

/**
 * 최근 AIR 활성 로그 최대 5건(`created_at` 내림차순)을 조회해 한국어 내레이션을 이어 붙인다.
 * 기록이 없으면 빈 문자열.
 *
 * @param userId — 세션 `user.id`와 일치해야 RLS로 본인 행만 조회.
 * @param supabase — 테스트·호출부 주입 가능; 생략 시 서버 클라이언트.
 */
export async function getPatternNarrative(
  userId: string,
  supabase?: SupabaseClient,
): Promise<string> {
  const [airParts, patterns] = await Promise.all([
    getPatternNarrativeLines(userId, supabase),
    getBehaviorPatterns(userId, { refresh: true }),
  ]);
  const behaviorParts = formatBehaviorPatternNarrativeLines(patterns);
  if (behaviorParts.length === 0) return airParts.join(" ");
  return [...airParts, ...behaviorParts].join(" ");
}
