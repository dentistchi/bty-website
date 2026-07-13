/**
 * livingResponseYesterday (server) — Living Memory V0. Read-only, provenance-safe assembly of
 * YESTERDAY's context for the Living Response generator. Reads canonical, machine/own-generated columns
 * ONLY: yesterday's committed relationship (enum), BTY's own prior settled line (not user text), and a
 * presence boolean (user_day row existed). NO user PII, action_text, letter body, names, or scores.
 *
 * Fail-soft by construction: any degraded read contributes null for that field; a missing yesterday
 * commitment returns { existed:false, … } so the generator simply falls back to today-only behavior.
 * This adds a small number of indexed point-lookups on the GENERATION path only (never on restore).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LivingResponseRelationship, LivingResponseYesterday } from "@/domain/daily/livingResponse";
import { isLivingResponseRelationship } from "@/domain/daily/livingResponse";

const NONE: LivingResponseYesterday = { existed: false, relationship: null, livingResponse: null, completed: null };

/** Yesterday's canonical day key from today's "YYYY-MM-DD" (pure UTC calendar subtraction). */
export function previousDayKey(todayDayKey: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayDayKey);
  if (!m) return null;
  const prev = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - 86_400_000);
  const y = prev.getUTCFullYear();
  const mo = String(prev.getUTCMonth() + 1).padStart(2, "0");
  const d = String(prev.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

export async function readYesterdayContext(
  admin: SupabaseClient,
  userId: string,
  todayDayKey: string,
): Promise<LivingResponseYesterday> {
  const yKey = previousDayKey(todayDayKey);
  if (!yKey) return NONE;

  // Yesterday's committed relationship (the immutable one-per-day row). No commitment → no yesterday.
  let commitmentId: string | null = null;
  let relationship: LivingResponseRelationship | null = null;
  try {
    const { data } = await admin
      .from("today_relationship_commitments")
      .select("id, relationship")
      .eq("user_id", userId)
      .eq("day_key", yKey)
      .maybeSingle();
    const row = data as { id: string; relationship: string } | null;
    if (row) {
      commitmentId = String(row.id);
      relationship = isLivingResponseRelationship(row.relationship) ? row.relationship : null;
    }
  } catch {
    /* fail-soft */
  }
  if (!commitmentId) return NONE;

  // BTY's own prior settled line (generated|fallback). Pending/absent → null (nothing to continue from).
  let livingResponse: string | null = null;
  try {
    const { data } = await admin
      .from("today_living_responses")
      .select("perspective, status")
      .eq("commitment_id", commitmentId)
      .maybeSingle();
    const row = data as { perspective: string | null; status: string } | null;
    if (row && (row.status === "generated" || row.status === "fallback") && row.perspective) {
      livingResponse = row.perspective;
    }
  } catch {
    /* fail-soft */
  }

  // Presence proxy — did the user return yesterday? (a user_day row for yKey). null = unknown/degraded.
  let completed: boolean | null = null;
  try {
    const { data } = await admin
      .from("user_day")
      .select("day_key")
      .eq("user_id", userId)
      .eq("day_key", yKey)
      .maybeSingle();
    completed = !!data;
  } catch {
    completed = null;
  }

  return { existed: true, relationship, livingResponse, completed };
}
