/**
 * Integrity(역지사지) 도메인 단위 테스트.
 * validateIntegrityResponse + type shape 검증 + 경계 테스트.
 */
import { describe, it, expect } from "vitest";
import {
  validateIntegrityResponse,
  type IntegrityScenario,
  type IntegritySubmission,
  type IntegritySubmitPayload,
} from "./integrity";

/** Canonical max length; may be exported from integrity/types. */
const INTEGRITY_MAX = 5_000;

describe("domain/dojo/integrity", () => {
  describe("validateIntegrityResponse", () => {
    it("rejects when both text and choiceId are missing", () => {
      const r = validateIntegrityResponse(null, null);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("missing_input");
    });

    it("rejects when both are undefined", () => {
      const r = validateIntegrityResponse(undefined, undefined);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("missing_input");
    });

    it("rejects whitespace-only text with no choiceId", () => {
      const r = validateIntegrityResponse("   \t\n  ", null);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("missing_input");
    });

    it("rejects empty string text with no choiceId", () => {
      const r = validateIntegrityResponse("", "");
      expect(r.ok).toBe(false);
      expect(r.error).toBe("missing_input");
    });

    it("accepts valid text alone", () => {
      const r = validateIntegrityResponse("환자의 입장에서 생각해 보았습니다.", null);
      expect(r.ok).toBe(true);
    });

    it("accepts valid choiceId alone", () => {
      const r = validateIntegrityResponse(null, "choice_A");
      expect(r.ok).toBe(true);
    });

    it("accepts both text and choiceId", () => {
      const r = validateIntegrityResponse("Some thought.", "choice_B");
      expect(r.ok).toBe(true);
    });

    it("rejects text exceeding 5000 characters", () => {
      const long = "a".repeat(5001);
      const r = validateIntegrityResponse(long, null);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("text_too_long");
    });

    it("accepts text exactly 5000 characters", () => {
      const exact = "b".repeat(5000);
      const r = validateIntegrityResponse(exact, null);
      expect(r.ok).toBe(true);
    });

    it("accepts text at 4999 characters", () => {
      const r = validateIntegrityResponse("c".repeat(4999), null);
      expect(r.ok).toBe(true);
    });

    it("allows long text if choiceId is also provided (still rejects)", () => {
      const r = validateIntegrityResponse("d".repeat(5001), "choice_A");
      expect(r.ok).toBe(false);
      expect(r.error).toBe("text_too_long");
    });

    it("accepts choiceId when text is over limit but null", () => {
      const r = validateIntegrityResponse(null, "choice_C");
      expect(r.ok).toBe(true);
    });
  });

  describe("IntegrityScenario type", () => {
    it("has id, situationKo, situationEn, choices", () => {
      const s: IntegrityScenario = {
        id: "integrity_001",
        situationKo: "환자가 치료를 거부합니다.",
        situationEn: "The patient refuses treatment.",
        choices: [
          { id: "A", labelKo: "설득한다", labelEn: "Persuade them" },
          { id: "B", labelKo: "이유를 묻는다", labelEn: "Ask why" },
        ],
      };
      expect(s.id).toBe("integrity_001");
      expect(s.choices).toHaveLength(2);
      expect(s.choices[0].labelKo).toBe("설득한다");
    });
  });

  describe("IntegritySubmission type", () => {
    it("has userId, scenarioId, text, choiceId, createdAt", () => {
      const sub: IntegritySubmission = {
        userId: "u1",
        scenarioId: "integrity_001",
        text: "My reflection",
        choiceId: "A",
        createdAt: "2026-03-09T00:00:00Z",
      };
      expect(sub.userId).toBe("u1");
      expect(sub.scenarioId).toBe("integrity_001");
      expect(sub.text).toBe("My reflection");
      expect(sub.choiceId).toBe("A");
    });

    it("text and choiceId are optional", () => {
      const sub: IntegritySubmission = {
        userId: "u2",
        scenarioId: "integrity_002",
        createdAt: "2026-03-09T12:00:00Z",
      };
      expect(sub.text).toBeUndefined();
      expect(sub.choiceId).toBeUndefined();
    });
  });

  describe("validateIntegrityResponse boundary", () => {
    it("return shape: ok boolean, error optional string", () => {
      const ok = validateIntegrityResponse("a");
      expect(typeof ok.ok).toBe("boolean");
      expect(ok.ok).toBe(true);
      expect(ok.error).toBeUndefined();

      const fail = validateIntegrityResponse(null, null);
      expect(typeof fail.ok).toBe("boolean");
      expect(fail.ok).toBe(false);
      expect(typeof fail.error).toBe("string");
      expect(fail.error).toBe("missing_input");
    });

    it("rejects empty string choiceId (no text)", () => {
      const r = validateIntegrityResponse(null, "");
      expect(r.ok).toBe(false);
      expect(r.error).toBe("missing_input");
    });

    it("accepts single character text", () => {
      expect(validateIntegrityResponse("x", null).ok).toBe(true);
    });

    it("accepts text at max length boundary", () => {
      expect(validateIntegrityResponse("a".repeat(INTEGRITY_MAX), null).ok).toBe(true);
    });

    it("rejects text one over max length", () => {
      const r = validateIntegrityResponse("a".repeat(INTEGRITY_MAX + 1), null);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("text_too_long");
    });

    it("error is only missing_input or text_too_long when not ok", () => {
      const errors = new Set<string>();
      [
        validateIntegrityResponse(null, null),
        validateIntegrityResponse("", null),
        validateIntegrityResponse("  ", null),
        validateIntegrityResponse("x".repeat(INTEGRITY_MAX + 1), null),
      ].forEach((r) => {
        if (!r.ok && r.error) errors.add(r.error);
      });
      expect(errors).toContain("missing_input");
      expect(errors).toContain("text_too_long");
      expect(errors.size).toBe(2);
    });
  });

  describe("IntegritySubmitPayload boundary", () => {
    it("payload with text only passes validateIntegrityResponse", () => {
      const payload: IntegritySubmitPayload = { text: "한 줄 반성" };
      const r = validateIntegrityResponse(payload.text, payload.choiceId);
      expect(r.ok).toBe(true);
    });

    it("payload with choiceId only passes validateIntegrityResponse", () => {
      const payload: IntegritySubmitPayload = { choiceId: "choice_A" };
      const r = validateIntegrityResponse(payload.text, payload.choiceId);
      expect(r.ok).toBe(true);
    });

    it("payload with both passes validateIntegrityResponse", () => {
      const payload: IntegritySubmitPayload = { text: "Note", choiceId: "B" };
      const r = validateIntegrityResponse(payload.text, payload.choiceId);
      expect(r.ok).toBe(true);
    });

    it("payload with empty text and no choiceId fails", () => {
      const payload: IntegritySubmitPayload = { text: "", choiceId: null };
      const r = validateIntegrityResponse(payload.text, payload.choiceId);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("missing_input");
    });

    it("payload with null text and empty choiceId fails", () => {
      const payload: IntegritySubmitPayload = { text: null, choiceId: "" };
      const r = validateIntegrityResponse(payload.text, payload.choiceId);
      expect(r.ok).toBe(false);
    });

    it("payload with text over max fails", () => {
      const payload: IntegritySubmitPayload = { text: "x".repeat(INTEGRITY_MAX + 1), choiceId: null };
      const r = validateIntegrityResponse(payload.text, payload.choiceId);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("text_too_long");
    });
  });
});
