import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { claimWeeklyReflectionQuest } from "./weeklyQuestReward.server";

const WEEK = "2026-10-26";
const writer = (result: { data?: unknown; error?: unknown } | Error) => {
  const rpc = vi.fn(async () => { if (result instanceof Error) throw result; return { data: result.data ?? null, error: result.error ?? null }; });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
};
const awarded = { policyVersion: "weekly-reflection-quest/v1", outcome: "awarded", weekStart: WEEK, seasonalXp: 15,
  coreGain: 1, coreBefore: 199, coreAfter: 200, weeklyXpTotal: 45 };

describe("claimWeeklyReflectionQuest", () => {
  it("calls only the atomic RPC with the user and UTC week", async () => {
    const { client, rpc } = writer({ data: awarded });
    expect(await claimWeeklyReflectionQuest(client, { userId: "u1", weekStart: WEEK })).toEqual({ ok: true, claim: {
      outcome: "awarded", weekStart: WEEK, seasonalXp: 15, coreGain: 1, coreBefore: 199, coreAfter: 200, weeklyXpTotal: 45 } });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("bty_claim_weekly_reflection_quest", { p_user_id: "u1", p_week_start: WEEK });
  });

  it.each(["already_claimed", "not_eligible"])("reports %s without an award", async outcome => {
    const { client } = writer({ data: { policyVersion: "weekly-reflection-quest/v1", outcome, weekStart: WEEK } });
    expect(await claimWeeklyReflectionQuest(client, { userId: "u1", weekStart: WEEK })).toEqual({ ok: true, claim: { outcome, weekStart: WEEK } });
  });

  it("maps a missing RPC to unavailable storage and never falls back to split writes", async () => {
    const { client, rpc } = writer({ error: { code: "PGRST202", message: "not found" } });
    expect(await claimWeeklyReflectionQuest(client, { userId: "u1", weekStart: WEEK })).toEqual({ ok: false, error: "QUEST_STORAGE_UNAVAILABLE" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["wrong policy", { ...awarded, policyVersion: "other" }],
    ["wrong week", { ...awarded, weekStart: "2026-10-19" }],
    ["wrong amount", { ...awarded, seasonalXp: 30 }],
    ["inconsistent Core", { ...awarded, coreAfter: 205 }],
    ["unknown outcome", { ...awarded, outcome: "paid" }],
  ])("rejects a malformed %s result", async (_name, data) => {
    const { client } = writer({ data });
    expect(await claimWeeklyReflectionQuest(client, { userId: "u1", weekStart: WEEK })).toEqual({ ok: false, error: "QUEST_AWARD_FAILED" });
  });

  it("treats database and transport failures as not awarded", async () => {
    expect(await claimWeeklyReflectionQuest(writer({ error: { code: "40P01", message: "deadlock" } }).client, { userId: "u1", weekStart: WEEK }))
      .toEqual({ ok: false, error: "QUEST_AWARD_FAILED" });
    expect(await claimWeeklyReflectionQuest(writer(new Error("network")).client, { userId: "u1", weekStart: WEEK }))
      .toEqual({ ok: false, error: "QUEST_AWARD_FAILED" });
  });

  it("run/complete pays the quest only through the atomic helper", () => {
    const route = readFileSync(path.resolve(__dirname, "../../../app/api/arena/run/complete/route.ts"), "utf8");
    expect(route).toContain("claimWeeklyReflectionQuest(adminForContract, { userId: user.id, weekStart })");
    expect(route).not.toContain("arena_weekly_quest_claims");
    expect(route).not.toContain("REFLECTION_QUEST_BONUS_XP");
    expect(route).not.toContain("applySeasonalXpToCore");
  });
});
