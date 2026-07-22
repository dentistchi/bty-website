import { describe, it, expect } from "vitest";
import { resolveSharedResponse, validateSharedQuestionOptional } from "./foundry-training";

/**
 * Slice 3.1B-3G — the Shared Understanding gate. When a module has a shared question, a non-empty
 * valid response is REQUIRED; when it has none, no shared response is stored (existing behavior).
 * response_text (private Reflection) is validated by a separate function and is never touched here.
 */
describe("resolveSharedResponse (completion gate)", () => {
  it("no shared question → value null regardless of input (existing behavior preserved)", () => {
    expect(resolveSharedResponse(null, "anything")).toEqual({ ok: true, value: null });
    expect(resolveSharedResponse(undefined, "anything")).toEqual({ ok: true, value: null });
    expect(resolveSharedResponse("   ", "anything")).toEqual({ ok: true, value: null });
    expect(resolveSharedResponse(null, undefined)).toEqual({ ok: true, value: null });
  });

  it("shared question configured → a non-empty answer is REQUIRED", () => {
    expect(resolveSharedResponse("Explain the standard", "")).toEqual({ ok: false, reason: "shared_response_required" });
    expect(resolveSharedResponse("Explain the standard", "   ")).toEqual({ ok: false, reason: "shared_response_required" });
    expect(resolveSharedResponse("Explain the standard", undefined)).toEqual({ ok: false, reason: "shared_response_required" });
    expect(resolveSharedResponse("Explain the standard", null)).toEqual({ ok: false, reason: "shared_response_required" });
  });

  it("shared question configured + valid answer → returns the cleaned value", () => {
    expect(resolveSharedResponse("Explain the standard", "Wear PPE before every procedure.")).toEqual({
      ok: true,
      value: "Wear PPE before every procedure.",
    });
  });

  it("rejects an over-long shared answer", () => {
    const long = "x".repeat(1001);
    const r = resolveSharedResponse("Q", long);
    expect(r.ok).toBe(false);
  });
});

describe("validateSharedQuestionOptional (Builder → content)", () => {
  it("null/blank → value null (no shared question)", () => {
    expect(validateSharedQuestionOptional(null)).toEqual({ ok: true, value: null });
    expect(validateSharedQuestionOptional("   ")).toEqual({ ok: true, value: null });
    expect(validateSharedQuestionOptional(undefined)).toEqual({ ok: true, value: null });
  });
  it("a present question is kept (trimmed); over-long is rejected", () => {
    expect(validateSharedQuestionOptional("  Describe the key behavior standard  ")).toEqual({
      ok: true,
      value: "Describe the key behavior standard",
    });
    expect(validateSharedQuestionOptional("x".repeat(301)).ok).toBe(false);
  });
});
