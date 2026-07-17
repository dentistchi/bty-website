import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";

/**
 * Foundry Guided Arena Builder — practice discovery + run service (Slice 3.0B).
 *
 * Reads IMMUTABLE published practices and records a learner's start/completion in
 * `foundry_arena_practice_runs` — a table with NO XP columns, isolated from
 * `public.arena_runs`. A practice therefore earns exactly zero XP, writes no
 * pattern/leadership/level/complete_verified state, and never appends to
 * `user_scenario_history`. Existing Arena runs are untouched.
 *
 * V1 availability is narrow: any approved Arena member (gated at the route) may
 * play any published practice. Broader targeting/assignment is deferred.
 */

export type AvailablePractice = {
  id: string;
  practice_title: string;
  source_training_title: string;
  source_module_version: number;
  published_at: string;
  completed: boolean;
};

export type PlayablePractice = {
  id: string;
  practice_title: string;
  source_training_title: string;
  source_event_id: string;
  source_module_version: number;
  scenario_snapshot: ArenaScenarioDraft;
  status: "published" | "retired";
};

type PracticeRunRow = { id: string; practice_id: string; user_id: string; status: string; completed_at: string | null };

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/** All currently-published practices available to the user, newest first, with the user's completion flag. */
export async function listAvailablePractices(
  admin: SupabaseClient,
  userId: string,
): Promise<AvailablePractice[]> {
  const { data: practices } = await admin
    .from("foundry_published_arena_practices")
    .select("id, practice_title, source_training_title, source_module_version, published_at")
    .eq("status", "published")
    .eq("availability", "all_members")
    .order("published_at", { ascending: false })
    .returns<Omit<AvailablePractice, "completed">[]>();
  const list = practices ?? [];
  if (list.length === 0) return [];

  const { data: runs } = await admin
    .from("foundry_arena_practice_runs")
    .select("practice_id, status")
    .eq("user_id", userId)
    .eq("status", "completed")
    .returns<{ practice_id: string; status: string }[]>();
  const completed = new Set((runs ?? []).map((r) => r.practice_id));

  return list.map((p) => ({ ...p, completed: completed.has(p.id) }));
}

/** Load a published practice to play. Returns null if missing or retired (not playable). */
export async function getPlayablePractice(
  admin: SupabaseClient,
  practiceId: string,
): Promise<PlayablePractice | null> {
  const { data } = await admin
    .from("foundry_published_arena_practices")
    .select("id, practice_title, source_training_title, source_event_id, source_module_version, scenario_snapshot, status")
    .eq("id", practiceId)
    .maybeSingle<PlayablePractice>();
  if (!data || data.status !== "published") return null;
  return data;
}

// ---------------------------------------------------------------------------
// Run lifecycle (zero-XP by construction)
// ---------------------------------------------------------------------------

export type ServiceResult<T> = { ok: true; value: T } | { ok: false; reason: string };

/**
 * Start (or resume) a practice run for the user. Duplicate-tap safe: an existing
 * in-progress run for (user, practice) is returned rather than creating a second.
 * Fails honestly if the practice is missing/retired.
 */
export async function startPracticeRun(
  admin: SupabaseClient,
  userId: string,
  practiceId: string,
): Promise<ServiceResult<{ runId: string; resumed: boolean }>> {
  const practice = await getPlayablePractice(admin, practiceId);
  if (!practice) return { ok: false, reason: "practice_not_available" };

  const { data: existing } = await admin
    .from("foundry_arena_practice_runs")
    .select("id")
    .eq("user_id", userId)
    .eq("practice_id", practiceId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (existing) return { ok: true, value: { runId: existing.id, resumed: true } };

  const { data, error } = await admin
    .from("foundry_arena_practice_runs")
    .insert({ practice_id: practiceId, user_id: userId })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) return { ok: false, reason: error?.message ?? "practice_run_start_failed" };
  return { ok: true, value: { runId: data.id, resumed: false } };
}

/**
 * Mark the user's own run completed. Owner-scoped by user_id. Idempotent: an
 * already-completed run returns ok. No XP is awarded (there is nowhere to award it).
 */
export async function completePracticeRun(
  admin: SupabaseClient,
  userId: string,
  practiceId: string,
  runId: string,
): Promise<ServiceResult<{ completed: true }>> {
  const { data: run } = await admin
    .from("foundry_arena_practice_runs")
    .select("id, practice_id, user_id, status, completed_at")
    .eq("id", runId)
    .eq("user_id", userId)
    .eq("practice_id", practiceId)
    .maybeSingle<PracticeRunRow>();
  if (!run) return { ok: false, reason: "practice_run_not_found" };
  if (run.status === "completed") return { ok: true, value: { completed: true } };

  const { error } = await admin
    .from("foundry_arena_practice_runs")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("user_id", userId)
    .eq("status", "in_progress");
  if (error) return { ok: false, reason: error.message };
  return { ok: true, value: { completed: true } };
}

/** The user's latest run state for a practice (for reload). */
export async function getUserPracticeState(
  admin: SupabaseClient,
  userId: string,
  practiceId: string,
): Promise<"none" | "in_progress" | "completed"> {
  const { data } = await admin
    .from("foundry_arena_practice_runs")
    .select("status")
    .eq("user_id", userId)
    .eq("practice_id", practiceId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ status: string }>();
  if (!data) return "none";
  return data.status === "completed" ? "completed" : "in_progress";
}
