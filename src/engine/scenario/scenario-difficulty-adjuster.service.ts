/**
 * After Arena CHOICE_CONFIRMED: nudge global catalog **difficulty floor** from AIR Δ + `flag_type`
 * (+5pp & CLEAN → up, −5pp & INTEGRITY_SLIP → down). Persists `user_difficulty_profile.difficulty_floor`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScenarioDifficultyTier } from "@/engine/scenario/scenario-selector.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** +5 percentage points on normalized AIR [0, 1]. */
export const DIFFICULTY_ADJUSTER_AIR_DELTA_UP = 0.05;

/** −5 percentage points on normalized AIR [0, 1]. */
export const DIFFICULTY_ADJUSTER_AIR_DELTA_DOWN = -0.05;

export type SessionOutcomeForDifficulty = {
  /** `newAir - previousAir` (normalized [0, 1] scale). */
  airDelta: number;
  /** Same as `user_scenario_choice_history.flag_type` / coach intent. */
  flagType: string;
  scenarioId: string;
  /** Catalog tier `1|2|3` for `scenarioId` when known. */
  scenarioDifficulty: ScenarioDifficultyTier;
};

function normalizeFlagKey(ft: string): string {
  return ft.trim().toUpperCase().replace(/-/g, "_");
}

function isCleanFlag(flagType: string): boolean {
  const u = normalizeFlagKey(flagType);
  const t = flagType.trim().toLowerCase();
  return u === "CLEAN" || t === "clean";
}

function isIntegritySlipFlag(flagType: string): boolean {
  const u = normalizeFlagKey(flagType);
  return u === "INTEGRITY_SLIP" || u.includes("INTEGRITY_SLIP");
}

async function fetchScenarioDifficultyFromDb(
  scenarioId: string,
  client: SupabaseClient,
): Promise<ScenarioDifficultyTier | null> {
  const tryParse = (row: { difficulty?: number | null } | null): ScenarioDifficultyTier | null => {
    if (!row) return null;
    const d = row.difficulty;
    return d === 1 || d === 2 || d === 3 ? d : null;
  };

  const a = await client
    .from("scenarios")
    .select("difficulty")
    .eq("id", scenarioId)
    .eq("locale", "en")
    .maybeSingle();
  const fromScenarioId = tryParse(a.data as { difficulty?: number | null } | null);
  if (fromScenarioId != null) return fromScenarioId;

  const b = await client
    .from("scenarios")
    .select("difficulty")
    .eq("id", scenarioId)
    .eq("locale", "en")
    .maybeSingle();
  return tryParse(b.data as { difficulty?: number | null } | null);
}

/**
 * Catalog difficulty for a scenario id (DB `scenarios` or **2** fallback for synthetic ids).
 */
export async function getScenarioDifficultyTier(
  scenarioId: string,
  supabase?: SupabaseClient,
): Promise<ScenarioDifficultyTier> {
  const client = supabase ?? getSupabaseAdmin();
  if (!client) return 2;
  const d = await fetchScenarioDifficultyFromDb(scenarioId, client);
  return d ?? 2;
}

function clampTier(n: number): ScenarioDifficultyTier {
  if (n <= 1) return 1;
  if (n >= 3) return 3;
  return n as ScenarioDifficultyTier;
}

/**
 * Current minimum difficulty tier (1–3). Default **1** when no profile row.
 */
export async function getDifficultyFloor(
  userId: string,
  supabase?: SupabaseClient,
): Promise<ScenarioDifficultyTier> {
  const client = supabase ?? getSupabaseAdmin();
  if (!client) return 1;

  const { data, error } = await client
    .from("user_difficulty_profile")
    .select("difficulty_floor")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[getDifficultyFloor]", error.message);
    return 1;
  }
  const f = (data as { difficulty_floor?: unknown } | null)?.difficulty_floor;
  const n = typeof f === "number" ? f : Number(f);
  return n === 1 || n === 2 || n === 3 ? n : 1;
}

/**
 * Apply AIR + flag rules and upsert `user_difficulty_profile`. Idempotent per session call.
 */
export async function adjustDifficultyFloorAfterSession(
  userId: string,
  input: SessionOutcomeForDifficulty,
  supabase?: SupabaseClient,
): Promise<ScenarioDifficultyTier> {
  const client = supabase ?? getSupabaseAdmin();
  if (!client) return 1;

  const current = await getDifficultyFloor(userId, client);
  let next = current;

  if (input.airDelta > DIFFICULTY_ADJUSTER_AIR_DELTA_UP && isCleanFlag(input.flagType)) {
    next = clampTier(current + 1);
  } else if (input.airDelta < DIFFICULTY_ADJUSTER_AIR_DELTA_DOWN && isIntegritySlipFlag(input.flagType)) {
    next = clampTier(current - 1);
  } else {
    return current;
  }

  if (next === current) return current;

  const now = new Date().toISOString();
  const { error } = await client.from("user_difficulty_profile").upsert(
    {
      user_id: userId,
      difficulty_floor: next,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.warn("[adjustDifficultyFloorAfterSession]", error.message);
    return current;
  }

  return next;
}

/**
 * Build inputs from CHOICE_CONFIRMED context and run {@link adjustDifficultyFloorAfterSession}.
 */
export async function adjustDifficultyFloorFromChoiceConfirmed(
  userId: string,
  event: {
    scenarioId: string;
    flagType: string;
    air: { newAir: number; previousAir: number | null };
  },
  supabase?: SupabaseClient,
): Promise<void> {
  const prev = event.air.previousAir ?? event.air.newAir;
  const airDelta = event.air.newAir - prev;
  const scenarioDifficulty = await getScenarioDifficultyTier(event.scenarioId, supabase);
  await adjustDifficultyFloorAfterSession(
    userId,
    {
      airDelta,
      flagType: event.flagType,
      scenarioId: event.scenarioId,
      scenarioDifficulty,
    },
    supabase,
  );
}
