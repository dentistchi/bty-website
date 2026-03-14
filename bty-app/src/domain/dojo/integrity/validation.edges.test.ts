/**
 * domain/dojo/integrity/validation — 경계 테스트.
 * validation.test.ts와 중복 없이 타입·경계만.
 */
import { describe, it, expect } from "vitest";
import { validateIntegrityResponse } from "./validation";
import { INTEGRITY_MAX_TEXT_LENGTH } from "./types";

describe("validateIntegrityResponse (edges)", () => {
  it("non-string text with null choiceId returns missing_input", () => {
    const r = validateIntegrityResponse(123 as unknown as string, null);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("missing_input");
  });

  it("null text with non-string choiceId returns missing_input", () => {
    const r = validateIntegrityResponse(null, 0 as unknown as string);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("missing_input");
  });

  it("empty string choiceId with non-empty text returns ok", () => {
    const r = validateIntegrityResponse("valid", "");
    expect(r.ok).toBe(true);
  });

  it("whitespace-only text with valid choiceId returns ok", () => {
    const r = validateIntegrityResponse("   ", "choice-1");
    expect(r.ok).toBe(true);
  });

  it("whitespace-only text only (no choiceId) returns missing_input", () => {
    const r = validateIntegrityResponse("  \t\n  ");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("missing_input");
  });

  it("empty string text with valid choiceId returns ok", () => {
    const r = validateIntegrityResponse("", "choice-1");
    expect(r.ok).toBe(true);
  });

  it("text at exactly INTEGRITY_MAX_TEXT_LENGTH with choiceId returns ok", () => {
    const r = validateIntegrityResponse("a".repeat(INTEGRITY_MAX_TEXT_LENGTH), "choice-1");
    expect(r.ok).toBe(true);
  });

  it("text only at exactly INTEGRITY_MAX_TEXT_LENGTH (no choiceId) returns ok", () => {
    const r = validateIntegrityResponse("x".repeat(INTEGRITY_MAX_TEXT_LENGTH));
    expect(r.ok).toBe(true);
  });

  it("text one char over INTEGRITY_MAX_TEXT_LENGTH returns text_too_long", () => {
    const r = validateIntegrityResponse("a".repeat(INTEGRITY_MAX_TEXT_LENGTH + 1));
    expect(r.ok).toBe(false);
    expect(r.error).toBe("text_too_long");
  });

  it("whitespace-only choiceId only (no text) returns ok", () => {
    const r = validateIntegrityResponse(undefined, "  ");
    expect(r.ok).toBe(true);
  });

  it("both text and choiceId empty string returns missing_input", () => {
    const r = validateIntegrityResponse("", "");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("missing_input");
  });
});
