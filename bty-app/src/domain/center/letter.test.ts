/**
 * Center letter 도메인 단위 테스트.
 * validateLetterBody: 빈 문자열·10000자 초과 거부, 정상 허용.
 * LetterSubmission / LetterWithReply 타입 shape 검증.
 */
import { describe, it, expect } from "vitest";
import {
  validateLetterBody,
  type LetterSubmission,
  type LetterWithReply,
} from "./letter";

describe("center/letter", () => {
  describe("validateLetterBody", () => {
    it("rejects empty string", () => {
      const r = validateLetterBody("");
      expect(r.ok).toBe(false);
      expect(r.error).toBe("body_empty");
    });

    it("rejects whitespace-only string", () => {
      const r = validateLetterBody("   \n\t  ");
      expect(r.ok).toBe(false);
      expect(r.error).toBe("body_empty");
    });

    it("rejects body exceeding 10000 characters", () => {
      const long = "a".repeat(10_001);
      const r = validateLetterBody(long);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("body_too_long");
    });

    it("accepts body exactly 10000 characters", () => {
      const exact = "a".repeat(10_000);
      const r = validateLetterBody(exact);
      expect(r.ok).toBe(true);
      expect(r.error).toBeUndefined();
    });

    it("accepts normal body", () => {
      const r = validateLetterBody("오늘 하루 고생했어요.");
      expect(r.ok).toBe(true);
      expect(r.error).toBeUndefined();
    });

    it("rejects non-string input", () => {
      const r = validateLetterBody(null as unknown as string);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("body_empty");
    });
  });

  describe("LetterSubmission type", () => {
    it("has body, locale, userId", () => {
      const s: LetterSubmission = {
        body: "hello",
        locale: "ko",
        userId: "user-1",
      };
      expect(s.body).toBe("hello");
      expect(s.locale).toBe("ko");
      expect(s.userId).toBe("user-1");
    });

    it("locale accepts en", () => {
      const s: LetterSubmission = { body: "hi", locale: "en", userId: "u" };
      expect(s.locale).toBe("en");
    });
  });

  describe("LetterWithReply type", () => {
    it("has id, body, reply, locale, createdAt", () => {
      const l: LetterWithReply = {
        id: "letter-1",
        body: "내용",
        reply: "답장",
        locale: "ko",
        createdAt: "2026-03-09T00:00:00Z",
      };
      expect(l.id).toBe("letter-1");
      expect(l.body).toBe("내용");
      expect(l.reply).toBe("답장");
      expect(l.locale).toBe("ko");
      expect(l.createdAt).toBe("2026-03-09T00:00:00Z");
    });

    it("reply can be null", () => {
      const l: LetterWithReply = {
        id: "letter-2",
        body: "text",
        reply: null,
        locale: "en",
        createdAt: "2026-03-09T12:00:00Z",
      };
      expect(l.reply).toBeNull();
    });
  });
});
