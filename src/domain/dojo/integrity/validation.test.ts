/**
 * domain/dojo/integrity/validation — Center/Foundry 미커버 경계 테스트.
 */
import { describe, it, expect } from "vitest";
import { validateIntegrityResponse } from "./validation";
import { INTEGRITY_MAX_TEXT_LENGTH } from "./types";

describe("validateIntegrityResponse", () => {
  it("returns missing_input when both text and choiceId empty", () => {
    expect(validateIntegrityResponse()).toEqual({ ok: false, error: "missing_input" });
    expect(validateIntegrityResponse("")).toEqual({ ok: false, error: "missing_input" });
    expect(validateIntegrityResponse("   ")).toEqual({ ok: false, error: "missing_input" });
    expect(validateIntegrityResponse(null, null)).toEqual({ ok: false, error: "missing_input" });
    expect(validateIntegrityResponse(undefined, "")).toEqual({ ok: false, error: "missing_input" });
  });

  it("returns ok when text is non-empty after trim", () => {
    expect(validateIntegrityResponse("한 줄")).toEqual({ ok: true });
    expect(validateIntegrityResponse("  x  ")).toEqual({ ok: true });
  });

  it("returns ok when choiceId is non-empty", () => {
    expect(validateIntegrityResponse(undefined, "A")).toEqual({ ok: true });
    expect(validateIntegrityResponse(null, "choice-1")).toEqual({ ok: true });
  });

  it("returns text_too_long when text exceeds INTEGRITY_MAX_TEXT_LENGTH", () => {
    const long = "a".repeat(INTEGRITY_MAX_TEXT_LENGTH + 1);
    expect(validateIntegrityResponse(long)).toEqual({ ok: false, error: "text_too_long" });
  });

  it("returns ok when text length equals INTEGRITY_MAX_TEXT_LENGTH", () => {
    const exact = "a".repeat(INTEGRITY_MAX_TEXT_LENGTH);
    expect(validateIntegrityResponse(exact)).toEqual({ ok: true });
  });
});
