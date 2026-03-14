/**
 * Center letter 도메인 — 경계 케이스 보강.
 * 기존 letter.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import {
  validateLetterBody,
  type LetterSubmission,
  type LetterWithReply,
  type LetterLocale,
} from "./letter";

describe("center/letter (edges)", () => {
  describe("validateLetterBody boundaries", () => {
    it("rejects tab-only input", () => {
      const r = validateLetterBody("\t\t\t");
      expect(r.ok).toBe(false);
      expect(r.error).toBe("body_empty");
    });

    it("rejects newline-only input", () => {
      const r = validateLetterBody("\n\n\n");
      expect(r.ok).toBe(false);
      expect(r.error).toBe("body_empty");
    });

    it("rejects undefined input", () => {
      const r = validateLetterBody(undefined as unknown as string);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("body_empty");
    });

    it("rejects null input", () => {
      const r = validateLetterBody(null as unknown as string);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("body_empty");
    });

    it("accepts XSS-like pattern as valid text (no sanitisation in domain)", () => {
      const r = validateLetterBody('<script>alert("xss")</script>');
      expect(r.ok).toBe(true);
    });

    it("accepts 9999-char body (just below max)", () => {
      const r = validateLetterBody("b".repeat(9_999));
      expect(r.ok).toBe(true);
    });

    it("accepts exactly 10000-char body (at max length)", () => {
      const r = validateLetterBody("x".repeat(10_000));
      expect(r.ok).toBe(true);
    });

    it("rejects 10001-char body (over max)", () => {
      const r = validateLetterBody("y".repeat(10_001));
      expect(r.ok).toBe(false);
      expect(r.error).toBe("body_too_long");
    });

    it("accepts single-character body", () => {
      const r = validateLetterBody("a");
      expect(r.ok).toBe(true);
    });

    it("accepts two-character body", () => {
      const r = validateLetterBody("ab");
      expect(r.ok).toBe(true);
    });

    it("accepts body with leading/trailing whitespace when inner content exists", () => {
      const r = validateLetterBody("  hello  ");
      expect(r.ok).toBe(true);
    });

    it("accepts emoji-only body", () => {
      const r = validateLetterBody("😊💪🔥");
      expect(r.ok).toBe(true);
    });

    it("accepts body containing zero-width space (trim does not remove Unicode ZWSP)", () => {
      const r = validateLetterBody("a\u200B");
      expect(r.ok).toBe(true);
    });

    it("rejects number input", () => {
      const r = validateLetterBody(123 as unknown as string);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("body_empty");
    });

    it("rejects object input (typeof !== string)", () => {
      const r = validateLetterBody({} as unknown as string);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("body_empty");
    });

    it("rejects boolean input", () => {
      const r = validateLetterBody(true as unknown as string);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("body_empty");
    });

    it("rejects array input", () => {
      const r = validateLetterBody([] as unknown as string);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("body_empty");
    });
  });

  describe("LetterSubmission shape (edges)", () => {
    it("LetterLocale union is ko or en", () => {
      const ko: LetterLocale = "ko";
      const en: LetterLocale = "en";
      expect(ko).toBe("ko");
      expect(en).toBe("en");
    });

    it("empty userId still compiles (domain does not validate userId)", () => {
      const s: LetterSubmission = { body: "hi", locale: "ko", userId: "" };
      expect(s.userId).toBe("");
    });
  });

  describe("LetterWithReply shape (edges)", () => {
    it("reply empty string is distinct from null", () => {
      const withEmpty: LetterWithReply = {
        id: "l1",
        body: "text",
        reply: "",
        locale: "en",
        createdAt: "2026-01-01T00:00:00Z",
      };
      expect(withEmpty.reply).toBe("");
      expect(withEmpty.reply).not.toBeNull();
    });

    it("createdAt can be any ISO string", () => {
      const l: LetterWithReply = {
        id: "l2",
        body: "x",
        reply: null,
        locale: "ko",
        createdAt: "2020-12-31T23:59:59.999Z",
      };
      expect(l.createdAt).toContain("2020");
    });
  });
});
