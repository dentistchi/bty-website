import { describe, it, expect, vi } from "vitest";
import { completeHealingAwakeningAct, getHealingAwakeningProgress } from "./completeAwakeningAct";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockSupabase(chain: {
  selectRows?: { act_id: number }[];
  selectError?: { message: string };
  insertError?: { message: string };
  /** Second Awakening gate inputs (getSecondAwakening). Default: eligible. */
  eligible?: boolean;
}): SupabaseClient {
  const eligible = chain.eligible ?? true;
  const firstStartedAt = eligible
    ? new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const sessionCount = eligible ? 12 : 0;

  const from = vi.fn((table: string) => {
    if (table === "user_healing_awakening_acts") {
      return {
        select: () => ({
          eq: () => ({
            order: () =>
              Promise.resolve({
                data: chain.selectRows ?? [],
                error: chain.selectError ?? null,
              }),
          }),
        }),
        insert: () =>
          Promise.resolve({ data: null, error: chain.insertError ?? null }),
      };
    }
    // getSecondAwakening reads below (eligibility gate). All read-only.
    if (table === "emotional_sessions") {
      return {
        select: (_cols: string, opts?: { count?: string; head?: boolean }) =>
          opts?.count
            ? { eq: () => Promise.resolve({ count: sessionCount, error: null }) }
            : {
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: () =>
                        Promise.resolve({
                          data: firstStartedAt ? { started_at: firstStartedAt } : null,
                          error: null,
                        }),
                    }),
                  }),
                }),
              },
      };
    }
    if (table === "user_healing_milestones") {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
        }),
      };
    }
    if (table === "user_emotional_stats" || table === "emotional_events") {
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
    }
    throw new Error("unexpected table: " + table);
  });
  return { from } as unknown as SupabaseClient;
}

describe("completeHealingAwakeningAct", () => {
  it("400 INVALID_ACT_ID", async () => {
    const r = await completeHealingAwakeningAct(mockSupabase({}), "u1", 9);
    expect(r).toEqual({ status: 400, error: "INVALID_ACT_ID" });
  });

  it("409 when act already done", async () => {
    const r = await completeHealingAwakeningAct(
      mockSupabase({ selectRows: [{ act_id: 1 }] }),
      "u1",
      1
    );
    expect(r).toEqual({ status: 409, error: "ACT_ALREADY_COMPLETED" });
  });

  it("400 ACT_PREREQUISITE for act 2 without 1", async () => {
    const r = await completeHealingAwakeningAct(mockSupabase({ selectRows: [] }), "u1", 2);
    expect(r).toEqual({ status: 400, error: "ACT_PREREQUISITE" });
  });

  it("200 after act 1", async () => {
    const r = await completeHealingAwakeningAct(mockSupabase({ selectRows: [] }), "u1", 1);
    expect(r).toMatchObject({ ok: true, completedActs: [1] });
  });

  it("403 NOT_ELIGIBLE when 30-day/10-session gate unmet", async () => {
    const r = await completeHealingAwakeningAct(
      mockSupabase({ selectRows: [], eligible: false }),
      "u1",
      1
    );
    expect(r).toEqual({ status: 403, error: "NOT_ELIGIBLE" });
  });
});

describe("getHealingAwakeningProgress", () => {
  it("empty → nextAct 1", async () => {
    const r = await getHealingAwakeningProgress(mockSupabase({ selectRows: [] }), "u1");
    expect(r).toEqual({ ok: true, completedActs: [], nextAct: 1 });
  });

  it("after 1 → next 2", async () => {
    const r = await getHealingAwakeningProgress(mockSupabase({ selectRows: [{ act_id: 1 }] }), "u1");
    expect(r).toEqual({ ok: true, completedActs: [1], nextAct: 2 });
  });
});
