/**
 * 대시보드용 AIR·TII 요약 정규화 (순수). API 스키마 드리프트 방지.
 * @see air — 밴드; @see tii — TII 합성.
 */

import { airToBand, type AIRBand } from "./air";
import { computeTII, normalizeAIR } from "./tii";

export type DashboardAirTiiRaw = {
  air_7d?: number | null;
  air_14d?: number | null;
  /** 팀 평균 AIR — TII 계산 시 사용 */
  avg_air_team?: number | null;
  avg_mwd?: number | null;
  tsp?: number | null;
  integrity_slip?: boolean | null;
};

export type DashboardAirTiiNormalized = {
  air_7d: number;
  air_14d: number;
  band_7d: AIRBand;
  band_14d: AIRBand;
  /** avg_air_team·avg_mwd·tsp 모두 있을 때만; 아니면 null */
  tii: number | null;
  integrity_slip: boolean;
};

/** 7d·14d·90d 롤링 구간 정규화 확장. */
export type DashboardAirTiiRawRolling = DashboardAirTiiRaw & {
  air_90d?: number | null;
};

export type DashboardAirTiiNormalizedRolling = DashboardAirTiiNormalized & {
  air_90d: number;
  band_90d: AIRBand;
};

export function normalizeDashboardAirTiiSummary(
  raw: DashboardAirTiiRaw
): DashboardAirTiiNormalized {
  const air_7d = normalizeAIR(Number(raw.air_7d ?? 0));
  const air_14d = normalizeAIR(Number(raw.air_14d ?? 0));
  const hasTii =
    raw.avg_air_team != null &&
    raw.avg_mwd != null &&
    raw.tsp != null &&
    Number.isFinite(Number(raw.avg_air_team)) &&
    Number.isFinite(Number(raw.avg_mwd)) &&
    Number.isFinite(Number(raw.tsp));
  const tii = hasTii
    ? computeTII({
        avgAIR: Number(raw.avg_air_team),
        avgMWD: Number(raw.avg_mwd),
        tsp: Number(raw.tsp),
      })
    : null;
  return {
    air_7d,
    air_14d,
    band_7d: airToBand(air_7d),
    band_14d: airToBand(air_14d),
    tii,
    integrity_slip: Boolean(raw.integrity_slip),
  };
}

export function normalizeDashboardAirTiiRollingSummary(
  raw: DashboardAirTiiRawRolling
): DashboardAirTiiNormalizedRolling {
  const base = normalizeDashboardAirTiiSummary(raw);
  const air_90d = normalizeAIR(Number(raw.air_90d ?? 0));
  return {
    ...base,
    air_90d,
    band_90d: airToBand(air_90d),
  };
}
