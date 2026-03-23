/**
 * Dear Me prompt selection from healing phase + `dear_me_letters` cadence.
 * Call on Center entry or after {@link advancePhase} (hooked dynamically from healing-phase).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCurrentPhase,
  type HealingPhase,
} from "@/engine/healing/healing-phase.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function resolveDearMeReadClient(supabase?: SupabaseClient): SupabaseClient {
  const c = supabase ?? getSupabaseAdmin();
  if (!c) {
    throw new Error(
      "[dear-me-recommender] Pass supabase from a route handler or set SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return c;
}

const MS_PER_DAY = 86_400_000;
const REFLECTION_STALE_DAYS = 14 as const;

export type DearMePromptType = "first_letter" | "reflection_check" | "awakening_letter" | "none";

export type DearMePrompt = {
  userId: string;
  prompt_type: DearMePromptType;
  healingPhase: HealingPhase | null;
  letterCount: number;
  lastWrittenAt: string | null;
  recommendedAt: string;
};

async function fetchLetterStats(
  client: SupabaseClient,
  userId: string,
): Promise<{ letterCount: number; lastWrittenAt: string | null }> {
  const { count, error: cErr } = await client
    .from("dear_me_letters")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (cErr) throw new Error(cErr.message);

  const { data: lastRow, error: lErr } = await client
    .from("dear_me_letters")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lErr) throw new Error(lErr.message);

  const last =
    lastRow && typeof (lastRow as { created_at?: string }).created_at === "string"
      ? (lastRow as { created_at: string }).created_at
      : null;

  return { letterCount: count ?? 0, lastWrittenAt: last };
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/**
 * Maps healing phase + letter history → prompt (see product rules in module doc).
 */
export function resolveDearMePromptType(
  phase: HealingPhase | null,
  letterCount: number,
  lastWrittenAtIso: string | null,
  now: Date,
): DearMePromptType {
  if (phase === "ACKNOWLEDGEMENT" && letterCount === 0) return "first_letter";

  if (phase === "REFLECTION") {
    if (letterCount === 0) return "first_letter";
    if (lastWrittenAtIso) {
      const last = new Date(lastWrittenAtIso);
      if (!Number.isNaN(last.getTime()) && daysBetween(last, now) > REFLECTION_STALE_DAYS) {
        return "reflection_check";
      }
    }
  }

  if (phase === "RENEWAL") return "awakening_letter";

  return "none";
}

/**
 * Recompute and upsert `dear_me_recommendations` (Center entry / phase advance).
 */
export async function refreshDearMeRecommendation(
  userId: string,
  supabase?: SupabaseClient,
): Promise<DearMePrompt> {
  const client = resolveDearMeReadClient(supabase);
  const now = new Date();
  const phase = await getCurrentPhase(userId, client);
  const { letterCount, lastWrittenAt } = await fetchLetterStats(client, userId);
  const prompt_type = resolveDearMePromptType(phase, letterCount, lastWrittenAt, now);
  const recommendedAt = now.toISOString();

  const admin = getSupabaseAdmin();
  if (admin) {
    const { error } = await admin.from("dear_me_recommendations").upsert(
      {
        user_id: userId,
        prompt_type,
        healing_phase: phase,
        letter_count: letterCount,
        last_letter_at: lastWrittenAt,
        recommended_at: recommendedAt,
        updated_at: recommendedAt,
      },
      { onConflict: "user_id" },
    );
    if (error) console.warn("[refreshDearMeRecommendation]", error.message);
  }

  return {
    userId,
    prompt_type,
    healingPhase: phase,
    letterCount,
    lastWrittenAt,
    recommendedAt,
  };
}

/**
 * Latest Dear Me CTA — refreshes recommendation then returns payload (same as refresh when admin available).
 */
export async function getDearMePrompt(
  userId: string,
  supabase?: SupabaseClient,
): Promise<DearMePrompt> {
  return refreshDearMeRecommendation(userId, supabase);
}
