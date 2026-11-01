import { afterEach, describe, expect, it, vi } from "vitest";

const writer = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => writer }));

import { applyArenaRunRewardsAtomic, awardActivityXp, awardLabXpAtomic, awardRunXp, awardSharedXp } from "./sharedXp.server";

const AWARD = { policyVersion: "shared-xp/v2", weeklyXpTotal: 30, coreBefore: 199, coreAfter: 200, coreGain: 1, coreBufferAfter: 0 };

afterEach(() => {
  writer.rpc.mockReset();
  delete process.env.REWARD_WRITES_PAUSED;
});

describe("shared XP/Core writers", () => {
  it("send one service RPC per award with exact arguments", async () => {
    writer.rpc.mockResolvedValue({ data: AWARD, error: null });
    expect(await awardSharedXp({ userId: "u", weeklyXp: 3, directCoreXp: 5 })).toEqual({ ok: true,
      award: { weeklyXpTotal: 30, coreBefore: 199, coreAfter: 200, coreGain: 1 } });
    expect(writer.rpc).toHaveBeenCalledWith("bty_award_xp_v2", { p_user_id: "u", p_league_id: null, p_weekly_delta: 3, p_seasonal_core_xp: 0, p_direct_core_xp: 5 });
    writer.rpc.mockResolvedValue({ data: { ...AWARD, xp: 5 }, error: null });
    expect((await awardActivityXp("u", "CHAT_MESSAGE", 5, "l1")).ok).toBe(true);
    expect(writer.rpc).toHaveBeenLastCalledWith("bty_award_activity_xp_v2", { p_user_id: "u", p_activity_type: "CHAT_MESSAGE", p_delta: 5, p_league_id: "l1" });
    writer.rpc.mockResolvedValue({ data: { policyVersion: "shared-xp/v2", xp: 25 }, error: null });
    expect(await awardRunXp("u", "r", 25)).toEqual({ ok: true });
    expect(writer.rpc).toHaveBeenLastCalledWith("bty_award_run_xp_v2", { p_user_id: "u", p_run_id: "r", p_xp: 25 });
  });

  it("distinguish already-applied anchors from awards", async () => {
    writer.rpc.mockResolvedValue({ data: { policyVersion: "shared-xp/v2", outcome: "already_applied" }, error: null });
    expect(await awardLabXpAtomic("u", 10, "lab:1")).toEqual({ ok: true, outcome: "already_applied" });
    writer.rpc.mockResolvedValue({ data: { policyVersion: "shared-xp/v2", applied: false }, error: null });
    expect(await applyArenaRunRewardsAtomic({ userId: "u", runId: "r", scenarioId: null, weeklyXp: 8, coreXp: 12 })).toEqual({ ok: true, applied: false });
    expect(writer.rpc).toHaveBeenLastCalledWith("bty_apply_arena_run_rewards_v2", { p_user_id: "u", p_run_id: "r", p_scenario_id: "unknown", p_weekly_delta: 8, p_core_xp: 12 });
  });

  it.each([
    ["missing RPC", { code: "PGRST202", message: "x" }, "XP_STORAGE_UNAVAILABLE"],
    ["fence refusal", { code: "P0001", message: "REWARD_WRITE_FENCED" }, "REWARD_WRITE_FENCED"],
    ["database pause", { code: "P0001", message: "REWARD_WRITES_PAUSED" }, "REWARD_WRITES_PAUSED"],
  ])("map a %s to its error without a fallback write", async (_name, error, expected) => {
    writer.rpc.mockResolvedValue({ data: null, error });
    expect(await awardSharedXp({ userId: "u", directCoreXp: 1 })).toEqual({ ok: false, error: expected });
    expect(writer.rpc).toHaveBeenCalledTimes(1);
  });

  it("reject malformed or inconsistent results", async () => {
    for (const data of [null, { ...AWARD, policyVersion: "x" }, { ...AWARD, coreAfter: 205 }, { ...AWARD, coreGain: -1, coreAfter: 198 }]) {
      writer.rpc.mockResolvedValue({ data, error: null });
      expect(await awardSharedXp({ userId: "u", directCoreXp: 1 })).toEqual({ ok: false, error: "XP_AWARD_FAILED" });
    }
    writer.rpc.mockResolvedValue({ data: { policyVersion: "shared-xp/v2", xp: 24 }, error: null });
    expect(await awardRunXp("u", "r", 25)).toEqual({ ok: false, error: "XP_AWARD_FAILED" });
    writer.rpc.mockRejectedValue(new Error("network"));
    expect(await awardSharedXp({ userId: "u", directCoreXp: 1 })).toEqual({ ok: false, error: "XP_AWARD_FAILED" });
  });

  it("with REWARD_WRITES_PAUSED=1 return the pause before any database call", async () => {
    process.env.REWARD_WRITES_PAUSED = "1";
    expect(await awardSharedXp({ userId: "u", directCoreXp: 1 })).toEqual({ ok: false, error: "REWARD_WRITES_PAUSED" });
    expect(await awardRunXp("u", "r", 25)).toEqual({ ok: false, error: "REWARD_WRITES_PAUSED" });
    expect(await applyArenaRunRewardsAtomic({ userId: "u", runId: "r", scenarioId: "s", weeklyXp: 1, coreXp: 1 })).toEqual({ ok: false, error: "REWARD_WRITES_PAUSED" });
    expect(writer.rpc).not.toHaveBeenCalled();
  });
});
