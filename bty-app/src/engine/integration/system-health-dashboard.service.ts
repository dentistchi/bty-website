/**
 * Admin dashboard: live loop health run + DB aggregates (ejections, elite queue, slips, healing, weekly resets).
 * Cached 120s in-process (per server instance).
 */

import { runLoopHealthCheck, type LoopHealthReport } from "@/engine/integration/full-loop-validator";
import { fetchLatestTeamIntegrityRisks } from "@/engine/integrity/team-air-benchmark.service";
import { HEALING_PHASE_ORDER, type HealingPhase } from "@/engine/healing/healing-phase.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const CACHE_TTL_MS = 120_000;

let cache: { expiresAt: number; snapshot: SystemHealthSnapshot } | null = null;

export function clearSystemHealthCacheForTests(): void {
  cache = null;
}

/** PASS/FAIL row counts in `loop_health_log` for the last 24 hours (UTC window from `since`). */
export type LoopHealthLog24hRatio = {
  since: string;
  passCount: number;
  failCount: number;
  /** `passCount / (passCount + failCount)` or 0 when empty. */
  passRatio: number;
  totalRows: number;
};

export type SystemHealthSnapshot = {
  generatedAt: string;
  /** When this payload was computed (cache miss). */
  computedAt: string;
  cacheHit: boolean;
  /** In-process cache TTL; next refresh after this instant (best-effort). */
  validUntil: string;
  loopHealth: LoopHealthReport;
  loopHealthLog24h: LoopHealthLog24hRatio;
  /** Users with `arena_profiles.arena_status = EJECTED` (canonical active ejection). */
  activeEjections: number;
  pendingEliteSpecNominations: number;
  openSlipRecoveryTasks: number;
  healingPhaseCounts: Record<HealingPhase, number>;
  /** Rows in `weekly_reset_log` for the active Arena season. */
  weeklyXpResetsThisSeason: number;
  activeSeasonId: string | null;
  activeSeasonNumber: number | null;
  /** Recent teams with low TII streak (from `team_air_benchmarks`). */
  teamIntegrityRiskSample: { teamId: string; riskLevel: string; computedAt: string }[];
};

async function fetchActiveSeason(
  admin: SupabaseClient,
): Promise<{ seasonId: string | null; seasonNumber: number | null }> {
  const { data, error } = await admin
    .from("arena_seasons")
    .select("season_id, season_number")
    .eq("status", "active")
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { seasonId: null, seasonNumber: null };
  }
  const row = data as { season_id?: string; season_number?: number };
  return {
    seasonId: typeof row.season_id === "string" ? row.season_id : null,
    seasonNumber: typeof row.season_number === "number" ? row.season_number : null,
  };
}

async function fetchLoopHealthLog24h(admin: SupabaseClient, sinceIso: string): Promise<LoopHealthLog24hRatio> {
  const [passRes, failRes] = await Promise.all([
    admin
      .from("loop_health_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "PASS")
      .gte("created_at", sinceIso),
    admin
      .from("loop_health_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "FAIL")
      .gte("created_at", sinceIso),
  ]);

  if (passRes.error) console.warn("[system-health] loop_health_log PASS count", passRes.error.message);
  if (failRes.error) console.warn("[system-health] loop_health_log FAIL count", failRes.error.message);

  const p = passRes.count ?? 0;
  const f = failRes.count ?? 0;
  const total = p + f;
  const passRatio = total === 0 ? 0 : p / total;

  return {
    since: sinceIso,
    passCount: p,
    failCount: f,
    passRatio,
    totalRows: total,
  };
}

async function fetchDbAggregates(
  admin: SupabaseClient,
  since24h: string,
): Promise<{
  loopHealthLog24h: LoopHealthLog24hRatio;
  activeEjections: number;
  pendingEliteSpecNominations: number;
  openSlipRecoveryTasks: number;
  healingPhaseCounts: Record<HealingPhase, number>;
  weeklyXpResetsThisSeason: number;
  activeSeasonId: string | null;
  activeSeasonNumber: number | null;
  teamIntegrityRiskSample: { teamId: string; riskLevel: string; computedAt: string }[];
}> {
  const [activeSeason, loopHealthLog24h, ejectRes, eliteRes, slipRes, ...phaseRes] = await Promise.all([
    fetchActiveSeason(admin),
    fetchLoopHealthLog24h(admin, since24h),
    admin
      .from("arena_profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("arena_status", "EJECTED"),
    admin
      .from("elite_spec_nominations")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),
    admin
      .from("slip_recovery_tasks")
      .select("id", { count: "exact", head: true })
      .is("completed_at", null),
    ...HEALING_PHASE_ORDER.map((phase) =>
      admin.from("user_healing_phase").select("user_id", { count: "exact", head: true }).eq("phase", phase),
    ),
  ]);

  if (ejectRes.error) console.warn("[system-health] arena_profiles EJECTED", ejectRes.error.message);
  if (eliteRes.error) console.warn("[system-health] elite_spec PENDING", eliteRes.error.message);
  if (slipRes.error) console.warn("[system-health] slip_recovery open", slipRes.error.message);

  const activeEjections = ejectRes.count ?? 0;
  const pendingEliteSpecNominations = eliteRes.count ?? 0;
  const openSlipRecoveryTasks = slipRes.count ?? 0;

  const healingPhaseCounts = {
    ACKNOWLEDGEMENT: phaseRes[0]?.count ?? 0,
    REFLECTION: phaseRes[1]?.count ?? 0,
    REINTEGRATION: phaseRes[2]?.count ?? 0,
    RENEWAL: phaseRes[3]?.count ?? 0,
  } as Record<HealingPhase, number>;
  for (let i = 0; i < HEALING_PHASE_ORDER.length; i++) {
    const err = phaseRes[i]?.error;
    if (err) console.warn(`[system-health] healing phase ${HEALING_PHASE_ORDER[i]}`, err.message);
  }

  let weeklyXpResetsThisSeason = 0;
  if (activeSeason.seasonId) {
    const resetRes = await admin
      .from("weekly_reset_log")
      .select("id", { count: "exact", head: true })
      .eq("season_id", activeSeason.seasonId);
    if (resetRes.error) console.warn("[system-health] weekly_reset_log", resetRes.error.message);
    else weeklyXpResetsThisSeason = resetRes.count ?? 0;
  }

  const riskRows = await fetchLatestTeamIntegrityRisks(admin, 5);
  const teamIntegrityRiskSample = riskRows.map((r) => ({
    teamId: r.teamId,
    riskLevel: r.riskLevel,
    computedAt: r.computedAt,
  }));

  return {
    loopHealthLog24h,
    activeEjections,
    pendingEliteSpecNominations,
    openSlipRecoveryTasks,
    healingPhaseCounts,
    weeklyXpResetsThisSeason,
    activeSeasonId: activeSeason.seasonId,
    activeSeasonNumber: activeSeason.seasonNumber,
    teamIntegrityRiskSample,
  };
}

async function buildSnapshot(): Promise<SystemHealthSnapshot> {
  const computedAt = new Date().toISOString();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const admin = getSupabaseAdmin();

  if (!admin) {
    const loopHealth = await runLoopHealthCheck();
    const validUntil = new Date(Date.now() + CACHE_TTL_MS).toISOString();
    return {
      generatedAt: computedAt,
      computedAt,
      cacheHit: false,
      validUntil,
      loopHealth,
      loopHealthLog24h: {
        since: since24h,
        passCount: 0,
        failCount: 0,
        passRatio: 0,
        totalRows: 0,
      },
      activeEjections: 0,
      pendingEliteSpecNominations: 0,
      openSlipRecoveryTasks: 0,
      healingPhaseCounts: {
        ACKNOWLEDGEMENT: 0,
        REFLECTION: 0,
        REINTEGRATION: 0,
        RENEWAL: 0,
      },
      weeklyXpResetsThisSeason: 0,
      activeSeasonId: null,
      activeSeasonNumber: null,
      teamIntegrityRiskSample: [],
    };
  }

  const [loopHealth, agg] = await Promise.all([
    runLoopHealthCheck(),
    fetchDbAggregates(admin, since24h),
  ]);

  const validUntil = new Date(Date.now() + CACHE_TTL_MS).toISOString();

  return {
    generatedAt: computedAt,
    computedAt,
    cacheHit: false,
    validUntil,
    loopHealth,
    loopHealthLog24h: agg.loopHealthLog24h,
    activeEjections: agg.activeEjections,
    pendingEliteSpecNominations: agg.pendingEliteSpecNominations,
    openSlipRecoveryTasks: agg.openSlipRecoveryTasks,
    healingPhaseCounts: agg.healingPhaseCounts,
    weeklyXpResetsThisSeason: agg.weeklyXpResetsThisSeason,
    activeSeasonId: agg.activeSeasonId,
    activeSeasonNumber: agg.activeSeasonNumber,
    teamIntegrityRiskSample: agg.teamIntegrityRiskSample,
  };
}

export type GetSystemHealthOptions = {
  /** Skip in-process cache (e.g. `?refresh=1`). */
  bypassCache?: boolean;
};

/**
 * Aggregates live system signals for admin UI. Cached **120s** per process; pass `bypassCache: true` to refresh.
 */
export async function getSystemHealth(options?: GetSystemHealthOptions): Promise<SystemHealthSnapshot> {
  const now = Date.now();
  if (!options?.bypassCache && cache && cache.expiresAt > now) {
    return {
      ...cache.snapshot,
      generatedAt: new Date().toISOString(),
      cacheHit: true,
      validUntil: new Date(cache.expiresAt).toISOString(),
    };
  }

  const snapshot = await buildSnapshot();
  cache = { expiresAt: now + CACHE_TTL_MS, snapshot };
  return snapshot;
}
