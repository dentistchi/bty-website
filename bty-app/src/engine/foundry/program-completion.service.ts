/**
 * Foundry program lifecycle: `program_selected` → `user_program_progress`; at 100% →
 * `completed_at`, {@link refreshFoundryProgramRecommendations} + {@link getRecommendations},
 * optional healing {@link advancePhase} when catalog `phase_tags` match current phase and
 * {@link getPhaseGateStatus} is satisfied, then {@link handleFoundryCompletion} +
 * in-process `program_completed` listeners ({@link notifyProgramCompleted}).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { advanceLearningPath } from "@/engine/foundry/learning-path.service";
import {
  getRecommendations,
  refreshFoundryProgramRecommendations,
} from "@/engine/foundry/program-recommender.service";
import {
  handleFoundryCompletion,
  type FoundryReturnResult,
  type HandleFoundryCompletionOptions,
} from "@/engine/integration/foundry-arena-return";
import {
  getPhaseGateStatus,
  type PhaseGateStatus,
} from "@/engine/healing/healing-content.service";
import { advancePhase, getCurrentPhase, type HealingPhase } from "@/engine/healing/healing-phase.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Browser `CustomEvent` name; API returns this string for clients to dispatch after POST. */
export const PROGRAM_COMPLETED_EVENT = "program_completed" as const;

export type ProgramCompletedPayload = {
  event: typeof PROGRAM_COMPLETED_EVENT;
  userId: string;
  programId: string;
  completedAt: string;
  result: FoundryReturnResult;
};

export type ProgramCompletedDetail = {
  userId: string;
  programId: string;
  completedAt: string;
};

const listeners = new Set<(p: ProgramCompletedPayload) => void | Promise<void>>();

export function onProgramCompleted(
  fn: (p: ProgramCompletedPayload) => void | Promise<void>,
): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emitProgramCompleted(p: ProgramCompletedPayload): void {
  for (const fn of listeners) {
    try {
      void fn(p);
    } catch {
      /* no-op */
    }
  }
}

/**
 * Runs Arena return routing + Elite hook and emits in-process `program_completed` subscribers.
 * Prefer {@link markProgramComplete} so DB progress + recommendations stay in sync.
 */
export async function notifyProgramCompleted(
  userId: string,
  programId: string,
  options?: HandleFoundryCompletionOptions & { completedAt?: string },
): Promise<FoundryReturnResult> {
  const result = await handleFoundryCompletion(userId, programId, options);
  emitProgramCompleted({
    event: PROGRAM_COMPLETED_EVENT,
    userId,
    programId,
    completedAt: options?.completedAt ?? new Date().toISOString(),
    result,
  });
  return result;
}

export type ProgramProgress = {
  user_id: string;
  program_id: string;
  started_at: string;
  completed_at: string | null;
  completion_pct: number;
};

function rowToProgress(row: Record<string, unknown>): ProgramProgress | null {
  const user_id = row.user_id;
  const program_id = row.program_id;
  const started_at = row.started_at;
  if (typeof user_id !== "string" || typeof program_id !== "string" || typeof started_at !== "string") {
    return null;
  }
  const completion_pct = Number(row.completion_pct ?? 0);
  const completed_at =
    row.completed_at == null
      ? null
      : typeof row.completed_at === "string"
        ? row.completed_at
        : String(row.completed_at);
  return {
    user_id,
    program_id,
    started_at,
    completed_at,
    completion_pct: Number.isFinite(completion_pct) ? Math.min(100, Math.max(0, completion_pct)) : 0,
  };
}

function resolveClient(supabase?: SupabaseClient): SupabaseClient | null {
  return supabase ?? getSupabaseAdmin();
}

/**
 * Upsert progress on program card select: new row or restart after a prior completion.
 */
export async function recordProgramSelected(
  userId: string,
  programId: string,
  supabase?: SupabaseClient,
): Promise<ProgramProgress> {
  const client = resolveClient(supabase);
  if (!client) throw new Error("recordProgramSelected: Supabase client not available");

  const { data: existing, error: exErr } = await client
    .from("user_program_progress")
    .select("user_id, program_id, started_at, completed_at, completion_pct")
    .eq("user_id", userId)
    .eq("program_id", programId)
    .maybeSingle();

  if (exErr) throw new Error(exErr.message);

  const now = new Date().toISOString();

  if (!existing) {
    const { data, error } = await client
      .from("user_program_progress")
      .insert({
        user_id: userId,
        program_id: programId,
        started_at: now,
        completion_pct: 0,
        completed_at: null,
      })
      .select("user_id, program_id, started_at, completed_at, completion_pct")
      .single();
    if (error) throw new Error(error.message);
    const p = rowToProgress(data as Record<string, unknown>);
    if (!p) throw new Error("recordProgramSelected: insert parse failed");
    return p;
  }

  const ex = rowToProgress(existing as Record<string, unknown>);
  if (!ex) throw new Error("recordProgramSelected: existing parse failed");

  if (ex.completed_at != null) {
    const { data, error } = await client
      .from("user_program_progress")
      .update({
        started_at: now,
        completion_pct: 0,
        completed_at: null,
      })
      .eq("user_id", userId)
      .eq("program_id", programId)
      .select("user_id, program_id, started_at, completed_at, completion_pct")
      .single();
    if (error) throw new Error(error.message);
    const p = rowToProgress(data as Record<string, unknown>);
    if (!p) throw new Error("recordProgramSelected: restart parse failed");
    return p;
  }

  return ex;
}

/** Same as {@link recordProgramSelected} — `program_selected` → `user_program_progress` upsert. */
export const onProgramSelected = recordProgramSelected;

async function loadProgramPhaseTags(
  client: SupabaseClient,
  programId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("program_catalog")
    .select("phase_tags")
    .eq("program_id", programId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const raw = (data as { phase_tags?: unknown } | null)?.phase_tags;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

/**
 * If the completed program lists the user’s current healing phase in `phase_tags` and
 * {@link getPhaseGateStatus} reports full gate completion, advance the healing phase.
 */
export async function maybeAdvanceHealingAfterProgramComplete(
  userId: string,
  programId: string,
  supabase?: SupabaseClient,
): Promise<{ advanced: boolean; phase: HealingPhase | null }> {
  const client = resolveClient(supabase);
  if (!client) return { advanced: false, phase: null };

  const current = await getCurrentPhase(userId, client);
  if (!current) return { advanced: false, phase: null };

  const phaseTags = await loadProgramPhaseTags(client, programId);
  if (!phaseTags.includes(current)) return { advanced: false, phase: current };

  const gate = await getPhaseGateStatus(userId, current, client);
  if (gate.completion_pct < 1) return { advanced: false, phase: current };

  const next = await advancePhase(userId, client);
  return { advanced: true, phase: next };
}

export type ProgramCompletionOutcome = {
  progress: ProgramProgress;
  recommendations: Awaited<ReturnType<typeof getRecommendations>>;
  healing: { advanced: boolean; phase: HealingPhase | null };
};

async function persistAndRefreshAt100(
  userId: string,
  programId: string,
  supabase: SupabaseClient,
): Promise<ProgramCompletionOutcome> {
  const now = new Date().toISOString();

  const { data: prior } = await supabase
    .from("user_program_progress")
    .select("started_at")
    .eq("user_id", userId)
    .eq("program_id", programId)
    .maybeSingle();

  const started_at =
    typeof (prior as { started_at?: string } | null)?.started_at === "string"
      ? (prior as { started_at: string }).started_at
      : now;

  const { data, error } = await supabase
    .from("user_program_progress")
    .upsert(
      {
        user_id: userId,
        program_id: programId,
        started_at,
        completion_pct: 100,
        completed_at: now,
      },
      { onConflict: "user_id,program_id" },
    )
    .select("user_id, program_id, started_at, completed_at, completion_pct")
    .single();

  if (error) throw new Error(error.message);
  const progress = rowToProgress(data as Record<string, unknown>);
  if (!progress) throw new Error("persistAndRefreshAt100: parse failed");

  await refreshFoundryProgramRecommendations(userId, supabase);
  const recommendations = await getRecommendations(userId, supabase);
  const healing = await maybeAdvanceHealingAfterProgramComplete(userId, programId, supabase);

  return { progress, recommendations, healing };
}

export type MarkProgramCompletedResult = ProgramCompletionOutcome & { foundry: FoundryReturnResult };

/**
 * Mark program 100% complete: persist, refresh queue, healing hook, {@link notifyProgramCompleted}.
 */
export async function markProgramComplete(
  userId: string,
  programId: string,
  options?: { supabase?: SupabaseClient; locale?: HandleFoundryCompletionOptions["locale"] },
): Promise<MarkProgramCompletedResult> {
  const client = resolveClient(options?.supabase);
  if (!client) throw new Error("markProgramComplete: Supabase client not available");

  const locale = options?.locale ?? "en";
  const outcome = await persistAndRefreshAt100(userId, programId, client);
  const foundry = await notifyProgramCompleted(userId, programId, {
    locale,
    completedAt: outcome.progress.completed_at ?? new Date().toISOString(),
  });
  try {
    await advanceLearningPath(userId, programId, { supabase: client });
  } catch {
    /* path advance is best-effort */
  }
  return { ...outcome, foundry };
}

/**
 * Increments `completion_pct` by `pct` (clamped 0–100). Missing row behaves like a fresh select
 * (`started_at` now). At 100% runs the same pipeline as {@link markProgramComplete} (persist,
 * {@link getPhaseGateStatus} via {@link maybeAdvanceHealingAfterProgramComplete}, recommendations,
 * {@link notifyProgramCompleted}).
 *
 * @returns Full completion payload when the increment reaches 100%; `undefined` when only a partial row was written.
 */
export async function updateProgramProgress(
  userId: string,
  programId: string,
  pct: number,
  options?: { supabase?: SupabaseClient; locale?: HandleFoundryCompletionOptions["locale"] },
): Promise<MarkProgramCompletedResult | undefined> {
  const client = resolveClient(options?.supabase);
  if (!client) throw new Error("updateProgramProgress: Supabase client not available");

  const delta = typeof pct === "number" && Number.isFinite(pct) ? pct : 0;
  if (delta === 0) return undefined;

  const row = await getProgramProgress(userId, programId, client);
  const base = row?.completion_pct ?? 0;
  if (row?.completed_at != null || base >= 100) return undefined;

  const newPct = Math.min(100, Math.max(0, base + delta));
  if (newPct >= 100) {
    return markProgramComplete(userId, programId, {
      supabase: client,
      locale: options?.locale,
    });
  }

  const started_at = row?.started_at ?? new Date().toISOString();
  const { error } = await client.from("user_program_progress").upsert(
    {
      user_id: userId,
      program_id: programId,
      started_at,
      completion_pct: newPct,
      completed_at: null,
    },
    { onConflict: "user_id,program_id" },
  );
  if (error) throw new Error(error.message);
  return undefined;
}

/**
 * Set completion percentage (absolute); at 100% runs the same path as {@link markProgramComplete}.
 */
export async function setProgramCompletionPct(
  userId: string,
  programId: string,
  completionPct: number,
  supabase?: SupabaseClient,
  locale?: HandleFoundryCompletionOptions["locale"],
): Promise<MarkProgramCompletedResult | { progress: ProgramProgress }> {
  const client = resolveClient(supabase);
  if (!client) throw new Error("setProgramCompletionPct: Supabase client not available");

  if (completionPct >= 100) {
    return markProgramComplete(userId, programId, { supabase: client, locale });
  }

  const pct = Math.min(100, Math.max(0, completionPct));
  const { data: prior } = await client
    .from("user_program_progress")
    .select("started_at")
    .eq("user_id", userId)
    .eq("program_id", programId)
    .maybeSingle();
  const started_at =
    typeof (prior as { started_at?: string } | null)?.started_at === "string"
      ? (prior as { started_at: string }).started_at
      : new Date().toISOString();

  const { data, error } = await client
    .from("user_program_progress")
    .upsert(
      {
        user_id: userId,
        program_id: programId,
        started_at,
        completion_pct: pct,
        completed_at: null,
      },
      { onConflict: "user_id,program_id" },
    )
    .select("user_id, program_id, started_at, completed_at, completion_pct")
    .single();

  if (error) throw new Error(error.message);
  const progress = rowToProgress(data as Record<string, unknown>);
  if (!progress) throw new Error("setProgramCompletionPct: parse failed");
  return { progress };
}

export async function getProgramProgress(
  userId: string,
  programId: string,
  supabase?: SupabaseClient,
): Promise<ProgramProgress | null> {
  const client = resolveClient(supabase);
  if (!client) {
    throw new Error(
      "getProgramProgress: pass supabase from the route (getSupabaseServerClient) or set SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const { data, error } = await client
    .from("user_program_progress")
    .select("user_id, program_id, started_at, completed_at, completion_pct")
    .eq("user_id", userId)
    .eq("program_id", programId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToProgress(data as Record<string, unknown>);
}
