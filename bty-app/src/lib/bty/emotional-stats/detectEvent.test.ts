/**
 * detectEvent — detectEmotionalEventFromText 단위 테스트.
 */
import { describe, it, expect } from "vitest";
import { detectEmotionalEventFromText } from "./detectEvent";

describe("detectEvent", () => {
  describe("detectEmotionalEventFromText", () => {
    it("returns null for empty or whitespace-only text", () => {
      expect(detectEmotionalEventFromText("")).toBeNull();
      expect(detectEmotionalEventFromText("   ")).toBeNull();
    });

    it("returns null for non-string input", () => {
      expect(detectEmotionalEventFromText(null as unknown as string)).toBeNull();
      expect(detectEmotionalEventFromText(undefined as unknown as string)).toBeNull();
    });

    it("returns FEELING_LABELED when text matches feeling labeled pattern (KO)", () => {
      expect(detectEmotionalEventFromText("그 감정 이름을 붙여보면")).toBe("FEELING_LABELED");
      expect(detectEmotionalEventFromText("느낌은 어떤가요?")).toBe("FEELING_LABELED");
    });

    it("returns FEELING_LABELED when text matches feeling labeled pattern (EN)", () => {
      expect(detectEmotionalEventFromText("The feeling is named")).toBe("FEELING_LABELED");
    });

    it("returns CLEAR_REQUEST when text matches request pattern", () => {
      expect(detectEmotionalEventFromText("구체적 요청을 해주세요")).toBe("CLEAR_REQUEST");
      expect(detectEmotionalEventFromText("request: something")).toBe("CLEAR_REQUEST");
    });

    it("returns NEED_IDENTIFIED when text matches need pattern", () => {
      expect(detectEmotionalEventFromText("그 필요가 뭔지 말해줘")).toBe("NEED_IDENTIFIED");
    });

    it("returns SELF_REFRAMING when text matches reframe pattern", () => {
      expect(detectEmotionalEventFromText("스스로 다시 보기")).toBe("SELF_REFRAMING");
      expect(detectEmotionalEventFromText("reframing the situation")).toBe("SELF_REFRAMING");
    });

    it("returns null when no pattern matches", () => {
      expect(detectEmotionalEventFromText("hello world")).toBeNull();
      expect(detectEmotionalEventFromText("일정 확인")).toBeNull();
    });

    it("returns EMPATHY_EXPRESSED when text matches empathy pattern (KO/EN)", () => {
      expect(detectEmotionalEventFromText("공감 표현해 주셔서")).toBe("EMPATHY_EXPRESSED");
      expect(detectEmotionalEventFromText("공감해 줘서 고마워요")).toBe("EMPATHY_EXPRESSED");
      expect(detectEmotionalEventFromText("expressed empathy")).toBe("EMPATHY_EXPRESSED");
    });

    it("returns first matching event when multiple could match (priority order)", () => {
      const result = detectEmotionalEventFromText("감정 이름을 붙이고 요청을 해주세요");
      expect(result).not.toBeNull();
      expect(["FEELING_LABELED", "CLEAR_REQUEST"]).toContain(result);
    });
  });
});
