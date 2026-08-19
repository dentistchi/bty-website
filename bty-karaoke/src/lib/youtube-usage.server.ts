// BUILD R3 — read-only service for the Manager YouTube quota console.
//
// It calls ONE thing: the existing `karaoke_youtube_search_usage` aggregation RPC. Every quota
// number is taken verbatim from that RPC and never recomputed here, so the console cannot drift
// from the evidence we would show Google. The only values added are presentational: the usage
// band, the per-day percentages, and a Pacific label for the peak hour.
//
// READ-ONLY BY CONSTRUCTION: no insert, no update, no KV write, no YouTube call, no Google Cloud
// call. Opening the console spends ZERO quota.

import { karaokeDb } from './supabase.server';
import {
  pacificHourLabel,
  remainingCalls,
  usagePercent,
  usageStatus,
  type UsageStatus,
} from '@/domain/youtube-usage';

export interface TrendDay {
  day: string;
  calls: number;
  percent: number;
}

export interface YoutubeUsageView {
  bucket: string;
  endpoint: string;
  timezone: string;
  generatedAt: string | null;
  today: {
    day: string | null;
    dayStart: string | null;
    dayEnd: string | null;
    calls: number;
    limit: number;
    remaining: number;
    usagePercent: number;
    status: UsageStatus;
    ok: number;
    quotaExceeded: number;
    http4xx: number;
    http5xx: number;
    networkError: number;
    lastSuccessfulAt: string | null;
  };
  efficiency: {
    visibleSearches: number;
    cacheHits: number;
    upstream: number;
    breakerOpen: number;
    gated: number;
    cacheHitRate: number | null;
    callsPerVisibleSearch: number | null;
  };
  blocked: { rateLimited: number; budgetGuarded: number };
  budget: { reserved: number; softCeiling: number; hardReserve: number; reserveRemaining: number };
  trend: {
    daily7: TrendDay[];
    daily30: TrendDay[];
    peakHour: { hourUtc: string; calls: number; pacificLabel: string | null } | null;
  };
}

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const nullableNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

function trend(raw: unknown, limit: number): TrendDay[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    const row = (r ?? {}) as { day?: unknown; calls?: unknown };
    const calls = num(row.calls);
    return { day: String(row.day ?? ''), calls, percent: usagePercent(calls, limit) };
  });
}

/**
 * Fetch the console view.
 *
 * THROWS on an unreadable RPC rather than returning zeros. A console that renders "0 calls today"
 * when the database is unreachable would be indistinguishable from a quiet day — and that is the
 * one lie this surface must not tell, because a quiet day is evidence and an outage is not.
 */
export async function getYoutubeUsage(trendDays = 30): Promise<YoutubeUsageView> {
  const { data, error } = await karaokeDb().rpc('karaoke_youtube_search_usage', {
    p_trend_days: trendDays,
  });
  if (error || !data || typeof data !== 'object') {
    throw new Error('youtube_usage_unavailable');
  }

  const d = data as Record<string, unknown>;
  const today = (d.today ?? {}) as Record<string, unknown>;
  const eff = (d.efficiency ?? {}) as Record<string, unknown>;
  const blocked = (d.blocked ?? {}) as Record<string, unknown>;
  const budget = (d.budget ?? {}) as Record<string, unknown>;
  const tr = (d.trend ?? {}) as Record<string, unknown>;
  const peak = (tr.peak_hour ?? null) as Record<string, unknown> | null;

  const limit = num(today.limit, 1000);
  const calls = num(today.calls);
  // The RPC's own percentage is authoritative; `usagePercent` is only the fallback shape.
  const percent = typeof today.usage_pct === 'number' ? today.usage_pct : usagePercent(calls, limit);
  const softCeiling = num(budget.soft_ceiling, 850);
  const reserved = num(budget.reserved);

  return {
    bucket: String(d.bucket ?? 'search_queries'),
    endpoint: String(d.endpoint ?? 'search.list'),
    timezone: String(d.timezone ?? 'America/Los_Angeles'),
    generatedAt: str(d.generated_at),
    today: {
      day: str(today.day),
      dayStart: str(today.day_start),
      dayEnd: str(today.day_end),
      calls,
      limit,
      // Taken from the RPC when present so the console and the evidence agree exactly.
      remaining: typeof today.remaining === 'number' ? today.remaining : remainingCalls(calls, limit),
      usagePercent: percent,
      status: usageStatus(percent),
      ok: num(today.ok),
      quotaExceeded: num(today.quota_exceeded),
      http4xx: num(today.http_4xx),
      http5xx: num(today.http_5xx),
      networkError: num(today.network_error),
      lastSuccessfulAt: str(today.last_successful_at),
    },
    efficiency: {
      visibleSearches: num(eff.visible_searches),
      cacheHits: num(eff.cache_hits),
      upstream: num(eff.upstream),
      breakerOpen: num(eff.breaker_open),
      gated: num(eff.gated),
      cacheHitRate: nullableNum(eff.cache_hit_rate),
      callsPerVisibleSearch: nullableNum(eff.calls_per_visible_search),
    },
    blocked: {
      rateLimited: num(blocked.rate_limited),
      budgetGuarded: num(blocked.budget_guarded),
    },
    budget: {
      reserved,
      softCeiling,
      hardReserve: num(budget.hard_reserve, limit - softCeiling),
      reserveRemaining: Math.max(softCeiling - reserved, 0),
    },
    trend: {
      daily7: trend(tr.daily_7, limit),
      daily30: trend(tr.daily_30, limit),
      peakHour:
        peak && typeof peak.hour_utc === 'string'
          ? {
              hourUtc: peak.hour_utc,
              calls: num(peak.calls),
              pacificLabel: pacificHourLabel(peak.hour_utc),
            }
          : null,
    },
  };
}
