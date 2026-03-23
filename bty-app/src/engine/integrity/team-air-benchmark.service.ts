/**
 * Team AIR benchmark: rolling weekly `avg_air` from `le_activation_log`, TII per week,
 * peer rank within team, consecutive low-TII risk → {@link TEAM_INTEGRITY_ALERT_EVENT}.
 *
 * @see getTeamBenchmark — TIIWidget + admin status
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeAIR,
  computeTIIWithComponents,
  type ActivationRecord,
  type ActivationType,
} from "@/domain/leadership-engine";
import { fetchTeamTIIInputsForWindow } from "@/lib/bty/leadership-engine/tii-weekly-inputs";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const MS_DAY = 86_400_000;
/** Query + peer window (last 30 days). */
export const BENCHMARK_LOOKBACK_DAYS = 30 as const;
/** Number of Monday weeks to evaluate (covers 5×7d for 4-week rolling tail). */
export const BENCHMARK_WEEK_SLOTS = 5 as const;
/** TII score (0–100) below this threshold counts as a “low” week. */
export const TII_RISK_THRESHOLD_PCT = 60 as const;
const TII_RISK_THRESHOLD = TII_RISK_THRESHOLD_PCT / 100;

export const TEAM_INTEGRITY_ALERT_EVENT = "team_integrity_alert" as const;

export type TeamIntegrityRiskLevel = "none" | "watch" | "elevated" | "critical";

export type TeamIntegrityAlertPayload = {
  event: typeof TEAM_INTEGRITY_ALERT_EVENT;
  teamId: string;
  riskLevel: TeamIntegrityRiskLevel;
  consecutiveLowTiiWeeks: number;
  occurredAt: string;
};

const alertListeners = new Set<(p: TeamIntegrityAlertPayload) => void | Promise<void>>();

export function onTeamIntegrityAlert(
  fn: (p: TeamIntegrityAlertPayload) => void | Promise<void>,
): () => void {
  alertListeners.add(fn);
  return () => alertListeners.delete(fn);
}

function emitTeamIntegrityAlert(p: TeamIntegrityAlertPayload): void {
  for (const fn of alertListeners) {
    try {
      void fn(p);
    } catch {
      /* listeners must not break persistence */
    }
  }
}

export type WeeklyBenchmarkPoint = {
  weekOf: string;
  /** Monday UTC `YYYY-MM-DD`. */
  teamAvgAir: number;
  weeklyTii: number;
  /** Mean of team `avg_air` over up to 4 prior weeks including this index. */
  rolling4WeekAvgAir: number | null;
};

export type PeerPercentileRow = {
  userId: string;
  /** `rank / memberCount` (higher AIR = rank 1). */
  peerPercentile: number;
  /** AIR used for ranking (14d window, `asOf` = end of lookback). */
  air14d: number;
};

export type TeamBenchmark = {
  teamId: string;
  computedAt: string;
  weeks: WeeklyBenchmarkPoint[];
  peerPercentiles: PeerPercentileRow[];
  teamIntegrityRisk: boolean;
  consecutiveLowTiiWeeks: number;
  riskLevel: TeamIntegrityRiskLevel;
};

function utcMonday(d: Date): Date {
  const x = new Date(d.getTime());
  const day = x.getUTCDay();
  const daysFromMon = day === 0 ? 6 : day - 1;
  x.setUTCDate(x.getUTCDate() - daysFromMon);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function weekStartsDesc(now: Date, count: number): Date[] {
  const mon = utcMonday(now);
  const out: Date[] = [];
  for (let i = count - 1; i >= 0; i--) {
    out.push(new Date(mon.getTime() - i * 7 * MS_DAY));
  }
  return out;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function loadActivationRecordsForUserWindow(
  admin: SupabaseClient,
  userId: string,
  rangeStart: Date,
  rangeEndExclusive: Date,
): Promise<ActivationRecord[]> {
  const { data: logs, error } = await admin
    .from("le_activation_log")
    .select("activation_id, user_id, type, chosen_at, due_at, completed_at")
    .eq("user_id", userId)
    .gte("chosen_at", rangeStart.toISOString())
    .lt("chosen_at", rangeEndExclusive.toISOString());

  if (error) throw new Error(error.message);
  if (!logs?.length) return [];

  const activationIds = logs.map((r: { activation_id: string }) => r.activation_id);
  const { data: verifications } = await admin
    .from("le_verification_log")
    .select("activation_id, verified")
    .in("activation_id", activationIds)
    .order("verified_at", { ascending: false });

  const verifiedSet = new Set<string>();
  const seen = new Set<string>();
  for (const v of verifications ?? []) {
    const id = (v as { activation_id: string }).activation_id;
    if (!seen.has(id)) {
      seen.add(id);
      if ((v as { verified: boolean }).verified) verifiedSet.add(id);
    }
  }

  return logs.map((r) => ({
    activation_id: (r as { activation_id: string }).activation_id,
    user_id: (r as { user_id: string }).user_id,
    type: (r as { type: string }).type as ActivationType,
    chosen_at: new Date((r as { chosen_at: string }).chosen_at),
    due_at: new Date((r as { due_at: string }).due_at),
    completed_at: (r as { completed_at: string | null }).completed_at
      ? new Date((r as { completed_at: string }).completed_at)
      : null,
    verified: verifiedSet.has((r as { activation_id: string }).activation_id),
  }));
}

function riskLevelFromStreak(maxConsecutive: number): TeamIntegrityRiskLevel {
  if (maxConsecutive < 2) return "none";
  if (maxConsecutive === 2) return "watch";
  if (maxConsecutive === 3) return "elevated";
  return "critical";
}

function maxConsecutiveLowTii(weeklyTii: readonly number[]): number {
  let streak = 0;
  let best = 0;
  for (const t of weeklyTii) {
    if (t < TII_RISK_THRESHOLD) {
      streak += 1;
      best = Math.max(best, streak);
    } else {
      streak = 0;
    }
  }
  return best;
}

function rolling4WeekAvgAir(weekAvgs: readonly number[], index: number): number | null {
  if (index < 3) return null;
  const slice = weekAvgs.slice(index - 3, index + 1);
  if (slice.length < 4) return null;
  let s = 0;
  for (const v of slice) s += v;
  return s / 4;
}

/**
 * Computes benchmarks, persists `team_air_benchmarks`, emits alert when risk.
 */
export async function getTeamBenchmark(teamId: string): Promise<TeamBenchmark> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("getTeamBenchmark: Supabase service role not configured");
  }

  const now = new Date();
  const lookbackStart = new Date(now.getTime() - BENCHMARK_LOOKBACK_DAYS * MS_DAY);

  const { data: members, error: memErr } = await admin
    .from("league_memberships")
    .select("user_id")
    .eq("league_id", teamId);

  if (memErr) throw new Error(memErr.message);
  const userIds = (members ?? []).map((r: { user_id: string }) => r.user_id);
  const memberCount = userIds.length;

  const weekStarts = weekStartsDesc(now, BENCHMARK_WEEK_SLOTS);
  const weekPoints: WeeklyBenchmarkPoint[] = [];
  const weekAvgs: number[] = [];
  const weekTiis: number[] = [];

  for (const ws of weekStarts) {
    const we = new Date(ws.getTime() + 7 * MS_DAY);
    const inputs = await fetchTeamTIIInputsForWindow(admin, teamId, ws, we);
    const result = computeTIIWithComponents(inputs);
    weekAvgs.push(result.avg_air);
    weekTiis.push(result.tii);
  }

  for (let i = 0; i < weekStarts.length; i++) {
    const ws = weekStarts[i]!;
    const roll = rolling4WeekAvgAir(weekAvgs, i);
    weekPoints.push({
      weekOf: isoDate(ws),
      teamAvgAir: weekAvgs[i]!,
      weeklyTii: weekTiis[i]!,
      rolling4WeekAvgAir: roll,
    });
  }

  const consecutiveLowTiiWeeks = maxConsecutiveLowTii(weekTiis);
  const riskLevel = riskLevelFromStreak(consecutiveLowTiiWeeks);
  const teamIntegrityRisk = riskLevel !== "none";

  const computedAt = now.toISOString();

  const { data: prevRow } = await admin
    .from("team_air_benchmarks")
    .select("risk_level")
    .eq("team_id", teamId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevRisk = (prevRow as { risk_level?: string } | null)?.risk_level ?? "none";
  const severity: Record<TeamIntegrityRiskLevel, number> = {
    none: 0,
    watch: 1,
    elevated: 2,
    critical: 3,
  };
  const shouldEmitAlert =
    teamIntegrityRisk &&
    (prevRisk === "none" || severity[riskLevel] > (severity[prevRisk as TeamIntegrityRiskLevel] ?? 0));

  if (shouldEmitAlert) {
    emitTeamIntegrityAlert({
      event: TEAM_INTEGRITY_ALERT_EVENT,
      teamId,
      riskLevel,
      consecutiveLowTiiWeeks: consecutiveLowTiiWeeks,
      occurredAt: computedAt,
    });
  }

  for (let i = 0; i < weekStarts.length; i++) {
    const ws = weekStarts[i]!;
    const wp = weekPoints[i]!;
    const { error: upErr } = await admin.from("team_air_benchmarks").upsert(
      {
        team_id: teamId,
        week_of: wp.weekOf,
        avg_air: wp.teamAvgAir,
        weekly_tii: wp.weeklyTii,
        rolling_4w_avg_air: wp.rolling4WeekAvgAir,
        risk_level: riskLevel,
        computed_at: computedAt,
      },
      { onConflict: "team_id,week_of" },
    );
    if (upErr) console.warn("[team-air-benchmark] upsert", upErr.message);
  }

  const peerPercentiles: PeerPercentileRow[] = [];
  if (memberCount > 0) {
    const airs: { userId: string; air: number }[] = [];
    for (const uid of userIds) {
      const recs = await loadActivationRecordsForUserWindow(admin, uid, lookbackStart, now);
      const air = computeAIR(recs, "14d", now).air;
      airs.push({ userId: uid, air });
    }
    airs.sort((a, b) => b.air - a.air);
    for (let r = 0; r < airs.length; r++) {
      peerPercentiles.push({
        userId: airs[r]!.userId,
        peerPercentile: (r + 1) / memberCount,
        air14d: airs[r]!.air,
      });
    }
  }

  return {
    teamId,
    computedAt,
    weeks: weekPoints,
    peerPercentiles,
    teamIntegrityRisk,
    consecutiveLowTiiWeeks,
    riskLevel,
  };
}

/** Latest non-none risk rows for admin dashboards (deduped by `team_id`). */
export async function fetchLatestTeamIntegrityRisks(
  admin: SupabaseClient,
  limit = 5,
): Promise<{ teamId: string; riskLevel: TeamIntegrityRiskLevel; computedAt: string }[]> {
  const { data, error } = await admin
    .from("team_air_benchmarks")
    .select("team_id, risk_level, computed_at")
    .neq("risk_level", "none")
    .order("computed_at", { ascending: false })
    .limit(80);

  if (error) {
    console.warn("[team-air-benchmark] fetchLatestTeamIntegrityRisks", error.message);
    return [];
  }

  const seen = new Set<string>();
  const out: { teamId: string; riskLevel: TeamIntegrityRiskLevel; computedAt: string }[] = [];
  for (const raw of data ?? []) {
    const r = raw as { team_id?: string; risk_level?: string; computed_at?: string };
    const tid = typeof r.team_id === "string" ? r.team_id : "";
    if (!tid || seen.has(tid)) continue;
    seen.add(tid);
    const rl = r.risk_level as TeamIntegrityRiskLevel;
    if (rl !== "watch" && rl !== "elevated" && rl !== "critical") continue;
    out.push({
      teamId: tid,
      riskLevel: rl,
      computedAt: typeof r.computed_at === "string" ? r.computed_at : String(r.computed_at),
    });
    if (out.length >= limit) break;
  }
  return out;
}
