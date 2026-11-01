import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { completeHealingAwakeningAct, getHealingAwakeningProgress } from "./completeAwakeningAct";
import { completeSecondAwakening } from "@/lib/bty/emotional-stats/secondAwakening";

const state = vi.hoisted(() => ({
  acts: [1, 2], milestone: null as string | null, starter: null as string | null,
  failAt: "milestone" as "milestone" | "unlock", publicWrites: [] as string[],
  privateCalls: [] as { fn: string; args: unknown }[],
  writer: true, rpcError: { code: "P0001", message: "HEALING_WRITE_FAILED" } as { code: string; message: string } | null,
  rpcThrows: false, acknowledgement: null as unknown,
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => state.writer ? ({
  rpc: async (fn: string, args: unknown) => {
    state.privateCalls.push({ fn, args });
    if (state.rpcThrows) throw new Error("private transport details");
    return { data: state.acknowledgement, error: state.rpcError };
  },
}) : null }));
const USER = "00000000-0000-4000-8000-000000000001";
function client(): SupabaseClient {
  return { from(table: string) {
    let columns = "";
    const read = () => {
      if (table === "user_healing_awakening_acts") return { data: state.acts.map(act_id => ({ act_id, completed_at: "2026-07-01T12:00:00Z" })), error: null };
      if (table === "train_day_completions") return { data: Array.from({ length: 28 }, (_, i) => ({ day: i + 1 })), error: null };
      if (table === "user_healing_milestones") return { data: state.milestone ? { second_awakening_completed_at: state.milestone, starter_unlock_granted: state.starter } : null, error: null };
      if (table === "user_advanced_unlocks") return { data: state.starter ? { advanced_stat_name: state.starter } : null, error: null };
      if (table === "emotional_sessions") return { data: null, count: 0, error: null };
      if (table === "user_emotional_stats" || table === "emotional_events") return { data: [], error: null };
      throw new Error(`Unexpected read ${table}:${columns}`);
    };
    const chain = {
      select(value: string) { columns = value; return chain; }, eq() { return chain; }, order() { return chain; }, limit() { return chain; },
      maybeSingle: async () => read(),
      then(onFulfilled: (value: ReturnType<typeof read>) => unknown, onRejected?: (error: unknown) => unknown) { return Promise.resolve().then(read).then(onFulfilled, onRejected); },
      async insert(row: { act_id: number }) { state.publicWrites.push(table); state.acts.push(row.act_id); return { error: null }; },
      async upsert(row: { second_awakening_completed_at?: string; starter_unlock_granted?: string | null; advanced_stat_name?: string }) {
        state.publicWrites.push(table);
        if ((table === "user_healing_milestones" && state.failAt === "milestone") || (table === "user_advanced_unlocks" && state.failAt === "unlock"))
          return { error: { message: "synthetic write outage" } };
        if (table === "user_healing_milestones") { state.milestone = row.second_awakening_completed_at ?? null; state.starter = row.starter_unlock_granted ?? null; }
        return { error: null };
      },
    };
    return chain;
  } } as unknown as SupabaseClient;
}
beforeEach(() => { state.acts = [1, 2]; state.milestone = null; state.starter = null; state.failAt = "milestone"; state.publicWrites.length = 0; state.privateCalls.length = 0;
  state.writer = true; state.rpcError = { code: "P0001", message: "HEALING_WRITE_FAILED" }; state.rpcThrows = false; state.acknowledgement = null; });

describe("Healing completion split-write regression", () => {
  it("does not acknowledge act 3 or leave it recorded when its milestone write fails", async () => {
    const result = await completeHealingAwakeningAct(client(), USER, 3);
    expect(result).toMatchObject({ status: 500 });
    expect(state.acts).toEqual([1, 2]); expect(state.milestone).toBeNull(); expect(state.publicWrites).toEqual([]);
    expect(state.privateCalls).toHaveLength(1);
  });
  it("does not acknowledge or retain the ritual milestone when its starter unlock fails", async () => {
    state.acts = []; state.failAt = "unlock";
    const result = await completeSecondAwakening(client(), USER);
    expect(result).toMatchObject({ ok: false });
    expect(state.milestone).toBeNull(); expect(state.starter).toBeNull(); expect(state.publicWrites).toEqual([]);
    expect(state.privateCalls).toHaveLength(1);
  });
});


const AT = "2026-07-01T12:00:00Z";
const actAck = () => ({ policyVersion: "healing-completion/v1", operation: "act", userId: USER,
  actId: 3, completedActs: [1, 2, 3], actCompletedAt: AT, completedAt: AT, idempotent: false });
const ritualAck = () => ({ policyVersion: "healing-completion/v1", operation: "ritual", userId: USER,
  completedAt: AT, starterUnlockGranted: "PRM", idempotent: false });
describe("Healing private acknowledgement boundary", () => {
  it("delegates act 3 through one private transaction and never writes through the owner client", async () => {
    state.rpcError = null; state.acknowledgement = actAck();
    expect(await completeHealingAwakeningAct(client(), USER, 3)).toEqual({ ok: true, completedActs: [1, 2, 3] });
    expect(state.privateCalls).toEqual([{ fn: "bty_complete_healing_awakening_act", args: { p_user_id: USER, p_act_id: 3 } }]);
    expect(state.publicWrites).toEqual([]);
  });
  it("delegates the verified server-derived starter and returns the committed ritual result", async () => {
    state.acts = []; state.rpcError = null; state.acknowledgement = ritualAck();
    expect(await completeSecondAwakening(client(), USER)).toEqual({ ok: true, starterUnlockGranted: "PRM", idempotent: false });
    expect(state.privateCalls).toEqual([{ fn: "bty_complete_second_awakening", args: { p_user_id: USER, p_starter_unlock: "PRM" } }]);
    expect(state.publicWrites).toEqual([]);
  });
  it("uses a healthy stored ritual replay rather than recomputing or granting a starter", async () => {
    state.milestone = AT; state.starter = "SAG"; state.rpcError = null;
    state.acknowledgement = { ...ritualAck(), starterUnlockGranted: "SAG", idempotent: true };
    expect(await completeSecondAwakening(client(), USER)).toEqual({ ok: true, starterUnlockGranted: "SAG", idempotent: true });
    expect(state.privateCalls).toEqual([{ fn: "bty_complete_second_awakening", args: { p_user_id: USER, p_starter_unlock: null } }]);
    expect(state.publicWrites).toEqual([]);
  });
  it("retains a retryable act after a private failure and sends the identical input again", async () => {
    expect(await completeHealingAwakeningAct(client(), USER, 3)).toMatchObject({ status: 500 });
    state.rpcError = null; state.acknowledgement = actAck();
    expect(await completeHealingAwakeningAct(client(), USER, 3)).toMatchObject({ ok: true });
    expect(state.privateCalls).toHaveLength(2); expect(state.privateCalls[1]).toEqual(state.privateCalls[0]);
    expect(state.publicWrites).toEqual([]);
  });
  it.each(["PGRST202", "42883"])("fails closed if storage RPC is missing (%s)", async code => {
    state.rpcError = { code, message: "private database details" };
    expect(await completeHealingAwakeningAct(client(), USER, 3)).toEqual({ status: 503, error: "HEALING_STORAGE_UNAVAILABLE" });
    expect(await completeSecondAwakening(client(), USER)).toMatchObject({ ok: false, status: 503, error: "HEALING_STORAGE_UNAVAILABLE" });
    expect(state.publicWrites).toEqual([]);
  });
  it("does not use owner-client writes if the private writer is unavailable", async () => {
    state.writer = false;
    expect(await completeHealingAwakeningAct(client(), USER, 3)).toEqual({ status: 503, error: "HEALING_WRITER_UNAVAILABLE" });
    expect(await completeSecondAwakening(client(), USER)).toMatchObject({ ok: false, status: 503 });
    expect(state.privateCalls).toEqual([]); expect(state.publicWrites).toEqual([]);
  });
  it("contains thrown private transport failures", async () => {
    state.rpcThrows = true;
    expect(await completeHealingAwakeningAct(client(), USER, 3)).toEqual({ status: 500, error: "HEALING_COMPLETION_FAILED" });
    expect(await completeSecondAwakening(client(), USER)).toMatchObject({ ok: false, status: 500, error: "HEALING_COMPLETION_FAILED" });
    expect(state.publicWrites).toEqual([]);
  });
  it("preserves review-required history instead of claiming duplicate success", async () => {
    state.rpcError = { code: "P0001", message: "HEALING_COMPLETION_REVIEW_REQUIRED" };
    expect(await completeHealingAwakeningAct(client(), USER, 3)).toEqual({ status: 409, error: "HEALING_COMPLETION_REVIEW_REQUIRED" });
    expect(await completeSecondAwakening(client(), USER)).toMatchObject({ ok: false, status: 409, error: "HEALING_COMPLETION_REVIEW_REQUIRED" });
    expect(state.publicWrites).toEqual([]);
  });
  it.each([null, {}, [], { ok: true }].map(value => ({ value })))("rejects an unstructured private acknowledgement ($value)", async ({ value }) => {
    state.rpcError = null; state.acknowledgement = value;
    expect(await completeHealingAwakeningAct(client(), USER, 3)).toMatchObject({ status: 500 });
    expect(await completeSecondAwakening(client(), USER)).toMatchObject({ ok: false, status: 500 });
    expect(state.publicWrites).toEqual([]);
  });
  it.each([
    { policyVersion: "wrong" }, { operation: "ritual" }, { userId: "another-user" }, { actId: 1 },
    { completedActs: [1, 1, 3] }, { completedActs: [1, 3, 2] }, { actCompletedAt: null }, { completedAt: null },
    { idempotent: true }, { completedAt: "2026-07-02T12:00:00Z" },
  ])("rejects mismatched act receipt fields (%j)", async patch => {
    state.rpcError = null; state.acknowledgement = { ...actAck(), ...patch };
    expect(await completeHealingAwakeningAct(client(), USER, 3)).toMatchObject({ status: 500 }); expect(state.publicWrites).toEqual([]);
  });
  it.each([
    { policyVersion: "wrong" }, { operation: "act" }, { userId: "another-user" }, { completedAt: null },
    { starterUnlockGranted: "EL" }, { starterUnlockGranted: "SAG" }, { idempotent: "false" },
  ])("rejects mismatched ritual receipt fields (%j)", async patch => {
    state.acts = []; state.rpcError = null; state.acknowledgement = { ...ritualAck(), ...patch };
    expect(await completeSecondAwakening(client(), USER)).toMatchObject({ ok: false, status: 500 }); expect(state.publicWrites).toEqual([]);
  });
});


it("does not publish nextAct null when three recorded acts have no completion milestone", async () => {
  state.acts = [1, 2, 3];
  expect(await getHealingAwakeningProgress(client(), USER)).toEqual({ status: 409, error: "HEALING_COMPLETION_REVIEW_REQUIRED" });
  expect(state.publicWrites).toEqual([]); expect(state.privateCalls).toEqual([]);
});


it.each([{ acts: [2] }, { acts: [1, 3] }])("does not serialize invalid act history $acts as nextAct null", async ({ acts }) => {
  state.acts = acts;
  expect(await getHealingAwakeningProgress(client(), USER)).toEqual({ status: 409, error: "HEALING_COMPLETION_REVIEW_REQUIRED" });
});
