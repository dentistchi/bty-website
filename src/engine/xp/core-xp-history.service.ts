/**
 * Core XP history from **`core_xp_ledger`** (immutable log; there is no separate `core_xp_log` table).
 * Daily cumulative snapshots + source bucket breakdown for Avatar / Leadership Engine widgets.
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Canonical ledger table name. */
export const CORE_XP_LEDGER_TABLE = "core_xp_ledger" as const;

export type CoreXPSourceBucket = "ARENA" | "LAB" | "FOUNDRY" | "MENTOR" | "OTHER";

export type LedgerRow = {
  delta_xp: number;
  source_type: string;
  created_at: string;
};

export type CoreXPDailySnapshot = {
  /** UTC date YYYY-MM-DD. */
  date: string;
  /** Cumulative Core XP at end of this day (signed `delta_xp` sums through that day). */
  cumulativeXp: number;
};

export type CoreXPHistory = {
  snapshots: CoreXPDailySnapshot[];
  totalCoreXp: number;
  computedAt: string;
};

export type XPBreakdown = {
  /** Percentages 0–100; sum to ~100 (floating rounding). */
  arenaPct: number;
  labPct: number;
  foundryPct: number;
  mentorPct: number;
  otherPct: number;
  /** Absolute XP attributed to each bucket (positive deltas only). */
  xpBySource: Record<CoreXPSourceBucket, number>;
};

export function mapSourceTypeToBucket(sourceType: string): CoreXPSourceBucket {
  const s = sourceType.trim().toUpperCase();
  if (s === "LAB" || s.startsWith("LAB_")) return "LAB";
  if (s.includes("FOUNDRY")) return "FOUNDRY";
  if (s.includes("MENTOR")) return "MENTOR";
  if (
    s.includes("ARENA") ||
    s.includes("RUN") ||
    s === "QUEST_CLAIM" ||
    s.includes("QUEST") ||
    s === "CARRYOVER" ||
    s.includes("SEASON")
  ) {
    return "ARENA";
  }
  return "OTHER";
}

function utcDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function enumerateUtcDaysInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  const a = new Date(`${start}T00:00:00.000Z`).getTime();
  const b = new Date(`${end}T00:00:00.000Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || a > b) return out;
  for (let t = a; t <= b; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** Signed net XP per UTC day (for cumulative line). */
function buildDailyDeltasSigned(rows: readonly LedgerRow[]): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const day = utcDayKey(r.created_at);
    if (!day) continue;
    const dx = Math.floor(Number(r.delta_xp ?? 0));
    byDay.set(day, (byDay.get(day) ?? 0) + dx);
  }
  return byDay;
}

function cumulativeSnapshots(byDay: Map<string, number>, fromDay: string, toDay: string): CoreXPDailySnapshot[] {
  const days = enumerateUtcDaysInclusive(fromDay, toDay);
  let run = 0;
  return days.map((date) => {
    run += byDay.get(date) ?? 0;
    return { date, cumulativeXp: run };
  });
}

async function fetchLedgerRows(
  userId: string,
  client: SupabaseClient | null,
): Promise<LedgerRow[]> {
  if (!client) return [];
  const { data, error } = await client
    .from(CORE_XP_LEDGER_TABLE)
    .select("delta_xp, source_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error || !data?.length) return [];
  return (data as LedgerRow[]).filter(
    (r) => typeof r.created_at === "string" && typeof r.source_type === "string",
  );
}

/**
 * Cumulative Core XP by UTC day for charting (Avatar progress / Leadership Engine).
 */
export async function getCoreXPHistory(
  userId: string,
  options?: { supabase?: SupabaseClient },
): Promise<CoreXPHistory> {
  const admin = options?.supabase ?? getSupabaseAdmin();
  const rows = await fetchLedgerRows(userId, admin);
  const computedAt = new Date().toISOString();

  if (rows.length === 0) {
    return { snapshots: [], totalCoreXp: 0, computedAt };
  }

  const byDay = buildDailyDeltasSigned(rows);
  const days = [...byDay.keys()].sort();
  const fromDay = days[0]!;
  const toDay = new Date().toISOString().slice(0, 10);

  const snapshots = cumulativeSnapshots(byDay, fromDay, toDay);
  const totalCoreXp = snapshots.length ? snapshots[snapshots.length - 1]!.cumulativeXp : 0;

  return { snapshots, totalCoreXp, computedAt };
}

/**
 * Percentage of Core XP (positive deltas) from ARENA / LAB / FOUNDRY / MENTOR buckets.
 */
export async function getCoreXPBreakdown(
  userId: string,
  options?: { supabase?: SupabaseClient },
): Promise<XPBreakdown> {
  const admin = options?.supabase ?? getSupabaseAdmin();
  const rows = await fetchLedgerRows(userId, admin);

  const xpBySource: Record<CoreXPSourceBucket, number> = {
    ARENA: 0,
    LAB: 0,
    FOUNDRY: 0,
    MENTOR: 0,
    OTHER: 0,
  };

  for (const r of rows) {
    const dx = Math.floor(Number(r.delta_xp ?? 0));
    if (dx <= 0) continue;
    const b = mapSourceTypeToBucket(r.source_type);
    xpBySource[b] += dx;
  }

  const total = Object.values(xpBySource).reduce((a, x) => a + x, 0);

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 10_000) / 100 : 0);

  return {
    arenaPct: pct(xpBySource.ARENA),
    labPct: pct(xpBySource.LAB),
    foundryPct: pct(xpBySource.FOUNDRY),
    mentorPct: pct(xpBySource.MENTOR),
    otherPct: pct(xpBySource.OTHER),
    xpBySource,
  };
}
