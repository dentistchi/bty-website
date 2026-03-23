/**
 * Weekly AIR report — Sunday 23:59 UTC cron builds rows from {@link getAIRTrend} + {@link getScenarioStats},
 * upserts `weekly_air_reports`, emits `weekly_report_ready` per user.
 */

import type { AIRTrendDirection } from "@/engine/integrity/air-trend.service";
import { getAIRTrend } from "@/engine/integrity/air-trend.service";
import { getScenarioStats } from "@/engine/scenario/scenario-stats.service";
import type { ScenarioLocalePreference } from "@/engine/scenario/scenario-selector.service";
import { broadcastWeeklyReportReady } from "@/lib/bty/center/weekly-report-broadcast";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type WeeklyAIRReport = {
  userId: string;
  /** Monday UTC (YYYY-MM-DD) of the week this report covers. */
  weekOf: string;
  trend: AIRTrendDirection;
  completion_rate: number;
  streak: number;
  flag_type_breakdown: Record<string, number>;
};

export type WeeklyReportReadyPayload = {
  event: "weekly_report_ready";
  userId: string;
  weekOf: string;
  report: WeeklyAIRReport;
};

export type RunWeeklyAirReportResult = {
  ok: boolean;
  weekOf: string;
  usersProcessed: number;
  errors: string[];
};

const readyListeners = new Set<(payload: WeeklyReportReadyPayload) => void>();

export function onWeeklyReportReady(
  listener: (payload: WeeklyReportReadyPayload) => void,
): () => void {
  readyListeners.add(listener);
  return () => readyListeners.delete(listener);
}

function emitReady(payload: WeeklyReportReadyPayload): void {
  for (const fn of readyListeners) {
    try {
      fn(payload);
    } catch {
      // listeners must not abort cron
    }
  }
  broadcastWeeklyReportReady(payload);
}

/**
 * Monday UTC (date string) for the ISO week that contains `now` (week runs Mon–Sun UTC).
 */
export function mondayUtcWeekOf(now: Date): string {
  const d = new Date(now.getTime());
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysFromMonday);
  return d.toISOString().slice(0, 10);
}

/**
 * Distinct users with at least one active membership row.
 */
export async function fetchActiveUserIds(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin.from("memberships").select("user_id").eq("status", "active");
  if (error) throw new Error(error.message);
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const id = (row as { user_id?: string }).user_id;
    if (typeof id === "string") ids.add(id);
  }
  return [...ids];
}

async function buildReportForUser(
  userId: string,
  weekOf: string,
  locale: ScenarioLocalePreference,
  at: Date,
): Promise<WeeklyAIRReport> {
  const [trendRow, stats] = await Promise.all([
    getAIRTrend(userId, { now: at }),
    getScenarioStats(userId, locale),
  ]);

  return {
    userId,
    weekOf,
    trend: trendRow.direction,
    completion_rate: stats.completionRate,
    streak: stats.streakDaysUtc,
    flag_type_breakdown: { ...stats.playsByFlagType },
  };
}

/**
 * Sunday 23:59 UTC cron entry: process all active users, upsert reports, emit per user.
 */
export async function runWeeklyAirReportCron(options?: {
  at?: Date;
  locale?: ScenarioLocalePreference;
  supabase?: SupabaseClient;
}): Promise<RunWeeklyAirReportResult> {
  const at = options?.at ?? new Date();
  const locale = options?.locale ?? "en";
  const admin = options?.supabase ?? getSupabaseAdmin();
  const errors: string[] = [];

  if (!admin) {
    return { ok: false, weekOf: mondayUtcWeekOf(at), usersProcessed: 0, errors: ["supabase_admin_not_configured"] };
  }

  const weekOf = mondayUtcWeekOf(at);
  let usersProcessed = 0;

  let userIds: string[];
  try {
    userIds = await fetchActiveUserIds(admin);
  } catch (e) {
    return {
      ok: false,
      weekOf,
      usersProcessed: 0,
      errors: [e instanceof Error ? e.message : String(e)],
    };
  }

  for (const userId of userIds) {
    try {
      const report = await buildReportForUser(userId, weekOf, locale, at);

      const { error: upErr } = await admin.from("weekly_air_reports").upsert(
        {
          user_id: userId,
          week_of: weekOf,
          trend: report.trend,
          completion_rate: report.completion_rate,
          streak: report.streak,
          flag_type_breakdown: report.flag_type_breakdown,
          computed_at: at.toISOString(),
        },
        { onConflict: "user_id,week_of" },
      );

      if (upErr) {
        errors.push(`${userId}: ${upErr.message}`);
        continue;
      }

      usersProcessed += 1;
      emitReady({ event: "weekly_report_ready", userId, weekOf, report });
    } catch (e) {
      errors.push(`${userId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { ok: errors.length === 0, weekOf, usersProcessed, errors };
}

/**
 * Load a persisted weekly row (service role / bypass RLS).
 */
export async function getWeeklyReport(
  userId: string,
  weekOf: string,
  options?: { supabase?: SupabaseClient },
): Promise<WeeklyAIRReport | null> {
  const admin = options?.supabase ?? getSupabaseAdmin();
  if (!admin) return null;

  const { data, error } = await admin
    .from("weekly_air_reports")
    .select("user_id, week_of, trend, completion_rate, streak, flag_type_breakdown")
    .eq("user_id", userId)
    .eq("week_of", weekOf)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    user_id: string;
    week_of: string;
    trend: AIRTrendDirection;
    completion_rate: number;
    streak: number;
    flag_type_breakdown: unknown;
  };

  const breakdown =
    row.flag_type_breakdown && typeof row.flag_type_breakdown === "object" && !Array.isArray(row.flag_type_breakdown)
      ? (row.flag_type_breakdown as Record<string, number>)
      : {};

  return {
    userId: row.user_id,
    weekOf: typeof row.week_of === "string" ? row.week_of : String(row.week_of).slice(0, 10),
    trend: row.trend,
    completion_rate: Number(row.completion_rate ?? 0),
    streak: Math.floor(Number(row.streak ?? 0)),
    flag_type_breakdown: breakdown,
  };
}
