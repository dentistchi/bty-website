import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { completeBeginnerReward, recordLegacyChoiceReward } from "./legacyRewards.server";

const userId = "00000000-0000-4000-8000-000000000001";
const runId = "00000000-0000-4000-8000-000000000002";
const receiptId = "00000000-0000-4000-8000-000000000003";
const eventId = "00000000-0000-4000-8000-000000000004";
const feedback = { band: "reactive" as const, label: "Reactive", message: "Current feedback" };
const beginnerInput = {
  userId, runId, scenarioId: "beginner-helper-test",
  responses: { emotionIndex: 0, riskIndex: 0, integrityIndex: 0, decisionIndex: 0, reflectionText: null },
  score: 0, feedback,
};
const choiceInput = { userId, runId, scenarioId: "legacy-helper-test", choiceId: "B", step: 2,
  xp: 82, deltas: { integrity: 1 }, meta: null };
const common = { policyVersion: "legacy-xp-atomic/v1", runId, receiptId, eventId, replayed: false };
const beginnerReceipt = () => ({ ...common, kind: "beginner_completion", scenarioId: beginnerInput.scenarioId,
  score: 0, feedback, seasonalXp: 30, coreGain: 0, coreBefore: 0, coreAfter: 0,
  coreBufferBefore: 0, coreBufferAfter: 2 / 3, weeklyXpTotal: 30 });
const choiceReceipt = () => ({ ...common, kind: "legacy_choice", scenarioId: choiceInput.scenarioId,
  choiceId: "B", step: 2, xp: 82 });
function writer(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("atomic legacy receipt validation preserves existing balances and frozen policy", () => {
  it("accepts a coherent legacy buffer above one after SQL normalizes its whole part into Core", async () => {
    // Existing applySeasonalXpToCore accepts any finite nonnegative buffer and
    // normalizes it after adding the new fractional amount; NUMERIC has no <1 constraint.
    const data = { ...beginnerReceipt(), coreBefore: 199, coreAfter: 200, coreGain: 1,
      coreBufferBefore: 1.1, coreBufferAfter: 1.1 + 30 / 45 - 1 };
    const db = writer(data);
    expect(await completeBeginnerReward(db.client, beginnerInput)).toEqual({ ok: true, receipt: data });
    expect(data.coreBufferAfter).toBeCloseTo(0.7666666666666666);
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith("bty_complete_beginner_reward", expect.objectContaining({
      p_user_id: userId, p_run_id: runId, p_score: 0,
    }));
  });

  it("accepts a signed historical weekly balance without changing the fixed new reward", async () => {
    const data = { ...beginnerReceipt(), weeklyXpTotal: -17 };
    const db = writer(data);
    expect(await completeBeginnerReward(db.client, beginnerInput)).toEqual({ ok: true, receipt: data });
    expect(data.seasonalXp).toBe(30);
    expect(db.rpc.mock.calls[0][1]).not.toHaveProperty("p_delta");
  });

  it.each([-0.1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects a nonfinite or negative prior Core buffer %s", async (coreBufferBefore) => {
      const db = writer({ ...beginnerReceipt(), coreBufferBefore });
      expect(await completeBeginnerReward(db.client, beginnerInput)).toEqual({ ok: false, status: 500, error: "XP_AWARD_FAILED" });
    },
  );

  it.each([1, 1.1, -0.1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid post-normalization fractional buffer %s", async (coreBufferAfter) => {
      const db = writer({ ...beginnerReceipt(), coreBufferAfter });
      expect(await completeBeginnerReward(db.client, beginnerInput)).toEqual({ ok: false, status: 500, error: "XP_AWARD_FAILED" });
    },
  );

  it("rejects a new choice receipt that disagrees with current server XP", async () => {
    const db = writer({ ...choiceReceipt(), xp: 37 });
    expect(await recordLegacyChoiceReward(db.client, choiceInput)).toEqual({ ok: false, status: 500, error: "XP_AWARD_FAILED" });
  });

  it("accepts frozen choice XP on replay after current server XP changes", async () => {
    const data = { ...choiceReceipt(), replayed: true, xp: 37 };
    const db = writer(data);
    expect(await recordLegacyChoiceReward(db.client, choiceInput)).toEqual({ ok: true, receipt: data });
    expect(db.rpc.mock.calls[0][1]).toMatchObject({ p_xp: 82 });
  });

  it("rejects a new beginner score that disagrees with current server scoring", async () => {
    const db = writer({ ...beginnerReceipt(), score: 11 });
    expect(await completeBeginnerReward(db.client, beginnerInput)).toEqual({ ok: false, status: 500, error: "XP_AWARD_FAILED" });
  });

  it("rejects new beginner feedback that disagrees with current server feedback", async () => {
    const db = writer({ ...beginnerReceipt(), feedback: { ...feedback, label: "Different new label" } });
    expect(await completeBeginnerReward(db.client, beginnerInput)).toEqual({ ok: false, status: 500, error: "XP_AWARD_FAILED" });
  });

  it("accepts frozen beginner score and feedback after current server policy changes", async () => {
    const data = { ...beginnerReceipt(), replayed: true, score: 11,
      feedback: { band: "aware", label: "Frozen label", message: "Frozen feedback" } };
    const db = writer(data);
    expect(await completeBeginnerReward(db.client, beginnerInput)).toEqual({ ok: true, receipt: data });
    expect(db.rpc.mock.calls[0][1]).toMatchObject({ p_score: 0, p_feedback: feedback });
  });

  it.each(["constructor", "toString", "__proto__"])(
    "sanitizes an unusual database message %s into a numeric500", async (message) => {
      const db = writer(null, { code: "P0001", message });
      expect(await recordLegacyChoiceReward(db.client, choiceInput)).toEqual({ ok: false, status: 500, error: "XP_AWARD_FAILED" });
      expect(await completeBeginnerReward(db.client, beginnerInput)).toEqual({ ok: false, status: 500, error: "XP_AWARD_FAILED" });
    },
  );
});
