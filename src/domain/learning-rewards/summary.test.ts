import { describe, expect, it } from "vitest";
import { projectLearningRewards } from "./summary";
import type { LearningRewardCompletion, LearningRewardLedgerEntry } from "./types";
const now = new Date("2026-10-30T18:00:00Z");
const completion = (over: Partial<LearningRewardCompletion> = {}): LearningRewardCompletion => ({ id: "c-1", policy_version: "learning-rewards/v1", source_type: "foundry_learn", source_id: "p-1", assignment_key: "a-1", content_key: "module-1", content_version: "v1", action: "learn", completed_at: "2026-10-30T17:00:00.000Z", timezone: "UTC", bty_day: "2026-10-30", metadata: {}, xp: 10, disposition: "awarded", ...over });
const entry = (over: Partial<LearningRewardLedgerEntry> = {}): LearningRewardLedgerEntry => ({ id: "l-1", completion_id: "c-1", xp: 10, occurred_at: "2026-10-30T17:00:00.000Z", bty_day: "2026-10-30", timezone: "UTC", ...over });
const project = (completions: LearningRewardCompletion[] = [], ledger: LearningRewardLedgerEntry[] = [], featuredBadgeId?: string) => projectLearningRewards({ completions, ledger, timezone: "UTC", now, featuredBadgeId });

describe("Learning Rewards evidence projection", () => {
  it("a proven-empty ledger is Level 1 and twelve honest unearned badges", () => {
    const s = project();
    expect(s.totalXp).toBe(0);
    expect(s.weeklyXp).toBe(0);
    expect(s.level.current).toBe(1);
    expect(s.badges).toHaveLength(12);
    expect(s.badges.every(b => b.earnedAt == null)).toBe(true);
    expect(s.team.status).toBe("unavailable");
    expect(s.badges.filter(b => !b.available).map(b => b.id)).toEqual(["circle", "second", "patient", "insight", "together"]);
  });
  it("daily capped learning still earns evidence badges without awarding XP", () => {
    const s = project([completion({ xp: 0, disposition: "daily_cap" })]);
    expect(s.totalXp).toBe(0);
    expect(s.badges.find(b => b.id === "first")?.earnedAt).toBe("2026-10-30T17:00:00.000Z");
  });
  it("weekly XP is a window of the same permanent ledger, with an exclusive next boundary", () => {
    const ledger = [entry({ id: "old", xp: 20, occurred_at: "2026-10-26T04:59:59.999Z" }), entry({ id: "start", xp: 20, occurred_at: "2026-10-26T05:00:00.000Z" }), entry({ id: "end", xp: 20, occurred_at: "2026-11-02T05:00:00.000Z" })];
    const s = project([], ledger);
    expect(s.totalXp).toBe(60);
    expect(s.weeklyXp).toBe(20);
    expect(s.weeklyGoalReached).toBe(false);
  });
  it("PostgreSQL +00:00 and nonzero-offset timestamps respect exact inclusive/exclusive boundaries", () => {
    const ledger = [entry({ id: "start", xp: 10, occurred_at: "2026-10-26T05:00:00+00:00" }), entry({ id: "end", xp: 20, occurred_at: "2026-11-02T05:00:00+00:00" }), entry({ id: "offset", xp: 10, occurred_at: "2026-10-26T00:00:00-05:00" })];
    expect(project([], ledger).weeklyXp).toBe(20);
  });
  it("chronology uses instants rather than timestamp spelling for badge earned dates", () => {
    const rows = [completion({ id: "later", completed_at: "2026-10-29T22:00:00-07:00" }), completion({ id: "earlier", completed_at: "2026-10-30T04:00:00+00:00" })];
    expect(project(rows).badges.find(b => b.id === "first")?.earnedAt).toBe("2026-10-30T04:00:00+00:00");
  });
  it("Clinical Explorer counts distinct cases, not repeated traces or answer agreement", () => {
    const rows = Array.from({ length: 5 }, (_, i) => completion({ id: `c${i}`, source_type: "clinical_practice", action: "practice", metadata: { clinicalCaseId: `case-${i}` } }));
    const repeated = completion({ id: "repeat", source_type: "clinical_practice", action: "practice", metadata: { clinicalCaseId: "case-0" } });
    const s = project([...rows, repeated]);
    expect(s.badges.find(b => b.id === "clinical")).toMatchObject({ progress: 5, earnedAt: expect.any(String) });
  });
  it("follow-up badges count distinct assignments while 30-day evidence stays separate", () => {
    const rows = [completion({ action: "followup", source_type: "foundry_followup", assignment_key: "a1" }), completion({ id: "c2", action: "followup", source_type: "foundry_followup", assignment_key: "a1", metadata: { followupDays: 30 } }), completion({ id: "c3", action: "followup", source_type: "foundry_followup", assignment_key: "a2" })];
    const s = project(rows);
    expect(s.badges.find(b => b.id === "follow")).toMatchObject({ progress: 2, earnedAt: null });
    expect(s.badges.find(b => b.id === "return")?.earnedAt).not.toBeNull();
  });
  it("Full Circle requires all four required steps in the SAME authored module version", () => {
    const metadata = { moduleKey: "m", requiredSteps: ["learn", "practice", "revisit", "followup"] as LearningRewardCompletion["action"][] };
    const rows = (["learn", "practice", "revisit", "followup"] as const).map((action, i) => completion({ id: `m${i}`, action, metadata }));
    expect(project(rows).badges.find(b => b.id === "circle")?.earnedAt).not.toBeNull();
    expect(project(rows.map((row, i) => i === 3 ? { ...row, content_version: "v2" } : row)).badges.find(b => b.id === "circle")?.earnedAt).toBeNull();
    expect(project(rows.map(row => ({ ...row, metadata: { moduleKey: "m" } }))).badges.find(b => b.id === "circle")?.earnedAt).toBeNull();
  });
  it("four learning weeks need not be consecutive and breaks do not erase progress", () => {
    const days = ["2026-09-01", "2026-09-15", "2026-10-01", "2026-10-30"];
    const ledger = days.map((day, i) => entry({ id: `week${i}`, xp: 60, occurred_at: `${day}T17:00:00.000Z` }));
    expect(project([], ledger).badges.find(b => b.id === "weeks")).toMatchObject({ progress: 4, earnedAt: "2026-10-30T17:00:00.000Z" });
  });
  it("communication paths count distinct modules, not three versions of one module", () => {
    const rows = ["v1", "v2", "v3"].flatMap(version => (["learn", "practice", "revisit", "followup"] as const).map((action, i) => completion({ id: `${version}-${i}`, action, content_version: version, metadata: { moduleKey: "same-module", path: "patient-communication", requiredSteps: ["learn", "practice", "revisit", "followup"] } })));
    expect(project(rows).badges.find(b => b.id === "patient")).toMatchObject({ progress: 1, earnedAt: null });
  });
  it("2,099→2,100 produces the Level 10 badge and milestone without bonus XP", () => {
    const s = project([], [entry({ xp: 2099, occurred_at: "2026-10-29T17:00:00.000Z" }), entry({ id: "next", xp: 1 })]);
    expect(s.totalXp).toBe(2100);
    expect(s.level.current).toBe(10);
    expect(s.recentAchievements.filter(a => a.earnedAt === "2026-10-30T17:00:00.000Z").map(a => a.id)).toEqual(["badge:level10", "level:10"]);
  });
  it("a profile feature can only reference an earned badge", () => {
    expect(project([], [], "level50").featuredBadgeId).toBeNull();
    expect(project([completion()], [], "first").featuredBadgeId).toBe("first");
  });
});
