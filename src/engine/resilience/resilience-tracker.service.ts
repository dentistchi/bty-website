/**
 * Resilience score from Arena **trailing** CLEAN streak, slip→recovery day sum, and Center healing phase progress.
 * Persists snapshots to `user_resilience_scores`; emits `resilience_milestone_reached` at 25/50/75/100 on threshold cross.
 *
 * Formula: `clamp(0–100, round(consecutive_clean×10 + phase_completions×15 − recovery_days×2))`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  HEALING_PHASE_ORDER,
  type HealingPhase,
} from "@/engine/healing/healing-phase.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const MILESTONE_THRESHOLDS = [25, 50, 75, 100] as const;

export type ResilienceMilestonePayload = {
  event: "resilience_milestone_reached";
  userId: string;
  threshold: (typeof MILESTONE_THRESHOLDS)[number];
  score: number;
  computedAt: string;
};

export type ResilienceScore = {
  score: number;
  /** Trailing consecutive CLEAN choices (most recent plays, chronological history). */
  consecutive_clean_choices: number;
  /** Sum of calendar-day spans from each slip to first CLEAN play after (integrity_slip_log + choice times). */
  recovery_days: number;
  /** Same as legacy field: penalty term `−2×recovery_days` applied in score (negative or zero). */
  recovery_speed_component: number;
  /** Phases completed / progressed on Center healing track (`user_healing_phase`). */
  center_phase_completions: number;
  /** Current Center healing phase row (mentor UI). */
  current_healing_phase: HealingPhase | null;
  computed_at: string;
  /** Thresholds newly crossed vs previous persisted snapshot (this run only, when `persist` is true). */
  milestones_crossed: readonly number[];
};

/** GET `/api/bty/center/resilience` JSON shape (engine score + slip average). */
export type ResilienceScoreCardApi = ResilienceScore & {
  recovery_avg_days: number;
  integrity_slip_count: number;
};

const listeners = new Set<(p: ResilienceMilestonePayload) => void | Promise<void>>();

export function onResilienceMilestone(
  fn: (p: ResilienceMilestonePayload) => void | Promise<void>,
): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emitMilestones(payloads: ResilienceMilestonePayload[]): void {
  for (const p of payloads) {
    for (const fn of listeners) {
      try {
        void fn(p);
      } catch {
        /* no-op */
      }
    }
  }
}

function resolveClient(supabase?: SupabaseClient): SupabaseClient | null {
  return supabase ?? getSupabaseAdmin();
}

type ChoiceRow = { flag_type: string; played_at: string };

export function isCleanChoiceFlag(flagType: string): boolean {
  return typeof flagType === "string" && flagType.trim().toLowerCase() === "clean";
}

/** Trailing consecutive CLEAN count from the end of time-ordered choices. */
export function countTrailingConsecutiveCleanChoices(rows: ChoiceRow[]): number {
  if (rows.length === 0) return 0;
  let n = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const ft = rows[i]?.flag_type;
    if (isCleanChoiceFlag(typeof ft === "string" ? ft : "")) n += 1;
    else break;
  }
  return n;
}

/**
 * Phases completed on the healing track: at ACK=0 … before RENEWAL=3 prior steps done;
 * journey finished when `completed_at` is set → 4.
 */
export function phaseCompletionsFromHealingRow(
  row: { phase: string; completed_at: string | null } | null,
): number {
  if (!row) return 0;
  if (row.completed_at) return 4;
  const idx = HEALING_PHASE_ORDER.indexOf(row.phase as HealingPhase);
  if (idx < 0) return 0;
  return idx;
}

/** Sum of days from each slip `created_at` to first CLEAN play after; +30d penalty if no CLEAN yet. */
export function sumRecoveryDays(
  slips: readonly { created_at: string }[],
  cleanPlayTimesMsAsc: readonly number[],
): number {
  const dayMs = 24 * 60 * 60 * 1000;
  let sum = 0;
  for (const slip of slips) {
    const t0 = new Date(slip.created_at).getTime();
    const nextClean = cleanPlayTimesMsAsc.find((t) => t > t0);
    if (nextClean == null) {
      sum += 30;
    } else {
      sum += (nextClean - t0) / dayMs;
    }
  }
  return sum;
}

function extractCleanPlayTimesMsAsc(rows: ChoiceRow[]): number[] {
  return rows
    .filter((r) => isCleanChoiceFlag(r.flag_type))
    .map((r) => new Date(r.played_at).getTime())
    .sort((a, b) => a - b);
}

async function fetchChoicesChronological(
  client: SupabaseClient,
  userId: string,
): Promise<ChoiceRow[]> {
  const { data, error } = await client
    .from("user_scenario_choice_history")
    .select("flag_type, played_at")
    .eq("user_id", userId)
    .order("played_at", { ascending: true });

  if (error) throw new Error(`fetchChoicesChronological: ${error.message}`);
  return (data ?? []) as ChoiceRow[];
}

async function fetchIntegritySlips(
  client: SupabaseClient,
  userId: string,
): Promise<{ created_at: string }[]> {
  const { data, error } = await client
    .from("integrity_slip_log")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`fetchIntegritySlips: ${error.message}`);
  return (data ?? []) as { created_at: string }[];
}

async function fetchHealingPhaseRow(
  client: SupabaseClient,
  userId: string,
): Promise<{ phase: HealingPhase; completed_at: string | null } | null> {
  const { data, error } = await client
    .from("user_healing_phase")
    .select("phase, completed_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`fetchHealingPhaseRow: ${error.message}`);
  const row = data as { phase?: string; completed_at?: string | null } | null;
  if (!row?.phase) return null;
  const p = row.phase;
  if (
    p === "ACKNOWLEDGEMENT" ||
    p === "REFLECTION" ||
    p === "REINTEGRATION" ||
    p === "RENEWAL"
  ) {
    return {
      phase: p,
      completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
    };
  }
  return null;
}

async function latestPersistedScore(
  client: SupabaseClient,
  userId: string,
): Promise<number | null> {
  const { data, error } = await client
    .from("user_resilience_scores")
    .select("score")
    .eq("user_id", userId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`latestPersistedScore: ${error.message}`);
  if (!data) return null;
  return Number((data as { score: number }).score);
}

function crossedMilestones(prevScore: number | null, nextScore: number): number[] {
  const prev = prevScore == null || !Number.isFinite(prevScore) ? -1 : prevScore;
  const out: number[] = [];
  for (const t of MILESTONE_THRESHOLDS) {
    if (prev < t && nextScore >= t) out.push(t);
  }
  return out;
}

/**
 * `consecutive_clean×10 + phase_completions×15 − recovery_days×2`, clamped 0–100.
 */
export function computeResilienceScoreParts(input: {
  consecutive_clean_choices: number;
  recovery_days: number;
  center_phase_completions: number;
}): number {
  const raw =
    input.consecutive_clean_choices * 10 +
    input.center_phase_completions * 15 -
    input.recovery_days * 2;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Recompute resilience, optionally persist snapshot + emit milestone events when thresholds are newly crossed.
 */
export async function getResilienceScore(
  userId: string,
  options?: { supabase?: SupabaseClient; persist?: boolean },
): Promise<ResilienceScore> {
  const client = resolveClient(options?.supabase);
  const persist = options?.persist !== false;

  const empty: ResilienceScore = {
    score: 0,
    consecutive_clean_choices: 0,
    recovery_days: 0,
    recovery_speed_component: 0,
    center_phase_completions: 0,
    current_healing_phase: null,
    computed_at: new Date().toISOString(),
    milestones_crossed: [],
  };

  if (!client) {
    return empty;
  }

  const [choices, slips, healingRow] = await Promise.all([
    fetchChoicesChronological(client, userId),
    fetchIntegritySlips(client, userId),
    fetchHealingPhaseRow(client, userId),
  ]);

  const consecutive_clean_choices = countTrailingConsecutiveCleanChoices(choices);
  const cleanTimesAsc = extractCleanPlayTimesMsAsc(choices);
  const recovery_days = sumRecoveryDays(slips, cleanTimesAsc);
  const recovery_speed_component = -2 * recovery_days;

  const center_phase_completions = phaseCompletionsFromHealingRow(healingRow);

  const score = computeResilienceScoreParts({
    consecutive_clean_choices,
    recovery_days,
    center_phase_completions,
  });

  const current_healing_phase = healingRow?.phase ?? null;

  const computed_at = new Date().toISOString();

  let milestones_crossed: number[] = [];

  if (persist) {
    const prev = await latestPersistedScore(client, userId);
    const { error: insErr } = await client.from("user_resilience_scores").insert({
      user_id: userId,
      score,
      computed_at,
      consecutive_clean_choices,
      recovery_days,
      phase_completions: center_phase_completions,
    });
    if (insErr) throw new Error(`getResilienceScore: ${insErr.message}`);

    milestones_crossed = crossedMilestones(prev, score);
    const payloads: ResilienceMilestonePayload[] = milestones_crossed.map((threshold) => ({
      event: "resilience_milestone_reached",
      userId,
      threshold: threshold as ResilienceMilestonePayload["threshold"],
      score,
      computedAt: computed_at,
    }));
    emitMilestones(payloads);
  }

  return {
    score,
    consecutive_clean_choices,
    recovery_days,
    recovery_speed_component,
    center_phase_completions,
    current_healing_phase,
    computed_at,
    milestones_crossed,
  };
}
