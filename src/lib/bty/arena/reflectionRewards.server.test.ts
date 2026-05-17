/**
 * Re-exposure reflection rewards — `result_origin` gating (Route B governance).
 *
 * Proves: an `insufficient_signal` (fallback collapse) result grants no validation XP
 * and is logged as NOT verified; a `computed` band keeps its existing reward profile;
 * and (§5.3) the le_activation_log row preserves `result_origin` so a fallback
 * activation is distinguishable from a genuine computed micro_win.
 */
import { describe, it, expect, vi } from "vitest";
import { applyReexposureOutcomeReflection } from "./reflectionRewards.server";

vi.mock("@/lib/bty/arena/applyCoreXp", () => ({
  applyDirectCoreXp: vi.fn(async () => ({ ok: true })),
}));

type Captures = Record<string, Record<string, unknown>[]>;

function makeSupabase(): { supabase: unknown; captures: Captures } {
  const captures: Captures = {};
  const supabase = {
    from(table: string) {
      const api: Record<string, unknown> = {
        select: () => api,
        eq: () => api,
        is: () => api,
        maybeSingle: async () => ({ data: null, error: null }),
        insert: (payload: Record<string, unknown>) => {
          (captures[table] ??= []).push(payload);
          return {
            select: () => ({
              single: async () => ({
                data: { activation_id: "act-1" },
                error: null,
              }),
            }),
            then: (res: (v: { error: null }) => unknown, rej?: (e: unknown) => unknown) =>
              Promise.resolve({ error: null }).then(res, rej),
          };
        },
      };
      return api;
    },
  };
  return { supabase, captures };
}

describe("applyReexposureOutcomeReflection — result_origin gating", () => {
  it("insufficient_signal: no validation XP, verified=false", async () => {
    const { supabase, captures } = makeSupabase();
    const result = await applyReexposureOutcomeReflection({
      supabase: supabase as never,
      userId: "u1",
      runId: "run-1",
      scenarioId: "core_01",
      validationResult: "unstable",
      resultOrigin: "insufficient_signal",
    });
    expect(result).toMatchObject({ ok: true, coreXp: 0, weeklyXp: 0 });
    // weeklyXp 0 → upsert skipped entirely (weekly_xp table never touched)
    expect(captures.weekly_xp).toBeUndefined();
    // the validation event is still logged, but not as verified evidence
    expect(captures.le_verification_log?.[0]?.verified).toBe(false);
    expect(captures.arena_events?.[0]?.xp).toBe(0);
    // §5.3: the activation row preserves result_origin (no representation collapse)
    expect(captures.le_activation_log?.[0]?.result_origin).toBe("insufficient_signal");
  });

  it("computed unstable: keeps reward profile (5 core / 3 weekly, verified)", async () => {
    const { supabase, captures } = makeSupabase();
    const result = await applyReexposureOutcomeReflection({
      supabase: supabase as never,
      userId: "u1",
      runId: "run-1",
      scenarioId: "core_01",
      validationResult: "unstable",
      resultOrigin: "computed",
    });
    expect(result).toMatchObject({ ok: true, coreXp: 5, weeklyXp: 3 });
    expect(captures.le_verification_log?.[0]?.verified).toBe(true);
    expect(captures.arena_events?.[0]?.xp).toBe(3);
    // §5.3: a computed activation is tagged distinctly from a fallback
    expect(captures.le_activation_log?.[0]?.result_origin).toBe("computed");
  });
});
