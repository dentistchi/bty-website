import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  owned: true,
  runType: "beginner",
  status: "IN_PROGRESS",
  selects: [] as { table: string; columns: string }[],
  effects: [] as string[],
}));

vi.mock("@/lib/legal/activeConsent", () => ({
  isConsentCurrent: async () => true,
  consentRequiredResponse: () => Response.json({}, { status: 403 }),
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => {
    state.effects.push("get_private_writer");
    return { rpc: async () => { state.effects.push("private_rpc"); return { error: null }; } };
  },
}));
vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    rpc: async () => { state.effects.push("user_rpc"); return { error: null }; },
    from: (table: string) => {
      const result = () => ({
        data: table === "arena_runs"
          ? state.owned ? { run_id: "run1", user_id: "owner", run_type: state.runType,
            status: state.status, scenario_id: "senior_staff_resists_new_protocol_033", meta: {} } : null
          : [],
        count: 0,
        error: null,
      });
      const q: Record<string, unknown> = {};
      for (const method of ["eq", "is", "in", "gte", "limit", "order"]) q[method] = () => q;
      q.select = (columns: string) => { state.selects.push({ table, columns }); return q; };
      q.update = () => { state.effects.push(`update:${table}`); return q; };
      q.insert = () => { state.effects.push(`insert:${table}`); return q; };
      q.maybeSingle = async () => result();
      q.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
      return q;
    },
  }),
}));
vi.mock("@/lib/bty/arena/applyCoreXp", () => ({
  applySeasonalXpToCore: async () => { state.effects.push("seasonal_core"); return { coreGain: 0, newCoreTotal: 0 }; },
}));
vi.mock("@/lib/bty/action-contract/ensureActionContractForArenaRun", () => ({
  ensureActionContractForArenaRun: async () => { state.effects.push("contract"); return { ok: true, created: false, contractId: null }; },
}));
vi.mock("@/lib/bty/pattern-engine/syncPatternStates", () => ({
  syncPatternStatesForUser: async () => { state.effects.push("pattern_sync"); },
}));
vi.mock("@/lib/bty/pattern-engine/resolvePatternFamilyForContractTrigger", () => ({
  resolvePatternFamilyForContractTrigger: async () => null,
}));
vi.mock("@/lib/bty/arena/reflectionRewards.server", () => ({
  applyArenaRunRewardsOnVerifiedCompletion: async () => {
    state.effects.push("completion_reward");
    return { ok: true, applied: true, coreXp: 5, weeklyXp: 3, deltaApplied: 3 };
  },
}));
vi.mock("@/lib/bty/arena/arenaRuntimeSnapshot.server", () => ({
  snapshotForNextScenarioReady: () => ({}),
  arenaRouterSnapshotJsonFields: () => ({}),
}));

import { POST as complete } from "@/app/api/arena/run/complete/route";
import { POST as freeResponse } from "@/app/api/arena/free-response/route";

const request = (path: string) => new Request(`https://local.test${path}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ runId: "run1", scenarioId: "senior_staff_resists_new_protocol_033",
    responseText: "My own response", run_type: "scenario" }),
});

beforeEach(() => {
  state.owned = true;
  state.runType = "beginner";
  state.status = "IN_PROGRESS";
  state.selects.length = 0;
  state.effects.length = 0;
});

for (const [name, post, path] of [
  ["general completion", complete, "/api/arena/run/complete"],
  ["free response", freeResponse, "/api/arena/free-response"],
] as const) {
  describe(`${name} beginner reward boundary`, () => {
    for (const status of ["IN_PROGRESS", "DONE"]) {
      it(`rejects an owned ${status} beginner before mutation, using the stored run type`, async () => {
        state.status = status;
        const response = await post(request(path));
        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: "NOT_SCENARIO_RUN" });
        expect(state.effects).toEqual([]);
        expect(state.selects.find(item => item.table === "arena_runs")?.columns.split(",").map(v => v.trim()))
          .toContain("run_type");
      });
    }
    it("retains the existing foreign-run denial", async () => {
      state.owned = false;
      const response = await post(request(path));
      expect(response.status).toBe(404);
      expect(state.effects).toEqual([]);
    });
    it("preserves the existing scenario reward path", async () => {
      state.runType = "scenario";
      const response = await post(request(path));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true });
      expect(state.effects.length).toBeGreaterThan(0);
    });
  });
}
