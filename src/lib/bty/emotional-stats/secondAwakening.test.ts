/**
 * Unit tests for Second Awakening.
 * 결정3 / B2: eligibility = train 완주 (distinct completed day count == 28).
 * Uses mocked Supabase; no business/XP logic change.
 */
import { describe, it, expect } from "vitest";
import { getSecondAwakening } from "./secondAwakening";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mock builder. `trainDays` drives the new train-based eligibility gate;
 * `sessions` / `firstSessionDaysAgo` only feed the (display-only) userDay /
 * sessionCount fields. `milestoneCompleted` sets the completed flag.
 */
function mockSupabase(opts: {
  trainDays?: number[];
  sessions?: number;
  firstSessionDaysAgo?: number | null;
  milestoneCompleted?: boolean;
}): SupabaseClient {
  const trainDays = opts.trainDays ?? [];
  const sessions = opts.sessions ?? 0;
  const firstStartedAt =
    opts.firstSessionDaysAgo != null
      ? new Date(Date.now() - opts.firstSessionDaysAgo * 24 * 60 * 60 * 1000).toISOString()
      : null;

  let emotionalCall = 0;
  const from = (table: string) => {
    if (table === "emotional_sessions") {
      // first call = earliest started_at (maybeSingle); second = count head
      if (emotionalCall++ === 0) {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: firstStartedAt ? { started_at: firstStartedAt } : null,
                    }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: (_c: string, _o?: { count?: string; head?: boolean }) => ({
          eq: () => Promise.resolve({ data: null, count: sessions, error: null }),
        }),
      };
    }
    if (table === "train_day_completions") {
      return {
        select: () => ({
          eq: () =>
            Promise.resolve({ data: trainDays.map((d) => ({ day: d })), error: null }),
        }),
      };
    }
    if (table === "user_healing_milestones") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: opts.milestoneCompleted
                  ? { second_awakening_completed_at: new Date().toISOString() }
                  : null,
              }),
          }),
        }),
      };
    }
    if (table === "user_emotional_stats" || table === "emotional_events") {
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
    }
    if (table === "user_advanced_unlocks") {
      return { upsert: () => Promise.resolve({ error: null }) };
    }
    throw new Error("unexpected table: " + table);
  };
  return { from } as unknown as SupabaseClient;
}

describe("secondAwakening", () => {
  describe("getSecondAwakening — train 28 distinct-day eligibility (결정3/B2)", () => {
    it("not eligible when no train completions and no milestone", async () => {
      const result = await getSecondAwakening(mockSupabase({ trainDays: [] }), "user-1");
      expect(result.eligible).toBe(false);
      expect(result.completed).toBe(false);
    });

    it("eligible when all 28 distinct train days complete ([1..28])", async () => {
      const days = Array.from({ length: 28 }, (_, i) => i + 1);
      const result = await getSecondAwakening(mockSupabase({ trainDays: days }), "user-1");
      expect(result.eligible).toBe(true);
    });

    it("NOT eligible for [1,2,28] — distinct count is 3, not 28 (no max(day) shortcut)", async () => {
      const result = await getSecondAwakening(mockSupabase({ trainDays: [1, 2, 28] }), "user-1");
      expect(result.eligible).toBe(false);
    });

    it("NOT eligible for [1..27] — distinct count 27", async () => {
      const days = Array.from({ length: 27 }, (_, i) => i + 1);
      const result = await getSecondAwakening(mockSupabase({ trainDays: days }), "user-1");
      expect(result.eligible).toBe(false);
    });

    it("not eligible once already completed, even with 28 train days", async () => {
      const days = Array.from({ length: 28 }, (_, i) => i + 1);
      const result = await getSecondAwakening(
        mockSupabase({ trainDays: days, milestoneCompleted: true }),
        "user-1"
      );
      expect(result.eligible).toBe(false);
      expect(result.completed).toBe(true);
    });
  });
});
