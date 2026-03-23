/**
 * Final pre-release validator: orchestrates smoke, extended health, final wiring, i18n audit,
 * avatar subsystem checks, and integrity scorecard validation.
 * Persists one row per run to `release_readiness_log`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnimationStats } from "@/engine/avatar/avatar-animation-log.service";
import { getLatestSnapshot } from "@/engine/avatar/avatar-composite-snapshot.service";
import {
  EQUIPPED_SLOT_COUNT,
  getEquippedState,
  type EquippedState,
} from "@/engine/avatar/avatar-equipped-state.service";
import { getOutfitLayers, type AvatarManifestTierId } from "@/engine/avatar/avatar-manifest.service";
import { getOutfitUnlockProgress, OUTFIT_UNLOCK_CARD_ORDER } from "@/engine/avatar/avatar-outfit-unlock.service";
import type { ExtendedHealthReport } from "@/engine/integrity/e2e-loop-validator.service";
import { runExtendedHealthCheck } from "@/engine/integrity/e2e-loop-validator.service";
import { runFinalWiringCheck, type WiringReport } from "@/engine/integration/final-wiring-check";
import { runSmokeTest, type SmokeTestReport } from "@/engine/integration/full-system-smoke-test";
import { resolveE2ETestUserId, seedFixtureUser } from "@/engine/integration/e2e-test-fixtures.service";
import { getIntegrityScoreCard, type IntegrityGrade } from "@/engine/integration/integrity-score-card.service";
import { runI18nAudit, type I18nAuditReport } from "@/engine/integration/i18n-completeness-validator";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Minimum PASS ratio across base + extended loop health checks. */
export const RELEASE_READINESS_HEALTH_PASS_RATIO_MIN = 0.8 as const;

const EXPECTED_OUTFIT_PROGRESS_ENTRIES = OUTFIT_UNLOCK_CARD_ORDER.length;

const INTEGRITY_GRADES = new Set<IntegrityGrade>(["A", "B", "C", "D"]);

export type ReleaseReadinessReport = {
  runAt: string;
  smokeOk: boolean;
  healthOk: boolean;
  wiringOk: boolean;
  i18nOk: boolean;
  avatarOk: boolean;
  scorecardOk: boolean;
  allClear: boolean;
  /** Combined PASS / (base.checks + extendedChecks). */
  healthPassRatio: number;
  healthChecksPass: number;
  healthChecksTotal: number;
  blockers: string[];
  smoke?: SmokeTestReport | null;
  extendedHealth?: ExtendedHealthReport | null;
  wiring?: WiringReport | null;
  i18n?: I18nAuditReport | null;
  phaseErrors: Partial<
    Record<"smoke" | "extendedHealth" | "wiring" | "i18n" | "avatar" | "scorecard", string>
  >;
};

export function extendedHealthPassRatio(r: ExtendedHealthReport): number {
  const rows = [...r.base.checks, ...r.extendedChecks];
  if (rows.length === 0) return 0;
  return rows.filter((c) => c.status === "PASS").length / rows.length;
}

function resolveTestUserId(): string {
  return resolveE2ETestUserId();
}

function equippedMatchesOutfitManifestZIndex(tier: AvatarManifestTierId, equipped: EquippedState): boolean {
  const layers = getOutfitLayers(tier);
  const validZ = new Set(layers.map((l) => l.z_index));
  for (let i = 0; i < EQUIPPED_SLOT_COUNT; i++) {
    const id = equipped.equipped_asset_ids[i];
    if (id != null && String(id).trim() !== "" && !validZ.has(i)) {
      return false;
    }
  }
  for (const s of equipped.slots) {
    if (!validZ.has(s.slot_index)) return false;
  }
  return true;
}

async function runAvatarAndScorecardChecks(
  testUserId: string,
  admin: SupabaseClient | null,
): Promise<{
  avatarOk: boolean;
  scorecardOk: boolean;
  avatarFailures: string[];
  scorecardFailures: string[];
}> {
  const avatarFailures: string[] = [];
  const scorecardFailures: string[] = [];

  if (!admin) {
    avatarFailures.push("Supabase admin client unavailable");
    scorecardFailures.push("Supabase admin client unavailable");
    return { avatarOk: false, scorecardOk: false, avatarFailures, scorecardFailures };
  }

  try {
    const snapshot = await getLatestSnapshot(testUserId, admin);
    if (snapshot.layers.length < 1) {
      avatarFailures.push(`getLatestSnapshot: expected layers.length >= 1, got ${snapshot.layers.length}`);
    }

    const equipped = await getEquippedState(testUserId, admin);
    const tier = snapshot.tier;
    if (!equippedMatchesOutfitManifestZIndex(tier, equipped)) {
      avatarFailures.push(
        `getEquippedState: slot indices must match OUTFIT_MANIFEST z_index set for tier ${tier}`,
      );
    }

    const outfitProgress = await getOutfitUnlockProgress(testUserId, admin);
    if (outfitProgress.length !== EXPECTED_OUTFIT_PROGRESS_ENTRIES) {
      avatarFailures.push(
        `getOutfitUnlockProgress: expected ${EXPECTED_OUTFIT_PROGRESS_ENTRIES} entries, got ${outfitProgress.length}`,
      );
    }

    try {
      await getAnimationStats(testUserId, admin, 30);
    } catch (e) {
      avatarFailures.push(`getAnimationStats: threw ${e instanceof Error ? e.message : String(e)}`);
    }
  } catch (e) {
    avatarFailures.push(`avatar bundle: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const card = await getIntegrityScoreCard(testUserId, { supabase: admin });
    const g = card.grade ?? card.overall_integrity_grade;
    if (!INTEGRITY_GRADES.has(g)) {
      scorecardFailures.push(`getIntegrityScoreCard: grade must be A|B|C|D, got ${String(g)}`);
    }
  } catch (e) {
    scorecardFailures.push(`getIntegrityScoreCard: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    avatarOk: avatarFailures.length === 0,
    scorecardOk: scorecardFailures.length === 0,
    avatarFailures,
    scorecardFailures,
  };
}

function buildBlockers(
  smokeOk: boolean,
  healthOk: boolean,
  wiringOk: boolean,
  i18nOk: boolean,
  avatarOk: boolean,
  scorecardOk: boolean,
  healthPassRatio: number,
  smoke: SmokeTestReport | null | undefined,
  i18nAuditReport: I18nAuditReport | null | undefined,
  phaseErrors: ReleaseReadinessReport["phaseErrors"],
  avatarFailures: string[],
  scorecardFailures: string[],
): string[] {
  const out: string[] = [];
  if (phaseErrors.smoke) out.push(`smoke: ${phaseErrors.smoke}`);
  else if (!smokeOk) {
    out.push(
      `smoke: overall_ok must be true (got overallOk=${String(smoke?.overallOk)}; see smoke_test errors).`,
    );
  }
  if (phaseErrors.extendedHealth) out.push(`extended_health: ${phaseErrors.extendedHealth}`);
  else if (!healthOk) {
    out.push(
      `extended_health: PASS ratio must be >= ${RELEASE_READINESS_HEALTH_PASS_RATIO_MIN} (got ${healthPassRatio.toFixed(4)}).`,
    );
  }
  if (phaseErrors.wiring) out.push(`final_wiring: ${phaseErrors.wiring}`);
  else if (!wiringOk) {
    out.push("final_wiring: all_ok must be true.");
  }
  if (phaseErrors.i18n) out.push(`i18n_audit: ${phaseErrors.i18n}`);
  else if (!i18nOk) {
    const ko = i18nAuditReport?.missingKoCount ?? "—";
    const en = i18nAuditReport?.missingEnCount ?? "—";
    out.push(`i18n_audit: missing_ko_count and missing_en_count must be 0 (got ${ko}, ${en}).`);
  }
  if (phaseErrors.avatar) out.push(`avatar: ${phaseErrors.avatar}`);
  else {
    for (const f of avatarFailures) out.push(`avatar: ${f}`);
  }
  if (phaseErrors.scorecard) out.push(`scorecard: ${phaseErrors.scorecard}`);
  else {
    for (const f of scorecardFailures) out.push(`scorecard: ${f}`);
  }
  return out;
}

async function persistReleaseReadinessLog(report: ReleaseReadinessReport): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    console.warn("[release-readiness] release_readiness_log insert skipped (no admin).");
    return;
  }
  const { error } = await admin.from("release_readiness_log").insert({
    run_at: report.runAt,
    smoke_ok: report.smokeOk,
    health_ok: report.healthOk,
    wiring_ok: report.wiringOk,
    i18n_ok: report.i18nOk,
    avatar_ok: report.avatarOk,
    scorecard_ok: report.scorecardOk,
    all_clear: report.allClear,
    detail: {
      blockers: report.blockers,
      health_pass_ratio: report.healthPassRatio,
      health_checks_pass: report.healthChecksPass,
      health_checks_total: report.healthChecksTotal,
      phase_errors: report.phaseErrors,
    },
  });
  if (error) console.warn("[release-readiness] release_readiness_log insert failed:", error.message);
}

/**
 * Runs smoke → extended health → final wiring → i18n audit → avatar + scorecard checks;
 * evaluates gates and persists `release_readiness_log`.
 */
export async function runReleaseReadinessCheck(): Promise<ReleaseReadinessReport> {
  await seedFixtureUser();
  const runAt = new Date().toISOString();
  const phaseErrors: ReleaseReadinessReport["phaseErrors"] = {};
  const admin = getSupabaseAdmin();

  let smoke: SmokeTestReport | undefined;
  try {
    smoke = await runSmokeTest();
  } catch (e) {
    phaseErrors.smoke = e instanceof Error ? e.message : String(e);
  }

  let extendedHealth: ExtendedHealthReport | undefined;
  try {
    extendedHealth = await runExtendedHealthCheck();
  } catch (e) {
    phaseErrors.extendedHealth = e instanceof Error ? e.message : String(e);
  }

  let wiring: WiringReport | undefined;
  try {
    wiring = await runFinalWiringCheck();
  } catch (e) {
    phaseErrors.wiring = e instanceof Error ? e.message : String(e);
  }

  let i18nAudit: I18nAuditReport | undefined;
  try {
    i18nAudit = await runI18nAudit();
  } catch (e) {
    phaseErrors.i18n = e instanceof Error ? e.message : String(e);
  }

  const testUserId = resolveTestUserId();
  const ac = await runAvatarAndScorecardChecks(testUserId, admin);
  const avatarOk = ac.avatarOk;
  const scorecardOk = ac.scorecardOk;
  const avatarFailures = ac.avatarFailures;
  const scorecardFailures = ac.scorecardFailures;

  const smokeOk = smoke != null && smoke.overallOk === true;
  let healthPassRatio = 0;
  let healthChecksPass = 0;
  let healthChecksTotal = 0;
  if (extendedHealth) {
    const rows = [...extendedHealth.base.checks, ...extendedHealth.extendedChecks];
    healthChecksTotal = rows.length;
    healthChecksPass = rows.filter((c) => c.status === "PASS").length;
    healthPassRatio = extendedHealthPassRatio(extendedHealth);
  }
  const healthOk =
    extendedHealth != null &&
    healthChecksTotal > 0 &&
    healthPassRatio >= RELEASE_READINESS_HEALTH_PASS_RATIO_MIN;

  const wiringOk = wiring != null && wiring.all_ok === true;
  const i18nOk =
    i18nAudit != null && i18nAudit.missingKoCount === 0 && i18nAudit.missingEnCount === 0;

  const blockers = buildBlockers(
    smokeOk,
    healthOk,
    wiringOk,
    i18nOk,
    avatarOk,
    scorecardOk,
    healthPassRatio,
    smoke,
    i18nAudit,
    phaseErrors,
    avatarFailures,
    scorecardFailures,
  );

  const allClear =
    smokeOk &&
    healthOk &&
    wiringOk &&
    i18nOk &&
    avatarOk &&
    scorecardOk &&
    Object.keys(phaseErrors).length === 0;

  const report: ReleaseReadinessReport = {
    runAt,
    smokeOk,
    healthOk,
    wiringOk,
    i18nOk,
    avatarOk,
    scorecardOk,
    allClear,
    healthPassRatio,
    healthChecksPass,
    healthChecksTotal,
    blockers,
    smoke: smoke ?? null,
    extendedHealth: extendedHealth ?? null,
    wiring: wiring ?? null,
    i18n: i18nAudit ?? null,
    phaseErrors,
  };

  await persistReleaseReadinessLog(report);
  return report;
}
