/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_CONSENT_VERSION } from "@/domain/legal/consent-document";

// Only the database factories are stubbed. Real consent, scoring and route/helper run.
// PostgreSQL transaction guarantees belong to the independent database suite.
const state = vi.hoisted(() => ({
  userId: "00000000-0000-4000-8000-000000000001" as string | null,
  ownerId: "00000000-0000-4000-8000-000000000001",
  consentVersion: "2026-05-v1" as string | null, consentError: false,
  run: { run_id: "00000000-0000-4000-8000-000000000002",
    scenario_id: "senior_staff_resists_new_protocol_033", run_type: "beginner",
    status: "IN_PROGRESS", beginner_maturity_score: null as number | null },
  admin: true, adminReads: 0,
  rpcError: null as string | null, rpcCode: undefined as string | undefined, rpcThrows: false, loseCommittedResponse: false,
  ackOverride: null as { value: unknown } | null,
  receipt: null as Record<string, unknown> | null, receiptInput: null as string | null,
  committedReflections: [] as unknown[], rewardApplications: 0,
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
      if (fn !== "bty_complete_beginner_reward") return { data: null, error: null };
      const canonicalInput = JSON.stringify(args);
      if (state.receipt && state.receiptInput !== canonicalInput) return { data: null, error: { message: "REWARD_INPUT_CONFLICT" } };
      if (state.receipt) return { data: { ...state.receipt, replayed: true }, error: null };
      if (state.run.status === "DONE") return { data: null, error: { message: "LEGACY_REWARD_REVIEW_REQUIRED" } };
      state.receiptInput = canonicalInput;
      state.receipt = {
        policyVersion: "legacy-xp-atomic/v1", kind: "beginner_completion",
        runId: args.p_run_id, scenarioId: args.p_scenario_id,
        receiptId: "00000000-0000-4000-8000-000000000010",
        eventId: "00000000-0000-4000-8000-000000000011", replayed: false,
        score: args.p_score, feedback: args.p_feedback, seasonalXp: 30,
        coreGain: 0, coreBefore: 0, coreAfter: 0,
        coreBufferBefore: 0, coreBufferAfter: 2 / 3, weeklyXpTotal: 30,
      };
      state.rewardApplications++; state.committedReflections.push(structuredClone(args.p_responses));
      state.run.status = "DONE"; state.run.beginner_maturity_score = args.p_score as number;
      if (state.loseCommittedResponse) {
        state.loseCommittedResponse = false;
        return { data: null, error: { message: "synthetic response lost after commit" } };
      }
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
      let mutation: { operation: string; value: Record<string, unknown> } | null = null;
      const result = () => {
        if (mutation) {
          if (filters.status && filters.status !== state.run.status) return { data: null, error: null };
          state.writes.push({ table, ...mutation });
          if (table === "arena_runs") Object.assign(state.run, mutation.value);
          return { data: { run_id: state.run.run_id }, error: null };
        }
        if (table === "arena_profiles") return { data: { consent_version: state.consentVersion, core_xp_total: 0, core_xp_buffer: 0 }, error: state.consentError ? { message: "synthetic consent outage" } : null };
        if (table === "arena_runs") return { data: filters.user_id === state.ownerId ? { ...state.run } : null, error: null };
        return { data: null, error: null };
      };
      const q: any = {
        select: () => q,
        eq: (column: string, value: unknown) => { filters[column] = value; return q; },
        maybeSingle: async () => result(),
        update: (value: Record<string, unknown>) => { mutation = { operation: "update", value }; return q; },
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
const SCENARIO = "senior_staff_resists_new_protocol_033";
const REFLECTION = "Pause privately and explain the standard.";
const RESPONSES = { emotionIndex: 0, riskIndex: 0, integrityIndex: 0, decisionIndex: 0, reflectionText: REFLECTION };
const FEEDBACK = { band: "reactive", label: "Reactive", message: "You're reacting in the moment. Small pauses before acting can help." };
const VALID_ACK = {
  policyVersion: "legacy-xp-atomic/v1", kind: "beginner_completion", runId: RUN, scenarioId: SCENARIO,
  receiptId: "00000000-0000-4000-8000-000000000010", eventId: "00000000-0000-4000-8000-000000000011",
  replayed: false, score: 3, feedback: FEEDBACK, seasonalXp: 30,
  coreGain: 0, coreBefore: 0, coreAfter: 0, coreBufferBefore: 0, coreBufferAfter: 2 / 3, weeklyXpTotal: 30,
};
const request = (extra: Record<string, unknown> = {}) => new Request("https://local.test/api/arena/beginner-complete", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ runId: RUN, scenarioId: SCENARIO, ...RESPONSES,
    userId: "forged-user", xp: 99999999, beginner_maturity_score: 99999999, ...extra }),
});
const expectNoUserRewardMutation = () => {
  expect(state.userCalls).toEqual([]); expect(state.writes).toEqual([]);
};

beforeEach(() => {
  state.userId = USER; state.ownerId = USER; state.consentVersion = ACTIVE_CONSENT_VERSION; state.consentError = false;
  state.run = { run_id: RUN, scenario_id: SCENARIO, run_type: "beginner", status: "IN_PROGRESS", beginner_maturity_score: null };
  state.admin = true; state.adminReads = 0; state.rpcError = null; state.rpcCode = undefined; state.rpcThrows = false; state.loseCommittedResponse = false;
  state.ackOverride = null; state.receipt = null; state.receiptInput = null; state.rewardApplications = 0;
  state.userCalls.length = 0; state.serviceCalls.length = 0; state.writes.length = 0; state.reads.length = 0; state.committedReflections.length = 0;
});

describe("beginner completion atomic reward boundary", () => {
  it("delegates owned responses, independently expected score/feedback and reflection through one private RPC", async () => {
    const response = await POST(request()); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, beginner_maturity_score: 3, ...FEEDBACK });
    expect(state.serviceCalls).toEqual([{ fn: "bty_complete_beginner_reward", args: {
      p_user_id: USER, p_run_id: RUN, p_scenario_id: SCENARIO, p_responses: RESPONSES, p_score: 3, p_feedback: FEEDBACK,
    } }]);
    expect(state.committedReflections).toEqual([RESPONSES]); expectNoUserRewardMutation();
  });

  it("returns the same frozen receipt result on an identical retry and preserves one reflection", async () => {
    const first = await POST(request()); expect(first.status).toBe(200); const firstBody = await first.json();
    const retry = await POST(request()); expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ ...FEEDBACK, beginner_maturity_score: firstBody.beginner_maturity_score, idempotent: true });
    expect(state.serviceCalls).toHaveLength(2); expect(state.serviceCalls[1]).toEqual(state.serviceCalls[0]);
    expect(state.rewardApplications).toBe(1); expect(state.committedReflections).toEqual([RESPONSES]); expectNoUserRewardMutation();
  });

  it("returns receipt feedback verbatim instead of recalculating a historical result from current wording", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(state.receipt).not.toBeNull();
    state.receipt!.feedback = { ...FEEDBACK, message: "Frozen feedback retained with the receipt." };
    const response = await POST(request()); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ beginner_maturity_score: 3, ...FEEDBACK, message: "Frozen feedback retained with the receipt.", idempotent: true });
    expect(state.rewardApplications).toBe(1); expectNoUserRewardMutation();
  });

  it("returns the stored receipt score rather than recomputing the historical score on replay", async () => {
    expect((await POST(request())).status).toBe(200); expect(state.receipt).not.toBeNull();
    state.receipt!.score = 11;
    state.receipt!.feedback = { band: "aware", label: "Aware", message: "Previously frozen aware feedback." };
    const response = await POST(request()); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ beginner_maturity_score: 11, band: "aware", label: "Aware", message: "Previously frozen aware feedback.", idempotent: true });
    expect(state.rewardApplications).toBe(1); expectNoUserRewardMutation();
  });

  it("lets concurrent identical requests reach the atomic boundary while observing one mocked committed receipt", async () => {
    const responses = await Promise.all([POST(request()), POST(request())]);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(state.serviceCalls).toHaveLength(2); expect(state.rewardApplications).toBe(1);
    expect(state.committedReflections).toEqual([RESPONSES]); expectNoUserRewardMutation();
  });

  it.each([
    { emotionIndex: 1 }, { riskIndex: 1 }, { integrityIndex: 1 }, { decisionIndex: 1 }, { reflectionText: "A changed reflection." },
  ])("refuses changed submitted responses (%j) rather than silently returning a different completion", async (extra) => {
    expect((await POST(request())).status).toBe(200);
    const response = await POST(request(extra)); expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "REWARD_INPUT_CONFLICT" });
    expect(state.serviceCalls).toHaveLength(2); expect(state.rewardApplications).toBe(1);
    expect(state.committedReflections).toEqual([RESPONSES]); expectNoUserRewardMutation();
  });

  it("retries a failed atomic award without a local DONE shortcut or lost reflection", async () => {
    state.rpcError = "synthetic transaction rolled back";
    expect((await POST(request())).status).toBe(500);
    expect(state.run.status).toBe("IN_PROGRESS"); expect(state.committedReflections).toEqual([]);
    state.rpcError = null; expect((await POST(request())).status).toBe(200);
    expect(state.serviceCalls).toHaveLength(2); expect(state.rewardApplications).toBe(1);
    expect(state.committedReflections).toEqual([RESPONSES]); expectNoUserRewardMutation();
  });

  it("resolves an uncertain committed response through the receipt RPC even when the stored run is DONE", async () => {
    state.loseCommittedResponse = true;
    expect((await POST(request())).status).toBe(500); expect(state.run.status).toBe("DONE");
    const retry = await POST(request()); expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ ok: true, idempotent: true, beginner_maturity_score: 3, ...FEEDBACK });
    expect(state.serviceCalls).toHaveLength(2); expect(state.rewardApplications).toBe(1);
    expect(state.committedReflections).toEqual([RESPONSES]); expectNoUserRewardMutation();
  });

  it("blocks historical DONE without a receipt for review and never guesses it was paid", async () => {
    state.run.status = "DONE"; state.run.beginner_maturity_score = 18;
    const response = await POST(request()); expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "LEGACY_REWARD_REVIEW_REQUIRED" });
    expect(state.serviceCalls).toHaveLength(1); expect(state.rewardApplications).toBe(0); expectNoUserRewardMutation();
  });

  it("denies an unauthenticated caller before reading consent or acquiring a private writer", async () => {
    state.userId = null; expect((await POST(request())).status).toBe(401);
    expect(state.reads).toEqual([]); expect(state.adminReads).toBe(0); expectNoUserRewardMutation();
  });

  it.each(["stale", null])("requires current consent (%s) before lookup or privileged writes", async (consent) => {
    state.consentVersion = consent;
    const response = await POST(request()); expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "consent_required" });
    expect(state.reads).toEqual(["arena_profiles"]); expect(state.adminReads).toBe(0); expectNoUserRewardMutation();
  });

  it("fails closed on a consent read failure", async () => {
    state.consentError = true; expect((await POST(request())).status).toBe(403);
    expect(state.adminReads).toBe(0); expectNoUserRewardMutation();
  });

  it("uses owned run filters and refuses a foreign run before privilege escalation", async () => {
    state.ownerId = "00000000-0000-4000-8000-000000000099";
    expect((await POST(request())).status).toBe(404);
    expect(state.adminReads).toBe(0); expect(state.serviceCalls).toEqual([]); expectNoUserRewardMutation();
  });

  it("binds beginner inputs to the scenario stored on the owned run", async () => {
    const response = await POST(request({ scenarioId: "patient_leaves_negative_review_034" }));
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ error: "RUN_SCENARIO_MISMATCH" });
    expect(state.adminReads).toBe(0); expect(state.serviceCalls).toEqual([]); expectNoUserRewardMutation();
  });

  it("does not complete a non-beginner run", async () => {
    state.run.run_type = "advanced"; expect((await POST(request())).status).toBe(400);
    expect(state.adminReads).toBe(0); expect(state.serviceCalls).toEqual([]); expectNoUserRewardMutation();
  });

  it("fails 503 before changing completion or paying when the private writer is unavailable", async () => {
    state.admin = false;
    const response = await POST(request()); expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "XP_WRITER_UNAVAILABLE" });
    expect(state.run.status).toBe("IN_PROGRESS"); expectNoUserRewardMutation();
  });

  it("contains a thrown atomic transport error without direct profile/XP/reflection fallback", async () => {
    state.rpcThrows = true;
    expect((await POST(request())).status).toBe(500); expect(state.serviceCalls).toHaveLength(1); expectNoUserRewardMutation();
  });

  it.each(["PGRST202", "42883"])("reports missing private RPC (%s) as unavailable without fallback", async (code) => {
    state.rpcError = "synthetic function not found"; state.rpcCode = code;
    const response = await POST(request()); expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "XP_STORAGE_UNAVAILABLE" });
    expect(state.serviceCalls).toHaveLength(1); expectNoUserRewardMutation();
  });

  it.each([null, {}, [], { ok: true }, { policyVersion: "other-policy", kind: "beginner_completion" }].map(value => ({ value })))(
    "rejects a malformed atomic acknowledgement ($value)", async ({ value }) => {
      state.ackOverride = { value };
      const response = await POST(request()); expect(response.status).toBe(500); expect((await response.json()).ok).not.toBe(true);
      expect(state.serviceCalls).toHaveLength(1); expectNoUserRewardMutation();
    },
  );

  it.each([
    { policyVersion: "other-policy" }, { kind: "legacy_choice" }, { runId: "another-run" },
    { scenarioId: "another-scenario" }, { receiptId: null }, { eventId: null }, { replayed: "false" },
    { score: "3" }, { score: -1 }, { score: 21 }, { seasonalXp: 99999999 },
    { feedback: null }, { feedback: { band: "reactive", label: "Reactive" } },
    { feedback: { band: "invented", label: "Reactive", message: "Untrusted feedback." } },
    { coreGain: -1 }, { coreBefore: "0" }, { coreAfter: -1 }, { coreBufferBefore: -0.1 },
    { coreBufferAfter: -0.1 }, { weeklyXpTotal: "30" },
  ])("rejects a plausible receipt with invalid or mismatched fields (%j)", async (invalidField) => {
    state.ackOverride = { value: { ...VALID_ACK, ...invalidField } };
    const response = await POST(request()); expect(response.status).toBe(500);
    expect((await response.json()).ok).not.toBe(true); expect(state.serviceCalls).toHaveLength(1); expectNoUserRewardMutation();
  });
});
