/**
 * Core XP → 프로필 **표시용** 라벨 키 (순수). 주간 랭킹·리더보드 정렬과 무관.
 * @see stage — stageNumberFromCoreXp 단일 소스.
 * @see level-tier — Code(리그) 인덱스는 랭킹과 무관.
 */

import { stageNumberFromCoreXp } from "./stage";
import { tierFromCoreXp, codeIndexFromTier } from "./level-tier";

/** 비정상·NaN 입력은 표시용으로 0 XP 경로로 정규화 (리더보드·XP 저장과 무관). */
function coreXpForDisplayKeys(coreXp: number): number {
  if (typeof coreXp !== "number" || !Number.isFinite(coreXp)) return 0;
  return coreXp;
}

/** i18n 접두사 고정; 스테이지 번호만 변동 (1–7). */
export function coreXpProfileDisplayLevelKey(coreXp: number): string {
  const n = stageNumberFromCoreXp(coreXpForDisplayKeys(coreXp));
  return `profile_core_display_level_${n}`;
}

/** Core XP 기반 Code(티어 구간) 표시 키 — 0..6. 리더보드 weekly 순위와 무관. */
export function coreXpTierDisplayCodeKey(coreXp: number): string {
  const ci = codeIndexFromTier(tierFromCoreXp(coreXpForDisplayKeys(coreXp)));
  return `profile_tier_code_${ci}`;
}
