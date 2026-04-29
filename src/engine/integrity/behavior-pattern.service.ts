/**
 * Arena choice history → behavior labels (`user_behavior_patterns`) for mentor + pattern narrative.
 *
 * @see getPatternNarrative — optional richer lines via {@link getBehaviorPatterns}.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAIRTrend } from "@/engine/integrity/air-trend.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const MS_PER_DAY = 86_400_000;
const WINDOW_DAYS = 30 as const;
const GROWTH_AIR_DELTA_THRESHOLD = 0.1 as const;
const DOMINANT_FLAG_SHARE_THRESHOLD = 0.6 as const;
const CLEAN_STREAK_MIN = 3 as const;

export type BehaviorPatternType =
  | "dominant_pattern"
  | "growth_signal"
  | "integrity_streak"
  | "feedback_signal";

export type BehaviorPattern = {
  id: string;
  user_id: string;
  pattern_type: BehaviorPatternType;
  detected_at: string;
  supporting_data: Record<string, unknown>;
};

type ChoiceRow = { flag_type: string; played_at: string };

async function fetchChoices30d(
  client: SupabaseClient,
  userId: string,
  asOf: Date,
): Promise<ChoiceRow[]> {
  const cutoff = new Date(asOf.getTime() - WINDOW_DAYS * MS_PER_DAY).toISOString();
  const { data, error } = await client
    .from("user_scenario_choice_history")
    .select("flag_type, played_at")
    .eq("user_id", userId)
    .gte("played_at", cutoff)
    .order("played_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ChoiceRow[];
}

function dominantFlagPattern(rows: ChoiceRow[]): {
  flag_type: string;
  share: number;
  total: number;
} | null {
  if (rows.length === 0) return null;
  const counts = new Map<string, number>();
  for (const r of rows) {
    const f = typeof r.flag_type === "string" ? r.flag_type.trim() : "unknown";
    counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  let bestFlag = "";
  let best = 0;
  for (const [f, n] of counts) {
    if (n > best) {
      best = n;
      bestFlag = f;
    }
  }
  const share = best / rows.length;
  if (share <= DOMINANT_FLAG_SHARE_THRESHOLD) return null;
  return { flag_type: bestFlag, share, total: rows.length };
}

function longestConsecutiveClean(rows: ChoiceRow[]): number {
  let cur = 0;
  let best = 0;
  for (const r of rows) {
    const ft = typeof r.flag_type === "string" ? r.flag_type.trim() : "";
    const isClean = ft.toUpperCase() === "CLEAN";
    if (isClean) {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 0;
    }
  }
  return best;
}

async function detectGrowthSignal(userId: string, asOf: Date): Promise<{
  delta: number;
  last7: number;
  prior7: number;
} | null> {
  const trend = await getAIRTrend(userId, { now: asOf });
  const delta = trend.last7DayWindowAvg - trend.prior7DayWindowAvg;
  if (delta <= GROWTH_AIR_DELTA_THRESHOLD) return null;
  return {
    delta,
    last7: trend.last7DayWindowAvg,
    prior7: trend.prior7DayWindowAvg,
  };
}

async function upsertPatterns(
  admin: SupabaseClient,
  userId: string,
  rows: Array<{ pattern_type: BehaviorPatternType; supporting_data: Record<string, unknown> }>,
  asOf: Date,
): Promise<void> {
  const { error: delErr } = await admin.from("user_behavior_patterns").delete().eq("user_id", userId);
  if (delErr) throw new Error(delErr.message);

  const iso = asOf.toISOString();
  for (const r of rows) {
    const { error } = await admin.from("user_behavior_patterns").insert({
      user_id: userId,
      pattern_type: r.pattern_type,
      detected_at: iso,
      supporting_data: r.supporting_data,
    });
    if (error) throw new Error(error.message);
  }
}

function mapBehaviorPatternRows(data: unknown[] | null): BehaviorPattern[] {
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      user_id: String(row.user_id),
      pattern_type: row.pattern_type as BehaviorPatternType,
      detected_at:
        typeof row.detected_at === "string" ? row.detected_at : String(row.detected_at),
      supporting_data:
        row.supporting_data && typeof row.supporting_data === "object" && !Array.isArray(row.supporting_data)
          ? (row.supporting_data as Record<string, unknown>)
          : {},
    };
  });
}

async function readBehaviorPatternsFromDb(
  admin: SupabaseClient,
  userId: string,
): Promise<BehaviorPattern[]> {
  const { data, error } = await admin
    .from("user_behavior_patterns")
    .select("id, user_id, pattern_type, detected_at, supporting_data")
    .eq("user_id", userId)
    .order("detected_at", { ascending: false });

  if (error) throw new Error(error.message);
  return mapBehaviorPatternRows(data ?? []);
}

async function countFeedbackResponses30d(
  admin: SupabaseClient,
  userId: string,
  asOf: Date,
): Promise<number> {
  const cutoff = new Date(asOf.getTime() - WINDOW_DAYS * MS_PER_DAY).toISOString();
  const { count, error } = await admin
    .from("scenario_feedback_responses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", cutoff);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Recompute labels from last 30d choices + AIR trend (7d vs prior 7d as growth proxy), persist, return rows.
 */
export async function syncBehaviorPatterns(
  userId: string,
  options?: { now?: Date; supabase?: SupabaseClient },
): Promise<BehaviorPattern[]> {
  const admin = options?.supabase ?? getSupabaseAdmin();
  const asOf = options?.now ?? new Date();
  if (!admin) return [];

  const choices = await fetchChoices30d(admin, userId, asOf);
  const detected: Array<{ pattern_type: BehaviorPatternType; supporting_data: Record<string, unknown> }> = [];

  const dom = dominantFlagPattern(choices);
  if (dom) {
    detected.push({
      pattern_type: "dominant_pattern",
      supporting_data: {
        flag_type: dom.flag_type,
        share: dom.share,
        total_choices: dom.total,
        window_days: WINDOW_DAYS,
      },
    });
  }

  const cleanRun = longestConsecutiveClean(choices);
  if (cleanRun >= CLEAN_STREAK_MIN) {
    detected.push({
      pattern_type: "integrity_streak",
      supporting_data: {
        consecutive_clean: cleanRun,
        window_days: WINDOW_DAYS,
      },
    });
  }

  const growth = await detectGrowthSignal(userId, asOf).catch(() => null);
  if (growth) {
    detected.push({
      pattern_type: "growth_signal",
      supporting_data: {
        air_delta_last7_vs_prior7: growth.delta,
        last7_day_window_avg: growth.last7,
        prior7_day_window_avg: growth.prior7,
        threshold: GROWTH_AIR_DELTA_THRESHOLD,
        note: "AIR improvement vs prior 7d window (see getAIRTrend); proxies 14d growth when data sparse.",
      },
    });
  }

  const feedbackCount = await countFeedbackResponses30d(admin, userId, asOf).catch(() => 0);
  if (feedbackCount > 0) {
    detected.push({
      pattern_type: "feedback_signal",
      supporting_data: {
        response_count_30d: feedbackCount,
        window_days: WINDOW_DAYS,
        source: "scenario_feedback_responses",
      },
    });
  }

  await upsertPatterns(admin, userId, detected, asOf);
  return readBehaviorPatternsFromDb(admin, userId);
}

/**
 * Latest rows from `user_behavior_patterns`. When `refresh` is true (default), runs {@link syncBehaviorPatterns} first.
 */
export async function getBehaviorPatterns(
  userId: string,
  options?: { now?: Date; supabase?: SupabaseClient; refresh?: boolean },
): Promise<BehaviorPattern[]> {
  const admin = options?.supabase ?? getSupabaseAdmin();
  if (!admin) return [];
  const refresh = options?.refresh !== false;
  if (refresh) {
    return syncBehaviorPatterns(userId, { now: options?.now, supabase: admin });
  }
  return readBehaviorPatternsFromDb(admin, userId);
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Korean one-liners for mentor / `getPatternNarrative` (AIR lines와 별도 섹션으로도 사용 가능).
 */
export function formatBehaviorPatternNarrativeLines(patterns: BehaviorPattern[]): string[] {
  const out: string[] = [];
  for (const p of patterns) {
    const s = p.supporting_data;
    if (p.pattern_type === "dominant_pattern") {
      const flag = typeof s.flag_type === "string" ? s.flag_type : "unknown";
      const share = typeof s.share === "number" ? pct(s.share) : "";
      out.push(
        `최근 30일 Arena 선택에서 ${flag} 유형이 ${share}를 차지하는 경향이 있습니다.`,
      );
    } else if (p.pattern_type === "integrity_streak") {
      const n = typeof s.consecutive_clean === "number" ? s.consecutive_clean : 0;
      out.push(`최근 기록에서 CLEAN 선택이 연속 ${n}회 이상 이어진 구간이 있습니다.`);
    } else if (p.pattern_type === "growth_signal") {
      const d = typeof s.air_delta_last7_vs_prior7 === "number" ? s.air_delta_last7_vs_prior7 : 0;
      const bp = Math.round(d * 100);
      out.push(`AIR(활성 지수)가 직전 7일 대비 약 ${bp}p 상승한 구간이 있습니다.`);
    } else if (p.pattern_type === "feedback_signal") {
      const n = typeof s.response_count_30d === "number" ? s.response_count_30d : 0;
      out.push(
        `최근 30일 안에 시나리오 선택에 대한 짧은 성찰(글)을 ${n}회 남긴 기록이 있습니다.`,
      );
    }
  }
  return out;
}
