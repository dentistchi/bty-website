import { describe, expect, it } from "vitest";
import { isValidLearningEvidence, learningLevel, learningWeek, xpAtLevel } from "./policy";
import type { LearningRewardEvidence } from "./types";

describe("Learning Rewards progression and time boundaries", () => {
  it.each([[1,0],[2,60],[3,180],[4,360],[5,600],[6,900],[10,2100],[20,5100],[50,14100],[51,14400]])("level %i begins at %i", (level, threshold) => {
    expect(xpAtLevel(level)).toBe(threshold);
    expect(learningLevel(threshold).current).toBe(level);
    if (threshold > 0) expect(learningLevel(threshold - 1).current).toBe(level - 1);
  });
  it("returns display progression from the server without a maximum level", () => {
    expect(learningLevel(2099)).toMatchObject({ current: 9, next: 10, xpToNextLevel: 1, nextMilestone: 10 });
    expect(learningLevel(14400)).toMatchObject({ current: 51, next: 52, nextMilestone: null, xpForNextLevel: 300 });
  });
  it.each([-1,NaN,1.1,Infinity])("refuses invalid XP %s", xp => expect(() => learningLevel(xp)).toThrow("INVALID_XP"));
  it("switches weeks at Monday 05:00 local, not midnight", () => {
    expect(learningWeek(new Date("2026-10-26T11:59:59Z"), "America/Los_Angeles").startsAt).toBe("2026-10-19T12:00:00.000Z");
    expect(learningWeek(new Date("2026-10-26T12:00:00Z"), "America/Los_Angeles")).toEqual({ startsAt: "2026-10-26T12:00:00.000Z", endsAt: "2026-11-02T13:00:00.000Z", timezone: "America/Los_Angeles" });
  });
  it("spring and fall weeks have 167 and 169 UTC hours", () => {
    const spring = learningWeek(new Date("2026-03-05T18:00:00Z"), "America/Los_Angeles");
    const fall = learningWeek(new Date("2026-10-30T18:00:00Z"), "America/Los_Angeles");
    expect((Date.parse(spring.endsAt) - Date.parse(spring.startsAt)) / 3600000).toBe(167);
    expect((Date.parse(fall.endsAt) - Date.parse(fall.startsAt)) / 3600000).toBe(169);
  });
  it("supports half-hour timezone offsets and UTC fallback without fixed-offset guesses", () => {
    expect(learningWeek(new Date("2026-10-30T00:00:00Z"), "Asia/Kolkata").startsAt).toBe("2026-10-25T23:30:00.000Z");
    expect(learningWeek(new Date("2026-10-30T00:00:00Z"), "UTC").startsAt).toBe("2026-10-26T05:00:00.000Z");
  });
});

describe("trusted source evidence boundary", () => {
  const now = new Date("2026-10-30T18:00:00Z");
  const baseline = "2026-10-27T18:00:00Z";
  const evidence: LearningRewardEvidence = { policy_version: "learning-rewards/v1", source_type: "assigned_revisit", source_id: "rv-1", assignment_key: "asn-1", content_key: "case-1", content_version: "v1", action: "revisit", completed_at: now.toISOString(), timezone: "America/Los_Angeles", metadata: { revisitBaselineAt: baseline, baselineVariant: "a", revisitVariant: "b" } };
  it("accepts a distinct assigned variant exactly 72 hours later", () => expect(isValidLearningEvidence(evidence, baseline, now)).toBe(true));
  it("refuses 72 hours minus one millisecond", () => expect(isValidLearningEvidence({ ...evidence, completed_at: new Date(now.getTime() - 1).toISOString() }, baseline, now)).toBe(false));
  it("a repeat of the same variant cannot become a Revisit", () => expect(isValidLearningEvidence({ ...evidence, metadata: { ...evidence.metadata, revisitVariant: "a" } }, baseline, now)).toBe(false));
  it("refuses historical backfill, future timestamps and invalid timezone", () => {
    expect(isValidLearningEvidence(evidence, new Date(now.getTime() + 1).toISOString(), now)).toBe(false);
    expect(isValidLearningEvidence({ ...evidence, completed_at: new Date(now.getTime() + 1).toISOString() }, baseline, now)).toBe(false);
    expect(isValidLearningEvidence({ ...evidence, timezone: "invalid-zone" }, baseline, now)).toBe(false);
  });
  it("does not promote a normal practice completion by changing its action", () => expect(isValidLearningEvidence({ ...evidence, source_type: "clinical_practice" }, baseline, now)).toBe(false));
});
