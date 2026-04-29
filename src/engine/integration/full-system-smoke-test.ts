/**
 * On-demand smoke across Arena, Foundry, Center, integrity dashboard, and system health.
 * Uses {@link SMOKE_TEST_USER_ID_ENV} or {@link LOOP_HEALTH_TEST_USER_ID_ENV} when set.
 */

import { randomUUID } from "crypto";

import { getLatestSnapshot } from "@/engine/avatar/avatar-composite-snapshot.service";
import { getEquippedState } from "@/engine/avatar/avatar-equipped-state.service";
import { resolveCompositeAssets, type AvatarManifestTierId } from "@/engine/avatar/avatar-manifest.service";
import { getActiveLearningPath as getFoundryActiveLearningPath } from "@/engine/foundry/learning-path.service";
import { handleChoiceConfirmed, type ChoiceConfirmedEvent } from "@/engine/integration/scenario-outcome-bridge";
import { getNextScenarioForSession } from "@/engine/integration/scenario-type-router";
import { getOnboardingStep } from "@/engine/integration/onboarding-flow.service";
import { getUnreadNotifications } from "@/engine/integration/notification-router.service";
import { validateXPAward } from "@/engine/integration/xp-integrity-bridge";
import { getRecommendations } from "@/engine/foundry/program-recommender.service";
import { getProgramProgress } from "@/engine/foundry/program-completion.service";
import { getDearMePrompt } from "@/engine/foundry/dear-me-recommender.service";
import { getPhaseGateStatus } from "@/engine/healing/healing-content.service";
import { HEALING_PHASE_ORDER, getCurrentPhase } from "@/engine/healing/healing-phase.service";
import { getIntegrityDashboard, type IntegrityDashboard } from "@/engine/integrity/integrity-dashboard.service";
import { buildMentorContext } from "@/engine/rag/mentor-context.service";
import { getResilienceScore } from "@/engine/resilience/resilience-tracker.service";
import {
  fetchAnyEnScenarioId,
  resolveE2ETestUserId,
  seedFixtureUser,
} from "@/engine/integration/e2e-test-fixtures.service";
import { getSystemHealth } from "@/engine/integration/system-health-dashboard.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Preferred env for smoke user (falls back to {@link LOOP_HEALTH_TEST_USER_ID_ENV}). */
export const SMOKE_TEST_USER_ID_ENV = "SMOKE_TEST_USER_ID" as const;
export const LOOP_HEALTH_TEST_USER_ID_ENV = "LOOP_HEALTH_TEST_USER_ID" as const;

const HEALTH_PASS_RATIO_MIN = 0.8;

export type SmokeTestReport = {
  runAt: string;
  arenaOk: boolean;
  foundryOk: boolean;
  centerOk: boolean;
  dashboardOk: boolean;
  healthOk: boolean;
  /** {@link getLatestSnapshot} + {@link getEquippedState} + {@link resolveCompositeAssets} — non-empty composite layers. */
  avatarOk: boolean;
  /** {@link getOnboardingStep} (DB `step_completed` → `highestCompleted`) + {@link getFoundryActiveLearningPath} `path_name`. */
  onboardingOk: boolean;
  /** {@link getUnreadNotifications} array + {@link getResilienceScore} in 0..100. */
  notificationsOk: boolean;
  /** True when all subsystem flags are true. */
  overallOk: boolean;
  /** Human-readable failures and notes. */
  errors: string[];
  details: {
    userId: string;
    arena: {
      nextScenario: "ok" | "null_ejected" | "error";
      validateXp: boolean;
      choiceConfirmed: "ok" | "skipped_no_admin" | "skipped_no_scenario" | "error";
    };
    foundry: { recommendations: boolean; programProgress: boolean; mentorContext: boolean };
    center: { phase: boolean; phaseGate: boolean; dearMe: boolean };
    dashboard: { shapeOk: boolean };
    health: { livePassRatio: number; log24hPassRatio: number | null; log24hTotal: number };
    avatar: {
      snapshotLayerCount: number;
      compositeLayerCount: number;
      equippedUserIdOk: boolean;
    };
    onboarding: {
      /** Mirrors `user_onboarding_progress.step_completed` via {@link getOnboardingStep} `highestCompleted`. */
      highestCompleted: number | null;
      stepCompletedPresent: boolean;
      pathName: string | null;
      pathNameOk: boolean;
    };
    notifications: {
      unreadCount: number;
      unreadIsArray: boolean;
      resilienceScore: number | null;
      resilienceInRange: boolean;
    };
  };
};

function resolveSmokeUserId(): string {
  return resolveE2ETestUserId();
}

function integrityDashboardShapeOk(d: IntegrityDashboard): boolean {
  if (!d || typeof d !== "object") return false;
  if (typeof d.userId !== "string" || typeof d.computedAt !== "string") return false;
  if (!d.airTrend || typeof d.airTrend !== "object") return false;
  if (!d.promotionReadiness || typeof d.promotionReadiness !== "object") return false;
  if (!d.certified || typeof d.certified !== "object") return false;
  if (!Array.isArray(d.renewalHistory)) return false;
  if (!d.integrityScoreCard || typeof d.integrityScoreCard !== "object") return false;
  if (typeof d.integrityScoreCard.userId !== "string" || typeof d.integrityScoreCard.grade !== "string") return false;
  return true;
}

async function fetchAnyScenarioId(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>): Promise<string | null> {
  return fetchAnyEnScenarioId(admin);
}

async function fetchAnyProgramId(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>): Promise<string | null> {
  const { data, error } = await admin.from("program_catalog").select("program_id").limit(1).maybeSingle();
  if (error || !data) return null;
  const id = (data as { program_id?: string }).program_id;
  return typeof id === "string" ? id : null;
}

/**
 * Runs the full smoke battery (service-role DB when available). Persists to `smoke_test_log` if admin client works.
 */
export async function runSmokeTest(): Promise<SmokeTestReport> {
  await seedFixtureUser();
  const runAt = new Date().toISOString();
  const errors: string[] = [];
  const userId = resolveSmokeUserId();
  const admin = getSupabaseAdmin();

  const details: SmokeTestReport["details"] = {
    userId,
    arena: {
      nextScenario: "error",
      validateXp: false,
      choiceConfirmed: "skipped_no_admin",
    },
    foundry: { recommendations: false, programProgress: false, mentorContext: false },
    center: { phase: false, phaseGate: false, dearMe: false },
    dashboard: { shapeOk: false },
    health: { livePassRatio: 0, log24hPassRatio: null, log24hTotal: 0 },
    avatar: { snapshotLayerCount: 0, compositeLayerCount: 0, equippedUserIdOk: false },
    onboarding: {
      highestCompleted: null,
      stepCompletedPresent: false,
      pathName: null,
      pathNameOk: false,
    },
    notifications: {
      unreadCount: 0,
      unreadIsArray: false,
      resilienceScore: null,
      resilienceInRange: false,
    },
  };

  let arenaOk = false;
  let foundryOk = false;
  let centerOk = false;
  let dashboardOk = false;
  let healthOk = false;
  let avatarOk = false;
  let onboardingOk = false;
  let notificationsOk = false;

  if (!admin) {
    errors.push("Supabase service role not configured; Foundry/Center/Arena DB steps may be skipped.");
  }

  // —— Arena ——
  try {
    const route = await getNextScenarioForSession(userId, "en");
    if (route === null) {
      details.arena.nextScenario = "null_ejected";
      errors.push("Arena: user appears ejected — getNextScenarioForSession returned null (still a valid response).");
    } else {
      details.arena.nextScenario = "ok";
    }
    const c0 = await validateXPAward(userId, "core", 0);
    const w0 = await validateXPAward(userId, "weekly", 0);
    details.arena.validateXp = c0.allowed && w0.allowed && c0.blockedReason === "none" && w0.blockedReason === "none";
    if (!details.arena.validateXp) errors.push("Arena: validateXPAward(0) unexpected result.");

    if (admin) {
      const scenarioId = await fetchAnyScenarioId(admin);
      if (!scenarioId) {
        details.arena.choiceConfirmed = "skipped_no_scenario";
        errors.push("Arena: no scenario row in DB — skipped handleChoiceConfirmed.");
      } else {
        const runToken = randomUUID();
        const event: ChoiceConfirmedEvent = {
          scenarioId,
          choiceId: `smoke_${runToken}`,
          flagType: "CLEAN",
          playedAt: new Date(),
          xp: { core: 0, weekly: 0 },
          sessionResult: {
            scenarioType: "smoke_synthetic",
            previousAir: 0.5,
            newAir: 0.51,
            occurredAt: new Date(),
          },
          air: {
            newAir: 0.51,
            previousAir: 0.5,
            previousAirRecordedAt: new Date(),
          },
        };
        await handleChoiceConfirmed(userId, event);
        details.arena.choiceConfirmed = "ok";
      }
    } else {
      details.arena.choiceConfirmed = "skipped_no_admin";
      errors.push("Arena: skipped handleChoiceConfirmed (no admin client).");
    }

    arenaOk =
      details.arena.validateXp &&
      (details.arena.nextScenario === "ok" || details.arena.nextScenario === "null_ejected") &&
      (details.arena.choiceConfirmed === "ok" ||
        details.arena.choiceConfirmed === "skipped_no_scenario" ||
        details.arena.choiceConfirmed === "skipped_no_admin");
  } catch (e) {
    arenaOk = false;
    errors.push(`Arena: ${e instanceof Error ? e.message : String(e)}`);
  }

  // —— Foundry ——
  if (admin) {
    try {
      await getRecommendations(userId, admin);
      details.foundry.recommendations = true;
    } catch (e) {
      errors.push(`Foundry getRecommendations: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      const programId = await fetchAnyProgramId(admin);
      if (programId) {
        await getProgramProgress(userId, programId, admin);
      }
      details.foundry.programProgress = true;
    } catch (e) {
      details.foundry.programProgress = false;
      errors.push(`Foundry getProgramProgress: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      await buildMentorContext(userId, admin);
      details.foundry.mentorContext = true;
    } catch (e) {
      errors.push(`Foundry buildMentorContext: ${e instanceof Error ? e.message : String(e)}`);
    }
    foundryOk = details.foundry.recommendations && details.foundry.programProgress && details.foundry.mentorContext;
  } else {
    errors.push("Foundry: skipped (no admin).");
  }

  // —— Center ——
  if (admin) {
    try {
      await getCurrentPhase(userId, admin);
      details.center.phase = true;
    } catch (e) {
      errors.push(`Center getCurrentPhase: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      await getPhaseGateStatus(userId, HEALING_PHASE_ORDER[0], admin);
      details.center.phaseGate = true;
    } catch (e) {
      errors.push(`Center getPhaseGateStatus: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      await getDearMePrompt(userId, admin);
      details.center.dearMe = true;
    } catch (e) {
      errors.push(`Center getDearMePrompt: ${e instanceof Error ? e.message : String(e)}`);
    }
    centerOk = details.center.phase && details.center.phaseGate && details.center.dearMe;
  } else {
    errors.push("Center: skipped (no admin).");
  }

  // —— Integrity dashboard ——
  try {
    const dash = await getIntegrityDashboard(userId, null);
    details.dashboard.shapeOk = integrityDashboardShapeOk(dash);
    dashboardOk = details.dashboard.shapeOk;
    if (!dashboardOk) errors.push("Dashboard: integrity shape check failed (required objects missing).");
  } catch (e) {
    errors.push(`Dashboard: ${e instanceof Error ? e.message : String(e)}`);
  }

  // —— System health ——
  try {
    const health = await getSystemHealth({ bypassCache: true });
    const checks = health.loopHealth.checks;
    const livePass = checks.filter((c) => c.status === "PASS").length;
    const liveRatio = checks.length === 0 ? 0 : livePass / checks.length;
    details.health.livePassRatio = liveRatio;
    details.health.log24hPassRatio = health.loopHealthLog24h.passRatio;
    details.health.log24hTotal = health.loopHealthLog24h.totalRows;

    const liveOk = checks.length === 0 ? false : liveRatio >= HEALTH_PASS_RATIO_MIN;
    const log24Ok =
      health.loopHealthLog24h.totalRows === 0 || health.loopHealthLog24h.passRatio >= HEALTH_PASS_RATIO_MIN;
    healthOk = liveOk && log24Ok;
    if (!liveOk) errors.push(`Health: live loop checks pass ratio ${liveRatio.toFixed(3)} < ${HEALTH_PASS_RATIO_MIN}.`);
    if (!log24Ok && health.loopHealthLog24h.totalRows > 0) {
      errors.push(
        `Health: 24h loop_health_log pass ratio ${health.loopHealthLog24h.passRatio.toFixed(3)} < ${HEALTH_PASS_RATIO_MIN}.`,
      );
    }
    if (checks.length === 0) errors.push("Health: loopHealth.checks empty (unexpected).");
  } catch (e) {
    errors.push(`Health: ${e instanceof Error ? e.message : String(e)}`);
  }

  // —— Avatar ——
  if (admin) {
    try {
      const snapshot = await getLatestSnapshot(userId, admin);
      const equipped = await getEquippedState(userId, admin);
      const tier = snapshot.tier as AvatarManifestTierId;
      const composite = resolveCompositeAssets(tier, [], []);
      details.avatar.snapshotLayerCount = snapshot.layers.length;
      details.avatar.compositeLayerCount = composite.length;
      details.avatar.equippedUserIdOk = equipped.user_id === userId;
      const layersOk = snapshot.layers.length >= 1 && composite.length >= 1;
      if (!layersOk) {
        errors.push(
          `Avatar: expected non-empty layers (snapshot=${snapshot.layers.length}, composite=${composite.length}).`,
        );
      }
      if (!details.avatar.equippedUserIdOk) {
        errors.push("Avatar: getEquippedState user_id mismatch.");
      }
      avatarOk = layersOk && details.avatar.equippedUserIdOk;
    } catch (e) {
      errors.push(`Avatar: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    errors.push("Avatar: skipped (no admin).");
  }

  // —— Onboarding + Foundry learning path ——
  if (admin) {
    try {
      const ob = await getOnboardingStep(userId, admin);
      details.onboarding.highestCompleted = ob.highestCompleted;
      details.onboarding.stepCompletedPresent =
        Number.isFinite(ob.highestCompleted) && ob.highestCompleted >= 0 && ob.highestCompleted <= 5;
      const path = await getFoundryActiveLearningPath(userId, { supabase: admin });
      details.onboarding.pathName = path.path_name;
      details.onboarding.pathNameOk =
        typeof path.path_name === "string" && path.path_name.length > 0;
      if (!details.onboarding.stepCompletedPresent) {
        errors.push("Onboarding: step_completed / highestCompleted missing or out of range.");
      }
      if (!details.onboarding.pathNameOk) {
        errors.push("Onboarding: getActiveLearningPath path_name not defined.");
      }
      onboardingOk = details.onboarding.stepCompletedPresent && details.onboarding.pathNameOk;
    } catch (e) {
      errors.push(`Onboarding: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    errors.push("Onboarding: skipped (no admin).");
  }

  // —— Notifications + resilience ——
  if (admin) {
    try {
      const unread = await getUnreadNotifications(userId, admin);
      details.notifications.unreadIsArray = Array.isArray(unread);
      details.notifications.unreadCount = unread.length;
      if (!details.notifications.unreadIsArray) {
        errors.push("Notifications: getUnreadNotifications must return an array.");
      }
      const res = await getResilienceScore(userId, { supabase: admin, persist: false });
      details.notifications.resilienceScore = res.score;
      details.notifications.resilienceInRange =
        Number.isFinite(res.score) && res.score >= 0 && res.score <= 100;
      if (!details.notifications.resilienceInRange) {
        errors.push(`Notifications: resilience score out of 0..100 (got ${String(res.score)}).`);
      }
      notificationsOk =
        details.notifications.unreadIsArray && details.notifications.resilienceInRange;
    } catch (e) {
      errors.push(`Notifications: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    errors.push("Notifications: skipped (no admin).");
  }

  const overallOk =
    arenaOk &&
    foundryOk &&
    centerOk &&
    dashboardOk &&
    healthOk &&
    avatarOk &&
    onboardingOk &&
    notificationsOk;

  const report: SmokeTestReport = {
    runAt,
    arenaOk,
    foundryOk,
    centerOk,
    dashboardOk,
    healthOk,
    avatarOk,
    onboardingOk,
    notificationsOk,
    overallOk,
    errors,
    details,
  };

  await persistSmokeLog(report);
  return report;
}

async function persistSmokeLog(report: SmokeTestReport): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    console.warn("[smoke-test] smoke_test_log insert skipped (no admin).");
    return;
  }
  const { error } = await admin.from("smoke_test_log").insert({
    run_at: report.runAt,
    arena_ok: report.arenaOk,
    foundry_ok: report.foundryOk,
    center_ok: report.centerOk,
    dashboard_ok: report.dashboardOk,
    health_ok: report.healthOk,
    avatar_ok: report.avatarOk,
    onboarding_ok: report.onboardingOk,
    notifications_ok: report.notificationsOk,
    details: {
      overall_ok: report.overallOk,
      errors: report.errors,
      ...report.details,
    },
  });
  if (error) console.warn("[smoke-test] smoke_test_log insert failed:", error.message);
}
