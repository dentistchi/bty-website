/**
 * domain/index — barrel re-exports 검증 (비즈니스/XP 미변경).
 */
import { describe, it, expect } from "vitest";
import * as domain from "./index";

describe("domain/index", () => {
  it("re-exports constants", () => {
    expect(domain.CORE_XP_PER_TIER).toBe(10);
    expect(domain.CODE_NAMES).toBeDefined();
    expect(domain.CODE_NAMES).toHaveLength(7);
  });

  it("re-exports dojo flow helpers", () => {
    expect(typeof domain.validateDojo50Submit).toBe("function");
    expect(typeof domain.computeDojo50Result).toBe("function");
    expect(domain.DOJO_50_AREAS).toBeDefined();
  });

  it("re-exports rules", () => {
    expect(domain.tierFromCoreXp).toBeDefined();
    expect(typeof domain.tierFromCoreXp).toBe("function");
  });

  it("re-exports dashboard RECOMMENDATION_SOURCE_ORDER (C3 도메인)", () => {
    expect(domain.RECOMMENDATION_SOURCE_ORDER).toEqual(["arena", "foundry", "center"]);
  });

  it("re-exports SEASON_CARRYOVER_FRACTION from constants (C3 도메인)", () => {
    expect(domain.SEASON_CARRYOVER_FRACTION).toBe(0.1);
  });

  it("re-exports leadership-engine + foundry barrel (AIR stage threshold, STAGE_1)", () => {
    expect(domain.AIR_THRESHOLD_STAGE_ESCALATION).toBe(0.5);
    expect(domain.STAGE_1).toBe(1);
    expect(typeof domain.validateDojo50Submit).toBe("function");
  });

  it("re-exports arena tiebreak + center letter + healing phase (barrel 232)", () => {
    expect(typeof domain.rankByWeeklyXpWithTieBreak).toBe("function");
    expect(domain.validateLetterBody("x").ok).toBe(true);
    expect(domain.HEALING_PHASE_I_LABEL).toBe("Phase I");
  });

  it("re-exports leadership-engine STAGE_PROGRESS + AIR bands via barrel (233)", () => {
    expect(domain.STAGE_PROGRESS_PERCENT).toBeDefined();
    expect(domain.STAGE_PROGRESS_PERCENT?.[1]).toBe(25);
    expect(domain.AIR_BAND_IDS).toEqual(["low", "mid", "high"]);
  });

  it("barrel 234: LE forced-reset + center letter/resilience + healing vs dojo", () => {
    expect(typeof domain.evaluateForcedReset).toBe("function");
    expect(domain.energyToLevel(5)).toBe("high");
    expect(domain.LETTER_BODY_MAX_LENGTH).toBe(10_000);
    expect(domain.AWAKENING_ACT_NAMES[1]).toBe("Reflection Chamber");
    expect(domain.DOJO_50_AREAS).toHaveLength(5);
  });

  it("barrel: arena tiebreak + center CTA + xp conversion (C3 CONTINUE)", () => {
    expect(typeof domain.compareWeeklyXpTieBreak).toBe("function");
    expect(domain.getCenterCtaHref("ko")).toBe("/ko/bty");
    expect(domain.seasonalToCoreConversion(45, 100).coreGain).toBe(1);
  });

  it("barrel 235: certified + dear-me path + weekly step", () => {
    expect(typeof domain.certifiedStatus).toBe("function");
    expect(domain.getDearMeHref("en")).toBe("/en/dear-me");
    expect(domain.WEEKLY_LEVEL_STEP).toBe(100);
  });

  it("barrel 236: weekly elite, stage cap, AIR threshold, and healing label", () => {
    expect(domain.isElite(1, 10)).toBe(true);
    expect(domain.stageFromCoreXp(9999)).toBe(7);
    expect(domain.AIR_THRESHOLD_STAGE_ESCALATION).toBe(0.5);
    expect(domain.HEALING_PHASE_RING_TYPE).toBe("phase_ring");
  });

  it("barrel 237: weekly reset idempotency, competition display, certified gap, dojo→integrity", () => {
    expect(typeof domain.ledgerStateAfterWeeklyBoundaryReset).toBe("function");
    expect(typeof domain.weeklyCompetitionDisplay).toBe("function");
    expect(typeof domain.certifiedReadinessNextGap).toBe("function");
    expect(domain.validateIntegritySubmit({ text: "a" }).ok).toBe(true);
  });

  it("barrel 238: LE run-result stage, healing awakening guard", () => {
    expect(typeof domain.leStageDisplayForArenaRunResult).toBe("function");
    expect(domain.nextHealingAwakeningActAfter([])).toBe(1);
    expect(domain.isValidHealingAwakeningActId(2)).toBe(true);
  });

  it("barrel 239: weekly LE summary, AIR/TII normalize, elite mentor queue, awakening complete guard", () => {
    expect(typeof domain.leStageDisplayWithWeeklySummary).toBe("function");
    expect(typeof domain.normalizeDashboardAirTiiSummary).toBe("function");
    expect(domain.canEliteMentorAdminTransition("pending", "approved")).toBe(true);
    expect(domain.canCompleteHealingAwakeningAct(2, [1])).toBe(true);
  });

  it("barrel 240: mentor decision, LE label key, AIR 90d, awakening history", () => {
    expect(domain.applyEliteMentorAdminDecision("pending", "approve")).toBe("approved");
    expect(domain.leStageSummaryLabelKey({ stage: 1, weeklyRuns: 10, cumulativeRuns: 0 })).toContain(
      "strong"
    );
    expect(
      domain.normalizeDashboardAirTiiRollingSummary({ air_90d: 0.2 }).band_90d
    ).toBe("low");
    expect(domain.isHealingAwakeningCompletionHistoryValid([1, 2])).toBe(true);
  });

  it("barrel 241: week_id, live order, elite queue sort, awakening unlock", () => {
    expect(domain.isLeaderboardWeekIdKey("2025-03-10")).toBe(true);
    expect(typeof domain.compareEliteMentorQueueRows).toBe("function");
    expect(domain.healingAwakeningNextUnlockedAfterCompleting(1, [])).toBe(2);
  });

  it("barrel 242: core display key, elite terminal key, awakening all complete", () => {
    expect(domain.coreXpProfileDisplayLevelKey(0)).toContain("level_1");
    expect(domain.eliteMentorRequestTerminalLabelKey("approved")).toContain("approved");
    expect(domain.isHealingAwakeningAllActsComplete([1, 2, 3])).toBe(true);
  });

  it("barrel 243: run duplicate, stale pending, week end ISO, healing %", () => {
    expect(domain.isDuplicateArenaRunCompletion("x", new Set(["x"]))).toBe(true);
    expect(domain.utcWeekIdToSundayEndIso("2025-03-10")).toContain("2025-03-16");
    expect(domain.healingAwakeningProgressPercent([1, 2])).toBe(67);
  });

  it("barrel 244: dojo set contract, elite cap, healing mismatch key", () => {
    const ids = Array.from({ length: 50 }, (_, i) => i + 1);
    expect(
      domain.validateDojo50QuestionSetContract({
        setVersion: domain.DOJO_50_QUESTION_SET_VERSION,
        questionIds: ids,
      }).ok
    ).toBe(true);
    expect(domain.canEliteMentorApproveWithoutCapViolation(5)).toBe(false);
    expect(
      domain.healingProgressGetPostMismatchMessageKey({
        getProgressPercent: 0,
        postClaimedPercent: 100,
      })
    ).toBe("healing_sync_mismatch_client_ahead");
  });

  it("barrel 245: tier code key, run phase, mentor dup, second awakening", () => {
    expect(domain.coreXpTierDisplayCodeKey(0)).toContain("code_0");
    expect(
      domain.arenaRunLifecyclePhase({
        startedAt: "a",
        completedAt: "b",
        abortedAt: undefined,
      })
    ).toBe("completed");
    expect(domain.eliteMentorDuplicateApplicationBlockKey("pending")).toBeTruthy();
    expect(
      domain.isSecondAwakeningEligible({
        phaseTwoUnlocked: true,
        daysSinceEnrollment: 30,
        sessionCount: 10,
        allAwakeningActsComplete: false,
      })
    ).toBe(true);
  });

  it("barrel 246: xp dedup, scenario keys, nearMe contiguous, healing block", () => {
    expect(domain.xpAwardEventDedupKey("u", "s", "1")).toContain("|");
    expect(domain.scenarioDifficultyDisplayKey("hard")).toContain("hard");
    expect(domain.leaderboardNearMeRanksAreContiguous([{ rank: 1 }, { rank: 2 }])).toBe(
      true
    );
    expect(domain.healingAwakeningActBlockedMessageKey(3, [])).toContain("order");
  });

  it("barrel 247: weekly display, reflect hint, elite SLA, awakening complete keys", () => {
    expect(
      domain.weeklyLeaderboardResetDaysRemaining(
        0,
        "2099-01-01T00:00:00.000Z"
      )
    ).toBeGreaterThan(0);
    expect(domain.reflectTextLengthHintKey(0, 1000)).toContain("empty");
    expect(typeof domain.eliteMentorResponseSlaWarningKey).toBe("function");
    expect(domain.secondAwakeningJourneyCompleteMessageKeys([1, 2, 3])).toBeTruthy();
  });

  it("barrel 248: weekly tier label key, run state label key, healing act progress clamp", () => {
    expect(domain.weeklyTierDisplayLabelKey("Gold")).toBe("arena.leaderboard.weeklyTierGold");
    expect(domain.arenaRunStateDisplayLabelKey("in_progress")).toBe(
      "arena.run.stateInProgress",
    );
    expect(domain.clampHealingAwakeningActProgressDisplayPercent(101)).toBe(100);
  });

  it("barrel 249: reflect bounds, runs cursor, elite status label, awakening lock", () => {
    expect(domain.REFLECT_USER_TEXT_MAX_CHARS).toBe(24_000);
    expect(domain.REFLECT_USER_TEXT_RECOMMENDED_MIN_CHARS).toBe(3600);
    expect(domain.parseRunsListCursorOrNull("not-valid")).toBeNull();
    expect(domain.eliteMentorRequestStatusDisplayLabelKey("approved")).toBe(
      "elite_mentor_status_approved",
    );
    expect(domain.healingAwakeningActLockReasonDisplayKey(2, [])).toBe(
      "healing_act_lock_prerequisite",
    );
  });

  it("barrel 250: tie-break, display keys, empty reco, run skeleton, resilience labels", () => {
    const tied = [
      { weeklyXp: 50, updatedAt: "2026-01-02T00:00:00Z", userId: "later" },
      { weeklyXp: 50, updatedAt: "2026-01-01T00:00:00Z", userId: "earlier" },
    ];
    const ranked = domain.rankByWeeklyXpWithTieBreak(tied);
    expect(ranked[0].userId).toBe("earlier");
    expect(domain.leaderboardTieRankSuffixDisplayKey(true)).toBe("arena.leaderboard.tieRankSuffix");
    expect(domain.DASHBOARD_RECOMMENDATION_EMPTY_PLACEHOLDER_KEY).toBe(
      "dashboard.recommendation.empty_placeholder",
    );
    expect(domain.arenaRunDetailSkeletonDisplayKey("empty")).toBe("arena.run_detail.empty");
    expect(domain.resilienceLevelDisplayLabelKey("mid")).toBe("center.resilience.level_mid");
  });

  it("barrel 251: weekly stage-band label, LE clamp, scenario code id, healing path blocked", () => {
    expect(domain.weeklyCompetitionStageTierBandDisplayLabelKey("Silver")).toBe(
      "arena.weekly_competition.stage_band_silver",
    );
    expect(domain.WEEKLY_COMPETITION_STAGE_TIER_DISPLAY_LABEL_KEY).toContain("stage_tier");
    expect(domain.clampDashboardLeProgressDisplayPercent(-1)).toBe(0);
    expect(domain.clampDashboardLeProgressDisplayPercent(150)).toBe(100);
    expect(domain.isValidArenaScenarioCodeId("patient_refuses_treatment_001")).toBe(true);
    expect(domain.isValidArenaScenarioCodeId("X")).toBe(false);
    expect(domain.healingPathProgressBlockedUserDisplayKey("phase_requirement_not_met")).toBe(
      domain.HEALING_PROGRESS_BLOCKED_PHASE_DISPLAY_KEY,
    );
    expect(domain.HEALING_PROGRESS_BLOCKED_COOLDOWN_DISPLAY_KEY).toContain("cooldown");
  });
});
