import { describe, it, expect, vi } from "vitest";
import { completeHealingAwakeningAct, getHealingAwakeningProgress } from "./completeAwakeningAct";
import type { SupabaseClient } from "@supabase/supabase-js";

const atomic = vi.hoisted(() => ({ options: {} as {
  selectRows?: { act_id: number }[]; eligible?: boolean;
}, calls: [] as unknown[] }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({ rpc: async (fn: string, args: { p_user_id: string; p_act_id: number }) => {
  atomic.calls.push({ fn, args });
  const acts = (atomic.options.selectRows ?? []).map(row => row.act_id);
  const error = acts.includes(args.p_act_id) ? "ACT_ALREADY_COMPLETED" : acts.length !== args.p_act_id - 1 ? "ACT_PREREQUISITE"
    : atomic.options.eligible === false ? "NOT_ELIGIBLE" : null;
  return error ? { data: null, error: { code: "P0001", message: error } } : { error: null, data: {
    policyVersion: "healing-completion/v1", operation: "act", userId: args.p_user_id, actId: args.p_act_id,
    completedActs: [...acts, args.p_act_id], actCompletedAt: "2026-07-01T12:00:00Z",
    completedAt: args.p_act_id === 3 ? "2026-07-01T12:00:00Z" : null, idempotent: false,
  } };
} }) }));


function mockSupabase(chain: {
  selectRows?: { act_id: number }[];
  selectError?: { message: string };
  insertError?: { message: string };
  /** Second Awakening gate (getSecondAwakening) = train 완주, distinct day == 28. Default: eligible. */
  eligible?: boolean;
}): SupabaseClient {
  atomic.options = chain; atomic.calls.length = 0;
  const eligible = chain.eligible ?? true;
  // 결정3 / B2: eligibility driven by DISTINCT train_day_completions count == 28.
  const trainDays = eligible ? Array.from({ length: 28 }, (_, i) => i + 1) : [];
  // userDay / sessionCount are display-only now; keep plausible values.
  const firstStartedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const sessionCount = 12;

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
    if (table === "train_day_completions") {
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: trainDays.map((d) => ({ day: d })), error: null }),
        }),
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
    expect(atomic.calls).toEqual([{ fn: "bty_complete_healing_awakening_act", args: { p_user_id: "u1", p_act_id: 1 } }]);
  });

  it("403 NOT_ELIGIBLE when train 완주 gate unmet (distinct day < 28)", async () => {
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
