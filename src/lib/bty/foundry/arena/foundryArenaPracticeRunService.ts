import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArenaScenarioDraft, SelectedPath } from "@/domain/foundry/arena-draft/types";
import {
  coerceStoredPath,
  mergeSelectedPath,
  validateSelectedPath,
  type PathInput,
} from "@/domain/foundry/arena-draft/path";

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
  published_by: string;
  scenario_snapshot: ArenaScenarioDraft;
  status: "published" | "retired";
};

/**
 * May this user see/play this practice? Creator (published_by) OR approved Arena
 * member. Preserves learner access for others' practices while never forcing a
 * creator into a separate approved-member role to reach their own work.
 */
export function canAccessPractice(
  practice: { published_by: string },
  userId: string,
  isApprovedMember: boolean,
): boolean {
  return isApprovedMember || practice.published_by === userId;
}

/**
 * A THIRD legitimate way in: you did the training this practice was built from
 * (Slice 3.2M-2).
 *
 * Measured before changing anything: the rule above is `approved member OR creator`, so a
 * person who completed the source training and was invited to "now try it" was refused by a
 * membership gate that has nothing to do with their training. That is the blocker preflight
 * predicted.
 *
 * The new path is the narrowest one the durable data already supports: a completed training
 * progress row for THIS practice's source event, linked to THIS user. `linked_user_id` is
 * written when an authenticated learner completes (or later claims) — so it means
 * "identified participant who finished", never "someone who opened a link". Nobody gains
 * access by guessing a practice id, and no fixture or Founder bypass exists.
 */
export async function completedSourceTraining(
  admin: SupabaseClient,
  userId: string,
  sourceEventId: string,
): Promise<boolean> {
  if (!userId || !sourceEventId) return false;
  const { data } = await admin
    .from("foundry_event_training_progress")
    .select("id, completed_at")
    .eq("event_id", sourceEventId)
    .eq("linked_user_id", userId);
  return ((data ?? []) as { completed_at: string | null }[]).some((r) => Boolean(r.completed_at));
}

/** The whole access question, in one place: membership, authorship, or having done it. */
export async function resolvePracticeAccess(
  admin: SupabaseClient,
  practice: { published_by: string; source_event_id: string },
  userId: string,
  isApprovedMember: boolean,
): Promise<boolean> {
  if (canAccessPractice(practice, userId, isApprovedMember)) return true;
  return completedSourceTraining(admin, userId, practice.source_event_id);
}

type PracticeRunRow = {
  id: string;
  practice_id: string;
  user_id: string;
  status: string;
  completed_at: string | null;
  selected_path?: unknown;
};

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/**
 * Published practices available to the user, newest first, with completion flag.
 * Creator visibility OR approved-learner visibility: the user always sees the
 * practices they published; an approved member additionally sees all_members
 * practices. A non-approved creator therefore still sees their own work.
 */
export async function listAvailablePractices(
  admin: SupabaseClient,
  userId: string,
  isApprovedMember: boolean,
): Promise<AvailablePractice[]> {
  const cols = "id, practice_title, source_training_title, source_module_version, published_at, published_by";
  type Raw = Omit<AvailablePractice, "completed"> & { published_by: string };

  // Always: the user's OWN published practices (creator visibility).
  const { data: own } = await admin
    .from("foundry_published_arena_practices")
    .select(cols)
    .eq("status", "published")
    .eq("published_by", userId)
    .order("published_at", { ascending: false })
    .returns<Raw[]>();

  // Approved members additionally see shared (all_members) practices.
  let shared: Raw[] = [];
  if (isApprovedMember) {
    const { data } = await admin
      .from("foundry_published_arena_practices")
      .select(cols)
      .eq("status", "published")
      .eq("availability", "all_members")
      .order("published_at", { ascending: false })
      .returns<Raw[]>();
    shared = data ?? [];
  }

  const byId = new Map<string, Raw>();
  for (const p of [...(own ?? []), ...shared]) byId.set(p.id, p);
  const list = [...byId.values()].sort((a, b) => (a.published_at < b.published_at ? 1 : -1));
  if (list.length === 0) return [];

  const { data: runs } = await admin
    .from("foundry_arena_practice_runs")
    .select("practice_id, status")
    .eq("user_id", userId)
    .eq("status", "completed")
    .returns<{ practice_id: string; status: string }[]>();
  const completed = new Set((runs ?? []).map((r) => r.practice_id));

  return list.map((p) => ({
    id: p.id,
    practice_title: p.practice_title,
    source_training_title: p.source_training_title,
    source_module_version: p.source_module_version,
    published_at: p.published_at,
    completed: completed.has(p.id),
  }));
}

/** Load a published practice to play. Returns null if missing or retired (not playable). */
export async function getPlayablePractice(
  admin: SupabaseClient,
  practiceId: string,
): Promise<PlayablePractice | null> {
  const { data } = await admin
    .from("foundry_published_arena_practices")
    .select(
      "id, practice_title, source_training_title, source_event_id, source_module_version, published_by, scenario_snapshot, status",
    )
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
): Promise<ServiceResult<{ runId: string; resumed: boolean; selectedPath: SelectedPath | null }>> {
  const practice = await getPlayablePractice(admin, practiceId);
  if (!practice) return { ok: false, reason: "practice_not_available" };

  // Resume an in-progress run AND its stored decision path (Slice 3.2I — server-
  // authoritative branch restoration; the client renders the same branch it left).
  const { data: existing } = await admin
    .from("foundry_arena_practice_runs")
    .select("id, selected_path")
    .eq("user_id", userId)
    .eq("practice_id", practiceId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; selected_path: unknown }>();
  if (existing) {
    return { ok: true, value: { runId: existing.id, resumed: true, selectedPath: coerceStoredPath(existing.selected_path) } };
  }

  const { data, error } = await admin
    .from("foundry_arena_practice_runs")
    .insert({ practice_id: practiceId, user_id: userId })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) return { ok: false, reason: error?.message ?? "practice_run_start_failed" };
  return { ok: true, value: { runId: data.id, resumed: false, selectedPath: null } };
}

/**
 * Record (idempotently) the learner's cumulative decision path on their own run, after
 * validating every id against the AUTHORITATIVE published snapshot (Slice 3.2I). Fails
 * closed on unknown/cross-branch/out-of-order ids, cross-user or cross-practice runs, or
 * a primary change mid-run. Returns the canonical stored path. Never trusts client text.
 */
export async function recordSelectedPath(
  admin: SupabaseClient,
  userId: string,
  practiceId: string,
  runId: string,
  input: PathInput,
): Promise<ServiceResult<{ selectedPath: SelectedPath }>> {
  const practice = await getPlayablePractice(admin, practiceId);
  if (!practice) return { ok: false, reason: "practice_not_available" };

  const { data: run } = await admin
    .from("foundry_arena_practice_runs")
    .select("id, practice_id, user_id, status, completed_at, selected_path")
    .eq("id", runId)
    .eq("user_id", userId)
    .eq("practice_id", practiceId)
    .maybeSingle<PracticeRunRow>();
  if (!run) return { ok: false, reason: "practice_run_not_found" };

  const validated = validateSelectedPath(practice.scenario_snapshot, input);
  if (!validated.ok) return { ok: false, reason: validated.reason };

  const existing = coerceStoredPath(run.selected_path);
  const merged = mergeSelectedPath(existing, validated.value);
  if (!merged.ok) return { ok: false, reason: merged.reason };

  // A completed run's evidence is immutable — accept only an identical (idempotent) write.
  if (run.status === "completed") {
    const same = JSON.stringify(existing) === JSON.stringify(merged.value);
    return same ? { ok: true, value: { selectedPath: merged.value } } : { ok: false, reason: "run_completed" };
  }

  const { error } = await admin
    .from("foundry_arena_practice_runs")
    .update({ selected_path: merged.value })
    .eq("id", runId)
    .eq("user_id", userId)
    .eq("status", "in_progress");
  if (error) return { ok: false, reason: error.message };
  return { ok: true, value: { selectedPath: merged.value } };
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

// ---------------------------------------------------------------------------
// Guided training → its own practice (Slice 3.2M-2)
// ---------------------------------------------------------------------------

/**
 * The published practice built from THIS training event, if one exists.
 *
 * The binding already existed in data — `source_event_id` — and nowhere in the product.
 * This is the doorway: a learner who just finished a training can be offered the practice
 * that was made from it, instead of hunting for it in a general list.
 *
 * Title only. No scenario, no snapshot, no owner — the practice route re-authorises on entry.
 */
export async function publishedPracticeForEvent(
  admin: SupabaseClient,
  eventId: string,
): Promise<{ id: string; title: string } | null> {
  if (!eventId) return null;
  // Newest chosen in code rather than by `.order().limit()`: this runs on the learner's
  // completion path, and one practice per training is the norm, not a page of them.
  const { data } = await admin
    .from("foundry_published_arena_practices")
    .select("id, practice_title, published_at, status")
    .eq("source_event_id", eventId);
  const rows = ((data ?? []) as { id: string; practice_title: string; published_at: string | null; status: string }[])
    .filter((r) => r.status === "published")
    .sort((a, b) => String(b.published_at ?? "").localeCompare(String(a.published_at ?? "")));
  const top = rows[0];
  return top ? { id: top.id, title: top.practice_title } : null;
}

/**
 * Did THIS person actually rehearse THIS training? (Slice 3.2M-2)
 *
 * Derived, never stored. Three durable facts have to line up: the practice was built from
 * this event, the run belongs to this identified learner, and the run reached the completed
 * state the existing engine already writes. Reading it, starting it, or making one choice
 * and leaving all fail this — which is the whole point.
 *
 * No new column caches it. A cached rung is a rung that can disagree with its own evidence.
 */
export async function hasCompletedPracticeForEvent(
  admin: SupabaseClient,
  userId: string,
  eventId: string,
): Promise<boolean> {
  if (!userId || !eventId) return false;
  const { data: practices } = await admin
    .from("foundry_published_arena_practices")
    .select("id")
    .eq("source_event_id", eventId);
  const ids = (practices ?? []).map((p) => (p as { id: string }).id);
  if (ids.length === 0) return false;
  const { data: runs } = await admin
    .from("foundry_arena_practice_runs")
    .select("id, practice_id, status")
    .eq("user_id", userId)
    .eq("status", "completed");
  const set = new Set(ids);
  return ((runs ?? []) as { practice_id: string }[]).some((r) => set.has(r.practice_id));
}
