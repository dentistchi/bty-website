import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rewardWritesPaused } from "./rewardWritePause";
import { recordLegacyChoiceReward } from "./arena/legacyRewards.server";
import { claimWeeklyReflectionQuest } from "./arena/weeklyQuestReward.server";
import { awardFoundryCoreAtomic } from "./foundry/events/foundryXpAtomic.server";

afterEach(() => { delete process.env.REWARD_WRITES_PAUSED; });

describe("reward write recovery switch", () => {
  it("is on only for the exact value 1", () => {
    expect(rewardWritesPaused()).toBe(false);
    for (const v of ["0", "true", "yes", ""]) { process.env.REWARD_WRITES_PAUSED = v; expect(rewardWritesPaused()).toBe(false); }
    process.env.REWARD_WRITES_PAUSED = "1"; expect(rewardWritesPaused()).toBe(true);
  });

  it("stops the atomic reward helpers before any RPC and leaves them unchanged otherwise", async () => {
    process.env.REWARD_WRITES_PAUSED = "1";
    const rpc = vi.fn();
    const writer = { rpc } as unknown as SupabaseClient;
    expect(await recordLegacyChoiceReward(writer, { userId: "u", runId: "r", scenarioId: "s", choiceId: "c", step: 2, xp: 1, deltas: {}, meta: {} }))
      .toEqual({ ok: false, status: 503, error: "REWARD_WRITES_PAUSED" });
    expect(await claimWeeklyReflectionQuest(writer, { userId: "u", weekStart: "2026-10-26" })).toEqual({ ok: false, error: "REWARD_WRITES_PAUSED" });
    expect(await awardFoundryCoreAtomic(writer, { userId: "u", eventId: "e", progressId: "p", start: "s", end: "e" })).toBe("unavailable");
    expect(rpc).not.toHaveBeenCalled();
  });
});
