import { describe, it, expect, vi } from "vitest";
import { completeHealingAwakeningAct, getHealingAwakeningProgress } from "./completeAwakeningAct";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockSupabase(chain: {
  selectRows?: { act_id: number }[];
  selectError?: { message: string };
  insertError?: { message: string };
}): SupabaseClient {
  const from = vi.fn((table: string) => {
    if (table !== "user_healing_awakening_acts") throw new Error("unexpected table");
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
        Promise.resolve({
          data: null,
          error: chain.insertError ?? null,
        }),
    };
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
