/**
 * dojoSubmitService — Foundry 미커버 경계 테스트.
 * validate 실패·성공(insert id / null)·scores/summaryKey 반환.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitDojo50 } from "./dojoSubmitService";
import type { SupabaseClient } from "@supabase/supabase-js";

function makeAnswers(): Record<number, number> {
  const out: Record<number, number> = {};
  for (let q = 1; q <= 50; q++) out[q] = 3;
  return out;
}

function mockSupabase(insertResult: { data: { id: string } | null; error: Error | null }) {
  return {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(insertResult),
  } as unknown as SupabaseClient;
}

describe("submitDojo50", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok: false when answers count is not 50", async () => {
    const supabase = mockSupabase({ data: null, error: null });
    const result = await submitDojo50(supabase, "u1", { 1: 3 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("answers_count");
  });

  it("returns ok: false when answer value out of range", async () => {
    const answers = makeAnswers();
    answers[25] = 0;
    const supabase = mockSupabase({ data: null, error: null });
    const result = await submitDojo50(supabase, "u1", answers);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_range");
  });

  it("returns ok: true with submissionId, scores, summaryKey when insert succeeds", async () => {
    const supabase = mockSupabase({ data: { id: "sub-xyz" }, error: null });
    const result = await submitDojo50(supabase, "u1", makeAnswers());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.submissionId).toBe("sub-xyz");
      expect(result.scores).toBeDefined();
      expect(Object.keys(result.scores)).toHaveLength(5);
      expect(["high", "mid", "low"]).toContain(result.summaryKey);
    }
  });

  it("returns ok: true with submissionId null when insert fails", async () => {
    const supabase = mockSupabase({ data: null, error: new Error("db error") });
    const result = await submitDojo50(supabase, "u1", makeAnswers());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.submissionId).toBeNull();
      expect(result.scores).toBeDefined();
      expect(result.summaryKey).toBeDefined();
    }
  });
});
