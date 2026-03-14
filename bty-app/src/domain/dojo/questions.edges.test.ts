/**
 * Dojo questions 도메인 경계 테스트.
 * questions.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import {
  mapDojoQuestionRow,
  DOJO_LIKERT_5_VALUES,
  type DojoQuestion,
  type DojoLikert5Value,
} from "./questions";

describe("dojo questions (edges)", () => {
  it("mapDojoQuestionRow with null text_ko and text_en yields empty strings", () => {
    const out = mapDojoQuestionRow({
      id: 1,
      area: "perspective_taking",
      order_in_area: 1,
      text_ko: null as unknown as string,
      text_en: undefined as unknown as string,
      scale_type: "likert_5",
    });
    expect(out.textKo).toBe("");
    expect(out.textEn).toBe("");
  });

  it("mapDojoQuestionRow with null scale_type defaults to likert_5", () => {
    const out = mapDojoQuestionRow({
      id: 1,
      area: "perspective_taking",
      order_in_area: 1,
      text_ko: "텍스트",
      text_en: "Text",
      scale_type: null as unknown as string,
    });
    expect(out.scaleType).toBe("likert_5");
  });

  it("mapDojoQuestionRow with undefined scale_type defaults to likert_5", () => {
    const out = mapDojoQuestionRow({
      id: 1,
      area: "perspective_taking",
      order_in_area: 1,
      text_ko: "a",
      text_en: "b",
      scale_type: undefined as unknown as string,
    });
    expect(out.scaleType).toBe("likert_5");
  });

  it("mapDojoQuestionRow with empty string scale_type yields empty string", () => {
    const out = mapDojoQuestionRow({
      id: 1,
      area: "communication",
      order_in_area: 1,
      text_ko: "a",
      text_en: "b",
      scale_type: "",
    });
    expect(out.scaleType).toBe("");
  });

  it("mapDojoQuestionRow with numeric string id and order_in_area", () => {
    const out = mapDojoQuestionRow({
      id: "10" as unknown as number,
      area: "leadership",
      order_in_area: "5" as unknown as number,
      text_ko: "q",
      text_en: "q",
      scale_type: "likert_5",
    });
    expect(out.id).toBe(10);
    expect(out.orderInArea).toBe(5);
  });

  it("mapDojoQuestionRow with id 0 and order_in_area 0 yields zero", () => {
    const out = mapDojoQuestionRow({
      id: 0,
      area: "conflict",
      order_in_area: 0,
      text_ko: "x",
      text_en: "x",
      scale_type: "likert_5",
    });
    expect(out.id).toBe(0);
    expect(out.orderInArea).toBe(0);
  });

  it("mapDojoQuestionRow with null id yields 0 (Number(null))", () => {
    const out = mapDojoQuestionRow({
      id: null as unknown as number,
      area: "teamwork",
      order_in_area: 1,
      text_ko: "q",
      text_en: "q",
      scale_type: "likert_5",
    });
    expect(out.id).toBe(0);
  });

  it("DOJO_LIKERT_5_VALUES is readonly and stable", () => {
    expect(DOJO_LIKERT_5_VALUES).toHaveLength(5);
    expect(DOJO_LIKERT_5_VALUES[0]).toBe(1);
    expect(DOJO_LIKERT_5_VALUES[4]).toBe(5);
  });

  it("mapDojoQuestionRow with first question (id 1, order_in_area 1)", () => {
    const out = mapDojoQuestionRow({
      id: 1,
      area: "perspective_taking",
      order_in_area: 1,
      text_ko: "first",
      text_en: "first",
      scale_type: "likert_5",
    });
    expect(out.id).toBe(1);
    expect(out.orderInArea).toBe(1);
    expect(out.area).toBe("perspective_taking");
  });

  it("mapDojoQuestionRow with last question (id 50, order_in_area 10)", () => {
    const out = mapDojoQuestionRow({
      id: 50,
      area: "teamwork",
      order_in_area: 10,
      text_ko: "last",
      text_en: "last",
      scale_type: "likert_5",
    });
    expect(out.id).toBe(50);
    expect(out.orderInArea).toBe(10);
    expect(out.area).toBe("teamwork");
  });

  it("DojoQuestion and DojoLikert5Value type usage at boundary", () => {
    const q: DojoQuestion = {
      id: 50,
      area: "teamwork",
      orderInArea: 10,
      textKo: "마지막 문항",
      textEn: "Last item",
      scaleType: "likert_5",
    };
    expect(q.id).toBe(50);
    const v: DojoLikert5Value = 3;
    expect(v).toBe(3);
  });

  it("mapDojoQuestionRow passes through area string without validation", () => {
    const out = mapDojoQuestionRow({
      id: 1,
      area: "custom_area",
      order_in_area: 1,
      text_ko: "a",
      text_en: "b",
      scale_type: "likert_5",
    });
    expect(out.area).toBe("custom_area");
  });

  it("mapDojoQuestionRow preserves long text_ko and text_en", () => {
    const longKo = "가".repeat(500);
    const longEn = "a".repeat(500);
    const out = mapDojoQuestionRow({
      id: 1,
      area: "perspective_taking",
      order_in_area: 1,
      text_ko: longKo,
      text_en: longEn,
      scale_type: "likert_5",
    });
    expect(out.textKo).toBe(longKo);
    expect(out.textEn).toBe(longEn);
  });
});
