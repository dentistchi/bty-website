/**
 * assessmentService — submitAssessment, getAssessmentHistory 단위 테스트.
 * Mocked Supabase. Real scoreAnswers / detectPattern.
 */
import { describe, it, expect } from "vitest";
import { submitAssessment, getAssessmentHistory } from "./assessmentService";
import type { SupabaseClient } from "@supabase/supabase-js";

type InsertResult = { data: unknown; error: { message: string } | null };
type SelectResult = { data: unknown[]; error: { message: string } | null };

function mockSupabase(opts: {
  insertResult?: InsertResult;
  selectResult?: SelectResult;
}): SupabaseClient {
  const { insertResult, selectResult } = opts;
  const chain: Record<string, unknown> = {
    from: () => chain,
    insert: () => chain,
    select: () => chain,
    single: () =>
      Promise.resolve(insertResult ?? { data: { id: "sub-1" }, error: null }),
    eq: () => chain,
    order: () => chain,
    limit: () =>
      Promise.resolve(selectResult ?? { data: [], error: null }),
  };
  return chain as unknown as SupabaseClient;
}

function makeQuestions() {
  const dims = ["core", "compassion", "stability", "growth", "social"] as const;
  return dims.flatMap((dim, di) =>
    Array.from({ length: 10 }, (_, i) => ({
      id: di * 10 + i + 1,
      dimension: dim as string,
      text: `q${di * 10 + i + 1}`,
      reverse: false,
    }))
  );
}

function makeAnswers(value: number) {
  const out: Record<number, number> = {};
  for (let i = 1; i <= 50; i++) out[i] = value;
  return out;
}

describe("assessmentService", () => {
  const questions = makeQuestions();

  describe("submitAssessment", () => {
    it("rejects empty answers", async () => {
      const sb = mockSupabase({});
      const r = await submitAssessment(sb, { userId: "u1", answers: {}, questions });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("answers");
    });

    it("rejects partial answers (< 50)", async () => {
      const sb = mockSupabase({});
      const partial: Record<number, number> = {};
      for (let i = 1; i <= 30; i++) partial[i] = 3;
      const r = await submitAssessment(sb, { userId: "u1", answers: partial, questions });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("answers");
    });

    it("filters out-of-range values (0, 6) so count fails", async () => {
      const sb = mockSupabase({});
      const bad = makeAnswers(3);
      bad[1] = 0;
      bad[2] = 6;
      const r = await submitAssessment(sb, { userId: "u1", answers: bad, questions });
      expect(r.ok).toBe(false);
    });

    it("returns scores, pattern, track for all-3 answers", async () => {
      const sb = mockSupabase({ insertResult: { data: { id: "sub-99" }, error: null } });
      const r = await submitAssessment(sb, {
        userId: "u1",
        answers: makeAnswers(3),
        questions,
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.submissionId).toBe("sub-99");
        expect(r.scores.core).toBe(50);
        expect(r.scores.compassion).toBe(50);
        expect(r.pattern).toBe("balanced");
        expect(r.track).toBe("Core Confidence");
      }
    });

    it("accepts string-keyed answers (from JSON parse)", async () => {
      const sb = mockSupabase({});
      const strKeys: Record<string, number> = {};
      for (let i = 1; i <= 50; i++) strKeys[String(i)] = 4;
      const r = await submitAssessment(sb, {
        userId: "u1",
        answers: strKeys,
        questions,
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.scores.core).toBe(75);
      }
    });

    it("still returns scores when DB insert fails", async () => {
      const sb = mockSupabase({
        insertResult: { data: null, error: { message: "db fail" } },
      });
      const r = await submitAssessment(sb, {
        userId: "u1",
        answers: makeAnswers(3),
        questions,
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.submissionId).toBeNull();
        expect(r.scores.core).toBe(50);
      }
    });
  });

  describe("getAssessmentHistory", () => {
    it("returns empty array when no data", async () => {
      const sb = mockSupabase({ selectResult: { data: [], error: null } });
      const r = await getAssessmentHistory(sb, "u1");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.submissions).toEqual([]);
    });

    it("maps DB rows to AssessmentHistory", async () => {
      const sb = mockSupabase({
        selectResult: {
          data: [
            {
              id: "s1",
              scores_json: { core: 80, compassion: 60, stability: 70, growth: 90, social: 50 },
              pattern_key: "balanced",
              recommended_track: "Core Confidence",
              created_at: "2026-03-08T10:00:00Z",
            },
          ],
          error: null,
        },
      });
      const r = await getAssessmentHistory(sb, "u1");
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.submissions).toHaveLength(1);
        expect(r.submissions[0]).toMatchObject({
          id: "s1",
          scores: { core: 80, compassion: 60 },
          pattern: "balanced",
          track: "Core Confidence",
          createdAt: "2026-03-08T10:00:00Z",
        });
      }
    });

    it("returns error when DB fails", async () => {
      const sb = mockSupabase({
        selectResult: { data: [], error: { message: "timeout" } },
      });
      const r = await getAssessmentHistory(sb, "u1");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("timeout");
    });
  });
});
