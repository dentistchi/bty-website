/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_CONSENT_VERSION } from "@/domain/legal/consent-document";

// Route orchestration oracle only: the separate PostgreSQL suite proves transactions.
// Original 10 controls / 2 failing replay probes are frozen in commit 655b984.
const state = vi.hoisted(() => ({
  userId: "00000000-0000-4000-8000-000000000001" as string | null,
  ownerId: "00000000-0000-4000-8000-000000000001",
  consentVersion: "2026-05-v1" as string | null,
  consentError: false, scenarioId: "patient_refuses_treatment_001",
  admin: true, adminReads: 0,
  rpcError: null as string | null, rpcCode: undefined as string | undefined, rpcThrows: false,
  ackOverride: null as { value: unknown } | null,
  receipt: null as Record<string, unknown> | null, receiptInput: null as string | null,
  rewardApplications: 0,
  userCalls: [] as { fn: string; args: unknown }[],
  serviceCalls: [] as { fn: string; args: Record<string, unknown> }[],
  reads: [] as string[],
  writes: [] as { table: string; operation: string; value: unknown }[],
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => {
    state.adminReads++;
    if (!state.admin) return null;
    return { rpc: async (fn: string, args: Record<string, unknown>) => {
      state.serviceCalls.push({ fn, args });
      if (state.rpcThrows) throw new Error("synthetic transport failure");
      if (state.rpcError) return { data: null, error: { message: state.rpcError, code: state.rpcCode } };
      if (state.ackOverride) return { data: state.ackOverride.value, error: null };
      if (fn !== "bty_record_legacy_choice_reward") return { data: null, error: null };
      const canonicalInput = JSON.stringify(args);
      if (state.receipt && state.receiptInput !== canonicalInput) return { data: null, error: { message: "REWARD_INPUT_CONFLICT" } };
      if (state.receipt) return { data: { ...state.receipt, replayed: true }, error: null };
      state.receiptInput = canonicalInput;
      state.receipt = {
        policyVersion: "legacy-xp-atomic/v1", kind: "legacy_choice",
        runId: args.p_run_id, scenarioId: args.p_scenario_id,
        receiptId: "00000000-0000-4000-8000-000000000010",
        eventId: "00000000-0000-4000-8000-000000000011", replayed: false,
        choiceId: args.p_choice_id, xp: args.p_xp, step: args.p_step,
      };
      state.rewardApplications++;
      return { data: { ...state.receipt }, error: null };
    } };
  },
}));

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.userId ? { id: state.userId } : null } }) },
    rpc: async (fn: string, args: unknown) => {
      state.userCalls.push({ fn, args }); return { data: null, error: null };
    },
    from: (table: string) => {
      state.reads.push(table);
      const filters: Record<string, unknown> = {};
      let mutation: { operation: string; value: unknown } | null = null;
      const result = () => {
        if (mutation) { state.writes.push({ table, ...mutation }); return { data: null, error: null }; }
        if (table === "arena_profiles") return { data: { consent_version: state.consentVersion }, error: state.consentError ? { message: "synthetic consent outage" } : null };
        if (table === "arena_runs") return { data: filters.user_id === state.ownerId ? { user_id: state.ownerId, scenario_id: state.scenarioId, reached_step_2_at: null } : null, error: null };
        return { data: null, error: null };
      };
      const q: any = {
        select: () => q,
        eq: (column: string, value: unknown) => { filters[column] = value; return q; },
        maybeSingle: async () => result(),
        update: (value: unknown) => { mutation = { operation: "update", value }; return q; },
        insert: async (value: unknown) => {
          state.writes.push({ table, operation: "insert", value }); return { data: null, error: null };
        },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return q;
    },
  }),
}));

import { POST } from "./route";

const USER = "00000000-0000-4000-8000-000000000001";
const RUN = "00000000-0000-4000-8000-000000000002";
const SCENARIO = "patient_refuses_treatment_001";
const VALID_ACK = {
  policyVersion: "legacy-xp-atomic/v1", kind: "legacy_choice", runId: RUN, scenarioId: SCENARIO,
  receiptId: "00000000-0000-4000-8000-000000000010", eventId: "00000000-0000-4000-8000-000000000011",
  replayed: false, choiceId: "B", xp: 82, step: 2,
};
const request = (extra: Record<string, unknown> = {}) => new Request("https://local.test/api/arena/event", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ runId: RUN, scenarioId: SCENARIO, step: 2,
    eventType: "CHOICE_CONFIRMED", choiceId: "B", xp: 99999999,
    deltas: { integrity: 99999999 }, userId: "forged-user", ...extra }),
});
const expectNoUserRewardMutation = () => {
  expect(state.userCalls).toEqual([]); expect(state.writes).toEqual([]);
};

beforeEach(() => {
  state.userId = USER; state.ownerId = USER; state.scenarioId = SCENARIO;
  state.consentVersion = ACTIVE_CONSENT_VERSION; state.consentError = false;
  state.admin = true; state.adminReads = 0; state.rpcError = null; state.rpcCode = undefined; state.rpcThrows = false;
  state.ackOverride = null; state.receipt = null; state.receiptInput = null; state.rewardApplications = 0;
  state.userCalls.length = 0; state.serviceCalls.length = 0; state.writes.length = 0; state.reads.length = 0;
});

describe("legacy choice atomic reward boundary", () => {
  it("ignores forged XP/deltas/actor and delegates event plus canonical 82 XP through one private RPC", async () => {
    const response = await POST(request()); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(state.serviceCalls).toEqual([{ fn: "bty_record_legacy_choice_reward", args: {
      p_user_id: USER, p_run_id: RUN, p_scenario_id: SCENARIO, p_choice_id: "B", p_step: 2,
      p_xp: 82, p_deltas: { integrity: 1, communication: 3, insight: 3, resilience: 1, gratitude: 2 }, p_meta: null,
    } }]);
    expectNoUserRewardMutation();
  });

  it("submits each identical retry to the atomic receipt RPC without independent event or XP writes", async () => {
    const first = await POST(request()), retry = await POST(request());
    expect([first.status, retry.status]).toEqual([200, 200]);
    expect(state.serviceCalls).toHaveLength(2); expect(state.serviceCalls[1]).toEqual(state.serviceCalls[0]);
    expect(state.rewardApplications).toBe(1); expectNoUserRewardMutation();
  });

  it("preserves a conflicting-choice receipt refusal without a second event or XP fallback", async () => {
    expect((await POST(request())).status).toBe(200);
    const conflict = await POST(request({ choiceId: "A" }));
    expect(conflict.status).toBe(409); expect(await conflict.json()).toMatchObject({ error: "REWARD_INPUT_CONFLICT" });
    expect(state.rewardApplications).toBe(1); expectNoUserRewardMutation();
  });

  it("keeps non-reward capture server-owned at zero XP and does not require the private writer", async () => {
    state.admin = false;
    expect((await POST(request({ eventType: "SCENARIO_STARTED", step: 1 }))).status).toBe(200);
    expect(state.writes).toEqual([{ table: "arena_events", operation: "insert", value: {
      run_id: RUN, user_id: USER, step: 1, event_type: "SCENARIO_STARTED", scenario_id: SCENARIO,
      choice_id: "B", follow_up_index: null, xp: 0, deltas: null, meta: null,
    } }]);
    expect(state.serviceCalls).toEqual([]); expect(state.userCalls).toEqual([]);
  });

  it("preserves non-reward step progress and server-normalized event metadata", async () => {
    state.admin = false;
    const response = await POST(request({ eventType: "FOLLOW_UP_VIEWED", step: 3, followUpIndex: 1,
      meta: { source: "fixture", scenarioDecisionEvent: { userId: "forged-user", isActionCommitment: true } } }));
    expect(response.status).toBe(200);
    expect(state.writes).toEqual([
      { table: "arena_events", operation: "insert", value: {
        run_id: RUN, user_id: USER, step: 3, event_type: "FOLLOW_UP_VIEWED", scenario_id: SCENARIO,
        choice_id: "B", follow_up_index: 1, xp: 0, deltas: null,
        meta: { source: "fixture", scenarioDecisionEvent: { userId: USER, isActionCommitment: true }, action_contract_candidate: true },
      } },
      { table: "arena_runs", operation: "update", value: { current_step: 3, reached_step_2_at: expect.any(String) } },
    ]);
    expect(state.serviceCalls).toEqual([]); expect(state.userCalls).toEqual([]);
  });

  it("denies unauthenticated callers before consent, run reads or writer acquisition", async () => {
    state.userId = null; expect((await POST(request())).status).toBe(401);
    expect(state.reads).toEqual([]); expect(state.adminReads).toBe(0); expect(state.serviceCalls).toEqual([]); expectNoUserRewardMutation();
  });

  it.each(["stale", null])("denies non-current consent (%s) before run lookup or private reward", async (consent) => {
    state.consentVersion = consent;
    const response = await POST(request()); expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "consent_required" });
    expect(state.reads).toEqual(["arena_profiles"]); expect(state.adminReads).toBe(0); expect(state.serviceCalls).toEqual([]); expectNoUserRewardMutation();
  });

  it("fails closed when consent storage cannot be read", async () => {
    state.consentError = true; expect((await POST(request())).status).toBe(403);
    expect(state.adminReads).toBe(0); expectNoUserRewardMutation();
  });

  it("checks authenticated ownership before event capture or privilege escalation", async () => {
    state.ownerId = "00000000-0000-4000-8000-000000000099";
    expect((await POST(request())).status).toBe(404);
    expect(state.adminReads).toBe(0); expect(state.serviceCalls).toEqual([]); expectNoUserRewardMutation();
  });

  it("binds the reward scenario to the owned stored run", async () => {
    state.scenarioId = "another-scenario";
    const response = await POST(request()); expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "RUN_SCENARIO_MISMATCH" });
    expect(state.adminReads).toBe(0); expect(state.serviceCalls).toEqual([]); expectNoUserRewardMutation();
  });

  it("returns 503 before capturing or awarding when the private writer is unavailable", async () => {
    state.admin = false;
    const response = await POST(request()); expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "XP_WRITER_UNAVAILABLE" });
    expect(state.serviceCalls).toEqual([]); expectNoUserRewardMutation();
  });

  it("rejects an unknown canonical choice instead of paying caller-provided XP", async () => {
    expect((await POST(request({ choiceId: "not-a-catalog-choice" }))).status).toBe(400);
    expect(state.serviceCalls).toEqual([]); expectNoUserRewardMutation();
  });

  it("does not report success or leave user-client event writes when the atomic RPC fails", async () => {
    state.rpcError = "synthetic transaction rolled back";
    expect((await POST(request())).status).toBe(500); expect(state.serviceCalls).toHaveLength(1); expectNoUserRewardMutation();
  });

  it("contains a thrown private transport failure without an unsafe fallback", async () => {
    state.rpcThrows = true;
    expect((await POST(request())).status).toBe(500); expect(state.serviceCalls).toHaveLength(1); expectNoUserRewardMutation();
  });

  it.each(["PGRST202", "42883"])("reports missing private RPC (%s) as unavailable without user-client fallback", async (code) => {
    state.rpcError = "synthetic function not found"; state.rpcCode = code;
    const response = await POST(request()); expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "XP_STORAGE_UNAVAILABLE" });
    expect(state.serviceCalls).toHaveLength(1); expectNoUserRewardMutation();
  });

  it("surfaces historical ambiguous rewards for review without guessing or issuing XP", async () => {
    state.rpcError = "LEGACY_REWARD_REVIEW_REQUIRED";
    const response = await POST(request()); expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "LEGACY_REWARD_REVIEW_REQUIRED" }); expectNoUserRewardMutation();
  });

  it.each([null, {}, [], { ok: true }, { policyVersion: "other-policy", kind: "legacy_choice" }].map(value => ({ value })))(
    "rejects a malformed atomic acknowledgement ($value)", async ({ value }) => {
      state.ackOverride = { value };
      const response = await POST(request()); expect(response.status).toBe(500); expect((await response.json()).ok).not.toBe(true);
      expect(state.serviceCalls).toHaveLength(1); expectNoUserRewardMutation();
    },
  );

  it.each([
    { policyVersion: "other-policy" }, { kind: "beginner_completion" }, { runId: "another-run" },
    { scenarioId: "another-scenario" }, { receiptId: null }, { eventId: null }, { replayed: "false" },
    { choiceId: "A" }, { xp: 99999999 }, { xp: "82" }, { step: 3 },
  ])("rejects a plausible receipt with an invalid or mismatched field (%j)", async (invalidField) => {
    state.ackOverride = { value: { ...VALID_ACK, ...invalidField } };
    const response = await POST(request()); expect(response.status).toBe(500);
    expect((await response.json()).ok).not.toBe(true); expect(state.serviceCalls).toHaveLength(1); expectNoUserRewardMutation();
  });
});
