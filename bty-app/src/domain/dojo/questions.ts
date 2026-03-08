/**
 * Dojo 50문항 — 문항·선택지 도메인 타입 (DB·API 계약).
 * DOJO_DEAR_ME_50_DB_AND_FLOWS_IMPLEMENT_1PAGE §1. 비즈니스 규칙은 flow.ts.
 */

import type { Dojo50AreaId } from "./flow";

/** API/DB 문항 1건. id 1..50, area별 order_in_area 1..10. */
export type DojoQuestion = {
  id: number;
  area: Dojo50AreaId;
  orderInArea: number;
  textKo: string;
  textEn: string;
  scaleType: string;
};

/** 리커트 5단계 선택지 값. 라벨은 i18n dojo.likert1..likert5 사용. */
export const DOJO_LIKERT_5_VALUES = [1, 2, 3, 4, 5] as const;

export type DojoLikert5Value = (typeof DOJO_LIKERT_5_VALUES)[number];

/** DB row → API 문항 형식. */
export function mapDojoQuestionRow(row: {
  id: number;
  area: string;
  order_in_area: number;
  text_ko: string;
  text_en: string;
  scale_type: string;
}): DojoQuestion {
  return {
    id: Number(row.id),
    area: row.area as Dojo50AreaId,
    orderInArea: Number(row.order_in_area),
    textKo: String(row.text_ko ?? ""),
    textEn: String(row.text_en ?? ""),
    scaleType: String(row.scale_type ?? "likert_5"),
  };
}
