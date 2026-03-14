/**
 * integritySubmitService — Foundry 미커버 경계 테스트.
 * validate 실패·성공(insert id / null) 경로.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitIntegrity } from "./integritySubmitService";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockSupabase(insertResult: { data: { id: string } | null; error: Error | null }) {
  return {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(insertResult),
  } as unknown as SupabaseClient;
}

describe("submitIntegrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok: false when payload missing text and choiceId", async () => {
    const supabase = mockSupabase({ data: null, error: null });
    const result = await submitIntegrity(supabase, "u1", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("missing_input");
  });

  it("returns ok: false when text is whitespace only", async () => {
    const supabase = mockSupabase({ data: null, error: null });
    const result = await submitIntegrity(supabase, "u1", { text: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("missing_input");
  });

  it("returns ok: true and submissionId when insert succeeds", async () => {
    const supabase = mockSupabase({ data: { id: "sub-123" }, error: null });
    const result = await submitIntegrity(supabase, "u1", { text: "한 줄 반성" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.submissionId).toBe("sub-123");
    }
  });

  it("returns ok: true and submissionId null when insert fails", async () => {
    const supabase = mockSupabase({ data: null, error: new Error("db error") });
    const result = await submitIntegrity(supabase, "u1", { choiceId: "A" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.submissionId).toBeNull();
    }
  });

});
