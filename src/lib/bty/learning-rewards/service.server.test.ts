import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LearningRewardCompletion, LearningRewardEvidence, LearningRewardLedgerEntry } from "@/domain/learning-rewards/types";
const { collect, readTz, consent } = vi.hoisted(() => ({ collect: vi.fn(), readTz: vi.fn(), consent: vi.fn() }));
vi.mock("./sources.server", () => ({ collectLearningRewardEvidence: collect }));
vi.mock("@/lib/bty/daily/userDay", () => ({ readUserTzContext: readTz, isValidIanaTz: (tz: unknown) => typeof tz === "string" && ["UTC", "America/Los_Angeles"].includes(tz) }));
vi.mock("@/lib/legal/activeConsent", () => ({ isConsentCurrent: consent }));
import { acknowledgeLearningAchievements, featureLearningBadge, getLearningRewards, syncLearningRewards, syncLearningRewardsIfEnabled } from "./service.server";

const now = new Date("2026-10-30T18:00:00Z");
const evidence: LearningRewardEvidence = { policy_version: "learning-rewards/v1", source_type: "foundry_learn", source_id: "progress-1", assignment_key: "assignment-1", content_key: "module-1", content_version: "v1", action: "learn", completed_at: "2026-10-30T17:00:00Z", timezone: "UTC", metadata: {} };
type State = { started_at: string; timezone: string | null; featured_badge_id: string | null; seen_achievement_ids: string[]; completions: LearningRewardCompletion[]; ledger: LearningRewardLedgerEntry[] };
function database(options: { cap?: boolean; failOnAward?: boolean } = {}) {
  const state: State = { started_at: "2026-10-30T16:00:00Z", timezone: "UTC", featured_badge_id: null, seen_achievement_ids: [], completions: [], ledger: [] };
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }> => {
    if (name === "bty_get_learning_reward_state") return { data: structuredClone(state), error: null };
    if (name === "bty_acknowledge_learning_achievements") { state.seen_achievement_ids = [...new Set([...state.seen_achievement_ids, ...args.p_ids as string[]])]; return { data: state.seen_achievement_ids, error: null }; }
    if (name !== "bty_record_learning_reward") throw Error("unexpected RPC");
    if (options.failOnAward) return { data: null, error: { message: "synthetic failure" } };
    const item = args.p_evidence as LearningRewardEvidence;
    const existing = state.completions.find(row => row.source_id === item.source_id);
    if (existing) return { data: [{ completion_id: existing.id, disposition: "duplicate", xp: 0, total_xp: 10 }], error: null };
    const id = `completion-${state.completions.length}`;
    const xp = options.cap ? 0 : 10;
    const disposition = options.cap ? "daily_cap" : "awarded";
    state.completions.push({ ...item, id, xp, disposition, bty_day: "2026-10-30" });
    if (xp) state.ledger.push({ id: `ledger-${id}`, completion_id: id, xp, occurred_at: item.completed_at, bty_day: "2026-10-30", timezone: "UTC" });
    return { data: [{ completion_id: id, disposition, xp, total_xp: xp }], error: null };
  });
  const maybeSingle = vi.fn(async () => ({ data: { user_id: "u1" }, error: null }));
  const eq = vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle })) }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { db: { rpc, from } as unknown as SupabaseClient, rpc, from, state, update, eq, maybeSingle };
}
beforeEach(() => { collect.mockResolvedValue([evidence]); readTz.mockResolvedValue({ timezone: "UTC", tzFallback: false }); consent.mockResolvedValue(true); });
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe("Learning Rewards service", () => {
  it("GET reads one atomic state and performs no write or source reconciliation", async () => {
    const f = database();
    const summary = await getLearningRewards(f.db, "u1", now);
    expect(summary.totalXp).toBe(0);
    expect(f.rpc.mock.calls).toEqual([["bty_get_learning_reward_state", { p_user_id: "u1" }]]);
    expect(collect).not.toHaveBeenCalled();
    expect(f.from).not.toHaveBeenCalled();
  });
  it("reconciles server evidence once and a repeated sync cannot award or celebrate again", async () => {
    const f = database();
    const first = await syncLearningRewards(f.db, "u1", now);
    expect(collect).toHaveBeenCalledWith(f.db, "u1", f.state.started_at, now);
    expect(first).toMatchObject({ xpAwarded: 10, summary: { totalXp: 10 }, newAchievements: [{ id: "badge:first" }] });
    f.rpc.mockClear();
    const again = await syncLearningRewards(f.db, "u1", now);
    expect(again).toMatchObject({ xpAwarded: 0, summary: { totalXp: 10 }, newAchievements: [], awards: [] });
    expect(f.rpc.mock.calls.some(([name]) => name === "bty_record_learning_reward")).toBe(false);
  });
  it("daily-cap receipt still yields new evidence badges, but zero XP", async () => {
    const f = database({ cap: true });
    const result = await syncLearningRewards(f.db, "u1", now);
    expect(result.xpAwarded).toBe(0);
    expect(result.awards[0].disposition).toBe("daily_cap");
    expect(result.summary.badges.find(b => b.id === "first")?.earnedAt).not.toBeNull();
  });
  it("an alternative trace for an already recorded assignment/version makes no write call", async () => {
    const f = database(); await syncLearningRewards(f.db, "u1", now); f.rpc.mockClear();
    collect.mockResolvedValueOnce([{ ...evidence, source_id: "different-trace" }]);
    expect((await syncLearningRewards(f.db, "u1", now)).awards).toEqual([]);
    expect(f.rpc.mock.calls.some(([name]) => name === "bty_record_learning_reward")).toBe(false);
  });
  it("a partially committed batch retries only its unsettled completion", async () => {
    const f = database();
    const second = { ...evidence, source_id: "progress-2", assignment_key: "assignment-2", content_key: "module-2" };
    collect.mockResolvedValue([evidence, second]);
    const original = f.rpc.getMockImplementation()!;
    let failSecond = true;
    f.rpc.mockImplementation(async (name, args) => name === "bty_record_learning_reward" && (args.p_evidence as LearningRewardEvidence).source_id === second.source_id && failSecond
      ? { data: null, error: { message: "transient failure" } } : original(name, args));
    await expect(syncLearningRewards(f.db, "u1", now)).rejects.toThrow("LEARNING_REWARDS_UNAVAILABLE");
    expect(f.state.completions).toHaveLength(1);
    failSecond = false; f.rpc.mockClear();
    const retried = await syncLearningRewards(f.db, "u1", now);
    expect(retried.awards).toHaveLength(1);
    expect(f.rpc.mock.calls.filter(([name]) => name === "bty_record_learning_reward").map(([, args]) => (args.p_evidence as LearningRewardEvidence).source_id)).toEqual(["progress-2"]);
  });
  it("source outages are errors, not proven-empty or a partial award batch", async () => {
    const f = database();
    collect.mockRejectedValueOnce(Error("source offline"));
    await expect(syncLearningRewards(f.db, "u1", now)).rejects.toThrow("source offline");
    expect(f.rpc.mock.calls.some(([name]) => name === "bty_record_learning_reward")).toBe(false);
  });
  it("rejects pre-policy evidence before calling the award RPC", async () => {
    const f = database();
    collect.mockResolvedValueOnce([{ ...evidence, completed_at: "2026-10-29T17:00:00Z" }]);
    await expect(syncLearningRewards(f.db, "u1", now)).rejects.toThrow("INVALID_LEARNING_EVIDENCE");
    expect(f.rpc.mock.calls.some(([name]) => name === "bty_record_learning_reward")).toBe(false);
  });
  it("missing schema or malformed state never becomes a false zero", async () => {
    const f = database();
    f.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(getLearningRewards(f.db, "u1", now)).rejects.toThrow("LEARNING_REWARDS_UNAVAILABLE");
  });
  it("uses the frozen reward timezone and never captures a device timezone on GET", async () => {
    const f = database(); f.state.timezone = "America/Los_Angeles";
    expect((await getLearningRewards(f.db, "u1", now)).week.timezone).toBe("America/Los_Angeles");
    expect(readTz).not.toHaveBeenCalled();
  });
  it("feature action refuses unearned badges and updates only the authenticated owner's cosmetic field", async () => {
    const f = database();
    await expect(featureLearningBadge(f.db, "u1", "level50", now)).rejects.toThrow("BADGE_NOT_EARNED");
    expect(f.from).not.toHaveBeenCalled();
    await syncLearningRewards(f.db, "u1", now);
    const result = await featureLearningBadge(f.db, "u1", "first", now);
    expect(result.featuredBadgeId).toBe("first");
    expect(f.update).toHaveBeenCalledWith({ featured_badge_id: "first" });
    expect(f.eq).toHaveBeenCalledWith("user_id", "u1");
  });
  it("failed profile updates do not manufacture cosmetic success", async () => {
    const f = database();
    await syncLearningRewards(f.db, "u1", now);
    f.maybeSingle.mockResolvedValueOnce({ data: null as never, error: { message: "denied" } as never });
    await expect(featureLearningBadge(f.db, "u1", "first", now)).rejects.toThrow("LEARNING_REWARDS_UNAVAILABLE");
  });
  it("completion helper makes no calls when disabled and never throws when rewards fail", async () => {
    const f = database({ failOnAward: true });
    expect(await syncLearningRewardsIfEnabled(f.db, "u1")).toBeUndefined();
    expect(f.rpc).not.toHaveBeenCalled();
    vi.stubEnv("LEARNING_REWARDS_ENABLED", "1");
    expect(await syncLearningRewardsIfEnabled(f.db, "u1")).toEqual({ status: "pending" });
  });
  it("automatic hooks do not write rewards before current consent is established", async () => {
    const f = database(); vi.stubEnv("LEARNING_REWARDS_ENABLED", "1"); consent.mockResolvedValueOnce(false);
    expect(await syncLearningRewardsIfEnabled(f.db, "u1")).toEqual({ status: "pending" });
    expect(f.rpc).not.toHaveBeenCalled(); expect(collect).not.toHaveBeenCalled();
  });
  it("unseen achievements survive completion hooks and GET until explicit acknowledgement", async () => {
    const f = database(); await syncLearningRewards(f.db, "u1", now);
    expect((await getLearningRewards(f.db, "u1", now)).pendingAchievements.map(a => a.id)).toEqual(["badge:first"]);
    const seen = await acknowledgeLearningAchievements(f.db, "u1", ["badge:first"], now);
    expect(seen.pendingAchievements).toEqual([]);
    expect(seen.totalXp).toBe(10);
    await expect(acknowledgeLearningAchievements(f.db, "u1", ["badge:level50"], now)).rejects.toThrow("ACHIEVEMENT_NOT_EARNED");
  });
});
