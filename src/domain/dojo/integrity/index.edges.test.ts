/**
 * domain/dojo/integrity/index — re-export 경계 테스트.
 * index.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import { INTEGRITY_MAX_TEXT_LENGTH, validateIntegrityResponse } from "./index";

describe("domain/dojo/integrity/index (edges)", () => {
  it("INTEGRITY_MAX_TEXT_LENGTH is 5000", () => {
    expect(INTEGRITY_MAX_TEXT_LENGTH).toBe(5_000);
  });

  it("validateIntegrityResponse via index: text at max length returns ok", () => {
    const r = validateIntegrityResponse("a".repeat(INTEGRITY_MAX_TEXT_LENGTH), null);
    expect(r.ok).toBe(true);
  });

  it("validateIntegrityResponse via index: text one over max returns text_too_long", () => {
    const r = validateIntegrityResponse("a".repeat(INTEGRITY_MAX_TEXT_LENGTH + 1), null);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("text_too_long");
  });

  it("validateIntegrityResponse via index: empty text with choiceId returns ok", () => {
    const r = validateIntegrityResponse("", "choice-1");
    expect(r.ok).toBe(true);
  });

  it("validateIntegrityResponse via index: both text and choiceId null returns missing_input", () => {
    const r = validateIntegrityResponse(null, null);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("missing_input");
  });
});
