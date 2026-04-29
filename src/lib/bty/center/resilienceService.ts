/**
 * Center resilience service — DB interaction layer.
 * Fetches letter rows from Supabase, delegates to domain for aggregation.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aggregateLetterRowsToDailyEntries,
  type LetterRow,
  type ResilienceDayEntry,
} from "@/domain/center/resilience";

/**
 * Parse and clamp period parameter: integer 1–365, or undefined.
 */
export function parsePeriodDays(raw: string | null): number | undefined {
  if (raw == null) return undefined;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.min(365, n);
}

/**
 * Fetch letter rows and return aggregated daily resilience entries.
 */
export async function getResilienceEntries(
  supabase: SupabaseClient,
  userId: string,
  periodDays?: number,
): Promise<{ ok: true; entries: ResilienceDayEntry[] } | { ok: false; error: string }> {
  const { data: rows, error } = await supabase
    .from("center_letters")
    .select("energy, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!rows?.length) {
    return { ok: true, entries: [] };
  }

  const entries = aggregateLetterRowsToDailyEntries(rows as LetterRow[], {
    periodDays,
  });

  return { ok: true, entries };
}
