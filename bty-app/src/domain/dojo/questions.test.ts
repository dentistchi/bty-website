/**
 * Dojo 50문항 — 문항·선택지 도메인.
 * DOJO_DEAR_ME_50_DB_AND_FLOWS_IMPLEMENT_1PAGE §1.
 */
import { describe, it, expect } from "vitest";
import {
  mapDojoQuestionRow,
  DOJO_LIKERT_5_VALUES,
} from "./questions";

describe("dojo questions domain", () => {
  describe("DOJO_LIKERT_5_VALUES", () => {
    it("is [1,2,3,4,5]", () => {
      expect(DOJO_LIKERT_5_VALUES).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("mapDojoQuestionRow", () => {
    it("maps DB row to API shape", () => {
      const row = {
        id: 1,
        area: "perspective_taking",
        order_in_area: 1,
        text_ko: "상대 입장을 고려했나요?",
        text_en: "Did you consider the other perspective?",
        scale_type: "likert_5",
      };
      const out = mapDojoQuestionRow(row);
      expect(out).toEqual({
        id: 1,
        area: "perspective_taking",
        orderInArea: 1,
        textKo: "상대 입장을 고려했나요?",
        textEn: "Did you consider the other perspective?",
        scaleType: "likert_5",
      });
    });

    it("handles null-ish text with empty string", () => {
      const out = mapDojoQuestionRow({
        id: 25,
        area: "leadership",
        order_in_area: 5,
        text_ko: null as unknown as string,
        text_en: undefined as unknown as string,
        scale_type: "likert_5",
      });
      expect(out.textKo).toBe("");
      expect(out.textEn).toBe("");
      expect(out.id).toBe(25);
    });
  });
});
