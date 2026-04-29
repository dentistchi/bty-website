/**
 * Center/Foundry dojo integrity 도메인 — 경계 테스트.
 * integrity.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import { validateIntegrityResponse } from "./integrity";

describe("domain/dojo/integrity (edges)", () => {
  describe("validateIntegrityResponse non-string / type edges", () => {
    it("non-string text (number) with no choiceId returns missing_input", () => {
      const r = validateIntegrityResponse(42 as unknown as string, null);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("missing_input");
    });

    it("non-string text (object) with no choiceId returns missing_input", () => {
      const r = validateIntegrityResponse({} as unknown as string, undefined);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("missing_input");
    });

    it("whitespace-only choiceId with no text returns ok (length > 0)", () => {
      const r = validateIntegrityResponse(null, "  ");
      expect(r.ok).toBe(true);
    });
  });

  describe("validateIntegrityResponse length boundary with choiceId", () => {
    it("text exactly 5000 with choiceId returns ok", () => {
      const r = validateIntegrityResponse("a".repeat(5000), "choice_X");
      expect(r.ok).toBe(true);
    });

    it("text 5001 with choiceId returns text_too_long", () => {
      const r = validateIntegrityResponse("b".repeat(5001), "choice_Y");
      expect(r.ok).toBe(false);
      expect(r.error).toBe("text_too_long");
    });
  });

  it("text null and choiceId empty string returns missing_input", () => {
    const r = validateIntegrityResponse(null, "");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("missing_input");
  });
});
