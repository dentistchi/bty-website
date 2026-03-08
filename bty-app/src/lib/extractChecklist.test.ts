/**
 * extractChecklist — 단위 테스트 (미커버 모듈, 비즈니스/XP 미변경).
 */
import { describe, it, expect } from "vitest";
import { extractChecklist } from "./extractChecklist";

describe("extractChecklist", () => {
  it("returns empty array for empty or falsy input", () => {
    expect(extractChecklist("")).toEqual([]);
    expect(extractChecklist("   ")).toEqual([]);
  });

  it("strips list markers and trims lines", () => {
    const text = `
- 첫 번째 항목
• 두 번째 항목
1) 세 번째 항목
`;
    expect(extractChecklist(text)).toEqual(["첫 번째 항목", "두 번째 항목", "세 번째 항목"]);
  });

  it("filters out lines shorter than 3 characters", () => {
    const text = "ab\n- ok\n- x\n- 길이 충분";
    expect(extractChecklist(text)).toEqual(["길이 충분"]);
  });

  it("returns at most 6 items", () => {
    const lines = Array.from({ length: 10 }, (_, i) => `${i + 1}. 항목${i + 1}`).join("\n");
    const result = extractChecklist(lines);
    expect(result).toHaveLength(6);
    expect(result[0]).toBe("항목1");
    expect(result[5]).toBe("항목6");
  });
});
